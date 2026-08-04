"""Streamlit-backed implementation of the view model contract."""

from typing import MutableMapping

from shared.interfaces import IViewModel


class SessionStateViewModel(IViewModel):
    """ViewModel backed by Streamlit session_state."""

    _RESULT_KEY = "result"
    _ERROR_KEY = "error"

    def __init__(self, session_state: MutableMapping[str, str]) -> None:
        self._session_state = session_state
        self._session_state.setdefault(self._RESULT_KEY, "")
        self._session_state.setdefault(self._ERROR_KEY, "")

    @property
    def result(self) -> str:
        return self._session_state[self._RESULT_KEY]

    @result.setter
    def result(self, value: str) -> None:
        self._session_state[self._RESULT_KEY] = value

    @property
    def error(self) -> str:
        return self._session_state[self._ERROR_KEY]

    @error.setter
    def error(self, value: str) -> None:
        self._session_state[self._ERROR_KEY] = value
