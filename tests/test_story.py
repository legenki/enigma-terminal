"""The first act of the case file: the book, the papers and the Acta.

The riddles open a wallet; these check the investigation that comes after. The
story data keeps a digest of the answer rather than the answer, so the suite
holds the key in `tests/answers.py`, the same way it does for the eight seeds,
and plays the real browser modules under Node through `tools/js_story.mjs`.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from enigma_terminal import crypto_engine as ce
from enigma_terminal.crypto_engine import ExtendedKey
from tests.answers import ACTA_SOLUTION, SEAL_PASSPHRASE, SOLUTIONS

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
STORY = json.loads((ROOT / "data" / "story.json").read_text(encoding="utf-8"))
CAMPAIGN = json.loads((ROOT / "data" / "cases.json").read_text(encoding="utf-8"))
CLIENTS = json.loads((ROOT / "data" / "clients.json").read_text(encoding="utf-8"))["clients"]
ALL_LANGS = ("en", "ru", "es", "pt")
#: Story prose is written in these first; the others fall back to English.
STORY_LANGS = ("en", "ru")


def member_word(member: int) -> str:
    return ce.word_at(member)


def position(member: int) -> tuple[int, int]:
    return (member - 1) // 16 + 1, (member - 1) % 16 + 1


@pytest.fixture(scope="module")
def played():
    if shutil.which("node") is None:
        pytest.skip("node plays the browser modules")
    done = subprocess.run(
        [
            "node",
            "tools/js_story.mjs",
            json.dumps({"solution": ACTA_SOLUTION, "phrases": SOLUTIONS}),
        ],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


# --- the deduction holds together --------------------------------------------

def test_every_acta_member_is_a_word_of_that_wallets_phrase():
    for wallet, row in ACTA_SOLUTION.items():
        assert member_word(row["member"]) in SOLUTIONS[wallet].split()


def test_every_paper_points_at_its_member_by_page_and_line():
    """The paper names a place in the book, never a wallet: that link is the work."""
    forms = {paper["form"]: paper for paper in STORY["papers"] if paper.get("form")}
    for row in ACTA_SOLUTION.values():
        page, line = position(row["member"])
        paper = forms[row["form"]]
        for lang in STORY_LANGS:
            assert f"{page}:{line}" in " ".join(paper["body"][lang])
        assert "wallet" not in paper, "a paper must not say which wallet it belongs to"


def test_a_paper_is_not_unlocked_by_the_wallet_it_is_about():
    """Papers come in the order wallets close, so none can be matched by timing."""
    for paper in STORY["papers"]:
        assert set(paper) >= {"id", "after", "title", "body"}
        assert isinstance(paper["after"], int)
        assert "case" not in paper


def test_the_digest_is_of_the_answer():
    assert STORY["acta"]["wallets"] == sorted(ACTA_SOLUTION)
    rows = "|".join(
        f"{wallet}:{row['employer']}:{row['form']}:{row['member']}:{row['year']}"
        for wallet, row in sorted(ACTA_SOLUTION.items())
    )
    digest = hashlib.sha256(f"{STORY['acta']['salt']}|{rows}".encode()).hexdigest()
    assert STORY["acta"]["answer"] == digest
    forms = {form["id"] for form in STORY["acta"]["forms"]}
    slugs = {client["slug"] for client in CLIENTS}
    for row in ACTA_SOLUTION.values():
        assert row["form"] in forms
        assert row["employer"] in slugs


def test_a_decoy_form_and_a_decoy_employer_are_on_offer(played):
    forms = {form["id"] for form in STORY["acta"]["forms"]}
    assert forms - {row["form"] for row in ACTA_SOLUTION.values()}, "only right answers on offer"
    memo = next(paper for paper in STORY["papers"] if paper["id"] == "memo")
    assert "MARTILLERO" in " ".join(memo["body"]["en"]), "the false lead has to be stated"


def test_every_year_is_a_fact_on_the_chain():
    """A paper dates itself by someone else's movement, so the year is only out there."""
    anchors = STORY["anchors"]
    forms = {paper["form"]: paper for paper in STORY["papers"] if paper.get("form")}
    derived = {
        address.address: (wallet, address.purpose)
        for wallet in (1, 2, 3)
        for address in ce.derive_wallet(SOLUTIONS[wallet]).addresses
    }
    for row in ACTA_SOLUTION.values():
        anchor = anchors[forms[row["form"]]["anchor"]]
        assert anchor["address"] in derived, f"{anchor['address']} is not a case wallet"
        assert anchor["first_date"].startswith(str(row["year"]))
        # Only the first movement is used: later ones can still arrive, an
        # earlier one cannot.
        assert anchor["movement"] == "first"
        assert isinstance(anchor["first_height"], int)


