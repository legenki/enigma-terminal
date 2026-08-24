import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def vectors():
    """Reference vectors generated from `mnemonic` and `bip-utils`."""
    data = json.loads((ROOT / "data" / "test_vectors.json").read_text(encoding="utf-8"))
    return data["vectors"]


@pytest.fixture(scope="session")
def campaign_data():
    return json.loads((ROOT / "data" / "cases.json").read_text(encoding="utf-8"))
