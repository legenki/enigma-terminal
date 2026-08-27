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

from enigma_terminal.game import COMMANDS

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"

#: Only the browser has a clipboard.
WEB_ONLY = {"COPY"}
#: Short forms, called out in one line rather than given rows of their own.
ALIASES = {"?", "LS", "ROLL", "FIND", "SYNC", "LOG", "QUIT", "EVIDENCE", "CLUES"}


@pytest.fixture(scope="module")
def readme() -> str:
    return README.read_text(encoding="utf-8")


def test_there_is_one_readme_and_it_is_english(readme):
    assert not (ROOT / "README.en.md").exists(), \
        "the translated copy is back; there is meant to be one README"
    cyrillic = sorted(set(re.findall(r"[Ѐ-ӿ]+", readme)))
    assert not cyrillic, f"the README is meant to be English only: {cyrillic[:5]}"


def test_the_command_table_matches_the_commands_that_exist(readme):
    block = readme[readme.index("| Command | What it does |"):readme.index("Short forms exist")]
    listed = set()
    for line in block.splitlines():
        if line.startswith("| `"):
            listed |= set(re.findall(r"`([A-Z_]+)", line.split("|")[1]))

    invented = listed - set(COMMANDS) - WEB_ONLY
    assert not invented, f"the README documents commands that do not exist: {sorted(invented)}"
    missing = set(COMMANDS) - listed - ALIASES
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


def test_nothing_still_points_at_the_pre_rename_address(readme):
    """The repository was renamed. GitHub redirects the repo URL; Pages does
    not, so the old address is a flat 404 — and it was what the README handed
    every reader, in three places.

    Checked over the whole tree rather than the files that were known to carry
    it: the first sweep fixed the README, pyproject and the About panel, and
    missed the User-Agent the explorers actually receive.
    """
    stale = "neon-terminal"

    # Two places keep the old name on purpose, and would cost real damage to
    # "fix": one is the localStorage prefix a pre-rename save is read from, the
    # other seeds the RNG that wrote all 256 published contract answers.
    exempt = {
        Path("docs/js/storage.js"),
        Path("tools/generate_cases.py"),
        Path("data/contracts.json"),
        Path("tests/test_readme.py"),
        Path("tests/test_web_assets.py"),
    }
    skip_dirs = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache"}
    suffixes = {".py", ".js", ".mjs", ".css", ".html", ".md", ".toml", ".yml", ".yaml"}

    offenders = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in suffixes:
            continue
        if set(path.relative_to(ROOT).parts) & skip_dirs:
            continue
        if path.relative_to(ROOT) in exempt:
            continue
        if stale in path.read_text(encoding="utf-8", errors="ignore"):
            offenders.append(str(path.relative_to(ROOT)))

    assert not offenders, f"these still point at the pre-rename name: {offenders}"

    # And the two exemptions have to still be the thing they are exempt for.
    storage = (ROOT / "docs" / "js" / "storage.js").read_text(encoding="utf-8")
    assert f"LEGACY_PREFIX = '{stale}/'" in storage, \
        "the migration away from the old save keys is gone"
    generator = (ROOT / "tools" / "generate_cases.py").read_text(encoding="utf-8")
    assert f'MASTER_SEED = "bip39-{stale}/contract-board/v1"' in generator, \
        "the board seed moved — every contract answer just changed"
