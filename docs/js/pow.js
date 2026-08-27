// Proof of work, worked out rather than asked for.
//
// The explorer's source has no endpoint for any of this — no hashrate, no
// halving, no retarget countdown, no next-difficulty estimate. All of it is
// arithmetic on two things it does give: a height, and the difficulty inside a
// block header. So the game computes them, the same way it computes everything
// else it shows.
//
// The one number here that is an estimate rather than a fact is the hashrate,
// and it is the standard one: at difficulty D the network is expected to try
// D * 2^32 hashes per block, and blocks are aimed at 600 seconds apart.

export const HALVING_INTERVAL = 210000;
export const RETARGET_INTERVAL = 2016;
export const TARGET_SPACING = 600;

//: 50 BTC, in sats. Every reward is this shifted right once per halving.
const INITIAL_REWARD = 5000000000n;

/** What a block at this height pays its miner, in sats. */
export function blockReward(height) {
  const era = Math.floor(Number(height) / HALVING_INTERVAL);
  // After 33 halvings the shift takes it to zero, which is the real answer.
  if (era >= 64) return 0n;
  return INITIAL_REWARD >> BigInt(era);
}

/** Blocks until the subsidy halves, and roughly how long that is. */
export function untilHalving(height) {
  const blocks = HALVING_INTERVAL - (Number(height) % HALVING_INTERVAL);
  return {
    blocks,
    seconds: blocks * TARGET_SPACING,
    atHeight: Number(height) + blocks,
  };
}

/** Blocks until difficulty is recalculated, and roughly how long that is. */
export function untilRetarget(height) {
  const blocks = RETARGET_INTERVAL - (Number(height) % RETARGET_INTERVAL);
  return {
    blocks,
    seconds: blocks * TARGET_SPACING,
    atHeight: Number(height) + blocks,
  };
}

/**
 * Hashes per second the network is doing, from the difficulty alone.
 *
 * Returned as a Number: the value is an estimate to begin with, so carrying it
 * in BigInt would be false precision.
 */
export function hashrate(difficulty, spacing = TARGET_SPACING) {
  return (Number(difficulty) * 2 ** 32) / spacing;
}

/**
 * What the next difficulty will be, given how long this period is actually
 * taking.
 *
 * Bitcoin scales the difficulty by (expected time / actual time) and refuses to
 * move it more than fourfold either way — the clamp is consensus, not caution.
 */
export function nextDifficulty(difficulty, blocksElapsed, secondsElapsed) {
  const blocks = Number(blocksElapsed);
  const seconds = Number(secondsElapsed);
  if (!blocks || !seconds) return null;
  const expected = blocks * TARGET_SPACING;
  const ratio = Math.min(4, Math.max(0.25, expected / seconds));
  const value = Number(difficulty) * ratio;
  return {
    value,
    changePercent: (ratio - 1) * 100,
    averageSpacing: seconds / blocks,
  };
}

const UNITS = ['H', 'kH', 'MH', 'GH', 'TH', 'PH', 'EH', 'ZH'];

/** A hashrate at human scale: 963.1 EH/s rather than 9.6e20. */
export function formatHashrate(perSecond) {
  let value = Number(perSecond);
  if (!Number.isFinite(value) || value <= 0) return '—';
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 1 : 2)} ${UNITS[unit]}/s`;
}

/** A span in the units that carry it: days and hours, or hours and minutes. */
export function formatSpan(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days)
    return { major: days, majorUnit: 'days', minor: hours, minorUnit: 'hours' };
  if (hours)
    return {
      major: hours,
      majorUnit: 'hours',
      minor: minutes,
      minorUnit: 'minutes',
    };
  return {
    major: minutes,
    majorUnit: 'minutes',
    minor: total % 60,
    minorUnit: 'seconds',
  };
}
