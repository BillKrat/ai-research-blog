"""Default presenter: shows the provider's message as-is."""

from business.interfaces import IPresenter, IView, ViewModelResolver
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

    def __init__(
        self, view: IView, provider: IProvider, resolve_viewmodel: ViewModelResolver
    ) -> None:
        self.view = view
        self.provider = provider
        # resolve_viewmodel is di.container.resolve_viewmodel, handed in
        # by the composition root - see ViewModelResolver's docstring in
        # business/interfaces.py for why it's passed in rather than
        # imported here.
        self.view.view_model = resolve_viewmodel(self)

    def on_button_click(self) -> None:
        try:
            message = self.provider.say_hello()
        except ProviderError as exc:
            self.view.view_model.error = str(exc)
            return

        self.view.view_model.result = self._format_result(message)
        self.view.view_model.error = ""

    def _format_result(self, message: str) -> str:
        return message
