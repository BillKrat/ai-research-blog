from business.interfaces import IPPresenter

class CustomPresenter(IPPresenter):
    def __init__(self, state, provider):
        self.state = state
        self.provider = provider

    def on_button_click(self):
        msg = self.provider.say_hello()
        self.state["result"] = f"Custom workflow → {msg.upper()}"
