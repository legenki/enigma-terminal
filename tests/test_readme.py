"""The README has to describe the program that exists.

It drifted badly once: it documented two modes switched with F2, a CRT toggle,
a WebGL shader file that had been deleted, two narrative languages out of four,
and a test count two hundred short. None of that is catchable by reading — it
is only catchable by comparing the prose against the code, which is what this
does for every claim in it that is checkable at all.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
#: Short forms, called out in one line rather than given rows of their own.
ALIASES = {"?", "LS", "ROLL", "FIND", "SYNC", "LOG", "QUIT", "EVIDENCE", "CLUES", "FORGE"}


@pytest.fixture(scope="module")
def readme() -> str:
    return README.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def web_commands() -> set[str]:
    """What the shipped terminal actually dispatches.

    This used to read a Python dispatch table. The commands the README
    documents were never Python's, though — they are the terminal's, and the
    terminal is a panel in the browser build, so that is where the list lives.
    """
    if shutil.which("node") is None:
        pytest.skip("node is required to read the browser build's command set")
    done = subprocess.run(
        ["node", "tools/js_commands.mjs"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    return set(json.loads(done.stdout)["commands"])


def test_there_is_one_readme_and_it_is_english(readme):
    assert not (ROOT / "README.en.md").exists(), \
        "the translated copy is back; there is meant to be one README"
    cyrillic = sorted(set(re.findall(r"[Ѐ-ӿ]+", readme)))
    assert not cyrillic, f"the README is meant to be English only: {cyrillic[:5]}"


def test_the_command_table_matches_the_commands_that_exist(readme, web_commands):
    block = readme[readme.index("| Command | What it does |"):readme.index("Short forms exist")]
    listed = set()
    for line in block.splitlines():
        if line.startswith("| `"):
            listed |= set(re.findall(r"`([A-Z_]+)", line.split("|")[1]))

    invented = listed - web_commands
    assert not invented, f"the README documents commands that do not exist: {sorted(invented)}"
    missing = web_commands - listed - ALIASES
    assert not missing, f"commands the README never mentions: {sorted(missing)}"


@pytest.mark.skipif(shutil.which("node") is None, reason="node reads the panel list")
def test_the_panel_table_matches_the_sidebar(readme):
    done = subprocess.run(
        ["node", "tools/js_commands.mjs"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    keys = json.loads(done.stdout)["panelKeys"]

    block = readme[readme.index("| | Panel | |"):readme.index("Two lookups sit permanently")]
    listed = [line.split("|")[1].strip().strip("*")
              for line in block.splitlines() if line.startswith("| **")]
    assert listed == keys, f"the README lists panels {listed}, the sidebar has {keys}"


def test_every_path_the_layout_names_exists(readme):
    """The tree still listed js/crt.js months after the file was deleted."""
    block = readme[readme.index("## Repository layout"):readme.index("## Development")]
    named = []
    prefix = ""
    for line in block.splitlines():
        match = re.match(r"^(\s*)([\w./_-]+/?)\s{2,}\S", line)
        if not match:
            continue
        indent, path = match.groups()
        if not indent:
            prefix = path if path.endswith("/") else ""
            named.append(path)
        else:
            # Indented rows hang off the last top-level directory.
            named.append(prefix + path)
    assert len(named) > 15, "the layout block stopped listing files"
    for path in named:
        assert (ROOT / path).exists(), f"the layout names {path}, which is not there"


def test_every_install_command_names_something_that_exists(readme):
    """It told readers to install from two requirements files that were never
    in the tree. The layout check only walks the layout block, so prose like
    this went unchecked — and `pip install -r requirements.txt` is the very
    first thing a new reader runs.
    """
    for name in re.findall(r"pip install -r ([\w.-]+)", readme):
        assert (ROOT / name).exists(), f"the README installs from {name}, which is not there"

    if extras := set(re.findall(r'pip install -e "\.\[(\w+)\]"', readme)):
        pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
        block = pyproject[pyproject.index("[project.optional-dependencies]"):]
        block = block[: block.index("\n[")]
        declared = set(re.findall(r"^(\w+) =", block, re.MULTILINE))
        assert extras <= declared, \
            f"the README installs extras {sorted(extras - declared)}, pyproject has {sorted(declared)}"


def test_the_quoted_test_count_is_the_real_one(readme):
    """The old README claimed 253 for a suite that had grown past 300."""
    quoted = {int(n) for n in re.findall(r"(\d+) tests", readme)}
    assert quoted, "the README no longer says how big the suite is"
    done = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "tests"],
        cwd=ROOT, capture_output=True, text=True, timeout=300,
    )
    per_file = re.findall(r"^tests/\S+\.py: (\d+)$", done.stdout, re.MULTILINE)
    assert per_file, done.stdout[-800:]
    real = sum(int(n) for n in per_file)
    assert quoted == {real}, f"the README says {sorted(quoted)}, the suite has {real}"


def test_no_removed_feature_is_still_documented(readme):
    """Each of these was in the README after the thing itself was deleted."""
    for gone in (r"crt\.js", r"\bF2\b", r"\bCRT\b", r"LANG RU\|EN`", r"README\.en\.md",
                 r"\bGUI\b(?!-)\s*(?:режим|mode)", r"two modes"):
        assert not re.search(gone, readme), f"the README still describes {gone}"


def test_nothing_still_points_at_the_pre_rename_name(readme):
    """The repository was renamed twice. GitHub redirects the repo URL; Pages
    does not, so the old address is a flat 404 — and it was what the README
    handed every reader, in three places.

    Checked over the whole tree rather than the files that were known to carry
    it: the first sweep fixed the README, pyproject and the About panel, and
    missed the User-Agent the explorers actually receive.

    Nothing is exempt any more. The two holdouts were the contract-board seed
    and the localStorage prefix a pre-rename save was read from; both were
    retired once the board had no players to strand, so the old name is simply
    gone.
    """
    stale = "neon-terminal"
    skip_dirs = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache"}
    suffixes = {".py", ".js", ".mjs", ".css", ".html", ".md", ".toml", ".yml", ".yaml", ".json"}

    offenders = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in suffixes:
            continue
        if set(path.relative_to(ROOT).parts) & skip_dirs:
            continue
        if path.relative_to(ROOT) == Path("tests/test_readme.py"):
            continue  # this file names the string in order to forbid it
        if stale in path.read_text(encoding="utf-8", errors="ignore"):
            offenders.append(str(path.relative_to(ROOT)))

    assert not offenders, f"these still carry the pre-rename name: {offenders}"


def test_every_place_that_states_a_version_states_the_same_one():
    """Three files carry it and nothing made them agree.

    pyproject is what pip installs, cases.json meta is what the About panel and
    the boot banner print, and __init__ is the fallback when the package is not
    installed. A release that bumps one of them is a release that ships two
    different version numbers to two different screens.
    """
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    packaged = re.search(r'^version = "([^"]+)"', pyproject, re.MULTILINE)
    assert packaged, "pyproject no longer declares a version"

    meta = json.loads((ROOT / "data" / "cases.json").read_text(encoding="utf-8"))["meta"]
    init = (ROOT / "enigma_terminal" / "__init__.py").read_text(encoding="utf-8")
    fallback = re.search(r'__version__ = "([^"]+)"', init)
    assert fallback, "the version fallback is gone"

    stated = {
        "pyproject.toml": packaged.group(1),
        "data/cases.json": meta["version"],
        "enigma_terminal/__init__.py": fallback.group(1),
    }
    assert len(set(stated.values())) == 1, f"the version has drifted apart: {stated}"


def test_the_changelog_covers_the_version_being_shipped():
    """A release nobody wrote down is a release nobody can describe later."""
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    version = re.search(r'^version = "([^"]+)"', pyproject, re.MULTILINE).group(1)
    changelog = ROOT / "CHANGELOG.md"
    assert changelog.exists(), "there is no CHANGELOG.md"
    assert f"## {version}" in changelog.read_text(encoding="utf-8"), \
        f"CHANGELOG.md has no entry for {version}"
