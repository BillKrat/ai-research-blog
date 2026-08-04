# 0004. Postgres-backed triple store for user-defined forms

Status: Proposed (design intent, not yet built)
Date: 2026-08-01

## Context

This predates the MVP/DI/provider work in ADR-0002/0003 and is still
the actual product goal — that work is foundation, not the feature
itself. `PostgresProvider` today just reads one row from a fixture
table via `IDbProvider`.

The goal: users design their own forms — choose fields, lay them out,
and CRUDL (Create/Read/Update/Delete/List) their own form data —
without a developer defining a fixed schema per form up front.

The user has production experience with RDF triple stores (prior work
in Utility Engineering) and strong opinions earned from it:

- **What's good:** a `(subject, predicate, object)` model fits
  schema-less, user-defined forms — no migration needed every time
  someone adds a field.
- **What was bad, deliberately avoided here:** the prior system's
  ontologies were designed by architects for architects, and SPARQL
  was a barrier for developers.
- **Known tradeoff, scoped around deliberately:** pivoting triples
  back into rows/columns is expensive at volume (learned the hard way
  processing thousands of pump records in the prior system). This
  project's use case — user-generated forms, picklists, simple record
  structures — is the low-hanging-fruit case where that cost doesn't
  bite. Don't reach for this pattern for high-volume/bulk-record use
  cases without re-evaluating.

## Decision

- Query the triple table with plain SQL — **no SPARQL**, kept simple
  and developer-friendly.
- Two DTO shapes depending on content:
  - **Grid/tabular data** (rows of form submissions) →
    `pandas.DataFrame` → render/edit via Streamlit's built-in
    `st.data_editor`, which already gives an editable grid with
    add/delete-row support largely for free.
  - **Form layout metadata** (labels, field types, position) → a
    lightweight dict or Pydantic model — structural/config data, not
    tabular data.
  - Exact routing logic (how the app decides which DTO type applies
    to a given predicate/subject) is still to be worked out.
- A `FormDataRepository`-style abstract base class (`get`, `save`,
  `list`, `delete`; exact signatures TBD), built on top of an
  `IDbProvider` implementation (ADR-0003) — not in place of it.
  Postgres-backed triple store is the first concrete implementation.
  Business logic and the UI depend only on the repository interface,
  never on Postgres or triples directly, so a different storage
  backend can be swapped in later for use cases that don't suit
  triples well.
- No DI framework — extend `config/container.py`'s registry pattern
  rather than introducing a container library.
- ~~Packaging/extraction into a standalone, reusable library is
  explicitly deferred until there's a second real consumer app.~~
  **Superseded by [docs/adr/0009](0009-extract-reusable-framework-into-shared.md)
  (2026-08-04):** the *internal* boundary (reusable code into
  `shared/`) is no longer deferred — the framework settled enough to
  sort that out now, while it's cheap. Formal packaging
  (`pyproject.toml`, installable by a second app) is still deferred;
  see ADR-0009 for the distinction.

## Still open

- Exact triple table schema (columns, types, how `object` values of
  different types — text, number, date — are stored). The current
  `triple_store` fixture table (`subject, predicate, object_value`,
  all text) is a test fixture, not this schema.
- `psycopg2` raw queries vs. an ORM — leaning toward raw queries for
  simplicity given the schema is one triple table, open to
  reconsidering.
- `FormDataRepository`'s exact method signatures and the DTO routing
  logic.
- A first concrete form to build end-to-end as the proof of concept.

## Consequences

- Nothing here is built yet — `PostgresProvider` remains a
  fixture-table read until this is picked up.
- Every subsequent Postgres/forms-related decision should be checked
  against this ADR before diverging from it.

**Update (2026-08-04):** A generic `TripleRepository` — CRUDL over
raw `(subject, predicate, object_value)` rows, not yet form-shaped —
is now built; see
[docs/adr/0008](0008-triple-repository-first-implementation.md) for
its scope and the schema/signature decisions it makes. `FormDataRepository`
itself (form-specific DTOs, schema representation, the first concrete
form) is still not built and still has the open questions below.
