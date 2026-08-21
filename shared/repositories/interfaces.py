"""Contracts for the triple-store repository.

Business logic and the UI depend on TripleRepository, never on
Postgres or raw SQL directly - see docs/adr/0004 and docs/adr/0007 for
why. This is the first Repository in the codebase; see
docs/adr/0008 for how it relates to IDbProvider.
"""

# Required: TripleRepository has a method literally named `list`. Class
# bodies execute like a function body with their own namespace, so once
# `def list(...):` runs, the name `list` inside THIS class body refers to
# that method, not the builtin - any annotation on a method defined after
# it that writes `list[Triple]` would resolve `list` to the method and
# raise "'function' object is not subscriptable" at import time. This
# defers all annotations to strings (PEP 563), evaluated lazily, so the
# shadowing never actually triggers a lookup. Without it, method order
# inside TripleRepository/UserRepository becomes load-bearing in a way
# that isn't obvious from reading the class.
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Mapping

from shared.recordset import Column, RecordSet


@dataclass(frozen=True)
class Triple:
    """A single (subject, predicate, object_value) fact, carrying a stable id.

    id is a separate concern from what makes two Triples "the same
    fact" - see docs/adr/0010. It doesn't participate in equality/hash
    (`compare=False`), so `Triple("s", "p", "o") == Triple("s", "p", "o",
    id="anything")` regardless of id: two Triples with the same content
    are the same fact even if they carry different ids (the normal case
    when the same seed data is loaded into two independently-generated
    stores). It trails with a default for the same reason - most callers
    (tests especially) only care about content, not identity, and
    shouldn't have to invent a value to get an equality check to type-check.

    (subject, predicate) remains the key CRUDL is addressed by - id
    exists for direct row-level reference (pgAdmin, admin tooling) and
    for recognizing "the same fact" across independently seeded stores/
    environments, not for reads/writes through this interface.
    """

    subject: str
    predicate: str
    object_value: str
    id: str = field(default="", compare=False)


class TripleRepository(ABC):
    """CRUDL access to triples, one (subject, predicate) pair at a time.

    (subject, predicate) is treated as a single-valued slot - the case
    this project needs today (a form field, a config value): one
    object_value per (subject, predicate). True RDF multi-valued facts
    (the same subject+predicate holding several objects at once, e.g.
    ASR-004's user-subscribes-to-user triples) are a different access
    pattern with different CRUDL semantics and are out of scope here;
    that would be its own repository, not forced through this one.
    """

    @abstractmethod
    def create(
        self, subject: str, predicate: str, object_value: str, id: str | None = None
    ) -> Triple:
        """Insert a new triple.

        id defaults to a fresh UUID4 when omitted. Pass one explicitly
        to keep an id stable across independently seeded stores/
        environments - see shared/seed_data/initial_triples.json, whose
        entries carry their own ids for exactly this reason.

        Raises ProviderError if one already exists for this
        (subject, predicate).
        """

    @abstractmethod
    def read(self, subject: str, predicate: str) -> Triple | None:
        """Return the triple for (subject, predicate), or None if absent."""

    @abstractmethod
    def update(self, subject: str, predicate: str, object_value: str) -> Triple:
        """Change an existing triple's object_value.

        Raises ProviderError if no triple exists for this
        (subject, predicate).
        """

    @abstractmethod
    def delete(self, subject: str, predicate: str) -> None:
        """Remove the triple for (subject, predicate).

        Idempotent - no error if it doesn't exist.
        """

    @abstractmethod
    def list(self, subject: str | None = None) -> list[Triple]:
        """Return all triples, or all triples for one subject if given."""

    @abstractmethod
    def find(self, criteria: Mapping[str, str]) -> list[Triple]:
        """Compound AND query: every triple belonging to a subject that has
        a matching triple for EVERY (predicate, object_value) pair in
        criteria - not just the triples that were matched on. A subject
        satisfying `{email_predicate: "a@example.com", name_predicate:
        "Ada"}` has both its own name and email triples returned, the
        same way list(subject=...) returns everything for one subject -
        this exists so a caller (e.g. TripleUserRepository.list()) can
        pivot a matched subject's full record without a second round
        trip to look up the rest of its fields.

        This is the one place TripleRepository does real querying rather
        than a direct (subject, predicate) key lookup - see docs/adr's
        note on point lookups vs. pivots (ADR-0005) for why that
        distinction matters for performance at scale. Both concrete
        implementations back this with a real index/query capability
        (Postgres: predicate/object_value equality + GROUP BY; Oxigraph:
        native quad-pattern matching, which pyoxigraph indexes
        internally) rather than a full Python-side scan.

        Empty criteria returns an empty list, deliberately - "no
        conditions" isn't a meaningful compound query to ask this method;
        use list() (no arguments) for "give me everything" instead.
        """


