"""Shared exception types raised by data-layer providers."""


class ProviderError(Exception):
    """Raised when an IProvider cannot fulfill a request.

    Presenters catch this and report a user-facing message via the
    view, instead of letting a provider's underlying exception (a
    network error, a driver error, a missing API key, etc.) propagate
    up to the UI layer unhandled.
    """
