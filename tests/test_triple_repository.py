"""Tests for the triple-store repository (shared/repositories/).

Read this file top to bottom to understand PostgresTripleRepository -
each test is documented with *what* it checks and *why*, not just the
assertion itself.

Two groups of tests, split by how they reach the database:

1. Fake-connection tests (most of this file) exercise the repository's
   actual logic - the uniqueness check on create, the existence check
   on update, SQL parameter wiring, error wrapping - without touching
   a real database at all. They run instantly, every time, on any
   machine. This is what makes the rest of this file possible to
   develop with real TDD red/green cycles: DATABASE_URL in this
   project resolves to `postgres.railway.internal`, which is Railway's
   *private* network hostname - by design, it cannot be reached from a
   local dev machine at all. Without fakes, none of this logic could
   be exercised locally.

2. Integration tests (bottom of the file, "Live integration tests")
   exercise the real triple_store table through a real connection.
   They're *skip-safe*: if DATABASE_URL isn't set, or is set but
   unreachable (the normal case on a local machine), pytest reports
   them as skipped, not failed. A skip means "this environment can't
   check this," not "the code is broken" - that distinction matters
   when reading test output.

Python concepts this file leans on, in case any are unfamiliar coming
from a .NET/C# background:

- **Fakes, not mocks.** `_FakeCursor`/`_FakeConnection` below are
  plain hand-written classes that behave enough like a real psycopg2
  cursor/connection to stand in for one - not `unittest.mock.Mock()`
  objects. Nothing else in this codebase uses `unittest.mock` either
  (see test_claude_provider.py's `FailingClient`/`FailingMessages`).
  The tradeoff: a bit more code to write up front, but a fake is a
  real, readable object with real behavior you can step through -
  there's no dynamic attribute magic to reason about.
- **Dependency injection via a plain callable**, not a DI
  container or an interface. `PostgresTripleRepository.__init__`
  takes an optional `connect` parameter (default: `psycopg2.connect`)
  purely so a test can pass in a function that returns a fake
  connection instead. See test_claude_provider.py's `client` parameter
  on `ClaudeProvider` for the same pattern already established in this
  codebase.
- **`abc.ABC` / `@abstractmethod`** is Python's version of a C#
  interface: `TripleRepository` cannot be instantiated on its own
  (see `test_triple_repository_cannot_be_instantiated_directly`
  below) - Python just enforces that at call time instead of compile
  time.
- **`@dataclass(frozen=True)`** on `Triple` auto-generates `__eq__`
  (compares field values, not object identity) and blocks attribute
  reassignment after construction. See the "Triple value object"
  section below for tests that make both of those concrete - this is
  a real behavioral difference from a plain C# class, where `==`
  compares references unless you opt into value equality yourself.
- **pytest `monkeypatch`** temporarily sets/removes an environment
  variable for the duration of one test and restores it automatically
  afterward - no manual save/restore, no risk of one test's env
  changes leaking into the next.
- **pytest fixtures with `yield`** (see `live_repository` below) let a
  fixture run setup code, hand control to the test, and then run
  teardown code after the test finishes - regardless of whether the
  test passed, failed, or raised. That's what guarantees the
  integration tests below always delete the rows they create, even if
  an assertion fails partway through.
"""

import os
import uuid
from contextlib import closing
from dataclasses import FrozenInstanceError

import psycopg2
import pytest

from shared.exceptions import ProviderError
from shared.repositories.interfaces import Triple, TripleRepository
from shared.repositories.postgres_triple_repository import PostgresTripleRepository


# --- Fakes: stand-ins for a real psycopg2 connection/cursor ---
#
# psycopg2 connections/cursors are used as context managers
# (`with conn.cursor() as cur:`), so the fakes below implement
# __enter__/__exit__ too - just enough of the real protocol to make
# PostgresTripleRepository's code run unmodified against a fake.


