"""Install the shared starter vocabulary and example resources."""

import json
from importlib.resources import files

from shared.repositories.interfaces import Triple, TripleRepository
from shared.vocabulary import DEFAULT_BASE_URI


def _load_seed_triples(base_uri: str) -> list[Triple]:
    seed_file = files("shared.seed_data").joinpath("initial_triples.json")
    records = json.loads(seed_file.read_text(encoding="utf-8"))
    return [
        Triple(
            subject=record["subject"].replace("{base}", base_uri),
            predicate=record["predicate"].replace("{base}", base_uri),
            object_value=record["object_value"].replace("{base}", base_uri),
        )
        for record in records
    ]


def seed_initial_vocabulary(
    repository: TripleRepository,
    base_uri: str = DEFAULT_BASE_URI,
) -> list[Triple]:
    """Create absent starter triples and return all seed triples.

    Existing identical triples are left alone, making a new installation
    command safe to run more than once. A changed existing value raises
    instead of silently overwriting application data.
    """
    seeds = _load_seed_triples(base_uri)
    for triple in seeds:
        existing = repository.read(triple.subject, triple.predicate)
        if existing is None:
            repository.create(triple.subject, triple.predicate, triple.object_value)
        elif existing != triple:
            raise ValueError(f"Seed triple conflicts with existing data: {triple}")
    return seeds


__all__ = ["seed_initial_vocabulary"]