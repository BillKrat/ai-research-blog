"""Oxigraph-backed implementation of TripleRepository.

Drop-in alternative to PostgresTripleRepository - same interface, same
single-valued CRUDL contract (ADR-0008) - backed by an embedded RDF
store instead of Postgres. See the "CRUDL POC" section of
artifacts/rdf-poc/FINDINGS.md for why this enforces single-valued
behavior even though Oxigraph itself supports genuine RDF multi-valued
facts: that capability was deliberately deferred, not forgotten, until
a concrete consumer (ASR-004) needs it.
"""

import os
from pathlib import Path
from urllib.parse import quote, unquote

import pyoxigraph as ox

from shared.exceptions import ProviderError
from shared.repositories.interfaces import Triple, TripleRepository

# RDF requires subject/predicate to be valid absolute IRIs (NamedNode
# rejects a bare string like "unit-test-1" - "No scheme found in an
# absolute IRI"), but TripleRepository's contract takes arbitrary
# opaque strings, the same way the Postgres text columns do. These two
# fixed namespaces plus percent-encoding give every subject/predicate
# string a valid, reversible IRI, regardless of what characters it
# contains. Kept separate (rather than one shared namespace) purely so
# a human inspecting the store directly can tell which role a given
# node was playing.
_SUBJECT_NS = "urn:triple-repository:subject:"
_PREDICATE_NS = "urn:triple-repository:predicate:"


def _subject_node(subject: str) -> ox.NamedNode:
    return ox.NamedNode(_SUBJECT_NS + quote(subject, safe=""))


def _predicate_node(predicate: str) -> ox.NamedNode:
    return ox.NamedNode(_PREDICATE_NS + quote(predicate, safe=""))


def _decode(node: ox.NamedNode, namespace: str) -> str:
    return unquote(node.value[len(namespace):])


class OxigraphTripleRepository(TripleRepository):
    """CRUDL over an embedded pyoxigraph.Store, single-valued per (subject, predicate).

    store_path resolves the same way PostgresTripleRepository resolves
    conn_string - explicit argument, then an environment variable
    (OXIGRAPH_STORE_PATH) - but unlike DATABASE_URL, an unset path is
    not an error: pyoxigraph.Store() with no path is a real, fully
    functional in-memory store, not a placeholder. That's also why
    tests for this class don't need a fake the way
    test_triple_repository.py's Postgres tests do - a real in-memory
    Store is already instant and offline, so faking one would just be
    reimplementing what Oxigraph already gives us for free.

    Important operational constraint, confirmed directly (see
    tests/test_oxigraph_triple_repository.py's persistence test): an
    on-disk store_path can only ever be held open by ONE live Store
    object at a time - a RocksDB file lock, not a Python-level
    restriction. A second OxigraphTripleRepository constructed against
    the same path while the first is still alive raises ProviderError
    ("lock hold by current process"). This is a stricter version of
    the multi-replica concurrency question already flagged in the
    project-oxigraph-candidate-evaluation memory: it bites even
    sequentially, within a single process, not only across multiple
    app instances. Whoever wires this into
    blogresearch/config/registrations.py should keep one long-lived
    instance (composition-root singleton, the same lifetime shape
    Container already gives resolved instances), not construct a new
    one per request the way a stateless provider might.
    """

    def __init__(
        self,
        store_path: str | None = None,
        store: ox.Store | None = None,
    ) -> None:
        if store is not None:
            self.store = store
            return
        resolved_path = store_path or os.environ.get("OXIGRAPH_STORE_PATH")
        try:
            if resolved_path:
                # pyoxigraph only creates the leaf directory of
                # resolved_path if missing, not its parents (confirmed
                # directly: "./local_data/oxigraph" raises FileNotFoundError
                # when "./local_data/" doesn't exist yet) - unlike
                # PostgresTripleRepository, which has no local filesystem
                # state to prepare.
                Path(resolved_path).mkdir(parents=True, exist_ok=True)
                self.store = ox.Store(resolved_path)
            else:
                self.store = ox.Store()
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc

    def create(self, subject: str, predicate: str, object_value: str) -> Triple:
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            if next(self.store.quads_for_pattern(s, p, None), None) is not None:
                raise ProviderError(
                    f"Triple already exists for subject={subject!r}, "
                    f"predicate={predicate!r}"
                )
            self.store.add(ox.Quad(s, p, ox.Literal(object_value)))
            self.store.flush()
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        return Triple(subject, predicate, object_value)

    def read(self, subject: str, predicate: str) -> Triple | None:
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            quad = next(self.store.quads_for_pattern(s, p, None), None)
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        return Triple(subject, predicate, quad.object.value) if quad else None

    def update(self, subject: str, predicate: str, object_value: str) -> Triple:
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            existing = list(self.store.quads_for_pattern(s, p, None))
            if not existing:
                raise ProviderError(
                    f"No triple to update for subject={subject!r}, "
                    f"predicate={predicate!r}"
                )
            # RDF has no atomic UPDATE primitive (confirmed in
            # oxigraph_crudl_poc.py) - remove the old quad(s), then add
            # the new one, both against the same in-process Store.
            for quad in existing:
                self.store.remove(quad)
            self.store.add(ox.Quad(s, p, ox.Literal(object_value)))
            self.store.flush()
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        return Triple(subject, predicate, object_value)

    def delete(self, subject: str, predicate: str) -> None:
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            for quad in list(self.store.quads_for_pattern(s, p, None)):
                self.store.remove(quad)
            self.store.flush()
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc

    def list(self, subject: str | None = None) -> list[Triple]:
        try:
            if subject is not None:
                quads = self.store.quads_for_pattern(_subject_node(subject), None, None)
            else:
                quads = self.store.quads_for_pattern(None, None, None)
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc

        triples = [
            Triple(
                _decode(quad.subject, _SUBJECT_NS),
                _decode(quad.predicate, _PREDICATE_NS),
                quad.object.value,
            )
            for quad in quads
            # Defensive: the same store can hold RDF loaded from
            # elsewhere (e.g. the morph-kgc blog graph in
            # artifacts/rdf-poc/) if a caller ever points store_path at
            # a shared file. list() should only ever return rows this
            # repository itself owns, the same way the Postgres
            # implementation only ever sees the triple_store table.
            if quad.subject.value.startswith(_SUBJECT_NS)
            and quad.predicate.value.startswith(_PREDICATE_NS)
        ]
        return sorted(triples, key=lambda t: (t.subject, t.predicate))
