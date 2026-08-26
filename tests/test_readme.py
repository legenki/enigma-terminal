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


def test_the_published_address_is_the_one_that_answers(readme):
    """The repository was renamed. GitHub redirects the repo URL; Pages does
    not, so the old address is a flat 404 — and it was the address the README
    handed every reader, in three places."""
    stale = "neon-terminal"
    assert stale not in readme, "the README still points at the pre-rename name"

    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert stale not in pyproject, "pyproject still points at the pre-rename name"

    about = (ROOT / "docs" / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    assert stale not in about, "the About panel still links to the pre-rename name"

    # storage.js is the exception, and has to stay: it is the localStorage
    # prefix a pre-rename save is read from.
    storage = (ROOT / "docs" / "js" / "storage.js").read_text(encoding="utf-8")
    assert f"LEGACY_PREFIX = '{stale}/'" in storage, \
        "the migration away from the old save keys is gone"
