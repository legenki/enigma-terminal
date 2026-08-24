"""The browser build must derive exactly what the Python build derives.

Two independent implementations of BIP-39/32 are easy to let drift apart; this
runs the JavaScript one under Node and diffs every field.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from neon_terminal import crypto_engine as ce
from neon_terminal.cases import Campaign

ROOT = Path(__file__).resolve().parent.parent

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="node is required for the parity check"
)


@pytest.fixture(scope="module")
def js_results():
    completed = subprocess.run(
        ["node", "tools/js_vectors.mjs"],
        cwd=ROOT, capture_output=True, text=True, timeout=180,
    )
    if completed.returncode != 0:
        pytest.fail(f"node failed:\n{completed.stderr}")
    return json.loads(completed.stdout)


def test_every_vector_is_covered(js_results, vectors):
    assert len(js_results) == len(vectors)


def test_javascript_matches_the_reference_vectors(js_results, vectors):
    for js, expected in zip(js_results, vectors):
        assert js["mnemonic"] == expected["mnemonic"]
        assert js["seed"] == expected["seed"]
        assert js["seed_trezor_passphrase"] == expected["seed_trezor_passphrase"]
        assert js["addresses"] == expected["addresses"]
        assert js["wif_44"] == expected["wif_44"]
        assert js["pubkey_44"] == expected["pubkey_44"]
        assert js["round_trip_entropy"] == expected["entropy"]


def test_javascript_matches_the_python_engine(js_results):
    for js in js_results:
        wallet = ce.derive_wallet(js["mnemonic"])
        assert js["seed"] == wallet.seed
        assert js["master_xprv"] == wallet.master_xprv
        assert js["fingerprint"] == wallet.fingerprint
        for purpose, address in js["addresses"].items():
            derived = wallet.by_purpose(int(purpose))
            assert address == derived.address
            assert js["wif_44"] == wallet.by_purpose(44).wif


def test_web_data_is_in_sync_with_the_sources():
    """docs/js/*.js are generated; a stale build would ship the wrong quest."""
    completed = subprocess.run(
        ["python3", "tools/build_web_data.py"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    diff = subprocess.run(
        ["git", "diff", "--name-only", "--", "docs/js/wordlist.js", "docs/js/campaign.js"],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert not diff.stdout.strip(), (
        "generated web data is stale — run tools/build_web_data.py and commit:\n"
        + diff.stdout
    )


def test_case_fingerprints_are_identical_in_both_builds():
    campaign_js = (ROOT / "docs" / "js" / "campaign.js").read_text(encoding="utf-8")
    for case in Campaign().cases:
        assert case.fingerprint in campaign_js
