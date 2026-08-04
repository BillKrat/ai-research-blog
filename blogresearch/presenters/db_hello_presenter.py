"""Presenter backed by an IDbProvider (reads stored data, doesn't ask an LLM).

Deliberately a separate class from HelloPresenter rather than a
presenter that accepts "anything shaped like a no-arg method returning
str" - IProvider and IDbProvider are different responsibilities, and
collapsing that distinction back together at the presenter layer would
undo the point of splitting them in shared/providers/interfaces.py.
"""

from shared.exceptions import ProviderError
from shared.interfaces import IPresenter, IView, ViewModelResolver
from shared.providers.interfaces import IDbProvider


class DbHelloPresenter(IPresenter):
    def __init__(
        self, view: IView, db_provider: IDbProvider, resolve_viewmodel: ViewModelResolver
    ) -> None:
        self.view = view
        self.db_provider = db_provider
        # resolve_viewmodel is handed in by the composition root.
        # Presenters depend on the callable type, not on the container
        # module itself.
        self.view.view_model = resolve_viewmodel(self)

    def on_button_click(self) -> None:
        try:
            message = self.db_provider.get_message()
        except ProviderError as exc:
            self.view.view_model.error = str(exc)
            return

        self.view.view_model.result = message
        self.view.view_model.error = ""
