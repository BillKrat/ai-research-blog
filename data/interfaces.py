"""Interfaces for the data layer.

"Provider" was ambiguous here: an earlier version of this file had one
IProvider covering Claude, DCI, and Postgres alike, as if reading a
database and asking an LLM a question were the same responsibility.
They aren't - so this file has three, kept separate on purpose:

- IProvider     - LLM/completion backends (Claude, OpenAI, ...)
- IDbProvider   - persistence backends (Postgres today; a local-disk
                  file store for user config is a plausible future
                  implementation - swapping it shouldn't require
                  touching business logic)
- IToolProvider - tool discovery/execution for a reasoning engine
                  (agentic tool/function calling). Forward-looking:
                  no concrete implementation exists yet, and none
                  should be added until there's a real tool to
                  register - see AGENTS.md.

All three raise data.exceptions.ProviderError on failure rather than
letting a lower-level exception escape unchanged, or swallowing it and
returning an error string as if it were data.
"""

from abc import ABC, abstractmethod
from typing import Any


class IProvider(ABC):
    """A source of LLM-generated text - Claude, OpenAI, etc."""

    @abstractmethod
    def say_hello(self) -> str:
        """Return the hello message, or raise ProviderError on failure."""


class IDbProvider(ABC):
    """A source of persisted data - Postgres, or any future storage backend.

    Deliberately minimal: only get_message() exists because that's the
    only thing this app currently reads from storage. Expand this
    interface when there's a second real read/write need, not before -
    see FormDataRepository in AGENTS.md's Vision section for where the
    triple-store work is expected to build a richer, domain-specific
    repository on top of an implementation of this interface.
    """

    @abstractmethod
    def get_message(self) -> str:
        """Return a stored message, or raise ProviderError on failure."""


class IToolProvider(ABC):
    """Tool discovery/execution contract for a reasoning engine.

    Not yet implemented anywhere in this app - defined now so the
    shape is settled, per the same principle used elsewhere in this
    codebase: interfaces exist because something swaps, but the shape
    itself is cheap to write down before the first implementation
    exists. When a first real tool shows up, a dict/registry-driven
    implementation (mirroring config/container.py's PROVIDER_FACTORIES
    pattern) is the recommended starting point - not a framework.
    """

    @abstractmethod
    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Return JSON-compatible schemas of all available tools."""

    @abstractmethod
    def execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Execute the named tool with the given arguments.

        Raises ProviderError (e.g. an unknown tool name) rather than a
        bare ValueError/KeyError, consistent with IProvider/IDbProvider.
        """
