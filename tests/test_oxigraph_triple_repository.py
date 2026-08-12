"""Tests for OxigraphTripleRepository (shared/repositories/).

Read alongside test_triple_repository.py (PostgresTripleRepository's
tests) - same CRUDL contract, same @dataclass(frozen=True) Triple
value object, same ProviderError wrapping - but a genuinely different
testing shape underneath, worth understanding on its own terms:

- **No fakes needed for most of this file.** PostgresTripleRepository
  needs _FakeCursor/_FakeConnection because a *real* psycopg2
  connection dials out over the network - DATABASE_URL in this project
  resolves to Railway's private network, unreachable from a local
  machine, so nothing real could run in CI/local dev without a fake
  standing in for it. pyoxigraph.Store() with no path is different: it
  is a real, fully working, in-process store with zero network or
  filesystem dependency - already as fast and offline as a fake would
  be. So most tests below construct a real OxigraphTripleRepository
  backed by a real in-memory Store and just use it, the same way you'd
  use a real Python dict in a test - no stand-in required.
- **One real fake still earns its place** (_FailingStore, near the
  bottom): pyoxigraph's own Store methods don't naturally fail in a
  test environment the way "the network is down" naturally does for
  psycopg2, so proving OxigraphTripleRepository actually wraps OSError
  into ProviderError needs something that deliberately raises one -
  same idea as PostgresTripleRepository's _FailingCursor, applied to
  this class's error-wrapping test only.
- **Persistence is tested for real, not skipped.** Postgres's live
  integration tests are skip-safe because DATABASE_URL usually isn't
  reachable locally. An on-disk Oxigraph store has no such external
  dependency - pytest's tmp_path fixture gives every test its own
  throwaway directory, so the persistence test at the bottom runs
  everywhere, every time, with no skip logic needed at all.
"""

import pytest

import pyoxigraph as ox

from shared.exceptions import ProviderError
from shared.repositories.interfaces import Triple, TripleRepository
from shared.repositories.oxigraph_triple_repository import OxigraphTripleRepository


# --- TripleRepository: the abstract contract ---


def test_oxigraph_triple_repository_is_a_triple_repository():
    """OxigraphTripleRepository satisfies the same TripleRepository contract
    PostgresTripleRepository does - callers can depend on the abstract
    type and swap the backend without changing call sites."""
    repository = OxigraphTripleRepository()

    assert isinstance(repository, TripleRepository)


# --- Store resolution ---
#
# Mirrors PostgresTripleRepository's conn_string resolution tests, with
# one deliberate behavioral difference: DATABASE_URL missing is an
# error (there is no such thing as a "default" Postgres to fall back
# to), but an unset OXIGRAPH_STORE_PATH is not - pyoxigraph.Store()
# with no path is a legitimate in-memory mode, not a missing config.


def test_defaults_to_an_in_memory_store_when_nothing_is_configured(monkeypatch):
    monkeypatch.delenv("OXIGRAPH_STORE_PATH", raising=False)

    repository = OxigraphTripleRepository()

    # No exception, and it behaves like a normal empty store.
    assert repository.list() == []


def test_uses_environment_store_path(tmp_path, monkeypatch):
    """With no store_path argument, OXIGRAPH_STORE_PATH is read from the environment."""
    monkeypatch.setenv("OXIGRAPH_STORE_PATH", str(tmp_path))

    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")
    del repository  # release the on-disk lock - see the module docstring's note below

    # Reopening the same on-disk path in a brand-new repository proves
    # the env var was actually used, not just accepted and ignored.
    reopened = OxigraphTripleRepository(store_path=str(tmp_path))
    assert reopened.read("subject-1", "kind") == Triple("subject-1", "kind", "widget")


def test_explicit_store_path_overrides_environment(tmp_path, monkeypatch):
    other_path = tmp_path / "from-env"
    other_path.mkdir()
    monkeypatch.setenv("OXIGRAPH_STORE_PATH", str(other_path))

    explicit_path = tmp_path / "explicit"
    explicit_path.mkdir()
    repository = OxigraphTripleRepository(store_path=str(explicit_path))
    repository.create("subject-1", "kind", "widget")
    del repository  # release the on-disk lock before reopening explicit_path below

    # If the env var had won by mistake, this would come back empty -
    # the write went to explicit_path, not other_path.
    assert OxigraphTripleRepository(store_path=str(explicit_path)).read(
        "subject-1", "kind"
    ) == Triple("subject-1", "kind", "widget")


