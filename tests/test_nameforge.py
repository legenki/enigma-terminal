"""Nameforge, and the two ways a vanity tool lies to the player.

The first is the estimate. Every published table for this kind of thing says
58^n, and 58^n is wrong here: the character right after the leading `1` is
nowhere near uniform, so a name is priced by its letters and not its length.
An estimate off by a factor of sixty is a promise of minutes that costs hours.

The second is the phrase. A stamp is only worth anything if the address really
is the address of that phrase at the path the card names — which is what most
of this file checks, against the same derivation the rest of the game uses.

Both lies get a second way to be told once case is a choice, so most of what
is here is checked in both modes.
"""

from __future__ import annotations

import json
import math
import re
import string
from pathlib import Path

import pytest

from enigma_terminal import nameforge as nf
from enigma_terminal.crypto_engine import derive_wallet, validate as validate_mnemonic

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def measured():
    return json.loads((ROOT / "data" / "nameforge.json").read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# The name
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("typed", ["andy", "ANDY", "Andy", "aN", "cHAncE"])
def test_the_case_typed_is_the_case_struck(typed):
    """This used to fold every spelling to `Andy`, one spelling per name. That
    was standing in for a decision the player was never offered; now that they
    make it, silently restyling their name would be the surprising thing."""
    assert nf.validate(typed) == typed
    assert nf.normalise(f"  {typed}  ") == typed


@pytest.mark.parametrize(("typed", "address"), [
    ("Chance", "1Chance" + "z" * 27),
    ("chance", "1chance" + "z" * 27),
    ("cHAncE", "1cHAncE" + "z" * 27),
])
def test_any_case_accepts_every_spelling_exact_accepts_one(typed, address):
    """The whole point of the switch, stated as plainly as it can be."""
    assert nf.matches(address, "Chance", any_case=True)
    assert nf.matches(address, "Chance") == (typed == "Chance")


@pytest.mark.parametrize("typed", ["A", "", "Abcdefg"])
def test_a_name_outside_two_to_six_is_refused(typed):
    with pytest.raises(nf.NameError_) as caught:
        nf.validate(typed)
    assert caught.value.kind == "length"


@pytest.mark.parametrize("typed", ["B0b", "IAn", "Oslo", "Bell", "oOo"])
def test_a_name_no_address_can_carry_is_refused(typed):
    """Base58 has no 0, O, I or l. Searching for one runs until the sun dies,
    reporting honest progress the whole way, which is the worst kind of bug."""
    with pytest.raises(nf.NameError_) as caught:
        nf.validate(typed)
    assert caught.value.kind == "alphabet"


@pytest.mark.parametrize("typed", ["IAn", "Oslo", "Bell", "oOo"])
def test_any_case_strikes_names_the_alphabet_only_seemed_to_forbid(typed):
    """Base58 drops `O`, `I` and `l` but keeps `o`, `i` and `L`. Exact mode has
    to refuse these; any-case mode can strike every one of them, which is worth
    as much as the speed and is far easier to miss."""
    assert nf.validate(typed, any_case=True) == typed
    for char in typed:
        assert nf.variants(char, any_case=True), f"{char} has no form at all"


def test_a_zero_is_refused_in_both_modes():
    """`0` is the one character with no case to fall back on."""
    for any_case in (False, True):
        with pytest.raises(nf.NameError_) as caught:
            nf.validate("B0b", any_case=any_case)
        assert caught.value.kind == "alphabet"


def test_the_alphabet_is_not_symmetric():
    """The asymmetry is the reason any-case mode rescues anything at all, and
    a flattened BASE58 would make this file quietly meaningless."""
    both = [c for c in string.ascii_lowercase if len(nf.variants(c, True)) == 2]
    one = [c for c in string.ascii_lowercase if len(nf.variants(c, True)) == 1]
    assert len(both) == 23
    assert sorted(one) == ["i", "l", "o"]




def test_every_letter_of_a_valid_name_is_in_the_alphabet():
    for stamp in ("An", "Bob", "Andy", "Zoe", "xyz9"):
        assert all(c in nf.BASE58 for c in nf.validate(stamp))


# --------------------------------------------------------------------------- #
# The estimate — the part that is easy to get wrong and impossible to see
# --------------------------------------------------------------------------- #

def test_the_distribution_is_a_distribution(measured):
    leading = measured["leading"]
    assert set(leading) == set(nf.BASE58), "a character is missing from the measurement"
    assert math.isclose(sum(leading.values()), 1.0, abs_tol=1e-4), \
        f"the leading-character shares sum to {sum(leading.values())}"
    assert measured["sample"] >= 1_000_000, "too small a sample to price names by"


def test_the_leading_character_is_nowhere_near_uniform(measured):
    """The whole difficulty model exists because of this. If it ever became
    uniform the model would be pointless — and if this test fails because the
    measurement was flattened by accident, every estimate is quietly wrong."""
    shares = measured["leading"]
    uniform = 1 / len(nf.BASE58)
    easy = [c for c, p in shares.items() if p > uniform * 2]
    hard = [c for c, p in shares.items() if p < uniform / 5]
    assert len(easy) >= 20, "the easy characters vanished"
    assert len(hard) >= 30, "the hard characters vanished"
    assert max(shares.values()) / min(shares.values()) > 20, "the spread collapsed"


def test_a_short_hard_name_costs_what_a_longer_easy_one_does():
    """`Rob` is three characters and `Andy` is four, and they cost the same,
    because R lands about sixty times less often than A. Pricing by length
    would have called one of these an easy afternoon."""
    rob = nf.expected_attempts("Rob")
    andy = nf.expected_attempts("Andy")
    assert 0.3 < rob / andy < 3, f"Rob {rob:,.0f} vs Andy {andy:,.0f}"
    assert nf.tier("Rob") == nf.tier("Andy")


def test_a_longer_name_is_never_cheaper_than_its_own_prefix():
    for stamp in ("Andy", "Bobby", "Zoe"):
        for cut in range(2, len(stamp)):
            assert nf.expected_attempts(stamp[:cut]) <= nf.expected_attempts(stamp[: cut + 1])


def test_the_bits_reported_are_the_bits_actually_searched():
    """Not the 128 bits of the phrase, which would flatter the result."""
    for stamp in ("An", "Andy", "Andre"):
        guess = nf.estimate(stamp, rate=100)
        assert math.isclose(2 ** guess.bits, guess.attempts, rel_tol=1e-9)
        assert guess.bits < 128


def test_the_estimate_scales_with_the_machine_it_was_measured_on():
    fast = nf.estimate("Andy", rate=1000)
    slow = nf.estimate("Andy", rate=10)
    assert math.isclose(slow.seconds, fast.seconds * 100, rel_tol=1e-9)
    assert fast.attempts == slow.attempts


def test_tiers_are_cut_on_cost_and_not_on_length():
    assert nf.tier("An") == "COMMON"
    assert nf.tier("Bob") in ("UNCOMMON", "RARE")
    assert nf.tier("Andre") in ("EPIC", "LEGENDARY")
    # Same length, opposite ends of the alphabet's cost.
    assert nf.expected_attempts("Zoe") > nf.expected_attempts("And") * 10


def test_a_long_wait_is_flagged_before_it_is_started():
    assert not nf.estimate("An", rate=150).is_long
    assert nf.estimate("Andre", rate=150).is_long


@pytest.mark.parametrize(
    ("seconds", "reads"),
    [(0.4, "under a second"), (30, "30 seconds"), (600, "10 minutes"),
     (7200, "2.0 hours"), (400000, "4.6 days"), (math.inf, "never")],
)
def test_durations_read_the_way_a_person_says_them(seconds, reads):
    assert nf.humanise(seconds) == reads


# --------------------------------------------------------------------------- #
# The two modes, priced against each other
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("stamp", ["Chance", "Andy", "Bob", "zoe", "Rob"])
def test_any_case_is_never_dearer_and_usually_much_cheaper(stamp):
    exact = nf.expected_attempts(stamp)
    loose = nf.expected_attempts(stamp, any_case=True)
    assert loose <= exact * 1.000001, "widening what counts cannot cost more"


def test_the_saving_is_exactly_the_alphabet_it_opens_up():
    """Not a fudge factor: each position after the first doubles when both of
    its cases exist, and the first grows by whatever the measurement says the
    other case is worth."""
    stamp = "Chance"
    tail = 1.0
    for char in stamp[1:]:
        tail *= len(nf.variants(char, True)) / len(nf.variants(char, False))
    first = sum(nf.LEADING[c] for c in nf.variants(stamp[0], True))
    first /= nf.LEADING[stamp[0]]
    predicted = first * tail
    measured = nf.expected_attempts(stamp) / nf.expected_attempts(stamp, True)
    assert math.isclose(measured, predicted, rel_tol=1e-9)
    # Five of Chance's six letters have both cases, and so does the C.
    assert 30 < measured < 35


def test_a_lowercase_first_letter_is_the_expensive_mistake():
    """`chance` exact is not `Chance` exact with a different look: it is sixty
    times the work, because `c` lands sixty times less often than `C`. This is
    the case the interface has to warn about, so it is pinned here."""
    assert nf.expected_attempts("chance") / nf.expected_attempts("Chance") > 50
    # And any-case mode collapses the difference to nothing at all.
    assert math.isclose(
        nf.expected_attempts("chance", True),
        nf.expected_attempts("Chance", True),
        rel_tol=1e-9,
    )


def test_the_mode_travels_with_the_estimate():
    """A card that says EPIC must say which search it priced."""
    assert nf.estimate("Chance", rate=150).any_case is False
    assert nf.estimate("Chance", rate=150, any_case=True).any_case is True
    assert nf.tier("Chance") != nf.tier("Chance", any_case=True)


# --------------------------------------------------------------------------- #
# The phrase — a stamp is worthless if the address is not really its address
# --------------------------------------------------------------------------- #

def test_a_candidate_is_a_real_phrase_at_the_stated_path():
    mnemonic, address = nf.candidate()
    validate_mnemonic(mnemonic)
    assert len(mnemonic.split()) == 12
    assert derive_wallet(mnemonic).primary.address == address, \
        "the address is not the one this phrase derives to"
    assert address.startswith("1")


def test_two_candidates_are_not_the_same_candidate():
    """128 bits from the OS source, not a seeded generator."""
    assert len({nf.candidate()[0] for _ in range(5)}) == 5


def test_a_struck_stamp_carries_the_name_and_verifies(monkeypatch):
    hit = "1An" + "z" * 31
    monkeypatch.setattr(nf, "candidate", lambda: ("phrase words here", hit))
    struck = nf.forge("An", limit=5)
    assert struck is not None
    assert struck.stamp == "An"
    assert struck.address.startswith("1An")
    assert struck.path == nf.PATH
    assert struck.attempts == 1


def test_an_any_case_search_accepts_the_case_it_finds(monkeypatch):
    """`aN` asked for; `1An…` struck. The stamp records what was asked for and
    the address carries what was found, and the preview must show the second —
    it is the address the player actually holds."""
    monkeypatch.setattr(nf, "candidate", lambda: ("phrase", "1An" + "z" * 31))
    struck = nf.forge("aN", any_case=True, limit=5)
    assert struck is not None
    assert struck.stamp == "aN"
    assert struck.any_case is True
    assert struck.preview.startswith("1An")
    # And the same search in exact mode never accepts it.
    assert nf.forge("aN", limit=20) is None


def test_the_preview_hides_everything_after_the_name():
    monkeypatch_address = "1Andy" + "q" * 29
    stamp = nf.Stamp(stamp="Andy", mnemonic="x", address=monkeypatch_address,
                     path=nf.PATH, attempts=1, seconds=1.0, tier="RARE", bits=22.1)
    assert stamp.preview.startswith("1Andy")
    assert set(stamp.preview[5:]) == {"•"}
    assert len(stamp.preview) == len(monkeypatch_address)


def test_matching_is_case_sensitive_because_base58_is():
    """`a` and `A` are different characters in an address, and conflating them
    would quietly hand the player a stamp that is not the name they asked for."""
    calls = {"n": 0}

    def wrong_case():
        calls["n"] += 1
        # Right letters, wrong case — must not count as a hit.
        return ("phrase", "1aN" + "z" * 31) if calls["n"] < 3 else ("phrase", "1An" + "z" * 31)

    import enigma_terminal.nameforge as module
    original = module.candidate
    module.candidate = wrong_case
    try:
        struck = module.forge("An", limit=20)
    finally:
        module.candidate = original
    assert struck is not None
    assert struck.attempts == 3, "a wrong-case address was accepted as a hit"


def test_a_search_stops_when_it_is_told_to(monkeypatch):
    monkeypatch.setattr(nf, "candidate", lambda: ("phrase", "1zz" + "z" * 31))
    assert nf.forge("An", limit=50) is None

    seen = []
    monkeypatch.setattr(nf, "candidate", lambda: ("phrase", "1zz" + "z" * 31))
    stopped = nf.forge(
        "An",
        on_progress=lambda attempts, closest: seen.append(attempts) or False,
        progress_every=10,
    )
    assert stopped is None
    assert seen == [10], "the search ran past the stop"


# --------------------------------------------------------------------------- #
# Both builds
# --------------------------------------------------------------------------- #

def test_both_builds_price_a_name_the_same(measured):
    """The panel and the terminal must quote the same wait for the same name."""
    web = (ROOT / "docs" / "js" / "leading.js").read_text(encoding="utf-8")
    body = web[web.index("{") : web.rindex("}") + 1]
    assert json.loads(body) == measured["leading"], \
        "docs/js/leading.js is stale — run tools/build_web_data.py"


def test_both_builds_price_both_modes_identically():
    """The panel and the terminal must quote the same wait for the same name in
    the same mode. Checked by running the JavaScript, not by reading it: the
    two implementations of this arithmetic are the thing most likely to drift."""
    import shutil
    import subprocess

    if shutil.which("node") is None:
        pytest.skip("node is required for the parity check")

    names = ["Chance", "chance", "Andy", "Bob", "Rob", "zoe", "Oslo", "Bell"]
    script = """
      const nf = await import('./docs/js/nameforge.js');
      const names = NAMES;
      const out = {};
      for (const n of names)
        for (const any of [false, true]) {
          const v = nf.validate(n, any);
          out[n + '|' + any] = v.error ? v.error : nf.expectedAttempts(v.stamp, any);
        }
      console.log(JSON.stringify(out));
    """.replace("NAMES", json.dumps(names))
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    web = json.loads(completed.stdout)

    for name in names:
        for any_case in (False, True):
            key = f"{name}|{str(any_case).lower()}"
            try:
                stamp = nf.validate(name, any_case)
            except nf.NameError_ as refused:
                assert web[key] == refused.kind, f"{key}: builds disagree on refusal"
                continue
            assert not isinstance(web[key], str), f"{key}: the web build refused it"
            assert math.isclose(web[key], nf.expected_attempts(stamp, any_case), rel_tol=1e-9), \
                f"{key}: {web[key]} vs {nf.expected_attempts(stamp, any_case)}"


def test_both_builds_agree_on_the_rules():
    web = (ROOT / "docs" / "js" / "nameforge.js").read_text(encoding="utf-8")
    assert f"'{nf.PATH}'" in web or f'"{nf.PATH}"' in web, "the derivation paths differ"
    assert f"MIN_LENGTH = {nf.MIN_LENGTH}" in web
    assert f"MAX_LENGTH = {nf.MAX_LENGTH}" in web
    for _, name in nf.TIERS:
        assert f"'{name}'" in web, f"the web build has no {name} tier"
    # The mode has to reach the worker, or the page prices one search and the
    # workers run the other.
    worker = (ROOT / "docs" / "js" / "nameforge-worker.js").read_text(encoding="utf-8")
    assert "anyCase" in worker, "the worker never hears which case rule to use"
    assert "matches(" in worker, "the worker decides for itself what counts as a hit"


def test_the_worker_draws_from_the_cryptographic_source():
    """Math.random here would be a real wallet made from a predictable seed."""
    worker = (ROOT / "docs" / "js" / "nameforge-worker.js").read_text(encoding="utf-8")
    assert "crypto.getRandomValues" in worker
    # Comments stripped first: the file says "never Math.random" in prose, and
    # a check that cannot tell code from a comment about code is no check.
    code = re.sub(r"//.*?$|/\*.*?\*/", "", worker, flags=re.MULTILINE | re.DOTALL)
    assert not re.search(r"\bMath\.random\b", code), "Math.random in a key generator"
