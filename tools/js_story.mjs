// Plays the first act of the case file under Node, for tests/test_story.py.
//
// The answers arrive on the command line so that this file, like everything
// else under tools/, gives nothing away. Storage is a plain Map behind the
// localStorage name: the code under test is the code that ships.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  },
});

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => import(join(root, path));
const core = await load('docs/js/core.js');
const story = await load('docs/js/story.js');
const { Engine } = await load('docs/js/engine.js');

const { solution, phrases } = JSON.parse(process.argv[2]);
const STORAGE_KEY = 'enigma-terminal/progress/v1';
const caseFile = (id) => core.caseById(id);
const fresh = () => {
  memory.clear();
  return new core.ProgressStore();
};
const report = {};

const rowsFor = (progress, ids) => {
  for (const id of ids) story.setRow(progress, id, solution[id]);
};
const finishActOne = (progress) => {
  for (const id of [1, 2, 3]) story.closeCase(progress, caseFile(id));
  rowsFor(progress, [1, 2, 3]);
  return story.fileActa(progress, { height: 100 });
};
const close = (progress, id, height = null) =>
  story.closeCase(progress, caseFile(id), { height });

// --- the book ---------------------------------------------------------------
report.book = {
  byNumber: story.bookLookup('515'),
  byPosition: story.bookLookup('33:3'),
  byWord: story.bookLookup('doctor'),
  flooded: story.bookLookup('2047'),
  nonsense: story.bookLookup('not-a-word'),
  outOfRange: story.bookLookup('129:1'),
};

// --- closing a case -----------------------------------------------------------
{
  const progress = fresh();
  const third = story.closeCase(progress, caseFile(3), { height: 900001 });
  const again = story.closeCase(progress, caseFile(3), { height: 900002 });
  const first = story.closeCase(progress, caseFile(1), { height: null });
  report.closure = {
    third,
    again,
    first,
    solved: progress.solved,
    papers: story.papers(progress).map((paper) => paper.id),
  };
}

// --- the Acta -----------------------------------------------------------------
{
  const progress = fresh();
  const rows = Object.entries(solution);
  const wrong = { ...solution[1], employer: 'martillero' };
  const results = {};
  results.unknownField = story.setRow(progress, 1, {
    ...solution[1],
    employer: 'nobody',
  });
  results.notClosedYet = story.setRow(progress, 1, solution[1]);
  for (const id of [1, 2, 3]) story.closeCase(progress, caseFile(id));
  results.before = story.fileActa(progress, { height: 100 });
  results.afterClosing = story.setRow(progress, 1, wrong);
  for (const [id, row] of rows.slice(1))
    story.setRow(progress, Number(id), row);
  results.first = story.fileActa(progress, { height: 100 });
  results.second = story.fileActa(progress, { height: 100 });
  results.third = story.fileActa(progress, { height: 100 });
  const debtBefore = story.debt(progress);
  results.paid = story.fileActa(progress, { height: 100, payFavour: true });
  results.debtAfterPaying = story.debt(progress) - debtBefore;
  results.nextBlock = story.fileActa(progress, { height: 101 });
  story.setRow(progress, 1, solution[1]);
  results.accepted = story.fileActa(progress, { height: 101 });
  results.again = story.fileActa(progress, { height: 101 });
  results.filed = story.actaFiled(progress);
  // A reload keeps what the player wrote and what happened to it.
  results.reloaded = story.actaFiled(new core.ProgressStore());
  report.acta = results;
}

// A member can be named however the player found them.
{
  const progress = fresh();
  story.closeCase(progress, caseFile(1));
  for (const [key, member] of [
    ['byWord', 'abandon'],
    ['byPlace', '1:1'],
    ['byNumber', '1'],
  ]) {
    story.setRow(progress, 1, { ...solution[1], member });
    report[key] = story.draft(progress)[1].member;
  }
  report.badMember = story.setRow(progress, 1, {
    ...solution[1],
    member: 'not-a-word',
  });
}

