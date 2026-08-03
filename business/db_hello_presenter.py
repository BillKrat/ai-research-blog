"""Presenter backed by an IDbProvider (reads stored data, doesn't ask an LLM).

Deliberately a separate class from HelloPresenter rather than a
presenter that accepts "anything shaped like a no-arg method returning
str" - IProvider and IDbProvider are different responsibilities, and
collapsing that distinction back together at the presenter layer would
undo the point of splitting them in data/interfaces.py.
"""

from business.interfaces import IPresenter, IView
from data.exceptions import ProviderError
from data.interfaces import IDbProvider


class DbHelloPresenter(IPresenter):
    def __init__(self, view: IView, db_provider: IDbProvider) -> None:
        self.view = view
        self.db_provider = db_provider

    def on_button_click(self) -> None:
        try:
            message = self.db_provider.get_message()
        except ProviderError as exc:
            self.view.show_error(str(exc))
            return

        self.view.show_result(message)
