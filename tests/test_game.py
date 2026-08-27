"""Command-loop behaviour, exercised without touching the network."""

import pytest

from enigma_terminal.cases import LANGUAGES, Campaign, Progress
from enigma_terminal.chain import ChainClient
from enigma_terminal.game import REAL_WALLET, TEXT, Session, dispatch
from enigma_terminal.journal import Journal
from enigma_terminal.ui import Screen

from .answers import LEGACY_ADDRESSES, SOLUTIONS, UNRELATED_MNEMONIC


@pytest.fixture
def session(tmp_path):
    return Session(
        campaign=Campaign(),
        progress=Progress.load(tmp_path / "progress.json"),
        screen=Screen(colour=False, speed=0),
        chain=ChainClient(offline=True),
        journal=Journal(tmp_path / "journal.json"),
        lang="en",
    )


def run(session, *commands):
    for command in commands:
        dispatch(session, command)


def test_unknown_command_is_reported(session, capsys):
    run(session, "TELEPORT")
    assert "UNKNOWN COMMAND: TELEPORT" in capsys.readouterr().out


def test_blank_input_is_ignored(session, capsys):
    run(session, "   ")
    assert capsys.readouterr().out == ""


def test_help_lists_the_core_commands(session, capsys):
    run(session, "HELP")
    out = capsys.readouterr().out
    for command in ("DECRYPT", "SYNC_LEDGER", "ENTROPY", "CASES", "HINT"):
        assert command in out


def test_cases_marks_the_finale_locked(session, capsys):
    run(session, "CASES")
    out = capsys.readouterr().out
    assert "[LOCKED] 008" in out
    assert "0/8 CLOSED" in out


def test_opening_a_locked_case_is_refused(session, capsys):
    run(session, "OPEN 8")
    assert "CASE LOCKED" in capsys.readouterr().out


def test_open_shows_brief_evidence_and_clues(session, capsys):
    run(session, "OPEN 1")
    out = capsys.readouterr().out
    assert "CASE 01 // ZERO VAULT" in out
    assert "DECODING TABLE" in out
    assert session.active.id == 1


def test_hints_are_spent_one_at_a_time(session, capsys):
    run(session, "OPEN 2", "HINT", "HINT", "HINT", "HINT")
    out = capsys.readouterr().out
    assert "[HINT 1/3]" in out and "[HINT 3/3]" in out
    assert "NO HINTS LEFT" in out
    assert session.progress.hints_used[2] == 3


def test_entropy_command_rebuilds_a_mnemonic(session, capsys):
    run(session, "ENTROPY 7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f")
    assert SOLUTIONS[2] in capsys.readouterr().out


def test_entropy_rejects_non_hex(session, capsys):
    run(session, "ENTROPY zzzz")
    assert "ENTROPY MUST BE HEXADECIMAL" in capsys.readouterr().out


def test_entropy_rejects_wrong_length(session, capsys):
    run(session, "ENTROPY 00ff")
    assert "ENTROPY MUST BE 16, 20, 24, 28 OR 32 BYTES" in capsys.readouterr().out


def test_decrypt_prints_the_derivation_grid(session, capsys):
    run(session, f"DECRYPT {SOLUTIONS[1]}")
    out = capsys.readouterr().out
    assert "MNEMONIC CHECKSUM VALID" in out
    assert "PATH m/44'/0'/0'/0/0 (Legacy P2PKH)" in out
    assert "PATH m/49'/0'/0'/0/0 (Nested SegWit)" in out
    assert "PATH m/84'/0'/0'/0/0 (Native SegWit)" in out
    assert LEGACY_ADDRESSES[1] in out


def test_decrypt_reports_a_broken_checksum(session, capsys):
    run(session, "DECRYPT " + "abandon " * 12)
    out = capsys.readouterr().out
    assert "[FATAL] MNEMONIC CHECKSUM INVALID. DECRYPTION FAILED." in out
    assert session.wallet is None


def test_decrypt_reports_a_word_outside_the_dictionary(session, capsys):
    run(session, "DECRYPT " + "abandon " * 11 + "bitcoin")
    assert "WORD NOT IN BIP-39 DICTIONARY: bitcoin" in capsys.readouterr().out


