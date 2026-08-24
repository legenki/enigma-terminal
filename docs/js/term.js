// A canvas-rendered terminal: fixed character grid, scrollback, typewriter
// output and a hidden input that keeps mobile keyboards working. Drawing to a
// 2D canvas rather than DOM text is what lets crt.js push the whole screen
// through a WebGL post-processing chain.

export const PALETTE = {
  green: '#39ff8b',
  dark: '#1f8c4d',
  dim: '#126a45',
  cyan: '#4df3ff',
  magenta: '#ff4dd2',
  amber: '#ffc23d',
  red: '#ff3b5c',
  grey: '#7d9c8c',
  white: '#e8fff4',
};

const CURSOR_BLINK_MS = 530;
const INSTANT_LINES_PER_FRAME = 160;

const colourOf = (style) => PALETTE[style] || style || PALETTE.green;

export class Terminal {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fontSize = options.fontSize || 16;
    this.lineHeight = options.lineHeight || 1.35;
    this.maxScrollback = options.maxScrollback || 4000;
    this.prompt = options.prompt || 'nullsec@neon:~$ ';
    this.onCommand = options.onCommand || (() => {});

    this.lines = [];       // committed rows, each an array of {text, color}
    this.queue = [];       // every write passes through here, preserving order
    this.input = '';
    this.cursor = 0;
    this.history = [];
    this.historyIndex = -1;
    this.scrollOffset = 0;
    this.busy = false;     // a command is running
    this.locked = false;   // boot sequence owns the screen
    this.typeSpeed = options.typeSpeed || 1;
    this.cursorVisible = true;
    this.dirty = true;
    this._lastBlink = 0;

