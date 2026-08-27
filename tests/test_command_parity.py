"""The two builds must offer the same terminal, and offer only what exists.

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
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from enigma_terminal.cases import Campaign, Progress
from enigma_terminal.chain import ChainClient
from enigma_terminal.game import COMMANDS, HELP_TEXT, TEXT, Session, dispatch
from enigma_terminal.journal import Journal
from enigma_terminal.ui import Screen

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("en", "ru", "es", "pt")

#: Short forms and synonyms. Every other command has to be in HELP.
ALIASES = {"?", "LS", "ROLL", "FIND", "SYNC", "QUIT", "EVIDENCE", "CLUES", "LOG"}


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


@pytest.fixture
def session(tmp_path):
    return Session(
        campaign=Campaign(),
        progress=Progress.load(tmp_path / "progress.json"),
        screen=Screen(colour=False, speed=0),
        chain=ChainClient(offline=True),
        journal=Journal(tmp_path / "journal.json"),
        lang="en",
    )


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


@pytest.mark.parametrize("lang", LANGS)
def test_help_and_the_dispatch_table_agree_in_the_terminal(lang):
    listed = {row[0].split()[0] for row in HELP_TEXT[lang]}
    real = {name for name in COMMANDS if name not in ALIASES}
    assert real - listed == set(), f"not in HELP: {sorted(real - listed)}"
    assert listed - real == set(), f"HELP invents: {sorted(listed - real)}"


def test_the_two_builds_offer_the_same_commands(web):
    """COPY is the one command only a browser can honour."""
    web_only = {"COPY"}
    js = set(web["commands"]) - web_only
    py = set(COMMANDS) - {"EXIT", "QUIT"} | {"EXIT", "QUIT"}
    assert js == py, (
        f"only in the browser: {sorted(js - py)}; only in the terminal: {sorted(py - js)}"
    )


# --- every language is actually playable ------------------------------------

@pytest.mark.parametrize("lang", LANGS)
def test_the_browser_speaks_every_language_it_accepts(web, lang):
    """LANG ES was accepted and then HELP walked an undefined list. A language
    the game offers has to survive its own help screen."""
    assert lang in web["langs"]
    assert len(web["helpRows"][lang]) == len(web["helpRows"]["en"])
    assert web["aboutLines"][lang], f"ABOUT is empty in {lang}"


@pytest.mark.parametrize("lang", LANGS)
def test_no_narrative_string_is_missing_a_language(lang):
    for key, bundle in TEXT.items():
        assert bundle.get(lang), f"TEXT[{key!r}] has nothing in {lang}"


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


def test_open_reaches_every_case_the_desk_lists_in_the_terminal(session):
    campaign = session.campaign
    contract = campaign.contracts[0]
    session.progress.take(contract.id)
    desk = campaign.caseload(session.progress)
    assert len(desk) > len(campaign.cases)
    for entry in desk:
        assert campaign.get(entry.id) is not None, f"CASES lists {entry.id}, OPEN cannot find it"


def test_a_taken_contract_can_actually_be_opened(session, capsys):
    contract = session.campaign.contracts[0]
    dispatch(session, f"OPEN {contract.id}")
    out = capsys.readouterr().out
    assert "NOT FOUND IN ARCHIVE" not in out
    assert session.active is not None and session.active.id == contract.id


# --- progress is counted against the desk, not the campaign -----------------

def test_status_counts_closed_cases_against_the_desk(session, capsys):
    """Closing a contract used to read 9/8: the numerator counted every solved
    case and the denominator only the campaign."""
    contract = session.campaign.contracts[0]
    session.progress.take(contract.id)
    session.progress.mark_solved(contract.id)
    dispatch(session, "STATUS")
    out = capsys.readouterr().out
    line = next(row for row in out.splitlines() if "CASES CLOSED" in row)
    closed, total = (int(part) for part in re.search(r"(\d+)/(\d+)", line).groups())
    assert closed <= total, f"more cases closed than exist: {line.strip()}"
    assert total == len(session.campaign.caseload(session.progress))


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


def test_the_digit_shortcuts_cover_the_sidebar(web):
    """One digit per row, in order. The tenth row takes 0, the way a tenth tab
    always does — there is no key between 9 and 10."""
    keys = web["panelKeys"]
    assert len(keys) <= 10, f"{len(keys)} panels, and only ten digits to reach them"
    expected = [str(n) for n in range(1, min(len(keys), 9) + 1)]
    if len(keys) == 10:
        expected.append("0")
    assert keys == expected, f"the sidebar digits are not in order: {keys}"
