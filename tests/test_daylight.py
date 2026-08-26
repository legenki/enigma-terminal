"""The palette that follows the hour.

The point of these tests is one claim: at no minute of the day does the
interface become hard to read. The old skin was a single black-and-phosphor
set, so contrast was fixed and obvious; a palette that moves has to be
measured, and measured everywhere, because the bad moments are exactly the
ones nobody screenshots.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="node is required to run the palette"
)

#: Body text. Well above AA, because the whole point is comfort, not the floor.
INK_FLOOR = 7.0
#: Secondary text, semantic colours, and the label on the filled action.
SOFT_FLOOR = 4.5


def sample_day(step_minutes: int = 1) -> list[dict]:
    """Walk the whole cycle in the browser's own module."""
    script = """
    import { paletteAt, contrast, luminance, TOKENS } from './docs/js/daylight.js';
    const step = Number(process.argv[1]) / 60;
    const out = [];
    for (let h = 0; h < 24; h += step) {
      const p = paletteAt(h);
      const btnInk = luminance(p.btn) < 0.3 ? '#ffffff' : '#1f1e1d';
      out.push({
        hour: h,
        tokens: TOKENS.length,
        missing: TOKENS.filter((t) => !p[t]),
        ink: contrast(p.ink, p.bg),
        soft: contrast(p.soft, p.bg),
        inkOnSurface: contrast(p.ink, p.surface),
        inkOnSunken: contrast(p.ink, p.sunken),
        info: contrast(p.info, p.bg),
        warn: contrast(p.warn, p.bg),
        danger: contrast(p.danger, p.bg),
        ok: contrast(p.ok, p.bg),
        muted: contrast(p.muted, p.bg),
        btnLabel: contrast(btnInk, p.btn),
      });
    }
    process.stdout.write(JSON.stringify(out));
    """
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script, str(step_minutes)],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


@pytest.fixture(scope="module")
def day():
    return sample_day()


def clock(hour: float) -> str:
    return f"{int(hour):02d}:{round(hour % 1 * 60):02d}"


def test_body_text_is_never_hard_to_read(day):
    """The complaint that started this: the palette used to pass through
    tones where ink and ground came too close together."""
    worst = min(day, key=lambda row: row["ink"])
    assert worst["ink"] >= INK_FLOOR, (
        f"body text falls to {worst['ink']:.2f}:1 at {clock(worst['hour'])}"
    )


def test_every_other_role_clears_aa(day):
    for role in ("soft", "info", "warn", "danger", "ok", "muted", "btnLabel"):
        worst = min(day, key=lambda row: row[role])
        assert worst[role] >= SOFT_FLOOR, (
            f"{role} falls to {worst[role]:.2f}:1 at {clock(worst['hour'])}"
        )


def test_text_reads_on_every_surface_not_just_the_ground(day):
    """Cards and wells sit on top of the ground and carry most of the text."""
    for role in ("inkOnSurface", "inkOnSunken"):
        worst = min(day, key=lambda row: row[role])
        assert worst[role] >= INK_FLOOR, (
            f"{role} falls to {worst[role]:.2f}:1 at {clock(worst['hour'])}"
        )


def test_no_keyframe_forgets_a_token(day):
    for row in day:
        assert not row["missing"], f"{clock(row['hour'])} is missing {row['missing']}"


def test_the_two_dim_stretches_are_cut_out_not_crossed():
    """Between 05:20-07:20 and 17:20-20:00 the palette holds at the far end
    instead of easing through the tones that lost contrast."""
    script = """
    import { paletteAt, crossesCut, CUT_DAWN, CUT_DUSK } from './docs/js/daylight.js';
    const same = (a, b) => JSON.stringify(paletteAt(a)) === JSON.stringify(paletteAt(b));
    process.stdout.write(JSON.stringify({
      dawnHeld: [5.5, 6, 7].every((h) => same(h, CUT_DAWN[1])),
      duskHeld: [17.5, 18, 19.9].every((h) => same(h, CUT_DUSK[1])),
      dawnBreak: crossesCut(5.3, 5.4),
      duskBreak: crossesCut(17.3, 17.4),
      quietNoon: crossesCut(12.0, 12.5),
      quietNight: crossesCut(2.0, 2.5),
    }));
    """
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=60,
    )
    assert done.returncode == 0, done.stderr
    result = json.loads(done.stdout)
    assert result["dawnHeld"], "the dawn stretch is being crossed, not held"
    assert result["duskHeld"], "the dusk stretch is being crossed, not held"
    assert result["dawnBreak"] and result["duskBreak"], "a break no longer fires"
    assert not result["quietNoon"] and not result["quietNight"], \
        "a break fires outside the two cuts"


