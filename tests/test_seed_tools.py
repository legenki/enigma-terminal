"""Randomisation and single-word recovery."""

import pytest

from enigma_terminal import crypto_engine as ce

from .answers import SOLUTIONS


@pytest.mark.parametrize("count,bits", [(12, 128), (15, 160), (18, 192), (21, 224), (24, 256)])
def test_random_mnemonic_has_the_right_shape(count, bits):
    mnemonic, entropy = ce.random_mnemonic(count)
    assert len(mnemonic.split()) == count
    assert len(entropy) * 8 == bits
    ce.validate(mnemonic)                       # always checksum-valid
    assert ce.mnemonic_to_entropy(mnemonic) == entropy


def test_random_mnemonic_rejects_other_lengths():
    for count in (0, 11, 13, 25, -12):
        with pytest.raises(ce.MnemonicError) as excinfo:
            ce.random_mnemonic(count)
        assert excinfo.value.kind == "length"


def test_random_mnemonics_do_not_repeat():
    """A generator that repeats itself would hand out other people's wallets."""
    seen = {ce.random_mnemonic(12)[0] for _ in range(40)}
    assert len(seen) == 40


def test_random_mnemonic_derives_real_addresses():
    mnemonic, _ = ce.random_mnemonic(12)
    wallet = ce.derive_wallet(mnemonic)
    assert wallet.primary.address.startswith("1")
    assert wallet.by_purpose(84).address.startswith("bc1q")


# --- single-word recovery -------------------------------------------------


def test_completion_finds_the_final_word():
    phrase = " ".join(SOLUTIONS[1].split()[:-1] + ["?"])
    position, matches = ce.complete_mnemonic(phrase)
    assert position == 11
    assert "about" in matches
    # Four checksum bits leave roughly one word in sixteen.
    assert len(matches) == 128


def test_completion_finds_a_word_in_the_middle():
    words = SOLUTIONS[5].split()
    words[5] = "?"
    position, matches = ce.complete_mnemonic(" ".join(words))
    assert position == 5
    assert "grace" in matches
    assert 100 < len(matches) < 160


@pytest.mark.parametrize("case_id", sorted(SOLUTIONS))
@pytest.mark.parametrize("position", [0, 6, 11])
def test_every_candidate_is_a_valid_mnemonic(case_id, position):
    words = SOLUTIONS[case_id].split()
    original = words[position]
    words[position] = "?"
    found_position, matches = ce.complete_mnemonic(" ".join(words))
    assert found_position == position
    assert original in matches, "the real word must always survive its own checksum"
    for candidate in matches[:12]:
        words[position] = candidate
        ce.validate(" ".join(words))            # raises if any candidate is bogus


def test_completion_accepts_the_documented_blank_tokens():
    base = SOLUTIONS[4].split()[:-1]
    for token in ("?", "*", "_", "..."):
        _, matches = ce.complete_mnemonic(" ".join(base + [token]))
        assert "wrong" in matches


def test_completion_refuses_two_blanks():
    words = SOLUTIONS[1].split()
    words[0] = words[11] = "?"
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.complete_mnemonic(" ".join(words))
    assert excinfo.value.kind == "too_many_blanks"
    assert "EXACTLY ONE" in str(excinfo.value)


def test_completion_requires_a_blank():
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.complete_mnemonic(SOLUTIONS[1])
    assert excinfo.value.kind == "no_blank"


def test_completion_rejects_words_outside_the_dictionary():
    words = SOLUTIONS[1].split()
    words[0] = "bitcoin"
    words[11] = "?"
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.complete_mnemonic(" ".join(words))
    assert excinfo.value.kind == "dictionary"


def test_completion_rejects_a_wrong_length():
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.complete_mnemonic("abandon ?")
    assert excinfo.value.kind == "length"