// The second act's Acta wants the statute in the folder.
{
  const progress = fresh();
  finishActOne(progress);
  for (const id of [4, 5, 6]) close(progress, id, 101);
  rowsFor(progress, [4, 5, 6]);
  report.needsStatute = story.fileActa(progress, { height: 110 }).status;
  report.knewBlank = null;
  story.sendErrand(progress, 'statute', { height: 110 });
  story.collectNow(progress);
  const accepted = story.fileActa(progress, { height: 111 });
  report.acceptedWithStatute = accepted.status;
  report.knewBlank = accepted.knewIt;
}
{
  const progress = fresh();
  finishActOne(progress);
  story.ask(progress, 'levene', 'lot');
  story.closeCase(progress, caseFile(4), { height: 101, blind: true });
  for (const id of [5, 6]) close(progress, id, 101);
  rowsFor(progress, [4, 5, 6]);
  report.knewIt = story.fileActa(progress, { height: 111 }).knewIt;
}

// A witness who hands over what Lalo went to fetch ends the errand.
{
  const progress = fresh();
  finishActOne(progress);
  story.sendErrand(progress, 'statute', { height: 200 });
  story.ask(progress, 'levene', 'lot');
  report.errandOverlap = {
    out: story.errandOut(progress)?.id ?? null,
    again: story.sendErrand(progress, 'statute', { height: 201 }).status,
    free: story.sendErrand(progress, 'pump-log', { height: 201 }).status,
  };
}

// Russian bends its words; a witness should not care.
{
  const progress = fresh();
  finishActOne(progress);
  report.inflected = {
    genitive: story.ask(progress, 'ines', 'откачке').status,
    noise: story.ask(progress, 'ines', 'zzzzzz').status,
  };
}

// Weak spots: what a witness says to a wrong paper, and what a favour costs.
{
  const progress = fresh();
  finishActOne(progress);
  const nudge = story.cite(progress, 'ines', 'catalogue');
  const asked = story.cite(progress, 'ines', '');
  report.nudge = {
    status: nudge.status,
    lines: nudge.lines,
    asked: asked.status,
    askedLines: asked.lines,
    lalo: story.cite(progress, 'lalo', 'catalogue').lines,
  };
}
{
  const progress = fresh();
  finishActOne(progress);
  const flood = {};
  const olmos = story.errandById('olmos');
  flood.before = story.floodLeft(progress, olmos, { height: 101 });
  for (const id of ['pump-log', 'register']) {
    story.sendErrand(progress, id, { height: 101 });
    story.collectNow(progress);
  }
  flood.afterTwoRushes = story.floodLeft(progress, olmos, { height: 101 });
  flood.stillOpen = story.errandStatus(progress, olmos, { height: 101 });
  story.sendErrand(progress, 'page-128', { height: 101 });
  flood.rush = story.collectNow(progress).rushed;
  flood.afterThree = story.errandStatus(progress, olmos, { height: 101 });
  flood.send = story.sendErrand(progress, 'olmos', { height: 101 }).status;
  report.flood = flood;
}
{
  const progress = fresh();
  finishActOne(progress);
  const call = {};
  const paper = story.paperById('attestation');
  progress.useHint(1);
  progress.useHint(2);
  call.early = story.debtCall(progress, { lang: 'en' });
  call.cleanBefore = story.paperLines(progress, paper, 'en').join(' ');
  progress.useHint(3);
  call.first = story.debtCall(progress, { lang: 'en' });
  call.second = story.debtCall(progress, { lang: 'en' });
  call.borrowed = story.paperLines(progress, paper, 'en').join(' ');
  story.sendErrand(progress, 'pump-log', { height: 101 });
  story.collectErrand(progress, { height: 102 });
  call.returned = story.paperLines(progress, paper, 'en').join(' ');
  call.noRepeat = story.debtCall(progress, { lang: 'en' });
  report.call = call;
}
{
  const progress = fresh();
  for (const id of [1, 2, 3]) {
    close(progress, id);
    progress.useHint(id);
  }
  story.debtCall(progress, { lang: 'en' });
  const paper = story.paperById('attestation');
  const during = story.paperLines(progress, paper, 'en').join(' ');
  rowsFor(progress, [1, 2, 3]);
  story.fileActa(progress, { height: 1 });
  report.callClearsOnFiling = {
    during,
    after: story.paperLines(progress, paper, 'en').join(' '),
  };
}