class _FakeCursor:
    """Stands in for a psycopg2 cursor.

    `fetchone_result` / `fetchall_result` are what the *next* read
    call returns - set them up front to control what the repository
    "sees" as already being in the table. `rowcount` mimics
    psycopg2's cursor.rowcount, which PostgresTripleRepository.update()
    reads to decide whether an UPDATE matched an existing row.
    `executed` records every (sql, params) pair passed to execute(),
    so a test can assert on *which* statement ran and with *what*
    parameters, without needing a real database to check against.
    """

    def __init__(self, fetchone_result=None, fetchall_result=None, rowcount=1):
        self.executed = []
        self.fetchone_result = fetchone_result
        self.fetchall_result = fetchall_result if fetchall_result is not None else []
        self.rowcount = rowcount

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.fetchone_result

    def fetchall(self):
        return self.fetchall_result

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False


class _FailingCursor(_FakeCursor):
    """A cursor whose execute() always fails, like a dropped connection.

    Used for one test only: proving PostgresTripleRepository catches
    psycopg2.Error and re-raises it as ProviderError, so callers (a
    Presenter, eventually) only ever need to catch one exception type
    instead of knowing about psycopg2 specifically.
    """

    def execute(self, sql, params=None):
        raise psycopg2.OperationalError("connection refused")


class _FakeConnection:
    """Stands in for a psycopg2 connection.

    Always returns the same cursor from cursor() (a real connection
    can open several; the repository only ever opens one per method
    call, so one fake cursor per fake connection is enough here).
    `committed` records whether commit() was called, which is how the
    tests below confirm a write was (or, for a failed create/update,
    deliberately wasn't) persisted.
    """

    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def close(self):
        pass


def _repository(cursor):
    """Build a PostgresTripleRepository wired to a fake connection.

    `connect=lambda _: connection` replaces psycopg2.connect entirely -
    the repository calls `self._connect(self.conn_string)` and has no
    idea it received a fake instead of a real network connection.
    conn_string is a throwaway value ("fake") since nothing here ever
    dials out with it.
    """
    connection = _FakeConnection(cursor)
    return PostgresTripleRepository(conn_string="fake", connect=lambda _: connection), connection


# --- Triple: the value object ---
#
# These two tests aren't about PostgresTripleRepository at all - they
# pin down what @dataclass(frozen=True) actually buys us, since it's
# doing real work silently in every other test's assert statements.


def test_triple_equality_is_by_value_not_identity():
    """Two separately-built Triples with the same fields are equal.

    @dataclass auto-generates __eq__ from the field values. Without
    it (a plain class, like a default C# class), `==` would fall back
    to identity comparison and this would be False even though every
    field matches - which would silently break almost every `==`
    assertion in this file, since each one builds a fresh expected
    Triple to compare against whatever the repository returned.
    """
    a = Triple("subject-1", "kind", "widget")
    b = Triple("subject-1", "kind", "widget")

    assert a == b
    assert a is not b  # still two distinct objects in memory


def test_triple_is_immutable():
    """frozen=True blocks attribute assignment after construction.

    Triple is meant to represent one immutable fact - once you've
    read (or created) a Triple, nothing downstream should be able to
    quietly mutate it. Attempting to costs a FrozenInstanceError
    instead of silently succeeding.
    """
    triple = Triple("subject-1", "kind", "widget")

    with pytest.raises(FrozenInstanceError):
        triple.object_value = "gadget"


def test_triple_is_hashable_because_it_is_frozen():
    """Frozen + eq-by-value makes Triple usable as a set member/dict key.

    A plain (non-frozen) dataclass is unhashable by default, precisely
    because a mutable object's hash could change after being inserted
    into a set - frozen removes that risk, so Python generates a
    __hash__ derived from the same fields __eq__ compares. Practical
    payoff: de-duplicating a list of Triples is just `set(triples)`.
    """
    duplicate_a = Triple("subject-1", "kind", "widget")
    duplicate_b = Triple("subject-1", "kind", "widget")
    different = Triple("subject-1", "kind", "gadget")

    assert {duplicate_a, duplicate_b, different} == {duplicate_a, different}


