from business.interfaces import IPPresenter

class HelloPresenter(IPPresenter):
    def __init__(self, state, provider):
        self.state = state
        self.provider = provider

    def on_button_click(self):
        self.state["result"] = self.provider.say_hello()