// Which of the sixteen openings the page shows, and the figures that fill it.
//
// The page used to open on one fixed prologue. It now opens on one of sixteen,
// most of them written around numbers read off the chain a moment earlier: what
// a coin costs, which pool took the last block, how deep the mempool is.
//
// The rule that keeps it honest is that an opening is only offered once every
// figure it asks for has actually arrived. Four of them ask for nothing, so a
// blocked request, a rate limit or a dead explorer still opens on prose that
// reads correctly rather than on a sentence with a hole in it.

import { OPENINGS } from './openings.js';

const PLACEHOLDER = /\{(\w+)\}/g;

/** 964268 -> '964 268'. Thin spaces are how a chain height is usually set. */
export const group = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
};

/** The openings every one of whose figures is present and non-empty. */
export const available = (figures) =>
  OPENINGS.filter((o) => (o.needs || []).every((n) => figures[n]));

/**
 * One opening the given figures can actually fill.
 *
 * Never throws: the four that ask for nothing are always in the running, so an
 * empty `figures` still returns something printable.
 */
export function choose(figures, random = Math.random) {
  const pool = available(figures);
  const usable = pool.length
    ? pool
    : OPENINGS.filter((o) => !(o.needs || []).length);
  return usable[Math.floor(random() * usable.length)] || OPENINGS[0];
}

/** The opening in `lang`, with its placeholders filled in. */
export function render(opening, lang, figures) {
  const lines = opening.lines[lang] || opening.lines.en;
  return lines.map((line) =>
    line.replace(PLACEHOLDER, (whole, name) =>
      figures[name] === undefined ? whole : String(figures[name]),
    ),
  );
}

/**
 * Read what the openings can use off the live chain.
 *
 * Every figure is fetched independently and every failure is swallowed: one
 * endpoint being slow, rate-limited or down costs its own variables and nothing
 * else, and the openings that do not need them stay available. Resolves to
 * whatever arrived, however little that is.
 */
export async function figuresFromChain(explorer) {
  const figures = {};
  if (!explorer) return figures;

  const attempt = async (work) => {
    try {
      await work();
    } catch {
      /* a missing figure is not an error here — it just narrows the choice */
    }
  };

  await Promise.all([
    attempt(async () => {
      const tip = await explorer.tip();
      figures.height = group(tip.height);
      const pool = tip.extras?.pool?.name;
      if (pool) figures.pool = pool;
      const remaining = 210000 - (Number(tip.height) % 210000);
      figures.halvingDays = String(Math.floor((remaining * 10) / (60 * 24)));
    }),
    attempt(async () => {
      const prices = await explorer.prices();
      if (prices?.USD) figures.price = group(prices.USD);
    }),
    attempt(async () => {
      const fees = await explorer.fees();
      if (fees?.fastestFee) figures.fee = String(fees.fastestFee);
    }),
    attempt(async () => {
      const pool = await explorer.mempool();
      if (pool?.count) figures.mempool = group(pool.count);
    }),
    attempt(async () => {
      const mining = await explorer.pools();
      const pools = mining?.pools || [];
      const total = pools.reduce((sum, p) => sum + (p.blockCount || 0), 0);
      const leader = pools.reduce(
        (best, p) => ((p.blockCount || 0) > (best?.blockCount || 0) ? p : best),
        null,
      );
      if (leader && total) {
        figures.topPool = leader.name;
        figures.topShare = ((leader.blockCount * 100) / total).toFixed(1);
      }
      if (mining?.lastEstimatedHashrate) {
        figures.hashrate = `${(mining.lastEstimatedHashrate / 1e18).toFixed(1)} EH/s`;
      }
    }),
  ]);

  return figures;
}
