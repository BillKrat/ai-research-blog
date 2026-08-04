import os
from contextlib import closing
from dataclasses import dataclass

import psycopg2
import pytest

from blogresearch.presenters.custom_presenter import CustomPresenter
from blogresearch.presenters.db_hello_presenter import DbHelloPresenter
from blogresearch.presenters.hello_presenter import HelloPresenter
from blogresearch.config.app_settings import AppSettings
from blogresearch.config.registrations import (
    build_container,
    resolve_db_provider,
    resolve_llm_provider,
    resolve_presenter,
)
from blogresearch.providers.claude_provider import ClaudeProvider
from blogresearch.providers.dci_provider import DCIProvider
from blogresearch.providers.postgres_provider import PostgresProvider
from blogresearch.providers.interfaces import IDbProvider, IProvider
from shared.container import Container


class _FakeView:
    class _FakeViewModel:
        result = ""
        error = ""

    def __init__(self):
        self._view_model = self._FakeViewModel()
        self._session_state = {}

    @property
    def session_state(self):
        return self._session_state

    @property
    def view_model(self):
        return self._view_model

    @view_model.setter
    def view_model(self, value):
        self._view_model = value


@dataclass
class _Thing:
    value: str


def test_container_can_register_and_resolve_a_function_factory():
    container = Container()

    container.add_transient("hello", lambda: _Thing("hello from function"))

    resolved = container.resolve("hello")

    assert isinstance(resolved, _Thing)
    assert resolved.value == "hello from function"


def test_container_can_register_and_resolve_a_singleton_factory():
    container = Container()

    calls = []

    def build_thing():
        calls.append("called")
        return _Thing("singleton")

    container.add_singleton("thing", build_thing)

    first = container.resolve("thing")
    second = container.resolve("thing")

    assert first is second
    assert calls == ["called"]


def test_container_can_resolve_scoped_values_from_a_scope():
    container = Container()

    calls = []

    def build_thing():
        calls.append("called")
        return _Thing("scoped")

    container.add_scoped("thing", build_thing)

    scope = container.create_scope()
    first = scope.resolve("thing")
    second = scope.resolve("thing")

    assert first is second
    assert calls == ["called"]


def test_app_container_registers_selected_provider_services():
    container = build_container(AppSettings(provider_name="claude"))

    llm_provider = container.resolve(IProvider)

    assert isinstance(llm_provider, ClaudeProvider)


def test_app_container_registers_db_services_for_postgres():
    container = build_container(AppSettings(provider_name="postgres"))

    db_provider = container.resolve(IDbProvider)

    assert isinstance(db_provider, PostgresProvider)


def test_container_rejects_unknown_registration():
    container = Container()

    with pytest.raises(KeyError, match="unknown"):
        container.resolve("unknown")


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
    settings = AppSettings(provider_name="claude", use_custom_presenter=False)
    presenter = resolve_presenter(_FakeView(), settings)
    assert isinstance(presenter, HelloPresenter)
    assert not isinstance(presenter, CustomPresenter)


def test_resolve_presenter_uses_custom_presenter_when_requested():
    settings = AppSettings(provider_name="claude", use_custom_presenter=True)
    presenter = resolve_presenter(_FakeView(), settings)
    assert isinstance(presenter, CustomPresenter)


def test_resolve_presenter_uses_db_hello_presenter_for_postgres():
    settings = AppSettings(provider_name="postgres", use_custom_presenter=False)
    presenter = resolve_presenter(_FakeView(), settings)
    assert isinstance(presenter, DbHelloPresenter)


def test_resolve_presenter_defaults_settings_from_environment(monkeypatch):
    # No settings passed - resolve_presenter() should fall back to
    # AppSettings() reading the environment, same pattern as
    # PostgresProvider's conn_string parameter.
    monkeypatch.setenv("PROVIDER_NAME", "dci")
    monkeypatch.setenv("USE_CUSTOM_PRESENTER", "false")
    presenter = resolve_presenter(_FakeView())
    assert isinstance(presenter, HelloPresenter)


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
