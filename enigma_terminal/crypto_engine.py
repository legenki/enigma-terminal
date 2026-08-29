"""Real BIP-39 / BIP-32 / BIP-44-49-84 derivation.

Nothing here is simulated: mnemonics are validated against the official BIP-39
English wordlist (checksum included), and addresses are derived through the
standard Mnemonic -> Seed -> xprv -> Private Key -> Public Key -> Address chain.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_WORDLIST_FILE = _DATA_DIR / "english.txt"

#: sha256 of the official BIP-39 English wordlist, used as an integrity check.
WORDLIST_SHA256 = "2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda"

PURPOSES = {
    44: ("Legacy P2PKH", "m/44'/0'/0'/0/0"),
    49: ("Nested SegWit", "m/49'/0'/0'/0/0"),
    84: ("Native SegWit", "m/84'/0'/0'/0/0"),
}


class MnemonicError(ValueError):
    """Raised when a mnemonic is malformed, out-of-dictionary or checksum-invalid."""

    def __init__(self, message: str, kind: str = "generic") -> None:
        super().__init__(message)
        self.kind = kind


def _load_wordlist() -> tuple[str, ...]:
    try:
        raw = _WORDLIST_FILE.read_text(encoding="utf-8")
    except FileNotFoundError as exc:  # pragma: no cover - packaging accident
        raise RuntimeError(f"BIP-39 wordlist missing at {_WORDLIST_FILE}") from exc
    words = tuple(w.strip() for w in raw.split("\n") if w.strip())
    if len(words) != 2048:
        raise RuntimeError(f"BIP-39 wordlist must hold 2048 words, found {len(words)}")
    return words


WORDLIST: tuple[str, ...] = _load_wordlist()
_WORD_INDEX = {word: i for i, word in enumerate(WORDLIST)}


def wordlist_is_authentic() -> bool:
    """True when the bundled wordlist matches the official BIP-39 English list."""
    digest = hashlib.sha256(_WORDLIST_FILE.read_bytes()).hexdigest()
    return digest == WORDLIST_SHA256


def word_at(index_1based: int) -> str:
    """Return the wordlist entry at a 1-based index (as printed by the game)."""
    if not 1 <= index_1based <= 2048:
        raise IndexError("BIP-39 index must be in 1..2048")
    return WORDLIST[index_1based - 1]


def index_of(word: str) -> int:
    """Return the 1-based wordlist position of ``word``."""
    try:
        return _WORD_INDEX[word.strip().lower()] + 1
    except KeyError as exc:
        raise KeyError(word) from exc


def search(prefix: str, limit: int = 40) -> list[tuple[int, str]]:
    """Wordlist prefix search, returned as ``(1-based index, word)`` pairs."""
    prefix = prefix.strip().lower()
    hits = [(i + 1, w) for i, w in enumerate(WORDLIST) if w.startswith(prefix)]
    return hits[:limit]


def normalize(mnemonic: str) -> str:
    """NFKD-normalise and collapse whitespace, as BIP-39 requires."""
    return unicodedata.normalize("NFKD", " ".join(mnemonic.lower().split()))


def fingerprint(mnemonic: str) -> str:
    """Stable sha256 of a normalised mnemonic — how the game stores its answers."""
    return hashlib.sha256(normalize(mnemonic).encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# Mnemonic <-> entropy
# --------------------------------------------------------------------------- #

def entropy_to_mnemonic(entropy: bytes) -> str:
    """Turn 128..256 bits of entropy into a checksummed BIP-39 mnemonic."""
    if len(entropy) not in (16, 20, 24, 28, 32):
        raise MnemonicError(
            "ENTROPY MUST BE 16, 20, 24, 28 OR 32 BYTES", kind="entropy_length"
        )
    checksum_bits = len(entropy) * 8 // 32
    digest = hashlib.sha256(entropy).digest()
    bits = "".join(f"{b:08b}" for b in entropy)
    bits += "".join(f"{b:08b}" for b in digest)[:checksum_bits]
    words = [WORDLIST[int(bits[i : i + 11], 2)] for i in range(0, len(bits), 11)]
    return " ".join(words)


def mnemonic_to_entropy(mnemonic: str) -> bytes:
    """Reverse of :func:`entropy_to_mnemonic`; validates the checksum on the way."""
    # `validate` normalises and splits to do its own work and hands the result
    # back, so taking it here is one normalise rather than two — and makes it
    # impossible for the words measured to differ from the words checked.
    words = validate(mnemonic)
    bits = "".join(f"{_WORD_INDEX[w]:011b}" for w in words)
    entropy_bits = len(bits) * 32 // 33
    entropy = bytes(
        int(bits[i : i + 8], 2) for i in range(0, entropy_bits, 8)
    )
    return entropy


def validate(mnemonic: str) -> list[str]:
    """Validate word count, dictionary membership and checksum.

    Raises :class:`MnemonicError` with a ``kind`` of ``length``, ``dictionary``
    or ``checksum``; returns the normalised word list when everything holds.
    """
    words = normalize(mnemonic).split()
    if len(words) not in (12, 15, 18, 21, 24):
        raise MnemonicError(
            f"MNEMONIC LENGTH {len(words)} INVALID. EXPECTED 12/15/18/21/24 WORDS.",
            kind="length",
        )
    unknown = [w for w in words if w not in _WORD_INDEX]
    if unknown:
        raise MnemonicError(
            "WORD NOT IN BIP-39 DICTIONARY: " + ", ".join(unknown), kind="dictionary"
        )
    bits = "".join(f"{_WORD_INDEX[w]:011b}" for w in words)
    divider = len(bits) * 32 // 33
    entropy_bits, checksum_bits = bits[:divider], bits[divider:]
    entropy = bytes(
        int(entropy_bits[i : i + 8], 2) for i in range(0, len(entropy_bits), 8)
    )
    expected = "".join(f"{b:08b}" for b in hashlib.sha256(entropy).digest())[
        : len(checksum_bits)
    ]
    if checksum_bits != expected:
        raise MnemonicError(
            "MNEMONIC CHECKSUM INVALID. DECRYPTION FAILED.", kind="checksum"
        )
    return words


def to_seed(mnemonic: str, passphrase: str = "") -> bytes:
    """BIP-39 seed: PBKDF2-HMAC-SHA512, 2048 rounds, salt ``"mnemonic"+passphrase``."""
    salt = unicodedata.normalize("NFKD", "mnemonic" + passphrase).encode("utf-8")
    return hashlib.pbkdf2_hmac(
        "sha512", normalize(mnemonic).encode("utf-8"), salt, 2048, dklen=64
    )


# --------------------------------------------------------------------------- #
# secp256k1 + BIP-32
# --------------------------------------------------------------------------- #

_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
_GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
_GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
_G = (_GX, _GY)


def _point_add(p, q):
    if p is None:
        return q
    if q is None:
        return p
    if p[0] == q[0] and (p[1] + q[1]) % _P == 0:
        return None
    if p == q:
        lam = (3 * p[0] * p[0]) * pow(2 * p[1], -1, _P) % _P
    else:
        lam = (q[1] - p[1]) * pow(q[0] - p[0], -1, _P) % _P
    x = (lam * lam - p[0] - q[0]) % _P
    return (x, (lam * (p[0] - x) - p[1]) % _P)


def _point_mul(k: int, point=_G):
    result = None
    addend = point
    while k:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1
    return result


def public_key(private_key: bytes, compressed: bool = True) -> bytes:
    """secp256k1 public key for a 32-byte private key (compressed by default)."""
    k = int.from_bytes(private_key, "big")
    if not 0 < k < _N:
        raise ValueError("private key out of range")
    x, y = _point_mul(k)
    if not compressed:
        return b"\x04" + x.to_bytes(32, "big") + y.to_bytes(32, "big")
    return bytes([2 + (y & 1)]) + x.to_bytes(32, "big")


try:  # OpenSSL 3 often ships without the legacy provider that carries ripemd160
    hashlib.new("ripemd160")

    def _ripemd160(data: bytes) -> bytes:
        return hashlib.new("ripemd160", data).digest()
except (ValueError, TypeError):  # pragma: no cover - depends on the host OpenSSL
    from ._ripemd160 import ripemd160 as _ripemd160  # type: ignore


def _hash160(data: bytes) -> bytes:
    """Bitcoin's HASH160: RIPEMD-160 over SHA-256."""
    return _ripemd160(hashlib.sha256(data).digest())


