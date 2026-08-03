from data.interfaces import IProvider

class DCIProvider(IProvider):
    def say_hello(self) -> str:
        return "Hello world from DCI"
