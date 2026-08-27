// The pulse: how long since the last block, and a sound when the next lands.
//
// A block roughly every ten minutes is the one clock the game shares with the
// world it is playing against, so the whole page reads it — the strip above the
// interface, the explorer's lead card, and the chime. This is the single thing
// that watches for it, because the source allows three requests every five
// seconds and a page with four independent pollers would spend that on nothing.
//
// It goes quiet while the tab is hidden. Nobody needs a countdown they cannot
// see, and the request it would cost is one the player might want back.

import { readHeader } from './crypto/header.js';

//: Far enough apart to cost almost nothing, close enough that a block is never
//: more than half a minute stale on screen.
export const POLL_MS = 30000;
//: After a failure, back off rather than hammering a service that just said no.
export const RETRY_MS = 90000;

export class Heartbeat {
  constructor(
    client,
    { onBlock = null, onTick = null, now = () => Date.now() } = {},
  ) {
    this.client = client;
    this.onBlock = onBlock;
    this.onTick = onTick;
    this.now = now;
    this.block = null;
    this.timer = null;
    this.ticker = null;
    this.started = false;
  }

  /** Seconds since the block was mined, or null before the first answer. */
  age() {
    if (!this.block) return null;
    return Math.max(0, Math.floor(this.now() / 1000) - this.block.timestamp);
  }

  /**
   * Ask for the tip.
   *
   * The first answer never chimes: arriving at a page mid-block is not an
   * event, and a sound on load is exactly the thing people disable sound over.
   */
  async poll() {
    try {
      const tip = await this.client.tip();
      let header = null;
      try {
        header = readHeader(tip.header);
      } catch {
        header = null;
      }
      const next = {
        height: tip.height,
        hash: tip.hash,
        timestamp: header ? header.timestamp : tip.adjustedTimestamp,
        transactionCount: header ? header.transactionCount : null,
      };
      const first = this.block === null;
      const changed = !first && next.height !== this.block.height;
      this.block = next;
      if (this.onBlock) this.onBlock(next, { first, changed });
      return { block: next, changed };
    } catch (error) {
      return { error };
    }
  }

  /** Poll now, then keep polling; tick the countdown every second between. */
  start() {
    if (this.started) return;
    this.started = true;
    const loop = async () => {
      if (!this.started) return;
      const result = document.hidden ? {} : await this.poll();
      if (!this.started) return;
      this.timer = setTimeout(loop, result.error ? RETRY_MS : POLL_MS);
    };
    loop();
    this.ticker = setInterval(() => {
      if (this.onTick && !document.hidden) this.onTick(this.age(), this.block);
    }, 1000);
    // Coming back to the tab is the moment the countdown is most likely wrong.
    this.onVisible = () => {
      if (!document.hidden) this.poll();
    };
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stop() {
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.ticker) clearInterval(this.ticker);
    if (this.onVisible)
      document.removeEventListener('visibilitychange', this.onVisible);
    this.timer = null;
    this.ticker = null;
  }
}

/** `00 · 13 · 52` split into its three fields, for a clock that shows units. */
export function splitAge(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export const pad2 = (value) => String(value).padStart(2, '0');
