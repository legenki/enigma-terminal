"""The chain explorer: its client, its header reader, and its panel.

Two things here are worth more than the rest. The service allows three calls
every five seconds, so the client has to queue rather than fan out — a panel
that fires four lookups at once comes back 429 and reads to the player as
broken. And the service publishes no difficulty, no target and no transaction
count: all three are inside the eighty-byte header it does send, so the
explorer works them out. That makes the header reader load-bearing, and it is
checked against the block every implementation is checked against.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="node runs the browser modules"
)

#: The genesis block header, and what it must decode to.
GENESIS = (
    "0100000000000000000000000000000000000000000000000000000000000000000000003b"
    "a3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff"
    "001d1dac2b7c"
)
GENESIS_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
GENESIS_MERKLE = "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"


def node(script: str, timeout: int = 60):
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=timeout,
    )
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


# --- the header, which is where the derived numbers come from ---------------

def test_the_header_reader_agrees_with_the_genesis_block():
    result = node(f"""
    import {{ readHeader }} from './docs/js/crypto/header.js';
    const h = readHeader('{GENESIS}');
    process.stdout.write(JSON.stringify(h));
    """)
    assert result["hash"] == GENESIS_HASH
    assert result["merkleRoot"] == GENESIS_MERKLE
    assert result["previousHash"] == "0" * 64
    assert result["timestamp"] == 1231006505
    assert result["nonce"] == 2083236893
    assert result["bits"] == 0x1D00FFFF
    # 0x1d00ffff is difficulty 1 by definition; anything else means the
    # compact-target arithmetic is wrong.
    assert result["difficulty"] == 1


def test_difficulty_and_target_move_together():
    """Difficulty is the ratio of the easiest allowed target to this one, so
    halving the target has to double the difficulty."""
    result = node("""
    import { targetFromBits, difficultyFromBits } from './docs/js/crypto/header.js';
    process.stdout.write(JSON.stringify({
      easiest: { target: targetFromBits(0x1d00ffff).toString(16), d: difficultyFromBits(0x1d00ffff) },
      half:    { target: targetFromBits(0x1c7fff80).toString(16), d: difficultyFromBits(0x1c7fff80) },
      recent:  { d: difficultyFromBits(0x17023cc1) },
      exact:   { d: difficultyFromBits(0x1b0404cb) },
    }));
    """)
    assert result["easiest"]["d"] == 1
    assert abs(result["half"]["d"] - 2) < 0.001, result["half"]
    assert result["recent"]["d"] > 1e13, "a modern block should be trillions of times harder"

    # The ratio is a 256-bit number over a 256-bit number. Dividing them as
    # floats is close but not equal, and the difference shows in the decimals —
    # which is the whole reason the arithmetic is done in BigInt and scaled.
    assert result["exact"]["d"] == 16307.42093852, (
        f"difficulty went through a float: {result['exact']['d']}"
    )


def test_the_trailing_varint_is_the_transaction_count():
    """The service appends it to the header and has no endpoint that reports
    it, so this is the only place a block's transaction count can be read."""
    result = node(f"""
    import {{ readHeader, readVarInt }} from './docs/js/crypto/header.js';
    const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((p) => parseInt(p, 16)));
    process.stdout.write(JSON.stringify({{
      plain: readHeader('{GENESIS}').transactionCount,
      small: readHeader(bytes('{GENESIS}' + '07')).transactionCount,
      wide: readHeader(bytes('{GENESIS}' + 'fd210f')).transactionCount,
      varints: [readVarInt(bytes('fc'), 0), readVarInt(bytes('fd210f'), 0),
                readVarInt(bytes('fe11223344'), 0)],
    }}));
    """)
    assert result["plain"] is None, "a bare header has no count to report"
    assert result["small"] == 7
    assert result["wide"] == 3873
    assert [v["value"] for v in result["varints"]] == [252, 3873, 0x44332211]


def test_a_short_header_is_refused_rather_than_guessed():
    result = node("""
    import { readHeader } from './docs/js/crypto/header.js';
    let message = 'accepted';
    try { readHeader(new Uint8Array(40)); } catch (error) { message = error.message; }
    process.stdout.write(JSON.stringify({ message }));
    """)
    assert "80 bytes" in result["message"], result["message"]


# --- the client, whose whole shape is the rate limit ------------------------

