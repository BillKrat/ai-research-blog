"""Provider-layer contracts: completion, persistence, and tool execution.

All three raise ProviderError (shared/exceptions.py) on failure rather
than leaking lower-level exceptions to the UI layer.

Structurally decoupled from any one app (no Streamlit, no blog/forms
vocabulary) - but IProvider/IDbProvider are not yet *behaviorally*
generic: their only current implementations (shared/providers/
claude_provider.py, dci_provider.py, postgres_provider.py) hardcode
ai-research-blog's one demo action (a fixed "say hello" prompt, a
fixed fixture table) rather than accepting arguments for what to ask
or read. A second app can depend on these interfaces and the DI/
Container pattern (ADR-0002) today; genuinely reusing the *methods*
still means generalizing their signatures first (e.g. a real
`complete(prompt: str) -> str` instead of a no-arg `say_hello()`) -
that generalization hasn't happened yet. See docs/adr/0009's
2026-08-04 update.
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
    see FormDataRepository in docs/adr/0004-triple-store-for-user-forms.md
    for where the triple-store work is expected to build a richer,
    domain-specific repository on top of an implementation of this
    interface.
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
    implementation (mirroring shared/container.py's Container pattern)
    is the recommended starting point - not a framework. Unlike
    IProvider/IDbProvider above, this one has no app-specific baggage
    to generalize away - it was domain-agnostic from the start.
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
