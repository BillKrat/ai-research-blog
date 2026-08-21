"""Tests for TripleUserRepository (shared/repositories/triple_user_repository.py).

Everything here runs against a fake TripleRepository, not a real
Postgres/Oxigraph store - same "fakes, not mocks" approach as
test_triple_repository.py: _FakeTripleRepository below is a plain,
readable class implementing the real TripleRepository ABC (so it type-
checks the same way a real implementation would), not a
unittest.mock.Mock(). That also makes this file a proof, on its own,
that TripleUserRepository only ever depends on the TripleRepository
*interface* - never anything Postgres- or Oxigraph-specific - which is
the entire reason docs/adr/0011 could defer the identity-anchor
question instead of needing to answer it before this could be built.

Read this file as the worked example of the CRUDL-without-triples
promise from the 2026-08-20 plan-review session: every test below
constructs users, reads them back, updates and deletes them, using
only `user_id`, `name`, `email` - no test here ever constructs a
Triple, a subject URI, or imports Vocabulary except to prove the
injection seam works (see the last test).
"""

import pytest

from shared.exceptions import ProviderError
from shared.recordset import RecordSet
from shared.repositories.interfaces import Triple, TripleRepository, UserSearchFilter
from shared.repositories.triple_user_repository import USER_COLUMNS, TripleUserRepository
from shared.vocabulary import Vocabulary


class _FakeTripleRepository(TripleRepository):
    """An in-memory TripleRepository, faithful to the real contract:
    create() rejects a duplicate (subject, predicate), update()/read()
    behave exactly as shared/repositories/interfaces.py documents.
    Good enough to drive TripleUserRepository the same way a real
    Postgres/Oxigraph-backed instance would, without any of their
    setup or teardown."""

    def __init__(self):
        self._triples: dict[tuple[str, str], Triple] = {}

    def create(self, subject, predicate, object_value, id=None):
        key = (subject, predicate)
        if key in self._triples:
            raise ProviderError(f"Triple already exists for {key}")
        triple = Triple(subject, predicate, object_value, id=id or "")
        self._triples[key] = triple
        return triple

    def read(self, subject, predicate):
        return self._triples.get((subject, predicate))

    def update(self, subject, predicate, object_value):
        key = (subject, predicate)
        if key not in self._triples:
            raise ProviderError(f"No triple exists for {key}")
        updated = Triple(subject, predicate, object_value, id=self._triples[key].id)
        self._triples[key] = updated
        return updated

    def delete(self, subject, predicate):
        self._triples.pop((subject, predicate), None)

    def list(self, subject=None):
        values = list(self._triples.values())
        return [triple for triple in values if subject is None or triple.subject == subject]

    def find(self, criteria):
        if not criteria:
            return []
        matching_subjects = None
        for predicate, object_value in criteria.items():
            subjects_for_pair = {
                triple.subject
                for triple in self._triples.values()
                if triple.predicate == predicate and triple.object_value == object_value
            }
            matching_subjects = (
                subjects_for_pair if matching_subjects is None else matching_subjects & subjects_for_pair
            )
            if not matching_subjects:
                return []
        return [triple for triple in self._triples.values() if triple.subject in matching_subjects]


@pytest.fixture
def repository():
    return TripleUserRepository(_FakeTripleRepository())


def test_create_returns_a_one_row_recordset_shaped_by_user_columns(repository):
    result = repository.create(name="Ada Lovelace", email="ada@example.com")

    assert isinstance(result, RecordSet)
    assert result.columns == USER_COLUMNS
    assert len(result.rows) == 1
    row = result.rows[0]
    assert row["name"] == "Ada Lovelace"
    assert row["email"] == "ada@example.com"
    assert row["id"]  # minted - some non-empty string, exact value not asserted here


def test_create_mints_a_different_id_for_each_user(repository):
    first = repository.create(name="Ada Lovelace", email="ada@example.com")
    second = repository.create(name="Grace Hopper", email="grace@example.com")

    assert first.rows[0]["id"] != second.rows[0]["id"]