def test_solving_the_active_case_closes_it(session, capsys):
    run(session, "OPEN 1", f"DECRYPT {SOLUTIONS[1]}")
    out = capsys.readouterr().out
    assert "CASE 1 CLOSED" in out
    assert 1 in session.progress.solved


def test_right_seed_wrong_case_is_flagged(session, capsys):
    run(session, "OPEN 1", f"DECRYPT {SOLUTIONS[2]}")
    out = capsys.readouterr().out
    assert "CASE 2 CLOSED" in out  # it still belongs to a case, so it counts
    assert session.progress.solved == {2}


def test_a_valid_but_unrelated_seed_closes_nothing(session, capsys):
    run(session, "OPEN 1", f"DECRYPT {UNRELATED_MNEMONIC}")
    out = capsys.readouterr().out
    assert "NOT THE KEY TO CASE 1" in out
    assert session.progress.solved == set()


def test_finale_unlocks_only_after_the_other_seven(session, capsys):
    for case_id in range(1, 8):
        run(session, f"DECRYPT {SOLUTIONS[case_id]}")
    capsys.readouterr()
    run(session, "OPEN 8", f"DECRYPT {SOLUTIONS[8]}")
    out = capsys.readouterr().out
    assert "CASE 8 CLOSED" in out
    assert "ALL EIGHT CASES CLOSED" in out


def test_solving_the_finale_early_is_refused(session, capsys):
    run(session, f"DECRYPT {SOLUTIONS[8]}")
    out = capsys.readouterr().out
    assert "THIS SEED BELONGS TO CASE 8" in out
    assert session.progress.solved == set()


def test_offline_mode_reports_a_dead_link(session, capsys):
    run(session, f"DECRYPT {SOLUTIONS[1]}", "SYNC_LEDGER")
    out = capsys.readouterr().out
    assert "NETWORK LINK DOWN" in out
    assert "OFFLINE MODE ACTIVE" in out


def test_sync_without_a_seed_asks_for_one(session, capsys):
    run(session, "SYNC_LEDGER")
    assert "NO SEED LOADED" in capsys.readouterr().out


def test_wordlist_tools(session, capsys):
    run(session, "WORD 1", "INDEX zoo", "SEARCH ozo", "WORD 9999", "INDEX notaword")
    out = capsys.readouterr().out
    assert "abandon" in out
    assert "2048" in out
    assert "ozone" in out
    assert "BIP-39 INDEX MUST BE IN 1..2048" in out
    assert "IS NOT IN THE BIP-39 DICTIONARY" in out


def test_provider_can_be_switched(session, capsys):
    run(session, "PROVIDER mempool", "STATUS")
    out = capsys.readouterr().out
    assert "PRIMARY NODE: MEMPOOL.SPACE" in out
    assert session.chain.order[0] == "mempool"


def test_unknown_provider_is_refused(session, capsys):
    run(session, "PROVIDER hyperledger")
    assert "UNKNOWN PROVIDER" in capsys.readouterr().out


def test_language_switch_changes_the_narrative(session, capsys):
    run(session, "LANG ru", "OPEN 1")
    out = capsys.readouterr().out
    assert "НУЛЕВОЕ ХРАНИЛИЩЕ" in out
    run(session, "LANG de")
    assert "USAGE: LANG EN | LANG ES | LANG PT | LANG RU" in capsys.readouterr().out


def test_reset_clears_progress(session, capsys):
    run(session, f"DECRYPT {SOLUTIONS[1]}", "RESET", "CASES")
    assert "0/8 CLOSED" in capsys.readouterr().out
    assert session.progress.solved == set()


def test_exit_stops_the_loop(session):
    run(session, "EXIT")
    assert session.running is False


def test_sweep_without_a_seed_asks_for_one(session, capsys):
    run(session, "SWEEP")
    assert "NO SEED LOADED" in capsys.readouterr().out


