// The GUI front-end. Retro chrome, modern layout — over the same game core the
// command line drives, so progress, journal and rules are shared.
//
// Panels are built once and cached: switching tabs hides a node instead of
// re-rendering it, so a half-typed phrase, a query and its results all survive
// the trip to another tool and back.

import { el, replace, win, section, notice, badge, kv, table, empty } from './dom.js';
import {
  CAMPAIGN_CASES, CLIENTS, META, ProgressStore, allCases, caseById, caseForMnemonic,
  caseState, casesForClient, clientBySlug, completeMnemonic, contractsLoaded,
  isUnlocked, loadContracts, missingRequirements, pick, randomMnemonic,
  searchCases, searchWordlist, MnemonicError,
} from '../core.js';
import { Journal, TOOLS, maskMnemonic } from '../journal.js';
import { deriveWallet } from '../crypto/wallet.js';
import { entropyToMnemonic, mnemonicToEntropy, wordAt, indexOf } from '../crypto/bip39.js';
import { fromHex, toHex } from '../crypto/hash.js';
import { ChainClient, formatBtc, PROVIDERS } from '../chain.js';
import { addressSigil, caseSigil, mnemonicSigil, sigil } from '../identicon.js';

const PANELS = [
  { id: 'cases', label: { en: 'Case files', ru: 'Дела' }, key: '1' },
  { id: 'board', label: { en: 'Contracts', ru: 'Контракты' }, key: '2' },
  { id: 'decrypt', label: { en: 'Decrypt', ru: 'Дешифровка' }, key: '3' },
  { id: 'ledger', label: { en: 'Ledger', ru: 'Реестр' }, key: '4' },
  { id: 'search', label: { en: 'Search', ru: 'Поиск' }, key: '5' },
  { id: 'random', label: { en: 'Randomizer', ru: 'Рандомайзер' }, key: '6' },
  { id: 'journal', label: { en: 'Journal', ru: 'Журнал' }, key: '7' },
  { id: 'about', label: { en: 'About', ru: 'О программе' }, key: '8' },
];

const T = {
  solved: { en: 'Closed', ru: 'Закрыто' },
  open: { en: 'Open', ru: 'Открыто' },
  locked: { en: 'Locked', ru: 'Заперто' },
  closedCount: { en: 'closed', ru: 'закрыто' },
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
  journal: { en: 'Journal', ru: 'Журнал' },
  recent: { en: 'Recent', ru: 'Последнее' },
  openJournal: { en: 'Open journal', ru: 'Открыть журнал' },
  recall: { en: 'Recall', ru: 'Вернуться' },
  pin: { en: 'Pin', ru: 'Закрепить' },
  emptyJournal: {
    en: 'Nothing recorded yet. Every derivation, query and search lands here.',
    ru: 'Пока пусто. Сюда попадает каждая деривация, запрос и поиск.',
  },
  maskedNote: {
    en: 'Phrase not stored — the game does not keep unknown seed phrases.',
    ru: 'Фраза не сохранена — игра не хранит незнакомые сид-фразы.',
  },
  exportTxt: { en: 'Export', ru: 'Выгрузить' },
  purge: { en: 'Purge', ru: 'Очистить' },
  keepPinned: { en: 'Keep pinned', ru: 'Кроме закреплённых' },
  all: { en: 'All', ru: 'Все' },
  board: { en: 'Contract board', ru: 'Доска контрактов' },
  clients: { en: 'Clients', ru: 'Заказчики' },
  dossier: { en: 'Dossier', ru: 'Досье' },
  dialect: { en: 'Puzzle dialect', ru: 'Почерк заказчика' },
  loadingBoard: { en: 'Pulling the contract board…', ru: 'Тяну доску контрактов…' },
  boardOffline: {
    en: 'The contract board did not load. The eight campaign cases still work.',
    ru: 'Доска контрактов не загрузилась. Восемь дел кампании работают.',
  },
  acts: { en: 'Acts', ru: 'Фазы' },
  backToClients: { en: 'All clients', ru: 'К заказчикам' },
};

const t = (key, lang) => T[key][lang] || T[key].en;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = (at) => new Date(at).toTimeString().slice(0, 8);

export class GuiApp {
  constructor(root, { lang = 'ru', onLangChange = null } = {}) {
    this.root = root;
    this.lang = lang;
    this.onLangChange = onLangChange;
    this.progress = new ProgressStore();
    this.journal = new Journal();
    this.chain = new ChainClient();
    this.panel = 'cases';
    this.activeCaseId = null;
    this.activeClient = null;
    this.wallet = null;
    this.railOpen = true;
    this.panels = new Map();     // key -> { node, api }
    this.mounted = false;
  }

  setLang(lang) {
    this.lang = lang;
    this.panels.clear();          // every label changes, so rebuild on demand
    if (this.mounted) this.render();
  }

  /** The other mode may have written progress or journal entries. */
  syncFromStorage() {
    this.progress.refresh();
    this.journal.refresh();
    this.panels.delete('cases');
    this.panels.delete('journal');
    if (this.mounted) this.render();
  }

  // ---- shell ------------------------------------------------------------

