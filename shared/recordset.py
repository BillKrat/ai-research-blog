"""Column/RecordSet: the schema-shaped DTO passed between layers.

Where Triple (shared/repositories/interfaces.py) is the unit of storage
- one fact at a time - RecordSet is the unit everything *above* a
repository deals in: a repository pivots triples for one or more
subjects into rows against a fixed column schema, and every layer
above it (service, view-model, view) passes that RecordSet through
unchanged. No layer above a repository needs to know a Triple, or a
store, exists - that's the whole point of this shape (see
docs/adr/0011 and the user-CRUDL design it comes from).

Deliberately not named after ADO.NET's DataSet/DataTable - same idea
(columns describe shape, rows carry data), different vocabulary, since
this is a Python project, not a port of one.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Column:
    """One field's shape and display metadata, independent of any row's value.

    A RecordSet's `columns` list is itself the schema - a form renders
    one input per Column, ordered by `sequence`; a grid renders one
    table column per Column, same ordering. Neither the form nor the
    grid needs any code specific to which fields exist - that's driven
    entirely by what columns a repository decides to include.

    type is a deliberately small, closed vocabulary - "string" |
    "integer" | "boolean" | "date" - rather than an open string or a
    speculative type hierarchy. Expand it only when a second real type
    actually shows up in a schema; a vocabulary designed ahead of a
    real second case is exactly the kind of premature generalization
    this project's AGENTS.md warns against.
    """

    name: str
    label: str
    sequence: int
    type: str
    length: int | None = None


@dataclass(frozen=True)
class RecordSet:
    """A schema (`columns`) paired with the rows that match it.

    Each row is a plain dict keyed by Column.name - not a typed class
    per schema - because the schema itself is data (it comes from a
    repository, ultimately from triples), not something known at
    class-definition time. A future user-defined form (ADR-0004) is
    exactly this: a schema nobody hand-wrote a class for.

    Nothing here validates that a row's keys match `columns`, or that
    a value matches its Column's `type` - RecordSet is a transport
    shape, not a validator. Whichever layer constructs one (a
    repository, pivoting triples into rows) is responsible for
    building it correctly, the same way TripleRepository's callers are
    responsible for passing well-formed triples.
    """

    columns: list[Column]
    rows: list[dict[str, Any]]


__all__ = ["Column", "RecordSet"]
