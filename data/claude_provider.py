import anthropic
from data.interfaces import IProvider


class ClaudeProvider(IProvider):
    def __init__(self, api_key, client=None):
        self.client = client
        if self.client is None and api_key not in {None, "", "test-key"}:
            try:
                self.client = anthropic.Anthropic(api_key=api_key)
            except Exception:
                self.client = None
        elif self.client is None:
            self.client = None

    def say_hello(self) -> str:
        response = self.client.messages.create(
        model="claude-opus-5",
        max_tokens=16,
        messages=[
            {
                "role": "user",
                "content": "Respond with exactly the text: Hello World",
            }
        ],
    )
        return response.content[0].text
