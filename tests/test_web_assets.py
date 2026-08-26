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
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
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


def test_there_is_one_surface_and_the_terminal_lives_in_it():
    """The terminal used to be a second mode reached by a rocker at the foot.
    It is a panel now, so the page has one surface and the frame it adopts."""
    html = (DOCS / "index.html").read_text()
    for required in ('id="gui-root"', 'id="screen-frame"', 'id="glitch-canvas"'):
        assert required in html, f"index.html lost {required}"
    for gone in ('id="mode-gui"', 'id="mode-cl"', 'id="crt-layer"', 'id="crt-overlay"'):
        assert gone not in html, f"{gone} belongs to the two-mode shell"
    assert 'id="gui-root" class="is-hidden"' not in html, \
        "nothing unhides the GUI any more, so it must not start hidden"


@pytest.mark.parametrize("path", JS_FILES, ids=lambda p: str(p.relative_to(DOCS)))
def test_module_imports_resolve(path):
    """Every relative import must point at a file that is actually shipped."""
    source = path.read_text()
    for target in re.findall(r"""(?:from|import)\s+['"](\.[^'"]+)['"]""", source):
        resolved = (path.parent / target).resolve()
        assert resolved.is_file(), f"{path.name} imports missing {target}"


def strip_js_comments(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.DOTALL)
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
    from enigma_terminal.journal import TOOLS

    recorded = journal_tools_written_by(DOCS / module)
    missing = set(TOOLS) - recorded
    assert not missing, f"{module} never journals: {sorted(missing)}"


def test_both_builds_share_one_journal_key():
    """The GUI and the command line must read and write the same store."""
    journal = (DOCS / "js" / "journal.js").read_text()
    keys = re.findall(r"STORAGE_KEY\s*=\s*'([^']+)'", journal)
    assert keys == ["enigma-terminal/journal/v1"]
    for module in ("js/engine.js", "js/gui/app.js"):
        source = (DOCS / module).read_text()
        assert "from './journal.js'" in source or "from '../journal.js'" in source
        # Neither front-end may keep its own private copy of the key.
        assert "enigma-terminal/journal" not in source


# --- vendored dependency ---------------------------------------------------

def test_vendored_library_ships_its_licence():
    """Vendoring is fine; vendoring without the licence is not."""
    vendor = DOCS / "js" / "vendor"
    assert (vendor / "minidenticons.js").is_file()
    licence = (vendor / "LICENSE").read_text()
    assert "MIT License" in licence
    assert "Laurent Payot" in licence
    source = (vendor / "minidenticons.js").read_text()
    assert "laurentpayot/minidenticons" in source
    assert "MIT License" in source


def test_page_makes_no_third_party_requests():
    """Everything but the font and the chain lookups must be served by us."""
    html = (DOCS / "index.html").read_text()
    external = re.findall(r'(?:href|src)="(https?://[^"]+)"', html)
    for url in external:
        assert url.startswith(("https://fonts.googleapis.com", "https://fonts.gstatic.com")), \
            f"index.html pulls from {url}"
    for path in JS_FILES:
        code = strip_js_comments(path.read_text())
        for url in re.findall(r"""from\s+['"](https?://[^'"]+)['"]""", code):
            raise AssertionError(f"{path.name} imports from the network: {url}")


# --- identicons ------------------------------------------------------------

def test_sigils_are_keyed_by_fingerprint_not_by_words():
    """A phrase must never be used as an identicon seed — that is a leak path."""
    source = strip_js_comments((DOCS / "js" / "identicon.js").read_text())
    assert "fingerprint(mnemonic)" in source
    # The raw phrase may appear only as the argument being hashed.
    assert "sigil(`enigma-seed-${mnemonic}" not in source


# --- the terminal ----------------------------------------------------------

def test_the_crt_simulation_is_gone_entirely():
    """A scanline wash and a phosphor bloom belonged to the tube. The screen
    is a flat panel in a daylit interface now, and half a CRT left behind is
    worse than none."""
    assert not (DOCS / "js" / "crt.js").exists()
    for path in [DOCS / "index.html", DOCS / "css" / "terminal.css",
                 DOCS / "css" / "gui.css", DOCS / "js" / "main.js"]:
        source = strip_js_comments(path.read_text())
        assert "crt" not in source.lower(), f"{path.name} still mentions the CRT"


