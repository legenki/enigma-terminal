// Shell: glitch banner on top, two interchangeable modes below, retro rocker
// switch at the bottom. The GUI is DOM; the command line is canvas + WebGL.

import { Terminal } from './term.js';
import { CrtRenderer } from './crt.js';
import { Engine } from './engine.js';
import { GlitchBanner } from './glitch.js';
import { GuiApp } from './gui/app.js';
import { LANGS, loadContracts } from './core.js';
import { migrated } from './storage.js';
import { Daylight } from './daylight.js';

const LANG_KEY = 'enigma-terminal/lang/v1';
const LIGHT_KEY = 'enigma-terminal/light/v1';

const stored = (key, fallback) => migrated(key) || fallback;
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch { /* private mode: the choice just will not persist */ }
};

// Match the browser against every language we ship, not just Russian.
const preferred = (navigator.languages || [navigator.language || 'en'])
  .map((tag) => String(tag).slice(0, 2).toLowerCase())
  .find((code) => LANGS.includes(code)) || 'en';
const lang = stored(LANG_KEY, preferred);

const glitch = new GlitchBanner(document.getElementById('glitch-canvas'));

// ---- command-line mode ----------------------------------------------------

const termCanvas = document.getElementById('term-layer');
const crtCanvas = document.getElementById('crt-layer');
const keyboardInput = document.getElementById('keyboard-input');
const screenFrame = document.getElementById('screen-frame');
const guiRoot = document.getElementById('gui-root');
const powerLed = document.getElementById('power-led');

const terminal = new Terminal(termCanvas, {
  fontSize: window.innerWidth < 640 ? 12 : 16,
  prompt: 'nullsec@enigma:~$ ',
});

let crt = null;
try {
  crt = new CrtRenderer(crtCanvas, termCanvas);
  termCanvas.classList.add('is-source');
} catch (error) {
  crtCanvas.classList.add('is-hidden');
  console.warn('CRT shader unavailable:', error.message);
}

const engine = new Engine(terminal, { crt, lang });
let pending = 0;
terminal.onCommand = (line) => {
  pending += 1;
  engine.run(line).finally(() => {
    pending -= 1;
    // The GUI shares progress with the terminal — repaint after every command.
    gui.syncFromStorage();
  });
};

// ---- GUI mode -------------------------------------------------------------

const gui = new GuiApp(guiRoot, {
  lang,
  onLangChange: (code) => {
    store(LANG_KEY, code);
    engine.lang = code;
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

// Written on the document root, not the GUI: the shell around it — footer,
// ground, switch labels — belongs to the same daylight.
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

// ---- terminal boot --------------------------------------------------------

document.body.classList.add('is-gui');
document.body.classList.add('crt-soft');

let booted = false;
export function bootTerminal() {
  if (booted) return;
  booted = true;
  terminal.resize();
  if (crt) crt.resize();
  terminal.dirty = true;
  engine.boot().then(() => {
    if (!crt) {
      terminal.print('[WARN] WEBGL UNAVAILABLE — CRT SHADER DISABLED, TEXT MODE ONLY.', 'amber');
    }
  });
}
window.bootTerminal = bootTerminal;

// ---- input plumbing -------------------------------------------------------

document.addEventListener('keydown', (event) => {
  const isTerminal = document.activeElement === keyboardInput;
  if (!isTerminal) {
    const typing = event.target instanceof HTMLElement
      && ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
    if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey
        && gui.openByKey(event.key)) {
      event.preventDefault();
    }
    return;
  }
  if (event.key === 'Tab') return;
  if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'r', 'l'].includes(event.key.toLowerCase())) {
    if (event.key.toLowerCase() === 'l') { event.preventDefault(); terminal.clear(); }
    return;
  }
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
  if (document.activeElement !== keyboardInput) return;
  const text = (event.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  event.preventDefault();
  terminal.setInput(terminal.input + text.replace(/\s+/g, ' ').trim());
});

screenFrame.addEventListener('click', () => keyboardInput.focus({ preventScroll: true }));

crtCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  terminal.scrollBy(event.deltaY > 0 ? -3 : 3);
}, { passive: false });

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    glitch.resize();
    terminal.fontSize = window.innerWidth < 640 ? 12 : 16;
    terminal.resize();
    if (crt) crt.resize();
  }, 120);
});

window.addEventListener('storage', () => {
  gui.syncFromStorage();
});

// ---- animation loop -------------------------------------------------------

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(now - lastFrame, 100);
  lastFrame = now;

  glitch.render(now);

  if (screenFrame.offsetParent !== null) {
    terminal.tick(delta);
    terminal.render(now);
    if (crt && crt.enabled) {
      termCanvas.classList.add('is-source');
      crtCanvas.classList.remove('is-hidden');
      crt.render(now / 1000);
    } else if (crt) {
      termCanvas.classList.remove('is-source');
      crtCanvas.classList.add('is-hidden');
    }
  }

  // powerLed is removed, so we don't toggle it
  requestAnimationFrame(frame);
}

gui.mount();
loadContracts().then((cases) => {
  if (cases.length) gui.syncFromStorage();
});
setLight(daylight.mode);
requestAnimationFrame(frame);

const observer = new ResizeObserver(() => {
  if (screenFrame.offsetParent !== null) {
    terminal.resize();
    if (crt) crt.resize();
  }
});
observer.observe(screenFrame);
