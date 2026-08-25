"""The 256-case contract board.

The point of these tests is one claim: every generated case is solvable. A
solver walks each case's clue steps, reconstructs twelve words, and checks them
against the fingerprint the game stores. If a dialect ever emits a clue that
does not lead anywhere, the board fails to build rather than shipping a case
that wastes a player's evening.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from neon_terminal import crypto_engine as ce

ROOT = Path(__file__).resolve().parent.parent
GRID_COLUMNS = 16


@pytest.fixture(scope="module")
def board():
    return json.loads((ROOT / "data" / "contracts.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def cases(board):
    return board["cases"]


@pytest.fixture(scope="module")
def clients():
    return json.loads((ROOT / "data" / "clients.json").read_text(encoding="utf-8"))["clients"]


# --------------------------------------------------------------------------- #
# The solver — follows clue steps and nothing else
# --------------------------------------------------------------------------- #

def solve_step(step: dict) -> str:
    kind = step["kind"]
    if kind == "index":
        return ce.word_at(step["index"])
    if kind == "mirror":
        return ce.word_at(2049 - step["mirror"])
    if kind == "grid":
        return ce.word_at((step["row"] - 1) * GRID_COLUMNS + step["column"])
    if kind == "sats":
        return ce.word_at(step["sats"])
    if kind == "prefix":
        matches = [word for _, word in ce.search(step["prefix"], limit=2049)]
        assert len(matches) == 1, f"prefix '{step['prefix']}' matches {len(matches)} words"
        return matches[0]
    if kind == "prefix_shortest":
        matches = [word for _, word in ce.search(step["prefix"], limit=2049)]
        shortest = min(matches, key=len)
        assert sum(1 for m in matches if len(m) == len(shortest)) == 1, \
            f"'{step['prefix']}' has no single shortest branch"
        return shortest
    if kind == "neighbour":
        anchor = ce.index_of(step["anchor"])
        return ce.word_at(anchor + 1 if step["direction"] == "after" else anchor - 1)
    raise AssertionError(f"solver cannot handle step kind {kind!r}")


def solve(case: dict) -> str:
    """Reconstruct the phrase from the clue specification alone."""
    steps = case["solution"]["steps"]

    if case["solution"]["archetype"] == "entropy_pattern":
        return ce.entropy_to_mnemonic(bytes.fromhex(steps[0]["hex"]))

    if case["solution"]["archetype"] == "redacted":
        step = steps[0]
        position, candidates = ce.complete_mnemonic(step["pattern"])
        words = step["pattern"].split()
        for candidate in candidates:
            attempt = list(words)
            attempt[position] = candidate
            if ce.fingerprint(" ".join(attempt)) == case["fingerprint"]:
                return " ".join(attempt)
        raise AssertionError("no completion of the redacted sheet matches the case")

    return " ".join(solve_step(step) for step in steps)


# --------------------------------------------------------------------------- #
# Shape
# --------------------------------------------------------------------------- #

def test_the_board_holds_two_hundred_and_fifty_six_cases(cases):
    assert len(cases) == 256


def test_every_client_gets_thirty_two_cases(cases, clients):
    tally: dict[str, int] = {}
    for case in cases:
        tally[case["client"]] = tally.get(case["client"], 0) + 1
    assert tally == {client["slug"]: 32 for client in clients}


def test_ids_are_contiguous_and_start_after_the_campaign(cases):
    ids = [case["id"] for case in cases]
    assert ids == list(range(9, 9 + 256))


def test_every_case_has_four_acts_of_eight(cases, clients):
    for client in clients:
        acts: dict[int, int] = {}
        for case in cases:
            if case["client"] == client["slug"]:
                acts[case["act"]] = acts.get(case["act"], 0) + 1
        assert acts == {1: 8, 2: 8, 3: 8, 4: 8}, f"{client['slug']} is not 4x8"


# --------------------------------------------------------------------------- #
# Solvability — the claim that matters
# --------------------------------------------------------------------------- #

def test_every_case_is_solvable_from_its_clues(cases):
    """All 256, no exceptions, no hand-waving."""
    unsolved = []
    for case in cases:
        try:
            phrase = solve(case)
            ce.validate(phrase)
            if ce.fingerprint(phrase) != case["fingerprint"]:
                unsolved.append((case["id"], "fingerprint mismatch"))
        except Exception as exc:  # noqa: BLE001 - report, do not hide
            unsolved.append((case["id"], f"{type(exc).__name__}: {exc}"))
    assert not unsolved, f"{len(unsolved)} unsolvable case(s): {unsolved[:6]}"


def test_every_answer_is_a_valid_twelve_word_phrase(cases):
    for case in cases:
        phrase = solve(case)
        assert len(phrase.split()) == 12
        ce.validate(phrase)


def test_answers_are_all_different(cases):
    assert len({case["fingerprint"] for case in cases}) == len(cases)


def test_no_generated_case_reuses_a_campaign_answer(cases):
    from .answers import SOLUTIONS

    campaign = {ce.fingerprint(phrase) for phrase in SOLUTIONS.values()}
    assert not campaign & {case["fingerprint"] for case in cases}


def test_every_answer_derives_real_addresses(cases):
    """Spot-check the chain of custody from clue to address."""
    for case in cases[::16]:
        wallet = ce.derive_wallet(solve(case))
        assert wallet.primary.address.startswith("1")
        assert wallet.by_purpose(84).address.startswith("bc1q")


# --------------------------------------------------------------------------- #
# The clue text must agree with the specification
# --------------------------------------------------------------------------- #

def test_clue_text_carries_the_numbers_the_solver_uses(cases):
    """A pretty clue that disagrees with the spec is a lie to the player."""
    for case in cases:
        text = " ".join(case["clues"]["en"])
        for step in case["solution"]["steps"]:
            if step["kind"] == "index":
                assert str(step["index"]) in text or "+" in text or "×" in text
            elif step["kind"] == "mirror":
                assert str(step["mirror"]) in text
            elif step["kind"] == "grid":
                assert f"row {step['row']}" in text
                assert f"column {step['column']}" in text
            elif step["kind"] == "sats":
                assert f"0.{step['sats']:08d}" in text
            elif step["kind"] in ("prefix", "prefix_shortest"):
                assert f"'{step['prefix']}'" in text
            elif step["kind"] == "neighbour":
                assert step["anchor"] in text
            elif step["kind"] == "entropy":
                pass
            elif step["kind"] == "redacted":
                assert "COMPLETE" in text


def test_arithmetic_clues_actually_evaluate_to_their_index(cases):
    """The sums MERIDIAN and VEGA print must be true sums."""
    checked = 0
    for case in cases:
        if case["archetype"] != "index_math":
            continue
        for line, step in zip(case["clues"]["en"][2:], case["solution"]["steps"]):
            expression = line.split("word no.")[1].strip()
            value = eval(expression.replace("×", "*").replace("−", "-"))  # noqa: S307
            assert value == step["index"], f"case {case['id']}: {expression} != {step['index']}"
            checked += 1
    assert checked > 300, "arithmetic dialect barely covered"


def test_redacted_sheets_hide_exactly_one_word(cases):
    for case in cases:
        if case["archetype"] != "redacted":
            continue
        pattern = case["solution"]["steps"][0]["pattern"]
        assert pattern.split().count("?") == 1
        position, candidates = ce.complete_mnemonic(pattern)
        assert case["solution"]["steps"][0]["word"] in candidates


def test_prefix_clues_are_genuinely_unique(cases):
    for case in cases:
        if case["archetype"] != "unique_prefix":
            continue
        for step in case["solution"]["steps"]:
            matches = [w for _, w in ce.search(step["prefix"], limit=2049)]
            if step["kind"] == "prefix":
                assert matches == [step["word"]]
            else:
                # The stem itself: unique because it is the shortest branch.
                shortest = min(matches, key=len)
                assert shortest == step["word"]
                assert sum(1 for m in matches if len(m) == len(shortest)) == 1


# --------------------------------------------------------------------------- #
# Playability
# --------------------------------------------------------------------------- #

def test_hints_always_spell_out_the_answer(cases):
    """No case may dead-end a player who has spent every hint."""
    for case in cases:
        blob = " ".join(case["hints"]["en"]).lower()
        phrase = solve(case)
        if case["kind"] == "entropy":
            assert ce.mnemonic_to_entropy(phrase).hex() in blob.replace(" ", "")
        else:
            for word in phrase.split():
                assert word in blob, f"case {case['id']} hint never names '{word}'"


def test_progression_only_ever_points_backwards(cases):
    ids = {case["id"] for case in cases} | set(range(1, 9))
    for case in cases:
        for required in case["requires"]:
            assert required < case["id"]
            assert required in ids


def test_every_case_is_bilingual_and_complete(cases):
    for case in cases:
        for field in ("codename", "brief", "evidence", "clues", "hints", "epilogue"):
            for lang in ("ru", "en"):
                value = case[field][lang]
                assert value, f"case {case['id']} has empty {field}/{lang}"
                if isinstance(value, list):
                    assert any(line.strip() for line in value)


def test_epilogues_do_not_promise_on_chain_history(cases):
    """These wallets are cold; the fiction must not claim otherwise."""
    for case in cases:
        text = " ".join(case["epilogue"]["en"]).lower()
        for lie in ("transactions have", "carries dozens", "rich history", "still holds"):
            assert lie not in text


# --- codenames -------------------------------------------------------------

FEMININE = {"ОЦЕНКА", "ПОДПИСЬ", "РАМА", "КОМИССИЯ", "КАРТА", "ПАЛАТА", "ПЕЧАТЬ",
            "ОПИСЬ", "ЖИЛА", "ШТОЛЬНЯ", "ГРАНЬ", "ПАМЯТЬ", "КОПИЯ"}
NEUTER = {"ОКНО", "СОГЛАСИЕ", "ЗЕРКАЛО", "ИМЯ"}


def test_codenames_are_all_distinct(cases):
    for lang in ("ru", "en"):
        names = [case["codename"][lang] for case in cases]
        assert len(set(names)) == len(names), f"duplicate {lang} codenames"


def test_russian_codenames_agree_in_gender(cases):
    """'СЕКРЕТНЫЙ ОПИСЬ' would give the whole board away as machine-made."""
    wrong = []
    for case in cases:
        adjective, noun = case["codename"]["ru"].split(" ", 1)
        if noun in FEMININE and not adjective.endswith(("АЯ", "ЯЯ")):
            wrong.append(case["codename"]["ru"])
        elif noun in NEUTER and not adjective.endswith(("ОЕ", "ЕЕ")):
            wrong.append(case["codename"]["ru"])
        elif noun not in FEMININE and noun not in NEUTER \
                and not adjective.endswith(("ЫЙ", "ИЙ", "ОЙ")):
            wrong.append(case["codename"]["ru"])
    assert not wrong, f"gender disagreement: {wrong[:8]}"


def test_each_client_keeps_its_own_vocabulary(cases, clients):
    """A MICA case must not be named out of WHITEBONE's word pool."""
    for client in clients:
        nouns = set(client["motifs"]["noun"]["ru"])
        for case in cases:
            if case["client"] != client["slug"]:
                continue
            _, noun = case["codename"]["ru"].split(" ", 1)
            assert noun in nouns, f"{case['codename']['ru']} is not {client['slug']}'s word"


