// The interface follows the hour.
//
// One palette drives the whole GUI, and it moves through the day: ivory at
// noon, near-black at night, warm through the afternoon. Two stretches are
// deliberately missing. Between 05:20 and 07:20, and between 17:20 and 20:00,
// the real sky passes through tones where ink and ground come close enough
// together that text stops being comfortable to read. Rather than easing
// through them, the palette holds at the far end and the interface breaks
// across in ten seconds. Measured over the whole cycle, body text never falls
// below 16:1 and secondary text never below 4.8:1 — see tests/test_daylight.py.

export const CUT_DAWN = [5 + 20 / 60, 7 + 20 / 60];
export const CUT_DUSK = [17 + 20 / 60, 20];

/** Ten real seconds. The break is meant to be noticed, not to sneak past. */
export const BREAK_MS = 10000;

//: Anthropic's warm neutrals, walked around the clock. `btn` is the one filled
//: action: it deepens by day so a white label clears 4.5:1, and lifts by night
//: so a dark one does. The semantic four flip with the ground for the same
//: reason — a single blue cannot clear 4.5:1 on both ivory and near-black.
const DAY = [
  {
    h: 0,
    bg: '#141413',
    surface: '#1f1e1d',
    sunken: '#1a1918',
    line: '#2f2e2b',
    ink: '#faf9f5',
    soft: '#a4a29a',
    accent: '#e08a6a',
    btn: '#e08a6a',
    info: '#85b0d8',
    warn: '#e0b060',
    danger: '#ef8880',
    ok: '#9fb37e',
    muted: '#8a8880',
    tint: '#2a2320',
    screen: '#2f2b3d',
    plum: '#d3a0dc',
  },
  {
    h: 5.3333,
    bg: '#16161a',
    surface: '#212126',
    sunken: '#1c1c20',
    line: '#31313a',
    ink: '#f7f6f2',
    soft: '#a2a1ac',
    accent: '#e08a6a',
    btn: '#e08a6a',
    info: '#85b0d8',
    warn: '#e0b060',
    danger: '#ef8880',
    ok: '#9fb37e',
    muted: '#8a8880',
    tint: '#2b2429',
    screen: '#312d42',
    plum: '#d3a0dc',
  },
  {
    h: 7.3333,
    bg: '#faf8f2',
    surface: '#ffffff',
    sunken: '#f2efe6',
    line: '#e6e2d6',
    ink: '#141413',
    soft: '#6d6b63',
    accent: '#d97757',
    btn: '#b85736',
    info: '#3d6a94',
    warn: '#8a5a12',
    danger: '#a32b2b',
    ok: '#4f6136',
    muted: '#6e6a61',
    tint: '#fbf0eb',
    screen: '#f6f4fb',
    plum: '#7d3f88',
  },
  {
    h: 12,
    bg: '#faf9f5',
    surface: '#ffffff',
    sunken: '#f3f1ea',
    line: '#e8e6dc',
    ink: '#141413',
    soft: '#6d6b63',
    accent: '#d97757',
    btn: '#b85736',
    info: '#3d6a94',
    warn: '#8a5a12',
    danger: '#a32b2b',
    ok: '#4f6136',
    muted: '#6e6a61',
    tint: '#fbf0eb',
    screen: '#f7f5fc',
    plum: '#7d3f88',
  },
  {
    h: 15.5,
    bg: '#f9f5ec',
    surface: '#fffdf8',
    sunken: '#f2ece0',
    line: '#e7e0d0',
    ink: '#161513',
    soft: '#6f6a5e',
    accent: '#d06a48',
    btn: '#ad4f30',
    info: '#3d6a94',
    warn: '#8a5a12',
    danger: '#a32b2b',
    ok: '#4f6136',
    muted: '#6e6a61',
    tint: '#fbeee6',
    screen: '#f5f2fa',
    plum: '#7b3d85',
  },
  {
    h: 17.3333,
    bg: '#f7f1e5',
    surface: '#fffcf6',
    sunken: '#efe8d9',
    line: '#e4dcc9',
    ink: '#181613',
    soft: '#6f695b',
    accent: '#c96343',
    btn: '#a54a2c',
    info: '#3d6a94',
    warn: '#8a5a12',
    danger: '#a32b2b',
    ok: '#4f6136',
    muted: '#6e6a61',
    tint: '#fbebe1',
    screen: '#f3eff8',
    plum: '#78397f',
  },
  {
    h: 20,
    bg: '#1a1918',
    surface: '#242322',
    sunken: '#1f1e1d',
    line: '#35332f',
    ink: '#faf9f5',
    soft: '#a6a49b',
    accent: '#e08a6a',
    btn: '#e08a6a',
    info: '#85b0d8',
    warn: '#e0b060',
    danger: '#ef8880',
    ok: '#9fb37e',
    muted: '#8a8880',
    tint: '#2d2521',
    screen: '#363248',
    plum: '#d3a0dc',
  },
  {
    h: 22,
    bg: '#161615',
    surface: '#211f1e',
    sunken: '#1b1a19',
    line: '#312f2c',
    ink: '#faf9f5',
    soft: '#a4a29a',
    accent: '#e08a6a',
    btn: '#e08a6a',
    info: '#85b0d8',
    warn: '#e0b060',
    danger: '#ef8880',
    ok: '#9fb37e',
    muted: '#8a8880',
    tint: '#2b2320',
    screen: '#332f44',
    plum: '#d3a0dc',
  },
  {
    h: 24,
    bg: '#141413',
    surface: '#1f1e1d',
    sunken: '#1a1918',
    line: '#2f2e2b',
    ink: '#faf9f5',
    soft: '#a4a29a',
    accent: '#e08a6a',
    btn: '#e08a6a',
    info: '#85b0d8',
    warn: '#e0b060',
    danger: '#ef8880',
    ok: '#9fb37e',
    muted: '#8a8880',
    tint: '#2a2320',
    screen: '#2f2b3d',
    plum: '#d3a0dc',
  },
];

