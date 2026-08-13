import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from shared import environment as env  # noqa: E402

# Load .env once for the whole test session - this is the one place test
# code is responsible for bootstrapping the environment; application
# modules never do it as an import-time side effect.
env.load()


@pytest.fixture(autouse=True)
def _isolated_oxigraph_store_path(monkeypatch):
    """Give every test a clean slate for OXIGRAPH_STORE_PATH.

    Once a developer sets a real local on-disk path (see
    .env.example's OXIGRAPH_STORE_PATH), env.load() above pulls it
    into the whole test session - without this, every test in the
    suite that constructs a bare OxigraphTripleRepository() (most of
    test_oxigraph_triple_repository.py, plus test_container.py's
    default-provider tests) would open the *same* on-disk RocksDB
    store as a side effect of running the test suite, and collide
    with each other's file lock the moment two tests hold it open at
    once - the same lock behavior documented on
    OxigraphTripleRepository itself. Tests that want to exercise the
    real env-var-reading behavior still call
    monkeypatch.setenv("OXIGRAPH_STORE_PATH", ...) themselves, which
    simply overrides this default for that one test.
    """
    monkeypatch.delenv("OXIGRAPH_STORE_PATH", raising=False)