# --- dialects --------------------------------------------------------------

def test_each_client_only_speaks_its_own_dialects(cases, clients):
    for client in clients:
        allowed = set(client["archetypes"])
        used = {case["archetype"] for case in cases if case["client"] == client["slug"]}
        assert used <= allowed, f"{client['slug']} used {used - allowed}"


def test_every_dialect_is_exercised(cases):
    used = {case["archetype"] for case in cases}
    assert used == {
        "entropy_pattern", "index_math", "mirror_index", "grid_coords",
        "ledger_amounts", "unique_prefix", "neighbour", "redacted",
    }


def test_difficulty_climbs_with_the_acts(cases, clients):
    for client in clients:
        by_act = {}
        for case in cases:
            if case["client"] == client["slug"]:
                by_act.setdefault(case["act"], set()).add(case["difficulty"])
        first = min(by_act[1])
        last = max(by_act[4])
        assert last >= first, f"{client['slug']} gets easier as it goes"
        assert first >= client["difficulty"][0]
        assert last <= client["difficulty"][1]


def test_the_board_is_reproducible():
    """Same seed, same board — a rebuild must not reshuffle a player's game."""
    import subprocess

    before = (ROOT / "data" / "contracts.json").read_text(encoding="utf-8")
    subprocess.run(["python3", "tools/generate_cases.py"], cwd=ROOT,
                   capture_output=True, check=True, timeout=300)
    after = (ROOT / "data" / "contracts.json").read_text(encoding="utf-8")
    assert before == after, "the generator is not deterministic"
