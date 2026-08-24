"""Static checks on the published web build.

A stylesheet with one unbalanced brace still "loads": the browser silently drops
every rule after the mistake and the layout collapses with no error anywhere.
That happened once during development, so it is guarded here.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

DOCS = Path(__file__).resolve().parent.parent / "docs"

CSS_FILES = sorted(DOCS.glob("css/*.css"))
JS_FILES = sorted(DOCS.rglob("js/**/*.js"))


def strip_css_noise(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"'[^']*'|\"[^\"]*\"", "", text)


@pytest.mark.parametrize("path", CSS_FILES, ids=lambda p: p.name)
def test_stylesheet_braces_balance(path):
    depth = 0
    for line_number, line in enumerate(strip_css_noise(path.read_text()).splitlines(), 1):
        depth += line.count("{") - line.count("}")
        assert depth >= 0, f"{path.name}: unmatched '}}' on line {line_number}"
    assert depth == 0, f"{path.name}: {depth} block(s) left open"


@pytest.mark.parametrize("path", CSS_FILES, ids=lambda p: p.name)
def test_stylesheet_has_no_unclosed_media_query(path):
    """An open @media swallows every rule after it into a condition."""
    text = strip_css_noise(path.read_text())
    assert text.count("@media") == len(re.findall(r"@media[^{]*\{", text))


def test_index_references_only_files_that_exist():
    html = (DOCS / "index.html").read_text()
    referenced = re.findall(r'(?:href|src)="([^"#:]+)"', html)
    for reference in referenced:
        if reference.startswith(("http", "data:", "//")):
            continue
        assert (DOCS / reference).is_file(), f"index.html references missing {reference}"


def test_index_wires_up_both_modes():
    html = (DOCS / "index.html").read_text()
    for required in ('id="gui-root"', 'id="screen-frame"', 'id="glitch-canvas"',
                     'id="mode-gui"', 'id="mode-cl"'):
        assert required in html, f"index.html lost {required}"


@pytest.mark.parametrize("path", JS_FILES, ids=lambda p: str(p.relative_to(DOCS)))
def test_module_imports_resolve(path):
    """Every relative import must point at a file that is actually shipped."""
    source = path.read_text()
    for target in re.findall(r"""(?:from|import)\s+['"](\.[^'"]+)['"]""", source):
        resolved = (path.parent / target).resolve()
        assert resolved.is_file(), f"{path.name} imports missing {target}"


def strip_js_comments(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    return re.sub(r"(?<![:\w])//[^\n]*", "", source)


def test_no_module_uses_inner_html():
    """The GUI builds nodes through `el`; innerHTML would open an injection path."""
    for path in JS_FILES:
        code = strip_js_comments(path.read_text())
        assert "innerHTML" not in code, f"{path.name} uses innerHTML"


def journal_tools_written_by(path):
    """Tool names the module records, including the two recordDecrypt covers."""
    source = strip_js_comments(path.read_text())
    tools = set(re.findall(r"""\blog\(\s*['"]([a-z]+)['"]""", source))
    if "recordDecrypt(" in source:
        tools |= {"decrypt", "random"}
    return tools


@pytest.mark.parametrize("module", ["js/engine.js", "js/gui/app.js"],
                         ids=["command-line", "gui"])
def test_every_journal_tool_is_recorded(module):
    """A tool that quietly skips the journal leaves a hole in the case record.

    This is a static check on purpose: an earlier version of the command line
    silently failed to log wordlist searches because a patch matched nothing,
    and nothing in the suite noticed.
    """
    from neon_terminal.journal import TOOLS

    recorded = journal_tools_written_by(DOCS / module)
    missing = set(TOOLS) - recorded
    assert not missing, f"{module} never journals: {sorted(missing)}"


def test_both_builds_share_one_journal_key():
    """The GUI and the command line must read and write the same store."""
    journal = (DOCS / "js" / "journal.js").read_text()
    keys = re.findall(r"STORAGE_KEY\s*=\s*'([^']+)'", journal)
    assert keys == ["neon-terminal/journal/v1"]
    for module in ("js/engine.js", "js/gui/app.js"):
        source = (DOCS / module).read_text()
        assert "from './journal.js'" in source or "from '../journal.js'" in source
        # Neither front-end may keep its own private copy of the key.
        assert "neon-terminal/journal" not in source
