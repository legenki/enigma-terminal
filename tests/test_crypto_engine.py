"""The crypto core must agree with the BIP-39/32/44/49/84 specifications."""

import hashlib

import pytest

from neon_terminal import crypto_engine as ce
from neon_terminal._ripemd160 import ripemd160

OFFICIAL_FIRST_VECTOR_SEED = (
    "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e5349553"
    "1f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04"
)


def test_wordlist_is_the_official_one():
    assert ce.wordlist_is_authentic()
    assert len(ce.WORDLIST) == 2048
    assert ce.WORDLIST[0] == "abandon"
    assert ce.WORDLIST[-1] == "zoo"


def test_word_lookup_is_one_based():
    assert ce.word_at(1) == "abandon"
    assert ce.word_at(2048) == "zoo"
    assert ce.index_of("abandon") == 1
    assert ce.index_of("zoo") == 2048
    with pytest.raises(IndexError):
        ce.word_at(0)
    with pytest.raises(IndexError):
        ce.word_at(2049)
    with pytest.raises(KeyError):
        ce.index_of("notaword")


def test_search_matches_by_prefix():
    hits = ce.search("aban")
    assert hits == [(1, "abandon")]
    assert all(word.startswith("zo") for _, word in ce.search("zo"))


@pytest.mark.parametrize("index", range(9))
def test_entropy_to_mnemonic_matches_reference(vectors, index):
    vector = vectors[index]
    assert ce.entropy_to_mnemonic(bytes.fromhex(vector["entropy"])) == vector["mnemonic"]


@pytest.mark.parametrize("index", range(9))
def test_mnemonic_round_trips_through_entropy(vectors, index):
    vector = vectors[index]
    assert ce.mnemonic_to_entropy(vector["mnemonic"]).hex() == vector["entropy"]


@pytest.mark.parametrize("index", range(9))
def test_seed_matches_reference(vectors, index):
    vector = vectors[index]
    assert ce.to_seed(vector["mnemonic"]).hex() == vector["seed"]
    assert ce.to_seed(vector["mnemonic"], "TREZOR").hex() == vector["seed_trezor_passphrase"]


def test_first_official_bip39_vector():
    """The canonical Trezor vector, hardcoded so the suite stands on its own."""
    mnemonic = "abandon " * 11 + "about"
    assert ce.to_seed(mnemonic, "TREZOR").hex() == OFFICIAL_FIRST_VECTOR_SEED


@pytest.mark.parametrize("index", range(9))
def test_address_derivation_matches_reference(vectors, index):
    vector = vectors[index]
    wallet = ce.derive_wallet(vector["mnemonic"])
    for purpose, expected in vector["addresses"].items():
        assert wallet.by_purpose(int(purpose)).address == expected
    assert wallet.by_purpose(44).wif == vector["wif_44"]
    assert wallet.by_purpose(44).public_key == vector["pubkey_44"]


def test_derivation_paths_and_key_prefixes():
    wallet = ce.derive_wallet("abandon " * 11 + "about")
    assert wallet.master_xprv.startswith("xprv")
    assert [d.path for d in wallet.addresses] == [
        "m/44'/0'/0'/0/0", "m/49'/0'/0'/0/0", "m/84'/0'/0'/0/0",
    ]
    assert wallet.by_purpose(44).extended_private_key.startswith("xprv")
    assert wallet.by_purpose(49).extended_private_key.startswith("yprv")
    assert wallet.by_purpose(84).extended_private_key.startswith("zprv")
    assert wallet.primary.address.startswith("1")
    assert wallet.by_purpose(49).address.startswith("3")
    assert wallet.by_purpose(84).address.startswith("bc1q")


def test_checksum_failure_is_reported_as_such():
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.validate("abandon " * 12)
    assert excinfo.value.kind == "checksum"
    assert str(excinfo.value) == "MNEMONIC CHECKSUM INVALID. DECRYPTION FAILED."


def test_unknown_word_is_reported_before_checksum():
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.validate("abandon " * 11 + "bitcoin")
    assert excinfo.value.kind == "dictionary"


def test_wrong_length_is_rejected():
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.validate("abandon about")
    assert excinfo.value.kind == "length"


def test_bad_entropy_length_is_rejected():
    with pytest.raises(ce.MnemonicError) as excinfo:
        ce.entropy_to_mnemonic(b"\x00" * 15)
    assert excinfo.value.kind == "entropy_length"


def test_normalisation_ignores_case_and_spacing():
    messy = "  Abandon   ABANDON abandon abandon abandon abandon " \
            "abandon abandon abandon abandon abandon\tAbout  "
    assert ce.normalize(messy) == "abandon " * 11 + "about"
    assert ce.derive_wallet(messy).primary.address == "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA"


def test_fingerprint_is_sha256_of_normalised_phrase():
    mnemonic = "abandon " * 11 + "about"
    expected = hashlib.sha256(mnemonic.encode()).hexdigest()
    assert ce.fingerprint(mnemonic) == expected
    assert ce.fingerprint(mnemonic.upper()) == expected


@pytest.mark.parametrize(
    "message,expected",
    [
        (b"", "9c1185a5c5e9fc54612808977ee8f548b2258d31"),
        (b"abc", "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"),
        (b"message digest", "5d0689ef49d2fae572b881b123a85ffa21595f36"),
    ],
)
def test_pure_python_ripemd160_vectors(message, expected):
    assert ripemd160(message).hex() == expected


def test_public_key_is_compressed_sec1():
    private = bytes.fromhex(
        "0000000000000000000000000000000000000000000000000000000000000001"
    )
    pub = ce.public_key(private)
    assert len(pub) == 33
    assert pub[0] in (2, 3)
    assert pub.hex() == (
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
    )


def test_private_key_out_of_range_is_rejected():
    with pytest.raises(ValueError):
        ce.public_key(b"\x00" * 32)
