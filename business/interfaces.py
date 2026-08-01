from abc import ABC, abstractmethod

class IPPresenter(ABC):
    @abstractmethod
    def on_button_click(self):
        pass