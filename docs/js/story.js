// The case file: what the riddles open onto.
//
// A closed wallet used to be the end of the thought. Here it is the start of
// one: the wallet's words are lines in a book, the book's lines are people, and
// the wet papers that arrive as cases close say what was done in their names.
// The player writes down what they think happened and files it. Filing answers
// yes or no for all three rows at once, because a count of wrong rows would be
// a stronger oracle than the batch is worth.
//
// Both front-ends call this module, and it is the only place outside the store
// that closes a case. Two copies of that logic is how the Decrypt panel came to
// recognise a phrase without closing the case it opened.

import { CAMPAIGN_CASES, CLIENTS, META, pick } from './core.js';
import { sha256, toHex } from './crypto/hash.js';
import { STORY } from './story-data.js';
import { WORDLIST } from './wordlist.js';

const { acta: ACTA } = STORY;
const LINES_PER_PAGE = 16;
const WORD_NUMBER = new Map(WORDLIST.map((word, i) => [word, i + 1]));
const encoder = new TextEncoder();

export { STORY };

export const ACTA_WALLETS = ACTA.wallets;

/** A line of interface text, in any language, with its fields filled in. */
export const say = (key, lang, fields = {}) =>
  Object.entries(fields).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    pick(STORY.ui[key], lang),
  );

// --------------------------------------------------------------------------
// The chain's clock
// --------------------------------------------------------------------------

let tip = null;

//: The heartbeat is the only thing that reads the tip; everything else asks here.
export const setChainTip = (height) => {
  tip = Number.isInteger(height) ? height : null;
};
export const chainTip = () => tip;

// --------------------------------------------------------------------------
// The book
// --------------------------------------------------------------------------

/**
 * One line of the book, found by number, by `page:line`, or by its word.
 * Answers null for something the book cannot contain. A line that exists but
 * was never written comes back with `row: null`: the page got wet.
 */
export function bookLookup(query) {
  const text = String(query).trim().toLowerCase();
  let number = null;
  const place = text.match(/^(\d+):(\d+)$/);
  if (place) {
    const page = Number(place[1]);
    const line = Number(place[2]);
    if (line >= 1 && line <= LINES_PER_PAGE && page >= 1) {
      number = (page - 1) * LINES_PER_PAGE + line;
    }
  } else if (/^\d+$/.test(text)) {
    number = Number(text);
  } else {
    number = WORD_NUMBER.get(text) ?? null;
  }
  if (number === null || number < 1 || number > WORDLIST.length) return null;
  return {
    number,
    page: Math.floor((number - 1) / LINES_PER_PAGE) + 1,
    line: ((number - 1) % LINES_PER_PAGE) + 1,
    word: WORDLIST[number - 1],
    row: STORY.book[number] || null,
  };
}

// --------------------------------------------------------------------------
// Closing a case, and the papers that follow
// --------------------------------------------------------------------------

const closedWallets = (progress) =>
  ACTA.wallets.filter((id) => progress.isSolved(id)).length;

/**
 * The papers in the folder. They arrive by how many wallets are closed rather
 * than which, so the order they came in says nothing about what they concern.
 */
export const papers = (progress) =>
  STORY.papers.filter((paper) => paper.after <= closedWallets(progress));

/**
 * Close a case. The one way anything is marked solved.
 *
 * `filing` is the player's opinion on record: numbered in the order they signed
 * them, against the height of the chain when they did. A case closed before
 * filings existed has none, and a second close does not make one.
 */
export function closeCase(progress, caseFile, { height = null } = {}) {
  const before = new Set(papers(progress).map((paper) => paper.id));
  const first = progress.markSolved(caseFile.id);
  const { filings } = progress.story;
  if (first) {
    filings[caseFile.id] = {
      number: Object.keys(filings).length + 1,
      height,
    };
    progress.save();
  }
  return {
    first,
    filing: filings[caseFile.id] || null,
    newPapers: first
      ? papers(progress)
          .map((paper) => paper.id)
          .filter((id) => !before.has(id))
      : [],
    campaignDone: CAMPAIGN_CASES.every((entry) => progress.isSolved(entry.id)),
  };
}

/** The opinion line a closed case prints, in either front-end. */
export const filingLine = (filing, lang) =>
  say('filing', lang, {
    n: String(filing.number).padStart(4, '0'),
    height: filing.height ?? '—',
    operator: META.operator,
  });