// With no chain to read, the clock falls back to ten minutes of the real one.
{
  const progress = fresh();
  for (const id of [1, 2, 3]) {
    story.closeCase(progress, caseFile(id));
    story.setRow(progress, id, { ...solution[id], year: 1999 });
  }
  const at = 1_000_000;
  report.offline = {
    first: story.fileActa(progress, { height: null, now: at }).status,
    second: story.fileActa(progress, { height: null, now: at + 1000 }).status,
    third: story.fileActa(progress, { height: null, now: at + 2000 }).status,
    later: story.fileActa(progress, { height: null, now: at + 600_000 }).status,
  };
}

// --- hints are favours --------------------------------------------------------
{
  const progress = fresh();
  progress.useHint(1);
  progress.useHint(2);
  progress.useHint(8);
  const shown = story.useActaHint(progress);
  report.debt = { total: story.debt(progress), shown: Boolean(shown) };
  for (let i = 0; i < 5; i++) story.useActaHint(progress);
  report.debt.capped = story.debt(progress);
}

// --- a save of the wrong shape ------------------------------------------------
report.badSaves = {};
for (const body of [
  '{"story": 5}',
  '{"story": {"draft": 7, "filings": [], "attempts": "x"}}',
  '{"story": {"draft": {"1": 9}}}',
]) {
  memory.clear();
  memory.set(STORAGE_KEY, body);
  const progress = new core.ProgressStore();
  story.closeCase(progress, caseFile(1), { height: 5 });
  report.badSaves[body] = {
    draft: story.draft(progress),
    closed: progress.isSolved(1),
  };
}
memory.clear();
memory.set(STORAGE_KEY, '{"solved": [1, 2]}');
report.oldSave = {
  solved: new core.ProgressStore().solved,
  papers: story.papers(new core.ProgressStore()).map((paper) => paper.id),
};
{
  const progress = fresh();
  story.closeCase(progress, caseFile(1));
  progress.reset();
  report.afterReset = {
    papers: story.papers(progress).length,
    draft: story.draft(progress),
  };
}

// --- two front-ends, two stores -------------------------------------------------
{
  // The panel writes; the terminal, holding an older copy, must not undo it.
  memory.clear();
  const { Engine: Terminal } = await load('docs/js/engine.js');
  const quiet = new Proxy({}, { get: () => () => quiet });
  const terminal = new Terminal(quiet, { lang: 'en' });
  const panel = new core.ProgressStore();
  for (const id of [1, 2]) story.closeCase(panel, caseFile(id));
  story.setRow(panel, 1, solution[1]);
  await terminal.run('ACTA');
  await terminal.run('HINT');
  await terminal.run('ACTA HINT');
  const after = new core.ProgressStore();
  report.twoStores = {
    solved: after.solved,
    draft: story.draft(after),
    terminalSees: terminal.progress.solved,
  };
}

// --- the terminal -------------------------------------------------------------
const playerFor = (lang) => {
  memory.clear();
  const lines = [];
  const term = new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === 'animating') return false;
        return (...args) => {
          for (const value of args) {
            if (typeof value === 'string') lines.push(value);
            else if (Array.isArray(value)) {
              lines.push(
                value
                  .map((item) => (typeof item === 'string' ? item : item.text))
                  .join(lines.length ? '\n' : ''),
              );
            }
          }
          return term;
        };
      },
    },
  );
  const player = new Engine(term, { lang });
  return { player, lines };
};

