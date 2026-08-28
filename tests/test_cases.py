"""The quest data must stay solvable and internally consistent."""

import re

import pytest

from enigma_terminal import crypto_engine as ce
from enigma_terminal.cases import Campaign

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


