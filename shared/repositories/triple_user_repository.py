"""TripleUserRepository: the one UserRepository implementation, triple-backed.

Composes an injected TripleRepository - PostgresTripleRepository and
OxigraphTripleRepository both work here unchanged, which is the whole
point of depending on the TripleRepository interface rather than a
concrete store (see docs/adr/0009's shared/ vs blogresearch/ split and
docs/adr/0011 for why users are fully triple-based). This class is
where that abstraction gets proven: swapping the injected repository
swaps the backing store with zero change here.
"""

import uuid

from shared.exceptions import ProviderError
from shared.recordset import RecordSet
from shared.repositories.interfaces import USER_COLUMNS, TripleRepository, UserRepository
from shared.vocabulary import Vocabulary


class TripleUserRepository(UserRepository):
    """UserRepository backed by an injected TripleRepository.

    Each user is one subject (vocabulary.person(user_id)) carrying a
    `type` triple (marking it a Person) plus one triple per column -
    `name`, `email`. read()/list() pivot those triples back into
    RecordSet rows shaped by USER_COLUMNS; create()/update() do the
    reverse, writing one column at a time through the injected
    TripleRepository. Callers never see a Triple, a subject URI, or
    the vocabulary itself - user_id in, RecordSet out, on every method.
    """

    def __init__(self, triple_repository: TripleRepository, vocabulary: Vocabulary | None = None):
        self._triple_repository = triple_repository
        self._vocabulary = vocabulary if vocabulary is not None else Vocabulary()

    def create(self, name: str, email: str) -> RecordSet:
        user_id = str(uuid.uuid4())
        subject = self._vocabulary.person(user_id)

        self._triple_repository.create(subject, self._vocabulary.type, self._vocabulary.person_type)
        self._triple_repository.create(subject, self._vocabulary.name, name)
        self._triple_repository.create(subject, self._vocabulary.email, email)

        return self._one_row(user_id, name, email)

    def read(self, user_id: str) -> RecordSet | None:
        triples = self._triple_repository.list(subject=self._vocabulary.person(user_id))
        if not triples:
            return None

        by_predicate = {triple.predicate: triple.object_value for triple in triples}
        return self._one_row(
            user_id,
            by_predicate.get(self._vocabulary.name, ""),
            by_predicate.get(self._vocabulary.email, ""),
        )

    def update(self, user_id: str, name: str, email: str) -> RecordSet:
        subject = self._vocabulary.person(user_id)
        if not self._triple_repository.list(subject=subject):
            raise ProviderError(f"No user found for id {user_id!r}")

        self._triple_repository.update(subject, self._vocabulary.name, name)
        self._triple_repository.update(subject, self._vocabulary.email, email)

        return self._one_row(user_id, name, email)

    def delete(self, user_id: str) -> None:
        subject = self._vocabulary.person(user_id)
        for triple in self._triple_repository.list(subject=subject):
            self._triple_repository.delete(subject, triple.predicate)

    def list(self) -> RecordSet:
        # TripleRepository.list() with no subject spans the whole store -
        # every subject, every predicate, not just users. Everything else
        # in the store today is seed vocabulary (shared/seed_data), but
        # that's exactly why filtering to `type == person_type` matters
        # here: it's what tells a Person subject apart from anything else
        # that might share the store later (a future form's rows, e.g.).
        all_triples = self._triple_repository.list()
        person_subjects = {
            triple.subject
            for triple in all_triples
            if triple.predicate == self._vocabulary.type and triple.object_value == self._vocabulary.person_type
        }

        subject_prefix = self._vocabulary.person("")
        rows = []
        for subject in person_subjects:
            by_predicate = {t.predicate: t.object_value for t in all_triples if t.subject == subject}
            rows.append(
                {
                    "id": subject.removeprefix(subject_prefix),
                    "name": by_predicate.get(self._vocabulary.name, ""),
                    "email": by_predicate.get(self._vocabulary.email, ""),
                }
            )

        return RecordSet(columns=USER_COLUMNS, rows=rows)

    def _one_row(self, user_id: str, name: str, email: str) -> RecordSet:
        return RecordSet(columns=USER_COLUMNS, rows=[{"id": user_id, "name": name, "email": email}])


__all__ = ["TripleUserRepository", "USER_COLUMNS"]