def test_sweep_reports_every_derived_path(session, capsys, monkeypatch):
    from enigma_terminal import chain

    stats = {
        "1PpJDjhMCChYbnonB1Ri3cC4PAiU2Ss6xC": (0, 0),
        "3ETvcnQcuGGRG4aZmTe9UmoGQKEeqYEkcw": (0, 0),
        "bc1qp9cfwk986xqjwstvh95pyy8pm599jm6qfe8he5": (4, 181879),
    }

    def fake_stats(self, address):
        tx_count, received = stats[address]
        return chain.AddressStats(
            address=address, confirmed_sats=0, unconfirmed_sats=0,
            total_received_sats=received, total_sent_sats=received,
            tx_count=tx_count, utxo_count=0, provider="TESTNODE",
        )

    monkeypatch.setattr(chain.ChainClient, "address_stats", fake_stats)
    session.chain.offline = False
    run(session, f"DECRYPT {SOLUTIONS[6]}", "SWEEP")
    out = capsys.readouterr().out
    for address in stats:
        assert address in out
    assert "0.00181879" in out
    assert "1/3 PATHS CARRY ON-CHAIN HISTORY" in out


def test_sweep_says_so_when_a_seed_was_never_used(session, capsys, monkeypatch):
    from enigma_terminal import chain

    monkeypatch.setattr(
        chain.ChainClient, "address_stats",
        lambda self, address: chain.AddressStats(
            address=address, confirmed_sats=0, unconfirmed_sats=0,
            total_received_sats=0, total_sent_sats=0, tx_count=0,
            utxo_count=0, provider="TESTNODE",
        ),
    )
    session.chain.offline = False
    run(session, f"DECRYPT {SOLUTIONS[8]}", "SWEEP")
    assert "NO PATH OF THIS SEED HAS EVER BEEN USED" in capsys.readouterr().out


def test_sweep_survives_one_unreachable_provider(session, capsys, monkeypatch):
    from enigma_terminal import chain

    def flaky(self, address):
        if address.startswith("bc1"):
            raise chain.ChainError("all providers down")
        return chain.AddressStats(
            address=address, confirmed_sats=0, unconfirmed_sats=0,
            total_received_sats=1000, total_sent_sats=0, tx_count=1,
            utxo_count=1, provider="TESTNODE",
        )

    monkeypatch.setattr(chain.ChainClient, "address_stats", flaky)
    session.chain.offline = False
    run(session, f"DECRYPT {SOLUTIONS[1]}", "SWEEP")
    out = capsys.readouterr().out
    assert "UNREACHABLE" in out
    assert "2/3 PATHS CARRY ON-CHAIN HISTORY" in out


# --- seed tools in the command loop ---------------------------------------

def test_random_prints_a_usable_phrase(session, capsys):
    run(session, "RANDOM")
    out = capsys.readouterr().out
    assert "DRAWING FROM THE OS CRYPTOGRAPHIC RANDOM SOURCE" in out
    assert "THIS IS A REAL WALLET" in out
    mnemonic = next(
        line.split(":", 1)[1].strip() for line in out.splitlines()
        if line.startswith("MNEMONIC")
    )
    assert len(mnemonic.split()) == 12
    run(session, f"DECRYPT {mnemonic}")
    assert "MNEMONIC CHECKSUM VALID" in capsys.readouterr().out


def test_random_honours_a_word_count(session, capsys):
    run(session, "RANDOM 24")
    out = capsys.readouterr().out
    mnemonic = next(
        line.split(":", 1)[1].strip() for line in out.splitlines()
        if line.startswith("MNEMONIC")
    )
    assert len(mnemonic.split()) == 24


def test_random_rejects_a_bad_word_count(session, capsys):
    run(session, "RANDOM 13", "RANDOM twelve")
    out = capsys.readouterr().out
    assert "WORD COUNT 13 INVALID" in out
    assert "USAGE: RANDOM" in out


def test_complete_recovers_a_missing_word(session, capsys):
    phrase = " ".join(SOLUTIONS[1].split()[:-1] + ["?"])
    run(session, f"COMPLETE {phrase}")
    out = capsys.readouterr().out
    assert "POSITION 12: 128 WORD(S) SATISFY THE CHECKSUM" in out
    assert "about" in out
    assert "COMPLETES THE KEY TO CASE 1" in out


