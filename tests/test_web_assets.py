"""Static checks on the published web build.

A stylesheet with one unbalanced brace still "loads": the browser silently drops
every rule after the mistake and the layout collapses with no error anywhere.
That happened once during development, so it is guarded here.
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


def journal_tools_declared():
    """The vocabulary the shipped journal defines.

    Read off `docs/js/journal.js` rather than a Python copy of the same list.
    There used to be a copy, in a module that served the Python terminal; with
    that gone, a second list would only be a second thing to forget to update.
    """
    source = (DOCS / "js" / "journal.js").read_text(encoding="utf-8")
    start = source.index("export const TOOLS = {")
    block = source[start:source.index("\n};", start)]
    tools = set(re.findall(r"^  (\w+): \{", block, re.MULTILINE))
    assert len(tools) > 5, f"only found {sorted(tools)} — the parser drifted"
    return tools


@pytest.mark.parametrize("module", ["js/engine.js", "js/gui/app.js"],
                         ids=["command-line", "gui"])
def test_every_journal_tool_is_recorded(module):
    """A tool that quietly skips the journal leaves a hole in the case record.

    This is a static check on purpose: an earlier version of the command line
    silently failed to log wordlist searches because a patch matched nothing,
    and nothing in the suite noticed.
    """
    recorded = journal_tools_written_by(DOCS / module)
    missing = journal_tools_declared() - recorded
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


def test_the_screen_follows_the_hour_on_a_ground_of_its_own():
    """It was pinned to one colour while everything around it moved, then took
    a violet ground of its own. It takes `--sunken` now: the tone the interface
    already puts under every field."""
    css = (DOCS / "css" / "terminal.css").read_text()
    block = css[css.index("#screen-frame {"):]
    block = block[:block.index("}")]
    assert "var(--sunken)" in block, "the screen does not take the daylight ground"
    assert not re.search(r"background:\s*#[0-9a-fA-F]{3,6}", block), \
        "the screen is pinned to a literal again"

    term = (DOCS / "js" / "term.js").read_text()
    assert "'#39ff8b'" not in term, "the phosphor palette is still in the terminal"


def test_a_palette_change_repaints_what_is_already_on_screen():
    """Segments used to store the colour resolved at the moment they were
    printed, so a screen that changed palette kept every old line in the
    colours of the hour it was written."""
    term = strip_js_comments((DOCS / "js" / "term.js").read_text())
    assert "style: segment.style" in term, "wrapped rows drop the style"
    assert "this.colour(segment.style)" in term, "drawing does not resolve the style"
    assert not re.search(r"color:\s*colourOf", term), "colours are resolved at write time"
    assert "setPalette(next)" in term, "the terminal cannot be given a new palette"


def test_the_terminal_is_the_panel_the_game_opens_on():
    source = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text())
    assert "this.panel = 'terminal'" in source, "the game no longer opens on the terminal"
    assert "this.panel = 'cases'" not in source


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
    assert "github.com/legenki/enigma-terminal" in (DOCS / "js" / "gui" / "app.js").read_text()


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

LANGS = ("en", "es", "pt", "ru")


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


@pytest.mark.skipif(shutil.which("node") is None, reason="node runs the store")
@pytest.mark.parametrize(
    "body",
    ["[]", "null", '"hello"', "42", "{}", '{"solved": 5}', '{"taken": 5}',
     '{"hints": [1, 2]}', '{"solved": ["x", 3], "taken": [9]}'],
)
def test_a_hand_edited_save_is_a_fresh_save_not_a_stack_trace(body):
    """Broken JSON was always handled; JSON that parses into the wrong *type*
    was not. `{"solved": 5}` survived the guard and reached `.includes(...)` on
    the first render, which takes the whole interface down.

    The Python build had this guard and a test for it. That build is gone, and
    the rule belongs to whatever actually reads the save — so it is checked
    here, against the store the browser ships.
    """
    script = """
      const { ProgressStore } = await import('./docs/js/core.js');
      globalThis.localStorage = {
        _v: BODY,
        getItem(k) { return this._v; },
        setItem() {}, removeItem() {},
      };
      const data = ProgressStore.read();
      // Every field has to survive the use it is actually put to.
      data.solved.includes(1);
      data.taken.includes(1);
      Object.keys(data.hints);
      console.log(JSON.stringify(data));
    """.replace("BODY", json.dumps(body))
    done = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, f"a save of {body} broke the store:\n{done.stderr}"
    data = json.loads(done.stdout)
    assert isinstance(data["solved"], list)
    assert isinstance(data["taken"], list)
    assert isinstance(data["hints"], dict)
    # One unreadable id is not a reason to throw the whole save away.
    if body == '{"solved": ["x", 3], "taken": [9]}':
        assert data["solved"] == [3] and data["taken"] == [9]


def test_gui_text_dictionary_is_complete():
    """A key missing es or pt falls back to English without a word of warning."""
    source = (DOCS / "js" / "gui" / "text.js").read_text(encoding="utf-8")
    block = source[source.index("export const T = {"):source.index("export const t = (key, lang)")]
    entries = re.findall(r"^  (\w+): \{(.*?)\},$", block, re.DOTALL | re.MULTILINE)
    assert len(entries) > 50, f"only found {len(entries)} keys — parser drifted"
    for key, body in entries:
        for lang in LANGS:
            # Either quote style: a value containing an apostrophe — a
            # derivation path, say — is legitimately double-quoted.
            assert re.search(rf"\b{lang}:\s*['\"]", body), f"T.{key} has no {lang}"


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
    # Named for what it receives rather than for a digit: the eleventh row
    # carries a letter, because there is no eleventh digit.
    assert "openByKey(pressed)" in app

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


def test_the_rail_is_two_windows_that_fold_on_their_own():
    """It was one pane with two headings inside it. The wordlist is a glance and
    the recovery tool is a paragraph of chips, so wanting one without the other
    is the normal case — and a fold that springs back open on every visit is a
    setting the player is not allowed to keep."""
    source = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text())
    assert "buildRailTool(id, titleKey)" in source, "the rail has no window builder"
    assert "buildRailTool('words', 'tabWords')" in source
    assert "buildRailTool('complete', 'tabComplete')" in source
    fold = source[source.index("foldRailTool(tool, folded"):]
    fold = fold[:fold.index("\n  }")]
    assert "is-folded" in fold, "folding does not mark the window"
    assert "aria-expanded" in fold, "the fold is invisible to a screen reader"
    assert "store(" in fold, "the fold is not remembered"

    css = (DOCS / "css" / "gui.css").read_text(encoding="utf-8")
    assert ".rail__win.is-folded .win__body" in css, "a folded window still shows its body"


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


def test_the_banner_holds_still_for_reduced_motion():
    """The stylesheets honour prefers-reduced-motion in three places, but the
    one animation that never stops — a canvas redrawn every frame for as long
    as the page is open — did not ask about it at all."""
    source = strip_js_comments((DOCS / "js" / "glitch.js").read_text(encoding="utf-8"))
    assert "prefers-reduced-motion" in source, \
        "the banner animates forever without asking whether motion is wanted"

    render = source[source.index("render(now) {"):]
    render = render[: render.index("\n  }")]
    assert re.search(r"seconds\s*=.*matches|seconds\s*=\s*still", render), \
        "the clock the wobble and the drift read from is not frozen"


def test_the_title_no_longer_carries_the_specification_it_implements():
    """The game was called BIP-39: ENIGMA TERMINAL, and the 18px mark was the
    two digits of it. The spec is still named where it is being implemented —
    that is what those references are about — but not as the game's name."""
    named = []
    for path in [DOCS / "index.html", *JS_FILES, DOCS.parent / "README.md"]:
        if "vendor" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"BIP.?39\s*[:—–-]\s*ENIGMA", text, re.IGNORECASE):
            named.append(path.name)
    assert not named, f"these still title the game with the spec: {named}"


