// Shell: one strip above the interface, carrying the mark, the status line
// and the two controls that change how the whole page reads — daylight and
// language. Both used to live elsewhere: the daylight switch in a 72px black
// banner of its own, the languages as four buttons at the foot of the sidebar.
//
// The terminal is no longer a separate mode. It is the first panel in the
// sidebar, and this file hands its canvas to the GUI to adopt — the Terminal
// object, its scrollback and its input all survive the move, which is why the
// frame is reparented rather than rebuilt.

import { Chime } from './chime.js';
import { LANG_ENDONYMS, LANG_NAMES, LANGS, loadContracts } from './core.js';
import { Daylight } from './daylight.js';
import { Engine } from './engine.js';
import { GlitchBanner } from './glitch.js';
import { GuiApp } from './gui/app.js';
import { Heartbeat, pad2, splitAge } from './heartbeat.js';
import { ExplorerClient } from './mempool.js';
import { dropdown } from './select.js';
import { read, write } from './storage.js';
import { Terminal, terminalPalette } from './term.js';
import { icon } from './vendor/feather.js';

const LANG_KEY = 'enigma-terminal/lang/v1';
const LIGHT_KEY = 'enigma-terminal/light/v1';

const stored = (key, fallback) => read(key) || fallback;
const store = write;

// Match the browser against every language we ship, not just Russian.
const preferred =
  (navigator.languages || [navigator.language || 'en'])
    .map((tag) => String(tag).slice(0, 2).toLowerCase())
    .find((code) => LANGS.includes(code)) || 'en';
const lang = stored(LANG_KEY, preferred);

// Compact: an 18px mark beside a typed wordmark, not a canvas being the
// wordmark itself.
const glitch = new GlitchBanner(document.getElementById('glitch-canvas'), {
  compact: true,
});

// ---- the terminal ---------------------------------------------------------

const termCanvas = document.getElementById('term-layer');
const keyboardInput = document.getElementById('keyboard-input');
const screenFrame = document.getElementById('screen-frame');
const guiRoot = document.getElementById('gui-root');
const powerLed = document.getElementById('power-led');

const terminal = new Terminal(termCanvas, {
  fontSize: window.innerWidth < 640 ? 10 : 14,
  prompt: 'nullsec@enigma:~$ ',
});

//: One explorer for the block clock and the opening. Sharing it means the two
//: of them queue behind the same rate limit and hit the same cache instead of
//: racing each other for the tip on the first second of the page. The GUI keeps
//: its own on purpose — its budget is its own.
const explorer = new ExplorerClient();

const engine = new Engine(terminal, { lang, explorer });
let pending = 0;
let booted = false;

terminal.onCommand = (line) => {
  pending += 1;
  engine.run(line).finally(() => {
    pending -= 1;
    // A command can close a case or write to the journal, so the rest of the
    // interface has to re-read both.
    gui.syncFromStorage();
  });
};

// ---- the GUI, which now contains the terminal -----------------------------

const gui = new GuiApp(guiRoot, {
  lang,
  terminalHost: screenFrame,
  onLangChange: (code) => {
    store(LANG_KEY, code);
    engine.lang = code;
    langSelect.setValue(code);
    paintLightLabels(code);
  },
  // Called every time the Terminal panel comes on screen. The canvas had no
  // box while it was hidden, so it has nothing to measure until now.
  onTerminalShown: () => {
    screenFrame.classList.remove('is-hidden');
    terminal.resize();
    terminal.dirty = true;
    keyboardInput.focus({ preventScroll: true });
    if (!booted) {
      booted = true;
      engine.boot();
    }
  },
});

// ---- daylight -------------------------------------------------------------
// The GUI takes its whole palette from the hour. Two pinned modes are there
// for players who want one look and no drift.

const lightButtons = {
  live: document.getElementById('light-live'),
  light: document.getElementById('light-day'),
  dark: document.getElementById('light-night'),
};

