// The GUI front-end. Retro chrome, modern layout — and the same game core the
// command line drives, so progress and rules are shared between the two modes.

import { el, replace, win, section, notice, badge, kv, table, empty } from './dom.js';
import {
  CASES, META, ProgressStore, caseById, caseForMnemonic, caseState,
  completeMnemonic, isUnlocked, missingRequirements, pick, randomMnemonic,
  searchCases, searchWordlist, MnemonicError,
} from '../core.js';
import { deriveWallet } from '../crypto/wallet.js';
import { entropyToMnemonic, mnemonicToEntropy, wordAt, indexOf } from '../crypto/bip39.js';
import { fromHex, toHex } from '../crypto/hash.js';
import { ChainClient, formatBtc, PROVIDERS } from '../chain.js';

const PANELS = [
  { id: 'cases', label: { en: 'Case files', ru: 'Дела' }, key: '1' },
  { id: 'decrypt', label: { en: 'Decrypt', ru: 'Дешифровка' }, key: '2' },
  { id: 'ledger', label: { en: 'Ledger', ru: 'Реестр' }, key: '3' },
  { id: 'search', label: { en: 'Search', ru: 'Поиск' }, key: '4' },
  { id: 'random', label: { en: 'Randomizer', ru: 'Рандомайзер' }, key: '5' },
  { id: 'about', label: { en: 'About', ru: 'О программе' }, key: '6' },
];

const T = {
  solved: { en: 'Closed', ru: 'Закрыто' },
  open: { en: 'Open', ru: 'Открыто' },
  locked: { en: 'Locked', ru: 'Заперто' },
  closedCount: { en: 'closed', ru: 'закрыто' },
  brief: { en: 'Brief', ru: 'Вводная' },
  evidence: { en: 'Evidence', ru: 'Улики' },
  clues: { en: 'Decoding table', ru: 'Таблица дешифровки' },
  hints: { en: 'Hints', ru: 'Подсказки' },
  spendHint: { en: 'Spend a hint', ru: 'Взять подсказку' },
  noHints: { en: 'No hints left on this case.', ru: 'Подсказки по этому делу закончились.' },
  submit: { en: 'Submit seed phrase', ru: 'Проверить сид-фразу' },
  derive: { en: 'Derive', ru: 'Вывести адреса' },
  epilogue: { en: 'Epilogue', ru: 'Эпилог' },
  lockedMsg: { en: 'Close these cases first:', ru: 'Сначала закрой дела:' },
  seedLabel: { en: 'Seed phrase (12 words)', ru: 'Сид-фраза (12 слов)' },
  checksumOk: { en: 'Mnemonic checksum valid', ru: 'Контрольная сумма верна' },
  derivation: { en: 'Derivation grid', ru: 'Сетка деривации' },
  noWallet: {
    en: 'No seed loaded yet. Derive one in the Decrypt panel first.',
    ru: 'Сид не загружен. Сначала выведи адреса на вкладке «Дешифровка».',
  },
  syncOne: { en: 'Query balance', ru: 'Запросить баланс' },
  sweep: { en: 'Sweep all paths', ru: 'Проверить все пути' },
  txlog: { en: 'Transactions', ru: 'Транзакции' },
  working: { en: 'Querying the live chain…', ru: 'Запрос к живой сети…' },
  deriving: { en: 'Deriving keys…', ru: 'Вывожу ключи…' },
  searching: { en: 'Searching…', ru: 'Ищу…' },
  generate: { en: 'Generate', ru: 'Сгенерировать' },
  words: { en: 'Words', ru: 'Слов' },
  copy: { en: 'Copy', ru: 'Копировать' },
  copied: { en: 'Copied', ru: 'Скопировано' },
};

