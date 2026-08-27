// Headless game core shared by both front-ends.
//
// The command line (engine.js) and the GUI (gui/app.js) are two renderers over
// this one module: progress, case rules and the seed tools live here, so the
// two modes can never drift apart or disagree about what is solved.

import { CAMPAIGN } from './campaign.js';
import { CLIENTS } from './clients.js';
import {
  entropyToMnemonic,
  fingerprint,
  MnemonicError,
  normalize,
  validateMnemonic,
  WORD_INDEX,
} from './crypto/bip39.js';
import { read, write } from './storage.js';
import { WORDLIST } from './wordlist.js';

const STORAGE_KEY = 'enigma-terminal/progress/v1';

//: Every language the game speaks. English is the fallback: a bundle that has
//: not been translated yet still renders rather than showing `undefined`.
//: Menu order, not preference order — the page still opens in whatever the
//: browser asks for. English leads because it is the language the project is
//: written and documented in; Russian sits at the end.
export const LANGS = ['en', 'es', 'pt', 'ru'];

export const LANG_NAMES = { ru: 'РУС', en: 'ENG', es: 'ESP', pt: 'POR' };

//: The name each language has for itself. A language menu that lists them in
//: the language you are leaving is no help to the person who cannot read it.
export const LANG_ENDONYMS = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

/** Resolve a per-language bundle down to one language. */
export const pick = (bundle, lang) =>
  (bundle && (bundle[lang] || bundle.en)) || bundle;

// --------------------------------------------------------------------------
// Progress — one store, shared by both modes through localStorage
// --------------------------------------------------------------------------

export class ProgressStore {
  constructor() {
    this.data = ProgressStore.read();
  }

  static read() {
    try {
      const raw = read(STORAGE_KEY);
      if (!raw) return { solved: [], hints: {}, taken: [] };
      const parsed = JSON.parse(raw);
      return {
        solved: parsed.solved || [],
        hints: parsed.hints || {},
        // Contracts the player has picked up off the board. Saves from before
        // the board existed simply have none.
        taken: parsed.taken || [],
      };
    } catch {
      return { solved: [], hints: {}, taken: [] };
    }
  }

  /** Re-read from storage — the other mode may have written while we idled. */
  refresh() {
    this.data = ProgressStore.read();
    return this.data;
  }

  save() {
    write(STORAGE_KEY, JSON.stringify(this.data));
  }

  get solved() {
    return this.data.solved;
  }

  get hints() {
    return this.data.hints;
  }

  get taken() {
    return this.data.taken;
  }

  isTaken(id) {
    return this.data.taken.includes(Number(id));
  }

  /** Pick a contract up off the board. Returns true the first time. */
  take(id) {
    const key = Number(id);
    if (this.data.taken.includes(key)) return false;
    this.data.taken.push(key);
    this.save();
    return true;
  }

  /** Put an unsolved contract back. Solved work stays on the desk. */
  drop(id) {
    const key = Number(id);
    if (this.isSolved(key)) return false;
    const before = this.data.taken.length;
    this.data.taken = this.data.taken.filter((entry) => entry !== key);
    if (this.data.taken.length === before) return false;
    this.save();
    return true;
  }

  isSolved(id) {
    return this.data.solved.includes(id);
  }

  markSolved(id) {
    if (this.isSolved(id)) return false;
    this.data.solved.push(id);
    this.save();
    return true;
  }

  hintsUsed(id) {
    return this.data.hints[id] || 0;
  }

  useHint(id) {
    this.data.hints[id] = this.hintsUsed(id) + 1;
    this.save();
    return this.data.hints[id];
  }

  reset() {
    this.data = { solved: [], hints: {}, taken: [] };
    this.save();
  }
}

// --------------------------------------------------------------------------
// Campaign rules
// --------------------------------------------------------------------------

export const CAMPAIGN_CASES = CAMPAIGN.cases;
export const META = CAMPAIGN.meta;
export { CLIENTS };

//: The 256-case contract board, fetched on demand. The eight-case campaign has
//: to be playable the moment the page opens, and the board is an order of
//: magnitude larger than everything else the page loads combined.
let contracts = [];
let contractsPromise = null;

export const CASES = CAMPAIGN_CASES;

/** Campaign plus whatever of the board has arrived. */
export const allCases = () =>
  contracts.length ? [...CAMPAIGN_CASES, ...contracts] : CAMPAIGN_CASES;

export const contractsLoaded = () => contracts.length > 0;

export function loadContracts() {
  if (contractsPromise) return contractsPromise;
  contractsPromise = fetch(new URL('../data/contracts.json', import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      contracts = payload.cases || [];
      return contracts;
    })
    .catch((error) => {
      // A missing board must never take the campaign down with it.
      contractsPromise = null;
      console.warn('contract board unavailable:', error.message);
      return [];
    });
  return contractsPromise;
}

/**
 * The detective's desk: the campaign, plus every contract taken off the board
 * or already solved. Solved work counts even if it was never formally taken —
 * a phrase pasted straight into DECRYPT closes a case just the same.
 */
export function caseload(progress) {
  const wanted = new Set([...progress.taken, ...progress.solved]);
  return [
    ...CAMPAIGN_CASES,
    ...contracts.filter((entry) => wanted.has(entry.id)),
  ];
}

export const clientBySlug = (slug) =>
  CLIENTS.find((client) => client.slug === slug) || null;

export const casesForClient = (slug) =>
  contracts.filter((entry) => entry.client === slug);

