"""UserService: the business layer between UserRepository and the UI.

A thin pass-through today - every method mirrors UserRepository's
CRUDL one-for-one, with no behavior added yet. That's deliberate, not
a stub with a TODO: this is the seam docs/ASR.md's ASR-008 (locked-
value/versioned business logic for regulated data) expects to grow
real logic into later - validation, computed fields, the eventual
lock/version enforcement - without every caller above it (a
presenter, an MCP tool) needing to change when that happens. Building
it now, thin but real, is what keeps that future growth a change in
one place instead of a refactor.
"""

from dataclasses import dataclass
from typing import Any, Mapping

from shared.recordset import RecordSet
from shared.repositories.interfaces import UserRepository


@dataclass(frozen=True)
class UserCreateRequest:
    """What a caller needs to create a user.

    provider_options is an escape hatch, not a general parameter bag -
    it exists for a future presenter to pass something a specific
    resolved provider needs that UserService itself doesn't care
    about, the same seam resolve_presenter() already uses to branch on
    settings.provider_name. Nothing reads it yet; it costs nothing to
    have here now and avoids a signature change through every layer
    the day something does need it - see the user-CRUDL design
    session's rationale for preferring this over a C#-style
    `(sender, eventArgs)` pattern, which solves a problem (multicast-
    delegate signature stability) that doesn't exist in this call chain.
    """

    name: str
    email: str
    provider_options: Mapping[str, Any] | None = None


@dataclass(frozen=True)
class UserUpdateRequest:
    """Mirrors UserCreateRequest, for update() - see its docstring."""

    name: str
    email: str
    provider_options: Mapping[str, Any] | None = None


class UserService:
    """CRUDL pass-through to an injected UserRepository.

    Not an ABC - there is exactly one shape this takes today, and no
    stated reason (yet) for a second one the way UserRepository's
    provider-swap concern justifies an interface there. If a real need
    for a second UserService implementation shows up (see ASR-008),
    add the ABC then, against that concrete need - not speculatively
    now. See AGENTS.md's "don't add an interface for one
    implementation" guidance.
    """

    def __init__(self, user_repository: UserRepository):
        self._user_repository = user_repository

    def create(self, request: UserCreateRequest) -> RecordSet:
        return self._user_repository.create(name=request.name, email=request.email)

    def read(self, user_id: str) -> RecordSet | None:
        return self._user_repository.read(user_id)

    def update(self, user_id: str, request: UserUpdateRequest) -> RecordSet:
        return self._user_repository.update(user_id, name=request.name, email=request.email)

    def delete(self, user_id: str) -> None:
        self._user_repository.delete(user_id)

    def list(self) -> RecordSet:
        return self._user_repository.list()


__all__ = ["UserService", "UserCreateRequest", "UserUpdateRequest"]
