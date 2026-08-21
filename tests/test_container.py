import os
from contextlib import closing
from dataclasses import dataclass

import psycopg2
import pytest

from blogresearch.presenters.custom_presenter import CustomPresenter
from blogresearch.presenters.db_hello_presenter import DbHelloPresenter
from blogresearch.presenters.hello_presenter import HelloPresenter
from blogresearch.presenters.user_profile_presenter import UserProfilePresenter
from blogresearch.config.app_settings import AppSettings
from blogresearch.config.registrations import (
    build_container,
    get_root_container,
    resolve_db_provider,
    resolve_llm_provider,
    resolve_presenter,
    resolve_triple_repository,
    resolve_user_profile_presenter,
)
from shared.container import Container
from shared.providers.claude_provider import ClaudeProvider
from shared.providers.dci_provider import DCIProvider
from shared.providers.postgres_provider import PostgresProvider
from shared.providers.interfaces import IDbProvider, IProvider
from shared.repositories.interfaces import TripleRepository, UserRepository
from shared.repositories.oxigraph_triple_repository import OxigraphTripleRepository
from shared.repositories.postgres_triple_repository import PostgresTripleRepository
from shared.repositories.triple_user_repository import TripleUserRepository
from shared.user_service import UserService


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


# --- Sample classes for the general-purpose Container suite below, ported
# from poc/pycontainer.py's test suite as part of promoting PyContainer
# into shared/container.py (see docs/adr - the container promotion step
# of the user-CRUDL plan). Underscore-prefixed, matching _FakeView/_Thing
# above, to keep them clearly test-only and out of any real class's way.


class _Database:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string


class _Repository:
    def __init__(self, db: _Database):
        self.db = db


class _DisposableService:
    def __init__(self):
        self.is_disposed = False

    def dispose(self):
        self.is_disposed = True


class _ILogger:
    pass


class _FileLogger(_ILogger):
    def __init__(self):
        self.log_type = "File"


class _ConsoleLogger(_ILogger):
    def __init__(self):
        self.log_type = "Console"


def test_container_can_register_and_resolve_a_function_factory():
    container = Container()

    container.register_transient("hello", lambda: _Thing("hello from function"))

    resolved = container.resolve("hello")

    assert isinstance(resolved, _Thing)
    assert resolved.value == "hello from function"


def test_container_can_register_and_resolve_a_singleton_factory():
    container = Container()

    calls = []

    def build_thing():
        calls.append("called")
        return _Thing("singleton")

    container.register_singleton("thing", build_thing)

    first = container.resolve("thing")
    second = container.resolve("thing")

    assert first is second
    assert calls == ["called"]


def test_transient_lifetime_creates_new_instances():
    """Transient registrations must yield a fresh instance every time they are resolved."""
    container = Container()
    container.register_transient(_Database, lambda: _Database("Server=Main;"))

    db1 = container.resolve(_Database)
    db2 = container.resolve(_Database)

    assert db1 is not db2


def test_on_the_fly_overwriting():
    """Re-registering a service overwrites it, dropping any cached singleton instance."""
    container = Container()
    container.register_singleton(_Database, lambda: _Database("Server=Old;"))

    assert container.resolve(_Database).connection_string == "Server=Old;"

    container.register_singleton(_Database, lambda: _Database("Server=New;"))

    assert container.resolve(_Database).connection_string == "Server=New;"


def test_named_registrations():
    """Multiple variants of the same key can be distinguished by name."""
    container = Container()
    container.register_singleton(_Database, lambda: _Database("Server=Primary;"), name="Primary")
    container.register_singleton(_Database, lambda: _Database("Server=Replica;"), name="Replica")

    primary = container.resolve(_Database, name="Primary")
    replica = container.resolve(_Database, name="Replica")

    assert primary.connection_string == "Server=Primary;"
    assert replica.connection_string == "Server=Replica;"


def test_automatic_constructor_injection():
    """The container auto-wires a class's constructor dependencies from type hints."""
    container = Container()
    container.register_singleton(_Database, lambda: _Database("Server=Autoinject;"))
    container.register_transient(_Repository, _Repository)

    repo = container.resolve(_Repository)

    assert isinstance(repo, _Repository)
    assert repo.db.connection_string == "Server=Autoinject;"


