// Live Bitcoin queries from the browser. All three explorers send
// Access-Control-Allow-Origin: *, so GitHub Pages can call them directly with
// no backend and no API key.

export const SATS_PER_BTC = 100000000n;

export class ChainError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChainError';
  }
}

const esploraStats = (name, data) => ({
  address: data.address,
  confirmedSats: BigInt(data.chain_stats.funded_txo_sum) - BigInt(data.chain_stats.spent_txo_sum),
  unconfirmedSats: BigInt(data.mempool_stats.funded_txo_sum) - BigInt(data.mempool_stats.spent_txo_sum),
  totalReceivedSats: BigInt(data.chain_stats.funded_txo_sum),
  totalSentSats: BigInt(data.chain_stats.spent_txo_sum),
  txCount: data.chain_stats.tx_count + data.mempool_stats.tx_count,
  utxoCount: data.chain_stats.funded_txo_count - data.chain_stats.spent_txo_count,
  provider: name,
});

const esploraTxs = (data, address) => data.map((tx) => {
  const received = (tx.vout || [])
    .filter((v) => v.scriptpubkey_address === address)
    .reduce((sum, v) => sum + BigInt(v.value), 0n);
  const spent = (tx.vin || [])
    .filter((v) => v.prevout && v.prevout.scriptpubkey_address === address)
    .reduce((sum, v) => sum + BigInt(v.prevout.value), 0n);
  return {
    txid: tx.txid,
    confirmed: Boolean(tx.status && tx.status.confirmed),
    blockHeight: tx.status ? tx.status.block_height : null,
    blockTime: tx.status ? tx.status.block_time : null,
    valueDeltaSats: received - spent,
  };
});

export const PROVIDERS = {
  blockstream: {
    name: 'BLOCKSTREAM',
    base: 'https://blockstream.info/api',
    addressPath: (a) => `/address/${a}`,
    parseAddress: (d) => esploraStats('BLOCKSTREAM', d),
    txsPath: (a) => `/address/${a}/txs`,
    parseTxs: esploraTxs,
    explorer: (a) => `https://blockstream.info/address/${a}`,
  },
  mempool: {
    name: 'MEMPOOL.SPACE',
    base: 'https://mempool.space/api',
    addressPath: (a) => `/address/${a}`,
    parseAddress: (d) => esploraStats('MEMPOOL.SPACE', d),
    txsPath: (a) => `/address/${a}/txs`,
    parseTxs: esploraTxs,
    explorer: (a) => `https://mempool.space/address/${a}`,
  },
  blockchain: {
    name: 'BLOCKCHAIN.COM',
    base: 'https://blockchain.info',
    addressPath: (a) => `/rawaddr/${a}?limit=0&cors=true`,
    parseAddress: (d) => ({
      address: d.address,
      confirmedSats: BigInt(d.final_balance),
      unconfirmedSats: 0n,
      totalReceivedSats: BigInt(d.total_received),
      totalSentSats: BigInt(d.total_sent),
      txCount: d.n_tx,
      utxoCount: d.n_unredeemed || 0,
      provider: 'BLOCKCHAIN.COM',
    }),
    txsPath: null,
    parseTxs: null,
    explorer: (a) => `https://www.blockchain.com/explorer/addresses/btc/${a}`,
  },
};

const DEFAULT_ORDER = ['blockstream', 'mempool', 'blockchain'];

/** Format satoshis the way the terminal prints them: 8 decimal places. */
export function formatBtc(sats) {
  const value = BigInt(sats);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SATS_PER_BTC;
  const fraction = (absolute % SATS_PER_BTC).toString().padStart(8, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export class ChainClient {
  constructor({ preferred = null, timeout = 12000 } = {}) {
    this.preferred = preferred;
    this.timeout = timeout;
    this.offline = false;
  }

  get order() {
    if (this.preferred && PROVIDERS[this.preferred]) {
      return [this.preferred, ...DEFAULT_ORDER.filter((key) => key !== this.preferred)];
    }
    return DEFAULT_ORDER;
  }

  get nodeName() {
    return PROVIDERS[this.order[0]].name;
  }

  explorerUrl(address) {
    return PROVIDERS[this.order[0]].explorer(address);
  }

  async fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async addressStats(address) {
    if (this.offline) throw new ChainError('OFFLINE MODE ACTIVE — NETWORK CALLS DISABLED');
    const errors = [];
    for (const key of this.order) {
      const provider = PROVIDERS[key];
      try {
        const data = await this.fetchJson(provider.base + provider.addressPath(address));
        return provider.parseAddress(data);
      } catch (error) {
        errors.push(`${provider.name}: ${error.message || error.name}`);
      }
    }
    throw new ChainError(errors.join(' | '));
  }

  async transactions(address, limit = 8) {
    if (this.offline) throw new ChainError('OFFLINE MODE ACTIVE — NETWORK CALLS DISABLED');
    const errors = [];
    for (const key of this.order) {
      const provider = PROVIDERS[key];
      if (!provider.txsPath) continue;
      try {
        const data = await this.fetchJson(provider.base + provider.txsPath(address));
        return provider.parseTxs(data, address).slice(0, limit);
      } catch (error) {
        errors.push(`${provider.name}: ${error.message || error.name}`);
      }
    }
    throw new ChainError(errors.join(' | ') || 'NO PROVIDER EXPOSES A TX ENDPOINT');
  }

  /** Probe every provider; resolves to { blockstream: 'OK 120ms', mempool: 'DOWN ...', ... } */
  async netinfo() {
    const PROBE = '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf';
    const results = {};
    await Promise.all(
      Object.entries(PROVIDERS).map(async ([key, provider]) => {
        const t0 = performance.now();
        try {
          await this.fetchJson(provider.base + provider.addressPath(PROBE));
          results[key] = `OK ${Math.round(performance.now() - t0)}ms`;
        } catch (error) {
          results[key] = `DOWN (${error.message || error.name})`;
        }
      }),
    );
    return results;
  }
}
