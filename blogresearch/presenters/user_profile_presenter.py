"""UserProfilePresenter: CRUDL actions for the user-profile page.

Unlike HelloPresenter/DbHelloPresenter/CustomPresenter, this presenter
takes no `view` (IView) or `resolve_viewmodel` (ViewModelResolver)
constructor argument. Those exist so the composition root can hand a
presenter someone else's concrete View/ViewModel without the presenter
importing it directly - valuable when more than one View
implementation exists for the same page (today: an HTTP ApiView, plus
Streamlit's interim dev-only View - see docs/adr/0006). No second View
exists for THIS page yet, and IView's session_state is typed
MutableMapping[str, str] - too narrow for UserProfileViewModel's typed
row/columns. So this presenter simply owns its UserProfileViewModel
directly: one less layer of indirection for a page with exactly one
consumer, matching AGENTS.md's "don't add ceremony a single
implementation doesn't need" guidance. If a second View for this page
shows up later, that's the moment to introduce the same resolver
seam the other presenters use - not before.
"""

from shared.exceptions import ProviderError
from shared.repositories.interfaces import USER_COLUMNS
from shared.user_service import UserCreateRequest, UserService, UserUpdateRequest

from blogresearch.viewmodels.user_profile_view_model import UserProfileViewModel


class UserProfilePresenter:
    """Calls UserService and reports success or failure to its own ViewModel.

    Every action follows HelloPresenter's error-handling shape: call
    the service, catch ProviderError, report it on view_model.error and
    return without touching view_model.row - a failed call leaves
    whatever was there before it (the last successful load) alone,
    rather than clearing it out from under the caller.
    """

    def __init__(self, user_service: UserService):
        self.user_service = user_service
        self.view_model = UserProfileViewModel(columns=USER_COLUMNS)

    def on_load(self, user_id: str) -> None:
        """Fetch one user by id. Not named on_read() to read as a UI
        action (load this user into the form), matching on_add/
        on_edit/on_delete's naming, even though it maps straight to
        UserService.read() underneath."""
        try:
            record_set = self.user_service.read(user_id)
        except ProviderError as exc:
            self.view_model.error = str(exc)
            return

        if record_set is None:
            self.view_model.error = f"No user found for id {user_id!r}"
            return

        self.view_model.load(record_set)

    def on_add(self, name: str, email: str) -> None:
        try:
            record_set = self.user_service.create(UserCreateRequest(name=name, email=email))
        except ProviderError as exc:
            self.view_model.error = str(exc)
            return

        self.view_model.load(record_set)

    def on_edit(self, user_id: str, name: str, email: str) -> None:
        try:
            record_set = self.user_service.update(user_id, UserUpdateRequest(name=name, email=email))
        except ProviderError as exc:
            self.view_model.error = str(exc)
            return

        self.view_model.load(record_set)

    def on_delete(self, user_id: str) -> None:
        try:
            self.user_service.delete(user_id)
        except ProviderError as exc:
            self.view_model.error = str(exc)
            return

        self.view_model.clear()

    def on_undo(self) -> None:
        self.view_model.undo()


__all__ = ["UserProfilePresenter"]