report.terminal = {};
for (const lang of ['en', 'ru', 'es', 'pt']) {
  const { player, lines } = playerFor(lang);
  player.chain.transactions = async (_, limit) => {
    report.terminal.txlogLimit = limit;
    return [
      {
        txid: 'a'.repeat(64),
        confirmed: true,
        blockHeight: 672212,
        blockTime: 1614309360,
      },
    ];
  };
  const run = async (line) => {
    lines.length = 0;
    await player.run(line);
    return lines.join('\n');
  };
  const seen = {};
  seen.emptyActa = await run('ACTA');
  seen.emptyPapers = await run('PAPERS');
  seen.decrypt = await run(`DECRYPT ${phrases[1]}`);
  seen.papers = await run('PAPERS');
  seen.firstPaper = await run('PAPERS 1');
  seen.book = await run('BOOK 33:3');
  seen.bookWord = await run('BOOK 1');
  seen.bookFlooded = await run('BOOK 2047');
  seen.badRow = await run('ACTA 1 NOBODY 11B 1 2021');
  seen.txlog = await run('TXLOG 1EBuf21icKTE5m3HWVndKx2bTxvqrWCqV6 ALL');
  const onePage = player.chain.transactions;
  player.chain.transactions = async () =>
    Array.from({ length: 25 }, (_, i) => ({
      txid: String(i).repeat(64).slice(0, 64),
      confirmed: true,
      blockHeight: 900000 - i,
      blockTime: 1700000000 - i,
    }));
  seen.txlogFull = await run('TXLOG 1EBuf21icKTE5m3HWVndKx2bTxvqrWCqV6 ALL');
  player.chain.transactions = onePage;
  await run(`DECRYPT ${phrases[2]}`);
  seen.memo = await run('PAPERS');
  seen.thirdClose = await run(`DECRYPT ${phrases[3]}`);
  seen.hint = await run('ACTA HINT');
  seen.wrong = await run('ACTA 1 MARTILLERO LOT 1 2021');
  seen.draft = await run('ACTA');
  seen.early = await run('ACTA FILE');
  for (const id of [2, 3]) {
    const row = solution[id];
    await run(
      `ACTA ${id} ${row.employer} ${row.form} ${row.member} ${row.year}`,
    );
  }
  seen.rejected = await run('ACTA FILE');
  const one = solution[1];
  await run(`ACTA 1 ${one.employer} ${one.form} ${one.member} ${one.year}`);
  seen.accepted = await run('ACTA FILE');
  seen.help = await run('HELP');
  report.terminal[lang] = seen;
}