# --- TripleRepository: the abstract contract ---


def test_triple_repository_cannot_be_instantiated_directly():
    """abc.ABC + @abstractmethod block instantiating the interface itself.

    TripleRepository declares five @abstractmethod stubs and no
    implementation - Python refuses to construct it directly, the same
    way you can't `new` a C# interface. This is what forces every
    concrete subclass (today, just PostgresTripleRepository) to
    actually implement all five methods, or fail the same way at
    import/instantiation time.
    """
    with pytest.raises(TypeError):
        TripleRepository()


def test_postgres_triple_repository_is_a_triple_repository():
    """PostgresTripleRepository satisfies the TripleRepository contract.

    This is what lets any future caller depend on the abstract
    TripleRepository type - "give me *a* TripleRepository" - rather
    than importing PostgresTripleRepository concretely, per ADR-0004 /
    ADR-0007's "business logic depends on the interface, not Postgres
    directly."
    """
    repository, _ = _repository(_FakeCursor())

    assert isinstance(repository, TripleRepository)


# --- Connection-string resolution ---
#
# Same three cases PostgresProvider's own connection-string handling
# would have (see blogresearch/providers/postgres_provider.py): read
# from the environment, an explicit override wins, and a genuinely
# missing configuration fails loudly instead of connecting to nothing.