@dataclass(frozen=True)
class ExtendedKey:
    """A BIP-32 extended private key."""

    key: bytes
    chain_code: bytes
    depth: int = 0
    #: The parent node, not its fingerprint. Computing a fingerprint costs a
    #: point multiplication and only to_extended() ever reads one — deriving an
    #: address does not — so m/44'/0'/0'/0/0 was paying for six where three
    #: suffice. Resolved on demand instead.
    parent: "ExtendedKey | None" = None
    child_number: int = 0

    @classmethod
    def from_seed(cls, seed: bytes) -> ExtendedKey:
        digest = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()
        return cls(key=digest[:32], chain_code=digest[32:])

    @cached_property
    def public_key(self) -> bytes:
        # Cached: a non-hardened child asks for this, and so does the address
        # at the end of the path. Recomputing it was a whole point
        # multiplication thrown away each time.
        return public_key(self.key)

    @cached_property
    def fingerprint(self) -> bytes:
        return _hash160(self.public_key)[:4]

    @property
    def parent_fingerprint(self) -> bytes:
        return self.parent.fingerprint if self.parent else b"\x00\x00\x00\x00"

    def child(self, index: int) -> ExtendedKey:
        hardened = index >= 0x80000000
        payload = (b"\x00" + self.key) if hardened else self.public_key
        data = payload + index.to_bytes(4, "big")
        digest = hmac.new(self.chain_code, data, hashlib.sha512).digest()
        tweak = int.from_bytes(digest[:32], "big")
        child_key = (tweak + int.from_bytes(self.key, "big")) % _N
        if tweak >= _N or child_key == 0:  # pragma: no cover - ~1/2^127
            return self.child(index + 1)
        return ExtendedKey(
            key=child_key.to_bytes(32, "big"),
            chain_code=digest[32:],
            depth=self.depth + 1,
            parent=self,
            child_number=index,
        )

    def derive_path(self, path: str) -> ExtendedKey:
        node = self
        for part in path.strip().split("/"):
            part = part.strip()
            if part in ("", "m", "M"):
                continue
            hardened = part.endswith(("'", "h", "H"))
            number = int(part.rstrip("'hH"))
            node = node.child(number + 0x80000000 if hardened else number)
        return node

    def to_extended(self, version: bytes = b"\x04\x88\xad\xe4") -> str:
        """Serialise as xprv/yprv/zprv depending on ``version``."""
        payload = (
            version
            + bytes([self.depth])
            + self.parent_fingerprint
            + self.child_number.to_bytes(4, "big")
            + self.chain_code
            + b"\x00"
            + self.key
        )
        return b58check_encode(payload)

    def to_wif(self, compressed: bool = True) -> str:
        payload = b"\x80" + self.key + (b"\x01" if compressed else b"")
        return b58check_encode(payload)


