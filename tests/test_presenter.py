from business.hello_presenter import HelloPresenter

class FakeProvider:
    def say_hello(self):
        return "Hello from FakeProvider"

def test_presenter_updates_state():
    state = {"result": ""}
    presenter = HelloPresenter(state, FakeProvider())

    presenter.on_button_click()

    assert state["result"] == "Hello from FakeProvider"
