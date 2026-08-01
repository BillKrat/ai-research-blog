from business.interfaces import IPPresenter
from business.hello_presenter import HelloPresenter

class FakeProvider:
    def say_hello(self):
        return "Hello from FakeProvider"

def test_hello_presenter_implements_ipresenter():
    state = {"result": ""}
    presenter = HelloPresenter(state, FakeProvider())

    assert hasattr(presenter, "on_button_click")

def test_hello_presenter_updates_state():
    state = {"result": ""}
    presenter = HelloPresenter(state, FakeProvider())

    presenter.on_button_click()

    assert state["result"] == "Hello from FakeProvider"