  mount() {
    this.nav = el('nav', { class: 'win__body' });
    this.content = el('div', { class: 'win__body' });
    this.railBody = el('div', { class: 'win__body rail__body' });

    this.navWindow = win('Archive', this.nav);
    this.contentWindow = win('—', this.content);
    this.railWindow = win(t('recent', this.lang), this.railBody,
      el('button', {
        class: 'win__collapse', type: 'button', title: 'Collapse',
        text: '–',
        onClick: () => this.toggleRail(),
      }));
    this.railWindow.classList.add('rail');

    this.railTab = el('button', {
      class: 'rail-tab', type: 'button', text: '▤',
      title: t('recent', this.lang),
      onClick: () => this.toggleRail(),
    });

    replace(this.root, this.navWindow, this.contentWindow, this.railWindow, this.railTab);
    this.journal.subscribe(() => {
      this.paintRail();
      this.panels.delete('journal');
      if (this.panel === 'journal') this.render();
    });
    this.mounted = true;
    this.applyRail();
    this.render();
  }

  toggleRail() {
    this.railOpen = !this.railOpen;
    this.applyRail();
  }

  applyRail() {
    this.root.classList.toggle('rail-closed', !this.railOpen);
    this.railWindow.classList.toggle('is-hidden', !this.railOpen);
    this.railTab.classList.toggle('is-hidden', this.railOpen);
    if (this.railOpen) this.paintRail();
  }

  go(panel, caseId = null) {
    this.panel = panel;
    if (caseId !== null) this.activeCaseId = caseId;
    this.render();
    this.content.scrollTop = 0;
  }

  panelKey() {
    if (this.panel === 'cases' && this.activeCaseId !== null) {
      return `cases:${this.activeCaseId}`;
    }
    if (this.panel === 'board' && this.activeClient) {
      return `client:${this.activeClient}`;
    }
    return this.panel;
  }

  ensurePanel(key) {
    if (!this.panels.has(key)) this.panels.set(key, this.buildPanel(key));
    return this.panels.get(key);
  }

  buildPanel(key) {
    if (key.startsWith('cases:')) {
      return this.buildCaseDetail(caseById(key.slice(6)));
    }
    if (key.startsWith('client:')) {
      return this.buildClientBoard(key.slice(7));
    }
    return {
      cases: () => this.buildCaseList(),
      board: () => this.buildBoard(),
      decrypt: () => this.buildDecrypt(),
      ledger: () => this.buildLedger(),
      search: () => this.buildSearch(),
      random: () => this.buildRandom(),
      journal: () => this.buildJournal(),
      about: () => this.buildAbout(),
    }[key]();
  }

  render() {
    this.paintNav();
    const panel = PANELS.find((p) => p.id === this.panel);
    this.contentWindow.querySelector('.win__title').textContent =
      pick(panel.label, this.lang);
    const { node } = this.ensurePanel(this.panelKey());
    replace(this.content, node);
    if (this.railOpen) this.paintRail();
  }

  // ---- sidebar ----------------------------------------------------------

  paintNav() {
    const solved = this.progress.solved.length;
    const percent = Math.round((solved / CAMPAIGN_CASES.length) * 100);
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
        el('div', { text: `${solved}/${CAMPAIGN_CASES.length} ${t('closedCount', this.lang)}` }),
        el('div', { class: 'nav__bar' }, el('span', { style: `width:${percent}%` }))),
      el('div', { class: 'nav__sep' }),
      el('div', { class: 'nav__meter' },
        el('div', { text: `OPERATOR ${META.operator}` }),
        el('div', { text: `NODE ${this.chain.nodeName}` }),
        el('div', { text: `LOG ${this.journal.all().length}` })),
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

  // ---- journal ----------------------------------------------------------

  /** Record one move. Callers decide whether a phrase may be stored. */
  log(tool, title, { detail = '', status = 'info', payload = {} } = {}) {
    return this.journal.push({ tool, title, detail, status, payload });
  }

  paintRail() {
    const lang = this.lang;
    const entries = this.journal.all().slice(0, 40);
    replace(this.railBody,
      el('div', { class: 'rail__head' },
        el('span', { class: 'section__meta', text: `${this.journal.all().length}` }),
        el('span', { class: 'card__spacer' }),
        el('button', {
          class: 'btn', style: 'padding:2px 8px;font-size:10px',
          type: 'button', text: t('openJournal', lang),
          onClick: () => this.go('journal'),
        })),
      entries.length
        ? el('ol', { class: 'rail__list' },
          ...entries.map((entry) => this.railEntry(entry)))
        : el('p', { class: 'hint-text', text: t('emptyJournal', lang) }));
  }

  /** The sigil that identifies whatever a journal entry is about. */
  entrySigil(entry, size) {
    const payload = entry.payload || {};
    if (payload.mnemonic) return mnemonicSigil(payload.mnemonic, { size });
    if (payload.address) return addressSigil(payload.address, { size });
    if (payload.caseId) {
      const caseFile = caseById(payload.caseId);
      if (caseFile) return caseSigil(caseFile, { size });
    }
    // Searches and masked phrases still deserve a stable mark of their own.
    return sigil(`neon-${entry.tool}-${entry.title}`, { size });
  }

