"""Reusable DI primitives.

This is framework-agnostic infrastructure only: no app providers,
presenters, settings, or view models live here.

Registration keys are typically a type (an ABC or concrete class), but
any hashable object works - a plain string, for instance. A `name`
lets multiple registrations share one key (see `resolve(..., name=...)`).
"""

import inspect
import types
from typing import Any, Callable, TypeVar, Union, get_args, get_origin

T = TypeVar("T")

_RegistrationTarget = type[T] | Callable[[], T]


def _unwrap_optional(annotation: Any) -> Any:
    """`X | None` (or `Optional[X]`) resolves as a registration for X.

    A constructor written as `vocabulary: Vocabulary | None = None` means
    "an optional Vocabulary", not literally a registration under the key
    `Vocabulary | None` - resolving against the raw union object would
    never match a registration made with `register_singleton(Vocabulary,
    ...)`. Any other annotation (including a union of two real types,
    with no None arm) is returned unchanged - this only unwraps the
    specific "one real type, optionally None" shape.
    """
    is_union = isinstance(annotation, types.UnionType) or get_origin(annotation) is Union
    if not is_union:
        return annotation
    args = [arg for arg in get_args(annotation) if arg is not type(None)]
    return args[0] if len(args) == 1 else annotation


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

        An `X | None` annotation (the common way to write an optional
        constructor dependency) resolves as a registration for X, via
        `_unwrap_optional` - see that function's own docstring.

        A parameter with a default value that has nothing registered
        for it is left unresolved rather than raising - the default
        applies instead, the same way it would on a plain, non-injected
        call. Without this, a constructor like `def __init__(self,
        repo: TripleRepository, vocabulary: Vocabulary | None = None)`
        would refuse to auto-wire unless something had also explicitly
        registered Vocabulary - defeating the point of giving it a
        default in the first place. A registered value still wins over
        the default when one exists; this only changes what happens
        when nothing is registered at all.
        """
        if not inspect.isclass(target):
            return target()

        init = target.__init__
        if init is object.__init__:
            return target()

        dependencies = {}
        for name, param in inspect.signature(init).parameters.items():
            if name == "self":
                continue
            if param.annotation == inspect.Parameter.empty:
                key = name
            else:
                key = _unwrap_optional(param.annotation)
            try:
                dependencies[name] = self.resolve(key)
            except KeyError:
                if param.default is inspect.Parameter.empty:
                    raise
                # Leave this key out of dependencies entirely - target(**dependencies)
                # then falls through to __init__'s own default for it.
        return target(**dependencies)
