// Shell: glitch banner on top, two interchangeable modes below, retro rocker
// switch at the bottom. The GUI is DOM; the command line is canvas + WebGL.

import { Terminal } from './term.js';
import { CrtRenderer } from './crt.js';
import { Engine } from './engine.js';
import { GlitchBanner } from './glitch.js';
import { GuiApp } from './gui/app.js';

const MODE_KEY = 'neon-terminal/mode/v1';
const LANG_KEY = 'neon-terminal/lang/v1';
const CRT_KEY = 'neon-terminal/crt/v1';

const stored = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch { /* private mode: the choice just will not persist */ }
};

const lang = stored(LANG_KEY, navigator.language.startsWith('ru') ? 'ru' : 'en');

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
  prompt: 'nullsec@neon:~$ ',
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
    if (mode === 'gui') gui.syncFromStorage();
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

// ---- CRT simulation, over both modes --------------------------------------
//
// The command line runs a real WebGL tube; the GUI is DOM and gets a CSS
// overlay instead. One switch drives both so the two modes always look like
// the same monitor.

let crtMode = stored(CRT_KEY, 'soft') === 'off' ? 'off' : 'soft';

const crtButtons = {
  soft: document.getElementById('crt-soft'),
  off: document.getElementById('crt-off'),
};

function setCrt(next, { announce = true } = {}) {
  crtMode = next === 'off' ? 'off' : 'soft';
  store(CRT_KEY, crtMode);
  crtButtons.soft.setAttribute('aria-pressed', String(crtMode === 'soft'));
  crtButtons.off.setAttribute('aria-pressed', String(crtMode === 'off'));
  document.body.classList.toggle('crt-soft', crtMode === 'soft');
  if (crt) {
    crt.applyPreset(crtMode === 'soft' ? 'soft' : 'off');
    if (crtMode === 'soft') terminal.dirty = true;
  }
  if (announce) glitch.kick(0.8);
}

crtButtons.soft.addEventListener('click', () => setCrt('soft'));
crtButtons.off.addEventListener('click', () => setCrt('off'));

// ---- mode switching -------------------------------------------------------

let mode = stored(MODE_KEY, 'gui') === 'cl' ? 'cl' : 'gui';
let booted = false;

const buttons = {
  gui: document.getElementById('mode-gui'),
  cl: document.getElementById('mode-cl'),
};

function setMode(next, { animate = true } = {}) {
  mode = next === 'cl' ? 'cl' : 'gui';
  store(MODE_KEY, mode);
  buttons.gui.setAttribute('aria-pressed', String(mode === 'gui'));
  buttons.cl.setAttribute('aria-pressed', String(mode === 'cl'));
  guiRoot.classList.toggle('is-hidden', mode !== 'gui');
  screenFrame.classList.toggle('is-hidden', mode !== 'cl');
  if (animate) glitch.kick(1.6);

  if (mode === 'cl') {
    // The terminal was display:none, so its box had no size to measure.
    terminal.resize();
    if (crt) crt.resize();
    terminal.dirty = true;
    keyboardInput.focus({ preventScroll: true });
    if (!booted) {
      booted = true;
      engine.boot().then(() => {
        if (!crt) {
          terminal.print('[WARN] WEBGL UNAVAILABLE — CRT SHADER DISABLED, TEXT MODE ONLY.', 'amber');
        }
      });
    }
  } else {
    // The command line shares progress and journal, so re-read both.
    gui.syncFromStorage();
  }
}

buttons.gui.addEventListener('click', () => setMode('gui'));
buttons.cl.addEventListener('click', () => setMode('cl'));

// ---- input plumbing -------------------------------------------------------

document.addEventListener('keydown', (event) => {
  if (event.key === 'F2') {
    event.preventDefault();
    setMode(mode === 'cl' ? 'gui' : 'cl');
    return;
  }
  if (mode !== 'cl') return;
  if (event.key === 'Tab') return;
  if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'r', 'l'].includes(event.key.toLowerCase())) {
    if (event.key.toLowerCase() === 'l') { event.preventDefault(); terminal.clear(); }
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
  if (mode !== 'cl') return;
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
    if (mode === 'cl') {
      terminal.fontSize = window.innerWidth < 640 ? 12 : 16;
      terminal.resize();
      if (crt) crt.resize();
    }
  }, 120);
});

// Another tab (or the other mode) may have written progress.
window.addEventListener('storage', () => {
  if (mode === 'gui') gui.syncFromStorage();
});

// ---- animation loop -------------------------------------------------------

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(now - lastFrame, 100);
  lastFrame = now;

  glitch.render(now);

  if (mode === 'cl') {
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

  powerLed.classList.toggle('is-busy', terminal.busy || pending > 0);
  requestAnimationFrame(frame);
}

gui.mount();
setCrt(crtMode, { announce: false });
setMode(mode, { animate: false });
requestAnimationFrame(frame);
