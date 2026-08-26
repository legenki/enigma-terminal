// Surface report on the browser build's command set, for tests/test_command_parity.py.
//
// The web terminal once advertised JOURNAL, RECALL and PURGE in HELP while the
// dispatch table pointed at methods nobody had written, so all three answered
// UNKNOWN COMMAND. Nothing caught it because nothing ever compared the two
// lists. This prints them side by side.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = await import(join(root, 'docs/js/engine.js'));
const core = await import(join(root, 'docs/js/core.js'));
const { CAMPAIGN } = await import(join(root, 'docs/js/campaign.js'));

const { Engine } = engine;
const probe = Object.create(Engine.prototype);
const table = Engine.prototype.commands.call(probe);

// HELP and ABOUT are module-private, so read them the way a player does.
const helpRows = {};
const aboutLines = {};
for (const lang of core.LANGS) {
  const rows = [];
  const lines = [];
  probe.lang = lang;
  probe.term = {
    print(text) {
      if (Array.isArray(text)) rows.push(text.map((s) => s.text.trim()));
      else lines.push(String(text));
      return this;
    },
    blank() { return this; },
    printLines(list) { lines.push(...list); return this; },
  };
  Engine.prototype.cmdHelp.call(probe);
  helpRows[lang] = rows;
  lines.length = 0;
  Engine.prototype.cmdAbout.call(probe);
  aboutLines[lang] = lines;
}

// The desk, with one contract taken: OPEN has to reach everything CASES prints.
// The board is fetched in the browser, so give Node the same door onto disk
// rather than a stub — the code under test stays the code that ships.
const { readFile } = await import('node:fs/promises');
globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => JSON.parse(await readFile(fileURLToPath(url), 'utf8')),
});
await core.loadContracts();

// Drive the real command, not a lookup that resembles it: OPEN searching only
// the campaign while CASES listed the desk is the bug this exists to catch,
// and it lived entirely inside cmdOpen.
const lines = [];
const term = new Proxy({}, {
  get: () => (text) => {
    if (typeof text === 'string') lines.push(text);
    else if (Array.isArray(text)) lines.push(text.map((s) => s.text).join(''));
    return term;
  },
});
const player = new Engine(term, { lang: 'en' });
player.progress.data.taken = [169, 170];
player.progress.data.solved = [171];
const desk = core.caseload(player.progress);

const unreachable = [];
for (const entry of desk) {
  lines.length = 0;
  player.cmdOpen(String(entry.id));
  if (lines.some((line) => line.includes('NOT FOUND IN ARCHIVE'))) unreachable.push(entry.id);
}

process.stdout.write(JSON.stringify({
  commands: Object.keys(table),
  broken: Object.entries(table).filter(([, fn]) => typeof fn !== 'function').map(([k]) => k),
  helpRows,
  aboutLines,
  langs: core.LANGS,
  campaignSize: CAMPAIGN.cases.length,
  deskSize: desk.length,
  unreachable,
}, null, 2));
