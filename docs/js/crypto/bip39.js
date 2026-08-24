// BIP-39: wordlist handling, checksum validation, entropy <-> mnemonic, seed.

import { sha256, pbkdf2Sha512, toHex, utf8 } from './hash.js';
import { WORDLIST } from '../wordlist.js';

export const WORD_INDEX = new Map(WORDLIST.map((word, i) => [word, i]));

export class MnemonicError extends Error {
  constructor(message, kind = 'generic') {
    super(message);
    this.name = 'MnemonicError';
    this.kind = kind;
  }
}

/** NFKD-normalise and collapse whitespace, as the spec requires. */
export const normalize = (mnemonic) =>
  mnemonic.toLowerCase().normalize('NFKD').trim().split(/\s+/).join(' ');

export const wordAt = (position) => {
  if (!Number.isInteger(position) || position < 1 || position > 2048) {
    throw new RangeError('BIP-39 index must be in 1..2048');
  }
  return WORDLIST[position - 1];
};

export const indexOf = (word) => {
  const found = WORD_INDEX.get(word.trim().toLowerCase());
  if (found === undefined) throw new Error(`'${word}' is not in the BIP-39 dictionary`);
  return found + 1;
};

export const searchWords = (prefix, limit = 40) => {
  const needle = prefix.trim().toLowerCase();
  const hits = [];
  for (let i = 0; i < WORDLIST.length && hits.length < limit; i++) {
    if (WORDLIST[i].startsWith(needle)) hits.push([i + 1, WORDLIST[i]]);
  }
  return hits;
};

const bitsOf = (bytes) =>
  Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');

/** Turn 128..256 bits of entropy into a checksummed mnemonic. */
export function entropyToMnemonic(entropy) {
  if (![16, 20, 24, 28, 32].includes(entropy.length)) {
    throw new MnemonicError('ENTROPY MUST BE 16, 20, 24, 28 OR 32 BYTES', 'entropy_length');
  }
  const checksumBits = (entropy.length * 8) / 32;
  const bits = bitsOf(entropy) + bitsOf(sha256(entropy)).slice(0, checksumBits);
  const words = [];
  for (let i = 0; i < bits.length; i += 11) words.push(WORDLIST[parseInt(bits.slice(i, i + 11), 2)]);
  return words.join(' ');
}

/**
 * Validate length, dictionary membership and the SHA-256 checksum carried by
 * the final word. Throws MnemonicError with a machine-readable `kind`.
 */
export function validateMnemonic(mnemonic) {
  const words = normalize(mnemonic).split(' ').filter(Boolean);
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new MnemonicError(
      `MNEMONIC LENGTH ${words.length} INVALID. EXPECTED 12/15/18/21/24 WORDS.`,
      'length',
    );
  }
  const unknown = words.filter((word) => !WORD_INDEX.has(word));
  if (unknown.length) {
    throw new MnemonicError(
      `WORD NOT IN BIP-39 DICTIONARY: ${unknown.join(', ')}`,
      'dictionary',
    );
  }
  const bits = words.map((word) => WORD_INDEX.get(word).toString(2).padStart(11, '0')).join('');
  const divider = (bits.length * 32) / 33;
  const entropyBits = bits.slice(0, divider);
  const checksumBits = bits.slice(divider);
  const entropy = new Uint8Array(entropyBits.length / 8);
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(entropyBits.slice(i * 8, i * 8 + 8), 2);
  }
  if (bitsOf(sha256(entropy)).slice(0, checksumBits.length) !== checksumBits) {
    throw new MnemonicError('MNEMONIC CHECKSUM INVALID. DECRYPTION FAILED.', 'checksum');
  }
  return { words, entropy };
}

export const mnemonicToEntropy = (mnemonic) => validateMnemonic(mnemonic).entropy;

/** BIP-39 seed: PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic"+passphrase. */
export const mnemonicToSeed = (mnemonic, passphrase = '') =>
  pbkdf2Sha512(
    utf8(normalize(mnemonic)),
    utf8(`mnemonic${passphrase}`.normalize('NFKD')),
    2048,
    64,
  );

/** Stable sha256 of a normalised mnemonic — how case answers are stored. */
export const fingerprint = (mnemonic) => toHex(sha256(utf8(normalize(mnemonic))));