def test_complete_refuses_more_than_one_blank(session, capsys):
    words = SOLUTIONS[1].split()
    words[0] = words[11] = "?"
    run(session, "COMPLETE " + " ".join(words))
    assert "THIS TOOL RESOLVES EXACTLY ONE" in capsys.readouterr().out


def test_complete_without_arguments_explains_itself(session, capsys):
    run(session, "COMPLETE")
    assert "USAGE: COMPLETE" in capsys.readouterr().out


def test_archive_searches_the_case_files(session, capsys):
    run(session, "ARCHIVE churn")
    out = capsys.readouterr().out
    assert "CASE 06" in out
    assert "1 CASE(S) MATCHED" in out


def test_archive_hides_epilogues_until_a_case_is_closed(session, capsys):
    """'mocking' appears only in case 4's epilogue, so it must stay unsearchable."""
    run(session, "ARCHIVE mocking")
    assert "NOTHING IN THE ARCHIVE MATCHES" in capsys.readouterr().out

    run(session, f"DECRYPT {SOLUTIONS[4]}")
    capsys.readouterr()
    run(session, "ARCHIVE mocking")
    assert "CASE 04" in capsys.readouterr().out


def test_archive_without_arguments_explains_itself(session, capsys):
    run(session, "ARCHIVE")
    assert "USAGE: ARCHIVE" in capsys.readouterr().out


# --- the investigation journal --------------------------------------------

def test_every_tool_writes_to_the_journal(session, capsys, monkeypatch):
    """Every tool in TOOLS must leave a trace — a silent one is a hole in the record."""
    from enigma_terminal import chain
    from enigma_terminal.journal import TOOLS

    monkeypatch.setattr(
        chain.ChainClient, "address_stats",
        lambda self, address: chain.AddressStats(
            address=address, confirmed_sats=0, unconfirmed_sats=0,
            total_received_sats=1000, total_sent_sats=0, tx_count=2,
            utxo_count=1, provider="TESTNODE",
        ),
    )
    monkeypatch.setattr(
        chain.ChainClient, "transactions",
        lambda self, address, limit=5: [
            chain.Transaction(txid="aa" * 32, confirmed=True, block_height=1,
                              block_time=1)
        ],
    )
    session.chain.offline = False

    missing_word = " ".join(SOLUTIONS[5].split()[:-1] + ["?"])
    run(session,
        "SEARCH ozo",
        "ARCHIVE churn",
        "RANDOM 12",
        f"COMPLETE {missing_word}",
        f"DECRYPT {SOLUTIONS[5]}",
        "SYNC_LEDGER",
        "SWEEP",
        "TXLOG",
        "OPEN 1",
        "HINT")
    capsys.readouterr()

    tools = {entry.tool for entry in session.journal}
    unrecorded = set(TOOLS) - tools
    assert not unrecorded, f"these tools left no journal entry: {sorted(unrecorded)}"


def test_journal_lists_newest_first(session, capsys):
    run(session, "SEARCH ozo", "SEARCH zeb", "JOURNAL")
    out = capsys.readouterr().out
    assert "INVESTIGATION JOURNAL" in out
    positions = [line for line in out.splitlines() if line.strip().startswith(("1.", "2."))]
    assert "zeb" in positions[0]
    assert "ozo" in positions[1]


def test_journal_filters_by_tool(session, capsys):
    run(session, "SEARCH ozo", "ARCHIVE churn", "JOURNAL search")
    out = capsys.readouterr().out
    assert "ozo" in out
    assert "churn" not in out


def test_journal_rejects_an_unknown_tool(session, capsys):
    run(session, "JOURNAL teleport")
    assert "UNKNOWN TOOL" in capsys.readouterr().out


def test_empty_journal_says_so(session, capsys):
    run(session, "JOURNAL")
    assert "JOURNAL EMPTY" in capsys.readouterr().out


def test_recall_replays_a_search(session, capsys):
    run(session, "SEARCH zeb")
    capsys.readouterr()
    run(session, "RECALL 1")
    out = capsys.readouterr().out
    assert "REPLAYING #1" in out
    assert "zebra" in out


