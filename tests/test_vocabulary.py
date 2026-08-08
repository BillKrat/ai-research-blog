from shared.repositories.interfaces import Triple
from shared.seed_data import seed_initial_vocabulary
from shared.vocabulary import DEFAULT_BASE_URI, Vocabulary


class MemoryTripleRepository:
    def __init__(self):
        self.triples = {}

    def create(self, subject, predicate, object_value):
        triple = Triple(subject, predicate, object_value)
        self.triples[(subject, predicate)] = triple
        return triple

    def read(self, subject, predicate):
        return self.triples.get((subject, predicate))

    def list(self, subject=None):
        values = list(self.triples.values())
        return [triple for triple in values if subject is None or triple.subject == subject]


def test_vocabulary_uses_the_application_base_uri():
    vocabulary = Vocabulary("https://example.test/2026/08/")

    assert vocabulary.person == "https://example.test/2026/08/Person"
    assert vocabulary.dataset == "https://example.test/2026/08/DataSet"
    assert vocabulary.database_schema_class == "https://example.test/2026/08/DatabaseSchema"
    assert vocabulary.type == "https://example.test/2026/08/type"


def test_default_vocabulary_base_uri_is_the_live_site():
    assert Vocabulary().base_uri == DEFAULT_BASE_URI


def test_seed_data_is_repeatable():
    repository = MemoryTripleRepository()

    first = seed_initial_vocabulary(repository, "https://example.test/2026/08/")
    second = seed_initial_vocabulary(repository, "https://example.test/2026/08/")

    assert len(first) == 6
    assert second == first
    assert len(repository.list()) == 6
    assert repository.read(
        "https://example.test/2026/08/seed/dataset/example",
        "https://example.test/2026/08/type",
    ) == Triple(
        "https://example.test/2026/08/seed/dataset/example",
        "https://example.test/2026/08/type",
        "https://example.test/2026/08/DataSet",
    )