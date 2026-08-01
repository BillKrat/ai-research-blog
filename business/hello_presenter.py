"""Default presenter: shows the provider's message as-is."""

from business.interfaces import IPresenter, IView
from data.exceptions import ProviderError
from data.interfaces import IProvider


class HelloPresenter(IPresenter):
    """Calls the provider and reports success or failure to the view.

    Error handling lives here rather than in each presenter, so every
    presenter (including subclasses like CustomPresenter) fails the
    same way when a provider raises ProviderError. Subclasses that
    want a different successful message override _format_result()
    instead of duplicating on_button_click().
    """

    def __init__(self, view: IView, provider: IProvider) -> None:
        self.view = view
        self.provider = provider

    def on_button_click(self) -> None:
        try:
            message = self.provider.say_hello()
        except ProviderError as exc:
            self.view.show_error(str(exc))
            return

        self.view.show_result(self._format_result(message))

    def _format_result(self, message: str) -> str:
        return message