def test_the_client_never_exceeds_three_calls_in_five_seconds():
    """Fired twelve at once against a clock we control: the calls have to land
    in groups of three, five seconds apart, or the service answers 429."""
    result = node("""
    import { BitapsClient, RATE } from './docs/js/bitaps.js';
    let now = 0;
    const at = [];
    // Time only moves when the queue waits for it, so the schedule is exact.
    const realTimeout = setTimeout;
    globalThis.setTimeout = (fn, ms) => { now += ms; return realTimeout(fn, 0); };
    const client = new BitapsClient({
      now: () => now,
      fetcher: async (url) => {
        at.push(now);
        return { ok: true, status: 200, json: async () => ({ data: { url } }) };
      },
    });
    const jobs = [];
    for (let i = 0; i < 12; i += 1) jobs.push(client.get(`path/${i}`));
    await Promise.all(jobs);
    process.stdout.write(JSON.stringify({ at, RATE }));
    """)
    at = result["at"]
    assert len(at) == 12
    window = result["RATE"]["windowMs"]
    for index in range(len(at)):
        inside = [t for t in at[: index + 1] if t > at[index] - window]
        assert len(inside) <= result["RATE"]["calls"], (
            f"call {index} at {at[index]}ms is the {len(inside)}th inside {window}ms: {at}"
        )


def test_an_answer_already_known_is_not_paid_for_again():
    result = node("""
    import { BitapsClient } from './docs/js/bitaps.js';
    let now = 0;
    let calls = 0;
    globalThis.setTimeout = (fn, ms) => { now += ms; return fn(); };
    const client = new BitapsClient({
      now: () => now,
      fetcher: async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ data: 1 }) }; },
    });
    await client.get('a', { ttl: 1000 });
    await client.get('a', { ttl: 1000 });
    const cached = calls;
    now += 5000;                       // past the ttl
    await client.get('a', { ttl: 1000 });
    process.stdout.write(JSON.stringify({ cached, afterExpiry: calls }));
    """)
    assert result["cached"] == 1, "the second read went back to the network"
    assert result["afterExpiry"] == 2, "an expired answer was served anyway"


def test_one_failure_does_not_stop_every_later_call():
    """The queue is a chain of promises; a rejection that is not caught takes
    the chain with it and the panel stops answering entirely."""
    result = node("""
    import { BitapsClient } from './docs/js/bitaps.js';
    let now = 0;
    globalThis.setTimeout = (fn, ms) => { now += ms; return fn(); };
    let first = true;
    const client = new BitapsClient({
      now: () => now,
      fetcher: async () => {
        if (first) { first = false; return { ok: false, status: 500 }; }
        return { ok: true, status: 200, json: async () => ({ data: 'second' }) };
      },
    });
    let failed = null;
    await client.get('a').catch((error) => { failed = error.message; });
    const after = await client.get('b');
    process.stdout.write(JSON.stringify({ failed, after }));
    """)
    assert "500" in result["failed"]
    assert result["after"] == "second", "the queue died with the first failure"


def test_a_missing_thing_is_reported_as_missing():
    result = node("""
    import { BitapsClient } from './docs/js/bitaps.js';
    let now = 0;
    globalThis.setTimeout = (fn, ms) => { now += ms; return fn(); };
    const client = new BitapsClient({
      now: () => now,
      fetcher: async () => ({ ok: false, status: 404 }),
    });
    let status = null;
    let message = null;
    await client.get('nope').catch((error) => { status = error.status; message = error.message; });
    process.stdout.write(JSON.stringify({ status, message }));
    """)
    assert result["status"] == 404
    assert "NOT FOUND" in result["message"]


# --- what the player typed --------------------------------------------------

def test_one_box_tells_the_four_kinds_apart():
    result = node("""
    import { classify } from './docs/js/bitaps.js';
    const cases = ['964237', '0', '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf',
      '0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098',
      '0E3E2357E806B6CDB1F70B54C3A3A17B6714EE1F0E68BEBB44A74B1EFD512098',
      '  964237  ', 'hello', '', 'abandon abandon'];
    process.stdout.write(JSON.stringify(cases.map((c) => classify(c))));
    """)
    kinds = [row["kind"] for row in result]
    assert kinds == ["height", "height", "address", "address", "address",
                     "hash", "hash", "height", None, None, None], kinds
    # A hash is lower-cased so the same block is never fetched twice.
    assert result[5]["value"] == result[6]["value"]