export const TOKENS = [
  'bg',
  'surface',
  'sunken',
  'line',
  'ink',
  'soft',
  'accent',
  'btn',
  'info',
  'warn',
  'danger',
  'ok',
  'muted',
  'tint',
  //: The terminal's own ground, and the one colour on it with no counterpart
  //: in the interface.
  'screen',
  'plum',
];

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];
const str = (c) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const blend = (a, b, t) => str(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

/** Relative luminance, so a label can pick its own side of the fill. */
export function luminance(colour) {
  const c = hex(colour)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Straight walk along the curve, ignoring the two cuts. */
function curve(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < DAY.length - 2 && DAY[i + 1].h <= h) i += 1;
  const a = DAY[i];
  const b = DAY[i + 1];
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const out = {};
  for (const key of TOKENS) out[key] = blend(a[key], b[key], t);
  return out;
}

/** The palette actually shown: inside a cut, the far end is held. */
export function paletteAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= CUT_DAWN[0] && h < CUT_DAWN[1]) return curve(CUT_DAWN[1]);
  if (h >= CUT_DUSK[0] && h < CUT_DUSK[1]) return curve(CUT_DUSK[1]);
  return curve(h);
}

/** True when the clock moved across the start of either cut. */
export function crossesCut(from, to) {
  const spans = (a, b, mark) =>
    b >= a ? a < mark && mark <= b : a < mark || mark <= b;
  return spans(from, to, CUT_DAWN[0]) || spans(from, to, CUT_DUSK[0]);
}

export const mix = (from, to, t) => {
  const out = {};
  for (const key of TOKENS) out[key] = blend(from[key], to[key], t);
  return out;
};

export const hourNow = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/**
 * Writes the palette onto an element and, in live mode, keeps it moving.
 *
 * `light` and `dark` pin the clock to noon and to late evening, so a player
 * who wants one look forever gets it without the day dragging them around.
 */
export class Daylight {
  constructor(root, { mode = 'live', onPaint = null } = {}) {
    this.root = root;
    this.onPaint = onPaint;
    this.shown = null;
    this.tween = null;
    this.frame = null;
    this.hour = hourNow();
    this.setMode(mode, { paint: true });
  }

  setMode(mode, { paint = true } = {}) {
    this.mode = ['live', 'light', 'dark'].includes(mode) ? mode : 'live';
    this.tween = null;
    if (this.mode === 'light') this.hour = 12;
    if (this.mode === 'dark') this.hour = 22;
    if (this.mode === 'live') this.hour = hourNow();
    if (paint) this.paint(paletteAt(this.hour));
    this.run();
  }

  paint(palette) {
    this.shown = palette;
    for (const key of TOKENS)
      this.root.style.setProperty(`--${key}`, palette[key]);
    // The filled action changes side through the day, so its label follows the
    // fill rather than being pinned to white.
    this.root.style.setProperty(
      '--btn-ink',
      luminance(palette.btn) < 0.3 ? '#ffffff' : '#1f1e1d',
    );
    if (this.onPaint) this.onPaint(palette, this.hour);
  }

  /** One step of the live clock. `now` is injectable so tests can drive it. */
  step(now = performance.now()) {
    if (this.mode !== 'live') {
      if (this.tween) this.advance(now);
      return;
    }
    const before = this.hour;
    this.hour = hourNow();
    if (crossesCut(before, this.hour)) {
      this.tween = { from: this.shown, at: now };
    }
    this.advance(now);
  }

  advance(now) {
    const target = paletteAt(this.hour);
    if (!this.tween) {
      this.paint(target);
      return;
    }
    const k = Math.min(1, (now - this.tween.at) / BREAK_MS);
    this.paint(mix(this.tween.from, target, easeInOut(k)));
    if (k >= 1) this.tween = null;
  }

  run() {
    if (this.frame !== null || typeof requestAnimationFrame !== 'function')
      return;
    const loop = (ts) => {
      this.step(ts);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