def test_the_terminal_is_a_panel_that_adopts_its_canvas():
    """Rebuilding the canvas on every visit would drop the scrollback, so the
    panel takes the frame main.js already made."""
    app = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text())
    assert "id: 'terminal'" in app
    assert app.index("id: 'terminal'") < app.index("id: 'cases'"), \
        "the terminal is meant to be the first row"
    assert "buildTerminal()" in app
    assert "this.terminalHost" in app
    assert "this.onTerminalShown()" in app, "the canvas never gets told to measure"

    main = strip_js_comments((DOCS / "js" / "main.js").read_text())
    assert "terminalHost: screenFrame" in main
    assert "onTerminalShown:" in main
    # `daylight.setMode` is a different thing; the shell-level one is gone.
    assert "function setMode" not in main, "the two-mode switch is back"
    assert "id('mode-cl')" not in main and "mode-gui" not in main


def test_the_screen_keeps_one_colour_whatever_the_hour():
    """A terminal that drifted with the daylight would stop reading as one."""
    css = (DOCS / "css" / "terminal.css").read_text()
    block = css[css.index("#screen-frame {"):]
    block = block[:block.index("}")]
    assert "#363248" in block, "the screen lost its fixed ground"
    assert "var(--bg)" not in block

    term = (DOCS / "js" / "term.js").read_text()
    assert "export const GROUND = '#363248';" in term
    assert "'#39ff8b'" not in term, "the phosphor palette is still in the terminal"


def test_the_typed_command_is_lit_apart_from_the_output():
    term = (DOCS / "js" / "term.js").read_text()
    assert "style: 'command'" in term, "the echoed command is not highlighted"
    assert "style: 'prompt'" in term
    for role in ("text", "command", "prompt"):
        assert re.search(rf"^  {role}: '#", term, re.MULTILINE), f"no {role} colour"


def test_the_banner_carries_the_switch_and_not_a_source_link():
    """The footer went with the GUI/CL rocker it existed to hold, so the
    daylight switch and the busy lamp moved up into the banner. The source
    link lives in the About panel, where it always belonged."""
    html = (DOCS / "index.html").read_text()
    assert "<footer" not in html
    banner = html[html.index('<header id="glitch-bar">'):html.index("</header>")]
    assert 'id="light-switch"' in banner
    assert 'id="power-led"' in banner
    assert "github.com" not in banner
    assert "github.com/legenki/neon-terminal" in (DOCS / "js" / "gui" / "app.js").read_text()


def test_sidebar_clicks_open_the_section_not_the_last_item():
    """Clicking Case files after reading a contract used to re-open that
    contract, because the drill-down was never cleared."""
    source = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text())
    assert "openSection(panel" in source
    assert "onClick: () => this.openSection(panel.id)" in source
    section = source[source.index("openSection(panel"):]
    section = section[:section.index("\n  }")]
    assert "this.activeCaseId = null" in section
    assert "this.activeClient = null" in section


def test_taking_a_contract_is_persisted_in_the_shared_store():
    core = strip_js_comments((DOCS / "js" / "core.js").read_text())
    for member in ("take(id)", "drop(id)", "isTaken(id)", "caseload(progress)"):
        assert member in core, f"core.js lost {member}"
    # Both front-ends must go through the store, never keep their own list.
    for module in ("js/engine.js", "js/gui/app.js"):
        text = strip_js_comments((DOCS / module).read_text())
        assert "progress.take(" in text, f"{module} never takes a contract"


# --- the web build must speak every language it offers ----------------------

LANGS = ("ru", "en", "es", "pt")


def test_no_front_end_decides_language_with_a_binary_ternary():
    """`lang === 'ru' ? … : …` silently renders English for es and pt. The GUI
    once carried 52 of them, so every Spanish player got an English interface
    wrapped around a Spanish case file."""
    offenders = {}
    for module in ("js/engine.js", "js/journal.js", "js/gui/app.js", "js/main.js"):
        source = (DOCS / module).read_text(encoding="utf-8")
        hits = re.findall(r"lang\s*===\s*'ru'", source)
        if hits:
            offenders[module] = len(hits)
    assert not offenders, (
        f"binary ru/en ternaries left: {offenders}. Add the string to the "
        "language dictionary instead, so es and pt get it too."
    )


def test_the_language_switcher_offers_every_shipped_language():
    core = (DOCS / "js" / "core.js").read_text(encoding="utf-8")
    listed = re.search(r"export const LANGS = \[([^\]]+)\]", core)
    assert listed, "core.js no longer exports LANGS"
    codes = re.findall(r"'(\w+)'", listed.group(1))
    assert tuple(codes) == LANGS, codes

    # The switcher moved out of the sidebar and into the strip; wherever it
    # lives, it has to be built from LANGS rather than from a hand-written list.
    main = (DOCS / "js" / "main.js").read_text(encoding="utf-8")
    assert "LANGS.map" in main, "the switcher hardcodes its languages again"
    gui = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    assert "btn--lang" not in gui, "the four sidebar language buttons are back"
    engine = (DOCS / "js" / "engine.js").read_text(encoding="utf-8")
    assert "LANGS.includes(choice)" in engine, "LANG rejects languages the game ships"

    # Every language names itself in the menu, so it is readable by whoever
    # needs to pick it.
    for endonym in ("Русский", "English", "Español", "Português"):
        assert endonym in core, f"core.js has no endonym for {endonym}"


