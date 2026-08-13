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


def reseed(
    repository: TripleRepository,
    base_uri: str = DEFAULT_BASE_URI,
) -> list[Triple]:
    """Replace everything in repository with the seed set: kill, then fill.

    Unlike seed_initial_vocabulary() - safe to re-run, leaves existing
    data alone, raises on conflict - this is destructive by design: every
    existing triple is deleted first, regardless of whether it came from
    a previous seed or not, then every seed triple is created fresh. The
    dev-iteration workflow this exists for ("change the seed file, see
    the store reflect it") needs that - a conflict-safe seed can't change
    a value that's already there, which defeats the purpose of iterating
    on the seed file itself.

    Works against whichever TripleRepository backend is passed in - the
    same seed file and this same function reseed either Postgres or
    Oxigraph, since both implement the identical CRUDL contract (see
    ADR-0008). Callers are responsible for only pointing this at a store
    they actually want wiped - this function has no concept of
    local-vs-deployed and enforces no such guard itself.
    """
    for triple in repository.list():
        repository.delete(triple.subject, triple.predicate)
    seeds = _load_seed_triples(base_uri)
    for triple in seeds:
        repository.create(triple.subject, triple.predicate, triple.object_value)
    return seeds


__all__ = ["seed_initial_vocabulary", "reseed"]