"""The first act of the case file: the book, the papers and the Acta.

The riddles open a wallet; these check the investigation that comes after. The
story data keeps a digest of the answer rather than the answer, so the suite
holds the key in `tests/answers.py`, the same way it does for the eight seeds,
and plays the real browser modules under Node through `tools/js_story.mjs`.
"""

from __future__ import annotations

import hashlib
import json
import re
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
ACTS = STORY["acts"]
ACT_ONE, ACT_TWO = ACTS
FIRST_PAPERS = [paper for paper in STORY["papers"] if paper["act"] == 1]
ALL_FORMS = {form["id"] for act in ACTS for form in act["forms"]}
CLIENTS = json.loads((ROOT / "data" / "clients.json").read_text(encoding="utf-8"))["clients"]
ALL_LANGS = ("en", "ru", "es", "pt")
STORY_LANGS = ALL_LANGS


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


def test_row_one_of_the_second_act_is_the_last_member():
    assert ACTA_SOLUTION[4]["member"] == 2048
    assert member_word(2048) == "zoo"
    assert SOLUTIONS[4].split().count("zoo") == SOLUTIONS[1].split().count("abandon") == 11


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
        assert set(paper) >= {"id", "after", "title", "body", "act"}
        assert paper["after"] is None or isinstance(paper["after"], int)
        assert "case" not in paper


@pytest.mark.parametrize("act", ACTS, ids=lambda act: f"act{act['id']}")
def test_the_digest_is_of_the_answer(act):
    rows = "|".join(
        "{}:{employer}:{form}:{member}:{year}".format(wallet, **ACTA_SOLUTION[wallet])
        for wallet in act["wallets"]
    )
    digest = hashlib.sha256(f"{act['salt']}|{rows}".encode()).hexdigest()
    assert act["answer"] == digest
    forms = {form["id"] for form in act["forms"]}
    slugs = {client["slug"] for client in CLIENTS}
    for wallet in act["wallets"]:
        assert ACTA_SOLUTION[wallet]["form"] in forms
        assert ACTA_SOLUTION[wallet]["employer"] in slugs


def test_a_decoy_form_and_a_decoy_employer_are_on_offer(played):
    for act in ACTS:
        forms = {form["id"] for form in act["forms"]}
        right = {ACTA_SOLUTION[wallet]["form"] for wallet in act["wallets"]}
        assert forms - right, "only right answers on offer"
    memo = next(paper for paper in STORY["papers"] if paper["id"] == "memo")
    assert "MARTILLERO" in " ".join(memo["body"]["en"]), "the false lead has to be stated"


def test_every_year_is_a_fact_on_the_chain():
    """A paper dates itself by someone else's movement, so the year is only out there."""
    anchors = STORY["anchors"]
    forms = {paper["form"]: paper for paper in STORY["papers"] if paper.get("form")}
    derived = {
        address.address: (wallet, address.purpose)
        for wallet in sorted(ACTA_SOLUTION)
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
    hints = {hint["id"] for act in ACTS for hint in act["hints"]}
    anchors = set(STORY["anchors"])
    slugs = {client["slug"] for client in CLIENTS}
    expected = {
        f"{field}:{wallet}"
        for wallet in ACTA_SOLUTION
        for field in ("employer", "form", "member", "year")
    }
    conclusions = {
        entry["id"]: entry["clues"] for act in ACTS for entry in act["conclusions"]
    }
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
                "witness": lambda t: t in STORY["witnesses"],
                "errand": lambda t: t in {errand["id"] for errand in STORY["errands"]},
            }[kind]
            assert known(target), f"{name} cites {clue}, which does not exist"


def test_the_book_has_a_row_for_every_word_of_the_first_three_phrases():
    rows = {int(key) for key in STORY["book"]}
    for wallet in sorted(ACTA_SOLUTION):
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
    for act in ACTS:
        for hint in act["hints"]:
            for lang in STORY_LANGS:
                text = " ".join(hint["text"][lang])
                assert text == text.lower(), hint["id"]
                assert "-" not in text and "−" not in text, hint["id"]


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
    ordered = sorted(FIRST_PAPERS, key=lambda paper: paper["after"])
    assert closure["third"]["newPapers"] == [p["id"] for p in ordered if p["after"] == 1]
    assert closure["papers"] == [p["id"] for p in ordered if p["after"] <= 2]


def test_closing_only_counts_the_first_three_wallets_towards_papers(played):
    assert all(paper["after"] <= 3 for paper in FIRST_PAPERS)


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
    assert acta["first"]["status"] == "rejected" and acta["first"]["left"] == 1
    assert acta["second"]["status"] == "rejected" and acta["second"]["left"] == 0
    assert "rows" not in acta["first"] and "wrong" not in acta["first"]


