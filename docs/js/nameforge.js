// Nameforge: strike a named stamp into the chain.
//
// The player picks a short name; the tool searches for a twelve-word phrase
// whose first legacy address carries that name right after the leading `1`.
// The phrase is real and the address is real. The resemblance to a name is the
// only cosmetic part.
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

/** `andy` and `ANDY` both become `Andy` — one spelling, one price. */
export const normalise = (name) => {
  const cleaned = String(name).trim();
  return cleaned.slice(0, 1).toUpperCase() + cleaned.slice(1).toLowerCase();
};

/**
 * Normalise and check. Returns `{ stamp }` or `{ error, kind }` rather than
 * throwing: every caller here is painting a field as the player types.
 */
export function validate(name) {
  const stamp = normalise(name);
  if (stamp.length < MIN_LENGTH || stamp.length > MAX_LENGTH) {
    return { error: 'length', length: stamp.length };
  }
  const bad = [...new Set([...stamp])].filter((c) => !BASE58.includes(c));
  if (bad.length) return { error: 'alphabet', bad };
  return { stamp };
}

/** The chance one candidate carries this stamp. */
export function probability(stamp) {
  const first = LEADING[stamp[0]] ?? 0;
  return first * (1 / BASE58.length) ** (stamp.length - 1);
}

/** Candidates needed on average. The median is about 0.69 of this. */
export function expectedAttempts(stamp) {
  const chance = probability(stamp);
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

export const tier = (stamp) => {
  const attempts = expectedAttempts(stamp);
  return (TIERS.find(([ceiling]) => attempts < ceiling) || TIERS.at(-1))[1];
};

/** What to tell the player before they decide to wait. */
export function estimate(stamp, rate) {
  const attempts = expectedAttempts(stamp);
  return {
    stamp,
    tier: tier(stamp),
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