  railEntry(entry) {
    const tool = TOOLS[entry.tool] || { glyph: '·', label: { en: entry.tool } };
    return el('li', { class: `rail__item rail__item--${entry.status}` },
      el('button', {
        class: 'rail__btn', type: 'button',
        title: `${entry.title}${entry.detail ? '\n' + entry.detail : ''}`,
        onClick: () => this.recall(entry),
      },
      this.entrySigil(entry, 16),
      el('span', { class: 'rail__text' },
        el('span', { class: 'rail__title', text: entry.title }),
        el('span', { class: 'rail__meta', text: `${clock(entry.at)} · ${pick(tool.label, this.lang)}` })),
      entry.pinned ? el('span', { class: 'rail__pin', text: '★' }) : null));
  }

  /** Take the player back to the tool that produced an entry, re-armed. */
  recall(entry) {
    const { tool, payload = {} } = entry;
    if (tool === 'case' || tool === 'hint') {
      if (payload.caseId) this.go('cases', payload.caseId);
      return;
    }
    if (tool === 'decrypt' || tool === 'random') {
      if (!payload.mnemonic) {
        this.go('decrypt');
        this.ensurePanel('decrypt').api.warn(t('maskedNote', this.lang));
        return;
      }
      this.go('decrypt');
      this.ensurePanel('decrypt').api.run(payload.mnemonic);
      return;
    }
    if (tool === 'ledger' || tool === 'sweep' || tool === 'txlog') {
      this.go('ledger');
      this.ensurePanel('ledger').api.run(payload.address, tool);
      return;
    }
    if (tool === 'search' || tool === 'archive' || tool === 'complete') {
      this.go('search');
      const api = this.ensurePanel('search').api;
      const tab = tool === 'search' ? 'words' : tool === 'archive' ? 'archive' : 'complete';
      api.run(tab, payload.query || payload.pattern || '');
    }
  }

  buildJournal() {
    const lang = this.lang;
    let filter = '';
    const body = el('div', {});
    const node = el('div', { class: 'stack' });

    const paint = () => {
      const entries = this.journal.byTool(filter);
      replace(body, entries.length
        ? el('div', {}, ...entries.map((entry, index) => {
          const tool = TOOLS[entry.tool] || { glyph: '·', label: { en: entry.tool } };
          return el('div', { class: `card log log--${entry.status}` },
            el('div', { class: 'log__row' },
              el('span', { class: 'log__n', text: String(index + 1) }),
              this.entrySigil(entry, 22),
              el('span', { class: 'log__glyph', text: tool.glyph }),
              el('div', { class: 'log__body' },
                el('div', { class: 'log__title', text: entry.title }),
                entry.detail ? el('div', { class: 'log__detail', text: entry.detail }) : null,
                el('div', { class: 'log__meta',
                  text: `${clock(entry.at)} · ${pick(tool.label, lang)}` })),
              el('div', { class: 'row row--tight' },
                el('button', {
                  class: 'btn', style: 'padding:2px 8px;font-size:10px',
                  type: 'button', text: t('recall', lang),
                  onClick: () => this.recall(entry),
                }),
                el('button', {
                  class: 'btn', style: 'padding:2px 8px;font-size:10px',
                  type: 'button', 'aria-pressed': entry.pinned ? 'true' : 'false',
                  text: entry.pinned ? '★' : '☆', title: t('pin', lang),
                  onClick: () => { this.journal.togglePin(entry.id); paint(); },
                }),
                el('button', {
                  class: 'btn', style: 'padding:2px 8px;font-size:10px',
                  type: 'button', text: '✕',
                  onClick: () => { this.journal.remove(entry.id); paint(); },
                }))));
        }))
        : empty(t('emptyJournal', lang)));
    };

    const counts = this.journal.counts();
    const filterRow = el('div', { class: 'row row--tight' },
      el('button', {
        class: 'btn', type: 'button', 'aria-pressed': 'true', text: t('all', lang),
        onClick: (event) => {
          filter = '';
          filterRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          event.currentTarget.setAttribute('aria-pressed', 'true');
          paint();
        },
      }),
      ...Object.keys(TOOLS).filter((key) => counts[key]).map((key) =>
        el('button', {
          class: 'btn', type: 'button', 'aria-pressed': 'false',
          text: `${TOOLS[key].glyph} ${pick(TOOLS[key].label, lang)} ${counts[key]}`,
          onClick: (event) => {
            filter = key;
            filterRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
            paint();
          },
        })));

    paint();
    replace(node,
      section(t('journal', lang), `${this.journal.all().length}`),
      el('p', { class: 'hint-text', text: lang === 'ru'
        ? 'Каждый шаг записывается сюда и переживает перезагрузку страницы. Нажми «Вернуться», чтобы повторить запрос в том же инструменте. Незнакомые сид-фразы записываются в замаскированном виде и на диск не попадают.'
        : 'Every move lands here and survives a reload. Press Recall to re-run it in the tool that made it. Seed phrases the game does not recognise are recorded masked and never written to disk.' }),
      filterRow,
      el('div', { class: 'row' },
        el('button', {
          class: 'btn', type: 'button', text: t('exportTxt', lang),
          onClick: async () => {
            const text = this.journal.toText(lang);
            try {
              await navigator.clipboard.writeText(text);
            } catch { /* clipboard blocked; the download below still works */ }
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = el('a', { href: url, download: 'neon-terminal-journal.txt' });
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
          },
        }),
        el('button', {
          class: 'btn', type: 'button', text: `${t('purge', lang)} · ${t('keepPinned', lang)}`,
          onClick: () => { this.journal.clear({ keepPinned: true }); paint(); },
        }),
        el('button', {
          class: 'btn', type: 'button', text: `${t('purge', lang)} · ${t('all', lang)}`,
          onClick: () => { this.journal.clear(); paint(); },
        })),
      body);
    return { node, api: { paint } };
  }