# --- the stylesheet ---------------------------------------------------------

def test_the_gui_stylesheet_names_roles_not_hues():
    """Every colour comes from a token the palette rewrites. A literal in a
    rule is a colour that cannot follow the hour — the exact bug that left
    the old placeholder green on a light ground."""
    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")
    body = css[css.index("#gui-root {"):]
    literals = [
        line.strip() for line in body.splitlines()
        if re.search(r":\s*#[0-9a-fA-F]{3,8}\b", line)
    ]
    assert not literals, f"hardcoded colours outside the token block: {literals[:5]}"


def test_no_phosphor_tokens_survive():
    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")
    for gone in ("--neon", "--void", "--panel", "--enigma-dim", "--enigma-deep",
                 "--glow", "--text-glow", "--ink-soft"):
        assert f"var({gone})" not in css, f"{gone} is still in use"


def test_the_footer_carries_the_daylight_switch_and_nothing_else():
    """The CRT switch shared this slot while the terminal was a second mode.
    There is one mode now, so there is one switch."""
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    assert 'id="light-switch"' in html
    for button in ("light-live", "light-day", "light-night"):
        assert f'id="{button}"' in html
    assert 'id="crt-switch"' not in html

    main = (DOCS / "js" / "main.js").read_text(encoding="utf-8")
    assert "store(LIGHT_KEY, daylight.mode)" in main


def test_the_choice_of_light_survives_a_reload():
    main = (DOCS / "js" / "main.js").read_text(encoding="utf-8")
    assert "enigma-terminal/light/v1" in main
    assert "store(LIGHT_KEY, daylight.mode)" in main


def test_the_terminal_reads_at_every_hour_on_its_own_ground():
    """The screen used to be pinned to one colour, so its contrast was a fixed
    number quoted in three files. It follows the hour now, on a ground of its
    own — which means every tone has to be measured against that ground at
    every minute, not against the interface's."""
    script = """
    import { terminalPalette, contrast, TEXT_FLOOR, ROLE_FLOOR } from './docs/js/term.js';
    import { paletteAt } from './docs/js/daylight.js';
    const roles = ['text', 'command', 'prompt', 'green', 'cyan', 'amber', 'red',
                   'magenta', 'grey', 'dim'];
    const worst = {};
    for (let m = 0; m < 1440; m += 1) {
      const t = terminalPalette(paletteAt(m / 60));
      for (const role of roles) {
        const ratio = contrast(t[role], t.ground);
        if (!worst[role] || ratio < worst[role].ratio) worst[role] = { ratio, minute: m };
      }
    }
    process.stdout.write(JSON.stringify({ worst, TEXT_FLOOR, ROLE_FLOOR }));
    """
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    result = json.loads(done.stdout)
    worst = result["worst"]

    def at(minute):
        return f"{minute // 60:02d}:{minute % 60:02d}"

    assert worst["text"]["ratio"] >= result["TEXT_FLOOR"], (
        f"terminal body text falls to {worst['text']['ratio']:.2f}:1 "
        f"at {at(worst['text']['minute'])}"
    )
    for role, found in worst.items():
        assert found["ratio"] >= result["ROLE_FLOOR"], (
            f"{role} falls to {found['ratio']:.2f}:1 at {at(found['minute'])}"
        )


def test_the_screen_has_a_ground_of_its_own_at_every_hour():
    """`screen` is deliberately not `bg`: the terminal that took the interface's
    own ground would stop reading as a terminal and become another panel."""
    script = """
    import { paletteAt } from './docs/js/daylight.js';
    const rows = [];
    for (let m = 0; m < 1440; m += 10) {
      const p = paletteAt(m / 60);
      rows.push({ minute: m, screen: p.screen, bg: p.bg, plum: p.plum });
    }
    process.stdout.write(JSON.stringify(rows));
    """
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=60,
    )
    assert done.returncode == 0, done.stderr
    rows = json.loads(done.stdout)
    assert all(row["screen"] and row["plum"] for row in rows), "a keyframe has no screen"
    assert all(row["screen"] != row["bg"] for row in rows), \
        "the screen collapsed onto the interface ground"
    # And it does move: a screen that never changed would be the old pinned one.
    assert len({row["screen"] for row in rows}) > 20, "the screen is not following the hour"
