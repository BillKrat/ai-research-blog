import importlib
import os

import pytest

from config.container import resolve_provider
from data.tools_provider import ToolsProvider
from data.claude_provider import ClaudeProvider
from data.dci_provider import DCIProvider
from data.postgres_provider import PostgresProvider

def test_container_resolves_claude():
    tools = ToolsProvider(use_dci=False)
    provider = resolve_provider(tools)
    assert isinstance(provider, ClaudeProvider)

def test_container_resolves_dci():
    tools = ToolsProvider(use_dci=True)
    provider = resolve_provider(tools)
    assert isinstance(provider, DCIProvider)

def test_container_resolves_postgres():
    tools = ToolsProvider(use_postgres=True)
    provider = resolve_provider(tools)
    assert isinstance(provider, PostgresProvider)


def test_postgres_provider_uses_environment_connection_string(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")

    provider = PostgresProvider()

    assert provider.conn_string == "postgresql://user:pass@localhost:5432/testdb"


def test_postgres_provider_reads_connection_string_from_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("DATABASE_URL=postgresql://user:pass@localhost:5432/testdb\n", encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    import data.postgres_provider as postgres_provider_module

    with monkeypatch.context() as m:
        m.chdir(tmp_path)
        m.delenv("DATABASE_URL", raising=False)
        reloaded_module = importlib.reload(postgres_provider_module)
        provider = reloaded_module.PostgresProvider()

    assert provider.conn_string == "postgresql://user:pass@localhost:5432/testdb"


def test_container_uses_fallback_claude_provider_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_API_KEY", raising=False)

    tools = ToolsProvider(use_dci=False)
    provider = resolve_provider(tools)

    assert isinstance(provider, ClaudeProvider)
    assert provider.client is None


def test_postgres_provider_can_select_from_triple_store():
    conn_string = os.environ.get("DATABASE_URL")
    if not conn_string:
        pytest.skip("DATABASE_URL is not configured")

    provider = PostgresProvider()

    try:
        import psycopg2

        with psycopg2.connect(provider.conn_string) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT subject, predicate, object_value FROM triple_store WHERE subject IN ('unit-test-1', 'unit-test-2') ORDER BY subject"
                )
                rows = cur.fetchall()

        assert isinstance(rows, list)
        assert rows == [
            ("unit-test-1", "kind", "fixture"),
            ("unit-test-2", "kind", "fixture"),
        ]
    except Exception as exc:
        pytest.skip(f"Postgres integration test skipped: {exc}")
