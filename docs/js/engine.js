// Game logic for the browser build. Mirrors the command set of the Python
// terminal (neon_terminal/game.py) so both builds play identically.

import { CAMPAIGN } from './campaign.js';
import {
  CLIENTS, ProgressStore, caseForMnemonic, casesForClient, clientBySlug,
  completeMnemonic, contractsLoaded, loadContracts, pick, randomMnemonic, searchCases,
} from './core.js';
import { WORDLIST_SHA256 } from './wordlist.js';
import { ChainClient, ChainError, formatBtc, PROVIDERS } from './chain.js';
import { deriveWallet } from './crypto/wallet.js';
import {
  MnemonicError,
  entropyToMnemonic,
  indexOf,
  mnemonicToEntropy,
  normalize,
  searchWords,
  wordAt,
} from './crypto/bip39.js';
import { fromHex, toHex } from './crypto/hash.js';
import { Journal, TOOLS, maskMnemonic } from './journal.js';

const OFFICIAL_WORDLIST_SHA256 =
  '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda';

const DECRYPT_LOGS = [
  '[~] decrypting master pre-image...',
  '[~] pbkdf2-hmac-sha512, 2048 rounds...',
  '[~] deriving public key coordinates (X, Y)...',
  '[~] sha256 -> ripemd160 hashing...',
  '[~] encoding base58check payload...',
  '[~] computing bech32 witness program...',
];

const NET_LOGS = [
  '[~] establishing encrypted proxy...',
  '[~] resolving explorer endpoint...',
  '[~] broadcasting address mapping to p2p network...',
  '[~] fetching unspent transaction outputs (utxo)...',
  '[~] parsing data streams...',
  '[~] reconciling mempool deltas...',
];

const HELP = {
  en: [
    ['HELP', 'this list'],
    ['LANG RU|EN', 'switch narrative language'],
    ['CASES', 'list every case file and its state'],
    ['CLIENTS', 'the eight employers and their contract counts'],
    ['BOARD <client>', "list one employer's thirty-two contracts"],
    ['OPEN <id>', 'open a case file and make it active'],
    ['BRIEF / EVIDENCE / CLUES', 're-read the active case'],
    ['HINT', 'spend a hint on the active case'],
    ['WORD <1..2048>', 'read one entry of the BIP-39 wordlist'],
    ['INDEX <word>', "find a word's position in the wordlist"],
    ['SEARCH <prefix>', 'list wordlist entries by prefix'],
    ['ARCHIVE <text>', 'full-text search across the case files'],
    ['RANDOM [12..24]', 'generate a fresh seed phrase from secure randomness'],
    ['COMPLETE <phrase ?>', 'find the missing word of a phrase (one ? marks it)'],
    ['ENTROPY <hex>', 'rebuild a mnemonic from raw entropy (32 hex chars)'],
    ['DECRYPT <12 words>', 'validate a seed phrase and derive its addresses'],
    ['DERIVE', 're-print the derivation grid of the loaded seed'],
    ['SYNC_LEDGER [addr]', 'query the live Bitcoin network for a balance'],
    ['SWEEP', 'check all three derived addresses at once'],
    ['TXLOG [addr]', 'pull the most recent on-chain transactions'],
    ['PROVIDER [name]', 'choose the explorer: blockstream|mempool|blockchain'],
    ['EXPLORER', 'open the loaded address in a block explorer'],
    ['COPY', 'copy the loaded addresses to the clipboard'],
    ['JOURNAL [tool]', 'the investigation journal, newest first'],
    ['RECALL <n>', 'replay entry n from the journal'],
    ['PURGE [all]', 'clear the journal (pinned entries survive unless "all")'],
    ['STATUS', 'operator status and progress'],
    ['ABOUT', 'what this program actually does'],
    ['CLEAR', 'wipe the screen'],
    ['RESET', 'erase saved progress'],
  ],
  ru: [
    ['HELP', 'этот список'],
    ['LANG RU|EN', 'язык повествования'],
    ['CASES', 'список дел и их состояние'],
    ['CLIENTS', 'восемь заказчиков и их счётчики'],
    ['BOARD <заказчик>', 'список из 32 контрактов одного заказчика'],
    ['OPEN <id>', 'открыть дело и сделать его активным'],
    ['BRIEF / EVIDENCE / CLUES', 'перечитать активное дело'],
    ['HINT', 'потратить подсказку по активному делу'],
    ['WORD <1..2048>', 'показать слово словаря BIP-39'],
    ['INDEX <слово>', 'найти позицию слова в словаре'],
    ['SEARCH <префикс>', 'искать слова словаря по началу'],
    ['ARCHIVE <текст>', 'полнотекстовый поиск по делам'],
    ['RANDOM [12..24]', 'сгенерировать новую сид-фразу'],
    ['COMPLETE <фраза ?>', 'найти недостающее слово фразы (его место — ?)'],
    ['ENTROPY <hex>', 'собрать мнемонику из энтропии (32 hex-символа)'],
    ['DECRYPT <12 слов>', 'проверить фразу и вывести адреса'],
    ['DERIVE', 'повторить сетку деривации загруженного сида'],
    ['SYNC_LEDGER [адрес]', 'запрос баланса в живой сети Bitcoin'],
    ['SWEEP', 'проверить сразу все три выведенных адреса'],
    ['TXLOG [адрес]', 'последние транзакции адреса'],
    ['PROVIDER [имя]', 'выбрать эксплорер: blockstream|mempool|blockchain'],
    ['EXPLORER', 'открыть адрес в блокчейн-эксплорере'],
    ['COPY', 'скопировать адреса в буфер обмена'],
    ['JOURNAL [инструмент]', 'журнал расследования, свежее сверху'],
    ['RECALL <n>', 'повторить запись n из журнала'],
    ['PURGE [all]', 'очистить журнал (закреплённые остаются, если не "all")'],
    ['STATUS', 'статус оператора и прогресс'],
    ['ABOUT', 'что эта программа делает на самом деле'],
    ['CLEAR', 'очистить экран'],
    ['RESET', 'стереть сохранённый прогресс'],
  ],
};

