"""A HelloPresenter variant with a custom result format.

Inherits on_button_click() - and its error handling - from
HelloPresenter unchanged, and only overrides how a successful message
is formatted.
"""

from blogresearch.presenters.hello_presenter import HelloPresenter


class CustomPresenter(HelloPresenter):
    def _format_result(self, message: str) -> str:
        return f"Custom workflow → {message.upper()}"