def test_automatic_injection_falls_back_to_a_parameters_own_default():
    """A constructor parameter with a default (e.g. an optional collaborator
    nothing has registered) should use that default rather than blow up -
    the container only needs to provide what it actually knows about."""

    class _OptionalLogger:
        def __init__(self):
            self.marker = "built-in default"

    class _ServiceWithOptionalDependency:
        def __init__(self, db: _Database, logger: "_OptionalLogger | None" = None):
            self.db = db
            self.logger = logger

    container = Container()
    container.register_singleton(_Database, lambda: _Database("Server=Main;"))
    container.register_transient(_ServiceWithOptionalDependency, _ServiceWithOptionalDependency)
    # Deliberately no registration for _OptionalLogger.

    service = container.resolve(_ServiceWithOptionalDependency)

    assert service.db.connection_string == "Server=Main;"
    assert service.logger is None  # __init__'s own default, not a container error


def test_automatic_injection_still_prefers_a_real_registration_over_a_default():
    """The default-fallback above must not shadow a real registration - if
    something IS registered for an optional parameter's type, that wins."""

    class _ServiceWithOptionalDependency:
        def __init__(self, db: _Database | None = None):
            self.db = db

    container = Container()
    container.register_singleton(_Database, lambda: _Database("Server=Registered;"))
    container.register_transient(_ServiceWithOptionalDependency, _ServiceWithOptionalDependency)

    service = container.resolve(_ServiceWithOptionalDependency)

    assert service.db.connection_string == "Server=Registered;"


def test_hierarchical_fallback_to_parent():
    """A child container falls back to its parent for a registration it doesn't have locally."""
    root = Container()
    root.register_singleton(_Database, lambda: _Database("Server=ParentDB;"))

    child = root.create_child_container()

    resolved_db = child.resolve(_Database)
    assert resolved_db.connection_string == "Server=ParentDB;"


def test_local_scope_shadowing_overrides_parent():
    """A child container can override a parent registration without touching the parent."""
    root = Container()
    root.register_singleton(_Database, lambda: _Database("Server=ParentDB;"))

    child = root.create_child_container()
    child.register_singleton(_Database, lambda: _Database("Server=ChildDB;"))

    assert child.resolve(_Database).connection_string == "Server=ChildDB;"
    assert root.resolve(_Database).connection_string == "Server=ParentDB;"


def test_automatic_resource_cleanup_on_dispose():
    """Disposing a container cleans up any disposable singletons it instantiated."""
    container = Container()
    container.register_singleton(_DisposableService, _DisposableService)

    service = container.resolve(_DisposableService)
    assert service.is_disposed is False

    container.dispose()
    assert service.is_disposed is True


def test_context_manager_scope_cleanup():
    """A container used as a context manager disposes automatically on block exit."""
    service_reference = None

    with Container() as scope:
        scope.register_singleton(_DisposableService, _DisposableService)
        service_reference = scope.resolve(_DisposableService)
        assert service_reference.is_disposed is False

    assert service_reference.is_disposed is True


def test_actions_prevented_after_dispose():
    """A disposed container refuses further reads or writes."""
    container = Container()
    container.dispose()

    with pytest.raises(RuntimeError, match="Cannot perform actions on a disposed container."):
        container.resolve(_Database)


def test_registration_with_class_mapping_overload():
    """register_singleton(Interface, Class) auto-wires Class like a compiled DI container."""
    container = Container()

    container.register_singleton(_ILogger, _FileLogger)

    logger = container.resolve(_ILogger)
    assert isinstance(logger, _FileLogger)
    assert logger.log_type == "File"


def test_registration_with_factory_overload():
    """register_singleton(Interface, factory) still works alongside the class-mapping overload."""
    container = Container()

    container.register_singleton(_ILogger, lambda: _ConsoleLogger())

    logger = container.resolve(_ILogger)
    assert isinstance(logger, _ConsoleLogger)
    assert logger.log_type == "Console"


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


# --- TripleRepository: its own axis, independent of provider_name ---
#
# provider_name picks the LLM-vs-DB demo provider (mutually exclusive -
# see the tests above). triple_repository_name is a separate field on
# AppSettings, so these tests mirror the resolve_llm_provider/
# resolve_db_provider pairing above, but for TripleRepository, and add
# one test proving the two axes really are independent.


def test_container_resolves_oxigraph_as_triple_repository():
    repository = resolve_triple_repository(AppSettings(triple_repository_name="oxigraph"))
    assert isinstance(repository, OxigraphTripleRepository)


