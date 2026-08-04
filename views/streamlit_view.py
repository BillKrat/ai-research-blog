"""Streamlit implementation of the IView contract."""

from typing import MutableMapping

from business.interfaces import IView, IViewModel


class StreamlitView(IView):
    """UI view that only exposes a ViewModel for binding."""

    def __init__(self, session_state: MutableMapping[str, str]) -> None:
        self._view_model: IViewModel | None = None
        self._session_state = session_state

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
