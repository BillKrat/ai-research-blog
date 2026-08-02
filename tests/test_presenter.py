"""Tests for the presenter layer (business/)."""

from business.custom_presenter import CustomPresenter
from business.db_hello_presenter import DbHelloPresenter
from business.hello_presenter import HelloPresenter
from business.interfaces import IPresenter
from data.exceptions import ProviderError


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


class FakeView:
    def __init__(self):
        self.result = None
        self.error = None

    def show_result(self, text):
        self.result = text

    def show_error(self, text):
        self.error = text


def test_hello_presenter_is_an_ipresenter():
    presenter = HelloPresenter(FakeView(), FakeProvider())
    assert isinstance(presenter, IPresenter)


def test_hello_presenter_shows_provider_result():
    view = FakeView()
    presenter = HelloPresenter(view, FakeProvider(message="Hello from FakeProvider"))

    presenter.on_button_click()

    assert view.result == "Hello from FakeProvider"
    assert view.error is None


def test_hello_presenter_shows_error_on_provider_failure():
    view = FakeView()
    presenter = HelloPresenter(view, FakeProvider(error=ProviderError("boom")))

    presenter.on_button_click()

    assert view.error == "boom"
    assert view.result is None


def test_custom_presenter_formats_result():
    view = FakeView()
    presenter = CustomPresenter(view, FakeProvider(message="hello"))

    presenter.on_button_click()

    assert view.result == "Custom workflow → HELLO"


def test_custom_presenter_shows_error_on_provider_failure():
    view = FakeView()
    presenter = CustomPresenter(view, FakeProvider(error=ProviderError("boom")))

    presenter.on_button_click()

    assert view.error == "boom"
    assert view.result is None


def test_db_hello_presenter_is_an_ipresenter():
    presenter = DbHelloPresenter(FakeView(), FakeDbProvider())
    assert isinstance(presenter, IPresenter)


def test_db_hello_presenter_shows_db_provider_result():
    view = FakeView()
    presenter = DbHelloPresenter(view, FakeDbProvider(message="Hello from FakeDbProvider"))

    presenter.on_button_click()

    assert view.result == "Hello from FakeDbProvider"
    assert view.error is None


def test_db_hello_presenter_shows_error_on_provider_failure():
    view = FakeView()
    presenter = DbHelloPresenter(view, FakeDbProvider(error=ProviderError("db boom")))

    presenter.on_button_click()

    assert view.error == "db boom"
    assert view.result is None