  // ---- cases ------------------------------------------------------------

  buildCaseList() {
    const rows = CAMPAIGN_CASES.map((caseFile) => {
      const state = caseState(caseFile, this.progress);
      return el('div', { class: 'card' },
        el('button', {
          class: 'card__row',
          type: 'button',
          disabled: state === 'locked',
          onClick: () => state !== 'locked' && this.go('cases', caseFile.id),
        },
        caseSigil(caseFile, { size: 26 }),
        el('span', { class: 'card__id', text: String(caseFile.id).padStart(2, '0') }),
        el('span', { class: 'card__name', text: pick(caseFile.codename, this.lang) }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
        badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
          t(state, this.lang))));
    });
    const node = el('div', {},
      section('ORACLE ARCHIVE', `${this.progress.solved.length}/${CAMPAIGN_CASES.length}`),
      ...rows);
    return { node, api: {} };
  }

  /** The roster: eight employers, thirty-two contracts each. */
  buildBoard() {
    const lang = this.lang;
    const node = el('div', {});
    const body = el('div', {});

    const paint = () => {
      if (!contractsLoaded()) {
        replace(body, el('p', { class: 'spinner-line', text: t('loadingBoard', lang) }));
        return;
      }
      replace(body, ...CLIENTS.map((client) => {
        const cases = casesForClient(client.slug);
        const solved = cases.filter((entry) => this.progress.isSolved(entry.id)).length;
        const percent = cases.length ? Math.round((solved / cases.length) * 100) : 0;
        return el('div', { class: 'card client' },
          el('button', {
            class: 'card__row', type: 'button',
            onClick: () => { this.activeClient = client.slug; this.go('board'); },
          },
          sigil(`neon-client-${client.slug}`, { size: 30 }),
          el('div', { class: 'client__head' },
            el('div', { class: 'card__name', text: pick(client.name, lang) }),
            el('div', { class: 'client__kind', text: pick(client.kind, lang) })),
          el('span', { class: 'card__spacer' }),
          el('span', { class: 'section__meta', text: pick(client.district, lang) }),
          badge(solved === cases.length && cases.length ? 'solved' : 'open',
            `${solved}/${cases.length}`)),
          el('div', { class: 'client__bar' }, el('span', { style: `width:${percent}%` })));
      }));
    };

    replace(node,
      section(t('board', lang), `${CLIENTS.length} × 32 = 256`),
      el('p', { class: 'hint-text', text: lang === 'ru'
        ? 'У каждого заказчика свой почерк: он определяет не только тон брифа, но и способ, которым в деле спрятаны слова. Научиться читать заказчика — половина работы.'
        : 'Every client has a hand of their own: it sets the tone of the brief and, more to the point, the way the words are hidden. Learning to read a client is half the job.' }),
      body);

    if (!contractsLoaded()) {
      loadContracts().then(() => {
        this.panels.delete('board');
        if (this.panel === 'board' && !this.activeClient) this.render();
      });
    }
    paint();
    return { node, api: { paint } };
  }

  /** One employer's thirty-two contracts, grouped into four acts. */
  buildClientBoard(slug) {
    const lang = this.lang;
    const client = clientBySlug(slug);
    const cases = casesForClient(slug);
    const node = el('div', {});

    const acts = [1, 2, 3, 4].map((act) => {
      const inAct = cases.filter((entry) => entry.act === act);
      return el('div', { class: 'stack' },
        section(`${act}. ${client.acts[lang][act - 1]}`,
          `${inAct.filter((e) => this.progress.isSolved(e.id)).length}/${inAct.length}`),
        ...inAct.map((caseFile) => {
          const state = caseState(caseFile, this.progress);
          return el('div', { class: 'card' },
            el('button', {
              class: 'card__row', type: 'button',
              disabled: state === 'locked',
              onClick: () => state !== 'locked' && this.go('cases', caseFile.id),
            },
            caseSigil(caseFile, { size: 24 }),
            el('span', { class: 'card__id', text: String(caseFile.id).padStart(3, '0') }),
            el('span', { class: 'card__name', text: pick(caseFile.codename, lang) }),
            el('span', { class: 'card__spacer' }),
            el('span', { class: 'section__meta', text: caseFile.archetype.replace('_', ' ') }),
            el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
            badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
              t(state, lang))));
        }));
    });

