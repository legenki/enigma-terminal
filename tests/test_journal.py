"""The investigation journal, and the rule that keeps unknown seeds off disk."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from enigma_terminal.journal import MAX_ENTRIES, Journal, mask_address, mask_mnemonic

from .answers import SOLUTIONS, UNRELATED_MNEMONIC


@pytest.fixture
def journal(tmp_path):
    return Journal(tmp_path / "journal.json")


def test_entries_are_newest_first(journal):
    journal.push("search", "first")
    journal.push("ledger", "second")
    journal.push("random", "third")
    assert [entry.title for entry in journal] == ["third", "second", "first"]


def test_positions_are_one_based(journal):
    journal.push("search", "older")
    journal.push("search", "newer")
    assert journal.at(1).title == "newer"
    assert journal.at(2).title == "older"
    assert journal.at(0) is None
    assert journal.at(3) is None
    assert journal.at(-1) is None


def test_entries_survive_a_reload(journal, tmp_path):
    journal.push("decrypt", "1LqB", detail="case 1", payload={"mnemonic": "a b c"})
    reloaded = Journal(tmp_path / "journal.json")
    assert len(reloaded) == 1
    assert reloaded.at(1).payload == {"mnemonic": "a b c"}
    assert reloaded.at(1).detail == "case 1"


def test_a_corrupt_file_is_ignored(tmp_path):
    path = tmp_path / "journal.json"
    path.write_text("{not json", encoding="utf-8")
    assert len(Journal(path)) == 0


def test_a_non_list_file_is_ignored(tmp_path):
    path = tmp_path / "journal.json"
    path.write_text('{"entries": []}', encoding="utf-8")
    assert len(Journal(path)) == 0


def test_pinning_toggles_and_persists(journal, tmp_path):
    journal.push("search", "kept")
    assert journal.toggle_pin(1).pinned is True
    assert Journal(tmp_path / "journal.json").at(1).pinned is True
    assert journal.toggle_pin(1).pinned is False
    assert journal.toggle_pin(99) is None


def test_purge_keeps_pinned_entries(journal):
    journal.push("search", "throwaway")
    journal.push("case", "important")
    journal.toggle_pin(1)
    journal.clear(keep_pinned=True)
    assert [entry.title for entry in journal] == ["important"]
    journal.clear()
    assert len(journal) == 0


def test_filtering_by_tool(journal):
    journal.push("search", "a")
    journal.push("ledger", "b")
    journal.push("search", "c")
    assert [e.title for e in journal.by_tool("search")] == ["c", "a"]
    assert len(journal.by_tool(None)) == 3
    assert journal.by_tool("nothing") == []
    assert journal.counts() == {"search": 2, "ledger": 1}


def test_the_cap_drops_the_oldest_but_never_the_pinned(journal):
    journal.push("case", "pin me")
    journal.toggle_pin(1)
    for i in range(MAX_ENTRIES + 40):
        journal.push("search", f"query {i}")
    assert len(journal) <= MAX_ENTRIES
    assert any(entry.title == "pin me" for entry in journal)


def test_export_lists_every_entry(journal):
    journal.push("search", "ozo", detail="1 match")
    journal.push("case", "Case 1")
    text = journal.to_text()
    assert "INVESTIGATION JOURNAL" in text
    assert "Entries: 2" in text
    assert "ozo" in text and "Case 1" in text


@pytest.mark.parametrize("phrase,expected_start", [
    (SOLUTIONS[1], "abandon"),
    (UNRELATED_MNEMONIC, "absurd"),
])
def test_masking_keeps_only_the_ends(phrase, expected_start):
    masked = mask_mnemonic(phrase)
    words = phrase.split()
    assert masked.startswith(expected_start)
    assert words[-1] in masked
    assert "12 words" in masked
    # Nothing from the middle may survive.
    for word in words[1:-1]:
        assert f" {word} " not in masked


def test_masking_handles_junk_input():
    assert mask_mnemonic("") == "•••"
    assert mask_mnemonic("one two") == "•••"


def test_stored_file_is_plain_json(journal, tmp_path):
    journal.push("ledger", "1LqB", payload={"address": "1LqB"})
    data = json.loads((tmp_path / "journal.json").read_text(encoding="utf-8"))
    assert isinstance(data, list)
    assert data[0]["tool"] == "ledger"
    assert data[0]["payload"] == {"address": "1LqB"}


def test_an_unrecognised_phrase_leaves_no_usable_address_behind(tmp_path):
    """The phrase was masked; the address it derives to was not.

    It is not the phrase and does not lead back to it, but it is the wallet's
    public name — written out in full, anyone reading this file could pull the
    balance and the whole on-chain history off any explorer. The module's rule
    is that pasting a live wallet in leaves nothing usable on disk.
    """
    from enigma_terminal.crypto_engine import derive_wallet

    # Valid, and deliberately not one of the published vectors the eight cases
    # are built on, so the game has no reason to recognise it.
    phrase = UNRELATED_MNEMONIC
    address = derive_wallet(phrase).primary.address

    home = tmp_path / "home"
    home.mkdir()
    done = subprocess.run(
        [sys.executable, "-m", "enigma_terminal", "--speed", "0", "--no-color",
         "--lang", "en", "--offline", "-c", f"DECRYPT {phrase}"],
        cwd=Path(__file__).resolve().parent.parent,
        env={**os.environ, "ENIGMA_TERMINAL_HOME": str(home)},
        capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr

    written = (home / "journal.json").read_text(encoding="utf-8")
    assert phrase not in written, "the unrecognised phrase reached the journal"
    assert address not in written, "the address of an unrecognised phrase reached the journal"
    assert address[:6] in written, "the entry lost its handle on the derivation entirely"


def test_a_recognised_phrase_still_records_its_address_in_full(tmp_path):
    """Masking is for phrases the game does not know. A case answer is one it
    does, and its address is what RECALL and the ledger tools work from."""
    assert mask_address("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA") == "1LqBGS…eabA"
    assert mask_address("short") == "•••"


def test_a_save_is_never_seen_half_written(tmp_path, monkeypatch):
    """write_text truncated the target and then filled it.

    A crash, a full disk, or a second terminal reading in the gap saw an empty
    or half-built journal — and the game reads its own saves back on launch.
    Simulated here by failing the rename that completes the swap: what is on
    disk afterwards has to be the previous journal, entire.
    """
    from enigma_terminal import store

    path = tmp_path / "journal.json"
    journal = Journal(path)
    journal.push("decrypt", "first entry")
    before = path.read_text(encoding="utf-8")
    assert "first entry" in before

    def die_before_the_swap(src, dst):
        raise OSError("no space left on device")

    monkeypatch.setattr(store.os, "replace", die_before_the_swap)
    journal.entries.insert(0, journal.entries[0])
    assert journal.save() is False, "a failed save must report itself"

    assert path.read_text(encoding="utf-8") == before, \
        "a failed save left the journal in a state it was never in"
    assert Journal(path).entries[0].title == "first entry"
    leftovers = [p.name for p in tmp_path.iterdir() if p.name != "journal.json"]
    assert not leftovers, f"a failed save left temporary files behind: {leftovers}"


def test_progress_is_written_the_same_way(tmp_path, monkeypatch):
    """The two save files sit side by side and deserve the same guarantee."""
    from enigma_terminal import store
    from enigma_terminal.cases import Progress

    path = tmp_path / "progress.json"
    progress = Progress.load(path)
    progress.mark_solved(1)
    before = path.read_text(encoding="utf-8")

    def die_before_the_swap(src, dst):
        raise OSError("disk full")

    monkeypatch.setattr(store.os, "replace", die_before_the_swap)
    progress.mark_solved(2)

    assert path.read_text(encoding="utf-8") == before
    assert Progress.load(path).solved == {1}
    leftovers = [p.name for p in tmp_path.iterdir() if p.name != "progress.json"]
    assert not leftovers, f"a failed save left temporary files behind: {leftovers}"
