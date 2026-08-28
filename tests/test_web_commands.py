"""The browser terminal must offer only what exists, in every language.

Three separate bugs sat behind this file, all of the same shape: something the
terminal claimed to do had no code behind it, and nothing compared the claim
with the code.

  * OPEN searched the campaign's eight cases while CASES listed the desk, so a
    contract the player could see could not be opened;
  * the dispatch table pointed JOURNAL, RECALL and PURGE at methods that were
    never written, so HELP advertised three commands that answered
    UNKNOWN COMMAND;
  * the take-a-contract branch called `this.log(...)` and `Engine` had no such
    method, which is why the journal stayed empty however much work was done.

Every check here is a comparison between two lists that were allowed to drift.

This began as a parity file, comparing the browser against a Python terminal
that no longer exists. The comparisons that survive are the ones that were
always about the browser alone — and all three bugs above were browser bugs, so
the file kept the coverage that earned it and lost only its other half.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("en", "ru", "es", "pt")

#: Short forms and synonyms. Every other command has to be in HELP.
ALIASES = {"?", "LS", "ROLL", "FIND", "SYNC", "QUIT", "EVIDENCE", "CLUES", "LOG", "FORGE"}


@pytest.fixture(scope="module")
def web():
    if shutil.which("node") is None:
        pytest.skip("node is required to read the browser build's command set")
    done = subprocess.run(
        ["node", "tools/js_commands.mjs"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


# --- nothing is advertised that does not exist -----------------------------

def test_every_command_the_browser_dispatches_is_implemented(web):
    assert not web["broken"], (
        "these commands are wired to methods that do not exist: "
        + ", ".join(web["broken"])
    )


def test_every_method_the_engine_calls_on_itself_exists():
    """`this.log(...)` threw at runtime for as long as the file existed, and
    only in the one branch that reaches it. A missing method is a typo the
    language will not report until a player finds it."""
    source = (ROOT / "docs" / "js" / "engine.js").read_text(encoding="utf-8")
    body = source[source.index("export class Engine {"):]
    defined = set(re.findall(r"^  (?:async )?([A-Za-z_$][\w$]*)\(", body, re.MULTILINE))
    # A callback handed in through the constructor is callable too.
    defined |= set(re.findall(r"this\.([A-Za-z_$][\w$]*) =", body))
    called = set(re.findall(r"this\.([A-Za-z_$][\w$]*)\(", body))
    assert called <= defined, f"Engine calls methods it does not define: {sorted(called - defined)}"


@pytest.mark.parametrize("lang", LANGS)
def test_help_and_the_dispatch_table_agree_in_the_browser(web, lang):
    listed = {row[0].split()[0] for row in web["helpRows"][lang]}
    real = {name for name in web["commands"] if name not in ALIASES}
    assert real - listed == set(), f"not in HELP: {sorted(real - listed)}"
    assert listed - real == set(), f"HELP invents: {sorted(listed - real)}"


# --- every language is actually playable ------------------------------------

@pytest.mark.parametrize("lang", LANGS)
def test_the_browser_speaks_every_language_it_accepts(web, lang):
    """LANG ES was accepted and then HELP walked an undefined list. A language
    the game offers has to survive its own help screen."""
    assert lang in web["langs"]
    assert len(web["helpRows"][lang]) == len(web["helpRows"]["en"])
    assert web["aboutLines"][lang], f"ABOUT is empty in {lang}"


def test_the_browsers_narrative_strings_cover_the_same_languages():
    source = (ROOT / "docs" / "js" / "engine.js").read_text(encoding="utf-8")
    block = source[source.index("const TEXT = {"):source.index("\n};", source.index("const TEXT = {"))]
    for entry in re.findall(r"^  (\w+): \{(.*?)^  \},", block + "\n  },", re.DOTALL | re.MULTILINE):
        name, body = entry
        for lang in LANGS:
            assert re.search(rf"^    {lang}: ", body, re.MULTILINE), f"TEXT.{name} has no {lang}"


# --- OPEN reaches what CASES shows ------------------------------------------

def test_open_reaches_every_case_the_desk_lists_in_the_browser(web):
    assert web["deskSize"] > web["campaignSize"], "the probe took no contract"
    assert not web["unreachable"], (
        "CASES lists cases OPEN cannot find: " + ", ".join(map(str, web["unreachable"]))
    )


# --- progress is counted against the desk, not the campaign -----------------

def test_the_browser_counts_closed_cases_against_the_desk():
    source = (ROOT / "docs" / "js" / "engine.js").read_text(encoding="utf-8")
    status = source[source.index("  cmdStatus() {"):]
    status = status[:status.index("\n  }")]
    assert "caseload(this.progress)" in status, \
        "STATUS is counting against something other than the desk"


# --- the sidebar is wired to builders that exist ----------------------------

def test_every_sidebar_panel_has_a_builder(web):
    """A panel renamed in the list but not in the build map called undefined()
    and took the whole interface down (7be6869). The row list and the build map
    are the same list written twice; this compares them."""
    assert not web["panelsWithoutBuilder"], (
        "sidebar rows with no builder: " + ", ".join(web["panelsWithoutBuilder"])
    )
    assert not web["buildersWithoutPanel"], (
        "builders no row reaches: " + ", ".join(web["buildersWithoutPanel"])
    )


def test_every_builder_the_map_names_is_defined(web):
    """The other half of the same bug: a map entry pointing at a method that
    was never written. `this.buildX()` throws only when someone opens it."""
    assert not web["missingBuilders"], (
        "the panel map calls methods GuiApp does not define: "
        + ", ".join(web["missingBuilders"])
    )


def test_the_sidebar_shortcuts_are_reachable_and_unique(web):
    """Digits 1-9 then 0, in that order — the tenth row takes 0 the way a tenth
    tab always does, because there is no key between 9 and 10.

    There are eleven rows now and only ten digits, so one row carries a letter.
    It may sit anywhere: what must hold is that the digits keep their order, so
    a row added in the middle never renumbers the rows a player already knows.
    A lettered key has to be a single character, because `openByKey` is handed
    one `event.key` and compares the whole of it, and every key has to be
    unique once folded or two rows answer the same press.
    """
    keys = web["panelKeys"]
    digits = [k for k in keys if k.isdigit()]
    expected = [str(n) for n in range(1, min(len(digits), 9) + 1)]
    if len(digits) == 10:
        expected.append("0")
    assert digits == expected, f"the sidebar digits are not in order: {digits}"

    for key in keys:
        assert len(key) == 1, f"a shortcut must be one character, got {key!r}"
        assert key.isdigit() or key.isalpha(), f"odd shortcut: {key!r}"

    folded = [k.lower() for k in keys]
    assert len(set(folded)) == len(folded), f"two rows answer the same key: {keys}"