"""Reusable DI primitives.

This is framework-agnostic infrastructure only: no app providers,
presenters, settings, or view models live here.

Registration keys are typically a type (an ABC or concrete class), but
any hashable object works - a plain string, for instance. A `name`
lets multiple registrations share one key (see `resolve(..., name=...)`).
"""

import inspect
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_RegistrationTarget = type[T] | Callable[[], T]


class Container:
    """A DI container with singleton/transient lifetimes, parent/child
    scoping, named registrations, and constructor auto-injection.

    A registration's target is either a class (auto-wired via its
    `__init__` type hints, recursively) or a zero-argument factory
    callable - `register_singleton(Database, PostgresDatabase)` and
    `register_singleton(Database, lambda: PostgresDatabase(url))` both
    work. `create_child_container()` returns a container that falls
    back to its parent for anything it hasn't registered itself, and
    can shadow a parent registration locally without touching the
    parent - the mechanism `resolve_presenter()` uses for per-request
    registrations layered on top of one process-wide root.
    """

    def __init__(self, parent: "Container | None" = None):
        self.parent = parent
        self._registrations: dict[tuple[object, str | None], tuple[str, Any]] = {}
        self._singletons: dict[tuple[object, str | None], Any] = {}
        self._is_disposed = False

    def register_singleton(
        self, service_key: object, target: "_RegistrationTarget", name: str | None = None
    ) -> None:
        """Register a singleton: one instance, built on first resolve.

        `target` may be a class (auto-wired) or a factory callable.
        Re-registering the same (service_key, name) drops any cached
        instance, so the next resolve() picks up the new target.
        """
        self._ensure_not_disposed()
        registration_key = (service_key, name)
        self._registrations[registration_key] = ("singleton", target)
        self._singletons.pop(registration_key, None)

    def register_transient(
        self, service_key: object, target: "_RegistrationTarget", name: str | None = None
    ) -> None:
        """Register a transient: a fresh instance on every resolve()."""
        self._ensure_not_disposed()
        registration_key = (service_key, name)
        self._registrations[registration_key] = ("transient", target)

    def create_child_container(self) -> "Container":
        """Create a nested container that falls back to this one."""
        self._ensure_not_disposed()
        return Container(parent=self)

    def resolve(self, service_key: object, name: str | None = None) -> Any:
        """Resolve a registration, falling back to the parent chain.

        A local registration always wins over a parent's, even if the
        parent's was resolved first - the child is checked before ever
        looking at self.parent.
        """
        self._ensure_not_disposed()
        registration_key = (service_key, name)

        if registration_key in self._registrations:
            lifetime, target = self._registrations[registration_key]
            if lifetime == "singleton":
                if registration_key not in self._singletons:
                    self._singletons[registration_key] = self._instantiate(target)
                return self._singletons[registration_key]
            return self._instantiate(target)

        if self.parent is not None:
            return self.parent.resolve(service_key, name)

        name_str = f" named {name!r}" if name else ""
        raise KeyError(f"Service {service_key!r}{name_str} is not registered.")

    def dispose(self) -> None:
        """Clean up this container's own singletons and registrations.

        Only singletons *this* container instantiated - a child never
        disposes its parent's. Looks for `dispose`/`close`/`__exit__`
        on each cached instance; a cleanup failure on one instance
        doesn't stop the rest from being cleaned up.
        """
        if self._is_disposed:
            return

        for instance in list(self._singletons.values()):
            for cleanup_name in ("dispose", "close", "__exit__"):
                cleanup = getattr(instance, cleanup_name, None)
                if callable(cleanup):
                    try:
                        cleanup(None, None, None) if cleanup_name == "__exit__" else cleanup()
                    except Exception:
                        pass
                    break

        self._singletons.clear()
        self._registrations.clear()
        self._is_disposed = True

    def __enter__(self) -> "Container":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.dispose()

    def _ensure_not_disposed(self) -> None:
        if self._is_disposed:
            raise RuntimeError("Cannot perform actions on a disposed container.")

    def _instantiate(self, target: "_RegistrationTarget") -> Any:
        """Build one instance of `target`.

        A non-class target is a factory - call it. A class with no
        meaningful `__init__` is built directly. Otherwise, walk its
        `__init__` type hints and resolve each parameter from this
        container (recursively auto-wiring that parameter's own
        dependencies in turn) - a bare, unannotated parameter falls
        back to resolving by its parameter name instead.
        """
        if not inspect.isclass(target):
            return target()

        init = target.__init__
        if init is object.__init__:
            return target()

        parameters = inspect.signature(init).parameters
        dependencies = {
            name: self.resolve(param.annotation if param.annotation != inspect.Parameter.empty else name)
            for name, param in parameters.items()
            if name != "self"
        }
        return target(**dependencies)
