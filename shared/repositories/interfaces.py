"""Contracts for the triple-store repository.

Business logic and the UI depend on TripleRepository, never on
Postgres or raw SQL directly - see docs/adr/0004 and docs/adr/0007 for
why. This is the first Repository in the codebase; see
docs/adr/0008 for how it relates to IDbProvider.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

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
    def list(self) -> RecordSet:
        """Return every user as a RecordSet, one row per user."""
