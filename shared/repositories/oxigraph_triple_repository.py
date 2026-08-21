"""Oxigraph-backed implementation of TripleRepository.

Drop-in alternative to PostgresTripleRepository - same interface, same
single-valued CRUDL contract (ADR-0008) - backed by an embedded RDF
store instead of Postgres. See the "CRUDL POC" section of
artifacts/rdf-poc/FINDINGS.md for why this enforces single-valued
behavior even though Oxigraph itself supports genuine RDF multi-valued
facts: that capability was deliberately deferred, not forgotten, until
a concrete consumer (ASR-004) needs it.

Triple.id (see docs/adr/0010) is stored in each quad's own graph_name
component - see _ID_NS below for why that's the correct RDF-native
slot for it, rather than a synthetic fourth triple.
"""

# Required - see shared/repositories/interfaces.py's own copy of this
# comment: a method named `list` shadows the builtin for the rest of
# this class body, breaking a later method's `-> list[Triple]`
# annotation unless annotations are deferred to strings.
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Mapping
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

# id lives in the quad's own graph_name component - pyoxigraph's Store
# is a genuine quad store (Quad = subject, predicate, object, AND a
# graph_name), not just a triple store; every quad added elsewhere in
# this file already implicitly used the default graph. Using the real
# graph_name slot for id, rather than inventing a fourth synthetic
# triple, is what actually disambiguates correctly: a single subject
# routinely has several predicates (the seed data does - see
# initial_triples.json's "type"/"name" pairs), so an id attached only
# to the subject node couldn't tell those slots apart. Attached to the
# (subject, predicate) quad itself, via graph_name, there's no
# ambiguity - see docs/adr/0010.
_ID_NS = "urn:triple-repository:id:"


def _subject_node(subject: str) -> ox.NamedNode:
    return ox.NamedNode(_SUBJECT_NS + quote(subject, safe=""))


def _predicate_node(predicate: str) -> ox.NamedNode:
    return ox.NamedNode(_PREDICATE_NS + quote(predicate, safe=""))


def _id_graph(id_: str) -> ox.NamedNode:
    return ox.NamedNode(_ID_NS + quote(id_, safe=""))


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

    def create(
        self, subject: str, predicate: str, object_value: str, id: str | None = None
    ) -> Triple:
        resolved_id = id or str(uuid.uuid4())
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            if next(self.store.quads_for_pattern(s, p, None), None) is not None:
                raise ProviderError(
                    f"Triple already exists for subject={subject!r}, "
                    f"predicate={predicate!r}"
                )
            self.store.add(ox.Quad(s, p, ox.Literal(object_value), _id_graph(resolved_id)))
            self.store.flush()
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        return Triple(subject, predicate, object_value, id=resolved_id)

    def read(self, subject: str, predicate: str) -> Triple | None:
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            quad = next(self.store.quads_for_pattern(s, p, None), None)
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        if quad is None:
            return None
        return Triple(subject, predicate, quad.object.value, id=_decode(quad.graph_name, _ID_NS))

    def update(self, subject: str, predicate: str, object_value: str) -> Triple:
        s, p = _subject_node(subject), _predicate_node(predicate)
        try:
            existing = list(self.store.quads_for_pattern(s, p, None))
            if not existing:
                raise ProviderError(
                    f"No triple to update for subject={subject!r}, "
                    f"predicate={predicate!r}"
                )
            # id carries over from the existing quad(s) - an UPDATE
            # changes object_value, never identity.
            resolved_id = _decode(existing[0].graph_name, _ID_NS)
            # RDF has no atomic UPDATE primitive (confirmed in
            # oxigraph_crudl_poc.py) - remove the old quad(s), then add
            # the new one, both against the same in-process Store.
            for quad in existing:
                self.store.remove(quad)
            self.store.add(ox.Quad(s, p, ox.Literal(object_value), _id_graph(resolved_id)))
            self.store.flush()
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        return Triple(subject, predicate, object_value, id=resolved_id)

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
                id=_decode(quad.graph_name, _ID_NS),
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

    def find(self, criteria: Mapping[str, str]) -> list[Triple]:
        if not criteria:
            return []
        try:
            matching_subjects: set[ox.NamedNode] | None = None
            for predicate, object_value in criteria.items():
                subjects_for_pair = {
                    quad.subject
                    for quad in self.store.quads_for_pattern(
                        None, _predicate_node(predicate), ox.Literal(object_value)
                    )
                    if quad.subject.value.startswith(_SUBJECT_NS)
                }
                # Intersect across pairs - a real AND, same as the
                # Postgres implementation's HAVING COUNT(DISTINCT
                # predicate) = len(pairs). Short-circuits the moment the
                # running intersection is empty, since it can only shrink
                # from there - pyoxigraph's native quad-pattern matching
                # already makes each individual lookup cheap, this just
                # avoids doing unnecessary further lookups on top of that.
                matching_subjects = (
                    subjects_for_pair
                    if matching_subjects is None
                    else matching_subjects & subjects_for_pair
                )
                if not matching_subjects:
                    return []

            triples = [
                Triple(
                    _decode(quad.subject, _SUBJECT_NS),
                    _decode(quad.predicate, _PREDICATE_NS),
                    quad.object.value,
                    id=_decode(quad.graph_name, _ID_NS),
                )
                for subject in matching_subjects
                for quad in self.store.quads_for_pattern(subject, None, None)
                if quad.predicate.value.startswith(_PREDICATE_NS)
            ]
        except OSError as exc:
            raise ProviderError(f"Oxigraph error: {exc}") from exc
        return sorted(triples, key=lambda t: (t.subject, t.predicate))