def test_an_address_is_encoded_before_it_reaches_a_url():
    """The explorer URL goes into an href as well as a request, so an unencoded
    address misdirects a link the player clicks, not just a fetch.

    This used to check the same rule in two builds. There is one now, and the
    rule is the browser's — where it matters more, because only the browser
    renders the result as something clickable."""
    web = strip_js_comments((DOCS / "js" / "chain.js").read_text(encoding="utf-8"))
    builders = re.findall(r"(?:address_?[Pp]ath|txs_?[Pp]ath|explorer(?:_url)?)[:=].*", web)
    assert builders, "the URL builders moved"
    for line in builders:
        if "${a}" in line or "{addr}" in line:
            assert "pathSafe" in line, f"an address reaches a URL unencoded: {line.strip()}"


def test_only_storage_js_touches_local_storage():
    """storage.js says it is the one place that knows about localStorage.

    Four modules had each grown a private copy of the same try/catch — needed
    because private browsing makes the accessor itself throw — and two of them
    read straight past the pre-rename migration while doing it.
    """
    offenders = []
    for path in JS_FILES:
        if path.name == "storage.js" or "vendor" in path.parts:
            continue
        if "localStorage" in strip_js_comments(path.read_text()):
            offenders.append(str(path.relative_to(DOCS)))
    assert not offenders, f"these reach localStorage around storage.js: {offenders}"