def test_sats_never_go_through_a_float():
    """21 million BTC in sats is past what a double holds exactly, and a
    balance that rounds is a balance that is wrong."""
    result = node("""
    import { btc } from './docs/js/bitaps.js';
    process.stdout.write(JSON.stringify({
      genesis: btc(5000000000),
      dust: btc(1),
      negative: btc(-250000),
      whole: btc(2100000000000000),
      past53: btc(9007199254740993n),
    }));
    """)
    assert result["genesis"] == "50.00000000"
    assert result["dust"] == "0.00000001"
    assert result["negative"] == "-0.00250000"
    assert result["whole"] == "21000000.00000000"
    # 2^53 + 1 sats: the first amount a double cannot hold, and the last digit
    # is the one that would quietly go.
    assert result["past53"] == "90071992.54740993", (
        f"sats went through a float: {result['past53']}"
    )


# --- the panel --------------------------------------------------------------

def test_the_explorer_is_a_row_on_the_desk_with_a_builder():
    source = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    assert "id: 'explorer'" in source, "the explorer has no sidebar row"
    assert "explorer: () => this.buildExplorer()" in source
    assert "buildExplorer() {" in source


def test_the_panel_leans_on_the_client_and_not_on_fetch():
    """Anything calling fetch directly would sidestep the queue, and the queue
    is the only thing keeping the panel under the rate limit."""
    source = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    panel = source[source.index("buildExplorer() {"):source.index("buildArchive() {")]
    assert "fetch(" not in panel, "the explorer panel calls fetch behind the queue's back"
    assert "this.chainExplorer" in panel


def test_the_explorer_styles_come_from_the_palette():
    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")
    block = css[css.index("/* ---------- explorer ---"):]
    literals = [
        line.strip() for line in block.splitlines()
        if ":" in line and "#" in line.split(":", 1)[1] and "var(" not in line
    ]
    assert not literals, f"the explorer hardcodes colours: {literals[:4]}"


# --- the pulse: the one clock the game shares with the chain ----------------

def test_the_countdown_splits_the_way_a_clock_reads():
    result = node("""
    import { splitAge, pad2 } from './docs/js/heartbeat.js';
    const show = (s) => { const a = splitAge(s); return `${pad2(a.hours)} ${pad2(a.minutes)} ${pad2(a.seconds)}`; };
    process.stdout.write(JSON.stringify([0, 59, 832, 3600, 7261, -5, NaN].map(show)));
    """)
    assert result == ["00 00 00", "00 00 59", "00 13 52", "01 00 00",
                      "02 01 01", "00 00 00", "00 00 00"]


def test_the_first_block_seen_is_not_an_event():
    """Arriving at a page mid-block is not something happening, and a chime on
    load is exactly what people turn sound off over."""
    result = node("""
    import { Heartbeat } from './docs/js/heartbeat.js';
    const header = '0100000000000000000000000000000000000000000000000000000000000000000000003b'
      + 'a3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c';
    let height = 1;
    const client = { tip: async () => ({ height, hash: 'h' + height, header }) };
    const seen = [];
    const beat = new Heartbeat(client, { onBlock: (b, meta) => seen.push({ h: b.height, ...meta }) });
    await beat.poll();
    await beat.poll();
    height = 2;
    await beat.poll();
    process.stdout.write(JSON.stringify(seen));
    """)
    assert result[0]["first"] is True and result[0]["changed"] is False
    assert result[1]["changed"] is False, "the same height fired a block event"
    assert result[2]["changed"] is True and result[2]["h"] == 2


def test_a_header_that_will_not_read_does_not_stop_the_pulse():
    result = node("""
    import { Heartbeat } from './docs/js/heartbeat.js';
    const client = { tip: async () => ({ height: 9, hash: 'x', header: 'nonsense', adjustedTimestamp: 1234 }) };
    const beat = new Heartbeat(client, {});
    const { block } = await beat.poll();
    process.stdout.write(JSON.stringify(block));
    """)
    assert result["height"] == 9
    # It falls back to the timestamp the service states rather than giving up.
    assert result["timestamp"] == 1234


def test_a_failed_poll_is_reported_rather_than_thrown():
    result = node("""
    import { Heartbeat } from './docs/js/heartbeat.js';
    const client = { tip: async () => { throw new Error('down'); } };
    const beat = new Heartbeat(client, {});
    const out = await beat.poll();
    process.stdout.write(JSON.stringify({ error: out.error ? out.error.message : null }));
    """)
    assert result["error"] == "down"


# --- the sound --------------------------------------------------------------

