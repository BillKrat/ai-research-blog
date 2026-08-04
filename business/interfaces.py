"""Interfaces for the presentation layer (MVPVM)."""

from abc import ABC, abstractmethod
from typing import Callable, MutableMapping


class IViewModel(ABC):
    """State contract exposed by a view for UI binding."""

    @property
    @abstractmethod
    def result(self) -> str:
        """Current successful result text."""

    @result.setter
    @abstractmethod
    def result(self, value: str) -> None:
        """Update the successful result text."""

    @property
    @abstractmethod
    def error(self) -> str:
        """Current error text."""

    @error.setter
    @abstractmethod
    def error(self, value: str) -> None:
        """Update the error text."""


class IView(ABC):
    """What a Presenter is allowed to do to the view.

    A Presenter constructs the concrete ViewModel from `session_state`
    and assigns it via the `view_model` setter, then reads/writes state
    through that ViewModel only. This keeps presenters testable with
    plain fakes.
    """

    @property
    @abstractmethod
    def session_state(self) -> MutableMapping[str, str]:
        """State container the view uses for binding."""

    @property
    @abstractmethod
    def view_model(self) -> IViewModel:
        """State object the view binds to."""

    @view_model.setter
    @abstractmethod
    def view_model(self, value: IViewModel) -> None:
        """Assign the state object the view binds to."""


class IPresenter(ABC):
    """Handles a view's user interaction and reports the outcome back to it."""

    @abstractmethod
    def on_button_click(self) -> None:
        """Handle the view's primary action."""


# A presenter takes this in via its constructor and calls it with itself
# to get its ViewModel, instead of importing di.container to ask for one
# directly. di.container is the only thing that ever points at this type
# concretely (it passes its own resolve_viewmodel() as the argument); a
# presenter never imports di.container, so the dependency between
# business/ and di/ only runs one way (di/ -> business/) and can't cycle.
ViewModelResolver = Callable[[IPresenter], IViewModel]