def test_explicit_store_instance_is_used_directly():
    """The store= parameter accepts an already-open pyoxigraph.Store,
    the same way PostgresTripleRepository's connect= parameter accepts
    an already-wired connection factory - useful for sharing one store
    across several repository calls within a single test."""
    store = ox.Store()

    repository = OxigraphTripleRepository(store=store)
    repository.create("subject-1", "kind", "widget")

    assert repository.store is store


# --- create() ---


def test_create_inserts_and_returns_the_triple():
    repository = OxigraphTripleRepository()

    result = repository.create("subject-1", "kind", "widget")

    assert result == Triple("subject-1", "kind", "widget")
    assert repository.read("subject-1", "kind") == result


def test_create_raises_when_triple_already_exists():
    """create() is a real create, not an upsert - matches
    PostgresTripleRepository's contract exactly, even though the
    underlying store (see oxigraph_crudl_poc.py) would happily accept
    a second value for the same (subject, predicate) if this check
    weren't here. This IS the single-valued enforcement this class
    exists to provide."""
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")

    with pytest.raises(ProviderError, match="already exists"):
        repository.create("subject-1", "kind", "gadget")

    # The rejected create had no effect - the original value stands.
    assert repository.read("subject-1", "kind") == Triple("subject-1", "kind", "widget")


# --- read() ---


def test_read_returns_none_when_missing():
    repository = OxigraphTripleRepository()

    assert repository.read("subject-1", "kind") is None


def test_read_returns_the_triple_when_present():
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")

    assert repository.read("subject-1", "kind") == Triple("subject-1", "kind", "widget")


# --- update() ---


def test_update_changes_the_object_value():
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")

    result = repository.update("subject-1", "kind", "gadget")

    assert result == Triple("subject-1", "kind", "gadget")
    assert repository.read("subject-1", "kind") == result


def test_update_raises_when_triple_does_not_exist():
    """update() assumes an existing record, unlike create() - matches
    PostgresTripleRepository exactly."""
    repository = OxigraphTripleRepository()

    with pytest.raises(ProviderError, match="No triple to update"):
        repository.update("subject-1", "kind", "gadget")


def test_update_never_leaves_two_values_for_the_same_slot():
    """Guards the specific risk oxigraph_crudl_poc.py flagged: update()
    is remove-then-add as two separate Store calls, not one atomic
    operation. This proves the end state is still exactly one value,
    not two, after the dust settles."""
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")

    repository.update("subject-1", "kind", "gadget")

    assert repository.list(subject="subject-1") == [Triple("subject-1", "kind", "gadget")]


# --- delete() ---


def test_delete_removes_an_existing_triple():
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")

    repository.delete("subject-1", "kind")

    assert repository.read("subject-1", "kind") is None


def test_delete_is_idempotent_when_triple_does_not_exist():
    """Matches PostgresTripleRepository's DELETE-is-idempotent
    convention, and matches pyoxigraph's own Store.remove() behavior
    confirmed directly in oxigraph_crudl_poc.py: removing an absent
    quad raises nothing."""
    repository = OxigraphTripleRepository()

    repository.delete("subject-1", "kind")  # no raise


# --- list() ---


def test_list_filters_by_subject():
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")
    repository.create("subject-2", "kind", "gizmo")

    assert repository.list(subject="subject-1") == [Triple("subject-1", "kind", "widget")]


def test_list_without_subject_returns_everything():
    repository = OxigraphTripleRepository()
    repository.create("subject-1", "kind", "widget")
    repository.create("subject-2", "kind", "gadget")

    assert repository.list() == [
        Triple("subject-1", "kind", "widget"),
        Triple("subject-2", "kind", "gadget"),
    ]


def test_list_returns_an_empty_list_not_none_when_nothing_matches():
    repository = OxigraphTripleRepository()

    assert repository.list(subject="nobody-home") == []


def test_list_ignores_rdf_not_written_through_this_repository():
    """If the same Store also holds RDF loaded from elsewhere (e.g. the
    morph-kgc blog graph in artifacts/rdf-poc/), list() should only
    ever return rows this repository itself wrote - the same isolation
    PostgresTripleRepository gets for free by only ever querying the
    triple_store table. Proven here by adding a quad directly to the
    store, bypassing the repository entirely."""
    store = ox.Store()
    repository = OxigraphTripleRepository(store=store)
    repository.create("subject-1", "kind", "widget")

    store.add(
        ox.Quad(
            ox.NamedNode("https://blogresearch.net/id/organizations/id=unrelated"),
            ox.NamedNode("https://blogresearch.net/id/organizations#name"),
            ox.Literal("Unrelated Org"),
        )
    )

    assert repository.list() == [Triple("subject-1", "kind", "widget")]