    this.resize();
  }

  // -- geometry ------------------------------------------------------------

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 240);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.dpr = dpr;
    this.width = width;
    this.height = height;

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${this.fontSize}px "IBM Plex Mono", "Courier New", monospace`;
    this.cellWidth = ctx.measureText('M').width;
    this.cellHeight = Math.round(this.fontSize * this.lineHeight);
    this.cols = Math.max(Math.floor(width / this.cellWidth) - 2, 24);
    this.rows = Math.max(Math.floor(height / this.cellHeight) - 1, 8);
    this.dirty = true;
  }

  // -- output --------------------------------------------------------------

  /** Break a segment list into rows no wider than the grid. */
  wrap(segments) {
    const rows = [];
    let current = [];
    let used = 0;
    for (const segment of segments) {
      let text = segment.text;
      if (!text) continue;
      while (text.length) {
        const room = this.cols - used;
        if (room <= 0) { rows.push(current); current = []; used = 0; continue; }
        current.push({ text: text.slice(0, room), color: segment.color });
        used += Math.min(room, text.length);
        text = text.slice(room);
      }
    }
    rows.push(current);
    return rows;
  }

  commit(segments) {
    for (const row of this.wrap(segments)) this.lines.push(row);
    if (this.lines.length > this.maxScrollback) {
      this.lines.splice(0, this.lines.length - this.maxScrollback);
    }
    this.dirty = true;
  }

  /**
   * Print a line. `text` is a string, or an array of `{text, style}` segments
   * when one line mixes colours.
   */
  print(text = '', style = 'green') {
    const segments = Array.isArray(text)
      ? text.map((s) => ({ text: String(s.text), color: colourOf(s.style) }))
      : [{ text: String(text), color: colourOf(style) }];
    this.queue.push({ instant: true, segments });
    return this;
  }

  /** Queue a line that appears character by character. */
  type(text = '', style = 'green', cps = 420) {
    this.queue.push({
      text: String(text), color: colourOf(style), cps, index: 0, acc: 0, start: -1,
    });
    return this;
  }

  blank(count = 1) {
    for (let i = 0; i < count; i++) this.print('');
    return this;
  }

  printLines(lines, style = 'green') {
    for (const line of lines) this.print(line, style);
    return this;
  }

  typeLines(lines, style = 'green', cps = 420) {
    for (const line of lines) this.type(line, style, cps);
    return this;
  }

  rule(char = '-', style = 'dark') {
    return this.print(char.repeat(Math.min(this.cols, 66)), style);
  }

  keyValue(key, value, keyStyle = 'grey', valueStyle = 'green', width = 18) {
    return this.print([
      { text: `${String(key).padEnd(width)}: `, style: keyStyle },
      { text: String(value), style: valueStyle },
    ]);
  }

  clear() {
    this.lines = [];
    this.queue = [];
    this.scrollOffset = 0;
    this.dirty = true;
  }

  get animating() {
    return this.queue.length > 0;
  }

  /** Drain the write queue; called once per animation frame. */
  tick(deltaMs) {
    let budget = INSTANT_LINES_PER_FRAME;
    while (this.queue.length) {
      const job = this.queue[0];

      if (job.instant) {
        if (budget-- <= 0) break;
        this.commit(job.segments);
        this.queue.shift();
        continue;
      }

      if (job.start < 0) {
        job.start = this.lines.length;
        this.lines.push([]);
      }
      job.acc += (deltaMs / 1000) * job.cps * this.typeSpeed;
      const take = Math.floor(job.acc);
      if (take < 1) break;
      job.acc -= take;
      job.index = Math.min(job.text.length, job.index + take);

      // The job always owns the tail of the buffer, so replacing from `start`
      // to the end keeps wrapped rows consistent as the line grows.
      const rows = this.wrap([{ text: job.text.slice(0, job.index), color: job.color }]);
      this.lines.splice(job.start, this.lines.length - job.start, ...rows);
      this.dirty = true;

      if (job.index >= job.text.length) this.queue.shift();
      else break;
    }
    if (this.scrollOffset > 0) this.scrollOffset = 0;
  }

  /** Empty the queue instantly — used when the player skips an animation. */
  flush() {
    while (this.queue.length) {
      const job = this.queue.shift();
      if (job.instant) this.commit(job.segments);
      else if (job.start >= 0) {
        const rows = this.wrap([{ text: job.text, color: job.color }]);
        this.lines.splice(job.start, this.lines.length - job.start, ...rows);
      } else {
        this.commit([{ text: job.text, color: job.color }]);
      }
    }
    this.dirty = true;
  }

  // -- input ---------------------------------------------------------------

  handleKey(event) {
    if (this.locked) return;
    const key = event.key;

    if (key === 'Enter') {
      const command = this.input;
      this.print([
        { text: this.prompt, style: 'dark' },
        { text: command, style: 'white' },
      ]);
      this.input = '';
      this.cursor = 0;
      if (command.trim()) {
        this.history.push(command);
        if (this.history.length > 200) this.history.shift();
      }
      this.historyIndex = -1;
      this.onCommand(command);
    } else if (key === 'Backspace') {
      if (this.cursor > 0) {
        this.input = this.input.slice(0, this.cursor - 1) + this.input.slice(this.cursor);
        this.cursor -= 1;
      }
    } else if (key === 'Delete') {
      this.input = this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1);
    } else if (key === 'ArrowLeft') {
      this.cursor = Math.max(0, this.cursor - 1);
    } else if (key === 'ArrowRight') {
      this.cursor = Math.min(this.input.length, this.cursor + 1);
    } else if (key === 'Home') {
      this.cursor = 0;
    } else if (key === 'End') {
      this.cursor = this.input.length;
    } else if (key === 'ArrowUp') {
      if (this.history.length) {
        this.historyIndex = this.historyIndex < 0
          ? this.history.length - 1
          : Math.max(0, this.historyIndex - 1);
        this.input = this.history[this.historyIndex];
        this.cursor = this.input.length;
      }
    } else if (key === 'ArrowDown') {
      if (this.historyIndex >= 0) {
        this.historyIndex += 1;
        if (this.historyIndex >= this.history.length) {
          this.historyIndex = -1;
          this.input = '';
        } else {
          this.input = this.history[this.historyIndex];
        }
        this.cursor = this.input.length;
      }
    } else if (key === 'PageUp') {
      this.scrollBy(this.rows - 2);
    } else if (key === 'PageDown') {
      this.scrollBy(-(this.rows - 2));
    } else if (key === 'Escape') {
      this.input = '';
      this.cursor = 0;
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.input = this.input.slice(0, this.cursor) + key + this.input.slice(this.cursor);
      this.cursor += 1;
    } else {
      return;
    }
    event.preventDefault();
    this.dirty = true;
  }

  setInput(value) {
    this.input = value;
    this.cursor = value.length;
    this.dirty = true;
  }

  scrollBy(lines) {
    const maxScroll = Math.max(0, this.lines.length - this.rows + 1);
    this.scrollOffset = Math.min(Math.max(0, this.scrollOffset + lines), maxScroll);
    this.dirty = true;
  }

  /** Plain text of everything on screen — used by the COPY command. */
  toText(lastLines = 200) {
    return this.lines
      .slice(-lastLines)
      .map((row) => row.map((segment) => segment.text).join(''))
      .join('\n');
  }

  // -- rendering -----------------------------------------------------------

  render(now) {
    if (now - this._lastBlink > CURSOR_BLINK_MS) {
      this.cursorVisible = !this.cursorVisible;
      this._lastBlink = now;
      this.dirty = true;
    }
    if (!this.dirty) return false;

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#03120b';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.font = `${this.fontSize}px "IBM Plex Mono", "Courier New", monospace`;
    ctx.textBaseline = 'top';

    const visible = this.locked
      ? this.lines
      : [...this.lines, [
          { text: this.prompt, color: PALETTE.dark },
          { text: this.input, color: PALETTE.white },
        ]];

    const start = Math.max(0, visible.length - this.rows - this.scrollOffset);
    const slice = visible.slice(start, start + this.rows);
    const padX = this.cellWidth;
    const padY = this.cellHeight * 0.4;

    slice.forEach((segments, row) => {
      let column = 0;
      const y = padY + row * this.cellHeight;
      for (const segment of segments) {
        ctx.fillStyle = segment.color;
        ctx.fillText(segment.text, padX + column * this.cellWidth, y);
        column += segment.text.length;
      }
    });

    if (!this.locked && this.cursorVisible && this.scrollOffset === 0) {
      const promptRow = slice.length - 1;
      const column = this.prompt.length + this.cursor;
      ctx.fillStyle = this.busy ? PALETTE.amber : PALETTE.green;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(
        padX + column * this.cellWidth,
        padY + promptRow * this.cellHeight,
        this.cellWidth,
        this.cellHeight * 0.82,
      );
      ctx.globalAlpha = 1;
    }

    if (this.scrollOffset > 0) {
      const badge = `-- SCROLLBACK ${this.scrollOffset} --`;
      ctx.fillStyle = PALETTE.amber;
      ctx.fillText(badge, this.width - padX - badge.length * this.cellWidth, padY);
    }

    this.dirty = false;
    return true;
  }
}