def test_a_third_try_waits_for_a_block_or_costs_a_favour(played):
    acta = played["acta"]
    assert acta["third"] == {"status": "wait"}
    assert acta["paid"]["status"] == "rejected"
    assert acta["debtAfterPaying"] == 1
    assert acta["nextBlock"]["status"] == "rejected", "a new block did not reopen the desk"


def test_the_right_acta_is_accepted_and_stays_filed(played):
    acta = played["acta"]
    assert acta["accepted"]["status"] == "accepted"
    # The sheet has moved on to the next act, which has nothing written on it.
    assert acta["again"] == {"status": "incomplete"}
    assert acta["filed"] is True and acta["reloaded"] is True


def test_without_a_chain_the_wait_is_ten_minutes(played):
    assert played["offline"] == {
        "first": "rejected", "second": "rejected", "third": "wait", "later": "rejected",
    }


def test_debt_counts_only_this_acts_favours(played):
    debt = played["debt"]
    assert debt["shown"] is True
    assert debt["total"] == 3, "case 8's hint is not this informant's favour"
    assert debt["capped"] == 2 + len(ACT_ONE["hints"])


def test_a_save_of_the_wrong_shape_is_a_fresh_story(played):
    for body, seen in played["badSaves"].items():
        assert seen["closed"] is True, body
        assert seen["draft"] == {}, body


def test_a_save_from_before_the_story_keeps_its_cases_and_gets_its_papers(played):
    assert played["oldSave"]["solved"] == [1, 2]
    expected = [p["id"] for p in FIRST_PAPERS if p["after"] <= 2]
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
    for command in ("BOOK", "PAPERS", "ACTA", "ASK", "CITE", "SEND", "NOTE"):
        assert command in seen["help"]


def test_every_close_gets_an_incoming_number_ending_in_the_clerks_mark(played):
    """A signature drew every simulated tester's eye; a registry code should not."""
    assert re.search(r"in\. \d{4}/T\b", played["terminal"]["en"]["decrypt"])
    assert re.search(r"вх\. \d{4}/Т\b", played["terminal"]["ru"]["decrypt"])
    for paper in STORY["papers"]:
        for lang in STORY_LANGS:
            text = " ".join(paper["body"][lang])
            assert "— T." not in text and "— Т." not in text, paper["id"]


def test_the_acta_states_its_rules(played):
    english = played["terminal"]["en"]["emptyActa"]
    assert "WHOSE PHRASE" in english, "the row rule is unstated, and all five testers stumbled on it"
    assert "TWICE A BLOCK" in english and "10 MINUTES" in english
    assert "FAVOUR" in english


def test_writing_a_row_does_not_sound_like_a_verdict(played):
    assert "NOT CHECKED" in played["terminal"]["en"]["wrong"]


def test_closing_the_last_wallet_points_at_the_acta(played):
    assert "ACTA" in played["terminal"]["en"]["thirdClose"]
    assert "ACTA" not in played["terminal"]["en"]["decrypt"]


def test_a_short_transaction_list_says_it_is_complete(played):
    assert "WHOLE HISTORY" in played["terminal"]["en"]["txlog"]
    assert "WHOLE HISTORY" not in played["terminal"]["en"]["txlogFull"]
    assert "MAY BE OLDER" in played["terminal"]["en"]["txlogFull"]


def test_no_acta_hint_quotes_a_paper_the_player_may_not_have():
    for act in ACTS:
        for hint in act["hints"]:
            for lang in STORY_LANGS:
                assert not re.search(r"\d+:\d+", " ".join(hint["text"][lang])), hint["id"]


def test_a_first_boot_opens_on_the_case(played):
    assert "ORACLE" in played["boot"]


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
    for act in ACTS:
        assert json.dumps(act["answer"]) in generated


# --- the second act, played --------------------------------------------------

def test_the_second_act_waits_for_the_first(played):
    two = played["actTwo"]
    assert two["askBefore"]["status"] == "closed"
    assert two["sendBefore"]["status"] == "closed"
    assert two["rowBefore"] == {"status": "invalid", "field": "wallet"}
    assert two["papersBefore"] == []


def test_filing_the_first_act_opens_the_second(played):
    two = played["actTwo"]
    assert two["acceptedOne"]["status"] == "accepted"
    assert set(two["acceptedOne"]["newPapers"]) == {"lalo-card", "catalogue", "appraisal"}
    assert two["currentAfterOne"] == 2