def test_recall_replays_a_case_answer(session, capsys):
    run(session, f"DECRYPT {SOLUTIONS[4]}")
    capsys.readouterr()
    run(session, "JOURNAL")
    listing = capsys.readouterr().out
    position = next(
        int(line.split(".")[0]) for line in listing.splitlines()
        if "DECRYPT" in line
    )
    run(session, f"RECALL {position}")
    assert "MNEMONIC CHECKSUM VALID" in capsys.readouterr().out


def test_recall_refuses_an_unstored_phrase(session, capsys):
    run(session, f"DECRYPT {UNRELATED_MNEMONIC}")
    capsys.readouterr()
    run(session, "RECALL 1")
    out = capsys.readouterr().out
    assert "PHRASE WAS NOT STORED" in out
    assert "CHECKSUM VALID" not in out


def test_unknown_phrases_never_reach_the_journal_in_full(session):
    run(session, f"DECRYPT {UNRELATED_MNEMONIC}")
    entry = session.journal.at(1)
    assert entry.payload == {"masked": True}
    assert UNRELATED_MNEMONIC not in entry.detail
    for word in UNRELATED_MNEMONIC.split()[1:-1]:
        assert word not in entry.detail
    # And nothing else in the file carries it either.
    assert UNRELATED_MNEMONIC not in session.journal.to_text()


def test_case_answers_are_stored_in_full(session):
    run(session, f"DECRYPT {SOLUTIONS[3]}")
    entry = next(e for e in session.journal if e.tool == "decrypt")
    assert entry.payload["mnemonic"] == SOLUTIONS[3]


def test_generated_phrases_are_stored_in_full(session, capsys):
    run(session, "RANDOM 12")
    capsys.readouterr()
    entry = next(e for e in session.journal if e.tool == "random")
    assert len(entry.payload["mnemonic"].split()) == 12


def test_recall_rejects_a_bad_position(session, capsys):
    run(session, "SEARCH ozo")
    capsys.readouterr()
    run(session, "RECALL 99", "RECALL nope")
    out = capsys.readouterr().out
    assert "NO JOURNAL ENTRY 99" in out
    assert "USAGE: RECALL" in out


def test_pin_protects_an_entry_from_purge(session, capsys):
    run(session, "SEARCH ozo", "SEARCH zeb", "PIN 1", "PURGE")
    capsys.readouterr()
    assert [entry.title for entry in session.journal] == ["zeb"]
    run(session, "PURGE all")
    assert len(session.journal) == 0


def test_pin_reports_a_bad_position(session, capsys):
    run(session, "PIN 5", "PIN x")
    out = capsys.readouterr().out
    assert "NO JOURNAL ENTRY 5" in out
    assert "USAGE: PIN" in out


def test_status_reports_the_journal_size(session, capsys):
    run(session, "SEARCH ozo", "STATUS")
    assert "JOURNAL" in capsys.readouterr().out


# --- the desk: contracts taken off the board ------------------------------

CONTRACT_ID = 201        # SALAR, act 1, first of its client's thirty-two


def test_the_desk_starts_as_the_campaign_alone(session, capsys):
    run(session, "CASES")
    out = capsys.readouterr().out
    assert "0/8 CLOSED" in out
    assert session.progress.taken == set()


def test_opening_a_contract_takes_it_onto_the_desk(session, capsys):
    run(session, f"OPEN {CONTRACT_ID}")
    out = capsys.readouterr().out
    assert "TAKEN INTO WORK" in out
    assert CONTRACT_ID in session.progress.taken

    run(session, "CASES")
    listing = capsys.readouterr().out
    assert str(CONTRACT_ID) in listing
    assert "0/9 CLOSED" in listing


def test_taking_the_same_contract_twice_is_quiet(session, capsys):
    run(session, f"OPEN {CONTRACT_ID}")
    capsys.readouterr()
    run(session, f"OPEN {CONTRACT_ID}")
    assert "TAKEN INTO WORK" not in capsys.readouterr().out
    assert session.progress.taken == {CONTRACT_ID}


def test_taking_a_contract_is_journalled(session, capsys):
    run(session, f"OPEN {CONTRACT_ID}")
    capsys.readouterr()
    entry = session.journal.at(1)
    assert entry.tool == "case"
    assert "Taken" in entry.title
    assert entry.payload["caseId"] == CONTRACT_ID