def test_container_resolves_postgres_as_triple_repository():
    repository = resolve_triple_repository(AppSettings(triple_repository_name="postgres"))
    assert isinstance(repository, PostgresTripleRepository)


def test_container_triple_repository_name_is_case_insensitive():
    repository = resolve_triple_repository(AppSettings(triple_repository_name="OXIGRAPH"))
    assert isinstance(repository, OxigraphTripleRepository)


def test_container_rejects_unknown_triple_repository():
    with pytest.raises(ValueError, match="Unknown triple repository"):
        resolve_triple_repository(AppSettings(triple_repository_name="neo4j"))


def test_app_container_registers_triple_repository_by_default():
    # AppSettings() with no override - TRIPLE_REPOSITORY_NAME unset in the
    # environment resolves to the "oxigraph" default (see app_settings.py).
    container = build_container(AppSettings(provider_name="claude"))

    repository = container.resolve(TripleRepository)

    assert isinstance(repository, OxigraphTripleRepository)


def test_app_container_registers_triple_repository_regardless_of_provider_name():
    # TripleRepository is registered on every branch of register_app_services
    # - unlike IProvider/IDbProvider, which are mutually exclusive per
    # provider_name. Proven here from both branches.
    claude_container = build_container(
        AppSettings(provider_name="claude", triple_repository_name="oxigraph")
    )
    postgres_container = build_container(
        AppSettings(provider_name="postgres", triple_repository_name="oxigraph")
    )

    assert isinstance(claude_container.resolve(TripleRepository), OxigraphTripleRepository)
    assert isinstance(postgres_container.resolve(TripleRepository), OxigraphTripleRepository)


def test_app_container_resolves_triple_repository_as_a_singleton():
    # Not just a container-lifetime detail: OxigraphTripleRepository's
    # on-disk store can only be held open by one live Store at a time (a
    # RocksDB file lock - see its docstring), so a new instance per
    # resolve() would break the very first time two call sites needed it
    # in the same process. register_singleton is what makes "keep one
    # long-lived instance" true in practice, not just in a comment.
    container = build_container(AppSettings(triple_repository_name="oxigraph"))

    first = container.resolve(TripleRepository)
    second = container.resolve(TripleRepository)

    assert first is second


# --- resolve_user_profile_presenter(): the first real child-container
# registrations in this codebase - proving the design agreed during the
# 2026-08-20 plan review actually holds: page-specific registrations
# (UserRepository/UserService) live only on the child, while
# TripleRepository stays a single, real, process-wide instance on the
# root that the child falls back to rather than re-registering.


def test_resolve_user_profile_presenter_wires_the_full_chain():
    presenter = resolve_user_profile_presenter()

    assert isinstance(presenter, UserProfilePresenter)


def test_resolve_user_profile_presenter_registers_the_expected_types_on_its_child():
    container = get_root_container().create_child_container()

    resolve_user_profile_presenter(container)

    assert isinstance(container.resolve(UserRepository), TripleUserRepository)
    assert isinstance(container.resolve(UserService), UserService)


def test_resolve_user_profile_presenter_shares_the_roots_triple_repository():
    # If two separately-resolved presenters didn't share the same
    # underlying TripleRepository (and therefore the same store), a user
    # created through one would be invisible to the other - this is an
    # end-to-end proof of the whole Step 1 + Step 5 wiring, not just a
    # unit check.
    first_presenter = resolve_user_profile_presenter()
    first_presenter.on_add(name="Ada Lovelace", email="ada@example.com")
    user_id = first_presenter.view_model.row["id"]

    second_presenter = resolve_user_profile_presenter()
    second_presenter.on_load(user_id)

    assert second_presenter.view_model.error == ""
    assert second_presenter.view_model.row["name"] == "Ada Lovelace"


def test_resolve_user_profile_presenter_with_an_explicit_container_bypasses_the_root():
    # Same opt-out resolve_presenter() offers via its settings parameter -
    # tests (or a future caller) can resolve against a container they
    # built themselves, independent of the process-wide root/its cache.
    container = Container()
    container.register_singleton(TripleRepository, OxigraphTripleRepository)

    presenter = resolve_user_profile_presenter(container)
    presenter.on_add(name="Grace Hopper", email="grace@example.com")

    assert presenter.view_model.row["name"] == "Grace Hopper"