def test_gui_text_dictionary_is_complete():
    """A key missing es or pt falls back to English without a word of warning."""
    source = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    block = source[source.index("const T = {"):source.index("const t = (key, lang)")]
    entries = re.findall(r"^  (\w+): \{(.*?)\},$", block, re.DOTALL | re.MULTILINE)
    assert len(entries) > 50, f"only found {len(entries)} keys — parser drifted"
    for key, body in entries:
        for lang in LANGS:
            assert re.search(rf"\b{lang}:\s*'", body), f"T.{key} has no {lang}"


def test_saves_made_before_the_rename_are_adopted_not_orphaned():
    """Renaming the storage keys would wipe every game already in a browser."""
    storage = (DOCS / "js" / "storage.js").read_text(encoding="utf-8")
    assert "neon-terminal/" in storage, "the legacy key prefix is gone"
    assert "enigma-terminal/" in storage
    for module in ("js/core.js", "js/journal.js", "js/main.js"):
        source = (DOCS / module).read_text(encoding="utf-8")
        assert "from './storage.js'" in source, f"{module} reads localStorage raw"
        assert "localStorage.getItem" not in source, \
            f"{module} bypasses the migration and would orphan old saves"


def test_the_real_wallet_warning_is_never_left_in_english():
    """The one line standing between a player and a funded address."""
    engine = (DOCS / "js" / "engine.js").read_text(encoding="utf-8")
    block = engine[engine.index("const REAL_WALLET = {"):]
    block = block[:block.index("};")]
    for lang in LANGS:
        assert re.search(rf"^  {lang}: '", block, re.MULTILINE), f"no {lang} wallet warning"


# --- sidebar, rail and surface layering ------------------------------------

def test_the_sidebar_names_panels_with_glyphs_not_numbers():
    source = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8"))
    assert "from '../vendor/feather.js'" in source
    assert "icon(panel.glyph)" in source
    assert "class: 'nav__key'" not in source, "the numbered column is back"

    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")
    assert ".nav__key" not in css

    feather = (DOCS / "js" / "vendor" / "feather.js").read_text(encoding="utf-8")
    for glyph in ("folder", "grid", "key", "database", "search", "shuffle",
                  "bookOpen", "info"):
        assert re.search(rf"^\s+{glyph}:\s*\[", feather, re.MULTILINE), f"no {glyph} icon"
    assert (DOCS / "js" / "vendor" / "LICENSE-feather").exists(), "Feather is MIT; ship the licence"


def test_the_panel_digits_actually_do_something():
    """The sidebar printed 1-8 beside every row from the day it was built and
    nothing listened for them. The number moved into the row's title, so the
    handler has to exist or the tooltip is lying in its place."""
    app = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8"))
    assert "openByKey(digit)" in app

    main = strip_js_comments((DOCS / "js" / "main.js").read_text(encoding="utf-8"))
    assert "gui.openByKey(event.key)" in main
    assert "'INPUT', 'TEXTAREA'" in main, "digits would fire while typing a seed"


def test_the_rail_holds_the_two_lookups_permanently():
    """The wordlist and the missing-word recovery were tabs inside a panel:
    looking a word up meant leaving whatever you were reading, and seeing one
    tool meant losing the other. They live in the rail now, both at once."""
    source = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8"))
    block = source[source.index("  paintRail() {"):]
    block = block[:block.index("\n  }\n")]
    for pane in ("searchWordsPane()", "searchCompletePane()"):
        assert pane in block, f"the rail no longer builds {pane}"
    assert "journal.all()" not in block, "the rail is mirroring the journal again"

    # And the Archive panel is left with the one thing it is named for.
    archive = source[source.index("  buildArchive() {"):]
    archive = archive[:archive.index("\n  }\n")]
    assert "searchArchivePane()" in archive
    for gone in ("searchWordsPane()", "searchCompletePane()", "class: 'tabs'"):
        assert gone not in archive, f"the archive panel still carries {gone}"

    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")
    columns = re.search(r"grid-template-columns: 210px minmax\(0, 1fr\) (\d+)px", css)
    assert columns and int(columns.group(1)) >= 320, "the rail lost its width"