def test_campaign_cases_are_never_taken(session, capsys):
    run(session, "OPEN 1")
    assert "TAKEN INTO WORK" not in capsys.readouterr().out
    assert session.progress.taken == set()


def test_a_taken_contract_can_go_back(session, capsys):
    run(session, f"OPEN {CONTRACT_ID}", f"DROP {CONTRACT_ID}")
    out = capsys.readouterr().out
    assert "RETURNED TO THE BOARD" in out
    assert session.progress.taken == set()
    assert session.active is None


def test_dropping_something_not_on_the_desk_is_refused(session, capsys):
    run(session, f"DROP {CONTRACT_ID}", "DROP nope")
    out = capsys.readouterr().out
    assert "IS NOT ON THE DESK" in out
    assert "USAGE: DROP" in out


def test_a_closed_contract_stays_on_the_desk(session, capsys):
    from tests.test_contracts import solve

    contract = next(c for c in session.campaign.contracts if c.id == CONTRACT_ID)
    answer = solve(contract.raw)
    run(session, f"DECRYPT {answer}")
    capsys.readouterr()
    assert CONTRACT_ID in session.progress.solved

    run(session, f"DROP {CONTRACT_ID}", "CASES")
    out = capsys.readouterr().out
    assert "CLOSED CASES STAY ON THE DESK" in out
    assert str(CONTRACT_ID) in out


def test_solving_without_opening_still_puts_it_on_the_desk(session, capsys):
    """A phrase pasted straight into DECRYPT closes a case just the same."""
    from tests.test_contracts import solve

    contract = next(c for c in session.campaign.contracts if c.id == CONTRACT_ID)
    run(session, f"DECRYPT {solve(contract.raw)}", "CASES")
    out = capsys.readouterr().out
    assert str(CONTRACT_ID) in out
    assert "1/9 CLOSED" in out


def test_clients_lists_the_roster(session, capsys):
    run(session, "CLIENTS")
    out = capsys.readouterr().out
    assert "EIGHT EMPLOYERS" in out
    assert "SALAR" in out
    assert "0/32" in out


def test_board_shows_one_employer(session, capsys):
    run(session, "BOARD salar")
    out = capsys.readouterr().out
    assert "201" in out
    assert out.count("[  OPEN]") + out.count("[LOCKED]") == 32


def test_board_rejects_an_unknown_client(session, capsys):
    run(session, "BOARD arasaka", "BOARD")
    out = capsys.readouterr().out
    assert "NO CLIENT 'ARASAKA'" in out
    assert "USAGE: BOARD" in out


def test_the_campaign_ending_needs_the_campaign(session, capsys):
    """Closing eight contracts must not trigger ORACLE's finale."""
    from tests.test_contracts import solve

    eight = [c for c in session.campaign.contracts if c.act == 1][:8]
    for contract in eight:
        run(session, f"DECRYPT {solve(contract.raw)}")
    out = capsys.readouterr().out
    assert "ALL EIGHT CASES CLOSED" not in out
    assert len(session.progress.solved) >= 8


# --- languages -------------------------------------------------------------

def test_lang_command_accepts_every_language_the_data_carries(session):
    """--lang es worked while LANG ES was rejected, so a player who started in
    Spanish could never get back to it from inside the game."""
    for code in LANGUAGES:
        run(session, f"LANG {code.upper()}")
        assert session.lang == code, f"LANG {code.upper()} was refused"

    run(session, "LANG ZZ")
    assert session.lang == LANGUAGES[-1], "an unknown code changed the language"


def test_every_ui_string_is_translated():
    """A key missing es or pt renders English mid-sentence."""
    for key, bundle in TEXT.items():
        missing = [lang for lang in LANGUAGES if not bundle.get(lang)]
        assert not missing, f"TEXT[{key!r}] has no {missing}"


def test_the_real_wallet_warning_is_never_left_in_english():
    for lang in LANGUAGES:
        assert REAL_WALLET.get(lang), f"no {lang} real-wallet warning"