def test_witnesses_answer_a_word_and_fall_back_in_character(played):
    two = played["actTwo"]
    assert two["askTopic"]["status"] == "answer" and two["askTopic"]["lines"]
    assert two["askUnknownWord"]["status"] == "fallback" and two["askUnknownWord"]["lines"]
    assert two["askNobody"]["status"] == "unknown"
    assert two["askIntro"]["status"] == "intro"


def test_a_witness_can_hand_over_the_statute_and_the_tontine_lands_once(played):
    two = played["actTwo"]
    assert "statute" in two["viaLevene"]["newPapers"]
    assert two["viaLevene"]["reveal"]
    assert two["viaLeveneAgain"]["newPapers"] == [] and not two["viaLeveneAgain"]["reveal"]


def test_citing_needs_the_paper_and_the_right_paper_changes_the_story(played):
    two = played["actTwo"]
    assert two["citeMissing"]["status"] == "no-paper"
    assert two["citeNothing"]["status"] == "nothing"
    assert two["citeHit"]["status"] == "answer" and two["citeHit"]["lines"]
    assert two["citeHit"]["word"] == "ordered"


def test_lalo_does_one_errand_at_a_time_and_is_back_after_its_blocks(played):
    errand = played["errand"]
    assert errand["first"]["status"] == "sent" and errand["first"]["lines"]
    assert errand["second"]["status"] == "busy"
    assert errand["tooSoon"] is None
    assert errand["back"]["id"] == "pump-log"
    assert errand["back"]["newPapers"] == ["pump-log"]
    assert errand["again"]["status"] == "done"
    assert errand["unknown"]["status"] == "unknown"


def test_a_favour_brings_lalo_back_at_once(played):
    errand = played["errand"]
    assert errand["paid"]["newPapers"] == ["incoming-register"]
    assert errand["debtForPaying"] == 1
    assert errand["payIdle"]["status"] == "idle"


def test_the_flood_closes_one_district_and_nothing_required_is_lost(played):
    errand = played["errand"]
    assert errand["olmosEarly"]["status"] == "sent"
    assert errand["olmosLate"]["status"] == "flooded"
    closable = [item for item in STORY["errands"] if item["closes_after"] is not None]
    assert [item["id"] for item in closable] == ["olmos"]
    required = {clue.split(":")[1] for act in ACTS for entry in act["conclusions"]
                for clue in entry["clues"] if clue.startswith("errand:")}
    assert "olmos" not in required


def test_lalo_comes_back_on_the_clock_when_the_chain_is_silent(played):
    errand = played["errand"]
    assert errand["offlineSoon"] is None
    assert errand["offlineBack"]["id"] == "pump-log"


def test_the_statute_can_also_come_by_errand(played):
    errand = played["errand"]
    assert errand["statute"]["newPapers"] == ["statute"]
    assert errand["statute"]["reveal"]


def test_levene_dies_when_two_wallets_are_closed_whoever_was_named(played):
    death = played["death"]
    assert death["afterOne"] is None
    assert death["named"]["variant"] == "a"
    assert death["clean"]["variant"] == "b"
    assert any("MARTILLERO" in line for line in death["named"]["lines"])
    assert death["onlyOnce"] is None
    assert death["named"]["newPapers"]


def test_levene_is_not_found_while_he_is_still_on_the_telephone(played):
    death = played["death"]
    assert death["whileTalking"] is None


def test_a_player_who_never_called_him_gets_until_the_last_wallet(played):
    death = played["death"]
    assert death["silentTwo"] is None, "he died before the player could meet him"
    assert death["silentAll"]["variant"] == "b"


def test_lalo_coming_home_can_bring_the_news(played):
    assert played["death"]["onReturn"]["variant"] == "b"


def test_a_member_can_be_named_by_number_place_or_word(played):
    assert played["byWord"] == played["byPlace"] == played["byNumber"] == 1
    assert played["badMember"] == {"status": "invalid", "field": "member"}


def test_the_second_acta_needs_the_statute(played):
    """One tester filed the whole act without ever meeting the word tontine."""
    assert played["needsStatute"] == "needs-statute"
    assert "SEND STATUTE" in STORY["ui"]["actaNeedsStatuteDead"]["en"]
    assert "ASK" not in STORY["ui"]["actaNeedsStatuteDead"]["en"]
    assert played["acceptedWithStatute"] == "accepted"


def test_the_game_notices_a_player_who_knew_the_phrases(played):
    assert played["knewIt"] is True
    assert played["knewBlank"] is False