// The strip sits outside the GUI, so it carries its own four languages. It was
// the last thing on the page still pinned to one.
const LIGHT_WORDS = {
  en: {
    live: 'LIVE',
    light: 'DAY',
    dark: 'NIGHT',
    daylight: 'Daylight',
    language: 'Language',
  },
  ru: {
    live: 'LIVE',
    light: 'ДЕНЬ',
    dark: 'НОЧЬ',
    daylight: 'Освещение',
    language: 'Язык',
  },
  es: {
    live: 'LIVE',
    light: 'DÍA',
    dark: 'NOCHE',
    daylight: 'Luz',
    language: 'Idioma',
  },
  pt: {
    live: 'LIVE',
    light: 'DIA',
    dark: 'NOITE',
    daylight: 'Luz',
    language: 'Idioma',
  },
};
const lightSwitch = document.getElementById('light-switch');

function paintLightLabels(code) {
  const words = LIGHT_WORDS[code] || LIGHT_WORDS.en;
  // Screen readers announce the page in whatever the player is reading.
  document.documentElement.lang = code;
  if (lightSwitch) lightSwitch.setAttribute('aria-label', words.daylight);
  langSelect.setLabel(words.language);
  for (const [key, button] of Object.entries(lightButtons)) {
    button.textContent = words[key];
  }
}

// Written on the document root, not the GUI: the shell around it — the ground
// and the type behind every panel — belongs to the same daylight.
const daylight = new Daylight(document.documentElement, {
  mode: stored(LIGHT_KEY, 'live'),
  // The screen follows the hour with everything else. It keeps its own ground
  // so it still reads as a terminal, but it is no longer the one surface on
  // the page pinned to a single colour.
  onPaint: (palette) => {
    if (terminal.setPalette(terminalPalette(palette))) terminal.dirty = true;
  },
});

function setLight(next) {
  daylight.setMode(next);
  store(LIGHT_KEY, daylight.mode);
  for (const [key, button] of Object.entries(lightButtons)) {
    button.setAttribute('aria-pressed', String(daylight.mode === key));
  }
}

for (const [key, button] of Object.entries(lightButtons)) {
  button.addEventListener('click', () => setLight(key));
}

// ---- language -------------------------------------------------------------
// One control in the chrome rather than four buttons at the foot of the
// sidebar: the language is a property of the whole page, so it belongs where
// the daylight switch is, not inside the panel column.

const langSelect = dropdown({
  options: LANGS.map((code) => ({
    value: code,
    name: LANG_ENDONYMS[code],
    code: LANG_NAMES[code],
  })),
  value: lang,
  label: LIGHT_WORDS[lang] ? LIGHT_WORDS[lang].language : 'Language',
  onChange: (code) => applyLang(code),
});
document.getElementById('lang-select').append(langSelect.node);

function applyLang(code) {
  store(LANG_KEY, code);
  engine.lang = code;
  gui.setLang(code);
  langSelect.setValue(code);
  paintLightLabels(code);
  paintStatus();
}

// ---- the status line ------------------------------------------------------
// Node, closed cases and journal size — the sidebar's numbers, up where they
// are readable from any panel. Written only when the string actually changes,
// because the frame loop asks every frame.

const statusHost = document.getElementById('bar-status');
let shownStatus = null;

function paintStatus() {
  if (!statusHost) return;
  const { node, closed, total, log } = gui.deskStatus();
  const line = `${node} · ${closed}/${total} · LOG ${log}`;
  if (line === shownStatus) return;
  shownStatus = line;
  statusHost.textContent = line;
}

// ---- the pulse ------------------------------------------------------------
// A block lands about every ten minutes, and it is the one clock this game
// shares with the world it plays against. One watcher drives all of it: the
// countdown in the strip, the explorer's card, and the sound.

const chime = new Chime();
const soundButton = document.getElementById('sound-toggle');

function paintSound() {
  soundButton.replaceChildren(
    icon(chime.enabled ? 'bell' : 'bellOff', { size: 12 }),
  );
  soundButton.setAttribute('aria-pressed', String(chime.enabled));
}

