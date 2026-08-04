"""Reusable DI primitives.

This is framework-agnostic infrastructure only: no app providers,
presenters, settings, or view models live here.
"""

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class _Registration:
    factory: Callable[[], Any]
    lifetime: str


class Scope:
    """A per-request cache for scoped registrations."""

    def __init__(self, container: "Container"):
        self._container = container
        self._scoped_instances: dict[object, Any] = {}

    def resolve(self, service: object) -> Any:
        registration = self._container._registrations[service]
        if registration.lifetime == "transient":
            return registration.factory()
        if registration.lifetime == "singleton":
            return self._container._resolve_singleton(service, registration.factory)
        return self._resolve_scoped(service, registration.factory)

    def _resolve_scoped(self, service: object, factory: Callable[[], Any]) -> Any:
        if service not in self._scoped_instances:
            self._scoped_instances[service] = factory()
        return self._scoped_instances[service]


class Container:
    """A tiny DI container with singleton, transient, and scoped lifetimes.

    Any zero-argument callable can be registered as a factory, so plain
    functions work the same way classes wrapped in lambdas do.
    """

    def __init__(self):
        self._registrations: dict[object, _Registration] = {}
        self._singletons: dict[object, Any] = {}

    def add_transient(self, service: object, factory: Callable[[], Any]) -> None:
        self._registrations[service] = _Registration(factory=factory, lifetime="transient")

    def add_singleton(self, service: object, factory: Callable[[], Any]) -> None:
        self._registrations[service] = _Registration(factory=factory, lifetime="singleton")

    def add_scoped(self, service: object, factory: Callable[[], Any]) -> None:
        self._registrations[service] = _Registration(factory=factory, lifetime="scoped")

    def resolve(self, service: object) -> Any:
        registration = self._registrations[service]
        if registration.lifetime == "transient":
            return registration.factory()
        if registration.lifetime == "singleton":
            return self._resolve_singleton(service, registration.factory)
        raise RuntimeError(
            f"Service {service!r} is scoped; resolve it from a scope instead"
        )

    def create_scope(self) -> Scope:
        return Scope(self)

    def _resolve_singleton(self, service: object, factory: Callable[[], Any]) -> Any:
        if service not in self._singletons:
            self._singletons[service] = factory()
        return self._singletons[service]