def test_no_year_is_stated_in_any_paper_or_book_note_about_the_filing():
    for row in ACTA_SOLUTION.values():
        for paper in STORY["papers"]:
            if paper.get("form") == row["form"]:
                for lang in STORY_LANGS:
                    assert str(row["year"]) not in " ".join(paper["body"][lang])


def test_every_conclusion_has_at_least_three_clues():
    """The Three Clue Rule as a build failure rather than an intention."""
    papers = {paper["id"] for paper in STORY["papers"]}
    book = {int(key) for key in STORY["book"]}
    hints = {hint["id"] for hint in STORY["acta"]["hints"]}
    anchors = set(STORY["anchors"])
    slugs = {client["slug"] for client in CLIENTS}
    expected = {
        f"{field}:{wallet}"
        for wallet in ACTA_SOLUTION
        for field in ("employer", "form", "member", "year")
    }
    conclusions = {entry["id"]: entry["clues"] for entry in STORY["acta"]["conclusions"]}
    assert set(conclusions) == expected
    for name, clues in conclusions.items():
        assert len(clues) >= 3, f"{name} has only {len(clues)} clues"
        for clue in clues:
            kind, _, target = clue.partition(":")
            known = {
                "paper": lambda t: t in papers,
                "book": lambda t: int(t) in book,
                "hint": lambda t: t in hints,
                "anchor": lambda t: t in anchors,
                "creed": lambda t: t in slugs,
                "phrase": lambda t: int(t) in SOLUTIONS,
            }[kind]
            assert known(target), f"{name} cites {clue}, which does not exist"


def test_the_book_has_a_row_for_every_word_of_the_first_three_phrases():
    rows = {int(key) for key in STORY["book"]}
    for wallet in (1, 2, 3):
        for word in SOLUTIONS[wallet].split():
            assert ce.index_of(word) in rows, f"{word} has no row in the book"


def test_interface_text_is_in_every_language():
    for key, bundle in STORY["ui"].items():
        for lang in ALL_LANGS:
            assert bundle.get(lang), f"ui.{key} has no {lang}"


def test_story_text_is_written_in_its_languages():
    for paper in STORY["papers"]:
        for lang in STORY_LANGS:
            assert paper["title"][lang] and paper["body"][lang], paper["id"]
    for key, row in STORY["book"].items():
        for lang in STORY_LANGS:
            assert row["trade"][lang] and row["note"][lang], key
    for hint in STORY["acta"]["hints"]:
        for lang in STORY_LANGS:
            assert hint["text"][lang] == hint["text"][lang].lower(), hint["id"]


def test_the_seal_is_the_fingerprint_of_the_hidden_wallet():
    seed = ce.to_seed(SOLUTIONS[8], SEAL_PASSPHRASE)
    assert CAMPAIGN["meta"]["seal"] == ExtendedKey.from_seed(seed).fingerprint.hex()


