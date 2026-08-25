// Generative sigils for the things the player collects: one per case, one per
// seed phrase, one per address. Built on minidenticons (vendored, MIT).
//
// The seed for a phrase is its SHA-256 fingerprint, never the phrase itself —
// the same rule the journal follows. A masked entry therefore still gets its
// own stable sigil without the words ever being used as a key.

import { minidenticon } from './vendor/minidenticons.js';
import { fingerprint } from './crypto/bip39.js';

const cache = new Map();

/**
 * Raw SVG markup for a seed string.
 * Lightness is pushed up from the library default so the sigils read against
 * the black terminal background rather than sinking into it.
 */
export function sigilSvg(seed, { saturation = 92, lightness = 62 } = {}) {
  const key = `${seed}|${saturation}|${lightness}`;
  if (!cache.has(key)) cache.set(key, minidenticon(String(seed), saturation, lightness));
  return cache.get(key);
}

/**
 * An <svg> element ready to drop into the page.
 *
 * Parsed rather than assigned as markup: minidenticon only ever emits shapes
 * derived from a hash, but keeping the no-markup-assignment rule absolute means
 * there is no exception for anyone to widen later.
 */
export function sigil(seed, { size = 20, title = '', ...options } = {}) {
  const wrapper = document.createElement('span');
  wrapper.className = 'sigil';
  wrapper.style.setProperty('--sigil-size', `${size}px`);
  const parsed = new DOMParser()
    .parseFromString(sigilSvg(seed, options), 'image/svg+xml');
  wrapper.append(document.importNode(parsed.documentElement, true));
  if (title) wrapper.title = title;
  wrapper.setAttribute('aria-hidden', 'true');
  return wrapper;
}

/** Sigil for a case file — stable across languages and sessions. */
export const caseSigil = (caseFile, options) =>
  sigil(`enigma-case-${caseFile.id}-${caseFile.fingerprint.slice(0, 12)}`, options);

/** Sigil for a seed phrase, keyed by its fingerprint rather than its words. */
export const mnemonicSigil = (mnemonic, options) =>
  sigil(`enigma-seed-${fingerprint(mnemonic)}`, options);

/** Sigil for an address, so the same wallet always looks the same. */
export const addressSigil = (address, options) => sigil(`enigma-addr-${address}`, options);
