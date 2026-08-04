from shared.providers.interfaces import IProvider

class DCIProvider(IProvider):
    def say_hello(self) -> str:
        return "Hello world from DCI"
