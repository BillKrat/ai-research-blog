import os
from contextlib import closing

import psycopg2
import pytest

from business.custom_presenter import CustomPresenter
from business.db_hello_presenter import DbHelloPresenter
from business.hello_presenter import HelloPresenter
from config.app_settings import AppSettings
from config.container import resolve_db_provider, resolve_llm_provider, resolve_presenter
from data.claude_provider import ClaudeProvider
from data.dci_provider import DCIProvider
from data.postgres_provider import PostgresProvider


class _FakeView:
    def show_result(self, text):
        pass

    def show_error(self, text):
        pass


def test_container_resolves_claude():
    provider = resolve_llm_provider(AppSettings(provider_name="claude"))
    assert isinstance(provider, ClaudeProvider)


def test_container_resolves_dci():
    provider = resolve_llm_provider(AppSettings(provider_name="dci"))
    assert isinstance(provider, DCIProvider)


def test_container_resolves_postgres_as_db_provider():
    provider = resolve_db_provider(AppSettings(provider_name="postgres"))
    assert isinstance(provider, PostgresProvider)


def test_container_llm_provider_name_is_case_insensitive():
    provider = resolve_llm_provider(AppSettings(provider_name="DCI"))
    assert isinstance(provider, DCIProvider)


def test_container_rejects_unknown_llm_provider():
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        resolve_llm_provider(AppSettings(provider_name="postgres"))


def test_container_rejects_unknown_db_provider():
    with pytest.raises(ValueError, match="Unknown DB provider"):
        resolve_db_provider(AppSettings(provider_name="claude"))


def test_resolve_presenter_uses_hello_presenter_for_claude():
    presenter = resolve_presenter(AppSettings(provider_name="claude"), _FakeView())
    assert isinstance(presenter, HelloPresenter)
    assert not isinstance(presenter, CustomPresenter)


def test_resolve_presenter_uses_custom_presenter_when_requested():
    settings = AppSettings(provider_name="claude", use_custom_presenter=True)
    presenter = resolve_presenter(settings, _FakeView())
    assert isinstance(presenter, CustomPresenter)


def test_resolve_presenter_uses_db_hello_presenter_for_postgres():
    presenter = resolve_presenter(AppSettings(provider_name="postgres"), _FakeView())
    assert isinstance(presenter, DbHelloPresenter)


def test_postgres_provider_uses_environment_connection_string(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")

    provider = PostgresProvider()

    assert provider.conn_string == "postgresql://user:pass@localhost:5432/testdb"


def test_container_uses_fallback_claude_provider_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_API_KEY", raising=False)

    provider = resolve_llm_provider(AppSettings(provider_name="claude"))

    assert isinstance(provider, ClaudeProvider)
    assert provider.client is None


def test_postgres_provider_can_select_from_triple_store():
    conn_string = os.environ.get("DATABASE_URL")
    if not conn_string:
        pytest.skip("DATABASE_URL is not configured")

    try:
        with closing(psycopg2.connect(conn_string)) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT subject, predicate, object_value FROM triple_store "
                    "WHERE subject IN ('unit-test-1', 'unit-test-2') ORDER BY subject"
                )
                rows = cur.fetchall()
    except psycopg2.Error as exc:
        pytest.skip(f"Postgres integration test skipped: {exc}")

    # Deliberately outside the try/except above: a real mismatch here is a
    # genuine test failure, not a reason to skip.
    assert rows == [
        ("unit-test-1", "kind", "fixture"),
        ("unit-test-2", "kind", "fixture"),
    ]