// --- the second act -------------------------------------------------------------
{
  const progress = fresh();
  const two = {};
  two.askBefore = story.ask(progress, 'lalo', 'bike');
  two.sendBefore = story.sendErrand(progress, 'pump-log', { height: 1 });
  two.rowBefore = story.setRow(progress, 4, solution[4]);
  two.papersBefore = story
    .papers(progress)
    .filter((paper) => paper.act === 2)
    .map((paper) => paper.id);
  two.acceptedOne = finishActOne(progress);
  two.currentAfterOne = story.currentAct(progress)?.id ?? null;
  two.askIntro = story.ask(progress, 'levene', '');
  two.askTopic = story.ask(progress, 'levene', 'recoleta');
  two.askUnknownWord = story.ask(progress, 'levene', 'zzzz');
  two.askNobody = story.ask(progress, 'nobody', 'bike');
  two.viaLevene = story.ask(progress, 'levene', 'lot');
  two.viaLeveneAgain = story.ask(progress, 'levene', 'lot');
  two.citeMissing = story.cite(progress, 'levene', 'acceptance');
  two.citeNothing = story.cite(progress, 'abel', 'catalogue');
  story.closeCase(progress, caseFile(1));
  two.citeHit = story.cite(progress, 'levene', 'memo');
  for (const id of [4, 5, 6]) close(progress, id, 101);
  rowsFor(progress, [4, 5, 6]);
  two.acceptedTwo = story.fileActa(progress, { height: 102 });
  two.currentAfterTwo = story.currentAct(progress)?.id ?? null;
  two.filedAll = story.filedActs(progress);
  report.actTwo = two;
}
{
  const progress = fresh();
  finishActOne(progress);
  const errand = {};
  errand.first = story.sendErrand(progress, 'pump-log', { height: 200 });
  errand.second = story.sendErrand(progress, 'register', { height: 200 });
  errand.tooSoon = story.collectErrand(progress, { height: 200 });
  errand.back = story.collectErrand(progress, { height: 201 });
  errand.again = story.sendErrand(progress, 'pump-log', { height: 202 });
  errand.unknown = story.sendErrand(progress, 'nothing', { height: 202 });
  errand.payIdle = story.collectNow(progress);
  const before = story.debt(progress);
  story.sendErrand(progress, 'register', { height: 202 });
  errand.paid = story.collectNow(progress);
  errand.debtForPaying = story.debt(progress) - before;
  report.errand = errand;
  const early = fresh();
  finishActOne(early);
  errand.olmosEarly = story.sendErrand(early, 'olmos', { height: 103 });
  const late = fresh();
  finishActOne(late);
  errand.olmosLate = story.sendErrand(late, 'olmos', { height: 100 + 7 });
  const offline = fresh();
  finishActOne(offline);
  story.sendErrand(offline, 'pump-log', { height: null, now: 1000 });
  errand.offlineSoon = story.collectErrand(offline, {
    height: null,
    now: 2000,
  });
  errand.offlineBack = story.collectErrand(offline, {
    height: null,
    now: 1000 + 600_000,
  });
  const statute = fresh();
  finishActOne(statute);
  story.sendErrand(statute, 'statute', { height: 300 });
  errand.statute = story.collectErrand(statute, { height: 302 });
}
{
  const death = {};
  const named = fresh();
  for (const id of [1, 2, 3]) close(named, id, 100);
  rowsFor(named, [1, 2, 3]);
  story.setRow(named, 1, { ...solution[1], employer: 'martillero' });
  story.fileActa(named, { height: 100 });
  rowsFor(named, [1]);
  story.fileActa(named, { height: 100 });
  death.afterOne = close(named, 4, 101).event;
  story.ask(named, 'levene', 'lot');
  story.ask(named, 'levene', 'memo');
  death.whileTalking = story.ask(named, 'levene', 'recoleta').event ?? null;
  const closed = close(named, 5, 102);
  death.named = { ...closed.event, newPapers: closed.newPapers };
  death.onlyOnce = close(named, 6, 103).event;
  death.askAfter = story.ask(named, 'levene', 'lot');
  death.citeAfter = story.cite(named, 'levene', 'memo');
  const clean = fresh();
  finishActOne(clean);
  close(clean, 4, 101);
  story.ask(clean, 'levene', 'recoleta');
  story.ask(clean, 'levene', 'memo');
  death.clean = close(clean, 5, 102).event;
  const silent = fresh();
  finishActOne(silent);
  close(silent, 4, 101);
  death.silentTwo = close(silent, 5, 102).event;
  death.silentAll = close(silent, 6, 103).event;
  const courier = fresh();
  finishActOne(courier);
  close(courier, 4, 101);
  close(courier, 5, 102);
  story.ask(courier, 'levene', 'recoleta');
  story.ask(courier, 'levene', 'memo');
  story.sendErrand(courier, 'page-128', { height: 103 });
  death.onReturn = story.collectErrand(courier, { height: 104 }).event;
  const lateFiler = fresh();
  for (const id of [4, 5]) close(lateFiler, id, 90);
  death.lateFiling = finishActOne(lateFiler);
  death.lateThird = close(lateFiler, 6, 103).event;
  report.death = death;
}
{
  const noise = {};
  const progress = fresh();
  for (const id of [1, 2, 3]) close(progress, id);
  for (const id of [1, 2, 3])
    story.setRow(progress, id, { ...solution[id], year: 1999 });
  noise.first = story.fileActa(progress, { height: 1 });
  const named = noise.first.reactions.map((item) => item.employer);
  noise.reactedToCorrect = named.includes(solution[1].employer);
  story.setRow(progress, 2, { ...solution[2], employer: 'salar', year: 1999 });
  noise.second = story.fileActa(progress, { height: 1 });
  noise.secondEmployers = noise.second.reactions.map((item) => item.employer);
  story.setRow(progress, 2, { ...solution[2], year: 1999 });
  noise.reactedToWrong = true;
  noise.reactionsAreOnlyForNamed = named.every((slug) =>
    [1, 2, 3].some((id) => solution[id].employer === slug),
  );
  noise.second.reactions = noise.second.reactions.filter(
    (item) => item.employer !== 'salar',
  );
  noise.reactedToWrong = noise.secondEmployers.includes('salar');
  noise.third = story.fileActa(progress, { height: 2 });
  noise.kept = progress.story.rejected.length;
  noise.fourthHigh = Boolean(story.fileActa(progress, { height: 2 }).noiseHigh);
  rowsFor(progress, [1, 2, 3]);
  story.fileActa(progress, { height: 3 });
  const paper = story.paperById('attestation');
  noise.redacted = story.paperLines(progress, paper, 'en').join('\n');
  noise.cluesSurvive =
    noise.redacted.includes('112:15') && noise.redacted.includes('Nested');
  story.sendErrand(progress, 'pump-log', { height: 10 });
  story.collectErrand(progress, { height: 11 });
  noise.clean = story.paperLines(progress, paper, 'en').join('\n');
  report.noise = noise;
}
{
  const progress = fresh();
  report.notes = { blank: story.addNote(progress, '   ') };
  story.addNote(progress, 'ask about the shoes');
  story.addNote(progress, 'who is T');
  report.notes.saved = story.notes(progress);
  progress.reset();
  report.notes.afterReset = story.notes(progress);
}
memory.clear();
memory.set(
  STORAGE_KEY,
  '{"solved":[1,2,3],"story":{"filed":true,"actaHints":2}}',
);
{
  const progress = new core.ProgressStore();
  report.oldFiled = {
    filed: story.actaFiled(progress),
    hints: story.debt(progress),
  };
}
report.terminal2 = {};
for (const lang of ['en', 'ru', 'es', 'pt']) {
  const { player, lines } = playerFor(lang);
  const run = async (line) => {
    lines.length = 0;
    await player.run(line);
    return lines.join('\n');
  };
  const seen = {};
  for (const id of [1, 2, 3]) await run(`DECRYPT ${phrases[id]}`);
  for (const id of [1, 2, 3]) {
    const row = solution[id];
    await run(
      `ACTA ${id} ${row.employer} ${row.form} ${row.member} ${row.year}`,
    );
  }
  seen.accepted = await run('ACTA FILE');
  seen.errandList = await run('SEND');
  seen.papersList = await run('PAPERS');
  seen.papersNew = await run('PAPERS NEW');
  seen.papersNone = await run('PAPERS NEW');
  seen.ask = await run('ASK levene recoleta');
  seen.intro = await run('ASK lalo');
  seen.cite = await run('CITE levene 2');
  seen.citeAsk = await run('CITE ines');
  seen.send = await run('SEND pump-log');
  seen.busy = await run('SEND register');
  seen.now = await run('SEND NOW');
  seen.note = await run('NOTE shoes');
  seen.statute = await run('ASK levene lot');
  seen.notes = await run('NOTE');
  for (const id of [4, 5, 6])
    seen[`close${id}`] = await run(`DECRYPT ${phrases[id]}`);
  for (const id of [4, 5, 6]) {
    const row = solution[id];
    await run(
      `ACTA ${id} ${row.employer} ${row.form} ${row.member} ${row.year}`,
    );
  }
  seen.end = await run('ACTA FILE');
  seen.after = await run('ACTA');
  report.terminal2[lang] = seen;
}

// What the screen says before anyone has typed anything.
{
  const { player, lines } = playerFor('en');
  player.chain = { nodeName: 'TEST' };
  player.explorer = {};
  await player.boot();
  report.boot = lines.join('\n');
}

process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
