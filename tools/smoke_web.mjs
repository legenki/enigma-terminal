// Open the page in a real browser and press the buttons.
//
// Two bugs shipped in a row that every static test in the suite was blind to:
// the Explorer called a method its client did not have, and the ledger asked
// for four dictionary keys that were never added. Both are invisible until the
// code runs — a call to a missing method looks exactly like a call to a real
// one, and `t` throws on the missing key rather than falling back. Nothing in
// the suite had ever executed a panel.
//
// This does. The chain is stubbed rather than called, so the run is
// deterministic and needs no network: page one of the history is full and the
// continuation is short, which exercises paging and its end.
//
// Opt-in, and deliberately not wired into CI — it wants a browser that the
// Python suite does not:
//
//   npm install playwright && npx playwright install chromium
//   node tools/smoke_web.mjs
//
// Exits non-zero on any uncaught page error or missing panel.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DOCS = new URL('../docs/', import.meta.url).pathname;
const PORT = 8799;
const ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
// A published BIP-39 test vector, as everywhere else in this repo.
const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const path = normalize(request.url.split('?')[0]).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  try {
    const body = await readFile(join(DOCS, path === '/' ? 'index.html' : path));
    response.writeHead(200, {
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const transaction = (n, confirmed = true) => ({
  txid: String(n).padStart(64, 'a'),
  fee: 1500 + n,
  size: 226,
  weight: 904,
  status: confirmed
    ? {
        confirmed: true,
        block_height: 800000 + n,
        block_time: 1700000000 + n * 600,
      }
    : { confirmed: false },
  vin: [{ prevout: { scriptpubkey_address: 'bc1qsomewhere', value: 500000 } }],
  vout: [
    { scriptpubkey_address: ADDRESS, value: 250000 },
    { scriptpubkey_address: 'bc1qchange', value: 248000 },
  ],
});

const EMPTY = {
  chain_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0,
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0,
  },
};

const STATS = {
  address: ADDRESS,
  chain_stats: {
    funded_txo_count: 40,
    funded_txo_sum: 9000000,
    spent_txo_count: 12,
    spent_txo_sum: 4000000,
    tx_count: 40,
  },
  mempool_stats: {
    funded_txo_count: 1,
    funded_txo_sum: 50000,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 1,
  },
};

// Set CHROMIUM_PATH when the browser lives outside Playwright's own cache —
// a distro package, or a sandbox that ships one already.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);
const page = await browser.newPage();

const problems = [];
let expectNetworkErrors = false;
page.on('pageerror', (error) => problems.push(`PAGE ERROR: ${error.stack}`));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  // A blocked request logs `net::…` with the URL only in its location. The
  // font is aborted here on purpose, and so is every chain call once the
  // outage below starts; neither is the page's fault.
  const from = message.location()?.url ?? '';
  if (text.includes('net::')) {
    if (from.includes('fonts.googleapis.com')) return;
    if (expectNetworkErrors) return;
  }
  problems.push(`CONSOLE: ${text}${from ? ` (${from})` : ''}`);
});

