import anthropic
import httpx
import pytest

from blogresearch.providers.claude_provider import ClaudeProvider
from blogresearch.providers.exceptions import ProviderError


class FailingMessages:
    def create(self, **kwargs):
        response = httpx.Response(
            401,
            json={"type": "error", "error": {"type": "authentication_error", "message": "invalid x-api-key"}},
        )
        request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
        response.request = request
        raise anthropic.AuthenticationError("invalid x-api-key", response=response, body=response.json())


class FailingClient:
    messages = FailingMessages()


def test_claude_provider_wraps_authentication_errors_as_provider_error():
    provider = ClaudeProvider(api_key=None, client=FailingClient())

    with pytest.raises(ProviderError, match="Claude API error"):
        provider.say_hello()