# --------------------------------------------------------------------------- #
# Address encodings
# --------------------------------------------------------------------------- #

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58check_encode(payload: bytes) -> str:
    data = payload + hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    number = int.from_bytes(data, "big")
    out = ""
    while number:
        number, rem = divmod(number, 58)
        out = _B58[rem] + out
    return "1" * (len(data) - len(data.lstrip(b"\x00"))) + out


_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _bech32_polymod(values: Iterable[int]) -> int:
    generator = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for i in range(5):
            chk ^= generator[i] if (top >> i) & 1 else 0
    return chk


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _convertbits(data: Sequence[int], frombits: int, tobits: int, pad: bool = True):
    acc = bits = 0
    out: list[int] = []
    maxv = (1 << tobits) - 1
    for value in data:
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            out.append((acc >> bits) & maxv)
    if pad and bits:
        out.append((acc << (tobits - bits)) & maxv)
    return out


def bech32_encode(hrp: str, witness_version: int, witness_program: bytes) -> str:
    data = [witness_version] + _convertbits(witness_program, 8, 5)
    const = 0x2BC830A3 if witness_version else 1  # bech32m for v1+
    polymod = _bech32_polymod(_bech32_hrp_expand(hrp) + data + [0] * 6) ^ const
    checksum = [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]
    return hrp + "1" + "".join(_BECH32_CHARSET[d] for d in data + checksum)


def p2pkh_address(pubkey: bytes) -> str:
    return b58check_encode(b"\x00" + _hash160(pubkey))


def p2sh_p2wpkh_address(pubkey: bytes) -> str:
    redeem_script = b"\x00\x14" + _hash160(pubkey)
    return b58check_encode(b"\x05" + _hash160(redeem_script))


def p2wpkh_address(pubkey: bytes) -> str:
    return bech32_encode("bc", 0, _hash160(pubkey))


# --------------------------------------------------------------------------- #
# The derivation grid the terminal prints
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class DerivedAddress:
    purpose: int
    label: str
    path: str
    address: str
    public_key: str
    wif: str
    extended_private_key: str


@dataclass(frozen=True)
class Wallet:
    mnemonic: str
    seed: str
    master_xprv: str
    addresses: list[DerivedAddress] = field(default_factory=list)

    @property
    def fingerprint(self) -> str:
        return fingerprint(self.mnemonic)

    def by_purpose(self, purpose: int) -> DerivedAddress:
        for derived in self.addresses:
            if derived.purpose == purpose:
                return derived
        raise KeyError(purpose)

    @property
    def primary(self) -> DerivedAddress:
        """The legacy address — the one with the longest on-chain history."""
        return self.by_purpose(44)


_XPRV_VERSIONS = {44: b"\x04\x88\xad\xe4", 49: b"\x04\x9d\x78\x78", 84: b"\x04\xb2\x43\x0c"}
_ENCODERS = {44: p2pkh_address, 49: p2sh_p2wpkh_address, 84: p2wpkh_address}


