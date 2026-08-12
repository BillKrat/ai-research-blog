"""
Oxigraph POC: load the morph-kgc-generated blog_research_graph.ttl into an
on-disk pyoxigraph store and confirm it holds up under conditions the
project actually cares about, not just "does .load() work."

Answers two specific open questions from the Oxigraph candidate
evaluation (see FINDINGS.md's "CLOSED OUT" section and the
project-oxigraph-candidate-evaluation memory):

1. Does Store.bulk_load() exist and behave as the (AI-generated,
   unverified) research file claimed? Already confirmed against the
   installed package's own docstring before writing this script -- see
   FINDINGS.md for that check. This script exercises it for real.
2. Does an on-disk store actually persist to disk, independent of the
   Store object that wrote it? Step 2 below deliberately opens a BRAND
   NEW Store pointed at the same directory, in the same process, to
   prove the data survived past the writing Store -- not just that
   Python's object stayed alive.

Run with: python artifacts/rdf-poc/oxigraph_poc.py
"""

import pathlib
import shutil
import tempfile

import pyoxigraph as ox

HERE = pathlib.Path(__file__).parent
TTL_PATH = HERE / "blog_research_graph.ttl"

ORGANIZATIONS_CLASS = "https://blogresearch.net/id/organizations"
ORGANIZATIONS_NAME_PREDICATE = "https://blogresearch.net/id/organizations#name"


def bulk_load(store_dir: pathlib.Path) -> None:
    store = ox.Store(str(store_dir))
    store.bulk_load(path=TTL_PATH, format=ox.RdfFormat.TURTLE)
    store.flush()  # force RocksDB to commit to disk before we test persistence


def count_triples(store_dir: pathlib.Path) -> int:
    store = ox.Store(str(store_dir))
    row = next(iter(store.query("SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }")))
    return int(row["c"].value)


def list_organizations(store_dir: pathlib.Path) -> list[tuple[str, str]]:
    store = ox.Store(str(store_dir))
    results = store.query(f"""
        SELECT ?org ?name WHERE {{
            ?org a <{ORGANIZATIONS_CLASS}> ;
                 <{ORGANIZATIONS_NAME_PREDICATE}> ?name .
        }}
        ORDER BY ?name
    """)
    return [(row["name"].value, row["org"].value) for row in results]


def main() -> None:
    store_dir = pathlib.Path(tempfile.mkdtemp(prefix="oxigraph_poc_"))
    try:
        print(f"Scratch on-disk store: {store_dir}\n")

        print("=== Step 1: bulk_load blog_research_graph.ttl ===")
        bulk_load(store_dir)
        print("Loaded and flushed to disk.\n")

        print("=== Step 2: reopen the SAME directory in a NEW Store instance ===")
        print("(this is the persistence test -- nothing here reuses the Store above)")
        count = count_triples(store_dir)
        print(f"Triple count after reopen: {count}")
        expected = 197  # from the original morph-kgc POC, see FINDINGS.md
        status = "MATCH" if count == expected else "MISMATCH"
        print(f"Expected (from morph-kgc POC): {expected}  ->  {status}\n")

        print("=== Step 3: real SPARQL query against the reopened store ===")
        orgs = list_organizations(store_dir)
        print(f"Organizations found: {len(orgs)}")
        for name, uri in orgs:
            print(f"  {name:12}  <{uri}>")

    finally:
        shutil.rmtree(store_dir, ignore_errors=True)
        print(f"\nCleaned up scratch store at {store_dir}")


if __name__ == "__main__":
    main()
