from abc import ABC, abstractmethod

class IProvider(ABC):
    @abstractmethod
    def say_hello(self) -> str:
        pass

class IToolsProvider(ABC):
    @abstractmethod
    def get_provider_name(self) -> str:
        pass

    @abstractmethod
    def use_custom_presenter(self) -> bool:
        pass
