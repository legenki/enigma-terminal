"""Explorer adapters and provider fallback, with the network stubbed out."""

import json
import urllib.error

import pytest

from neon_terminal import chain

BLOCKSTREAM_BODY = {
    "address": "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA",
    "chain_stats": {
        "funded_txo_count": 24, "funded_txo_sum": 1150402,
        "spent_txo_count": 20, "spent_txo_sum": 1000000, "tx_count": 48,
    },
    "mempool_stats": {
        "funded_txo_count": 1, "funded_txo_sum": 5000,
        "spent_txo_count": 0, "spent_txo_sum": 0, "tx_count": 1,
    },
}

BLOCKCHAIN_BODY = {
    "address": "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA",
    "n_tx": 48, "n_unredeemed": 4,
    "total_received": 1150402, "total_sent": 1000000, "final_balance": 150402,
}


@pytest.fixture
def client():
    return chain.ChainClient(timeout=1)


def test_satoshi_formatting_has_eight_decimals():
    assert chain.AddressStats.btc(0) == "0.00000000"
    assert chain.AddressStats.btc(1) == "0.00000001"
    assert chain.AddressStats.btc(100_000_000) == "1.00000000"
    assert chain.AddressStats.btc(700_000_538_287) == "7000.00538287"
    assert chain.AddressStats.btc(-150_402) == "-0.00150402"


def test_esplora_response_is_normalised(client, monkeypatch):
    monkeypatch.setattr(chain, "_get_json", lambda url, timeout: BLOCKSTREAM_BODY)
    stats = client.address_stats("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA")
    assert stats.provider == "BLOCKSTREAM"
    assert stats.confirmed_sats == 150402
    assert stats.unconfirmed_sats == 5000
    assert stats.total_received_sats == 1150402
    assert stats.tx_count == 49          # confirmed plus mempool
    assert stats.utxo_count == 4
    assert stats.confirmed_btc == "0.00150402"
    assert stats.is_touched


def test_blockchain_info_response_is_normalised(monkeypatch):
    client = chain.ChainClient(preferred="blockchain", timeout=1)
    monkeypatch.setattr(chain, "_get_json", lambda url, timeout: BLOCKCHAIN_BODY)
    stats = client.address_stats("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA")
    assert stats.provider == "BLOCKCHAIN.COM"
    assert stats.confirmed_sats == 150402
    assert stats.tx_count == 48


def test_untouched_address_is_recognised(client, monkeypatch):
    body = json.loads(json.dumps(BLOCKSTREAM_BODY))
    body["chain_stats"] = dict.fromkeys(body["chain_stats"], 0)
    body["mempool_stats"] = dict.fromkeys(body["mempool_stats"], 0)
    monkeypatch.setattr(chain, "_get_json", lambda url, timeout: body)
    assert not client.address_stats("1Lq...").is_touched


def test_a_failing_provider_falls_through_to_the_next(client, monkeypatch):
    seen = []

    def fake_get(url, timeout):
        seen.append(url)
        if "blockstream" in url:
            raise urllib.error.HTTPError(url, 429, "Too Many Requests", {}, None)
        return BLOCKSTREAM_BODY

    monkeypatch.setattr(chain, "_get_json", fake_get)
    stats = client.address_stats("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA")
    assert stats.provider == "MEMPOOL.SPACE"        # the fallback answered
    assert len(seen) == 2 and "mempool.space" in seen[1]


def test_every_provider_failing_raises_chain_error(client, monkeypatch):
    def always_fail(url, timeout):
        raise urllib.error.URLError("no route to host")

    monkeypatch.setattr(chain, "_get_json", always_fail)
    with pytest.raises(chain.ChainError) as excinfo:
        client.address_stats("1Lq...")
    for name in ("BLOCKSTREAM", "MEMPOOL.SPACE", "BLOCKCHAIN.COM"):
        assert name in str(excinfo.value)


def test_malformed_json_is_treated_as_a_provider_failure(client, monkeypatch):
    monkeypatch.setattr(chain, "_get_json", lambda url, timeout: {"unexpected": True})
    with pytest.raises(chain.ChainError) as excinfo:
        client.address_stats("1Lq...")
    assert "malformed response" in str(excinfo.value)


def test_offline_mode_never_touches_the_network(monkeypatch):
    def explode(url, timeout):  # pragma: no cover - must never run
        raise AssertionError("offline mode made a request")

    monkeypatch.setattr(chain, "_get_json", explode)
    client = chain.ChainClient(offline=True)
    with pytest.raises(chain.ChainError, match="OFFLINE MODE ACTIVE"):
        client.address_stats("1Lq...")
    with pytest.raises(chain.ChainError, match="OFFLINE MODE ACTIVE"):
        client.transactions("1Lq...")


def test_transactions_are_normalised(client, monkeypatch):
    monkeypatch.setattr(chain, "_get_json", lambda url, timeout: [
        {"txid": "aa" * 32, "status": {"confirmed": True, "block_height": 900000,
                                       "block_time": 1700000000}},
        {"txid": "bb" * 32, "status": {"confirmed": False}},
    ])
    txs = client.transactions("1Lq...", limit=5)
    assert [tx.confirmed for tx in txs] == [True, False]
    assert txs[0].block_height == 900000
    assert txs[1].block_height is None


def test_preferred_provider_leads_the_order():
    assert chain.ChainClient(preferred="mempool").order[0] == "mempool"
    assert chain.ChainClient(preferred="nonsense").order == chain.DEFAULT_ORDER
    assert chain.ChainClient().node_name == "BLOCKSTREAM"


def test_explorer_urls_point_at_the_active_provider():
    assert "blockstream.info/address/" in chain.ChainClient().explorer_url("1Lq")
    assert "mempool.space/address/" in chain.ChainClient(preferred="mempool").explorer_url("1Lq")


def test_both_http_backends_are_wired(monkeypatch):
    """The requests path and the urllib fallback must behave identically."""
    calls = []

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            calls.append("requests")

        def json(self):
            return BLOCKSTREAM_BODY

    class FakeRequests:
        RequestException = Exception

        @staticmethod
        def get(url, headers=None, timeout=None):
            return FakeResponse()

    monkeypatch.setattr(chain, "requests", FakeRequests)
    assert chain.ChainClient().address_stats("1Lq...").confirmed_sats == 150402
    assert calls == ["requests"]

    class FakeUrlopen:
        def __enter__(self):
            calls.append("urllib")
            return self

        def __exit__(self, *args):
            return False

        @staticmethod
        def read():
            return json.dumps(BLOCKSTREAM_BODY).encode()

    monkeypatch.setattr(chain, "requests", None)
    monkeypatch.setattr(chain.urllib.request, "urlopen", lambda *a, **k: FakeUrlopen())
    assert chain.ChainClient().address_stats("1Lq...").confirmed_sats == 150402
    assert calls == ["requests", "urllib"]
