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

const { acts: ACTS, acta_rules: RULES } = STORY;
//: A block is about ten minutes, which is what the registry falls back on when
//: there is no chain to read.
const BLOCK_MS = RULES.offline_window_ms;
const NOISE_LIMIT = 3;
const LINES_PER_PAGE = 16;
const WORD_NUMBER = new Map(WORDLIST.map((word, i) => [word, i + 1]));
const encoder = new TextEncoder();
//: Where the player's filings fall in the registry's numbering, after the wet papers.
const FIRST_INCOMING = 416;

export { STORY };

/** Every wallet the case file covers: hints on these are the informant's. */
export const ACTA_WALLETS = ACTS.flatMap((act) => act.wallets);

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
// Acts, and the folder they fill
// --------------------------------------------------------------------------

export const filedActs = (progress) => [...progress.story.filedActs];
export const actaFiled = (progress, id = 1) =>
  progress.story.filedActs.includes(id);

/** The act being worked on, or null once the written ones are all filed. */
export const currentAct = (progress) =>
  ACTS.find((act) => !actaFiled(progress, act.id)) || null;

const closedIn = (progress, act) =>
  act.wallets.filter((id) => progress.isSolved(id)).length;

const actById = (id) => ACTS.find((act) => act.id === id);

const eligible = (progress, paper) => {
  if (progress.story.granted.includes(paper.id)) return true;
  if (paper.after === null) return false;
  const act = actById(paper.act);
  const previous = actById(paper.act - 1);
  if (previous && !actaFiled(progress, previous.id)) return false;
  return paper.after <= closedIn(progress, act);
};

/**
 * Bring the folder up to date, and answer what is new in it.
 *
 * The folder keeps arrival order so that `PAPERS 3` is the same paper tomorrow,
 * whatever arrives in between. Within one arrival, the order the story wrote.
 */
const syncFolder = (progress) => {
  const { arrived } = progress.story;
  const fresh = STORY.papers
    .filter((paper) => !arrived.includes(paper.id) && eligible(progress, paper))
    .map((paper) => paper.id);
  if (fresh.length) {
    arrived.push(...fresh);
    progress.save();
  }
  return fresh;
};

export const paperById = (id) =>
  STORY.papers.find((paper) => paper.id === id) || null;

export const papers = (progress) => {
  syncFolder(progress);
  return progress.story.arrived.map(paperById).filter(Boolean);
};

export const isUnread = (progress, paper) =>
  !progress.story.read.includes(paper.id);

export const markRead = (progress, paper) => {
  if (!isUnread(progress, paper)) return;
  progress.story.read.push(paper.id);
  progress.save();
};

const redactionActive = (progress) => {
  const { rejected, cleanAt, debtBorrowed } = progress.story;
  return (
    debtBorrowed ||
    (rejected.length >= NOISE_LIMIT && cleanAt < rejected.length)
  );
};

/**
 * A paper as the player's copy now reads. At high noise the special folder takes
 * one word from each, always from a line with no number in it, so the method is
 * felt without the deduction being taken away.
 */
export const paperLines = (progress, paper, lang) => {
  const lines = pick(paper.body, lang);
  if (!redactionActive(progress)) return lines;
  const target = lines.findIndex(
    (line) => line && !/\d/.test(line) && !line.includes('██'),
  );
  if (target < 0) return lines;
  const longest = lines[target]
    .split(/[^\p{L}]+/u)
    .reduce((best, word) => (word.length > best.length ? word : best), '');
  if (longest.length < 5) return lines;
  return lines.map((line, i) =>
    i === target ? line.replace(longest, '██████') : line,
  );
};

/** Put a paper in the folder. The statute also carries the act's turn. */
const grant = (progress, id, lang) => {
  const { story } = progress;
  if (!story.granted.includes(id)) story.granted.push(id);
  // Somebody else handed over what he went to fetch. He can stop rowing.
  const out = story.errand ? errandById(story.errand.id) : null;
  if (out?.gives === id) {
    story.errand = null;
    story.errandsDone.push(out.id);
  }
  const newPapers = syncFolder(progress);
  let reveal = null;
  if (id === 'statute' && !story.tontineShown) {
    story.tontineShown = true;
    reveal = pick(STORY.tontine_reveal, lang);
  }
  progress.save();
  return { newPapers, reveal };
};

