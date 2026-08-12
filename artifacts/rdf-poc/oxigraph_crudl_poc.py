"""
Oxigraph CRUDL POC: exercise the individual-quad primitives an
OxigraphTripleRepository would actually need (add/remove/pattern-match),
as opposed to oxigraph_poc.py's bulk_load()/persistence check.

The point of this script isn't just "does CRUDL work" -- it's to make
concrete, against real behavior, the one semantic question that has to
be answered before OxigraphTripleRepository gets written: this
project's existing TripleRepository (shared/repositories/interfaces.py)
is deliberately SINGLE-VALUED -- create() raises if a (subject,
predicate) already has a value, update() requires exactly one existing
value to change. That was a scoped-down choice (see ADR-0008) made
*for* Postgres's shape. Oxigraph has no such constraint built in --
RDF is multi-valued by nature. Section 5 below proves that directly:
two objects for the same (subject, predicate) both persist and both
come back on query, which TripleRepository's contract would forbid.

That means OxigraphTripleRepository has a real design fork, not just an
implementation task:

  (a) Implement TripleRepository as-is (enforce single-valued in the
      repository layer, on top of a naturally multi-valued store) --
      gives a drop-in alternative to PostgresTripleRepository, but
      throws away the actual reason Oxigraph was chosen (genuine RDF
      multi-valued facts, e.g. ASR-004's user-subscribes-to-user
      triples).
  (b) A new interface that exposes real multi-valued semantics --
      keeps what Oxigraph is actually for, but is a new abstraction,
      not a drop-in replacement, and needs its own CRUDL contract
      defined (what does "delete" mean when there are 3 objects for
      one (subject, predicate)? all of them? one specific one?).

This script demonstrates both shapes concretely so that choice can be
made from real behavior, not guessed at.

Run with: python artifacts/rdf-poc/oxigraph_crudl_poc.py
"""

import pathlib
import shutil
import tempfile

import pyoxigraph as ox

HERE = pathlib.Path(__file__).parent
TTL_PATH = HERE / "blog_research_graph.ttl"

EX = "https://blogresearch.net/id"


def subject(local: str) -> ox.NamedNode:
    return ox.NamedNode(f"{EX}/{local}")


def predicate(local: str) -> ox.NamedNode:
    return ox.NamedNode(f"{EX}/organizations#{local}")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def main() -> None:
    store_dir = pathlib.Path(tempfile.mkdtemp(prefix="oxigraph_crudl_poc_"))
    try:
        store = ox.Store(str(store_dir))
        store.bulk_load(path=TTL_PATH, format=ox.RdfFormat.TURTLE)
        print(f"Loaded seed data into {store_dir} ({len(store)} triples)")

        # A real subject from the seed data (the "Python" organization).
        python_org = subject(
            "organizations/id=o4444444-dddd-eeee-ffff-444444444444"
        )
        name_pred = predicate("name")

        section("1. READ -- fetch one (subject, predicate)'s value(s)")
        results = list(store.quads_for_pattern(python_org, name_pred, None))
        print(f"  {[q.object.value for q in results]}")

        section("2. CREATE -- add a brand-new triple")
        note_pred = ox.NamedNode(f"{EX}/organizations#internal_note")
        store.add(ox.Quad(python_org, note_pred, ox.Literal("POC test note")))
        results = list(store.quads_for_pattern(python_org, note_pred, None))
        print(f"  after create: {[q.object.value for q in results]}")

        section(
            "3. UPDATE -- RDF has no atomic UPDATE primitive; "
            "it's remove-old-then-add-new"
        )
        old_quad = ox.Quad(python_org, note_pred, ox.Literal("POC test note"))
        store.remove(old_quad)
        store.add(ox.Quad(python_org, note_pred, ox.Literal("POC test note (edited)")))
        results = list(store.quads_for_pattern(python_org, note_pred, None))
        print(f"  after update: {[q.object.value for q in results]}")
        print(
            "  NOTE: remove() and add() are two separate calls, not one "
            "atomic operation -- a repository's update() would need to "
            "wrap both in the same transaction to avoid a window where "
            "neither value exists."
        )

        section("4. DELETE -- idempotent, like TripleRepository.delete()")
        store.remove(ox.Quad(python_org, note_pred, ox.Literal("POC test note (edited)")))
        results = list(store.quads_for_pattern(python_org, note_pred, None))
        print(f"  after delete: {[q.object.value for q in results]}")
        store.remove(ox.Quad(python_org, note_pred, ox.Literal("already gone")))
        print("  deleting an already-absent triple raised nothing (idempotent, confirmed)")

        section("5. LIST -- all triples for one subject")
        results = list(store.quads_for_pattern(python_org, None, None))
        print(f"  {len(results)} triples for the Python organization")

        section(
            "6. THE ACTUAL DESIGN QUESTION -- multi-valued facts, "
            "which TripleRepository's contract forbids"
        )
        tag_pred = ox.NamedNode(f"{EX}/organizations#tag")
        store.add(ox.Quad(python_org, tag_pred, ox.Literal("python")))
        store.add(ox.Quad(python_org, tag_pred, ox.Literal("beginner-friendly")))
        results = list(store.quads_for_pattern(python_org, tag_pred, None))
        print(f"  two objects added for the SAME (subject, predicate): tag_pred")
        print(f"  both persisted and both come back: {sorted(q.object.value for q in results)}")
        print(
            "  TripleRepository.create() would have raised ProviderError on "
            "the second add() -- this is exactly the capability Oxigraph "
            "was chosen for (see ASR-004's user-subscribes-to-user triples), "
            "and exactly what a single-valued-only repository would throw away."
        )

    finally:
        shutil.rmtree(store_dir, ignore_errors=True)
        print(f"\nCleaned up scratch store at {store_dir}")


if __name__ == "__main__":
    main()
