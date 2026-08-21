"""Tests for Column/RecordSet (shared/recordset.py).

This is a small, deliberately dumb DTO - there's no logic to test in
the usual sense (no branches, no error paths). What these tests
actually document is the *contract* every layer above a repository
relies on: rows are plain dicts keyed by column name, columns describe
display order via `sequence` independent of row order, and both
dataclasses are frozen (immutable) the same way Triple is - see
shared/repositories/interfaces.py's Triple for the sibling shape this
one is modeled on, one level up: Triple is one fact, RecordSet is a
whole schema-shaped table of them after a repository has pivoted
triples into rows.
"""

import dataclasses

import pytest

from shared.recordset import Column, RecordSet


def test_column_holds_its_own_display_metadata():
    """A Column is self-describing - name, label, order, and type all live on it.

    Nothing external (a template, a hardcoded form layout) needs to
    know these facts separately - a renderer reads them straight off
    the Column.
    """
    column = Column(name="email", label="Email Address", sequence=2, type="string")

    assert column.name == "email"
    assert column.label == "Email Address"
    assert column.sequence == 2
    assert column.type == "string"
    assert column.length is None  # optional - only meaningful for bounded types


def test_column_length_is_optional_and_defaults_to_none():
    """length only matters for a type with a bound (e.g. a varchar) - most
    columns won't set it, so it defaults rather than being required."""
    unbounded = Column(name="name", label="Name", sequence=1, type="string")
    bounded = Column(name="name", label="Name", sequence=1, type="string", length=100)

    assert unbounded.length is None
    assert bounded.length == 100


def test_column_is_frozen():
    """Columns describe schema - mutating one after construction would let a
    renderer and the schema it read from silently drift apart. Same
    discipline as Triple's frozen dataclass."""
    column = Column(name="email", label="Email", sequence=1, type="string")

    with pytest.raises(dataclasses.FrozenInstanceError):
        column.label = "Something else"


def test_recordset_pairs_columns_with_rows_keyed_by_column_name():
    """The whole point of RecordSet: rows are plain dicts, keyed by each
    Column's `name` - not a bespoke class per schema, since the schema
    itself is data a repository produces, not something known ahead of
    time (see the module docstring's ADR-0004 form-schema example)."""
    columns = [
        Column(name="name", label="Name", sequence=1, type="string"),
        Column(name="email", label="Email", sequence=2, type="string"),
    ]
    rows = [{"name": "Ada Lovelace", "email": "ada@example.com"}]

    record_set = RecordSet(columns=columns, rows=rows)

    assert record_set.columns == columns
    assert record_set.rows[0]["name"] == "Ada Lovelace"
    assert record_set.rows[0]["email"] == "ada@example.com"


def test_recordset_can_be_empty():
    """An empty RecordSet (a schema with zero rows) is the normal shape for
    "new record" / "no results yet" - a form's Add action, or a grid
    before its first row is created, per the user-CRUDL design's Undo
    behavior living at the view-model level, not here."""
    columns = [Column(name="name", label="Name", sequence=1, type="string")]

    record_set = RecordSet(columns=columns, rows=[])

    assert record_set.columns == columns
    assert record_set.rows == []


def test_columns_render_in_sequence_order_independent_of_list_order():
    """`sequence` - not the columns list's own order - is what a renderer
    should sort by. This test deliberately constructs the list
    out-of-order to prove callers can't rely on list order by accident."""
    columns = [
        Column(name="email", label="Email", sequence=2, type="string"),
        Column(name="name", label="Name", sequence=1, type="string"),
    ]

    ordered = sorted(columns, key=lambda column: column.sequence)

    assert [column.name for column in ordered] == ["name", "email"]


def test_recordset_is_frozen_but_its_rows_list_is_still_a_mutable_list():
    """RecordSet itself is frozen (you can't reassign .columns or .rows to a
    *different* list/value after construction) - but frozen only applies
    one level deep, a dataclass concept worth calling out explicitly
    since it can surprise someone coming from a language where "readonly"
    usually means deeply immutable. The list object .rows points at is
    ordinary and still mutable in place; nothing here relies on that,
    but it's worth knowing rather than assuming true immutability."""
    columns = [Column(name="name", label="Name", sequence=1, type="string")]
    record_set = RecordSet(columns=columns, rows=[])

    with pytest.raises(dataclasses.FrozenInstanceError):
        record_set.rows = [{"name": "reassigned"}]

    # But mutating the existing list object in place is not blocked -
    # frozen guards attribute *reassignment*, not the mutability of
    # whatever object an attribute happens to hold.
    record_set.rows.append({"name": "Grace Hopper"})
    assert record_set.rows == [{"name": "Grace Hopper"}]
