"""The quest data must stay solvable and internally consistent."""

import re

import pytest

from enigma_terminal import crypto_engine as ce
from enigma_terminal.cases import Campaign, Progress

from .answers import LEGACY_ADDRESSES, SOLUTIONS, UNRELATED_MNEMONIC

#: All four the game ships. This read ("ru", "en") for a long time, so the
#: completeness check below silently passed over every Spanish and Portuguese
#: field it was written to guard.
LANGUAGES = ("en", "es", "pt", "ru")
TEXT_FIELDS = ("brief", "evidence", "clues", "hints", "epilogue")


@pytest.fixture(scope="module")
def campaign():
    return Campaign()


def test_campaign_has_eight_cases(campaign):
    assert len(campaign.cases) == 8
    assert [c.id for c in campaign.cases] == list(range(1, 9))


def test_every_case_is_complete_in_every_language(campaign):
    for case in campaign.cases:
        for lang in LANGUAGES:
            assert case.codename(lang), f"case {case.id} missing codename/{lang}"
            for field in TEXT_FIELDS:
                lines = getattr(case, field)(lang)
                assert lines, f"case {case.id} has empty {field}/{lang}"
                assert all(isinstance(line, str) for line in lines)
        for lang in LANGUAGES:
            assert len(case.hints(lang)) == len(case.hints("en")), \
                f"case {case.id} has a different number of hints in {lang}"
        assert case.kind in ("words", "entropy")
        assert 1 <= case.difficulty <= 5


def test_fingerprints_are_distinct(campaign):
    fingerprints = {case.fingerprint for case in campaign.cases}
    assert len(fingerprints) == len(campaign.cases)


def test_requirements_reference_earlier_cases(campaign):
    for case in campaign.cases:
        for required in case.requires:
            assert required < case.id
            assert campaign.get(required) is not None


def test_every_case_answer_matches_its_fingerprint(campaign):
    for case in campaign.cases:
        answer = SOLUTIONS[case.id]
        ce.validate(answer)
        assert len(answer.split()) == 12
        assert case.matches(answer), f"case {case.id} fingerprint does not match its answer"


def test_hints_always_reveal_the_answer(campaign):
    """No case may dead-end a player: the hints must spell out the solution."""
    for case in campaign.cases:
        blob = " ".join(case.hints("en")).lower()
        answer = SOLUTIONS[case.id]
        if case.kind == "entropy":
            entropy = ce.mnemonic_to_entropy(answer).hex()
            assert entropy in blob.replace(" ", ""), f"case {case.id} never reveals its entropy"
        else:
            for word in sorted(set(answer.split())):
                assert re.search(rf"\b{word}\b", blob), \
                    f"case {case.id} hints never mention '{word}'"


def test_solutions_derive_to_the_expected_mainnet_addresses(campaign):
    for case in campaign.cases:
        wallet = ce.derive_wallet(SOLUTIONS[case.id])
        assert wallet.primary.address == LEGACY_ADDRESSES[case.id]
        assert wallet.by_purpose(49).address.startswith("3")
        assert wallet.by_purpose(84).address.startswith("bc1q")


def test_lookup_by_mnemonic_finds_the_owning_case(campaign):
    for case in campaign.cases:
        assert campaign.find_by_mnemonic(SOLUTIONS[case.id]) is case
    assert campaign.find_by_mnemonic(UNRELATED_MNEMONIC) is None


def test_answer_words_are_all_in_the_dictionary():
    for answer in SOLUTIONS.values():
        for word in answer.split():
            assert 1 <= ce.index_of(word) <= 2048


# --- progress -------------------------------------------------------------

def test_progress_round_trips(tmp_path):
    path = tmp_path / "progress.json"
    progress = Progress.load(path)
    assert progress.solved == set()

    progress.mark_solved(3)
    progress.use_hint(3)
    progress.use_hint(3)

    reloaded = Progress.load(path)
    assert reloaded.solved == {3}
    assert reloaded.hints_used == {3: 2}

    reloaded.reset()
    assert Progress.load(path).solved == set()


def test_progress_survives_a_corrupt_file(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text("{ this is not json", encoding="utf-8")
    assert Progress.load(path).solved == set()


@pytest.mark.parametrize(
    "body",
    ["[]", "null", '"hello"', "42", '{"solved": 5}', '{"hints_used": [1, 2]}'],
)
def test_progress_survives_valid_json_of_the_wrong_shape(tmp_path, body):
    """Broken JSON was handled; JSON that parses into the wrong type was not.

    `[]` reached `data.get` and took the game down with an AttributeError at
    startup — while the journal, reading the file beside it, came back empty.
    """
    path = tmp_path / "progress.json"
    path.write_text(body, encoding="utf-8")
    progress = Progress.load(path)
    assert progress.solved == set()
    assert progress.hints_used == {}
    assert progress.taken == set()


def test_progress_keeps_the_entries_it_can_read(tmp_path):
    """One unreadable id is not a reason to throw the whole save away."""
    path = tmp_path / "progress.json"
    path.write_text('{"solved": ["x", 3], "taken": [9]}', encoding="utf-8")
    progress = Progress.load(path)
    assert progress.solved == {3}
    assert progress.taken == {9}


def test_unlocking_depends_on_solved_cases(campaign, tmp_path):
    progress = Progress.load(tmp_path / "p.json")
    finale = campaign.get(8)
    assert not campaign.is_unlocked(finale, progress)
    for case_id in range(1, 8):
        progress.mark_solved(case_id)
    assert campaign.is_unlocked(finale, progress)
