"""In-memory view adapter used by the HTTP API."""

from typing import MutableMapping

from shared.interfaces import IView, IViewModel


class ApiView(IView):
    """Provides the presenter with request-scoped state."""

    def __init__(self) -> None:
        self._view_model: IViewModel | None = None
        self._session_state: MutableMapping[str, str] = {}

    @property
    def session_state(self) -> MutableMapping[str, str]:
        return self._session_state

    @property
    def view_model(self) -> IViewModel:
        if self._view_model is None:
            raise RuntimeError("View model has not been assigned yet")
        return self._view_model

    @view_model.setter
    def view_model(self, value: IViewModel) -> None:
        self._view_model = value