// --------------------------------------------------------------------------
// Closing a case
// --------------------------------------------------------------------------

/** The opinion line a closed case prints, in either front-end. */
export const filingLine = (filing, lang) =>
  say('filing', lang, {
    n: String(filing.number).padStart(4, '0'),
    height: filing.height ?? '—',
    operator: META.operator,
  });

/** The registry's mark under a filing: an incoming number and nothing more. */
export const filedLine = (number, lang) =>
  say('filedBy', lang, { n: String(number).padStart(4, '0') });

/**
 * The auctioneer is found once. What lies in his file depends on what the player
 * did; that he is dead does not.
 *
 * A death lands on someone the player has met, so it waits: two wallets closed
 * and a conversation had, or all three closed for a player who never picked up
 * the telephone. It only ever happens between things, never in the middle of a
 * call, so `ask` does not check.
 */
const leveneEvent = (progress, lang) => {
  const { story } = progress;
  const act = actById(2);
  if (story.leveneFound || !actaFiled(progress, 1)) return null;
  const closed = closedIn(progress, act);
  const met = closed >= 2 && story.leveneSpoke >= 2;
  if (!met && closed < act.wallets.length) return null;
  const named = story.rejected.some(
    (entry) => entry.act === 1 && entry.employers?.includes('martillero'),
  );
  const variant = named ? 'a' : 'b';
  story.leveneFound = variant;
  progress.save();
  const filing = Object.values(story.filings).sort(
    (a, b) => a.number - b.number,
  )[0] || { number: 1, height: null };
  const fields = {
    n: String(filing.number).padStart(4, '0'),
    height: filing.height ?? '—',
    operator: META.operator,
  };
  return {
    variant,
    lines: pick(STORY.levene_found[variant], lang).map((line) =>
      Object.entries(fields).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        line,
      ),
    ),
  };
};

const actaIsReady = (progress) => {
  const act = currentAct(progress);
  return Boolean(act) && closedIn(progress, act) === act.wallets.length;
};

/**
 * Close a case. The one way anything is marked solved.
 *
 * `filing` is the player's opinion on record: numbered in the order they signed
 * them, against the height of the chain when they did. A case closed before
 * filings existed has none, and a second close does not make one.
 */
export function closeCase(
  progress,
  caseFile,
  { height = null, lang = 'en', blind = false } = {},
) {
  syncFolder(progress);
  const first = progress.markSolved(caseFile.id);
  const { story } = progress;
  const { filings } = story;
  if (first) {
    filings[caseFile.id] = {
      number: Object.keys(filings).length + 1,
      height,
    };
    if (blind && ACTA_WALLETS.includes(caseFile.id)) story.blindCloses += 1;
    progress.save();
  }
  const act = currentAct(progress);
  const inSecond = actById(2).wallets.includes(caseFile.id);
  return {
    first,
    incoming: filings[caseFile.id]
      ? FIRST_INCOMING + filings[caseFile.id].number
      : null,
    filing: filings[caseFile.id] || null,
    newPapers: first ? syncFolder(progress) : [],
    campaignDone: CAMPAIGN_CASES.every((entry) => progress.isSolved(entry.id)),
    actaReady:
      first &&
      Boolean(act) &&
      act.wallets.includes(caseFile.id) &&
      actaIsReady(progress),
    leveneCalls:
      first &&
      inSecond &&
      actaFiled(progress, 1) &&
      closedIn(progress, actById(2)) === 1 &&
      !story.leveneFound,
    event: first ? leveneEvent(progress, lang) : null,
  };
}

// --------------------------------------------------------------------------
// Favours
// --------------------------------------------------------------------------

/**
 * What the player owes the informant: her hints on these wallets, her hints on
 * the Acta, and any line they paid her to jump. Other cases' hints are not hers.
 */
export const debt = (progress) =>
  ACTA_WALLETS.reduce((sum, id) => sum + progress.hintsUsed(id), 0) +
  Object.values(progress.story.actaHints).reduce((sum, n) => sum + n, 0) +
  progress.story.favours;

const hintsShownIn = (progress, act) => progress.story.actaHints[act.id] || 0;

export const shownActaHints = (progress) => {
  const act = currentAct(progress);
  return act ? act.hints.slice(0, hintsShownIn(progress, act)) : [];
};

/**
 * The first favour that comes due. Once, at the third: the informant takes a word
 * from each of the player's copies, and the courier or the next filed act brings
 * them back. Whichever front-end spent the favour asks here afterwards.
 */
