// Nameforge: strike a named stamp into the chain.
//
// The player picks a short name; the tool searches for a twelve-word phrase
// whose first legacy address carries that name right after the leading `1`.
// The phrase is real and the address is real. The resemblance to a name is the
// only cosmetic part.
//
// Case is a choice. Base58 tells `A` from `a`, so a name can be struck two
// ways: exactly as it was spelled, or in whatever case turns up first. The
// second is cheaper — six letters that each exist in both cases is 32 times
// cheaper — and it strikes names the first cannot, because Base58 keeps `o`
// but not `O`, and `L` but not `l`. Both are honest, and each is priced as
// itself.
//
// Difficulty is not 58^n. The character straight after the `1` is nowhere near
// uniform — twenty-two of them land about 4.3% of the time and the other
// thirty-four about 0.075% — so `1Rob` costs about what `1Andy` costs, one
// character shorter and one much rarer letter. The distribution is measured
// rather than assumed (see data/nameforge.json) and every estimate here is
// computed from it, for the actual name, never from its length.
//
// This file is the arithmetic and the rules. The searching happens in
// nameforge-worker.js, off the main thread, because a candidate costs a
// PBKDF2 and five levels of BIP-32 and there may be millions of them.

import { LEADING } from './leading.js';

export const BASE58 =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** The path the stamp is read from. An address only means something with one. */
export const PATH = "m/44'/0'/0'/0/0";

export const MIN_LENGTH = 2;
export const MAX_LENGTH = 6;

/**
 * The address characters that would satisfy this position of a name.
 *
 * Everything else here is built on this. In exact mode a character stands for
 * itself alone; in any-case mode it stands for both of its cases — but only
 * those Base58 has, and Base58 is not symmetric: it keeps `o` but not `O`,
 * `i` but not `I`, `L` but not `l`. Twenty-three letters have two forms,
 * three have one, and `0` has none in either mode.
 */
export function variants(char, anyCase = false) {
  if (!anyCase) return BASE58.includes(char) ? char : '';
  const both = [char.toLowerCase(), char.toUpperCase()];
  return [...new Set(both)].filter((c) => BASE58.includes(c)).join('');
}

/**
 * Trim, and nothing else. This used to force `andy` and `ANDY` both to `Andy`,
 * one spelling per name — a stand-in for a decision the player was never
 * offered. They choose the case themselves now.
 */
export const normalise = (name) => String(name).trim();

/**
 * Trim and check. Returns `{ stamp }` or `{ error, kind }` rather than
 * throwing: every caller here is painting a field as the player types.
 */
export function validate(name, anyCase = false) {
  const stamp = normalise(name);
  if (stamp.length < MIN_LENGTH || stamp.length > MAX_LENGTH) {
    return { error: 'length', length: stamp.length };
  }
  const bad = [...new Set([...stamp])].filter((c) => !variants(c, anyCase));
  if (bad.length) return { error: 'alphabet', bad };
  return { stamp };
}

/** Does this address carry the stamp straight after its leading `1`? */
export function matches(address, stamp, anyCase = false) {
  const carried = address.slice(1, 1 + stamp.length);
  return anyCase
    ? carried.toLowerCase() === stamp.toLowerCase()
    : carried === stamp;
}

/**
 * The chance one candidate carries this stamp.
 *
 * Each position contributes the share of addresses whose character there is
 * one this name accepts, so the same arithmetic prices both modes: any-case
 * simply accepts more characters per position.
 */
export function probability(stamp, anyCase = false) {
  let chance = 0;
  for (const c of variants(stamp[0], anyCase)) chance += LEADING[c] ?? 0;
  for (const char of stamp.slice(1))
    chance *= variants(char, anyCase).length / BASE58.length;
  return chance;
}

/** Candidates needed on average. The median is about 0.69 of this. */
export function expectedAttempts(stamp, anyCase = false) {
  const chance = probability(stamp, anyCase);
  return chance > 0 ? 1 / chance : Number.POSITIVE_INFINITY;
}

//: Bands cut on expected attempts, not on length — length is not what makes a
//: name expensive.
export const TIERS = [
  [10_000, 'COMMON'],
  [500_000, 'UNCOMMON'],
  [20_000_000, 'RARE'],
  [1_000_000_000, 'EPIC'],
  [Number.POSITIVE_INFINITY, 'LEGENDARY'],
];

export const tier = (stamp, anyCase = false) => {
  const attempts = expectedAttempts(stamp, anyCase);
  return (TIERS.find(([ceiling]) => attempts < ceiling) || TIERS.at(-1))[1];
};

/** What to tell the player before they decide to wait. */
export function estimate(stamp, rate, anyCase = false) {
  const attempts = expectedAttempts(stamp, anyCase);
  return {
    stamp,
    anyCase,
    tier: tier(stamp, anyCase),
    attempts,
    // The entropy actually searched — log2 of the odds. Not the 128 bits of
    // the phrase, which is a different number and would flatter the result.
    bits: Number.isFinite(attempts)
      ? Math.log2(attempts)
      : Number.POSITIVE_INFINITY,
    seconds: rate > 0 ? attempts / rate : Number.POSITIVE_INFINITY,
  };
}

/** `1Andy` and then the part nobody reads. */
export const preview = (address, stamp) => {
  const kept = 1 + stamp.length;
  return (
    address.slice(0, kept) + '•'.repeat(Math.max(0, address.length - kept))
  );
};

/** A duration the way a person would say it. */
export function humanise(seconds) {
  if (!Number.isFinite(seconds)) return 'never';
  if (seconds < 1) return 'under a second';
  if (seconds < 90) return `${Math.round(seconds)} seconds`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} hours`;
  return `${(seconds / 86400).toFixed(1)} days`;
}

/** How many workers to run: busy enough to be fast, not so many it locks up. */
export const workerCount = () =>
  Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
