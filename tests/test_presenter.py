"""Tests for the presenter layer (blogresearch/presenters/)."""

from blogresearch.presenters.custom_presenter import CustomPresenter
from blogresearch.presenters.db_hello_presenter import DbHelloPresenter
from blogresearch.presenters.hello_presenter import HelloPresenter
from blogresearch.interfaces import IPresenter
from blogresearch.providers.exceptions import ProviderError


class FakeProvider:
    def __init__(self, message="Hello from FakeProvider", error=None):
        self._message = message
        self._error = error

    def say_hello(self):
        if self._error is not None:
            raise self._error
        return self._message


class FakeDbProvider:
    def __init__(self, message="Hello from FakeDbProvider", error=None):
        self._message = message
        self._error = error

    def get_message(self):
        if self._error is not None:
            raise self._error
        return self._message


class FakeViewModel:
    def __init__(self):
        self.result = ""
        self.error = ""


def _resolve_viewmodel(presenter):
    """Stand-in for the app-level resolve_viewmodel in presenter-only tests.

    Presenters take a ViewModelResolver via their constructor rather than
    importing the container module, so these tests hand in a plain fake instead
    of pulling the real container/SessionStateViewModel into what should
    be an isolated unit test.
    """
    return FakeViewModel()


class FakeView:
    def __init__(self):
        self._view_model = None
        self._session_state = {}

    @property
    def session_state(self):
        return self._session_state

    @property
    def view_model(self):
        return self._view_model

    @view_model.setter
    def view_model(self, value):
        self._view_model = value

    @property
    def result(self):
        if self.view_model is None:
            return ""
        return self.view_model.result

    @property
    def error(self):
        if self.view_model is None:
            return ""
        return self.view_model.error


def test_hello_presenter_is_an_ipresenter():
    presenter = HelloPresenter(FakeView(), FakeProvider(), _resolve_viewmodel)
    assert isinstance(presenter, IPresenter)


def test_hello_presenter_assigns_view_model_to_view():
    view = FakeView()
    HelloPresenter(view, FakeProvider(), _resolve_viewmodel)

    assert view.view_model is not None


def test_hello_presenter_shows_provider_result():
    view = FakeView()
    presenter = HelloPresenter(view, FakeProvider(message="Hello from FakeProvider"), _resolve_viewmodel)

    presenter.on_button_click()

    assert view.result == "Hello from FakeProvider"
    assert view.error == ""


def test_hello_presenter_shows_error_on_provider_failure():
    view = FakeView()
    presenter = HelloPresenter(view, FakeProvider(error=ProviderError("boom")), _resolve_viewmodel)

    presenter.on_button_click()

    assert view.error == "boom"
    assert view.result == ""


def test_custom_presenter_formats_result():
    view = FakeView()
    presenter = CustomPresenter(view, FakeProvider(message="hello"), _resolve_viewmodel)

    presenter.on_button_click()

    assert view.result == "Custom workflow → HELLO"


def test_custom_presenter_shows_error_on_provider_failure():
    view = FakeView()
    presenter = CustomPresenter(view, FakeProvider(error=ProviderError("boom")), _resolve_viewmodel)

    presenter.on_button_click()

    assert view.error == "boom"
    assert view.result == ""


def test_db_hello_presenter_is_an_ipresenter():
    presenter = DbHelloPresenter(FakeView(), FakeDbProvider(), _resolve_viewmodel)
    assert isinstance(presenter, IPresenter)


def test_db_hello_presenter_shows_db_provider_result():
    view = FakeView()
    presenter = DbHelloPresenter(view, FakeDbProvider(message="Hello from FakeDbProvider"), _resolve_viewmodel)

    presenter.on_button_click()

    assert view.result == "Hello from FakeDbProvider"
    assert view.error == ""


def test_db_hello_presenter_shows_error_on_provider_failure():
    view = FakeView()
    presenter = DbHelloPresenter(view, FakeDbProvider(error=ProviderError("db boom")), _resolve_viewmodel)

    presenter.on_button_click()

    assert view.error == "db boom"
    assert view.result == ""