export function debtCall(progress, { lang = 'en' } = {}) {
  const { story } = progress;
  if (story.debtCalled || debt(progress) < RULES.debt_call_at) return null;
  story.debtCalled = true;
  story.debtBorrowed = true;
  progress.save();
  return pick(STORY.debt_call, lang);
}

export const moreActaHints = (progress) => {
  const act = currentAct(progress);
  return Boolean(act) && hintsShownIn(progress, act) < act.hints.length;
};

/** The next hint on the Acta, or null when she has nothing left to say. */
export function useActaHint(progress) {
  const act = currentAct(progress);
  if (!act) return null;
  const shown = hintsShownIn(progress, act);
  const next = act.hints[shown];
  if (!next) return null;
  progress.story.actaHints[act.id] = shown + 1;
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

export const draft = (progress) => progress.story.draft;

/** The act whose rows are on the sheet: the current one, or the last one filed. */
export const sheetAct = (progress) =>
  currentAct(progress) || ACTS[ACTS.length - 1];

/** Write one row. Says which field is wrong, not whether the row is right. */
export function setRow(progress, wallet, row) {
  const id = Number(wallet);
  const act = currentAct(progress);
  if (!act?.wallets.includes(id)) {
    return { status: 'invalid', field: 'wallet' };
  }
  const employer = employerFor(row.employer);
  if (!employer) return { status: 'invalid', field: 'employer' };
  const form = findById(act.forms, row.form, (entry) => entry.id);
  if (!form) return { status: 'invalid', field: 'form' };
  // However the player found them: the book answers to all three spellings.
  const member = bookLookup(row.member ?? '')?.number;
  if (!member) return { status: 'invalid', field: 'member' };
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

const digestOf = (act, rows) => {
  const body = act.wallets
    .map((id) => {
      const row = rows[id];
      return `${id}:${row.employer}:${row.form}:${row.member}:${row.year}`;
    })
    .join('|');
  return toHex(sha256(encoder.encode(`${act.salt}|${body}`)));
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
        now - window.at >= BLOCK_MS;
  if (stale) {
    window.key = height !== null ? `h${height}` : 't';
    window.at = now;
    window.count = 0;
  }
  return window;
};

/**
 * A rejected filing stays on file. Every employer it names hears about it, right
 * or wrong: a letter only from the wrong ones would be the oracle the batch exists
 * to deny.
 */
const recordRejection = (progress, act, lang) => {
  const { story } = progress;
  const employers = [
    ...new Set(act.wallets.map((id) => story.draft[id].employer)),
  ];
  story.rejected.push({ act: act.id, employers });
  const reactions = employers
    .filter((slug) => !story.reacted.includes(slug))
    .map((slug) => {
      story.reacted.push(slug);
      return { employer: slug, lines: pick(STORY.noise[slug], lang) };
    });
  let noiseHigh = null;
  if (story.rejected.length >= NOISE_LIMIT && !story.noiseWarned) {
    story.noiseWarned = true;
    noiseHigh = pick(STORY.noise_high, lang);
  }
  return { reactions, noiseHigh };
};

/**
 * File the Acta. Answers only yes or no, for all the rows together, and at most
 * twice a block. Past that the registry is shut until the next one, unless the
 * player spends a favour: thinking is never on a timer, guessing is.
 */
export function fileActa(
  progress,
  { height = null, now = Date.now(), payFavour = false, lang = 'en' } = {},
) {
  const { story } = progress;
  const act = currentAct(progress);
  if (!act) return { status: 'already' };
  const ready = act.wallets.every(
    (id) => progress.isSolved(id) && story.draft[id],
  );
  if (!ready) return { status: 'incomplete' };
  if (
    act.requires_paper &&
    !papers(progress).some((paper) => paper.id === act.requires_paper)
  ) {
    return { status: 'needs-statute', dead: Boolean(story.leveneFound) };
  }
  const window = openWindow(progress, height, now);
  if (window.count >= RULES.attempts_per_block) {
    if (!payFavour) return { status: 'wait' };
    story.favours += 1;
  }
  if (digestOf(act, story.draft) === act.answer) {
    story.filedActs.push(act.id);
    story.debtBorrowed = false;
    if (act.id === 1) story.actTwoStart = { height, at: now };
    progress.save();
    return {
      status: 'accepted',
      act: act.id,
      newPapers: syncFolder(progress),
      event: leveneEvent(progress, lang),
      actaReady: actaIsReady(progress),
      last: !currentAct(progress),
      knewIt: act.id === 2 && story.blindCloses > 0,
    };
  }
  window.count += 1;
  const { reactions, noiseHigh } = recordRejection(progress, act, lang);
  progress.save();
  return {
    status: 'rejected',
    left: Math.max(0, RULES.attempts_per_block - window.count),
    reactions,
    noiseHigh,
  };
}

// --------------------------------------------------------------------------
// Witnesses
// --------------------------------------------------------------------------

export const witnessIds = () => Object.keys(STORY.witnesses);

const secondActOpen = (progress) => actaFiled(progress, 1);

const rotated = (progress, list, lang) => {
  const entry = list[progress.story.askCount % list.length];
  progress.story.askCount += 1;
  progress.save();
  return pick(entry, lang);
};

/** What a witness's `gives` hands over: a paper, or a new word to ask about. */
const handOver = (progress, gives, lang) => {
  if (!gives) return { newPapers: [], reveal: null, word: null };
  if (paperById(gives)) {
    return { ...grant(progress, gives, lang), word: null };
  }
  return { newPapers: [], reveal: null, word: gives };
};

const witnessFor = (progress, who, lang) => {
  if (!secondActOpen(progress)) return { failed: { status: 'closed' } };
  const key = String(who ?? '').toLowerCase();
  const witness = STORY.witnesses[key];
  if (!witness) return { failed: { status: 'unknown' } };
  if (witness.after_death && progress.story.leveneFound) {
    return {
      failed: {
        status: 'dead',
        lines: rotated(progress, witness.after_death, lang),
      },
    };
  }
  return { witness };
};

/**
 * Whether two words are one word in different clothes. Russian bends its nouns,
 * and a witness who answers `откачка` but not `откачке` is only being obtuse.
 */
const sameWord = (a, b) => {
  let common = 0;
  while (common < a.length && a[common] === b[common]) common += 1;
  return common >= Math.max(4, Math.min(a.length, b.length) - 2);
};

/** Ask a witness about a word the player has found. */
export function ask(progress, who, word, { lang = 'en' } = {}) {
  const { witness, failed } = witnessFor(progress, who, lang);
  if (failed) return failed;
  const text = String(word ?? '')
    .trim()
    .toLowerCase();
  if (!text) return { status: 'intro', lines: pick(witness.intro, lang) };
  const key = String(who).toLowerCase();
  if (key === 'levene') {
    progress.story.leveneSpoke += 1;
    progress.save();
  }
  const has = (matches) => (entry) =>
    entry.keys.some((candidate) => matches(candidate.toLowerCase(), text));
  const topic =
    witness.topics.find(has((candidate, word) => candidate === word)) ||
    witness.topics.find(has(sameWord));
  if (!topic) {
    return {
      status: 'fallback',
      lines: rotated(progress, witness.fallback, lang),
    };
  }
  const later = progress.story.leveneFound && topic.after_found;
  return {
    status: 'answer',
    lines: pick(later ? topic.after_found : topic.text, lang),
    ...handOver(progress, topic.gives, lang),
  };
}

/** Show a witness a paper from the folder, by its number there or its id. */
export function cite(progress, who, reference, { lang = 'en' } = {}) {
  const { witness, failed } = witnessFor(progress, who, lang);
  if (failed) return failed;
  const folder = papers(progress);
  const wanted = String(reference ?? '').trim();
  const paper = /^\d+$/.test(wanted)
    ? folder[Number(wanted) - 1]
    : folder.find((entry) => entry.id === wanted);
  if (!wanted)
    return { status: 'nudge', lines: pick(witness.cite_nudge, lang) };
  if (!paper) return { status: 'no-paper' };
  const key = String(who).toLowerCase();
  const nudge = pick(witness.cite_nudge, lang);
  const hit = STORY.cites.find(
    (entry) => entry.witness === key && entry.paper === paper.id,
  );
  if (!hit) {
    return { status: 'nothing', name: pick(witness.name, lang), lines: nudge };
  }
  return {
    status: 'answer',
    lines: pick(hit.text, lang),
    ...handOver(progress, hit.gives, lang),
  };
}

// --------------------------------------------------------------------------
// Errands
// --------------------------------------------------------------------------

export const errandById = (id) =>
  STORY.errands.find((entry) => entry.id === id) || null;

/**
 * Blocks until the water reaches a district, or null where it never will. The
 * clock runs from the start of the act, and every rushed errand moves it on: a
 * favour opens a sluice to let the boat through, and the water goes downstream.
 */
export const floodLeft = (
  progress,
  errand,
  { height = null, now = Date.now() } = {},
) => {
  if (errand.closes_after === null) return null;
  const { actTwoStart: start, floodAdvance } = progress.story;
  if (!start) return errand.closes_after - floodAdvance;
  const elapsed =
    height !== null && start.height !== null
      ? height - start.height
      : Math.floor((now - start.at) / BLOCK_MS);
  return errand.closes_after - elapsed - floodAdvance;
};

const flooded = (progress, errand, height, now) => {
  const left = floodLeft(progress, errand, { height, now });
  return left !== null && left <= 0;
};

/** Where one errand stands, for a list of them. */
export const errandStatus = (
  progress,
  errand,
  { height = null, now = Date.now() } = {},
) => {
  const { story } = progress;
  if (story.errandsDone.includes(errand.id)) return 'done';
  if (story.granted.includes(errand.gives)) return 'done';
  if (story.errand?.id === errand.id) return 'out';
  if (flooded(progress, errand, height, now)) return 'flooded';
  return 'open';
};

/** The errand under way, with its label. */
export const errandOut = (progress) =>
  progress.story.errand ? errandById(progress.story.errand.id) : null;

/** Send Lalo. One errand at a time; he has the one bicycle. */
export function sendErrand(
  progress,
  id,
  { height = null, now = Date.now(), lang = 'en' } = {},
) {
  if (!secondActOpen(progress)) return { status: 'closed' };
  const errand = errandById(String(id ?? '').toLowerCase());
  if (!errand) return { status: 'unknown' };
  const { story } = progress;
  if (story.errand) return { status: 'busy', errand: errandOut(progress) };
  if (
    story.errandsDone.includes(errand.id) ||
    story.granted.includes(errand.gives)
  ) {
    return { status: 'done', errand };
  }
  if (!story.actTwoStart) story.actTwoStart = { height, at: now };
  if (flooded(progress, errand, height, now)) {
    return { status: 'flooded', errand };
  }
  story.errand = {
    id: errand.id,
    height: height === null ? null : height + errand.blocks,
    at: now + errand.blocks * BLOCK_MS,
  };
  progress.save();
  return { status: 'sent', errand, lines: pick(errand.lalo_out, lang) };
}

const bringBack = (progress, lang) => {
  const { story } = progress;
  const errand = errandOut(progress);
  story.errand = null;
  story.errandsDone.push(errand.id);
  // He brings clean copies with him; that is what the warning promised.
  story.cleanAt = story.rejected.length;
  story.debtBorrowed = false;
  const later = story.leveneFound && errand.lalo_back_after_found;
  const handed = grant(progress, errand.gives, lang);
  return {
    id: errand.id,
    lines: pick(later ? errand.lalo_back_after_found : errand.lalo_back, lang),
    ...handed,
    event: leveneEvent(progress, lang),
  };
};

/** Lalo, if his blocks are up. Blocks keep passing while nobody is looking. */
export function collectErrand(
  progress,
  { height = null, now = Date.now(), lang = 'en' } = {},
) {
  const { errand } = progress.story;
  if (!errand) return null;
  const due =
    height !== null && errand.height !== null
      ? height >= errand.height
      : now >= errand.at;
  return due ? bringBack(progress, lang) : null;
}

/** Bring him back now, for a favour. */
export function collectNow(progress, { lang = 'en' } = {}) {
  if (!progress.story.errand) return { status: 'idle' };
  progress.story.favours += 1;
  progress.story.floodAdvance += RULES.rush_blocks;
  return { status: 'back', rushed: true, ...bringBack(progress, lang) };
}

// --------------------------------------------------------------------------
// Notes
// --------------------------------------------------------------------------

export const notes = (progress) => [...progress.story.notes];

/** Keep a line. Answers how many there are, or null for an empty one. */
export function addNote(progress, text) {
  const line = String(text ?? '').trim();
  if (!line) return null;
  progress.story.notes.push(line.slice(0, 280));
  progress.save();
  return progress.story.notes.length;
}
