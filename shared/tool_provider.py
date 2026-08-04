"""Tool discovery/execution contract for a reasoning engine.

Not yet implemented anywhere in this app - defined now so the shape
is settled, per the same principle used elsewhere in this codebase:
interfaces exist because something swaps, but the shape itself is
cheap to write down before the first implementation exists. When a
first real tool shows up, a dict/registry-driven implementation
(mirroring shared/container.py's Container pattern) is the recommended
starting point - not a framework.

Domain-agnostic (no blog/forms vocabulary), unlike IProvider/IDbProvider
in blogresearch/providers/interfaces.py - that's why this lives in
shared/ rather than with them. See docs/adr/0009.
"""

from abc import ABC, abstractmethod
from typing import Any


class IToolProvider(ABC):
    """Tool discovery/execution contract for a reasoning engine."""

    @abstractmethod
    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Return JSON-compatible schemas of all available tools."""

    @abstractmethod
    def execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Execute the named tool with the given arguments.

        Raises ProviderError (e.g. an unknown tool name) rather than a
        bare ValueError/KeyError, consistent with IProvider/IDbProvider.
        """