def test_case_three_does_not_count_cases_it_cannot_count():
    """It is open from the start, so it may be the first one closed."""
    epilogue = next(case for case in CAMPAIGN["cases"] if case["id"] == 3)["epilogue"]
    assert "Three of eight" not in " ".join(epilogue["en"])
    assert "Три из восьми" not in " ".join(epilogue["ru"])
    assert "Tres de ocho" not in " ".join(epilogue["es"])
    assert "Três de oito" not in " ".join(epilogue["pt"])


def test_the_informant_writes_in_the_hand_of_the_first_wallets():
    """Lower case and no minus sign: her hints are evidence against her later."""
    for case in CAMPAIGN["cases"][:3]:
        for lang in STORY_LANGS:
            for hint in case["hints"][lang]:
                words = [word for word in hint.split() if not word.isupper()]
                assert " ".join(words) == " ".join(words).lower(), hint


# --- one way to close a case -------------------------------------------------

def test_only_the_store_and_the_story_mark_a_case_solved():
    """Two copies of the closing logic are how the Decrypt panel stopped closing cases."""
    for path in sorted((DOCS / "js").rglob("*.js")):
        if path.name in {"core.js", "story.js"} or "vendor" in path.parts:
            continue
        assert "markSolved(" not in path.read_text(encoding="utf-8"), path.name


def test_the_decrypt_panel_closes_cases_too():
    source = (DOCS / "js" / "gui" / "app.js").read_text(encoding="utf-8")
    body = source[source.index("  buildDecrypt()"):source.index("  buildLedger()")]
    assert "this.closeAndReport(" in body


# --- the book, played --------------------------------------------------------

def test_the_book_answers_a_number_a_place_and_a_word(played):
    book = played["book"]
    assert book["byNumber"]["number"] == 515
    assert book["byNumber"]["page"] == 33 and book["byNumber"]["line"] == 3
    assert book["byNumber"]["word"] == "doctor"
    assert book["byPosition"] == book["byNumber"] == book["byWord"]
    assert book["byNumber"]["row"]["name"]


def test_a_flooded_line_says_so_and_nonsense_is_nothing(played):
    book = played["book"]
    assert book["flooded"]["number"] == 2047 and book["flooded"]["row"] is None
    assert book["nonsense"] is None
    assert book["outOfRange"] is None


# --- closing, played ---------------------------------------------------------

def test_closing_files_once_and_numbers_in_order(played):
    closure = played["closure"]
    assert closure["third"]["first"] is True
    assert closure["third"]["filing"] == {"number": 1, "height": 900001}
    assert closure["again"]["first"] is False
    assert closure["again"]["filing"] == closure["third"]["filing"], "refiled on a second close"
    assert closure["again"]["newPapers"] == []
    assert closure["first"]["filing"] == {"number": 2, "height": None}
    assert closure["solved"] == [3, 1]


def test_papers_arrive_in_closing_order_not_wallet_order(played):
    closure = played["closure"]
    ordered = sorted(STORY["papers"], key=lambda paper: paper["after"])
    assert closure["third"]["newPapers"] == [p["id"] for p in ordered if p["after"] == 1]
    assert closure["papers"] == [p["id"] for p in ordered if p["after"] <= 2]


def test_closing_only_counts_the_first_three_wallets_towards_papers(played):
    assert all(paper["after"] <= 3 for paper in STORY["papers"])


# --- the Acta, played --------------------------------------------------------

def test_a_row_is_refused_until_its_wallet_is_closed_and_its_values_exist(played):
    acta = played["acta"]
    assert acta["unknownField"] == {"status": "invalid", "field": "employer"}
    assert acta["notClosedYet"] == {"status": "closed-first"}
    assert acta["afterClosing"] == {"status": "saved"}


def test_filing_says_only_yes_or_no(played):
    """A count of wrong rows would be an oracle stronger than the batch is worth."""
    acta = played["acta"]
    assert acta["before"]["status"] == "incomplete"
    assert acta["first"] == {"status": "rejected", "left": 1}
    assert acta["second"] == {"status": "rejected", "left": 0}