def test_uses_environment_connection_string(monkeypatch):
    """With no conn_string argument, DATABASE_URL is read from the environment."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")

    repository = PostgresTripleRepository()

    assert repository.conn_string == "postgresql://user:pass@localhost:5432/testdb"


def test_explicit_conn_string_overrides_environment(monkeypatch):
    """An explicit conn_string wins over DATABASE_URL, and the env var is never read.

    __init__ resolves conn_string as `conn_string or self._get_connection_string()`
    - Python's `or` short-circuits, so when the left side is a
    non-empty string, `_get_connection_string()` (the env lookup)
    never executes at all. Proven here by setting DATABASE_URL to a
    value that would fail this assertion if it were used by mistake.
    """
    monkeypatch.setenv("DATABASE_URL", "postgresql://from-env/testdb")

    repository = PostgresTripleRepository(conn_string="postgresql://explicit/testdb")

    assert repository.conn_string == "postgresql://explicit/testdb"


def test_missing_database_url_raises_value_error(monkeypatch):
    """No conn_string argument and no DATABASE_URL in the environment fails fast.

    Better to raise immediately with a clear message than to let a
    later psycopg2.connect(None) fail with a confusing, unrelated
    error deep inside create()/read()/etc.
    """
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValueError, match="DATABASE_URL"):
        PostgresTripleRepository()


# --- create() ---


def test_create_inserts_and_returns_the_triple():
    """The happy path: no existing row, so create() checks, inserts, and commits.

    `fetchone_result=None` simulates "the SELECT 1 uniqueness check
    found nothing" - the same as an empty table for this
    (subject, predicate) pair. Asserting on cursor.executed (not just
    the final result) proves *which* two statements ran, in order:
    the existence check first, then the INSERT - not just that
    *something* happened to produce the right return value.
    """
    cursor = _FakeCursor(fetchone_result=None)
    repository, connection = _repository(cursor)

    result = repository.create("subject-1", "kind", "widget")

    assert result == Triple("subject-1", "kind", "widget")
    assert cursor.executed[0][0].startswith("SELECT 1")
    assert cursor.executed[1][0].startswith("INSERT")
    assert cursor.executed[1][1] == ("subject-1", "kind", "widget")
    assert connection.committed


def test_create_raises_when_triple_already_exists():
    """create() is a real create, not an upsert: an existing (subject, predicate) is rejected.

    `fetchone_result=(1,)` simulates the uniqueness check finding a
    row - any non-None row means "already exists," the actual value
    returned is irrelevant (the query is `SELECT 1 ...`, not a real
    column). No INSERT is ever attempted, and nothing is committed -
    the transaction is abandoned entirely.
    """
    cursor = _FakeCursor(fetchone_result=(1,))
    repository, connection = _repository(cursor)

    with pytest.raises(ProviderError, match="already exists"):
        repository.create("subject-1", "kind", "widget")

    assert len(cursor.executed) == 1  # only the SELECT ran - INSERT never happened
    assert not connection.committed


# --- read() ---


def test_read_returns_none_when_missing():
    """No matching row -> None, not an exception. Absence is a normal, expected outcome for read()."""
    cursor = _FakeCursor(fetchone_result=None)
    repository, _ = _repository(cursor)

    assert repository.read("subject-1", "kind") is None


def test_read_returns_the_triple_when_present():
    """A matching row is reassembled into a Triple, with subject/predicate
    supplied by the caller (they're the lookup key, not part of the
    SELECT's result columns - only object_value comes back from the query)."""
    cursor = _FakeCursor(fetchone_result=("widget",))
    repository, _ = _repository(cursor)

    assert repository.read("subject-1", "kind") == Triple("subject-1", "kind", "widget")


# --- update() ---


def test_update_changes_the_object_value():
    """rowcount=1 simulates "the UPDATE matched exactly one row" - the normal case."""
    cursor = _FakeCursor(rowcount=1)
    repository, connection = _repository(cursor)

    result = repository.update("subject-1", "kind", "gadget")

    assert result == Triple("subject-1", "kind", "gadget")
    # SQL is `SET object_value = %s WHERE subject = %s AND predicate = %s` -
    # params must line up with the %s placeholders in that exact order.
    assert cursor.executed[0][1] == ("gadget", "subject-1", "kind")
    assert connection.committed


def test_update_raises_when_triple_does_not_exist():
    """update() assumes an existing record - unlike create(), it's not an upsert.

    rowcount=0 simulates "the UPDATE ran but matched zero rows" (the
    WHERE clause found nothing) - the only way update() can tell the
    difference between "changed a row" and "silently did nothing."
    Nothing is committed, so even though the UPDATE statement itself
    executed, it has no effect once the connection closes without a
    commit.
    """
    cursor = _FakeCursor(rowcount=0)
    repository, connection = _repository(cursor)

    with pytest.raises(ProviderError, match="No triple to update"):
        repository.update("subject-1", "kind", "gadget")

    assert not connection.committed


# --- delete() ---


def test_delete_removes_an_existing_triple():
    """The normal case: rowcount=1, DELETE matched a row, and the change is committed."""
    cursor = _FakeCursor(rowcount=1)
    repository, connection = _repository(cursor)

    repository.delete("subject-1", "kind")

    assert cursor.executed[0][0].startswith("DELETE")
    assert cursor.executed[0][1] == ("subject-1", "kind")
    assert connection.committed


def test_delete_is_idempotent_when_triple_does_not_exist():
    """Deleting something that isn't there is not an error - it's still committed as a no-op.

    This is the opposite policy from update(): DELETE follows the
    standard "idempotent" REST/HTTP convention (calling it twice, or
    calling it on something already gone, has the same end state and
    doesn't raise), while update() deliberately treats "nothing
    matched" as an error because it implies the caller's assumption
    (this record exists) was wrong.
    """
    cursor = _FakeCursor(rowcount=0)
    repository, connection = _repository(cursor)

    repository.delete("subject-1", "kind")  # no raise

    assert connection.committed


# --- list() ---


def test_list_filters_by_subject():
    """Passing subject= adds a WHERE clause and its value is bound as a query parameter."""
    cursor = _FakeCursor(fetchall_result=[("subject-1", "kind", "widget")])
    repository, _ = _repository(cursor)

    result = repository.list(subject="subject-1")

    assert result == [Triple("subject-1", "kind", "widget")]
    assert "WHERE" in cursor.executed[0][0]
    assert cursor.executed[0][1] == ("subject-1",)


def test_list_without_subject_returns_everything():
    """No subject= means no WHERE clause - every row comes back, mapped to Triples in order."""
    cursor = _FakeCursor(
        fetchall_result=[
            ("subject-1", "kind", "widget"),
            ("subject-2", "kind", "gadget"),
        ]
    )
    repository, _ = _repository(cursor)

    result = repository.list()

    assert "WHERE" not in cursor.executed[0][0]
    assert result == [
        Triple("subject-1", "kind", "widget"),
        Triple("subject-2", "kind", "gadget"),
    ]


def test_list_returns_an_empty_list_not_none_when_nothing_matches():
    """An empty table (or no matches for the given subject) is a normal, empty list - never None.

    Matters for callers: `for triple in repository.list(subject=x):`
    should always work without an `if result is not None` guard first.
    """
    cursor = _FakeCursor(fetchall_result=[])
    repository, _ = _repository(cursor)

    assert repository.list(subject="nobody-home") == []


# --- Error wrapping ---


def test_wraps_database_errors_as_provider_error():
    """Any psycopg2.Error (a dropped connection, a bad query, etc.) surfaces as ProviderError.

    Every provider/repository in this codebase does this (see
    ClaudeProvider, PostgresProvider) so a Presenter only ever needs
    one except clause to handle failures generically, regardless of
    which backend raised the underlying, backend-specific exception.
    """
    repository, _ = _repository(_FailingCursor())

    with pytest.raises(ProviderError, match="PostgreSQL error"):
        repository.read("subject-1", "kind")


# --- Live integration tests against the real triple_store table ---
#
# Everything below actually opens a network connection and runs real
# SQL. Skip-safe by design (see the module docstring): these only run
# somewhere DATABASE_URL is both set and reachable, e.g. inside
# Railway's own network - never on a typical local dev machine.
#
# Each test gets a subject unique to that test run (uuid4-suffixed),
# and the live_repository fixture always deletes it afterward via
# `yield` + teardown code - even if the test's assertions fail midway.
# That keeps this suite safe to run repeatedly against a live/shared
# database: it never touches the permanent unit-test-1/unit-test-2
# fixture rows, and never accumulates leftover rows over time.


@pytest.fixture
def live_repository():
    conn_string = os.environ.get("DATABASE_URL")
    if not conn_string:
        pytest.skip("DATABASE_URL is not configured")

    try:
        with closing(psycopg2.connect(conn_string)):
            pass
    except psycopg2.Error as exc:
        pytest.skip(f"Postgres integration test skipped: {exc}")

    subject = f"pytest-triple-{uuid.uuid4().hex}"
    repository = PostgresTripleRepository(conn_string=conn_string)
    yield repository, subject  # --- test runs here ---

    # Teardown: runs even if the test above raised.
    with closing(psycopg2.connect(conn_string)) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM triple_store WHERE subject = %s", (subject,))
        conn.commit()


def test_live_create_read_update_delete_roundtrip(live_repository):
    """End-to-end proof against the real table: every CRUDL verb except list(), in sequence."""
    repository, subject = live_repository

    created = repository.create(subject, "kind", "widget")
    assert created == Triple(subject, "kind", "widget")
    assert repository.read(subject, "kind") == created

    updated = repository.update(subject, "kind", "gadget")
    assert repository.read(subject, "kind") == updated

    repository.delete(subject, "kind")
    assert repository.read(subject, "kind") is None
    repository.delete(subject, "kind")  # idempotent, no raise


def test_live_create_raises_when_triple_already_exists(live_repository):
    """The uniqueness check runs against the real table too, not just the fake in the unit test above."""
    repository, subject = live_repository

    repository.create(subject, "kind", "widget")

    with pytest.raises(ProviderError, match="already exists"):
        repository.create(subject, "kind", "widget")


def test_live_list_filters_by_subject(live_repository):
    """list(subject=...) against the real table, ordered by predicate."""
    repository, subject = live_repository

    repository.create(subject, "kind", "widget")
    repository.create(subject, "color", "blue")

    results = repository.list(subject=subject)

    assert results == [
        Triple(subject, "color", "blue"),
        Triple(subject, "kind", "widget"),
    ]
