"""Mapping-backed implementation of the view model contract."""

from typing import MutableMapping

from shared.interfaces import IViewModel


class MappingViewModel(IViewModel):
    """ViewModel backed by a request- or session-scoped mapping."""

    _RESULT_KEY = "result"
    _ERROR_KEY = "error"

    def __init__(self, state: MutableMapping[str, str]) -> None:
        self._state = state
        self._state.setdefault(self._RESULT_KEY, "")
        self._state.setdefault(self._ERROR_KEY, "")

    @property
    def result(self) -> str:
        return self._state[self._RESULT_KEY]

    @result.setter
    def result(self, value: str) -> None:
        self._state[self._RESULT_KEY] = value

    @property
    def error(self) -> str:
        return self._state[self._ERROR_KEY]

    @error.setter
    def error(self, value: str) -> None:
        self._state[self._ERROR_KEY] = value