def test_a_third_try_waits_for_a_block_or_costs_a_favour(played):
    acta = played["acta"]
    assert acta["third"] == {"status": "wait"}
    assert acta["paid"]["status"] == "rejected"
    assert acta["debtAfterPaying"] == 1
    assert acta["nextBlock"]["status"] == "rejected", "a new block did not reopen the desk"


def test_the_right_acta_is_accepted_and_stays_filed(played):
    acta = played["acta"]
    assert acta["accepted"] == {"status": "accepted"}
    assert acta["again"] == {"status": "already"}
    assert acta["filed"] is True and acta["reloaded"] is True


def test_without_a_chain_the_wait_is_ten_minutes(played):
    assert played["offline"] == {
        "first": "rejected", "second": "rejected", "third": "wait", "later": "rejected",
    }


def test_debt_counts_only_this_acts_favours(played):
    debt = played["debt"]
    assert debt["shown"] is True
    assert debt["total"] == 3, "case 8's hint is not this informant's favour"
    assert debt["capped"] == 2 + len(STORY["acta"]["hints"])


def test_a_save_of_the_wrong_shape_is_a_fresh_story(played):
    for body, seen in played["badSaves"].items():
        assert seen["closed"] is True, body
        assert seen["draft"] == {}, body


def test_a_save_from_before_the_story_keeps_its_cases_and_gets_its_papers(played):
    assert played["oldSave"]["solved"] == [1, 2]
    expected = [p["id"] for p in STORY["papers"] if p["after"] <= 2]
    assert sorted(played["oldSave"]["papers"]) == sorted(expected)


def test_reset_erases_the_story(played):
    assert played["afterReset"] == {"papers": 0, "draft": {}}


def test_a_terminal_with_an_older_copy_does_not_undo_the_panel(played):
    """Each front-end holds its own store, and either can save last."""
    seen = played["twoStores"]
    assert seen["solved"] == [1, 2]
    assert seen["terminalSees"] == [1, 2]
    assert seen["draft"] == {"1": ACTA_SOLUTION[1]}


# --- the terminal, played ----------------------------------------------------

@pytest.mark.parametrize("lang", ALL_LANGS)
def test_the_commands_answer_in_every_language(played, lang):
    seen = played["terminal"][lang]
    assert "UNKNOWN COMMAND" not in " ".join(seen.values())
    assert "[FATAL] " not in seen["firstPaper"] + seen["book"] + seen["accepted"]
    assert "undefined" not in " ".join(seen.values())
    assert "[object" not in " ".join(seen.values())
    assert "1:1" in seen["bookWord"]
    assert "33:3" in seen["book"]
    for command in ("BOOK", "PAPERS", "ACTA"):
        assert command in seen["help"]


def test_every_close_is_filed_by_the_same_hand(played):
    assert "— T." in played["terminal"]["en"]["decrypt"]
    assert "— Т." in played["terminal"]["ru"]["decrypt"]


def test_the_first_close_says_where_the_new_paper_is(played):
    assert "PAPERS" in played["terminal"]["en"]["decrypt"]


def test_a_full_transaction_list_with_dates_is_one_word_away(played):
    assert played["terminal"]["txlogLimit"] == 25
    assert "2021-02-26" in played["terminal"]["en"]["txlog"]


def test_the_terminal_reports_the_two_outcomes(played):
    english = played["terminal"]["en"]
    assert "REJECTED" in english["rejected"]
    assert "ACCEPTED" in english["accepted"]
    assert "NOBODY" in english["badRow"]


def test_the_boot_prints_the_seal_and_says_what_to_type(played):
    assert f"seal {CAMPAIGN['meta']['seal']}" in played["boot"]
    assert "CASES" in played["boot"]
    assert "OPEN 1" in played["boot"]


# --- the anchors the build is allowed to depend on ----------------------------

def test_the_generated_story_module_is_current():
    generated = (DOCS / "js" / "story-data.js").read_text(encoding="utf-8")
    assert json.dumps(STORY["acta"]["answer"]) in generated