def test_the_chime_is_silent_until_it_is_allowed_to_sound():
    """No audio context means no sound, and a muted chime must not build one.
    A sound that plays before the page is touched is one a browser blocks and a
    person resents."""
    result = node("""
    import { Chime } from './docs/js/chime.js';
    // Node has no Web Audio, so stand one up: without it every path returns
    // false for the wrong reason and the test proves nothing.
    let built = 0;
    globalThis.AudioContext = class {
      constructor() { built += 1; this.state = 'running'; this.currentTime = 0; }
      resume() { this.state = 'running'; }
    };
    const store = new Map();
    const storage = { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) };
    const chime = new Chime({ storage });
    const beforeUnlock = chime.play();
    chime.setEnabled(false);
    const muted = chime.unlock();
    const remembered = store.get('enigma-terminal/sound/v1');
    const back = new Chime({ storage }).enabled;
    process.stdout.write(JSON.stringify({ beforeUnlock, muted, remembered, back, built }));
    """)
    assert result["beforeUnlock"] is False, "it played without an audio context"
    assert result["muted"] is False, "a muted chime reported itself ready"
    assert result["built"] == 0, "a muted chime built an audio context anyway"
    assert result["remembered"] == "off"
    assert result["back"] is False, "the choice did not survive a reload"


def test_the_figure_is_short_and_quiet():
    result = node("""
    import { FIGURE } from './docs/js/chime.js';
    process.stdout.write(JSON.stringify(FIGURE));
    """)
    assert 2 <= len(result) <= 4, "a notification is a figure, not a tune"
    assert max(n["at"] + n["hold"] for n in result) < 0.6, "it outstays its welcome"
    assert max(n["gain"] for n in result) <= 0.12, "it is louder than a notification should be"
    # Rising, which is what makes it read as an arrival rather than a warning.
    assert [n["hz"] for n in result] == sorted(n["hz"] for n in result)


# --- proof of work, which has no endpoint anywhere --------------------------

def test_the_subsidy_halves_on_the_block_it_should():
    result = node("""
    import { blockReward } from './docs/js/pow.js';
    const at = (h) => Number(blockReward(h)) / 1e8;
    process.stdout.write(JSON.stringify({
      genesis: at(0), last50: at(209999), first25: at(210000),
      current: at(964238), far: at(210000 * 33), beyond: at(210000 * 64),
    }));
    """)
    assert result["genesis"] == 50 and result["last50"] == 50
    assert result["first25"] == 25
    assert result["current"] == 3.125
    assert result["far"] == 0, "the subsidy should have shifted away to nothing"
    assert result["beyond"] == 0


def test_the_countdowns_land_on_the_right_heights():
    result = node("""
    import { untilHalving, untilRetarget } from './docs/js/pow.js';
    process.stdout.write(JSON.stringify({
      halving: untilHalving(964238),
      retarget: untilRetarget(964238),
      onBoundary: untilRetarget(2016 * 10),
    }));
    """)
    assert result["halving"]["atHeight"] == 1050000, "the fifth halving is at 1,050,000"
    assert result["retarget"]["atHeight"] % 2016 == 0
    # Standing exactly on a boundary means a whole period to the next one, not none.
    assert result["onBoundary"]["blocks"] == 2016


def test_the_next_difficulty_cannot_move_more_than_fourfold():
    """The clamp is consensus, not caution: a period that took a tenth of the
    expected time still only quadruples the difficulty."""
    result = node("""
    import { nextDifficulty } from './docs/js/pow.js';
    const d = 1000;
    process.stdout.write(JSON.stringify({
      steady: nextDifficulty(d, 2016, 2016 * 600),
      tooFast: nextDifficulty(d, 2016, 2016 * 60),
      tooSlow: nextDifficulty(d, 2016, 2016 * 6000),
      noData: nextDifficulty(d, 0, 0),
    }));
    """)
    assert result["steady"]["value"] == 1000, "a period on time should not move it"
    assert result["tooFast"]["value"] == 4000
    assert result["tooSlow"]["value"] == 250
    assert result["noData"] is None


def test_the_hashrate_follows_the_spacing_it_is_given():
    result = node("""
    import { hashrate, formatHashrate } from './docs/js/pow.js';
    const d = 125807076547197.56;
    process.stdout.write(JSON.stringify({
      nominal: formatHashrate(hashrate(d)),
      measured: formatHashrate(hashrate(d, 561)),
      tiny: formatHashrate(hashrate(1)),
      none: formatHashrate(0),
    }));
    """)
    # At the nominal ten minutes this difficulty is ~900 EH/s; at the 561s the
    # chain is actually taking, it is ~963 — which is the number explorers show.
    assert result["nominal"].endswith("EH/s")
    assert result["measured"].startswith("963"), result["measured"]
    assert result["tiny"].endswith("MH/s")
    assert result["none"] == "—"