def test_read_returns_none_for_a_user_that_does_not_exist(repository):
    assert repository.read("no-such-id") is None


def test_read_round_trips_what_create_wrote(repository):
    created = repository.create(name="Ada Lovelace", email="ada@example.com")
    user_id = created.rows[0]["id"]

    found = repository.read(user_id)

    assert found is not None
    assert found.columns == USER_COLUMNS
    assert found.rows == [{"id": user_id, "name": "Ada Lovelace", "email": "ada@example.com"}]


def test_update_changes_fields_and_returns_the_updated_row(repository):
    created = repository.create(name="Ada Lovelace", email="ada@example.com")
    user_id = created.rows[0]["id"]

    updated = repository.update(user_id, name="Ada, Countess of Lovelace", email="ada@newmail.example.com")

    assert updated.rows[0]["name"] == "Ada, Countess of Lovelace"
    assert updated.rows[0]["email"] == "ada@newmail.example.com"
    # And the change is really persisted, not just returned in this call's result:
    assert repository.read(user_id).rows[0]["name"] == "Ada, Countess of Lovelace"


def test_update_raises_provider_error_for_a_user_that_does_not_exist(repository):
    with pytest.raises(ProviderError, match="No user found"):
        repository.update("no-such-id", name="Someone", email="someone@example.com")


def test_delete_removes_the_user(repository):
    created = repository.create(name="Ada Lovelace", email="ada@example.com")
    user_id = created.rows[0]["id"]

    repository.delete(user_id)

    assert repository.read(user_id) is None


def test_delete_is_idempotent(repository):
    """Matches TripleRepository.delete()'s own idempotency - calling delete
    twice, or on an id that was never created, is not an error."""
    created = repository.create(name="Ada Lovelace", email="ada@example.com")
    user_id = created.rows[0]["id"]

    repository.delete(user_id)
    repository.delete(user_id)  # second call - must not raise
    repository.delete("never-existed")  # never existed at all - must not raise


def test_list_returns_every_user_as_a_row(repository):
    first = repository.create(name="Ada Lovelace", email="ada@example.com")
    second = repository.create(name="Grace Hopper", email="grace@example.com")

    result = repository.list()

    assert result.columns == USER_COLUMNS
    ids = {row["id"] for row in result.rows}
    assert ids == {first.rows[0]["id"], second.rows[0]["id"]}


def test_list_on_an_empty_repository_returns_columns_with_no_rows(repository):
    result = repository.list()

    assert result.columns == USER_COLUMNS
    assert result.rows == []


def test_list_ignores_non_person_triples_in_the_same_store():
    """list() has to share a store with anything else that store might hold
    (seed vocabulary today, a future form's data later) - this proves it
    only ever surfaces subjects it itself marked as a Person via the
    `type` triple, not everything list(subject=None) returns."""
    triple_repository = _FakeTripleRepository()
    user_repository = TripleUserRepository(triple_repository)
    user_repository.create(name="Ada Lovelace", email="ada@example.com")

    # Unrelated data living in the same store, the way seed vocabulary does.
    triple_repository.create("https://example.test/some-form", "field", "value")

    result = user_repository.list()

    assert len(result.rows) == 1
    assert result.rows[0]["name"] == "Ada Lovelace"


def test_a_custom_vocabulary_controls_the_subject_uri_namespace_but_not_the_public_shape():
    """TripleUserRepository takes Vocabulary as an injected, optional
    dependency (defaults to Vocabulary() - see its constructor) exactly
    like TripleRepository - proving that seam works, and that swapping it
    changes only where subjects live underneath, never what a caller
    sees. This is the one test in this file that touches Vocabulary at
    all, deliberately - everything else only ever uses user_id/name/email."""
    custom_vocabulary = Vocabulary("https://tenant-b.example/2026/08/")
    triple_repository = _FakeTripleRepository()
    repository = TripleUserRepository(triple_repository, vocabulary=custom_vocabulary)

    created = repository.create(name="Ada Lovelace", email="ada@example.com")
    user_id = created.rows[0]["id"]

    # The public RecordSet shape is identical regardless of vocabulary...
    assert created.rows == [{"id": user_id, "name": "Ada Lovelace", "email": "ada@example.com"}]
    # ...but the triples underneath really were written under the custom base URI.
    subject = custom_vocabulary.person(user_id)
    assert triple_repository.read(subject, custom_vocabulary.name).object_value == "Ada Lovelace"


