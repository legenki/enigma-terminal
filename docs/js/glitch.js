// The glitch banner pinned above the interface: RGB-split wordmark, scanlines,
// and occasional horizontal tear slices. Plain 2D canvas, deliberately cheap —
// it is on screen the whole time the game is open.

const TITLE = 'BIP-39: ENIGMA TERMINAL';
const SUBTITLE = 'REAL NET BUILD';
//: What is left of the wordmark once the banner is 18px instead of 72. The
//: whole title cannot be read at that size, so the mark carries the two
//: characters that are the game's name and the split does the rest.
const MARK = '39';

export class GlitchBanner {
  constructor(canvas, { compact = false } = {}) {
    this.canvas = canvas;
    //: Compact is the shipped shape: a mark beside a typed wordmark, rather
    //: than a canvas trying to be the wordmark itself.
    this.compact = compact;
    this.ctx = canvas.getContext('2d');
    this.slices = [];
    this.nextBurst = 0;
    this.intensity = 1;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    // The floor exists so a banner measured before layout still draws
    // something readable. It has to shrink with the mark, or an 18px canvas
    // is told it is 200 wide and draws the wordmark off its own left edge.
    const floor = this.compact ? 12 : 200;
    this.width = Math.max(rect.width, floor);
    this.height = Math.max(rect.height, this.compact ? 12 : 40);
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Schedule a burst of tearing — used when the mode switches. */
  kick(strength = 1) {
    this.nextBurst = 0;
    this.intensity = 1 + strength;
  }

  render(now) {
    const ctx = this.ctx;
    const { width: w, height: h } = this;
    const seconds = now / 1000;

    ctx.setTransform(
      Math.min(window.devicePixelRatio || 1, 2),
      0,
      0,
      Math.min(window.devicePixelRatio || 1, 2),
      0,
      0,
    );
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);

    // Faint scrolling grid, so the banner is never fully static.
    ctx.strokeStyle = 'rgba(57, 255, 139, 0.10)';
    ctx.lineWidth = 1;
    const step = this.compact ? 6 : 22;
    const drift = (seconds * 14) % step;
    ctx.beginPath();
    for (let x = -step + drift; x < w + step; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.4, h);
    }
    ctx.stroke();

    if (this.compact) {
      this.renderMark(seconds);
      return;
    }

    const fontSize = Math.max(15, Math.min(30, w / 22));
    ctx.font = `700 ${fontSize}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const titleX = 18;
    const titleY = h / 2 - (w > 560 ? 5 : 0);
    const wobble = Math.sin(seconds * 2.1) * 1.5 * this.intensity;

    // RGB split: the same text three times, offset per channel.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff2f6d';
    ctx.fillText(TITLE, titleX - wobble - 1.4, titleY);
    ctx.fillStyle = '#28e0ff';
    ctx.fillText(TITLE, titleX + wobble + 1.4, titleY);
    ctx.fillStyle = '#8fffc4';
    ctx.fillText(TITLE, titleX, titleY);
    ctx.globalCompositeOperation = 'source-over';

    if (w > 560) {
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(125, 156, 140, 0.85)';
      ctx.fillText(SUBTITLE, titleX + 2, titleY + fontSize * 0.92);
    }

    // Tear slices: copy narrow bands sideways.
    if (now > this.nextBurst) {
      this.nextBurst = now + 900 + Math.random() * 2600;
      const count = 1 + Math.floor(Math.random() * 3 * this.intensity);
      this.slices = Array.from({ length: count }, () => ({
        y: Math.random() * h,
        height: 2 + Math.random() * 9,
        shift: (Math.random() - 0.5) * 46 * this.intensity,
        until: now + 70 + Math.random() * 180,
      }));
      this.intensity = Math.max(1, this.intensity * 0.6);
    }
    this.slices = this.slices.filter((slice) => slice.until > now);
    for (const slice of this.slices) {
      const y = Math.max(0, Math.min(h - 1, slice.y));
      const height = Math.min(slice.height, h - y);
      if (height <= 0) continue;
      ctx.drawImage(
        this.canvas,
        0,
        y,
        this.width,
        height,
        slice.shift,
        y,
        this.width,
        height,
      );
    }

    // Scanlines on top of everything.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // Phosphor edge glow along the bottom seam.
    const glow = ctx.createLinearGradient(0, h - 8, 0, h);
    glow.addColorStop(0, 'rgba(57, 255, 139, 0)');
    glow.addColorStop(1, 'rgba(57, 255, 139, 0.30)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, h - 8, w, 8);
  }

  /**
   * The 18px mark: the same three-channel split, nothing else.
   *
   * No subtitle and no tear slices — at this size a slice is half a glyph and
   * reads as a broken icon rather than as a flicker. The wobble is the whole
   * effect, and it is enough because the mark sits beside typed words that
   * hold still.
   */
  renderMark(seconds) {
    const ctx = this.ctx;
    const { width: w, height: h } = this;
    const wobble = Math.sin(seconds * 2.1) * 0.7 * this.intensity;

    ctx.font = `700 ${Math.max(9, h * 0.6)}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff2f6d';
    ctx.fillText(MARK, w / 2 - wobble - 0.9, h / 2);
    ctx.fillStyle = '#28e0ff';
    ctx.fillText(MARK, w / 2 + wobble + 0.9, h / 2);
    ctx.fillStyle = '#8fffc4';
    ctx.fillText(MARK, w / 2, h / 2);
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  }
}
