"""Claude/Anthropic-backed implementation of IProvider."""

import anthropic

from shared.exceptions import ProviderError
from shared.providers.interfaces import IProvider

_MODEL = "claude-opus-5"


class ClaudeProvider(IProvider):
    """Calls the Anthropic Claude API to answer say_hello().

    Accepts an optional pre-built client for testing. When no api_key
    is supplied, the provider is left unconfigured and say_hello()
    raises ProviderError instead of touching the network - it never
    crashes with an unrelated AttributeError.
    """

    def __init__(self, api_key: str | None, client: anthropic.Anthropic | None = None) -> None:
        self.client = client if client is not None else self._build_client(api_key)

    @staticmethod
    def _build_client(api_key: str | None) -> anthropic.Anthropic | None:
        if not api_key:
            return None
        try:
            return anthropic.Anthropic(api_key=api_key)
        except Exception:
            return None

    def say_hello(self) -> str:
        if self.client is None:
            raise ProviderError("Claude provider is not configured: no API key was supplied.")

        try:
            response = self.client.messages.create(
                model=_MODEL,
                max_tokens=16,
                messages=[
                    {
                        "role": "user",
                        "content": "Respond with exactly the text: Hello World",
                    }
                ],
            )
        except anthropic.AnthropicError as exc:
            raise ProviderError(f"Claude API error: {exc}") from exc
        except Exception as exc:
            raise ProviderError(f"Claude provider failed: {exc}") from exc

        return response.content[0].text