def test_a_witness_handing_over_lalos_errand_frees_him(played):
    overlap = played["errandOverlap"]
    assert overlap == {"out": None, "again": "done", "free": "sent"}


def test_a_witness_hears_a_word_however_it_is_inflected(played):
    assert played["inflected"] == {"genitive": "answer", "noise": "fallback"}


def test_every_word_a_witness_hands_out_gets_an_answer():
    papers = {paper["id"] for paper in STORY["papers"]}
    for cited in STORY["cites"]:
        if cited["gives"] in papers:
            continue
        keys = {
            key.lower()
            for topic in STORY["witnesses"][cited["witness"]]["topics"]
            for key in topic["keys"]
        }
        assert cited["gives"] in keys, f"{cited['witness']} gives {cited['gives']}, then ignores it"


def test_interface_text_does_not_give_away_the_informants_gender():
    for lang, word in (("en", "SHE "), ("ru", "ОНА "), ("es", "ELLA "), ("pt", "ELA ")):
        assert word not in STORY["ui"]["actaDebt"][lang]


def test_employers_replies_are_labelled_as_no_verdict(played):
    assert "NOT A VERDICT" in played["terminal"]["en"]["rejected"]


def test_papers_new_reads_what_you_have_not_seen(played):
    english = played["terminal2"]["en"]
    assert "*" in english["papersList"]
    assert "Lalo" in english["papersNew"] or "L. FUNES" in english["papersNew"]
    assert "NOTHING NEW" in english["papersNone"]


def test_levene_rings_when_the_second_act_gets_going(played):
    assert "ASK LEVENE" in played["terminal2"]["en"]["close4"]
    assert "ASK LEVENE" not in played["terminal2"]["en"]["close5"]


def test_a_dead_man_does_not_answer(played):
    death = played["death"]
    assert death["askAfter"]["status"] == "dead" and death["askAfter"]["lines"]
    assert death["citeAfter"]["status"] == "dead"


def test_closing_second_act_wallets_before_filing_the_first_still_counts(played):
    death = played["death"]
    assert death["lateFiling"]["event"] is None
    assert "statute" not in death["lateFiling"]["newPapers"]
    assert death["lateThird"]["variant"] == "b"


def test_rejected_filings_stay_on_file_and_employers_react_once_without_a_tell(played):
    noise = played["noise"]
    assert noise["first"]["reactions"], "nobody reacted to being named"
    assert noise["reactionsAreOnlyForNamed"] is True
    # A correct employer and a wrong one must draw the same kind of letter.
    assert noise["reactedToCorrect"] is True and noise["reactedToWrong"] is True
    assert noise["second"]["reactions"] == []
    assert noise["kept"] == 3
    assert noise["third"]["noiseHigh"]
    assert noise["fourthHigh"] is False


def test_high_noise_blacks_out_a_word_and_a_clean_copy_restores_it(played):
    noise = played["noise"]
    assert "██████" in noise["redacted"]
    assert "██████" not in noise["clean"]
    assert noise["cluesSurvive"] is True


def test_notes_are_kept_and_reset_clears_them(played):
    assert played["notes"]["saved"] == ["ask about the shoes", "who is T"]
    assert played["notes"]["afterReset"] == []
    assert played["notes"]["blank"] is None


def test_the_second_act_is_accepted_and_ends_honestly(played):
    two = played["actTwo"]
    assert two["acceptedTwo"]["status"] == "accepted"
    assert two["currentAfterTwo"] is None
    assert two["filedAll"] == [1, 2]


def test_an_old_save_with_a_filed_flag_keeps_its_acta(played):
    assert played["oldFiled"]["filed"] is True
    assert played["oldFiled"]["hints"] == 2


@pytest.mark.parametrize("lang", ALL_LANGS)
def test_the_second_act_commands_answer_in_every_language(played, lang):
    seen = played["terminal2"][lang]
    blob = " ".join(seen.values())
    assert "UNKNOWN COMMAND" not in blob
    assert "undefined" not in blob and "[object" not in blob and "{" not in blob


def test_the_terminal_plays_the_second_act(played):
    english = played["terminal2"]["en"]
    assert "Lalo" in english["accepted"], "the cold open did not play"
    assert "NEW IN YOUR FOLDER" in english["accepted"]
    assert "SEND" in english["errandList"]
    assert "Quintana" in english["ask"] or english["ask"].strip()
    assert "NOTED" in english["note"]
    assert "NOT WRITTEN YET" in english["end"]
    assert "END OF THE FIRST ACT" not in english["accepted"]
    for paper in STORY["papers"]:
        assert "Filed. — T." not in " ".join(paper["body"]["en"])


