from shared.repositories.interfaces import Triple
from shared.seed_data import reseed, seed_initial_vocabulary
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

    def delete(self, subject, predicate):
        self.triples.pop((subject, predicate), None)

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


# --- reseed(): the destructive "kill and fill" counterpart ---


def test_reseed_deletes_data_seed_initial_vocabulary_would_have_left_alone():
    """The whole reason reseed() exists: seed_initial_vocabulary() can't
    change a value that's already there (by design - see its own
    docstring), which makes it useless for iterating on the seed file
    itself. reseed() deletes first, so a changed value in the seed file
    actually takes effect instead of raising ValueError."""
    repository = MemoryTripleRepository()
    seed_initial_vocabulary(repository, "https://example.test/2026/08/")

    # Simulate unrelated data that was never part of any seed file -
    # reseed() has no way to know that, and isn't supposed to: it wipes
    # everything in the repository, not just prior seed output.
    repository.create("unrelated-subject", "unrelated-predicate", "leftover")

    reseeded = reseed(repository, "https://example.test/2026/08/")

    assert len(reseeded) == 6
    assert repository.list() == reseeded
    assert repository.read("unrelated-subject", "unrelated-predicate") is None


def test_reseed_is_repeatable():
    """Matches seed_initial_vocabulary()'s own repeatability test - safe
    to run reseed() twice in a row and get the same end state, even
    though the mechanism (delete everything, recreate) is different."""
    repository = MemoryTripleRepository()

    first = reseed(repository, "https://example.test/2026/08/")
    second = reseed(repository, "https://example.test/2026/08/")

    assert second == first
    assert len(repository.list()) == 6


def test_reseed_on_an_empty_repository_just_fills():
    repository = MemoryTripleRepository()

    reseeded = reseed(repository, "https://example.test/2026/08/")

    assert len(reseeded) == 6
    assert len(repository.list()) == 6