// The looked-up address has a history; the wallet's three derivation paths
// are empty but for the first, so the paths table renders both badges.
let derivedReads = 0;
const addressStats = (url) => {
  if (url.includes(ADDRESS)) return STATS;
  // Only genuine address lookups are counted: the block clock and the
  // explorer's pulse hit this same host and would skew the tally.
  if (!/\/(address|rawaddr)\//.test(url)) return STATS;
  derivedReads += 1;
  return derivedReads === 1 ? STATS : { ...EMPTY, address: 'derived' };
};

await page.route('**://blockstream.info/**', (route) => {
  const url = route.request().url();
  if (url.includes('/chain/'))
    return route.fulfill({ json: [transaction(99)] });
  if (url.includes('/txs'))
    return route.fulfill({
      json: Array.from({ length: 25 }, (_, i) => transaction(i, i > 0)),
    });
  return route.fulfill({ json: addressStats(url) });
});
for (const host of ['mempool.space', 'blockchain.info'])
  await page.route(`**://${host}/**`, (route) =>
    route.fulfill({ json: addressStats(route.request().url()) }),
  );
await page.route('**://fonts.googleapis.com/**', (route) => route.abort());

await page.goto(`http://127.0.0.1:${PORT}/index.html`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(2000);

const step = async (label, body) => {
  const before = problems.length;
  try {
    await body();
  } catch (error) {
    problems.push(`STEP ${label}: ${error.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(300);
  console.log(`${problems.length === before ? 'ok  ' : 'FAIL'} ${label}`);
};

// Several windows are on screen at once — the rail's tools, the status
// panes — and they are all `.win__body`. The one being driven is the body of
// the window whose title bar carries the panel's name.
const panel = (name) =>
  page
    .locator('section.win')
    .filter({ has: page.locator('.win__title', { hasText: name }) })
    .locator('.win__body')
    .first();

const openPanel = async (name) => {
  await page.locator('.nav__item', { hasText: name }).first().click();
  await page.waitForTimeout(300);
  return panel(name);
};

// Every panel: a key the dictionary has not got throws while the panel is
// being built, which takes the whole panel with it.
const items = page.locator('.nav__item');
const count = await items.count();
if (count < 11) problems.push(`sidebar has ${count} rows, expected 11`);
for (let i = 0; i < count; i++) {
  const label = (await items.nth(i).innerText()).trim();
  await step(`open ${label}`, () => items.nth(i).click({ timeout: 3000 }));
}

await step('derive a seed', async () => {
  const decrypt = await openPanel('DECRYPT');
  await decrypt.locator('textarea').first().fill(SEED);
  await decrypt
    .getByRole('button', { name: /^Derive$/i })
    .click({ timeout: 3000 });
  await page.waitForTimeout(1500);
  const notices = await decrypt.locator('.notice').allInnerTexts();
  if (!notices.some((n) => /VALID/i.test(n)))
    throw new Error(`no checksum notice: ${JSON.stringify(notices)}`);
});

await step('read an address', async () => {
  const ledger = await openPanel('LEDGER');
  await ledger.locator('input.field').first().fill(ADDRESS);
  await ledger
    .getByRole('button', { name: /^Read$/i })
    .click({ timeout: 3000 });
  await page.waitForTimeout(2500);
});

const read = await page.evaluate(() => ({
  headline: document.querySelector('.chain-card__btc')?.textContent ?? null,
  transactions: document.querySelectorAll('.led-tx').length,
  pathRows: document.querySelectorAll('table.data tbody tr').length,
  badges: [...document.querySelectorAll('.badge')].map((b) => b.textContent),
}));
console.log(
  `     balance ${read.headline} · ${read.transactions} tx · ` +
    `${read.pathRows} paths ${JSON.stringify(read.badges)}`,
);
// 5,000,000 sats confirmed, esplora's first page of 25, and the three
// derivation paths, one used and two not.
if (read.headline !== '0.05000000')
  problems.push(`headline balance reads ${read.headline}`);
if (read.transactions !== 25)
  problems.push(
    `${read.transactions} transactions on the first page, expected 25`,
  );
if (read.pathRows !== 3)
  problems.push(`${read.pathRows} derivation paths shown, expected 3`);
if (new Set(read.badges).size !== 2)
  problems.push(
    `path badges read ${JSON.stringify(read.badges)}, expected both kinds`,
  );

await step('page the history', async () => {
  const more = panel('LEDGER').getByRole('button', { name: /^Load more$/i });
  if (!(await more.count()))
    throw new Error('a full page offered no continuation');
  await more.first().click();
  await page.waitForTimeout(1500);
  // The continuation is one row long, which is how the history ends.
  const rows = await page.locator('.led-tx').count();
  if (rows !== 26)
    throw new Error(`${rows} transactions after paging, expected 26`);
  if (await more.count()) throw new Error('a short page still offered more');
});

// And the chain refusing to answer: a notice, not a dead panel.
expectNetworkErrors = true;
for (const host of ['blockstream.info', 'mempool.space', 'blockchain.info']) {
  await page.unroute(`**://${host}/**`);
  await page.route(`**://${host}/**`, (route) => route.abort());
}
await step('read with the chain down', async () => {
  const ledger = panel('LEDGER');
  await ledger
    .getByRole('button', { name: /^Read$/i })
    .click({ timeout: 3000 });
  await page.waitForTimeout(2500);
  const notice = await ledger.locator('.notice').first().innerText();
  if (!notice.trim()) throw new Error('the outage produced no notice');
  console.log(`     outage reads: ${JSON.stringify(notice.slice(0, 60))}`);
});

await browser.close();
server.close();

console.log(
  problems.length
    ? `\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`
    : '\nno problems',
);
process.exit(problems.length ? 1 : 0);