# --- Subject/predicate strings that aren't themselves valid IRIs ---
#
# TripleRepository's contract takes arbitrary opaque strings, the same
# as Postgres's plain text columns - but RDF requires subject/predicate
# to be real IRIs (pyoxigraph.NamedNode rejects a bare string like
# "unit-test-1" outright: "No scheme found in an absolute IRI"). These
# tests prove the percent-encoding in oxigraph_triple_repository.py's
# _subject_node/_predicate_node actually handles that gap, for
# strings the existing Postgres test suite's fixtures use unmodified.


def test_handles_subject_predicate_strings_that_are_not_valid_iris():
    """"unit-test-1" (the exact fixture-subject shape ADR-0008 and the
    Postgres integration tests use) is not, on its own, a valid IRI -
    it has no scheme. This must not leak out of the repository as a
    pyoxigraph ValueError."""
    repository = OxigraphTripleRepository()

    result = repository.create("unit-test-1", "kind", "widget")

    assert result == Triple("unit-test-1", "kind", "widget")
    assert repository.read("unit-test-1", "kind") == result


def test_handles_special_characters_in_subject_and_predicate():
    """Spaces, slashes, and colons would all break a naive f-string IRI
    - percent-encoding is what keeps arbitrary text safe."""
    repository = OxigraphTripleRepository()
    subject = "a subject/with:special chars"
    predicate = "a predicate?too"

    repository.create(subject, predicate, "value")

    assert repository.read(subject, predicate) == Triple(subject, predicate, "value")


# --- Error wrapping ---
#
# pyoxigraph's own Store doesn't naturally fail in a test environment
# the way "the network is down" naturally does for psycopg2 - so
# proving the OSError-to-ProviderError wrapping actually works needs a
# deliberately-failing stand-in, the same idea as
# test_triple_repository.py's _FailingCursor.


class _FailingStore:
    """A store whose every method raises OSError, like a disk failure."""

    def quads_for_pattern(self, *args, **kwargs):
        raise OSError("disk read failed")

    def add(self, *args, **kwargs):
        raise OSError("disk write failed")

    def remove(self, *args, **kwargs):
        raise OSError("disk write failed")

    def flush(self, *args, **kwargs):
        raise OSError("disk write failed")


def test_wraps_store_errors_as_provider_error():
    """Any OSError from the store (a disk failure, in production) surfaces
    as ProviderError, matching PostgresTripleRepository's
    psycopg2.Error wrapping - a caller only ever needs one except
    clause regardless of which backend is behind TripleRepository."""
    repository = OxigraphTripleRepository(store=_FailingStore())

    with pytest.raises(ProviderError, match="Oxigraph error"):
        repository.read("subject-1", "kind")


# --- Persistence across process/instance boundaries ---
#
# Not skip-safe, unlike PostgresTripleRepository's live integration
# tests - an on-disk Oxigraph store has no external network dependency,
# so this runs everywhere, every time. tmp_path gives each test run
# its own throwaway directory, cleaned up automatically by pytest.


def test_data_persists_across_separate_repository_instances_on_disk(tmp_path):
    """The actual thing that matters for production use: a second,
    independently-constructed repository pointed at the same on-disk
    path sees everything the first one wrote - not just "the object
    is still in memory," which oxigraph_poc.py already proved at the
    Store level. This proves it at the repository level, through the
    same CRUDL methods application code would actually call.

    del writer below is not just tidiness - it's required. Oxigraph's
    on-disk store holds an OS-level file lock for as long as any Store
    object referencing it is alive (confirmed directly: opening a
    second Store at the same path while the first is still alive
    raises OSError, "lock hold by current process"). This is a
    stricter version of the multi-replica concurrency question already
    flagged in the project-oxigraph-candidate-evaluation memory - it
    turns out to bite even sequentially, within a single process, not
    only across multiple app instances.
    """
    writer = OxigraphTripleRepository(store_path=str(tmp_path))
    writer.create("subject-1", "kind", "widget")
    writer.create("subject-1", "color", "blue")
    del writer  # release the lock - see docstring above

    reader = OxigraphTripleRepository(store_path=str(tmp_path))

    assert reader.list(subject="subject-1") == [
        Triple("subject-1", "color", "blue"),
        Triple("subject-1", "kind", "widget"),
    ]