const t = (key, lang) => T[key][lang] || T[key].en;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class GuiApp {
  constructor(root, { lang = 'ru', onLangChange = null } = {}) {
    this.root = root;
    this.lang = lang;
    this.onLangChange = onLangChange;
    this.progress = new ProgressStore();
    this.chain = new ChainClient();
    this.panel = 'cases';
    this.activeCaseId = null;
    this.wallet = null;
    this.searchTab = 'words';
    this.mounted = false;
  }

  setLang(lang) {
    this.lang = lang;
    if (this.mounted) this.render();
  }

  /** Called when the CL mode may have changed shared state. */
  syncFromStorage() {
    this.progress.refresh();
    if (this.mounted) this.render();
  }

  mount() {
    this.nav = el('nav', { class: 'win__body' });
    this.content = el('div', { class: 'win__body' });
    this.navWindow = win('Archive', this.nav);
    this.contentWindow = win('—', this.content);
    replace(this.root, this.navWindow, this.contentWindow);
    this.mounted = true;
    this.render();
  }

  go(panel, caseId = null) {
    this.panel = panel;
    if (caseId !== null) this.activeCaseId = caseId;
    this.render();
    this.content.scrollTop = 0;
  }

  render() {
    this.renderNav();
    const titleBar = this.contentWindow.querySelector('.win__title');
    const panel = PANELS.find((p) => p.id === this.panel);
    titleBar.textContent = pick(panel.label, this.lang);
    const renderer = {
      cases: () => this.renderCases(),
      decrypt: () => this.renderDecrypt(),
      ledger: () => this.renderLedger(),
      search: () => this.renderSearch(),
      random: () => this.renderRandom(),
      about: () => this.renderAbout(),
    }[this.panel];
    replace(this.content, ...renderer());
  }

  // ---- sidebar ----------------------------------------------------------

  renderNav() {
    const solved = this.progress.solved.length;
    const percent = Math.round((solved / CASES.length) * 100);
    replace(this.nav,
      el('ul', { class: 'nav__list' },
        ...PANELS.map((panel) =>
          el('li', {},
            el('button', {
              class: 'nav__item',
              type: 'button',
              'aria-current': this.panel === panel.id ? 'true' : 'false',
              onClick: () => this.go(panel.id),
            },
            el('span', { text: pick(panel.label, this.lang) }),
            el('span', { class: 'nav__key', text: panel.key }))))),
      el('div', { class: 'nav__sep' }),
      el('div', { class: 'nav__meter' },
        el('div', { text: `${solved}/${CASES.length} ${t('closedCount', this.lang)}` }),
        el('div', { class: 'nav__bar' }, el('span', { style: `width:${percent}%` }))),
      el('div', { class: 'nav__sep' }),
      el('div', { class: 'nav__meter' },
        el('div', { text: `OPERATOR ${META.operator}` }),
        el('div', { text: `NODE ${this.chain.nodeName}` })),
      el('div', { class: 'row row--tight', style: 'margin-top:10px;padding:0 9px' },
        ...['ru', 'en'].map((code) =>
          el('button', {
            class: 'btn',
            type: 'button',
            'aria-pressed': this.lang === code ? 'true' : 'false',
            onClick: () => {
              this.setLang(code);
              if (this.onLangChange) this.onLangChange(code);
            },
            text: code.toUpperCase(),
          }))));
  }

  // ---- cases ------------------------------------------------------------

  renderCases() {
    if (this.activeCaseId !== null) return this.renderCaseDetail(caseById(this.activeCaseId));
    const rows = CASES.map((caseFile) => {
      const state = caseState(caseFile, this.progress);
      return el('div', { class: 'card' },
        el('button', {
          class: 'card__row',
          type: 'button',
          disabled: state === 'locked',
          onClick: () => state !== 'locked' && this.go('cases', caseFile.id),
        },
        el('span', { class: 'card__id', text: String(caseFile.id).padStart(2, '0') }),
        el('span', { class: 'card__name', text: pick(caseFile.codename, this.lang) }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
        badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
          t(state, this.lang))));
    });
    return [
      section('ORACLE ARCHIVE',
        `${this.progress.solved.length}/${CASES.length}`),
      ...rows,
    ];
  }

  renderCaseDetail(caseFile) {
    const lang = this.lang;
    const state = caseState(caseFile, this.progress);
    const hints = pick(caseFile.hints, lang);
    const used = this.progress.hintsUsed(caseFile.id);

    const back = el('button', {
      class: 'btn', type: 'button', text: '← ' + (lang === 'ru' ? 'К списку' : 'All cases'),
      onClick: () => { this.activeCaseId = null; this.render(); },
    });

    const nodes = [
      el('div', { class: 'row', style: 'margin-bottom:12px' }, back,
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
        badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
          t(state, lang))),
      section(`${String(caseFile.id).padStart(2, '0')} · ${pick(caseFile.codename, lang)}`),
    ];

    if (state === 'locked') {
      nodes.push(notice('warn', t('lockedMsg', lang),
        missingRequirements(caseFile, this.progress).join(', ')));
      return nodes;
    }

    nodes.push(el('div', { class: 'prose' },
      ...pick(caseFile.brief, lang).map((line) => el('p', { text: line }))));
    nodes.push(section(t('evidence', lang)));
    nodes.push(el('div', { class: 'evidence', text: pick(caseFile.evidence, lang).join('\n') }));
    nodes.push(section(t('clues', lang)));
    nodes.push(el('div', { class: 'clues', text: pick(caseFile.clues, lang).join('\n') }));

    // Hints, revealed one at a time and remembered across modes.
    nodes.push(section(t('hints', lang), `${used}/${hints.length}`));
    const hintBox = el('div', { class: 'stack' });
    const paintHints = () => {
      const shown = this.progress.hintsUsed(caseFile.id);
      replace(hintBox,
        ...hints.slice(0, shown).map((hint, i) =>
          notice('info', `${i + 1}/${hints.length}`, hint)),
        shown < hints.length
          ? el('button', {
            class: 'btn', type: 'button', text: t('spendHint', lang),
            onClick: () => { this.progress.useHint(caseFile.id); paintHints(); this.renderNav(); },
          })
          : el('p', { class: 'hint-text', text: t('noHints', lang) }));
    };
    paintHints();
    nodes.push(hintBox);

    // Answer box
    nodes.push(section(t('submit', lang)));
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'двенадцать слов через пробел' : 'twelve words separated by spaces',
    });
    const result = el('div', {});
    const submit = el('button', {
      class: 'btn btn--primary', type: 'button', text: t('derive', lang),
      onClick: async () => {
        submit.disabled = true;
        replace(result, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
        await sleep(16);
        try {
          const wallet = deriveWallet(input.value);
          this.wallet = wallet;
          const owner = caseForMnemonic(wallet.mnemonic);
          const nodesOut = [notice('ok', t('checksumOk', lang), wallet.primary.address)];
          if (owner && owner.id === caseFile.id) {
            const first = this.progress.markSolved(caseFile.id);
            this.renderNav();
            nodesOut.push(notice('ok',
              lang === 'ru' ? `Дело ${caseFile.id} закрыто` : `Case ${caseFile.id} closed`,
              ...pick(caseFile.epilogue, lang)));
            if (first && this.progress.solved.length === CASES.length) {
              nodesOut.push(notice('ok', lang === 'ru'
                ? 'Все восемь дел закрыты.' : 'All eight cases closed.'));
            }
          } else if (owner) {
            nodesOut.push(notice('warn', lang === 'ru'
              ? `Это ключ к делу ${owner.id}, а не к этому.`
              : `This is the key to case ${owner.id}, not this one.`));
          } else {
            nodesOut.push(notice('warn', lang === 'ru'
              ? 'Фраза валидна, но это не ключ к этому делу.'
              : 'Valid phrase, but not the key to this case.'));
          }
          nodesOut.push(this.derivationTable(wallet));
          replace(result, ...nodesOut);
        } catch (error) {
          replace(result, notice('danger',
            error instanceof MnemonicError ? 'DECRYPTION FAILED' : 'ERROR', error.message));
        } finally {
          submit.disabled = false;
        }
      },
    });
    nodes.push(el('div', { class: 'stack' }, input, el('div', { class: 'row' }, submit), result));

    if (state === 'solved') {
      nodes.push(section(t('epilogue', lang)));
      nodes.push(el('div', { class: 'prose' },
        ...pick(caseFile.epilogue, lang).map((line) => el('p', { text: line }))));
    }
    return nodes;
  }

  // ---- shared bits ------------------------------------------------------

  derivationTable(wallet) {
    return el('div', { class: 'stack' },
      section(t('derivation', this.lang)),
      table(['PATH', 'TYPE', 'ADDRESS'],
        wallet.addresses.map((entry) => [
          { text: entry.path },
          { text: entry.label },
          { class: 'addr', node: el('span', {}, entry.address, ' ', this.copyButton(entry.address)) },
        ])),
      el('details', {},
        el('summary', { class: 'hint-text', style: 'cursor:pointer;margin:8px 0',
          text: this.lang === 'ru' ? 'Ключи и сид' : 'Keys and seed' }),
        kv([
          ['BIP39 SEED', wallet.seed],
          ['MASTER XPRV', wallet.masterXprv],
          ...wallet.addresses.map((e) => [`PUBKEY m/${e.purpose}'`, e.publicKey]),
        ])));
  }

  copyButton(value) {
    const button = el('button', {
      class: 'btn', type: 'button', style: 'padding:1px 7px;font-size:10px',
      text: t('copy', this.lang),
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(value);
          button.textContent = t('copied', this.lang);
          setTimeout(() => { button.textContent = t('copy', this.lang); }, 1200);
        } catch {
          button.textContent = '—';
        }
      },
    });
    return button;
  }

  // ---- decrypt ----------------------------------------------------------

  renderDecrypt() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'двенадцать слов через пробел' : 'twelve words separated by spaces',
    });
    if (this.wallet) input.value = this.wallet.mnemonic;
    const output = el('div', {});

    const run = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
      await sleep(16);
      try {
        const wallet = deriveWallet(input.value);
        this.wallet = wallet;
        const owner = caseForMnemonic(wallet.mnemonic);
        replace(output,
          notice('ok', t('checksumOk', lang)),
          owner
            ? notice('info', lang === 'ru' ? `Сид дела ${owner.id}` : `Seed of case ${owner.id}`,
              pick(owner.codename, lang))
            : null,
          kv([['ENTROPY', toHex(mnemonicToEntropy(wallet.mnemonic))]]),
          this.derivationTable(wallet),
          el('div', { class: 'row' },
            el('button', {
              class: 'btn', type: 'button', text: t('syncOne', lang),
              onClick: () => this.go('ledger'),
            })));
      } catch (error) {
        replace(output, notice('danger', 'DECRYPTION FAILED', error.message));
      }
    };

    return [
      section(t('seedLabel', lang)),
      el('div', { class: 'stack' },
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('derive', lang), onClick: run }),
          el('button', {
            class: 'btn', type: 'button',
            text: lang === 'ru' ? 'Из энтропии (hex)' : 'From entropy (hex)',
            onClick: () => {
              const hex = prompt(lang === 'ru'
                ? 'Энтропия, 32 hex-символа:' : 'Entropy, 32 hex characters:');
              if (!hex) return;
              try {
                input.value = entropyToMnemonic(fromHex(hex.trim()));
                run();
              } catch (error) {
                replace(output, notice('danger', 'ENTROPY REJECTED', error.message));
              }
            },
          })),
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Проверка идёт по официальному словарю BIP-39 вместе с контрольной суммой. Всё считается здесь, в браузере.'
          : 'Validated against the official BIP-39 wordlist, checksum included. Everything is computed here, in your browser.' }),
        output),
    ];
  }

  // ---- ledger -----------------------------------------------------------

  renderLedger() {
    const lang = this.lang;
    if (!this.wallet) return [section('LEDGER'), empty(t('noWallet', lang))];

    const address = el('input', {
      class: 'field', type: 'text', spellcheck: 'false', value: this.wallet.primary.address,
    });
    const output = el('div', {});

    const providerRow = el('div', { class: 'row row--tight' },
      ...Object.entries(PROVIDERS).map(([key, provider]) =>
        el('button', {
          class: 'btn', type: 'button',
          'aria-pressed': this.chain.order[0] === key ? 'true' : 'false',
          text: provider.name,
          onClick: () => { this.chain.preferred = key; this.render(); },
        })));

    const sync = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      try {
        const stats = await this.chain.addressStats(address.value.trim());
        const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
        replace(output,
          kv([
            ['CONFIRMED', `${formatBtc(stats.confirmedSats)} BTC`],
            ['UNCONFIRMED', `${formatBtc(stats.unconfirmedSats)} BTC`],
            ['TOTAL RECEIVED', `${formatBtc(stats.totalReceivedSats)} BTC`],
            ['TOTAL SENT', `${formatBtc(stats.totalSentSats)} BTC`],
            ['TX COUNT', stats.txCount],
            ['UTXO COUNT', stats.utxoCount],
            ['SOURCE', stats.provider],
          ]),
          stats.confirmedSats > 0n
            ? notice('warn', 'ACCESS KEY REQUIRED FOR WITHDRAWAL.')
            : used
              ? notice('info', lang === 'ru'
                ? 'Кошелёк пуст, но история на месте.' : 'Wallet drained. History intact.')
              : notice('info', lang === 'ru'
                ? 'Адрес никогда не использовался в основной сети.'
                : 'Address never used on mainnet.'),
          el('a', {
            class: 'hint-text', target: '_blank', rel: 'noopener',
            href: this.chain.explorerUrl(address.value.trim()),
            text: lang === 'ru' ? 'Открыть в эксплорере ↗' : 'Open in explorer ↗',
          }));
      } catch (error) {
        replace(output, notice('danger', 'NETWORK LINK DOWN', error.message));
      }
    };

    const sweep = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      const rows = [];
      for (const entry of this.wallet.addresses) {
        try {
          const stats = await this.chain.addressStats(entry.address);
          const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
          rows.push([
            { text: `m/${entry.purpose}'` },
            { class: 'addr', text: entry.address },
            { class: 'num', text: String(stats.txCount) },
            { class: 'num', text: formatBtc(stats.totalReceivedSats) },
            { node: badge(used ? 'solved' : 'locked', used ? 'USED' : 'UNUSED') },
          ]);
        } catch {
          rows.push([
            { text: `m/${entry.purpose}'` },
            { class: 'addr', text: entry.address },
            { text: '—' }, { text: '—' },
            { node: badge('danger', 'UNREACHABLE') },
          ]);
        }
      }
      replace(output, table(['PATH', 'ADDRESS', 'TX', 'RECEIVED', ''], rows));
    };

    const txlog = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      try {
        const txs = await this.chain.transactions(address.value.trim(), 10);
        replace(output, txs.length
          ? table(['STATE', 'BLOCK', 'TXID'], txs.map((tx) => [
            { node: badge(tx.confirmed ? 'solved' : 'warn', tx.confirmed ? 'CONFIRMED' : 'PENDING') },
            { class: 'num', text: tx.blockHeight ? String(tx.blockHeight) : 'mempool' },
            { class: 'addr', text: tx.txid },
          ]))
          : empty(lang === 'ru' ? 'Транзакций нет.' : 'No transactions.'));
      } catch (error) {
        replace(output, notice('danger', 'TX HISTORY UNAVAILABLE', error.message));
      }
    };

    return [
      section('LIVE BITCOIN NETWORK', this.chain.nodeName),
      el('div', { class: 'stack' },
        address,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('syncOne', lang), onClick: sync }),
          el('button', { class: 'btn', type: 'button', text: t('sweep', lang), onClick: sweep }),
          el('button', { class: 'btn', type: 'button', text: t('txlog', lang), onClick: txlog })),
        providerRow,
        output),
    ];
  }

  // ---- search -----------------------------------------------------------

  renderSearch() {
    const lang = this.lang;
    const tabs = [
      ['words', lang === 'ru' ? 'Словарь' : 'Wordlist'],
      ['archive', lang === 'ru' ? 'Архив дел' : 'Case archive'],
      ['complete', lang === 'ru' ? 'Недостающее слово' : 'Missing word'],
    ];
    const body = el('div', {});
    const paint = () => replace(body, ...{
      words: () => this.searchWordsPanel(),
      archive: () => this.searchArchivePanel(),
      complete: () => this.searchCompletePanel(),
    }[this.searchTab]());

    const tabBar = el('div', { class: 'tabs' },
      ...tabs.map(([id, label]) =>
        el('button', {
          class: 'tab', type: 'button', role: 'tab',
          'aria-selected': this.searchTab === id ? 'true' : 'false',
          text: label,
          onClick: () => { this.searchTab = id; this.render(); },
        })));
    paint();
    return [tabBar, body];
  }

  searchWordsPanel() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field', type: 'search', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'начало или часть слова, либо номер 1–2048' : 'prefix, substring, or an index 1–2048',
    });
    const output = el('div', {});
    const run = () => {
      const query = input.value.trim();
      if (!query) return replace(output, empty(lang === 'ru' ? 'Введи запрос.' : 'Type a query.'));
      const asNumber = Number(query);
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 2048) {
        return replace(output, el('div', { class: 'word-grid' },
          el('div', { class: 'word' },
            el('span', { class: 'word__n', text: String(asNumber) }),
            el('span', { text: wordAt(asNumber) }))));
      }
      const hits = searchWordlist(query);
      replace(output, hits.length
        ? el('div', { class: 'stack' },
          el('p', { class: 'hint-text', text: `${hits.length} ${lang === 'ru' ? 'совпадений' : 'matches'}` }),
          el('div', { class: 'word-grid' },
            ...hits.map((hit) => el('div', { class: 'word' },
              el('span', { class: 'word__n', text: String(hit.index) }),
              el('span', { text: hit.word })))))
        : empty(lang === 'ru' ? 'Ничего не найдено.' : 'Nothing found.'));
    };
    input.addEventListener('input', run);
    return [
      section(lang === 'ru' ? 'Словарь BIP-39' : 'BIP-39 wordlist', '2048'),
      el('div', { class: 'stack' }, input,
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Ищет по началу и по вхождению; число открывает слово по индексу.'
          : 'Matches by prefix and by substring; a number opens that index.' }),
        output),
    ];
  }

  searchArchivePanel() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field', type: 'search', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'слово из улик, загадок или вводной' : 'a word from the briefs, evidence or riddles',
    });
    const output = el('div', {});
    const run = () => {
      const query = input.value.trim();
      if (!query) return replace(output, empty(lang === 'ru' ? 'Введи запрос.' : 'Type a query.'));
      const results = searchCases(query, lang, this.progress);
      replace(output, results.length
        ? el('div', { class: 'stack' },
          ...results.map((result) => el('div', { class: 'card' },
            el('button', {
              class: 'card__row', type: 'button',
              onClick: () => this.go('cases', result.case.id),
            },
            el('span', { class: 'card__id', text: String(result.case.id).padStart(2, '0') }),
            el('span', { class: 'card__name', text: pick(result.case.codename, lang) }),
            el('span', { class: 'card__spacer' }),
            badge('open', `${result.hits.length}`)),
            el('div', { style: 'padding:0 11px 10px' },
              ...result.hits.slice(0, 4).map((hit) =>
                el('div', { class: 'evidence', style: 'margin-top:6px', text: hit.line }))))))
        : empty(lang === 'ru' ? 'В архиве ничего.' : 'Nothing in the archive.'));
    };
    input.addEventListener('input', run);
    return [
      section(lang === 'ru' ? 'Полнотекстовый поиск по делам' : 'Full-text case search'),
      el('div', { class: 'stack' }, input,
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Эпилоги попадают в поиск только после того, как дело закрыто — иначе это спойлер.'
          : 'Epilogues join the index only once a case is closed — otherwise it would spoil them.' }),
        output),
    ];
  }

  searchCompletePanel() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?',
    });
    const output = el('div', {});
    const run = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('searching', lang) }));
      await sleep(16);
      try {
        const { position, candidates } = completeMnemonic(input.value);
        const hit = candidates.find((candidate) => candidate.case);
        replace(output,
          notice('info',
            lang === 'ru'
              ? `Позиция ${position + 1}: ${candidates.length} слов дают верную контрольную сумму`
              : `Position ${position + 1}: ${candidates.length} words give a valid checksum`,
            lang === 'ru'
              ? 'Контрольная сумма отсекает примерно пятнадцать шестнадцатых словаря.'
              : 'The checksum rules out about fifteen sixteenths of the wordlist.'),
          hit
            ? notice('ok',
              lang === 'ru' ? `Одно из них — ключ к делу ${hit.case.id}` : `One of them opens case ${hit.case.id}`,
              hit.word)
            : null,
          el('div', { class: 'chip-grid' },
            ...candidates.map((candidate) =>
              el('button', {
                class: `chip ${candidate.case ? 'chip--hit' : ''}`,
                type: 'button',
                title: candidate.mnemonic,
                onClick: () => { input.value = candidate.mnemonic; },
              },
              el('span', { class: 'chip__i', text: String(indexOf(candidate.word)) }),
              el('span', { text: candidate.word })))));
      } catch (error) {
        replace(output, notice('danger', 'SEARCH REFUSED', error.message));
      }
    };
    return [
      section(lang === 'ru' ? 'Восстановление недостающего слова' : 'Missing-word recovery'),
      el('div', { class: 'stack' },
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Вставь фразу и поставь ? на месте забытого слова. Инструмент решает ровно одну неизвестную позицию: при двух неизвестных валидных вариантов остаются сотни тысяч, и смысла в списке уже нет.'
          : 'Paste the phrase and put ? where the word is missing. The tool resolves exactly one unknown position: with two, hundreds of thousands of phrases stay valid and the list stops meaning anything.' }),
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button',
            text: lang === 'ru' ? 'Найти кандидатов' : 'Find candidates', onClick: run })),
        output),
    ];
  }

  // ---- randomizer -------------------------------------------------------

  renderRandom() {
    const lang = this.lang;
    const output = el('div', {});
    let count = 12;

    const countRow = el('div', { class: 'row row--tight' },
      ...[12, 15, 18, 21, 24].map((value) =>
        el('button', {
          class: 'btn', type: 'button',
          'aria-pressed': value === count ? 'true' : 'false',
          text: String(value),
          onClick: (event) => {
            count = value;
            countRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
          },
        })));

    const generate = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
      await sleep(16);
      const { mnemonic, entropy } = randomMnemonic(count);
      const words = mnemonic.split(' ');
      const wallet = deriveWallet(mnemonic);
      this.wallet = wallet;
      replace(output,
        el('div', { class: 'row', style: 'margin-bottom:10px' },
          this.copyButton(mnemonic),
          el('span', { class: 'section__meta', text: `${words.length} words · ${entropy.length * 8} bits` })),
        el('div', { class: 'word-grid' },
          ...words.map((word, index) => el('div', { class: 'word' },
            el('span', { class: 'word__n', text: String(index + 1) }),
            el('span', { text: word })))),
        kv([['ENTROPY', toHex(entropy)]]),
        this.derivationTable(wallet),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn', type: 'button',
            text: lang === 'ru' ? 'Проверить в сети' : 'Check on chain',
            onClick: () => this.go('ledger'),
          })),
        notice('warn', lang === 'ru' ? 'Это настоящий кошелёк' : 'This is a real wallet',
          lang === 'ru'
            ? 'Фраза собрана из криптостойкой случайности браузера и управляет настоящими адресами Bitcoin. Почти наверняка они пусты — но не клади сюда деньги: страница ничего не хранит, и после закрытия вкладки фраза исчезнет.'
            : 'The phrase comes from your browser’s cryptographic randomness and controls real Bitcoin addresses. They are almost certainly empty — but do not fund them: nothing is stored, and the phrase is gone when you close the tab.'));
    };

    return [
      section(lang === 'ru' ? 'Генератор сид-фраз' : 'Seed phrase generator'),
      el('div', { class: 'stack' },
        el('div', { class: 'row' },
          el('span', { class: 'section__meta', text: t('words', lang) }), countRow),
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('generate', lang), onClick: generate })),
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Энтропия берётся из crypto.getRandomValues — той же функции, которой пользуются настоящие кошельки. Ничего не отправляется наружу.'
          : 'Entropy comes from crypto.getRandomValues — the same source real wallets use. Nothing leaves the page.' }),
        output),
    ];
  }

  // ---- about ------------------------------------------------------------

  renderAbout() {
    const lang = this.lang;
    const lines = lang === 'ru' ? [
      'Детективный квест, играющий против настоящей сети Bitcoin.',
      'Мнемоники проверяются по официальному словарю BIP-39 вместе с контрольной суммой, сид получается через PBKDF2-HMAC-SHA512 (2048 раундов), ключи выводятся на кривой secp256k1 по BIP-32, а балансы приходят живыми запросами к публичным эксплорерам.',
      'Вся криптография работает в браузере. Наружу уходит только запрос адреса — в нём нет ничего, кроме самого адреса.',
      'Ответы восьми дел — опубликованные тестовые векторы BIP-39. Их ключи известны всему миру, красть там нечего, зато история в блокчейне настоящая.',
      'Программа не умеет подбирать чужие кошельки. Никогда не вводи в программы — включая эту — сид-фразу от кошелька с реальными деньгами.',
    ] : [
      'A detective quest played against the real Bitcoin network.',
      'Mnemonics are checked against the official BIP-39 wordlist including the checksum, seeds come from PBKDF2-HMAC-SHA512 over 2048 rounds, keys are derived over secp256k1 through BIP-32, and balances arrive from live calls to public explorers.',
      'All the cryptography runs in your browser. The only thing that leaves the page is an address lookup, which carries nothing but the address.',
      'The eight case answers are published BIP-39 test vectors. Their keys are known worldwide, so there is nothing to steal — but the on-chain history is genuine.',
      'This program cannot crack anyone’s wallet. Never type a seed phrase that controls real funds into any program, including this one.',
    ];
    return [
      section('BIP-39: NEON TERMINAL', META.version),
      el('div', { class: 'prose' }, ...lines.map((line) => el('p', { text: line }))),
      el('div', { class: 'row' },
        el('a', { class: 'btn', href: 'https://github.com/legenki/neon-terminal',
          target: '_blank', rel: 'noopener', text: 'Source on GitHub ↗' })),
    ];
  }
}