# --- the weak spots the simulations found -------------------------------------

@pytest.mark.parametrize("case_id", [5, 6])
@pytest.mark.parametrize("lang", ALL_LANGS)
def test_each_definition_shows_the_words_first_letter_and_length(case_id, lang):
    """Testers could not reach `grab` or `report` from a definition alone."""
    case = next(entry for entry in CAMPAIGN["cases"] if entry["id"] == case_id)
    lines = [line for line in case["clues"][lang] if re.match(r"\s*\d+\.", line)]
    words = SOLUTIONS[case_id].split()
    assert len(lines) == len(words)
    for line, word in zip(lines, words):
        mask = line.split()[1]
        assert mask == word[0] + "_" * (len(word) - 1), line
        assert word not in line, f"the clue gives the word away: {line}"


def test_a_wrong_paper_tells_you_what_the_witness_would_answer_to(played):
    nudge = played["nudge"]
    assert nudge["status"] == "nothing" and nudge["lines"]
    assert nudge["asked"] == "nudge" and nudge["askedLines"] == nudge["lines"]
    assert nudge["lalo"], "Lalo has to say something too"


def test_every_witness_has_a_nudge_in_every_story_language():
    for name, witness in STORY["witnesses"].items():
        for lang in STORY_LANGS:
            assert witness["cite_nudge"][lang], name


def test_every_cite_a_nudge_points_at_exists():
    """The nudge has to be reachable: each witness with a nudge has real targets."""
    papers = {paper["id"] for paper in STORY["papers"]}
    for cited in STORY["cites"]:
        assert cited["paper"] in papers


def test_rushing_the_courier_raises_the_water_on_the_optional_district(played):
    flood = played["flood"]
    assert flood["before"] == 5
    assert flood["afterTwoRushes"] == 1
    assert flood["stillOpen"] == "open"
    assert flood["rush"] is True
    assert flood["afterThree"] == "flooded"
    assert flood["send"] == "flooded"


def test_the_third_favour_comes_due_once_and_takes_a_word(played):
    call = played["call"]
    assert call["early"] is None
    assert "██████" not in call["cleanBefore"]
    assert call["first"]
    assert call["second"] is None
    assert "██████" in call["borrowed"]
    assert "██████" not in call["returned"]
    assert call["noRepeat"] is None


def test_the_acceptance_of_an_act_returns_what_was_borrowed(played):
    assert "██████" in played["callClearsOnFiling"]["during"]
    assert "██████" not in played["callClearsOnFiling"]["after"]


def test_the_collectors_note_is_in_the_informants_hand():
    for lang in STORY_LANGS:
        text = " ".join(STORY["debt_call"][lang])
        assert text == text.lower()
        assert "-" not in text and "−" not in text


def test_no_note_gives_away_the_informants_gender_in_russian():
    notes = [" ".join(paper["body"]["ru"]) for paper in STORY["papers"]
             if paper["id"].startswith("note-")]
    notes.append(" ".join(STORY["debt_call"]["ru"]))
    for text in notes:
        assert not re.search(r"\bя \w+(ла|л)\b", text), text


def test_handed_out_words_are_shown_in_the_players_language(played):
    for word, labels in STORY["word_labels"].items():
        for lang in STORY_LANGS:
            assert labels[lang]
    labels = STORY["word_labels"]
    givers = {cited["gives"] for cited in STORY["cites"]}
    papers = {paper["id"] for paper in STORY["papers"]}
    assert givers - papers == set(labels)
    for cited in STORY["cites"]:
        if cited["gives"] not in labels:
            continue
        keys = {
            key.lower()
            for topic in STORY["witnesses"][cited["witness"]]["topics"]
            for key in topic["keys"]
        }
        for lang in STORY_LANGS:
            assert labels[cited["gives"]][lang].lower() in keys, (cited["gives"], lang)


def test_a_cite_with_no_paper_answers_in_the_terminal(played):
    assert "Show me what I wrote myself" in played["terminal2"]["en"]["citeAsk"]


def test_the_story_never_calls_anyone_disappeared():
    text = json.dumps(STORY, ensure_ascii=False).lower()
    assert "desaparec" not in text


def test_levene_says_the_word_only_once():
    """The running gag only pays off if he has not said it already."""
    for lang, words in (("en", ["money"]), ("ru", ["деньг"]), ("es", ["dinero", "plata"]),
                        ("pt", ["dinheiro"])):
        lines = []
        for topic in STORY["witnesses"]["levene"]["topics"]:
            lines += topic["text"][lang]
        for word in words:
            assert not any(word in line.lower() for line in lines), (lang, word)
