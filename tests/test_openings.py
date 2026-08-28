"""The sixteen openings, and the rule that keeps one of them always printable.

An opening is prose with holes in it. Two things can go wrong and neither shows
up by reading: a text can use a placeholder nobody fills, and a text can be
offered in a session where the figure it needs never arrived. Both print a
literal `{brace}` at the player, on the first screen of the game.
"""

from __future__ import annotations

import json
import random
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from enigma_terminal import openings as op

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("en", "es", "pt", "ru")


@pytest.fixture(scope="module")
def payload():
    return json.loads((ROOT / "data" / "openings.json").read_text(encoding="utf-8"))


def test_there_are_sixteen_of_them_and_the_ids_are_unique():
    assert len(op.OPENINGS) == 16
    assert len({o.id for o in op.OPENINGS}) == 16


@pytest.mark.parametrize("lang", LANGS)
def test_every_opening_is_written_in_every_language(lang):
    for opening in op.OPENINGS:
        lines = opening.lines.get(lang)
        assert lines, f"{opening.id} has no {lang}"
        assert all(isinstance(line, str) for line in lines)
        assert any(line.strip() for line in lines), f"{opening.id}/{lang} is blank"


def test_the_languages_of_one_opening_use_the_same_placeholders():
    """A variable dropped in translation is a hole only that language shows."""
    for opening in op.OPENINGS:
        per_lang = {
            lang: set(op.PLACEHOLDER.findall("\n".join(lines)))
            for lang, lines in opening.lines.items()
        }
        assert len(set(map(frozenset, per_lang.values()))) == 1, \
            f"{opening.id} uses different variables per language: {per_lang}"


def test_every_placeholder_is_a_variable_the_game_can_fill(payload):
    known = set(payload["variables"])
    for opening in op.OPENINGS:
        used = set(op.PLACEHOLDER.findall("\n".join(sum(opening.lines.values(), []))))
        assert used <= known, f"{opening.id} invents {sorted(used - known)}"


def test_declared_needs_match_the_text(payload):
    """`needs` is what decides eligibility; if it drifts, the text tears."""
    for opening in op.OPENINGS:
        used = set(op.PLACEHOLDER.findall("\n".join(sum(opening.lines.values(), []))))
        assert used == set(opening.needs), \
            f"{opening.id} declares {sorted(opening.needs)} but uses {sorted(used)}"


def test_some_openings_need_nothing_at_all():
    """--offline, a dead explorer and a rate limit all land here."""
    free = [o for o in op.OPENINGS if not o.needs]
    assert len(free) >= 3, "too few openings survive a session with no network"


def test_choosing_with_no_figures_still_returns_something_printable():
    for seed in range(50):
        opening = op.choose({}, random.Random(seed))
        assert not opening.needs
        rendered = "\n".join(opening.render("en", {}))
        assert "{" not in rendered, f"{opening.id} printed an unfilled variable"


def test_a_chosen_opening_is_always_one_the_figures_can_fill():
    figures = {"price": "79 791", "height": "964 268"}
    for seed in range(50):
        opening = op.choose(figures, random.Random(seed))
        rendered = "\n".join(opening.render("ru", figures))
        assert "{" not in rendered, f"{opening.id} left a hole"


def test_every_opening_renders_clean_when_every_figure_is_present(payload):
    figures = {name: "X" for name in payload["variables"]}
    for opening in op.OPENINGS:
        for lang in LANGS:
            rendered = "\n".join(opening.render(lang, figures))
            assert "{" not in rendered and "}" not in rendered, \
                f"{opening.id}/{lang} still has a brace in it"


def test_an_unknown_language_falls_back_to_english():
    opening = op.OPENINGS[0]
    assert opening.render("de", {}) == opening.render("en", {})


def test_grouping_matches_how_the_game_prints_numbers():
    assert op.group(964268) == "964 268"
    assert op.group("79791") == "79 791"
    assert op.group(None) == ""
    assert op.group("not a number") == ""


def _js_figures(stub: str) -> dict:
    """Run the browser's own figure reader against a stubbed explorer.

    This used to drive a Python mirror of the same function. The mirror served
    a client that no longer exists, so the rules below are checked against the
    implementation that actually opens the game.
    """
    if shutil.which("node") is None:
        pytest.skip("node is required to run the browser's opening")
    script = """
      const { figuresFromChain } = await import('./docs/js/opening.js');
      const explorer = STUB;
      console.log(JSON.stringify(await figuresFromChain(explorer)));
    """.replace("STUB", stub)
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


def test_no_explorer_means_no_figures_and_no_calls():
    """An opening must never be the thing that reaches the network anyway."""
    assert _js_figures("null") == {}


def test_one_failing_endpoint_does_not_cost_the_others():
    """Each figure is fetched on its own so a rate limit narrows, not empties."""
    figures = _js_figures("""{
      tip: async () => ({ height: 964268, extras: { pool: { name: 'Braiins Pool' } } }),
      prices: async () => { throw new Error('rate limited'); },
      fees: async () => { throw new Error('down'); },
      mempool: async () => ({ count: 86587 }),
      pools: async () => { throw new Error('malformed'); },
    }""")
    assert figures["height"] == "964 268"
    assert figures["pool"] == "Braiins Pool"
    assert figures["mempool"] == "86 587"
    assert figures["halvingDays"]
    assert "price" not in figures and "fee" not in figures
    assert op.available(figures), "a half-down chain left no opening standing"


def test_both_builds_ship_the_same_openings(payload):
    """The web build carries a generated copy; a stale one is a different game."""
    generated = (ROOT / "docs" / "js" / "openings.js").read_text(encoding="utf-8")
    body = generated[generated.index("export const OPENINGS = ") :]
    body = body[body.index("[") : body.rindex("]") + 1]
    assert json.loads(body) == payload["openings"], \
        "docs/js/openings.js is stale — run tools/build_web_data.py"


def test_the_world_is_no_longer_dated_to_a_year():
    """The setting moved to the present, so it names no year at all.

    Deliberately not a regex for "any 20xx": the wordlist is 2048 entries long
    and the ledger has been running since 2009, and both of those are numbers
    the prose is entitled to use. What must not come back is a dateline — a
    city followed by a year, which is how the setting used to be stamped.
    """
    dateline = re.compile(r"(BUENOS AIRES|Buenos Aires|Буэнос-Айрес)\s*,?\s*\d{4}")
    for name in ("openings.json", "cases.json", "clients.json"):
        text = (ROOT / "data" / name).read_text(encoding="utf-8")
        found = dateline.search(text)
        assert not found, f"{name} still stamps the world with a year: {found.group(0)!r}"