const ABOUT = {
  en: [
    'BIP-39: NEON TERMINAL — a detective quest played against the real network.',
    '',
    'Everything below the story is genuine:',
    '  * mnemonics are checked against the official BIP-39 English wordlist,',
    '    including the SHA-256 checksum carried by the final word;',
    '  * seeds come from PBKDF2-HMAC-SHA512 with 2048 rounds;',
    '  * keys are derived over secp256k1 through BIP-32 (BIP-44/49/84 paths);',
    '  * balances come from live calls to public block explorers.',
    '',
    'All of it runs in your browser. Nothing you type is sent anywhere except the',
    'address lookups, and those carry only the address.',
    '',
    'The eight case answers are published BIP-39 test vectors. Their wallets are',
    'known to the whole world, hold nothing worth taking, and carry years of real',
    'on-chain history — which is exactly what makes them good exhibits.',
    '',
    'This program cannot crack anyone’s wallet: it derives addresses from phrases',
    'you already know and reads public data. Never type a seed phrase that controls',
    'real funds into any program, this one included.',
  ],
  ru: [
    'BIP-39: NEON TERMINAL — детективный квест, играющий против настоящей сети.',
    '',
    'Всё, что находится под сюжетом, — подлинное:',
    '  * мнемоники проверяются по официальному словарю BIP-39,',
    '    включая контрольную сумму SHA-256 в последнем слове;',
    '  * сид получается через PBKDF2-HMAC-SHA512, 2048 раундов;',
    '  * ключи выводятся на кривой secp256k1 по BIP-32 (пути BIP-44/49/84);',
    '  * балансы приходят живыми запросами к публичным эксплорерам.',
    '',
    'Всё это работает прямо в браузере. Ничего из введённого никуда не уходит,',
    'кроме запроса адреса — а в нём нет ничего, кроме самого адреса.',
    '',
    'Ответы восьми дел — опубликованные тестовые векторы BIP-39. Эти кошельки',
    'известны всему миру, в них нет ничего ценного, зато есть годы настоящей',
    'истории в блокчейне — именно поэтому они и годятся как вещдоки.',
    '',
    'Программа не умеет взламывать чужие кошельки: она считает адреса по уже',
    'известным фразам и читает публичные данные. Никогда не вводи в программы —',
    'включая эту — сид-фразу от кошелька с реальными деньгами.',
  ],
};