def test_surfaces_are_layered_not_flattened():
    """A window body painted the same colour as the cards inside it makes word
    tiles and case rows dissolve into their own container — which is exactly
    what shipped the first time."""
    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")

    def background(selector):
        block = css[css.index(selector):]
        block = block[:block.index("}")]
        found = re.search(r"background: var\((--[\w-]+)\)", block)
        return found.group(1) if found else None

    assert background(".win {") == "--bg"
    assert background(".word {") == "--surface"
    assert background(".card {") == "--surface"
    assert background(".notice {") == "--tint"


# --- the strip above the interface -----------------------------------------

def test_the_strip_is_a_window_like_the_rest_and_not_a_slab():
    """It was 72px of its own black with green hardware on it, over a warm
    daylit interface: the loudest thing on screen was the one thing nobody
    clicks."""
    css = (DOCS / "css" / "terminal.css").read_text(encoding="utf-8")
    shell = css[css.index("#shell {"):css.index("\n}", css.index("#shell {"))]
    rows = re.search(r"grid-template-rows: (\d+)px", shell)
    assert rows and int(rows.group(1)) <= 40, f"the strip is back to {shell}"

    bar = css[css.index("#glitch-bar {"):css.index("\n}", css.index("#glitch-bar {"))]
    assert "var(--surface)" in bar, "the strip does not take the daylight ground"
    assert "var(--line)" in bar, "the strip does not take the daylight hairline"
    assert not re.search(r"#[0-9a-fA-F]{3,6}", bar), f"a literal colour is back: {bar}"

    # The canvas must be pinned, or it sizes its backing store from a box that
    # its own backing store just changed, and grows on every frame.
    mark = css[css.index("#glitch-canvas {"):css.index("\n}", css.index("#glitch-canvas {"))]
    assert "width: 18px" in mark and "height: 18px" in mark


def test_the_mark_is_drawn_for_the_size_it_is_given():
    """The banner clamped itself to 200x40 before measuring. At 18px that put
    the wordmark off its own left edge — the mark rendered as one stray glyph."""
    source = strip_js_comments((DOCS / "js" / "glitch.js").read_text(encoding="utf-8"))
    assert "compact" in source, "the banner has no compact mode"
    resize = source[source.index("resize() {"):]
    resize = resize[:resize.index("\n  }")]
    assert "this.compact" in resize, "the size floor does not shrink with the mark"


def test_the_strip_carries_both_controls_and_the_status():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    bar = html[html.index('<header id="glitch-bar">'):html.index("</header>")]
    for required in ('id="light-switch"', 'id="power-led"', 'id="lang-select"',
                     'id="bar-status"', 'id="glitch-canvas"'):
        assert required in bar, f"the strip lost {required}"
    assert "rocker" not in bar, "the phosphor rocker is back"
    assert "СВЕТ" not in bar and "ДЕНЬ" not in bar, "the strip is pinned to one language again"


def test_the_dropdown_is_a_listbox_and_reachable_from_the_keyboard():
    """A native <select> could not take the interface's own type and ground,
    so this one is hand-built — which means it owes the keyboard everything a
    <select> would have given for free."""
    source = strip_js_comments((DOCS / "js" / "select.js").read_text(encoding="utf-8"))
    for required in ("aria-haspopup", "aria-expanded", "'listbox'", "'option'",
                     "aria-selected", "Escape", "ArrowDown", "ArrowUp"):
        assert required in source, f"the dropdown has no {required}"
    assert "innerHTML" not in source, "the dropdown builds DOM from strings"
    assert "focusout" in source, "tabbing out leaves the menu open"
    assert "pointerdown" in source, "a click outside does not dismiss the menu"


def test_the_rail_follows_a_language_change():
    """The two lookups are cached, and setLang was clearing the panels but not
    them — so they kept the language the player had just left."""
    source = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8"))
    block = source[source.index("setLang(lang) {"):]
    block = block[:block.index("\n  }")]
    assert "railPanes = null" in block, "a language change no longer drops the rail"


def test_no_phosphor_green_is_left_in_the_stylesheets():
    """The neon tints outlived the tube: a wash over every window title bar,
    a grid over the whole interface, an inner glow in every field."""
    for name in ("gui.css", "terminal.css"):
        css = (DOCS / "css" / name).read_text(encoding="utf-8")
        for green in ("34, 255, 122", "57, 255, 139", "#39ff8b", "#22ff7a"):
            assert green not in css, f"{name} still carries the phosphor tint {green}"