# --- list(filters=...): compound queries, added once "list everything" was
# recognized as the exception rather than the norm (2026-08-20 follow-up
# to the original CRUDL design session). These prove list(filters=...) is
# not just a thinner wrapper over the same "fetch everything, filter in
# Python" logic the unfiltered branch above uses - it round-trips through
# TripleRepository.find(), the actual compound-query primitive, so this
# file also stands as _FakeTripleRepository.find()'s only test coverage
# (a full round-trip test doubles as the fake's own correctness proof).


def test_list_with_no_filters_set_behaves_like_plain_list(repository):
    """UserSearchFilter() with every field left at its default (None) must
    be indistinguishable from calling list() with no filters argument at
    all - "I built a filter object but didn't set anything on it" is a
    real, easy-to-hit caller mistake this must not punish."""
    repository.create(name="Ada Lovelace", email="ada@example.com")

    plain = repository.list()
    empty_filter = repository.list(filters=UserSearchFilter())

    assert plain.rows == empty_filter.rows


def test_list_filters_by_email(repository):
    repository.create(name="Ada Lovelace", email="ada@example.com")
    repository.create(name="Grace Hopper", email="grace@example.com")

    result = repository.list(filters=UserSearchFilter(email="grace@example.com"))

    assert len(result.rows) == 1
    assert result.rows[0]["name"] == "Grace Hopper"


def test_list_filters_by_name(repository):
    repository.create(name="Ada Lovelace", email="ada@example.com")
    repository.create(name="Grace Hopper", email="grace@example.com")

    result = repository.list(filters=UserSearchFilter(name="Ada Lovelace"))

    assert len(result.rows) == 1
    assert result.rows[0]["email"] == "ada@example.com"


def test_list_combines_name_and_email_with_and_not_or(repository):
    """The whole point of a *compound* query: both conditions must hold on
    the SAME user, not either/or across different users."""
    repository.create(name="Ada Lovelace", email="ada@example.com")
    repository.create(name="Grace Hopper", email="grace@example.com")

    # Mismatched pairing - no single user has this name AND this email.
    result = repository.list(filters=UserSearchFilter(name="Ada Lovelace", email="grace@example.com"))

    assert result.rows == []


def test_list_with_a_filter_that_matches_nobody_returns_an_empty_recordset_not_none(repository):
    repository.create(name="Ada Lovelace", email="ada@example.com")

    result = repository.list(filters=UserSearchFilter(email="nobody@example.com"))

    assert result.columns == USER_COLUMNS
    assert result.rows == []


def test_list_filters_ignore_non_person_triples_sharing_the_same_predicate_values():
    """The concrete risk _criteria_from()'s always-included type==person_type
    criterion guards against: name/email are generic, reusable predicates
    (shared/vocabulary.py) - a non-Person subject that happens to reuse
    the `name` predicate with the same value must never leak into a User
    query's results."""
    triple_repository = _FakeTripleRepository()
    user_repository = TripleUserRepository(triple_repository)
    user_repository.create(name="Ada Lovelace", email="ada@example.com")

    vocabulary = Vocabulary()
    triple_repository.create("https://example.test/some-blog", vocabulary.name, "Ada Lovelace")

    result = user_repository.list(filters=UserSearchFilter(name="Ada Lovelace"))

    assert len(result.rows) == 1
    assert result.rows[0]["email"] == "ada@example.com"