USER_COLUMNS: list[Column] = [
    Column(name="id", label="ID", sequence=0, type="string"),
    Column(name="name", label="Name", sequence=1, type="string"),
    Column(name="email", label="Email", sequence=2, type="string"),
]
"""The fixed schema every UserRepository implementation's RecordSets are
shaped by. Lives here, next to the contract, rather than inside
TripleUserRepository - it describes what a User *is* (part of the
interface every implementation must honor), not a detail of how one
particular implementation pivots triples. A presenter needs this same
schema before any row has ever been loaded (e.g. to render an empty
"add a user" form), which is the concrete reason it lives somewhere a
presenter can import without reaching into a triple-specific module."""


@dataclass(frozen=True)
class UserSearchFilter:
    """Optional compound filter for UserRepository.list()/UserService.list().

    Every field is optional; only the ones you set are AND-combined into
    the query. Deliberately scoped to USER_COLUMNS' actual filterable
    fields - name and email - not a speculative superset (no `status`,
    no `date_start`): a filter object invented ahead of a real field
    existing on this entity is exactly the kind of premature
    generalization AGENTS.md warns against, and it wouldn't actually be
    "decoupled from a use case" so much as coupled to a *different,
    imagined* one.

    No `id` field, on purpose: id identifies a specific subject
    directly - filtering "by id" is what read(user_id) already is, not
    a compound-query question. Including it here would invite confusion
    about which method to reach for on a known id.

    All-None (the default) means "no filter" - UserRepository.list()
    with an all-None or omitted filters behaves identically to calling
    it with no filter at all.
    """

    name: str | None = None
    email: str | None = None


class UserRepository(ABC):
    """CRUDL access to users, in RecordSet shape - never a Triple.

    This is the boundary docs/adr/0011 draws: a UserRepository
    implementation is free to be triple-backed underneath (see
    shared/repositories/triple_user_repository.py, the one
    implementation today), but nothing that calls this interface - a
    UserService, a presenter, a view-model - ever sees a Triple, a
    subject URI, or knows a triple store is involved at all. Every
    method here operates purely in `user_id` (a bare id, typically a
    uuid4 string) and RecordSet (shared/recordset.py) terms.

    Unlike TripleRepository, which is single-valued per (subject,
    predicate) but multi-subject by nature (list() spans every
    subject), a "user" here is one whole record spanning several
    predicates at once - closer to a row than a fact. create()/read()/
    update() each return a RecordSet containing exactly one row so a
    caller always has the display schema (Column.label/sequence/type)
    alongside the data, without a separate schema lookup - list()
    returns the same shape with every user as a row.
    """

    @abstractmethod
    def create(self, name: str, email: str) -> RecordSet:
        """Create a new user, minting its id. Returns a one-row RecordSet
        for the created user, including the minted id as a column value."""

    @abstractmethod
    def read(self, user_id: str) -> RecordSet | None:
        """Return a one-row RecordSet for user_id, or None if no such user exists."""

    @abstractmethod
    def update(self, user_id: str, name: str, email: str) -> RecordSet:
        """Change an existing user's fields. Returns the updated one-row RecordSet.

        Raises ProviderError if no user exists for user_id.
        """

    @abstractmethod
    def delete(self, user_id: str) -> None:
        """Remove the user for user_id.

        Idempotent - no error if it doesn't exist, matching
        TripleRepository.delete()'s same idempotency.
        """

    @abstractmethod
    def list(self, *, filters: UserSearchFilter | None = None) -> RecordSet:
        """Return every user as a RecordSet, one row per user - or only
        those matching `filters`, if given and non-empty."""