export const paperById = (id) =>
  STORY.papers.find((paper) => paper.id === id) || null;

// --------------------------------------------------------------------------
// Favours
// --------------------------------------------------------------------------

/**
 * What the player owes the informant: her hints on these wallets, her hints on
 * the Acta, and any line they paid her to jump. Other cases' hints are not hers.
 */
export const debt = (progress) =>
  ACTA.wallets.reduce((sum, id) => sum + progress.hintsUsed(id), 0) +
  progress.story.actaHints +
  progress.story.favours;

export const shownActaHints = (progress) =>
  ACTA.hints.slice(0, progress.story.actaHints);

/** The next hint on the Acta, or null when she has nothing left to say. */
export function useActaHint(progress) {
  const next = ACTA.hints[progress.story.actaHints];
  if (!next) return null;
  progress.story.actaHints += 1;
  progress.save();
  return next;
}

// --------------------------------------------------------------------------
// The Acta
// --------------------------------------------------------------------------

const findById = (list, value, idOf) => {
  const wanted = String(value ?? '').toLowerCase();
  if (!wanted) return null;
  return (
    list.find((item) => idOf(item) === wanted) ||
    list.find((item) => idOf(item).startsWith(wanted)) ||
    null
  );
};

export const employerFor = (value) =>
  findById(CLIENTS, value, (client) => client.slug);
export const formFor = (value) =>
  findById(ACTA.forms, value, (form) => form.id);

export const actaFiled = (progress) => progress.story.filed;
export const draft = (progress) => progress.story.draft;

/** Write one row. Says which field is wrong, not whether the row is right. */
export function setRow(progress, wallet, row) {
  const id = Number(wallet);
  if (!ACTA.wallets.includes(id)) return { status: 'invalid', field: 'wallet' };
  const employer = employerFor(row.employer);
  if (!employer) return { status: 'invalid', field: 'employer' };
  const form = formFor(row.form);
  if (!form) return { status: 'invalid', field: 'form' };
  const member = Number(row.member);
  if (!Number.isInteger(member) || member < 1 || member > WORDLIST.length) {
    return { status: 'invalid', field: 'member' };
  }
  const year = Number(row.year);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return { status: 'invalid', field: 'year' };
  }
  if (!progress.isSolved(id)) return { status: 'closed-first' };
  progress.story.draft[id] = {
    employer: employer.slug,
    form: form.id,
    member,
    year,
  };
  progress.save();
  return { status: 'saved' };
}

const digestOf = (rows) => {
  const body = ACTA.wallets
    .map((id) => {
      const row = rows[id];
      return `${id}:${row.employer}:${row.form}:${row.member}:${row.year}`;
    })
    .join('|');
  return toHex(sha256(encoder.encode(`${ACTA.salt}|${body}`)));
};

/**
 * The window a filing counts against: this block, or, with no chain to read,
 * the ten minutes a block would have taken. The height is the better clock
 * because moving the system date does not move it.
 */
const openWindow = (progress, height, now) => {
  const { window } = progress.story;
  const stale =
    height !== null
      ? window.key !== `h${height}`
      : window.key === null ||
        window.key.startsWith('h') ||
        now - window.at >= ACTA.offline_window_ms;
  if (stale) {
    window.key = height !== null ? `h${height}` : 't';
    window.at = now;
    window.count = 0;
  }
  return window;
};

/**
 * File the Acta. Answers only yes or no, for all the rows together, and at most
 * twice a block. Past that the registry is shut until the next one, unless the
 * player spends a favour: thinking is never on a timer, guessing is.
 */
export function fileActa(
  progress,
  { height = null, now = Date.now(), payFavour = false } = {},
) {
  const { story } = progress;
  if (story.filed) return { status: 'already' };
  const ready = ACTA.wallets.every(
    (id) => progress.isSolved(id) && story.draft[id],
  );
  if (!ready) return { status: 'incomplete' };
  const window = openWindow(progress, height, now);
  if (window.count >= ACTA.attempts_per_block) {
    if (!payFavour) return { status: 'wait' };
    story.favours += 1;
  }
  if (digestOf(story.draft) === ACTA.answer) {
    story.filed = true;
    progress.save();
    return { status: 'accepted' };
  }
  window.count += 1;
  progress.save();
  return {
    status: 'rejected',
    left: Math.max(0, ACTA.attempts_per_block - window.count),
  };
}