soundButton.addEventListener('click', () => {
  chime.setEnabled(!chime.enabled);
  paintSound();
  // Turning it on is a gesture, which is the only moment a browser will let
  // an audio context start — so take it, and let them hear what they enabled.
  if (chime.enabled && chime.unlock()) chime.play();
});
paintSound();

// Any first touch of the page is the browser's cue that sound is allowed.
for (const event of ['pointerdown', 'keydown']) {
  document.addEventListener(event, () => chime.unlock(), { once: true });
}

const pulseHost = document.getElementById('bar-pulse');
const heartbeat = new Heartbeat(explorer, {
  onBlock: (block, { changed }) => {
    gui.setPulse(0, block);
    if (changed) chime.play();
  },
  onTick: (age, block) => {
    gui.setPulse(age, block);
    if (!pulseHost || !block) return;
    const split = splitAge(age || 0);
    const clock = split.hours
      ? `${split.hours}:${pad2(split.minutes)}:${pad2(split.seconds)}`
      : `${split.minutes}:${pad2(split.seconds)}`;
    pulseHost.textContent = `#${block.height} · ${clock}`;
  },
});
heartbeat.start();

// ---- input plumbing -------------------------------------------------------

/** True while the Terminal panel is the one on screen. */
const atTerminal = () => gui.panel === 'terminal';

document.addEventListener('keydown', (event) => {
  const typing =
    event.target instanceof HTMLElement &&
    ['INPUT', 'TEXTAREA'].includes(event.target.tagName) &&
    event.target !== keyboardInput;

  if (!atTerminal()) {
    // Digits jump between panels, but never while the player is typing into
    // a search box or a seed field.
    if (
      !typing &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      gui.openByKey(event.key)
    ) {
      event.preventDefault();
    }
    return;
  }
  // Inside the terminal every key belongs to the terminal — including the
  // digits, which are part of half the commands.
  if (event.key === 'Tab') return;
  if (
    (event.ctrlKey || event.metaKey) &&
    ['c', 'v', 'r', 'l'].includes(event.key.toLowerCase())
  ) {
    if (event.key.toLowerCase() === 'l') {
      event.preventDefault();
      terminal.clear();
    }
    return;
  }
  keyboardInput.focus({ preventScroll: true });
  terminal.handleKey(event);
});

keyboardInput.addEventListener('input', () => {
  if (!keyboardInput.value) return;
  for (const char of keyboardInput.value) {
    terminal.handleKey({ key: char, preventDefault() {} });
  }
  keyboardInput.value = '';
});

document.addEventListener('paste', (event) => {
  if (!atTerminal()) return;
  const text = (event.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  event.preventDefault();
  terminal.setInput(terminal.input + text.replace(/\s+/g, ' ').trim());
});

screenFrame.addEventListener('click', () =>
  keyboardInput.focus({ preventScroll: true }),
);

termCanvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    terminal.scrollBy(event.deltaY > 0 ? -3 : 3);
  },
  { passive: false },
);

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    glitch.resize();
    if (atTerminal()) {
      terminal.fontSize = window.innerWidth < 640 ? 10 : 14;
      terminal.resize();
    }
  }, 120);
});

// Another browser tab may have written progress.
window.addEventListener('storage', () => gui.syncFromStorage());

// ---- animation loop -------------------------------------------------------

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(now - lastFrame, 100);
  lastFrame = now;

  glitch.render(now);

  if (atTerminal()) {
    terminal.tick(delta);
    terminal.render(now);
  }

  if (powerLed)
    powerLed.classList.toggle('is-busy', terminal.busy || pending > 0);
  requestAnimationFrame(frame);
}

gui.mount();
// The board is fetched in the background: the campaign plays immediately, and
// contract answers start being recognised the moment it lands.
loadContracts().then((cases) => {
  if (cases.length) gui.syncFromStorage();
});
paintLightLabels(lang);
paintStatus();
setLight(daylight.mode);
requestAnimationFrame(frame);
