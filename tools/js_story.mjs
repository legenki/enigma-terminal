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
  await run(`DECRYPT ${phrases[2]}`);
  seen.memo = await run('PAPERS');
  await run(`DECRYPT ${phrases[3]}`);
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

// What the screen says before anyone has typed anything.
{
  const { player, lines } = playerFor('en');
  player.chain = { nodeName: 'TEST' };
  player.explorer = {};
  await player.boot();
  report.boot = lines.join('\n');
}

process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
