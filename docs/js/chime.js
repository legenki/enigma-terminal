// The sound a block makes when it lands.
//
// Synthesised rather than loaded: three short notes from an oscillator cost
// nothing to ship, need no asset and no CDN, and the whole page already refuses
// to depend on anything it did not build. It is a rising fifth and an octave —
// D5, A5, D6 — which is a small enough figure to hear every ten minutes for an
// evening without wanting it gone.
//
// Two rules a notification sound owes the person hearing it: it cannot start
// before they have touched the page (browsers enforce this, and they are
// right), and it must be possible to turn off. Both are here.

//: D5, A5, D6. The third is barely there — it rounds the figure off rather
//: than adding a note of its own.
const FIGURE = [
  { hz: 587.33, at: 0, hold: 0.19, gain: 0.09 },
  { hz: 880.0, at: 0.11, hold: 0.2, gain: 0.075 },
  { hz: 1174.66, at: 0.21, hold: 0.26, gain: 0.035 },
];

const STORAGE_KEY = 'enigma-terminal/sound/v1';

export class Chime {
  constructor({ enabled = true, storage = null } = {}) {
    this.storage = storage || safeStorage();
    const saved = this.storage.get(STORAGE_KEY);
    this.enabled = saved === null ? enabled : saved === 'on';
    this.context = null;
  }

  setEnabled(next) {
    this.enabled = Boolean(next);
    this.storage.set(STORAGE_KEY, this.enabled ? 'on' : 'off');
    if (this.enabled) this.unlock();
    return this.enabled;
  }

  /**
   * Bring the audio context up, if the browser will allow it yet.
   *
   * Called from a click or a keypress: an AudioContext created without one
   * starts suspended, and a chime played into a suspended context is silence
   * that looks like a bug.
   */
  unlock() {
    if (!this.enabled) return false;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    if (!this.context) {
      try {
        this.context = new Ctor();
      } catch {
        return false;
      }
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context.state === 'running';
  }

  /** The figure, once. Silent and harmless when muted or not yet unlocked. */
  play() {
    if (!this.enabled || !this.context || this.context.state !== 'running')
      return false;
    const ctx = this.context;
    const start = ctx.currentTime + 0.01;
    for (const note of FIGURE) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Triangle rather than sine: a little more body, none of a square's edge.
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.hz, start + note.at);
      // Ramped rather than switched, or every note starts with a click.
      gain.gain.setValueAtTime(0.0001, start + note.at);
      gain.gain.exponentialRampToValueAtTime(
        note.gain,
        start + note.at + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + note.at + note.hold,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + note.at);
      osc.stop(start + note.at + note.hold + 0.02);
    }
    return true;
  }
}

function safeStorage() {
  return {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* private mode: the choice just will not persist */
      }
    },
  };
}

export { FIGURE, STORAGE_KEY };
