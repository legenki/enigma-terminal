// The explorer's data source: bitaps.com's public Bitcoin API.
//
// It sends Access-Control-Allow-Origin: *, so the page calls it directly with
// no backend and no key — the same arrangement the ledger tools already use.
//
// One thing shapes everything here: the rate limit is three requests every
// five seconds, per address. That is generous for a person clicking around and
// nowhere near enough to fan out, so every call goes through one queue that
// spends tokens as they refill, and answers already known are served from
// memory rather than spent on again.

export class BitapsError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message);
    this.name = 'BitapsError';
    this.status = status;
  }
}

const BASE = 'https://api.bitaps.com/btc/v1/';

//: What the service publishes in its own headers: 3 per 5s.
export const RATE = { calls: 3, windowMs: 5000 };

//: How long an answer stays good. A confirmed transaction never changes, so it
//: is kept for the session; the tip and the mempool are the whole point of a
//: live explorer, so they are kept only long enough to stop a double click
//: costing two of three tokens.
export const TTL = { tip: 15000, mempool: 15000, settled: 30 * 60 * 1000 };

/**
 * Sats to a BTC string, without floating point anywhere near it.
 *
 * A BigInt is taken as it is. Rounding it through Number first would have been
 * simpler and wrong: 2^53 + 1 sats is the first amount a double cannot hold,
 * and it is well inside the range the chain deals in.
 */
export function btc(sats, { places = 8 } = {}) {
  const value =
    typeof sats === 'bigint' ? sats : BigInt(Math.round(Number(sats) || 0));
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const whole = abs / 100000000n;
  const frac = (abs % 100000000n).toString().padStart(8, '0').slice(0, places);
  return `${sign}${whole}.${frac}`;
}

export class BitapsClient {
  constructor({ fetcher = null, now = () => Date.now(), base = BASE } = {}) {
    this.base = base;
    this.fetcher = fetcher || ((url) => fetch(url));
    this.now = now;
    this.cache = new Map();
    //: Timestamps of the calls still inside the window.
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
   * Calls are chained rather than raced: three at once would spend the whole
   * window and the fourth would come back 429, which reads to the player as
   * the explorer being broken.
   */
  get(path, { ttl = TTL.settled } = {}) {
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
        throw new BitapsError(`NETWORK UNREACHABLE — ${error.message}`);
      }
      if (response.status === 404) {
        throw new BitapsError('NOT FOUND ON CHAIN', { status: 404 });
      }
      if (response.status === 429) {
        throw new BitapsError('RATE LIMITED — TRY AGAIN IN A MOMENT', {
          status: 429,
        });
      }
      if (!response.ok) {
        throw new BitapsError(`EXPLORER RETURNED ${response.status}`, {
          status: response.status,
        });
      }
      const payload = await response.json();
      const value = payload && 'data' in payload ? payload.data : payload;
      this.cache.set(path, { value, until: this.now() + ttl });
      return value;
    });

    // The queue must survive a failure, or one bad call stops every later one.
    this.chain = run.catch(() => {});
    return run;
  }

  tip() {
    return this.get('blockchain/block/last', { ttl: TTL.tip });
  }

  /** `id` is a height or a block hash; the service takes either. */
  block(id) {
    return this.get(`blockchain/block/${encodeURIComponent(id)}`);
  }

  transaction(hash) {
    return this.get(`blockchain/transaction/${encodeURIComponent(hash)}`);
  }

  addressState(address) {
    return this.get(`blockchain/address/state/${encodeURIComponent(address)}`, {
      ttl: TTL.tip,
    });
  }

  addressTransactions(address, page = 1) {
    return this.get(
      `blockchain/address/transactions/${encodeURIComponent(address)}?page=${page}`,
      { ttl: TTL.tip },
    );
  }

  addressUtxo(address) {
    return this.get(`blockchain/address/utxo/${encodeURIComponent(address)}`, {
      ttl: TTL.tip,
    });
  }

  mempool() {
    return this.get('blockchain/mempool/state', { ttl: TTL.mempool });
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
