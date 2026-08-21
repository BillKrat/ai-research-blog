"""Tests for UserProfilePresenter (blogresearch/presenters/).

Uses a fake UserService (not unittest.mock) - same "fakes, not mocks"
approach as the rest of this codebase. Structured like
test_presenter.py's coverage of HelloPresenter/DbHelloPresenter/
CustomPresenter: one success test and one ProviderError test per
action, proving the same error-handling shape (report on
view_model.error, leave view_model.row untouched) holds here too.
"""

import pytest

from shared.exceptions import ProviderError
from shared.recordset import Column, RecordSet
from shared.user_service import UserCreateRequest, UserService, UserUpdateRequest

from blogresearch.presenters.user_profile_presenter import UserProfilePresenter

_COLUMNS = [
    Column(name="id", label="ID", sequence=0, type="string"),
    Column(name="name", label="Name", sequence=1, type="string"),
    Column(name="email", label="Email", sequence=2, type="string"),
]


class _FakeUserService(UserService):
    """A UserService that never touches a real UserRepository - just
    canned/recorded behavior, enough to drive the presenter's success
    and failure paths independently of any real storage."""

    def __init__(self):
        # Deliberately not calling super().__init__() - this fake replaces
        # every method UserService has, so it needs no real UserRepository
        # underneath at all.
        self.users: dict[str, dict] = {}
        self.raise_on: str | None = None  # method name to fail, or None

    def _maybe_raise(self, method: str):
        if self.raise_on == method:
            raise ProviderError(f"{method} failed")

    def create(self, request: UserCreateRequest) -> RecordSet:
        self._maybe_raise("create")
        user_id = f"user-{len(self.users) + 1}"
        self.users[user_id] = {"id": user_id, "name": request.name, "email": request.email}
        return RecordSet(columns=_COLUMNS, rows=[self.users[user_id]])

    def read(self, user_id: str) -> RecordSet | None:
        self._maybe_raise("read")
        row = self.users.get(user_id)
        return None if row is None else RecordSet(columns=_COLUMNS, rows=[row])

    def update(self, user_id: str, request: UserUpdateRequest) -> RecordSet:
        self._maybe_raise("update")
        self.users[user_id] = {"id": user_id, "name": request.name, "email": request.email}
        return RecordSet(columns=_COLUMNS, rows=[self.users[user_id]])

    def delete(self, user_id: str) -> None:
        self._maybe_raise("delete")
        self.users.pop(user_id, None)

    def list(self) -> RecordSet:
        self._maybe_raise("list")
        return RecordSet(columns=_COLUMNS, rows=list(self.users.values()))


@pytest.fixture
def service():
    return _FakeUserService()


@pytest.fixture
def presenter(service):
    return UserProfilePresenter(service)


def test_starts_with_known_columns_and_an_empty_row(presenter):
    """Proves the presenter, not just the ViewModel, wires columns up
    front - see UserProfileViewModel's own test for the mechanism this
    relies on."""
    assert presenter.view_model.columns == _COLUMNS
    assert presenter.view_model.row == {}
    assert presenter.view_model.error == ""


def test_on_add_creates_a_user_and_loads_it(presenter):
    presenter.on_add(name="Ada Lovelace", email="ada@example.com")

    assert presenter.view_model.error == ""
    assert presenter.view_model.row["name"] == "Ada Lovelace"
    assert presenter.view_model.row["email"] == "ada@example.com"
    assert presenter.view_model.row["id"]


def test_on_add_reports_a_provider_error_without_touching_row(presenter, service):
    service.raise_on = "create"

    presenter.on_add(name="Ada Lovelace", email="ada@example.com")

    assert presenter.view_model.error == "create failed"
    assert presenter.view_model.row == {}  # unchanged - nothing was ever loaded


def test_on_load_fetches_an_existing_user(presenter, service):
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    user_id = created.rows[0]["id"]

    presenter.on_load(user_id)

    assert presenter.view_model.error == ""
    assert presenter.view_model.row["name"] == "Ada Lovelace"


def test_on_load_reports_an_error_for_a_user_that_does_not_exist(presenter):
    presenter.on_load("no-such-id")

    assert presenter.view_model.error == "No user found for id 'no-such-id'"
    assert presenter.view_model.row == {}


def test_on_load_reports_a_provider_error_without_touching_row(presenter, service):
    # Load someone real first, so we can prove a later failure doesn't
    # clobber what was already showing.
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    presenter.on_load(created.rows[0]["id"])
    service.raise_on = "read"

    presenter.on_load(created.rows[0]["id"])

    assert presenter.view_model.error == "read failed"
    assert presenter.view_model.row["name"] == "Ada Lovelace"  # untouched


def test_on_edit_updates_and_loads_the_user(presenter, service):
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    user_id = created.rows[0]["id"]

    presenter.on_edit(user_id, name="Ada, Countess of Lovelace", email="ada@new.example.com")

    assert presenter.view_model.error == ""
    assert presenter.view_model.row["name"] == "Ada, Countess of Lovelace"
    assert presenter.view_model.row["email"] == "ada@new.example.com"


def test_on_edit_reports_a_provider_error_without_touching_row(presenter, service):
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    presenter.on_load(created.rows[0]["id"])
    service.raise_on = "update"

    presenter.on_edit(created.rows[0]["id"], name="Someone Else", email="someone@example.com")

    assert presenter.view_model.error == "update failed"
    assert presenter.view_model.row["name"] == "Ada Lovelace"  # untouched


def test_on_delete_clears_the_row_but_keeps_columns(presenter, service):
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    presenter.on_load(created.rows[0]["id"])

    presenter.on_delete(created.rows[0]["id"])

    assert presenter.view_model.error == ""
    assert presenter.view_model.row == {}
    assert presenter.view_model.columns == _COLUMNS


def test_on_delete_reports_a_provider_error_without_clearing_row(presenter, service):
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    presenter.on_load(created.rows[0]["id"])
    service.raise_on = "delete"

    presenter.on_delete(created.rows[0]["id"])

    assert presenter.view_model.error == "delete failed"
    assert presenter.view_model.row["name"] == "Ada Lovelace"  # untouched - delete never actually happened


def test_on_undo_discards_an_in_memory_edit():
    """Proves the presenter really delegates to the ViewModel's own undo()
    - the mechanism itself is fully covered by
    test_user_profile_view_model.py, this just proves the wiring."""
    service = _FakeUserService()
    presenter = UserProfilePresenter(service)
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    presenter.on_load(created.rows[0]["id"])

    presenter.view_model.row["name"] = "Not Actually Saved"
    presenter.on_undo()

    assert presenter.view_model.row["name"] == "Ada Lovelace"