    replace(node,
      el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('button', {
          class: 'btn', type: 'button', text: '← ' + t('backToClients', lang),
          onClick: () => { this.activeClient = null; this.go('board'); },
        }),
        sigil(`neon-client-${slug}`, { size: 30 }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'section__meta', text: pick(client.district, lang) })),
      section(pick(client.name, lang), pick(client.kind, lang)),
      el('div', { class: 'prose' },
        ...pick(client.creed, lang).map((line) => el('p', { text: line }))),
      notice('info', t('dialect', lang), pick(client.dialect, lang)),
      el('div', { class: 'stack', style: 'margin-top:14px' }, ...acts));
    return { node, api: {} };
  }

  buildCaseDetail(caseFile) {
    const lang = this.lang;
    const state = caseState(caseFile, this.progress);
    const hints = pick(caseFile.hints, lang);
    const node = el('div', {});

    const head = [
      el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('button', {
          class: 'btn', type: 'button',
          text: '← ' + (lang === 'ru' ? 'К списку' : 'All cases'),
          onClick: () => { this.activeCaseId = null; this.go('cases'); },
        }),
        caseSigil(caseFile, { size: 30 }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
        badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
          t(state, lang))),
      section(`${String(caseFile.id).padStart(2, '0')} · ${pick(caseFile.codename, lang)}`),
    ];

    if (state === 'locked') {
      replace(node, ...head, notice('warn', t('lockedMsg', lang),
        missingRequirements(caseFile, this.progress).join(', ')));
      return { node, api: {} };
    }

    const hintBox = el('div', { class: 'stack' });
    const paintHints = () => {
      const shown = this.progress.hintsUsed(caseFile.id);
      replace(hintBox,
        ...hints.slice(0, shown).map((hint, i) =>
          notice('info', `${i + 1}/${hints.length}`, hint)),
        shown < hints.length
          ? el('button', {
            class: 'btn', type: 'button', text: t('spendHint', lang),
            onClick: () => {
              const used = this.progress.useHint(caseFile.id);
              this.log('hint', `${pick(caseFile.codename, lang)} — hint ${used}/${hints.length}`,
                { detail: hints[used - 1], payload: { caseId: caseFile.id } });
              paintHints();
              this.paintNav();
            },
          })
          : el('p', { class: 'hint-text', text: t('noHints', lang) }));
    };
    paintHints();

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
          const out = [notice('ok', t('checksumOk', lang), wallet.primary.address)];
          if (owner && owner.id === caseFile.id) {
            const first = this.progress.markSolved(caseFile.id);
            this.panels.delete('cases');
            this.paintNav();
            if (first) {
              this.log('case', `${lang === 'ru' ? 'Дело' : 'Case'} ${caseFile.id} — ${pick(caseFile.codename, lang)}`,
                { detail: wallet.primary.address, status: 'ok',
                  payload: { caseId: caseFile.id, mnemonic: wallet.mnemonic } });
            }
            const employer = caseFile.client ? clientBySlug(caseFile.client) : null;
            out.push(notice('ok',
              lang === 'ru' ? `Дело ${caseFile.id} закрыто` : `Case ${caseFile.id} closed`,
              ...(employer
                ? [this.t('filedWith', { client: pick(employer.name, lang) })]
                : []),
              ...pick(caseFile.epilogue, lang)));
            if (first && this.progress.solved.length === CAMPAIGN_CASES.length) {
              out.push(notice('ok', lang === 'ru'
                ? 'Все восемь дел закрыты.' : 'All eight cases closed.'));
            }
          } else if (owner) {
            out.push(notice('warn', lang === 'ru'
              ? `Это ключ к делу ${owner.id}, а не к этому.`
              : `This is the key to case ${owner.id}, not this one.`));
          } else {
            out.push(notice('warn', lang === 'ru'
              ? 'Фраза валидна, но это не ключ к этому делу.'
              : 'Valid phrase, but not the key to this case.'));
          }
          this.recordDecrypt(wallet, owner);
          out.push(this.derivationTable(wallet));
          replace(result, ...out);
        } catch (error) {
          this.log('decrypt', error.message, { status: 'danger' });
          replace(result, notice('danger',
            error instanceof MnemonicError ? 'DECRYPTION FAILED' : 'ERROR', error.message));
        } finally {
          submit.disabled = false;
        }
      },
    });

    replace(node, ...head,
      el('div', { class: 'prose' },
        ...pick(caseFile.brief, lang).map((line) => el('p', { text: line }))),
      section(t('evidence', lang)),
      el('div', { class: 'evidence', text: pick(caseFile.evidence, lang).join('\n') }),
      section(t('clues', lang)),
      el('div', { class: 'clues', text: pick(caseFile.clues, lang).join('\n') }),
      section(t('hints', lang)),
      hintBox,
      section(t('submit', lang)),
      el('div', { class: 'stack' }, input, el('div', { class: 'row' }, submit), result));
    return { node, api: {} };
  }

  // ---- shared bits ------------------------------------------------------

  /**
   * Journal a derivation. A phrase is stored in full only when the game already
   * knows it (a case answer — all published test vectors) or when this page
   * generated it. Anything else the player typed stays masked.
   */
  recordDecrypt(wallet, owner, { generated = false } = {}) {
    const storable = Boolean(owner) || generated;
    this.log(generated ? 'random' : 'decrypt', wallet.primary.address, {
      status: owner ? 'ok' : 'info',
      detail: storable
        ? wallet.mnemonic
        : `${maskMnemonic(wallet.mnemonic)} — ${t('maskedNote', this.lang)}`,
      payload: storable ? { mnemonic: wallet.mnemonic } : { masked: true },
    });
  }

  derivationTable(wallet) {
    return el('div', { class: 'stack' },
      el('div', { class: 'row' },
        mnemonicSigil(wallet.mnemonic, { size: 34 }),
        el('span', { class: 'section__meta', text: this.lang === 'ru'
          ? 'Знак этой фразы' : 'Sigil of this phrase' })),
      section(t('derivation', this.lang)),
      table(['', 'PATH', 'TYPE', 'ADDRESS'],
        wallet.addresses.map((entry) => [
          { node: addressSigil(entry.address, { size: 20 }) },
          { text: entry.path },
          { text: entry.label },
          { class: 'addr', node: el('span', {}, entry.address, ' ',
            this.copyButton(entry.address), ' ',
            el('button', {
              class: 'btn', style: 'padding:1px 7px;font-size:10px',
              type: 'button', text: '₿',
              title: t('syncOne', this.lang),
              onClick: () => {
                this.go('ledger');
                this.ensurePanel('ledger').api.run(entry.address, 'ledger');
              },
            })) },
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

  buildDecrypt() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'двенадцать слов через пробел' : 'twelve words separated by spaces',
    });
    const output = el('div', {});

    const run = async (phrase = null) => {
      if (phrase !== null) input.value = phrase;
      replace(output, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
      await sleep(16);
      try {
        const wallet = deriveWallet(input.value);
        this.wallet = wallet;
        const owner = caseForMnemonic(wallet.mnemonic);
        this.recordDecrypt(wallet, owner);
        replace(output,
          notice('ok', t('checksumOk', lang)),
          owner
            ? notice('info', lang === 'ru' ? `Сид дела ${owner.id}` : `Seed of case ${owner.id}`,
              pick(owner.codename, lang))
            : null,
          kv([['ENTROPY', toHex(mnemonicToEntropy(wallet.mnemonic))]]),
          this.derivationTable(wallet));
      } catch (error) {
        this.log('decrypt', error.message, { status: 'danger' });
        replace(output, notice('danger', 'DECRYPTION FAILED', error.message));
      }
    };

    const node = el('div', {},
      section(t('seedLabel', lang)),
      el('div', { class: 'stack' },
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('derive', lang),
            onClick: () => run() }),
          el('button', {
            class: 'btn', type: 'button',
            text: lang === 'ru' ? 'Из энтропии (hex)' : 'From entropy (hex)',
            onClick: () => {
              const hex = prompt(lang === 'ru'
                ? 'Энтропия, 32 hex-символа:' : 'Entropy, 32 hex characters:');
              if (!hex) return;
              try {
                run(entropyToMnemonic(fromHex(hex.trim())));
              } catch (error) {
                replace(output, notice('danger', 'ENTROPY REJECTED', error.message));
              }
            },
          })),
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Проверка идёт по официальному словарю BIP-39 вместе с контрольной суммой. Всё считается здесь, в браузере, и незнакомые фразы в журнал целиком не попадают.'
          : 'Validated against the official BIP-39 wordlist, checksum included. Everything runs in your browser, and unknown phrases are never written to the journal in full.' }),
        output));

    return {
      node,
      api: {
        run,
        warn: (message) => replace(output, notice('warn', message)),
      },
    };
  }

  // ---- ledger -----------------------------------------------------------

  buildLedger() {
    const lang = this.lang;
    const address = el('input', {
      class: 'field', type: 'text', spellcheck: 'false',
      placeholder: '1... / 3... / bc1...',
      value: this.wallet ? this.wallet.primary.address : '',
    });
    const output = el('div', {});

    const sync = async () => {
      const target = address.value.trim();
      if (!target) return replace(output, notice('warn', t('noWallet', lang)));
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      try {
        const stats = await this.chain.addressStats(target);
        const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
        this.log('ledger', target, {
          status: stats.confirmedSats > 0n ? 'warn' : used ? 'info' : 'info',
          detail: `${formatBtc(stats.confirmedSats)} BTC · ${stats.txCount} tx · ${stats.provider}`,
          payload: { address: target },
        });
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
            href: this.chain.explorerUrl(target),
            text: lang === 'ru' ? 'Открыть в эксплорере ↗' : 'Open in explorer ↗',
          }));
      } catch (error) {
        this.log('ledger', target, { status: 'danger', detail: error.message,
          payload: { address: target } });
        replace(output, notice('danger', 'NETWORK LINK DOWN', error.message));
      }
    };

    const sweep = async () => {
      if (!this.wallet) return replace(output, notice('warn', t('noWallet', lang)));
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      const rows = [];
      let touched = 0;
      for (const entry of this.wallet.addresses) {
        try {
          const stats = await this.chain.addressStats(entry.address);
          const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
          if (used) touched += 1;
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
      this.log('sweep', this.wallet.primary.address, {
        status: touched ? 'ok' : 'info',
        detail: `${touched}/3 ${lang === 'ru' ? 'путей с историей' : 'paths carry history'}`,
        payload: { address: this.wallet.primary.address },
      });
      replace(output, table(['PATH', 'ADDRESS', 'TX', 'RECEIVED', ''], rows));
    };

    const txlog = async () => {
      const target = address.value.trim();
      if (!target) return replace(output, notice('warn', t('noWallet', lang)));
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      try {
        const txs = await this.chain.transactions(target, 10);
        this.log('txlog', target, {
          detail: `${txs.length} ${lang === 'ru' ? 'транзакций' : 'transactions'}`,
          payload: { address: target },
        });
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

    const providerRow = el('div', { class: 'row row--tight' },
      ...Object.entries(PROVIDERS).map(([key, provider]) =>
        el('button', {
          class: 'btn', type: 'button',
          'aria-pressed': this.chain.order[0] === key ? 'true' : 'false',
          text: provider.name,
          onClick: (event) => {
            this.chain.preferred = key;
            providerRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
            this.paintNav();
          },
        })));

    const node = el('div', {},
      section('LIVE BITCOIN NETWORK', this.chain.nodeName),
      el('div', { class: 'stack' },
        address,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('syncOne', lang), onClick: sync }),
          el('button', { class: 'btn', type: 'button', text: t('sweep', lang), onClick: sweep }),
          el('button', { class: 'btn', type: 'button', text: t('txlog', lang), onClick: txlog })),
        providerRow,
        output));

    return {
      node,
      api: {
        run: (target, kind = 'ledger') => {
          if (target) address.value = target;
          if (kind === 'sweep') return sweep();
          if (kind === 'txlog') return txlog();
          return sync();
        },
      },
    };
  }

  // ---- search -----------------------------------------------------------

  buildSearch() {
    const lang = this.lang;
    const tabs = [
      ['words', lang === 'ru' ? 'Словарь' : 'Wordlist'],
      ['archive', lang === 'ru' ? 'Архив дел' : 'Case archive'],
      ['complete', lang === 'ru' ? 'Недостающее слово' : 'Missing word'],
    ];
    // Each tab keeps its own node, so switching tabs does not lose results.
    const panes = {
      words: this.searchWordsPane(),
      archive: this.searchArchivePane(),
      complete: this.searchCompletePane(),
    };
    let active = 'words';
    const body = el('div', {});

    const show = (id) => {
      active = id;
      tabBar.querySelectorAll('.tab').forEach((tab) =>
        tab.setAttribute('aria-selected', String(tab.dataset.tab === id)));
      replace(body, panes[id].node);
    };

    const tabBar = el('div', { class: 'tabs' },
      ...tabs.map(([id, label]) =>
        el('button', {
          class: 'tab', type: 'button', role: 'tab',
          dataset: { tab: id },
          'aria-selected': id === active ? 'true' : 'false',
          text: label,
          onClick: () => show(id),
        })));

    show(active);
    const node = el('div', {}, tabBar, body);
    return {
      node,
      api: {
        run: (tab, value) => {
          show(tab);
          panes[tab].run(value);
        },
      },
    };
  }

  searchWordsPane() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field', type: 'search', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'начало или часть слова, либо номер 1–2048' : 'prefix, substring, or an index 1–2048',
    });
    const output = el('div', {});
    let logged = '';

    const run = (value = null) => {
      if (value !== null) input.value = value;
      const query = input.value.trim();
      if (!query) return replace(output, empty(lang === 'ru' ? 'Введи запрос.' : 'Type a query.'));
      const asNumber = Number(query);
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 2048) {
        replace(output, el('div', { class: 'word-grid' },
          el('div', { class: 'word' },
            el('span', { class: 'word__n', text: String(asNumber) }),
            el('span', { text: wordAt(asNumber) }))));
      } else {
        const hits = searchWordlist(query);
        replace(output, hits.length
          ? el('div', { class: 'stack' },
            el('p', { class: 'hint-text', text: `${hits.length} ${lang === 'ru' ? 'совпадений' : 'matches'}` }),
            el('div', { class: 'word-grid' },
              ...hits.map((hit) => el('div', { class: 'word' },
                el('span', { class: 'word__n', text: String(hit.index) }),
                el('span', { text: hit.word })))))
          : empty(lang === 'ru' ? 'Ничего не найдено.' : 'Nothing found.'));
      }
      // Log once the player stops typing, not on every keystroke.
      clearTimeout(this._wordTimer);
      this._wordTimer = setTimeout(() => {
        if (query === logged) return;
        logged = query;
        const hits = searchWordlist(query);
        this.log('search', query, {
          detail: `${hits.length} ${lang === 'ru' ? 'совпадений' : 'matches'}`,
          payload: { query },
        });
      }, 900);
    };

    input.addEventListener('input', () => run());
    const node = el('div', {},
      section(lang === 'ru' ? 'Словарь BIP-39' : 'BIP-39 wordlist', '2048'),
      el('div', { class: 'stack' }, input,
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Ищет по началу и по вхождению; число открывает слово по индексу.'
          : 'Matches by prefix and by substring; a number opens that index.' },),
        output));
    return { node, run };
  }

  searchArchivePane() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field', type: 'search', spellcheck: 'false',
      placeholder: lang === 'ru' ? 'слово из улик, загадок или вводной' : 'a word from the briefs, evidence or riddles',
    });
    const output = el('div', {});
    let logged = '';

    const run = (value = null) => {
      if (value !== null) input.value = value;
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

      clearTimeout(this._archiveTimer);
      this._archiveTimer = setTimeout(() => {
        if (query === logged) return;
        logged = query;
        this.log('archive', query, {
          detail: `${results.length} ${lang === 'ru' ? 'дел' : 'case(s)'}`,
          payload: { query },
        });
      }, 900);
    };

    input.addEventListener('input', () => run());
    const node = el('div', {},
      section(lang === 'ru' ? 'Полнотекстовый поиск по делам' : 'Full-text case search'),
      el('div', { class: 'stack' }, input,
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Эпилоги попадают в поиск только после того, как дело закрыто — иначе это спойлер.'
          : 'Epilogues join the index only once a case is closed — otherwise it would spoil them.' }),
        output));
    return { node, run };
  }

  searchCompletePane() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?',
    });
    const output = el('div', {});

    const run = async (value = null) => {
      if (value !== null) input.value = value;
      if (!input.value.trim()) return;
      replace(output, el('p', { class: 'spinner-line', text: t('searching', lang) }));
      await sleep(16);
      try {
        const pattern = input.value.trim();
        const { position, candidates } = completeMnemonic(pattern);
        const hit = candidates.find((candidate) => candidate.case);
        this.log('complete', `? @ ${position + 1}`, {
          status: hit ? 'ok' : 'info',
          detail: hit
            ? `${candidates.length} ${lang === 'ru' ? 'кандидатов' : 'candidates'} · ${hit.word} → case ${hit.case.id}`
            : `${candidates.length} ${lang === 'ru' ? 'кандидатов' : 'candidates'}`,
          payload: { pattern },
        });
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
        this.log('complete', error.message, { status: 'danger' });
        replace(output, notice('danger', 'SEARCH REFUSED', error.message));
      }
    };

    const node = el('div', {},
      section(lang === 'ru' ? 'Восстановление недостающего слова' : 'Missing-word recovery'),
      el('div', { class: 'stack' },
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Вставь фразу и поставь ? на месте забытого слова. Инструмент решает ровно одну неизвестную позицию: при двух неизвестных валидных вариантов остаются сотни тысяч, и смысла в списке уже нет.'
          : 'Paste the phrase and put ? where the word is missing. The tool resolves exactly one unknown position: with two, hundreds of thousands of phrases stay valid and the list stops meaning anything.' }),
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button',
            text: lang === 'ru' ? 'Найти кандидатов' : 'Find candidates',
            onClick: () => run() })),
        output));
    return { node, run };
  }

  // ---- randomizer -------------------------------------------------------

  buildRandom() {
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
      this.recordDecrypt(wallet, null, { generated: true });
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
        notice('warn', lang === 'ru' ? 'Это настоящий кошелёк' : 'This is a real wallet',
          lang === 'ru'
            ? 'Фраза собрана из криптостойкой случайности браузера и управляет настоящими адресами Bitcoin. Она записана в журнал этого браузера, чтобы к ней можно было вернуться, — и стирается кнопкой «Очистить» в журнале. Не клади на эти адреса деньги.'
            : 'The phrase comes from your browser’s cryptographic randomness and controls real Bitcoin addresses. It is written to this browser’s journal so you can come back to it, and Purge in the journal erases it. Do not fund these addresses.'));
    };

    const node = el('div', {},
      section(lang === 'ru' ? 'Генератор сид-фраз' : 'Seed phrase generator'),
      el('div', { class: 'stack' },
        el('div', { class: 'row' },
          el('span', { class: 'section__meta', text: t('words', lang) }), countRow),
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('generate', lang), onClick: generate })),
        el('p', { class: 'hint-text', text: lang === 'ru'
          ? 'Энтропия берётся из crypto.getRandomValues — той же функции, которой пользуются настоящие кошельки. Ничего не отправляется наружу.'
          : 'Entropy comes from crypto.getRandomValues — the same source real wallets use. Nothing leaves the page.' }),
        output));
    return { node, api: { run: generate } };
  }

  // ---- about ------------------------------------------------------------

  buildAbout() {
    const lang = this.lang;
    const lines = lang === 'ru' ? [
      'Детективный квест, играющий против настоящей сети Bitcoin.',
      'Мнемоники проверяются по официальному словарю BIP-39 вместе с контрольной суммой, сид получается через PBKDF2-HMAC-SHA512 (2048 раундов), ключи выводятся на кривой secp256k1 по BIP-32, а балансы приходят живыми запросами к публичным эксплорерам.',
      'Вся криптография работает в браузере. Наружу уходит только запрос адреса — в нём нет ничего, кроме самого адреса.',
      'Журнал расследования хранится в этом браузере. Сид-фразы, которых игра не знает, записываются в него замаскированными и на диск не попадают.',
      'Ответы восьми дел — опубликованные тестовые векторы BIP-39. Их ключи известны всему миру, красть там нечего, зато история в блокчейне настоящая.',
      'Программа не умеет подбирать чужие кошельки. Никогда не вводи в программы — включая эту — сид-фразу от кошелька с реальными деньгами.',
    ] : [
      'A detective quest played against the real Bitcoin network.',
      'Mnemonics are checked against the official BIP-39 wordlist including the checksum, seeds come from PBKDF2-HMAC-SHA512 over 2048 rounds, keys are derived over secp256k1 through BIP-32, and balances arrive from live calls to public explorers.',
      'All the cryptography runs in your browser. The only thing that leaves the page is an address lookup, which carries nothing but the address.',
      'The investigation journal lives in this browser. Seed phrases the game does not recognise are recorded masked and never written to disk.',
      'The eight case answers are published BIP-39 test vectors. Their keys are known worldwide, so there is nothing to steal — but the on-chain history is genuine.',
      'This program cannot crack anyone’s wallet. Never type a seed phrase that controls real funds into any program, including this one.',
    ];
    const node = el('div', {},
      section('BIP-39: NEON TERMINAL', META.version),
      el('div', { class: 'prose' }, ...lines.map((line) => el('p', { text: line }))),
      el('div', { class: 'row' },
        el('a', { class: 'btn', href: 'https://github.com/legenki/neon-terminal',
          target: '_blank', rel: 'noopener', text: 'Source on GitHub ↗' })));
    return { node, api: {} };
  }
}