export const caseById = (id) =>
  allCases().find((entry) => entry.id === Number(id)) || null;

export const isUnlocked = (caseFile, progress) =>
  (caseFile.requires || []).every((req) => progress.isSolved(req));

export const missingRequirements = (caseFile, progress) =>
  (caseFile.requires || []).filter((req) => !progress.isSolved(req));

/** Which case, if any, a mnemonic unlocks. */
export const caseForMnemonic = (mnemonic) => {
  const digest = fingerprint(mnemonic);
  return allCases().find((entry) => entry.fingerprint === digest) || null;
};

export const caseState = (caseFile, progress) => {
  if (progress.isSolved(caseFile.id)) return 'solved';
  if (!isUnlocked(caseFile, progress)) return 'locked';
  return 'open';
};

// --------------------------------------------------------------------------
// Seed tools: randomisation and search
// --------------------------------------------------------------------------

const WORD_COUNT_TO_ENTROPY_BYTES = { 12: 16, 15: 20, 18: 24, 21: 28, 24: 32 };

/**
 * Generate a fresh mnemonic from cryptographically secure randomness.
 * This is the same procedure any wallet uses to create a new seed.
 */
export function randomMnemonic(wordCount = 12) {
  const bytes = WORD_COUNT_TO_ENTROPY_BYTES[wordCount];
  if (!bytes) {
    throw new MnemonicError(
      `WORD COUNT ${wordCount} INVALID. EXPECTED 12/15/18/21/24.`,
      'length',
    );
  }
  const entropy = new Uint8Array(bytes);
  crypto.getRandomValues(entropy);
  return { mnemonic: entropyToMnemonic(entropy), entropy };
}

export const UNKNOWN_TOKENS = new Set(['?', '*', '_', '...', '??', '???']);

/**
 * Complete a seed phrase with exactly one unknown word.
 *
 * A 12-word phrase carries 4 checksum bits, so roughly one word in sixteen
 * fits — about 128 of the 2048 candidates survive. That makes this a puzzle
 * aid for a phrase you already almost have, not a search over unknown wallets:
 * two unknown positions would leave hundreds of thousands of answers, which is
 * why the tool deliberately refuses them.
 */
export function completeMnemonic(pattern) {
  const words = normalize(String(pattern)).split(' ').filter(Boolean);
  if (
    !Object.keys(WORD_COUNT_TO_ENTROPY_BYTES).map(Number).includes(words.length)
  ) {
    throw new MnemonicError(
      `PHRASE LENGTH ${words.length} INVALID. EXPECTED 12/15/18/21/24 WORDS.`,
      'length',
    );
  }

  const blanks = [];
  words.forEach((word, index) => {
    if (UNKNOWN_TOKENS.has(word)) blanks.push(index);
  });

  if (blanks.length === 0) {
    throw new MnemonicError(
      'NO UNKNOWN POSITION MARKED. USE ? FOR THE MISSING WORD.',
      'no_blank',
    );
  }
  if (blanks.length > 1) {
    throw new MnemonicError(
      `${blanks.length} UNKNOWN POSITIONS. THIS TOOL RESOLVES EXACTLY ONE.`,
      'too_many_blanks',
    );
  }

  const unknown = words.filter(
    (word, index) => index !== blanks[0] && !WORD_INDEX.has(word),
  );
  if (unknown.length) {
    throw new MnemonicError(
      `WORD NOT IN BIP-39 DICTIONARY: ${unknown.join(', ')}`,
      'dictionary',
    );
  }

  const position = blanks[0];
  const attempt = words.slice();
  const candidates = [];
  for (const word of WORDLIST) {
    attempt[position] = word;
    const phrase = attempt.join(' ');
    try {
      validateMnemonic(phrase);
    } catch {
      continue;
    }
    candidates.push({ word, mnemonic: phrase, case: caseForMnemonic(phrase) });
  }
  return { position, candidates };
}

/** Substring/prefix search over the BIP-39 wordlist. */
export function searchWordlist(query, limit = 60) {
  const needle = String(query).trim().toLowerCase();
  if (!needle) return [];
  const prefix = [];
  const contains = [];
  WORDLIST.forEach((word, index) => {
    if (word.startsWith(needle)) prefix.push({ index: index + 1, word });
    else if (word.includes(needle)) contains.push({ index: index + 1, word });
  });
  return [...prefix, ...contains].slice(0, limit);
}

//: Narrative only. Clue lines are the puzzle itself: indexing them would turn
//: archive search into a lookup table that answers cases instead of finding them.
const CASE_TEXT_FIELDS = ['brief', 'evidence', 'epilogue'];

/** Full-text search across the case archive, in the active language. */
export function searchCases(query, lang = 'en', progress = null) {
  const needle = String(query).trim().toLowerCase();
  if (!needle) return [];
  const results = [];
  for (const caseFile of allCases()) {
    const hits = [];
    const codename = pick(caseFile.codename, lang);
    if (codename.toLowerCase().includes(needle)) {
      hits.push({ field: 'codename', line: codename });
    }
    for (const field of CASE_TEXT_FIELDS) {
      // Epilogues are spoilers: only search them once the case is closed.
      if (field === 'epilogue' && progress && !progress.isSolved(caseFile.id))
        continue;
      for (const line of pick(caseFile[field], lang) || []) {
        if (line.toLowerCase().includes(needle)) hits.push({ field, line });
      }
    }
    if (hits.length) results.push({ case: caseFile, hits });
  }
  return results;
}

export { fingerprint, MnemonicError, normalize };
