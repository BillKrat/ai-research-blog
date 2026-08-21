"""UserProfileViewModel: the bindable state for the user-profile page.

Deliberately does NOT implement shared/interfaces.py's IViewModel. That
contract is shaped for the hello-world demo's single result/error pair
(shared.mapping_view_model.MappingViewModel backs it with a flat
string-only session_state mapping) - a user record needs a whole
row of typed fields plus its display schema, which doesn't fit that
shape without distorting it. Per the 2026-08-17/2026-08-20 user-CRUDL
design sessions: a new, purpose-built type is the idiomatic move here,
not forcing a second concern into an interface built for the first
one. If a second page ever needs this same richer shape, that's the
moment to look for a shared abstraction - not before (see AGENTS.md's
"don't add an interface for one implementation" guidance, and
docs/adr/0009's shared/ vs blogresearch/ split: this stays in
blogresearch/ until a second consumer actually exists).
"""

from dataclasses import dataclass, field
from typing import Any

from shared.recordset import Column, RecordSet


@dataclass
class UserProfileViewModel:
    """Plain mutable state - unlike Triple/RecordSet, this is *meant* to
    change over a presenter's lifetime, so (unlike those) it is not frozen.

    columns: the display schema (Column.label/sequence/type) - set once
    at construction (see UserProfilePresenter.__init__) so it's always
    available, even before any row has been loaded - a brand-new "add a
    user" form still needs to know what fields to render.

    row: the current record's field values, keyed by Column.name - `{}`
    means "no record loaded / a new, unsaved user," the same "empty
    RecordSet" shape RecordSet itself documents.

    error: the last operation's error message, or "" - same convention
    as IViewModel.error elsewhere in this codebase.
    """

    columns: list[Column] = field(default_factory=list)
    row: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    _snapshot: dict[str, Any] = field(default_factory=dict, repr=False)

    def load(self, record_set: RecordSet) -> None:
        """Adopt a freshly-fetched/saved record as the current state.

        Always resets `error` to "" - load() is only ever called after
        an operation that already succeeded (see the presenter), so a
        stale error from a previous failed attempt shouldn't linger.
        Captures a snapshot of the row for undo() to return to later.
        """
        self.columns = record_set.columns
        self.row = dict(record_set.rows[0]) if record_set.rows else {}
        self._snapshot = dict(self.row)
        self.error = ""

    def clear(self) -> None:
        """Reset to an empty/new-user state - after a delete, or to start
        a fresh "add" - without discarding the known columns/schema."""
        self.row = {}
        self._snapshot = {}
        self.error = ""

    def undo(self) -> None:
        """Discard any in-memory edits to `row`, resetting it to the last
        snapshot load() captured - not a repository operation (nothing
        is re-fetched or re-persisted), per the user-CRUDL design
        session's explicit call that Undo is a view-model-level concern.
        A no-op if nothing has been loaded yet (snapshot is already `{}`).
        """
        self.row = dict(self._snapshot)


__all__ = ["UserProfileViewModel"]
