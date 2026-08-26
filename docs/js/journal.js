// The detective's case book: one persistent record of every move made in any
// tool, in either mode. Entries carry enough payload to be replayed, so the
// journal is a way back to earlier work rather than a read-only log.
//
// One rule matters more than the rest: a seed phrase the player typed in and
// that the game does not recognise is never written to disk. Only phrases the
// game already knows (the eight case answers, all published test vectors) and
// phrases this page generated itself are stored in full. Anything else is
// recorded masked, so pasting a live wallet into the terminal cannot leave the
// phrase sitting in localStorage.

import { migrated } from './storage.js';

const STORAGE_KEY = 'enigma-terminal/journal/v1';
const MAX_ENTRIES = 400;

export const TOOLS = {
  decrypt: { label: { en: 'Decrypt', ru: 'Дешифровка', es: 'Descifrado', pt: 'Decifração' }, glyph: '⌘' },
  ledger: { label: { en: 'Ledger', ru: 'Реестр', es: 'Registro', pt: 'Registro' }, glyph: '₿' },
  sweep: { label: { en: 'Sweep', ru: 'Обход', es: 'Recorrido', pt: 'Percurso' }, glyph: '≡' },
  txlog: { label: { en: 'Tx log', ru: 'Транзакции', es: 'Transacciones', pt: 'Transações' }, glyph: '⇄' },
  search: { label: { en: 'Wordlist', ru: 'Словарь', es: 'Lista', pt: 'Lista' }, glyph: '⌕' },
  archive: { label: { en: 'Archive', ru: 'Архив', es: 'Archivo', pt: 'Arquivo' }, glyph: '▤' },
  complete: { label: { en: 'Recovery', ru: 'Восстановление', es: 'Recuperación', pt: 'Recuperação' }, glyph: '?' },
  random: { label: { en: 'Randomizer', ru: 'Рандомайзер', es: 'Aleatorio', pt: 'Aleatório' }, glyph: '⚄' },
  case: { label: { en: 'Case', ru: 'Дело', es: 'Caso', pt: 'Caso' }, glyph: '★' },
  hint: { label: { en: 'Hint', ru: 'Подсказка', es: 'Pista', pt: 'Dica' }, glyph: '!' },
};

//: How a status reads on the terminal's palette. Same four as the Python
//: build (enigma_terminal/journal.py) so a journal written in one and listed
//: in the other looks the same.
export const STATUS_STYLES = { ok: 'green', warn: 'amber', danger: 'red', info: 'grey' };

const EXPORT_CAPTIONS = {
  en: { title: 'INVESTIGATION JOURNAL', exported: 'Exported', entries: 'Entries' },
  ru: { title: 'ЖУРНАЛ РАССЛЕДОВАНИЯ', exported: 'Выгружено', entries: 'Записей' },
  es: { title: 'DIARIO DE INVESTIGACIÓN', exported: 'Exportado', entries: 'Registros' },
  pt: { title: 'DIÁRIO DE INVESTIGAÇÃO', exported: 'Exportado', entries: 'Registros' },
};

/** Redact a phrase the game has no business remembering. */
export function maskMnemonic(mnemonic) {
  const words = String(mnemonic).trim().split(/\s+/);
  if (words.length < 3) return '•••';
  return `${words[0]} … ${words[words.length - 1]} (${words.length} words)`;
}

export class Journal {
  constructor() {
    this.entries = Journal.read();
    this.listeners = new Set();
  }

  static read() {
    try {
      const raw = migrated(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      /* storage full or blocked: the session keeps its in-memory journal */
    }
  }

  /** Re-read from storage — the other mode may have written meanwhile. */
  refresh() {
    this.entries = Journal.read();
    this.notify();
    return this.entries;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) listener(this.entries);
  }

  /**
   * Append an entry.
   *
   * @param {object} entry
   * @param {string} entry.tool     one of TOOLS
   * @param {string} entry.title    the one-line summary shown in the rail
   * @param {string} [entry.detail] secondary line
   * @param {string} [entry.status] ok | warn | danger | info
   * @param {object} [entry.payload] enough state to replay the action
   */
  push(entry) {
    // Both front-ends live in one page and each holds its own instance, so
    // append onto what is actually stored rather than onto a stale copy —
    // otherwise whichever mode writes last erases the other's entries.
    this.entries = Journal.read();
    const record = {
      id: (this.entries.length ? this.entries[0].id : 0) + 1,
      at: Date.now(),
      status: 'info',
      detail: '',
      payload: {},
      pinned: false,
      ...entry,
    };
    // Newest first: the rail and the CL listing both read top-down.
    this.entries.unshift(record);
    this.trim();
    this.save();
    this.notify();
    return record;
  }

  /** Drop the oldest unpinned entries once the cap is passed. */
  trim() {
    if (this.entries.length <= MAX_ENTRIES) return;
    const kept = [];
    const overflow = [];
    for (const entry of this.entries) {
      (entry.pinned ? kept : overflow).push(entry);
    }
    const room = Math.max(MAX_ENTRIES - kept.length, 0);
    this.entries = [...kept, ...overflow.slice(0, room)]
      .sort((a, b) => b.at - a.at || b.id - a.id);
  }

  all() {
    return this.entries;
  }

  byTool(tool) {
    return tool ? this.entries.filter((entry) => entry.tool === tool) : this.entries;
  }

  get(id) {
    return this.entries.find((entry) => entry.id === Number(id)) || null;
  }

  /** Entries are numbered from 1 in the UI and the CL listing. */
  at(position) {
    return this.entries[Number(position) - 1] || null;
  }

  togglePin(id) {
    const entry = this.get(id);
    if (!entry) return null;
    entry.pinned = !entry.pinned;
    this.save();
    this.notify();
    return entry;
  }

  remove(id) {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== Number(id));
    if (this.entries.length !== before) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  /** Clear everything, or keep the pinned entries. */
  clear({ keepPinned = false } = {}) {
    this.entries = keepPinned ? this.entries.filter((entry) => entry.pinned) : [];
    this.save();
    this.notify();
  }

  counts() {
    const tally = {};
    for (const entry of this.entries) {
      tally[entry.tool] = (tally[entry.tool] || 0) + 1;
    }
    return tally;
  }

  /** Plain-text case file, for the clipboard or a download. */
  toText(lang = 'en') {
    const caption = EXPORT_CAPTIONS[lang] || EXPORT_CAPTIONS.en;
    const header = [
      `${caption.title} // BIP-39: ENIGMA TERMINAL`,
      `${caption.exported}: ${new Date().toISOString()}`,
      `${caption.entries}: ${this.entries.length}`,
      '',
    ];
    const body = this.entries.map((entry, index) => {
      const stamp = new Date(entry.at).toISOString().replace('T', ' ').slice(0, 19);
      const tool = (TOOLS[entry.tool] && TOOLS[entry.tool].label.en) || entry.tool;
      const pin = entry.pinned ? ' [PINNED]' : '';
      return `${String(index + 1).padStart(3)}. ${stamp}  ${tool.toUpperCase()}${pin}\n`
        + `     ${entry.title}`
        + (entry.detail ? `\n     ${entry.detail}` : '');
    });
    return [...header, ...body].join('\n');
  }
}
