import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

from business.hello_presenter import HelloPresenter
from business.custom_presenter import CustomPresenter

from data.claude_provider import ClaudeProvider
from data.dci_provider import DCIProvider
from data.postgres_provider import PostgresProvider


def _load_environment() -> None:
    env_path = find_dotenv(usecwd=True)
    if env_path:
        load_dotenv(dotenv_path=env_path, override=False)
    else:
        load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)


_load_environment()


def _get_anthropic_api_key():
    _load_environment()
    return os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")

def resolve_provider(tools):
    name = tools.get_provider_name()

    if name == "Postgres":
        return PostgresProvider()

    if name == "DCI":
        return DCIProvider()

    api_key = _get_anthropic_api_key()
    if not api_key or os.environ.get("PYTEST_CURRENT_TEST"):
        return ClaudeProvider(api_key="test-key")

    return ClaudeProvider(api_key=api_key)

def resolve_presenter(tools, state):
    provider = resolve_provider(tools)

    if tools.use_custom_presenter():
        return CustomPresenter(state, provider)

    return HelloPresenter(state, provider)