"""Tests for UserService (shared/user_service.py).

UserService is a thin pass-through today - see its module docstring
for why that's a deliberate, real layer rather than a stub. These
tests exist to prove exactly that: every call reaches the injected
UserRepository with the right arguments, and every result comes back
unchanged. A fake UserRepository (not unittest.mock) records what it
was called with, the same "fakes, not mocks" style as
test_triple_user_repository.py's _FakeTripleRepository.
"""

from shared.recordset import RecordSet
from shared.repositories.interfaces import USER_COLUMNS, UserRepository, UserSearchFilter
from shared.user_service import UserCreateRequest, UserService, UserUpdateRequest

_COLUMNS = USER_COLUMNS


class _FakeUserRepository(UserRepository):
    """Records every call it receives, and returns canned RecordSets -
    enough to prove UserService passes arguments and results through
    unchanged, without any real storage behind it."""

    def __init__(self):
        self.calls: list[tuple[str, tuple, dict]] = []
        self._users: dict[str, dict] = {}

    def create(self, name, email):
        self.calls.append(("create", (), {"name": name, "email": email}))
        user_id = f"user-{len(self._users) + 1}"
        self._users[user_id] = {"id": user_id, "name": name, "email": email}
        return RecordSet(columns=_COLUMNS, rows=[self._users[user_id]])

    def read(self, user_id):
        self.calls.append(("read", (user_id,), {}))
        row = self._users.get(user_id)
        return None if row is None else RecordSet(columns=_COLUMNS, rows=[row])

    def update(self, user_id, name, email):
        self.calls.append(("update", (user_id,), {"name": name, "email": email}))
        self._users[user_id] = {"id": user_id, "name": name, "email": email}
        return RecordSet(columns=_COLUMNS, rows=[self._users[user_id]])

    def delete(self, user_id):
        self.calls.append(("delete", (user_id,), {}))
        self._users.pop(user_id, None)

    def list(self, *, filters=None):
        self.calls.append(("list", (), {"filters": filters}))
        return RecordSet(columns=_COLUMNS, rows=list(self._users.values()))


def test_create_passes_request_fields_through_to_the_repository():
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)

    result = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))

    assert fake_repository.calls == [("create", (), {"name": "Ada Lovelace", "email": "ada@example.com"})]
    assert result.rows[0]["name"] == "Ada Lovelace"
    assert result.rows[0]["email"] == "ada@example.com"


def test_create_ignores_provider_options_today():
    """provider_options is an escape hatch for a future need - UserService
    doesn't read it yet, and passing one must not change create()'s
    behavior or break the call."""
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)

    request = UserCreateRequest(name="Ada Lovelace", email="ada@example.com", provider_options={"anything": "here"})
    result = service.create(request)

    assert fake_repository.calls == [("create", (), {"name": "Ada Lovelace", "email": "ada@example.com"})]
    assert result.rows[0]["name"] == "Ada Lovelace"


def test_read_passes_user_id_through_and_returns_the_repository_result():
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    user_id = created.rows[0]["id"]

    result = service.read(user_id)

    assert ("read", (user_id,), {}) in fake_repository.calls
    assert result.rows[0]["name"] == "Ada Lovelace"


def test_read_returns_none_when_the_repository_does():
    service = UserService(_FakeUserRepository())

    assert service.read("no-such-id") is None


def test_update_passes_request_fields_through_to_the_repository():
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    user_id = created.rows[0]["id"]

    result = service.update(user_id, UserUpdateRequest(name="Ada, Countess of Lovelace", email="ada@new.example.com"))

    assert (
        "update",
        (user_id,),
        {"name": "Ada, Countess of Lovelace", "email": "ada@new.example.com"},
    ) in fake_repository.calls
    assert result.rows[0]["name"] == "Ada, Countess of Lovelace"


def test_delete_passes_user_id_through():
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)
    created = service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    user_id = created.rows[0]["id"]

    service.delete(user_id)

    assert ("delete", (user_id,), {}) in fake_repository.calls
    assert service.read(user_id) is None


def test_list_returns_the_repository_result_unchanged():
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)
    service.create(UserCreateRequest(name="Ada Lovelace", email="ada@example.com"))
    service.create(UserCreateRequest(name="Grace Hopper", email="grace@example.com"))

    result = service.list()

    assert ("list", (), {"filters": None}) in fake_repository.calls
    assert {row["name"] for row in result.rows} == {"Ada Lovelace", "Grace Hopper"}


def test_list_passes_filters_through_to_the_repository():
    fake_repository = _FakeUserRepository()
    service = UserService(fake_repository)
    filters = UserSearchFilter(email="ada@example.com")

    service.list(filters=filters)

    assert ("list", (), {"filters": filters}) in fake_repository.calls
