// Wiring: terminal canvas -> CRT shader -> animation loop -> game engine.

import { Terminal } from './term.js';
import { CrtRenderer } from './crt.js';
import { Engine } from './engine.js';

const termCanvas = document.getElementById('term-layer');
const crtCanvas = document.getElementById('crt-layer');
const keyboardInput = document.getElementById('keyboard-input');
const bezel = document.getElementById('bezel');
const powerLed = document.getElementById('power-led');

const terminal = new Terminal(termCanvas, {
  fontSize: window.innerWidth < 640 ? 12 : 16,
  prompt: 'nullsec@neon:~$ ',
});

let crt = null;
try {
  crt = new CrtRenderer(crtCanvas, termCanvas);
  termCanvas.classList.add('is-source');   // keep it laid out, but invisible
} catch (error) {
  // No WebGL: show the plain 2D canvas and say so once the engine has booted.
  crtCanvas.classList.add('is-hidden');
  console.warn('CRT shader unavailable:', error.message);
}

const engine = new Engine(terminal, { crt, lang: navigator.language.startsWith('ru') ? 'ru' : 'en' });

let queueDepth = 0;
terminal.onCommand = (line) => {
  queueDepth += 1;
  engine.run(line).finally(() => { queueDepth -= 1; });
};

// -- input plumbing ---------------------------------------------------------
// A hidden input keeps software keyboards and IME composition working; the
// canvas itself cannot receive text events.

const focusInput = () => keyboardInput.focus({ preventScroll: true });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') return;
  if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'r', 'l'].includes(event.key.toLowerCase())) {
    if (event.key.toLowerCase() === 'l') { event.preventDefault(); terminal.clear(); }
    return;
  }
  focusInput();
  terminal.handleKey(event);
});

// Mobile / IME: mirror whatever lands in the hidden input into the terminal.
keyboardInput.addEventListener('input', () => {
  if (keyboardInput.value) {
    for (const char of keyboardInput.value) {
      terminal.handleKey({ key: char, preventDefault() {} });
    }
    keyboardInput.value = '';
  }
});

document.addEventListener('paste', (event) => {
  const text = (event.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  event.preventDefault();
  terminal.setInput(terminal.input + text.replace(/\s+/g, ' ').trim());
});

bezel.addEventListener('click', focusInput);
bezel.addEventListener('touchend', focusInput);

crtCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  terminal.scrollBy(event.deltaY > 0 ? -3 : 3);
}, { passive: false });

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    terminal.fontSize = window.innerWidth < 640 ? 12 : 16;
    terminal.resize();
    if (crt) crt.resize();
  }, 120);
});

// -- animation loop ---------------------------------------------------------

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(now - lastFrame, 100);
  lastFrame = now;

  terminal.tick(delta);
  const redrew = terminal.render(now);

  if (crt && crt.enabled) {
    // The CRT pass animates (noise, flicker, roll) even when text is static.
    crt.render(now / 1000);
  } else if (crt && !crt.enabled && redrew) {
    termCanvas.classList.remove('is-source');
    crtCanvas.classList.add('is-hidden');
  }
  if (crt && crt.enabled) {
    termCanvas.classList.add('is-source');
    crtCanvas.classList.remove('is-hidden');
  }

  powerLed.classList.toggle('is-busy', terminal.busy || queueDepth > 0);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
focusInput();

engine.boot().then(() => {
  if (!crt) {
    terminal.print('[WARN] WEBGL UNAVAILABLE — CRT SHADER DISABLED, TEXT MODE ONLY.', 'amber');
  }
});