def derive_wallet(mnemonic: str, passphrase: str = "", account: int = 0,
                  index: int = 0) -> Wallet:
    """Full chain: mnemonic -> seed -> master xprv -> account keys -> addresses."""
    validate(mnemonic)
    seed = to_seed(mnemonic, passphrase)
    master = ExtendedKey.from_seed(seed)

    derived: list[DerivedAddress] = []
    for purpose, (label, _template) in PURPOSES.items():
        path = f"m/{purpose}'/0'/{account}'/0/{index}"
        node = master.derive_path(path)
        account_node = master.derive_path(f"m/{purpose}'/0'/{account}'")
        derived.append(
            DerivedAddress(
                purpose=purpose,
                label=label,
                path=path,
                address=_ENCODERS[purpose](node.public_key),
                public_key=node.public_key.hex(),
                wif=node.to_wif(),
                extended_private_key=account_node.to_extended(_XPRV_VERSIONS[purpose]),
            )
        )
    return Wallet(
        mnemonic=normalize(mnemonic),
        seed=seed.hex(),
        master_xprv=master.to_extended(),
        addresses=derived,
    )


# --------------------------------------------------------------------------- #
# Seed tools: randomisation and single-word recovery
# --------------------------------------------------------------------------- #

_WORD_COUNT_TO_ENTROPY_BYTES = {12: 16, 15: 20, 18: 24, 21: 28, 24: 32}

#: Tokens a player may type in place of a word they cannot remember. None of
#: them may also be a wordlist entry, or COMPLETE would read a real word as a
#: blank. Checked with a raise rather than an assert: `python -O` strips
#: asserts, and this is an invariant of the shipped data, not a debug aid.
UNKNOWN_TOKENS = frozenset({"?", "*", "_", "...", "??", "???"})
if UNKNOWN_TOKENS & set(_WORD_INDEX):
    raise RuntimeError(
        "unknown-word tokens collide with the wordlist: "
        + ", ".join(sorted(UNKNOWN_TOKENS & set(_WORD_INDEX)))
    )


def random_mnemonic(word_count: int = 12) -> tuple[str, bytes]:
    """Draw a fresh mnemonic from the OS cryptographic random source.

    This is the same procedure a real wallet follows to create a seed, which is
    exactly why the terminal shouts a warning before printing the result.
    """
    entropy_bytes = _WORD_COUNT_TO_ENTROPY_BYTES.get(word_count)
    if entropy_bytes is None:
        raise MnemonicError(
            f"WORD COUNT {word_count} INVALID. EXPECTED 12/15/18/21/24.", kind="length"
        )
    entropy = secrets.token_bytes(entropy_bytes)
    return entropy_to_mnemonic(entropy), entropy


def complete_mnemonic(pattern: str) -> tuple[int, list[str]]:
    """Resolve a phrase with exactly one unknown word marked by ``?``.

    A 12-word phrase carries four checksum bits, so about one word in sixteen
    fits — roughly 128 of the 2048 candidates survive. That makes this a recovery
    aid for a phrase you almost have, not a search over unknown wallets: two
    blanks would leave hundreds of thousands of valid answers, so they are
    refused rather than enumerated.

    Returns the 0-based blank position and the words that satisfy the checksum.

    **This deliberately returns less than the browser's `completeMnemonic`,**
    which answers `{ position, candidates }` with each candidate carrying the
    word, the whole phrase it completes and the campaign case that phrase
    solves. The panel needs all three to mark the answer that closes a case;
    nothing here does, and a reference implementation that assembled a phrase
    and looked up a case would be checking those two things against itself.
    The words are the part both builds must agree on, so the words are what
    `tests/test_web_parity.py` compares.
    """
    words = normalize(pattern).split()
    if len(words) not in _WORD_COUNT_TO_ENTROPY_BYTES:
        raise MnemonicError(
            f"PHRASE LENGTH {len(words)} INVALID. EXPECTED 12/15/18/21/24 WORDS.",
            kind="length",
        )

    blanks = [i for i, word in enumerate(words) if word in UNKNOWN_TOKENS]
    if not blanks:
        raise MnemonicError(
            "NO UNKNOWN POSITION MARKED. USE ? FOR THE MISSING WORD.", kind="no_blank"
        )
    if len(blanks) > 1:
        raise MnemonicError(
            f"{len(blanks)} UNKNOWN POSITIONS. THIS TOOL RESOLVES EXACTLY ONE.",
            kind="too_many_blanks",
        )

    unknown = [
        word for i, word in enumerate(words)
        if i != blanks[0] and word not in _WORD_INDEX
    ]
    if unknown:
        raise MnemonicError(
            "WORD NOT IN BIP-39 DICTIONARY: " + ", ".join(unknown), kind="dictionary"
        )

    position = blanks[0]
    attempt = list(words)
    matches: list[str] = []
    for candidate in WORDLIST:
        attempt[position] = candidate
        try:
            validate(" ".join(attempt))
        except MnemonicError:
            continue
        matches.append(candidate)
    return position, matches
