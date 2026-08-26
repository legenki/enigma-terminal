// Shell: the glitch banner on top, the interface below, the daylight switch
// in the banner.
//
// The terminal is no longer a separate mode. It is the first panel in the
// sidebar, and this file hands its canvas to the GUI to adopt — the Terminal
// object, its scrollback and its input all survive the move, which is why the
// frame is reparented rather than rebuilt.

import { LANGS, loadContracts } from './core.js';
import { Daylight } from './daylight.js';
import { Engine } from './engine.js';
import { GlitchBanner } from './glitch.js';
import { GuiApp } from './gui/app.js';
import { migrated } from './storage.js';
import { Terminal } from './term.js';

const LANG_KEY = 'enigma-terminal/lang/v1';
const LIGHT_KEY = 'enigma-terminal/light/v1';

const stored = (key, fallback) => migrated(key) || fallback;
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice just will not persist */
  }
};

// Match the browser against every language we ship, not just Russian.
const preferred =
  (navigator.languages || [navigator.language || 'en'])
    .map((tag) => String(tag).slice(0, 2).toLowerCase())
    .find((code) => LANGS.includes(code)) || 'en';
const lang = stored(LANG_KEY, preferred);

const glitch = new GlitchBanner(document.getElementById('glitch-canvas'));

// ---- the terminal ---------------------------------------------------------

const termCanvas = document.getElementById('term-layer');
const keyboardInput = document.getElementById('keyboard-input');
const screenFrame = document.getElementById('screen-frame');
const guiRoot = document.getElementById('gui-root');
const powerLed = document.getElementById('power-led');

const terminal = new Terminal(termCanvas, {
  fontSize: window.innerWidth < 640 ? 12 : 16,
  prompt: 'nullsec@enigma:~$ ',
});

const engine = new Engine(terminal, { lang });
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

// The switch sits in the banner, outside the GUI, so it carries its own four
// languages. It was the last thing on the page still pinned to one.
const LIGHT_WORDS = {
  en: { caption: 'Light', live: 'LIVE', light: 'DAY', dark: 'NIGHT' },
  ru: { caption: 'Свет', live: 'LIVE', light: 'ДЕНЬ', dark: 'НОЧЬ' },
  es: { caption: 'Luz', live: 'LIVE', light: 'DÍA', dark: 'NOCHE' },
  pt: { caption: 'Luz', live: 'LIVE', light: 'DIA', dark: 'NOITE' },
};
const lightCaption = document.getElementById('light-caption');

function paintLightLabels(code) {
  const words = LIGHT_WORDS[code] || LIGHT_WORDS.en;
  // Screen readers announce the page in whatever the player is reading.
  document.documentElement.lang = code;
  if (lightCaption) lightCaption.textContent = words.caption;
  for (const [key, button] of Object.entries(lightButtons)) {
    button.textContent = words[key];
  }
}

// Written on the document root, not the GUI: the shell around it — the ground
// and the type behind every panel — belongs to the same daylight.
const daylight = new Daylight(document.documentElement, {
  mode: stored(LIGHT_KEY, 'live'),
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
      terminal.fontSize = window.innerWidth < 640 ? 12 : 16;
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
setLight(daylight.mode);
requestAnimationFrame(frame);
