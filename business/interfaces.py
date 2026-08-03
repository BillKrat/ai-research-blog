"""Interfaces for the presentation layer (MVP)."""

from abc import ABC, abstractmethod


class IView(ABC):
    """What a Presenter is allowed to do to the view.

    Presenters depend on this interface only - never on Streamlit or
    st.session_state directly. That's what keeps a presenter testable
    with a plain fake and reusable against a different UI framework.
    """

    @abstractmethod
    def show_result(self, text: str) -> None:
        """Display a successful result to the user."""

    @abstractmethod
    def show_error(self, text: str) -> None:
        """Display an error message to the user."""


class IPresenter(ABC):
    """Handles a view's user interaction and reports the outcome back to it."""

    @abstractmethod
    def on_button_click(self) -> None:
        """Handle the view's primary action."""
