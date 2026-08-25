"""The investigation journal, and the rule that keeps unknown seeds off disk."""

import json

import pytest

from enigma_terminal.journal import MAX_ENTRIES, Journal, mask_mnemonic

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