const TEXT = {
  noCase: {
    en: 'NO ACTIVE CASE. RUN: CASES, THEN OPEN <id>',
    ru: 'НЕТ АКТИВНОГО ДЕЛА. ВЫПОЛНИ: CASES, ЗАТЕМ OPEN <id>',
  },
  noWallet: {
    en: 'NO SEED LOADED. RUN: DECRYPT <12 words>',
    ru: 'СИД НЕ ЗАГРУЖЕН. ВЫПОЛНИ: DECRYPT <12 слов>',
  },
  locked: {
    en: 'CASE LOCKED. REQUIRED CASES: {req}',
    ru: 'ДЕЛО ЗАБЛОКИРОВАНО. СНАЧАЛА ЗАКРОЙ ДЕЛА: {req}',
  },
  solved: {
    en: 'CASE {id} CLOSED — SEED MATCHES THE STORED FINGERPRINT',
    ru: 'ДЕЛО {id} ЗАКРЫТО — СИД СОВПАЛ С СОХРАНЁННЫМ ОТПЕЧАТКОМ',
  },
  filedWith: { en: 'FILED WITH {client}.', ru: 'СДАНО ЗАКАЗЧИКУ: {client}.' },
  notThisCase: {
    en: 'VALID MNEMONIC, BUT IT IS NOT THE KEY TO CASE {id}.',
    ru: 'МНЕМОНИКА ВАЛИДНА, НО ЭТО НЕ КЛЮЧ К ДЕЛУ {id}.',
  },
  wrongCase: {
    en: 'THIS SEED BELONGS TO CASE {id} ({name}).',
    ru: 'ЭТОТ СИД ОТНОСИТСЯ К ДЕЛУ {id} ({name}).',
  },
  hintsDone: {
    en: 'NO HINTS LEFT ON THIS CASE.',
    ru: 'ПОДСКАЗКИ ПО ЭТОМУ ДЕЛУ ЗАКОНЧИЛИСЬ.',
  },
  allDone: {
    en: 'ALL EIGHT CASES CLOSED. ORACLE’S ARCHIVE IS FULLY RECOVERED.',
    ru: 'ВСЕ ВОСЕМЬ ДЕЛ ЗАКРЫТЫ. АРХИВ ORACLE ВОССТАНОВЛЕН ПОЛНОСТЬЮ.',
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Engine {
  constructor(term, { crt = null, lang = 'ru' } = {}) {
    this.term = term;
    this.crt = crt;
    this.lang = lang;
    this.chain = new ChainClient();
    this.campaign = CAMPAIGN;
    this.active = null;
    this.wallet = null;
    this.progress = new ProgressStore();
    this.journal = new Journal();
  }

  t(key, values = {}) {
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, value),
      TEXT[key][this.lang],
    );
  }

  // -- persistence ---------------------------------------------------------

  isSolved(id) {
    return this.progress.isSolved(id);
  }

  isUnlocked(caseFile) {
    return (caseFile.requires || []).every((req) => this.isSolved(req));
  }

  // -- boot ----------------------------------------------------------------

  async boot() {
    const term = this.term;
    term.locked = true;
    const wordlistOk = WORDLIST_SHA256 === OFFICIAL_WORDLIST_SHA256;
    const lines = [
      `[BOOT] neon-terminal ${this.campaign.meta.version}`,
      '[BOOT] loading BIP-39 english wordlist ... 2048 entries OK',
      `[BOOT] verifying wordlist checksum ... ${wordlistOk ? 'OK' : 'MODIFIED'}`,
      '[BOOT] secp256k1 curve parameters ... LOADED',
      '[BOOT] hd derivation engine (BIP-32/44/49/84) ... ARMED',
      `[BOOT] chain provider: ${this.chain.nodeName}`,
      `[BOOT] operator: ${this.campaign.meta.operator} // client: ${this.campaign.meta.client}`,
    ];
    for (const line of lines) {
      term.print(line, 'dark');
      await sleep(110);
    }
    term.blank();
    term.typeLines(pick(this.campaign.prologue, this.lang), 'white', 260);
    while (term.animating) await sleep(30);
    term.blank();
    term.locked = false;
  }

  // -- command dispatch ----------------------------------------------------

  async run(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [head, ...rest] = trimmed.split(/\s+/);
    const argument = rest.join(' ');
    const handler = this.commands()[head.toUpperCase()];
    if (!handler) {
      this.term.print(`[FATAL] UNKNOWN COMMAND: ${head.toUpperCase()}`, 'red');
      this.term.print('        TYPE HELP FOR THE COMMAND LIST.', 'grey');
      return;
    }
    try {
      await handler.call(this, argument);
    } catch (error) {
      this.term.print(`[FATAL] ${error.message || error}`, 'red');
    }
  }

  commands() {
    return {
      HELP: this.cmdHelp, '?': this.cmdHelp,
      ABOUT: this.cmdAbout,
      LANG: this.cmdLang,
      CASES: this.cmdCases, LS: this.cmdCases,
      CLIENTS: this.cmdClients,
      BOARD: this.cmdBoard,
      OPEN: this.cmdOpen,
      BRIEF: this.cmdBrief,
      EVIDENCE: this.cmdEvidence,
      CLUES: this.cmdClues,
      HINT: this.cmdHint,
      WORD: this.cmdWord,
      INDEX: this.cmdIndex,
      SEARCH: this.cmdSearch,
      ARCHIVE: this.cmdArchive,
      RANDOM: this.cmdRandom, ROLL: this.cmdRandom,
      COMPLETE: this.cmdComplete, FIND: this.cmdComplete,
      ENTROPY: this.cmdEntropy,
      DECRYPT: this.cmdDecrypt,
      DERIVE: this.cmdDerive,
      SYNC_LEDGER: this.cmdSync, SYNC: this.cmdSync,
      SWEEP: this.cmdSweep,
      TXLOG: this.cmdTxlog,
      PROVIDER: this.cmdProvider,
      EXPLORER: this.cmdExplorer,
      COPY: this.cmdCopy,
      JOURNAL: this.cmdJournal, LOG: this.cmdJournal,
      RECALL: this.cmdRecall,
      PURGE: this.cmdPurge,
      STATUS: this.cmdStatus,
      CLEAR: this.cmdClear,
      RESET: this.cmdReset,
      EXIT: this.cmdExit, QUIT: this.cmdExit,
    };
  }

  // -- informational commands ---------------------------------------------

  cmdHelp() {
    this.term.blank();
    for (const [command, description] of HELP[this.lang]) {
      this.term.print([
        { text: `  ${command.padEnd(26)}`, style: 'green' },
        { text: description, style: 'grey' },
      ]);
    }
    this.term.blank();
  }

  cmdAbout() {
    this.term.blank().printLines(ABOUT[this.lang], 'grey').blank();
  }

  cmdLang(argument) {
    const choice = argument.trim().toLowerCase();
    if (choice !== 'ru' && choice !== 'en') {
      this.term.print('[WARN] USAGE: LANG RU | LANG EN', 'amber');
      return;
    }
    this.lang = choice;
    this.term.print(`[ OK ] NARRATIVE LANGUAGE: ${choice.toUpperCase()}`, 'green');
  }

  cmdCases() {
    const term = this.term;
    term.blank();
    term.print('  CASE FILES // ORACLE ARCHIVE', 'cyan');
    term.rule();
    for (const caseFile of this.campaign.cases) {
      let mark = '[  OPEN]';
      let style = 'green';
      if (this.isSolved(caseFile.id)) { mark = '[CLOSED]'; style = 'dark'; }
      else if (!this.isUnlocked(caseFile)) { mark = '[LOCKED]'; style = 'grey'; }
      const pointer = this.active && this.active.id === caseFile.id ? '>' : ' ';
      const name = pick(caseFile.codename, this.lang).padEnd(22);
      term.print(
        ` ${pointer} ${mark} ${String(caseFile.id).padStart(2, '0')}  ${name} ${'*'.repeat(caseFile.difficulty)}`,
        style,
      );
    }
    term.rule();
    term.print(`  ${this.progress.solved.length}/${this.campaign.cases.length} CLOSED`, 'amber');
    term.blank();
  }

  async cmdClients() {
    await loadContracts();
    const term = this.term;
    term.blank();
    term.print('  CONTRACT BOARD // EIGHT EMPLOYERS', 'cyan');
    term.rule();
    for (const client of CLIENTS) {
      const cases = casesForClient(client.slug);
      const solved = cases.filter((entry) => this.progress.isSolved(entry.id)).length;
      term.print([
        { text: `  ${String(client.order).padStart(2, '0')} `, style: 'dark' },
        { text: pick(client.name, this.lang).padEnd(20), style: 'magenta' },
        { text: `${String(solved).padStart(2)}/${cases.length} `, style: solved ? 'green' : 'grey' },
        { text: pick(client.kind, this.lang), style: 'grey' },
      ]);
      term.print(`     ${client.slug} · ${pick(client.district, this.lang)}`, 'dark');
    }
    term.rule();
    term.print('  BOARD <client> TO OPEN ONE', 'grey');
    term.blank();
  }

  async cmdBoard(argument) {
    const slug = argument.trim().toLowerCase();
    if (!slug) {
      this.term.print('[WARN] USAGE: BOARD <client>  (see CLIENTS)', 'amber');
      return;
    }
    await loadContracts();
    const client = clientBySlug(slug);
    if (!client) {
      this.term.print(`[FATAL] NO CLIENT '${slug.toUpperCase()}'. RUN CLIENTS.`, 'red');
      return;
    }
    if (!contractsLoaded()) {
      this.term.print('[FATAL] CONTRACT BOARD UNAVAILABLE.', 'red');
      return;
    }
    const term = this.term;
    term.blank();
    term.print(`  ${pick(client.name, this.lang)} // ${pick(client.district, this.lang)}`, 'magenta');
    term.printLines(pick(client.creed, this.lang), 'white');
    term.blank();
    term.print(`  ${pick(client.dialect, this.lang)}`, 'cyan');
    term.rule();
    for (const caseFile of casesForClient(slug)) {
      const solved = this.progress.isSolved(caseFile.id);
      const locked = (caseFile.requires || []).some((req) => !this.progress.isSolved(req));
      const mark = solved ? '[CLOSED]' : locked ? '[LOCKED]' : '[  OPEN]';
      term.print(
        `  ${mark} ${String(caseFile.id).padStart(3, '0')}  `
        + `${pick(caseFile.codename, this.lang).padEnd(24)} `
        + `${'*'.repeat(caseFile.difficulty).padEnd(5)} ${caseFile.archetype}`,
        solved ? 'dark' : locked ? 'grey' : 'green',
      );
    }
    term.rule();
    term.blank();
  }

  showCase(caseFile) {
    const term = this.term;
    term.blank();
    term.print(`  CASE ${String(caseFile.id).padStart(2, '0')} // ${pick(caseFile.codename, this.lang)}`, 'magenta');
    term.rule('=');
    term.typeLines(pick(caseFile.brief, this.lang), 'white', 320);
    term.blank();
    term.printLines(pick(caseFile.evidence, this.lang), 'grey');
    term.blank();
    term.print('  DECODING TABLE:', 'cyan');
    term.printLines(pick(caseFile.clues, this.lang), 'green');
    term.rule('=');
    term.blank();
  }

  cmdOpen(argument) {
    const id = parseInt(argument.trim(), 10);
    const caseFile = this.campaign.cases.find((c) => c.id === id);
    if (!caseFile) {
      this.term.print(`[FATAL] CASE ${argument.trim() || '?'} NOT FOUND IN ARCHIVE.`, 'red');
      return;
    }
    if (!this.isUnlocked(caseFile)) {
      const missing = (caseFile.requires || []).filter((r) => !this.isSolved(r)).join(', ');
      this.term.print(`[FATAL] ${this.t('locked', { req: missing })}`, 'red');
      return;
    }
    this.active = caseFile;
    this.showCase(caseFile);
  }

  requireCase() {
    if (!this.active) {
      this.term.print(`[WARN] ${this.t('noCase')}`, 'amber');
      return null;
    }
    return this.active;
  }

  cmdBrief() {
    const caseFile = this.requireCase();
    if (caseFile) this.term.printLines(pick(caseFile.brief, this.lang), 'white');
  }

  cmdEvidence() {
    const caseFile = this.requireCase();
    if (caseFile) this.term.printLines(pick(caseFile.evidence, this.lang), 'grey');
  }

  cmdClues() {
    const caseFile = this.requireCase();
    if (caseFile) this.term.printLines(pick(caseFile.clues, this.lang), 'green');
  }

  cmdHint() {
    const caseFile = this.requireCase();
    if (!caseFile) return;
    const hints = pick(caseFile.hints, this.lang);
    const used = this.progress.hintsUsed(caseFile.id);
    if (used >= hints.length) {
      this.term.print(`[WARN] ${this.t('hintsDone')}`, 'amber');
      return;
    }
    this.progress.useHint(caseFile.id);
    this.log('hint', `${pick(caseFile.codename, this.lang)} — hint ${used + 1}/${hints.length}`, {
      detail: hints[used],
      payload: { caseId: caseFile.id },
    });
    this.term.print(`[HINT ${used + 1}/${hints.length}] ${hints[used]}`, 'amber');
  }

  // -- wordlist tools ------------------------------------------------------

  cmdWord(argument) {
    const position = parseInt(argument.trim(), 10);
    if (!Number.isInteger(position)) {
      this.term.print('[WARN] USAGE: WORD <1..2048>', 'amber');
      return;
    }
    try {
      this.term.keyValue(`WORD ${String(position).padStart(4, '0')}`, wordAt(position));
    } catch (error) {
      this.term.print(`[FATAL] ${error.message.toUpperCase()}`, 'red');
    }
  }

  cmdIndex(argument) {
    const word = argument.trim().toLowerCase();
    if (!word) {
      this.term.print('[WARN] USAGE: INDEX <word>', 'amber');
      return;
    }
    try {
      this.term.keyValue(`INDEX OF ${word}`, String(indexOf(word)).padStart(4, '0'));
    } catch {
      this.term.print(`[FATAL] '${word.toUpperCase()}' IS NOT IN THE BIP-39 DICTIONARY.`, 'red');
    }
  }

  cmdSearch(argument) {
    const prefix = argument.trim().toLowerCase();
    if (!prefix) {
      this.term.print('[WARN] USAGE: SEARCH <prefix>', 'amber');
      return;
    }
    const hits = searchWords(prefix);
    if (!hits.length) {
      this.term.print(`[WARN] NO WORDLIST ENTRY STARTS WITH '${prefix.toUpperCase()}'.`, 'amber');
      return;
    }
    this.log('search', prefix, {
      detail: `${hits.length} match(es)`,
      payload: { query: prefix },
    });
    for (let i = 0; i < hits.length; i += 4) {
      this.term.print(
        '  ' + hits.slice(i, i + 4)
          .map(([index, word]) => `${String(index).padStart(5)}  ${word.padEnd(14)}`)
          .join(''),
        'green',
      );
    }
    this.term.print(`  ${hits.length} MATCH(ES)`, 'grey');
  }

  cmdArchive(argument) {
    const query = argument.trim();
    if (!query) {
      this.term.print('[WARN] USAGE: ARCHIVE <text>', 'amber');
      return;
    }
    const results = searchCases(query, this.lang, this.progress);
    if (!results.length) {
      this.term.print(`[WARN] NOTHING IN THE ARCHIVE MATCHES '${query.toUpperCase()}'.`, 'amber');
      return;
    }
    this.term.blank();
    for (const result of results) {
      this.term.print(
        `  CASE ${String(result.case.id).padStart(2, '0')} // ${pick(result.case.codename, this.lang)}`,
        'magenta',
      );
      for (const hit of result.hits.slice(0, 4)) {
        this.term.print(`      ${hit.line.trim()}`, 'grey');
      }
    }
    this.log('archive', query, {
      detail: `${results.length} case(s)`,
      payload: { query },
    });
    this.term.print(`  ${results.length} CASE(S) MATCHED`, 'grey');
    this.term.blank();
  }

  async cmdRandom(argument) {
    const count = argument.trim() ? parseInt(argument.trim(), 10) : 12;
    let generated;
    try {
      generated = randomMnemonic(count);
    } catch (error) {
      this.term.print(`[FATAL] ${error.message}`, 'red');
      return;
    }
    const { mnemonic, entropy } = generated;
    this.term.blank();
    this.term.print('[RNG] DRAWING FROM crypto.getRandomValues...', 'cyan');
    this.term.keyValue('ENTROPY', toHex(entropy), 'grey', 'cyan');
    this.term.keyValue('BITS', String(entropy.length * 8), 'grey', 'cyan');
    this.term.type(`${'MNEMONIC'.padEnd(18)}: ${mnemonic}`, 'green', 90);
    this.term.blank();
    this.term.print(
      this.lang === 'ru'
        ? '[WARN] ЭТО НАСТОЯЩИЙ КОШЕЛЁК. НЕ КЛАДИ НА НЕГО ДЕНЬГИ — ФРАЗА НИГДЕ НЕ СОХРАНЯЕТСЯ.'
        : '[WARN] THIS IS A REAL WALLET. DO NOT FUND IT — THE PHRASE IS STORED NOWHERE.',
      'amber',
    );
    this.log('random', `${entropy.length * 8}-bit phrase`, {
      detail: mnemonic,
      payload: { mnemonic },
    });
    this.term.print(`[INFO] RUN: DECRYPT ${mnemonic}`, 'cyan');
  }

  async cmdComplete(argument) {
    const phrase = argument.trim();
    if (!phrase) {
      this.term.print('[WARN] USAGE: COMPLETE <phrase with ? in place of the missing word>', 'amber');
      return;
    }
    this.term.blank();
    let found;
    try {
      found = await this.withLogs(
        ['[~] enumerating candidate words...', '[~] verifying sha256 checksums...'],
        () => completeMnemonic(phrase),
      );
    } catch (error) {
      this.term.print(`[FATAL] ${error.message}`, 'red');
      return;
    }
    const { position, candidates } = found;
    this.term.print(
      `[ OK ] POSITION ${position + 1}: ${candidates.length} WORD(S) SATISFY THE CHECKSUM.`,
      'green',
    );
    for (let i = 0; i < candidates.length; i += 6) {
      this.term.print('  ' + candidates.slice(i, i + 6)
        .map((candidate) => candidate.word.padEnd(12)).join(''), 'green');
    }
    const hit = candidates.find((candidate) => candidate.case);
    if (hit) {
      this.term.print(
        `[HIT ] '${hit.word}' COMPLETES THE KEY TO CASE ${hit.case.id}.`,
        'magenta',
      );
    }
    this.log('complete', `? @ ${position + 1}`, {
      status: hit ? 'ok' : 'info',
      detail: hit
        ? `${candidates.length} candidates · ${hit.word} -> case ${hit.case.id}`
        : `${candidates.length} candidates`,
      payload: { pattern: phrase },
    });
    this.term.blank();
  }

  cmdEntropy(argument) {
    const raw = argument.trim().toLowerCase().replace(/^0x/, '').replace(/\s+/g, '');
    if (!raw) {
      this.term.print('[WARN] USAGE: ENTROPY <hex> (32 hex chars = 128 bits = 12 words)', 'amber');
      return;
    }
    let entropy;
    try {
      entropy = fromHex(raw);
    } catch {
      this.term.print('[FATAL] ENTROPY MUST BE HEXADECIMAL.', 'red');
      return;
    }
    let mnemonic;
    try {
      mnemonic = entropyToMnemonic(entropy);
    } catch (error) {
      this.term.print(`[FATAL] ${error.message}`, 'red');
      return;
    }
    this.term.blank();
    this.term.keyValue('ENTROPY', toHex(entropy), 'grey', 'cyan');
    this.term.keyValue('BITS', String(entropy.length * 8), 'grey', 'cyan');
    this.term.type(`${'MNEMONIC'.padEnd(18)}: ${mnemonic}`, 'green', 90);
    this.term.blank();
    this.term.print(`[INFO] RUN: DECRYPT ${mnemonic}`, 'cyan');
  }

  // -- the crypto core -----------------------------------------------------

  /** Show pseudo-logs while `work` runs, exactly as long as it really takes. */
  async withLogs(logs, work) {
    const term = this.term;
    term.busy = true;
    let index = 0;
    let done = false;
    const promise = (async () => {
      // Yield once so the first frame paints before the heavy synchronous work.
      await sleep(0);
      return work();
    })().finally(() => { done = true; });

    const ticker = (async () => {
      while (!done && index < logs.length) {
        term.print(logs[index++], 'dark');
        await sleep(120 + Math.random() * 90);
      }
    })();

    try {
      const result = await promise;
      await ticker;
      // Any log lines the work outran still belong on screen.
      while (index < logs.length) term.print(logs[index++], 'dark');
      return result;
    } finally {
      term.busy = false;
    }
  }

  printDerivation(wallet) {
    const term = this.term;
    term.rule('=');
    term.keyValue('BIP39 SEED', `${wallet.seed.slice(0, 64)}...`, 'grey', 'dim');
    term.keyValue('MASTER XPRV', wallet.masterXprv, 'grey', 'dim');
    term.rule('-');
    for (const entry of wallet.addresses) {
      term.print([
        { text: `PATH ${entry.path} (${entry.label})`.padEnd(44) + ': ', style: 'grey' },
        { text: entry.address, style: 'green' },
      ]);
    }
    term.rule('-');
    for (const entry of wallet.addresses) {
      term.keyValue(`PUBKEY m/${entry.purpose}'`, entry.publicKey, 'grey', 'dim');
    }
    term.rule('=');
    term.print('[STATUS] DERIVATION COMPLETE. RUN SYNC_LEDGER TO QUERY THE CHAIN.', 'cyan');
  }

  async cmdDecrypt(argument) {
    const phrase = argument.trim();
    if (!phrase) {
      this.term.print('[WARN] USAGE: DECRYPT <12 words>', 'amber');
      return;
    }
    this.term.blank();
    let wallet;
    try {
      wallet = await this.withLogs(DECRYPT_LOGS, () => deriveWallet(phrase));
    } catch (error) {
      if (error instanceof MnemonicError) {
        this.term.print(`[FATAL] ${error.message}`, 'red');
        if (error.kind === 'checksum') {
          this.term.print(
            '        THE LAST WORD CARRIES THE CHECKSUM. ONE WRONG WORD BREAKS IT.',
            'red',
          );
        }
        return;
      }
      throw error;
    }

    this.wallet = wallet;
    this.term.print('[ OK ] MNEMONIC CHECKSUM VALID.', 'green');
    this.printDerivation(wallet);

    const owner = caseForMnemonic(wallet.mnemonic);
    this.recordDecrypt(wallet, owner);
    if (this.active && owner && owner.id === this.active.id) {
      this.closeCase(this.active);
    } else if (owner && !this.isSolved(owner.id)) {
      if (this.isUnlocked(owner)) {
        this.active = owner;
        this.closeCase(owner);
      } else {
        this.term.print(
          `[WARN] ${this.t('wrongCase', { id: owner.id, name: pick(owner.codename, this.lang) })}`,
          'amber',
        );
      }
    } else if (this.active) {
      this.term.print(`[WARN] ${this.t('notThisCase', { id: this.active.id })}`, 'amber');
    }
  }

  closeCase(caseFile) {
    const firstTime = this.progress.markSolved(caseFile.id);
    if (firstTime) {
      this.log('case', `Case ${caseFile.id} — ${pick(caseFile.codename, this.lang)}`, {
        status: 'ok',
        payload: { caseId: caseFile.id },
      });
    }
    const term = this.term;
    term.blank();
    term.print(`  ${this.t('solved', { id: caseFile.id })}`, 'magenta');
    const client = caseFile.client ? clientBySlug(caseFile.client) : null;
    if (client) {
      term.print(`  ${this.t('filedWith', { client: pick(client.name, this.lang) })}`, 'cyan');
    }
    term.rule('=');
    const epilogue = pick(caseFile.epilogue, this.lang);
    if (firstTime) term.typeLines(epilogue, 'white', 320);
    else term.printLines(epilogue, 'white');
    term.rule('=');
    if (this.progress.solved.length === this.campaign.cases.length) {
      term.blank();
      term.print(`  ${this.t('allDone')}`, 'amber');
    }
    term.blank();
  }

  cmdDerive() {
    if (!this.wallet) {
      this.term.print(`[WARN] ${this.t('noWallet')}`, 'amber');
      return;
    }
    this.printDerivation(this.wallet);
  }

  targetAddress(argument) {
    if (argument.trim()) return argument.trim();
    if (this.wallet) return this.wallet.primary.address;
    this.term.print(`[WARN] ${this.t('noWallet')}`, 'amber');
    return null;
  }

  // -- live network --------------------------------------------------------

  async cmdSync(argument) {
    const address = this.targetAddress(argument);
    if (!address) return;
    const term = this.term;
    term.blank();
    term.print(`[NET] ESTABLISHING ENCRYPTED PROXY TO ${this.chain.nodeName} NODE... OK`, 'cyan');
    term.print(`[NET] QUERYING ADDR: ${address}`, 'cyan');

    let stats;
    try {
      stats = await this.withLogs(NET_LOGS, () => this.chain.addressStats(address));
    } catch (error) {
      term.print('[FATAL] NETWORK LINK DOWN. NO EXPLORER ANSWERED.', 'red');
      term.print(`        ${error.message}`, 'red');
      return;
    }

    this.log('ledger', address, {
      status: stats.confirmedSats > 0n ? 'warn' : 'info',
      detail: `${formatBtc(stats.confirmedSats)} BTC · ${stats.txCount} tx · ${stats.provider}`,
      payload: { address },
    });
    term.print('[NET] PARSING DATA STREAMS... SUCCESS', 'cyan');
    term.rule('-');
    term.print('ADDRESS BALANCE ANALYSIS:', 'white');
    term.keyValue('CONFIRMED BALANCE', `${formatBtc(stats.confirmedSats)} BTC`);
    term.keyValue('UNCONFIRMED TXs', `${formatBtc(stats.unconfirmedSats)} BTC`);
    term.keyValue('TOTAL RECEIVED', `${formatBtc(stats.totalReceivedSats)} BTC`);
    term.keyValue('TOTAL SENT', `${formatBtc(stats.totalSentSats)} BTC`);
    term.keyValue('TX COUNT', String(stats.txCount));
    term.keyValue('UTXO COUNT', String(stats.utxoCount));
    term.keyValue('SOURCE NODE', stats.provider, 'grey', 'dim');
    term.rule('-');
    if (stats.confirmedSats > 0n) {
      term.print('[STATUS] ACCESS KEY REQUIRED FOR WITHDRAWAL.', 'amber');
    } else if (stats.txCount > 0) {
      term.print('[STATUS] WALLET DRAINED. HISTORY INTACT — RUN TXLOG.', 'amber');
    } else {
      term.print('[STATUS] ADDRESS NEVER USED ON MAINNET.', 'grey');
    }
    term.blank();
  }

  /** Query every derived path — history often sits on one branch only. */
  async cmdSweep() {
    if (!this.wallet) {
      this.term.print(`[WARN] ${this.t('noWallet')}`, 'amber');
      return;
    }
    const term = this.term;
    term.blank();
    term.print('[NET] SWEEPING DERIVATION GRID ACROSS THE LIVE CHAIN...', 'cyan');

    const rows = await this.withLogs(NET_LOGS, async () => {
      const results = [];
      for (const entry of this.wallet.addresses) {
        try {
          results.push({ entry, stats: await this.chain.addressStats(entry.address) });
        } catch (error) {
          results.push({ entry, error });
        }
      }
      return results;
    });

    term.rule('-');
    term.print(
      `${'PATH'.padEnd(16)}${'ADDRESS'.padEnd(46)}${'TX'.padStart(5)}  ${'RECEIVED'.padStart(16)}`,
      'grey',
    );
    let touched = 0;
    for (const row of rows) {
      const path = `m/${row.entry.purpose}'`.padEnd(16);
      if (row.error) {
        term.print(`${path}${row.entry.address.padEnd(46)}  UNREACHABLE`, 'red');
        continue;
      }
      const used = row.stats.txCount > 0 || row.stats.totalReceivedSats > 0n;
      if (used) touched += 1;
      term.print(
        path + row.entry.address.padEnd(46)
        + String(row.stats.txCount).padStart(5) + '  '
        + formatBtc(row.stats.totalReceivedSats).padStart(16),
        used ? 'green' : 'dark',
      );
    }
    term.rule('-');
    this.log('sweep', this.wallet.primary.address, {
      status: touched ? 'ok' : 'info',
      detail: `${touched}/3 paths carry history`,
      payload: { address: this.wallet.primary.address },
    });
    term.print(
      touched
        ? `[STATUS] ${touched}/3 PATHS CARRY ON-CHAIN HISTORY.`
        : '[STATUS] NO PATH OF THIS SEED HAS EVER BEEN USED.',
      touched ? 'amber' : 'grey',
    );
    term.blank();
  }

  async cmdTxlog(argument) {
    const address = this.targetAddress(argument);
    if (!address) return;
    const term = this.term;
    term.blank();
    term.print(`[NET] FETCHING TRANSACTION HISTORY: ${address}`, 'cyan');
    let txs;
    try {
      txs = await this.withLogs(NET_LOGS.slice(0, 3), () => this.chain.transactions(address, 8));
    } catch (error) {
      term.print('[FATAL] TX HISTORY UNAVAILABLE.', 'red');
      term.print(`        ${error.message}`, 'red');
      return;
    }
    if (!txs.length) {
      term.print('[WARN] NO TRANSACTIONS RECORDED FOR THIS ADDRESS.', 'amber');
      return;
    }
    term.rule('-');
    for (const tx of txs) {
      const height = tx.blockHeight ? String(tx.blockHeight) : 'MEMPOOL';
      term.print(
        `  ${tx.confirmed ? 'CONFIRMED' : 'PENDING  '}  BLOCK ${height.padStart(9)}  ${tx.txid}`,
        'green',
      );
    }
    term.rule('-');
    this.log('txlog', address, {
      detail: `${txs.length} transaction(s)`,
      payload: { address },
    });
    term.print(`  ${txs.length} MOST RECENT TX(s)`, 'grey');
    term.blank();
  }

  cmdProvider(argument) {
    const name = argument.trim().toLowerCase();
    if (!name) {
      const current = this.chain.order[0];
      for (const [key, provider] of Object.entries(PROVIDERS)) {
        this.term.print(` ${key === current ? '>' : ' '} ${key.padEnd(12)} ${provider.base}`, 'green');
      }
      return;
    }
    if (!PROVIDERS[name]) {
      this.term.print(`[FATAL] UNKNOWN PROVIDER. TRY: ${Object.keys(PROVIDERS).join(', ')}`, 'red');
      return;
    }
    this.chain.preferred = name;
    this.term.print(`[ OK ] PRIMARY NODE: ${PROVIDERS[name].name}`, 'green');
  }

  cmdExplorer(argument) {
    const address = this.targetAddress(argument);
    if (!address) return;
    const url = this.chain.explorerUrl(address);
    this.term.keyValue('EXPLORER', url, 'grey', 'cyan');
    window.open(url, '_blank', 'noopener');
  }

  async cmdCopy() {
    if (!this.wallet) {
      this.term.print(`[WARN] ${this.t('noWallet')}`, 'amber');
      return;
    }
    const payload = this.wallet.addresses
      .map((entry) => `${entry.path}  ${entry.address}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      this.term.print('[ OK ] ADDRESSES COPIED TO CLIPBOARD.', 'green');
    } catch {
      this.term.print('[WARN] CLIPBOARD BLOCKED BY THE BROWSER.', 'amber');
    }
  }

  cmdStatus() {
    const term = this.term;
    term.blank();
    term.keyValue('OPERATOR', this.campaign.meta.operator);
    term.keyValue('CLIENT', this.campaign.meta.client);
    term.keyValue('BUILD', `${this.campaign.meta.version} (web)`);
    term.keyValue('LANGUAGE', this.lang.toUpperCase());
    term.keyValue('PRIMARY NODE', this.chain.nodeName);
    term.keyValue('MODE', 'LIVE NET');
    term.keyValue(
      'WORDLIST',
      WORDLIST_SHA256 === OFFICIAL_WORDLIST_SHA256 ? 'AUTHENTIC' : 'MODIFIED',
    );
    term.keyValue('CASES CLOSED', `${this.progress.solved.length}/${this.campaign.cases.length}`);
    term.keyValue(
      'ACTIVE CASE',
      this.active
        ? `${String(this.active.id).padStart(2, '0')} ${pick(this.active.codename, this.lang)}`
        : 'NONE',
    );
    if (this.wallet) {
      term.keyValue('LOADED ADDRESS', this.wallet.primary.address);
      try {
        term.keyValue('SEED ENTROPY', toHex(mnemonicToEntropy(this.wallet.mnemonic)), 'grey', 'dim');
      } catch { /* validated on load, so this cannot normally fail */ }
    }
    term.blank();
  }

  cmdClear() {
    this.term.clear();
  }

  cmdReset() {
    this.progress.reset();
    this.active = null;
    this.wallet = null;
    this.term.print('[ OK ] PROGRESS ERASED. ARCHIVE SEALED AGAIN.', 'green');
  }

  cmdExit() {
    this.term.print('[SYS] THIS TERMINAL HAS NO EXIT. CLOSE THE TAB, DETECTIVE.', 'dark');
  }
}

export { normalize, ChainError };