def test_the_panels_only_call_methods_their_clients_actually_have():
    """The Explorer called `chainExplorer.addressState` and nothing answered.

    The field names it wanted belonged to the API this build moved away from,
    and the move left the call behind — so the panel threw the moment anyone
    looked up an address, and every structural test here still passed, because
    a call to a method that does not exist looks exactly like a call to one
    that does until it runs.
    """
    app = strip_js_comments((DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8"))

    clients = {
        "chainExplorer": DOCS / "js" / "mempool.js",
        "chain": DOCS / "js" / "chain.js",
        "journal": DOCS / "js" / "journal.js",
        "progress": DOCS / "js" / "core.js",
    }
    missing = []
    for field, path in clients.items():
        source = path.read_text(encoding="utf-8")
        defined = set(re.findall(r"^\s{2}(?:async\s+|static\s+|get\s+)?(\w+)\s*\(", source, re.M))
        defined |= set(re.findall(r"^\s{2}(?:get|set)\s+(\w+)", source, re.M))
        for called in set(re.findall(rf"this\.{field}\.(\w+)\s*\(", app)):
            if called not in defined:
                missing.append(f"this.{field}.{called}() — {path.name} has no such method")
    assert not missing, "the panels call methods that do not exist:\n  " + "\n  ".join(missing)


def test_every_translated_string_the_panels_ask_for_exists():
    """`t('source')` in the rebuilt ledger, and the panel would not open.

    `t` is `T[key][lang] || T[key].en`, so a key that was never added throws
    on the missing `[lang]` rather than falling back to anything — and it
    throws while the panel is being *built*, which takes the whole panel with
    it. Six keys went in that way: the four the ledger's header and paths
    table wanted, plus `used` and `unused`, which hid inside a ternary.

    Keys reached through a plain variable (`t(state, lang)`) cannot be checked
    from here and are not; every literal one is, including both branches of a
    ternary. A string compared against rather than looked up would be read as
    a key and reported — there are none, and one arriving is worth a look.
    """
    dictionary = (DOCS / "js" / "gui" / "text.js").read_text(encoding="utf-8")
    block = dictionary[dictionary.index("export const T = {"):]
    defined = set(re.findall(r"^  (\w+):", block, re.MULTILINE))
    assert len(defined) > 50, f"only found {len(defined)} keys — parser drifted"

    missing = []
    for path in JS_FILES:
        source = path.read_text(encoding="utf-8")
        if path.name == "text.js" or "text.js'" not in source:
            continue
        code = strip_js_comments(source)
        for call in re.finditer(r"(?<![\w.])(t|tf)\(", code):
            # The key is the first argument: scan to the comma that ends it,
            # ignoring commas nested inside parentheses or brackets.
            depth, cut = 0, None
            for i in range(call.end(), len(code)):
                char = code[i]
                if char in "([{":
                    depth += 1
                elif char in ")]}":
                    if depth == 0:
                        cut = i
                        break
                    depth -= 1
                elif char == "," and depth == 0:
                    cut = i
                    break
            key_expression = code[call.end():cut if cut else call.end()]
            for key in re.findall(r"'([A-Za-z0-9_]+)'", key_expression):
                if key not in defined:
                    line = code[: call.start()].count("\n") + 1
                    missing.append(f"{path.name}:{line} — {call.group(1)}('{key}')")

    assert not missing, "the panels ask for strings the dictionary has not got:\n  " + "\n  ".join(missing)


def test_the_ledger_reads_everything_in_one_action():
    """It was three buttons — a balance, a sweep of the paths, a truncated
    history — and reading an address meant pressing all three and assembling
    the answer yourself."""
    # Sliced on the raw source — the section markers this cuts between are
    # comments, and stripping them first throws away the boundary.
    raw = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    ledger = strip_js_comments(
        raw[raw.index("buildLedger() {") : raw.index("\n  // ---- terminal")]
    )

    buttons = re.findall(r"text:\s*t\('(\w+)',\s*lang\)[^}]*onClick", ledger)
    assert "read" in buttons, "the ledger has no read action"
    for gone in ("syncOne", "sweep", "txlog"):
        assert gone not in buttons, f"the ledger still offers a separate {gone} button"


def test_the_history_pages_rather_than_truncating():
    """`transactions(address, limit)` cut the first page and called it the
    past. An address with 58 transactions showed ten of them."""
    raw = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    ledger = strip_js_comments(
        raw[raw.index("buildLedger() {") : raw.index("\n  // ---- terminal")]
    )
    assert "transactionPage(" in ledger, "the ledger does not page"
    assert "loadMore" in ledger, "there is no way to ask for the next page"

    chain = (DOCS / "js" / "chain.js").read_text(encoding="utf-8")
    assert "async transactionPage(" in chain
    # Esplora continues from the last txid seen; without that there is no page 2.
    assert "/chain/" in chain, "the continuation path is gone"


def test_a_transaction_row_carries_what_a_ledger_row_should():
    """Direction, amount, height, time, fee and the identifier. The old list
    had a txid and a delta, which is not a ledger."""
    chain = (DOCS / "js" / "chain.js").read_text(encoding="utf-8")
    for field in ("feeSats", "inputs", "outputs", "blockHeight", "blockTime"):
        assert field in chain, f"a transaction no longer carries {field}"
