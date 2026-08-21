"""Tests for UserProfileViewModel (blogresearch/viewmodels/).

Small, pure state - no repository, no service, no I/O anywhere in
this file. That's the point: this class's whole job is holding and
transforming state correctly, independent of where that state came
from, so it's worth proving in complete isolation before
UserProfilePresenter's own tests layer UserService on top.
"""

from shared.recordset import Column, RecordSet
from blogresearch.viewmodels.user_profile_view_model import UserProfileViewModel

_COLUMNS = [
    Column(name="id", label="ID", sequence=0, type="string"),
    Column(name="name", label="Name", sequence=1, type="string"),
    Column(name="email", label="Email", sequence=2, type="string"),
]


def test_starts_empty_with_no_columns_by_default():
    view_model = UserProfileViewModel()

    assert view_model.columns == []
    assert view_model.row == {}
    assert view_model.error == ""


def test_can_be_constructed_with_known_columns_before_any_row_is_loaded():
    """The concrete reason this constructor argument exists: a brand-new
    "add a user" form needs to know what fields to render before any
    user has ever been read - see the presenter, which does exactly this."""
    view_model = UserProfileViewModel(columns=_COLUMNS)

    assert view_model.columns == _COLUMNS
    assert view_model.row == {}


def test_load_adopts_the_recordsets_first_row():
    view_model = UserProfileViewModel()
    record_set = RecordSet(
        columns=_COLUMNS,
        rows=[{"id": "u1", "name": "Ada Lovelace", "email": "ada@example.com"}],
    )

    view_model.load(record_set)

    assert view_model.columns == _COLUMNS
    assert view_model.row == {"id": "u1", "name": "Ada Lovelace", "email": "ada@example.com"}


def test_load_with_no_rows_results_in_an_empty_row():
    view_model = UserProfileViewModel()

    view_model.load(RecordSet(columns=_COLUMNS, rows=[]))

    assert view_model.columns == _COLUMNS
    assert view_model.row == {}


def test_load_clears_a_prior_error():
    """load() is only ever called by the presenter after an operation that
    already succeeded - a stale error from an earlier failed attempt
    must not linger once a new, successful state is loaded."""
    view_model = UserProfileViewModel()
    view_model.error = "some earlier failure"

    view_model.load(RecordSet(columns=_COLUMNS, rows=[{"id": "u1", "name": "Ada", "email": "a@example.com"}]))

    assert view_model.error == ""


def test_clear_resets_row_and_error_but_keeps_columns():
    """After a delete, the form should go back to an empty/new-user state
    - but it should still know what fields to render (columns), the
    same reason the constructor accepts columns up front."""
    view_model = UserProfileViewModel()
    view_model.load(RecordSet(columns=_COLUMNS, rows=[{"id": "u1", "name": "Ada", "email": "a@example.com"}]))
    view_model.error = "leftover"

    view_model.clear()

    assert view_model.row == {}
    assert view_model.error == ""
    assert view_model.columns == _COLUMNS


def test_undo_resets_row_to_the_last_loaded_snapshot():
    view_model = UserProfileViewModel()
    view_model.load(RecordSet(columns=_COLUMNS, rows=[{"id": "u1", "name": "Ada Lovelace", "email": "ada@example.com"}]))

    # Simulate an in-progress, not-yet-saved edit.
    view_model.row["name"] = "Some Unsaved Typo"

    view_model.undo()

    assert view_model.row == {"id": "u1", "name": "Ada Lovelace", "email": "ada@example.com"}


def test_undo_does_not_reach_back_into_the_original_recordsets_row_dict():
    """load() must copy the row, not alias it - mutating view_model.row
    after load() must never leak back into the RecordSet that produced
    it (which some other caller might still be holding a reference to)."""
    original_row = {"id": "u1", "name": "Ada Lovelace", "email": "ada@example.com"}
    record_set = RecordSet(columns=_COLUMNS, rows=[original_row])
    view_model = UserProfileViewModel()

    view_model.load(record_set)
    view_model.row["name"] = "Mutated After Load"

    assert original_row["name"] == "Ada Lovelace"


def test_undo_before_any_load_is_a_harmless_noop():
    view_model = UserProfileViewModel(columns=_COLUMNS)

    view_model.undo()

    assert view_model.row == {}
