"""Streamlit implementation of the IView contract."""

from typing import MutableMapping

from business.interfaces import IView


class StreamlitView(IView):
    """Adapts IView onto st.session_state.

    This is the only place in the app that knows the session_state key
    names - presenters never touch session_state directly, and a
    different UI framework would only need a new class like this one.
    """

    _RESULT_KEY = "result"
    _ERROR_KEY = "error"

    def __init__(self, session_state: MutableMapping[str, str]) -> None:
        self._session_state = session_state
        self._session_state.setdefault(self._RESULT_KEY, "")
        self._session_state.setdefault(self._ERROR_KEY, "")

    def show_result(self, text: str) -> None:
        self._session_state[self._RESULT_KEY] = text
        self._session_state[self._ERROR_KEY] = ""

    def show_error(self, text: str) -> None:
        self._session_state[self._ERROR_KEY] = text

    @property
    def result(self) -> str:
        return self._session_state[self._RESULT_KEY]

    @property
    def error(self) -> str:
        return self._session_state[self._ERROR_KEY]
