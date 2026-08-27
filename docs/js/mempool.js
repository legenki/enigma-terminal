// The explorer's data source: mempool.space's public API.
//
// It replaced bitaps because of what bitaps could not answer. There was no way
// to list a block's transactions, no hashrate, no difficulty adjustment and no
// miner distribution — and three requests every five seconds to work with. This
// answers all four, sends Access-Control-Allow-Origin: *, and is already one of
// the explorers this game queries for balances, so it is one fewer service to
// trust rather than one more.
//
// The queue stays. The limit here is generous rather than absent, and a page
// that hammers a free service is a page that deserves to be cut off; caching an
// answer that cannot change costs nothing and asks for nothing.

export class ExplorerError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message);
    this.name = 'ExplorerError';
    this.status = status;
  }
}

const BASE = 'https://mempool.space/api/';

//: Well inside anything the service asks for, and far more than a person
//: clicking through blocks will ever need.
export const RATE = { calls: 12, windowMs: 10000 };

//: A confirmed block or transaction never changes, so it is kept for the
//: session. The tip, the pool and the mining figures are the live part.
export const TTL = { tip: 20000, mining: 120000, settled: 30 * 60 * 1000 };

/** Sats to a BTC string, with no floating point anywhere near it. */
export function btc(sats, { places = 8 } = {}) {
  const value =
    typeof sats === 'bigint' ? sats : BigInt(Math.round(Number(sats) || 0));
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const whole = abs / 100000000n;
  const frac = (abs % 100000000n).toString().padStart(8, '0').slice(0, places);
  return `${sign}${whole}.${frac}`;
}

export class ExplorerClient {
  constructor({ fetcher = null, now = () => Date.now(), base = BASE } = {}) {
    this.base = base;
    this.fetcher = fetcher || ((url) => fetch(url));
    this.now = now;
    this.cache = new Map();
    this.spent = [];
    this.chain = Promise.resolve();
  }

  /** Milliseconds until a token frees up; 0 when one is available now. */
  waitFor() {
    const cutoff = this.now() - RATE.windowMs;
    this.spent = this.spent.filter((at) => at > cutoff);
    if (this.spent.length < RATE.calls) return 0;
    return this.spent[0] + RATE.windowMs - this.now();
  }

  /**
   * One GET, queued behind every other and served from cache when possible.
   *
   * `text` is for the handful of endpoints that answer with a bare string
   * rather than JSON — a block hash for a height, for instance.
   */
  get(path, { ttl = TTL.settled, text = false } = {}) {
    const hit = this.cache.get(path);
    if (hit && hit.until > this.now()) return Promise.resolve(hit.value);

    const run = this.chain.then(async () => {
      const fresh = this.cache.get(path);
      if (fresh && fresh.until > this.now()) return fresh.value;
      const wait = this.waitFor();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.spent.push(this.now());

      let response;
      try {
        response = await this.fetcher(this.base + path);
      } catch (error) {
        throw new ExplorerError(`NETWORK UNREACHABLE — ${error.message}`);
      }
      if (response.status === 404) {
        throw new ExplorerError('NOT FOUND ON CHAIN', { status: 404 });
      }
      if (response.status === 429) {
        throw new ExplorerError('RATE LIMITED — TRY AGAIN IN A MOMENT', {
          status: 429,
        });
      }
      if (!response.ok) {
        throw new ExplorerError(`EXPLORER RETURNED ${response.status}`, {
          status: response.status,
        });
      }
      const value = text
        ? (await response.text()).trim()
        : await response.json();
      this.cache.set(path, { value, until: this.now() + ttl });
      return value;
    });

    // The queue must survive a failure, or one bad call stops every later one.
    this.chain = run.catch(() => {});
    return run;
  }

  /**
   * The last fifteen blocks, each with everything about it.
   *
   * One call answers what used to take several: height, hash, difficulty, the
   * raw header, transaction count, size, weight, the reward, the fees and the
   * pool that mined it.
   */
  recentBlocks() {
    return this.get('v1/blocks', { ttl: TTL.tip });
  }

  async tip() {
    const blocks = await this.recentBlocks();
    if (!blocks?.length) throw new ExplorerError('THE CHAIN ANSWERED EMPTY');
    return blocks[0];
  }

  /** `id` is a height or a block hash; a height is resolved to its hash first. */
  async block(id) {
    const hash = /^\d+$/.test(String(id))
      ? await this.get(`block-height/${encodeURIComponent(id)}`, { text: true })
      : String(id);
    return this.get(`v1/block/${encodeURIComponent(hash)}`);
  }

  /** The transaction ids in a block — the thing the old source could not do. */
  blockTransactionIds(hash) {
    return this.get(`block/${encodeURIComponent(hash)}/txids`);
  }

  transaction(txid) {
    return this.get(`tx/${encodeURIComponent(txid)}`);
  }

  address(address) {
    return this.get(`address/${encodeURIComponent(address)}`, { ttl: TTL.tip });
  }

  addressTransactions(address) {
    return this.get(`address/${encodeURIComponent(address)}/txs`, {
      ttl: TTL.tip,
    });
  }

  mempool() {
    return this.get('mempool', { ttl: TTL.tip });
  }

  fees() {
    return this.get('v1/fees/recommended', { ttl: TTL.tip });
  }

  /** How far into the retarget period the chain is, and where it is heading. */
  difficultyAdjustment() {
    return this.get('v1/difficulty-adjustment', { ttl: TTL.mining });
  }

  /** Who mined the last day, and the hashrate that implies. */
  pools() {
    return this.get('v1/mining/pools/24h', { ttl: TTL.mining });
  }

  /** What a coin costs, in the currencies mempool.space quotes. */
  prices() {
    return this.get('v1/prices', { ttl: TTL.mining });
  }
}

//: What a player can type into one box, and what it must be.
export const KINDS = {
  height: /^\d{1,9}$/,
  hash: /^[0-9a-fA-F]{64}$/,
  address: /^(bc1[0-9a-z]{8,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
};

/**
 * What the player typed, by shape alone.
 *
 * A 64-character hex string is a block hash or a transaction id and there is no
 * way to tell from the string itself, so it is reported as `hash` and the panel
 * asks the chain: blocks are far fewer, so it tries the block first and falls
 * back to the transaction.
 */
export function classify(query) {
  const text = String(query || '').trim();
  if (!text) return { kind: null, value: '' };
  if (KINDS.height.test(text)) return { kind: 'height', value: text };
  if (KINDS.hash.test(text)) return { kind: 'hash', value: text.toLowerCase() };
  if (KINDS.address.test(text)) return { kind: 'address', value: text };
  return { kind: null, value: text };
}
