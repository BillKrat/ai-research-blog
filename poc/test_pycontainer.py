import pytest
from pycontainer import PyContainer

# --- Sample Classes for Testing ---
class Database:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string

class UserRepository:
    def __init__(self, db: Database):
        self.db = db

class DisposableService:
    def __init__(self):
        self.is_disposed = False
    
    def dispose(self):
        self.is_disposed = True

class ILogger:
    pass

class FileLogger(ILogger):
    def __init__(self):
        self.log_type = "File"

class ConsoleLogger(ILogger):
    def __init__(self):
        self.log_type = "Console"

# --- Feature Tests ---

def test_transient_lifetime_creates_new_instances():
    """Transient registrations must yield a fresh instance every time they are resolved."""
    container = PyContainer()
    container.register_transient(Database, lambda: Database("Server=Main;"))

    db1 = container.resolve(Database)
    db2 = container.resolve(Database)

    assert db1 is not db2


def test_singleton_lifetime_returns_same_instance():
    """Singleton registrations must yield the exact same instance across calls."""
    container = PyContainer()
    container.register_singleton(Database, lambda: Database("Server=Main;"))

    db1 = container.resolve(Database)
    db2 = container.resolve(Database)

    assert db1 is db2


def test_on_the_fly_overwriting():
    """Unlike rigid containers, PyContainer allows overwriting registrations at runtime."""
    container = PyContainer()
    container.register_singleton(Database, lambda: Database("Server=Old;"))
    
    # Resolve once to cache it
    assert container.resolve(Database).connection_string == "Server=Old;"

    # Overwrite it on the fly
    container.register_singleton(Database, lambda: Database("Server=New;"))
    
    # Verify it updated immediately
    assert container.resolve(Database).connection_string == "Server=New;"


def test_named_registrations():
    """You can register multiple variants of a type using distinct names."""
    container = PyContainer()
    container.register_singleton(Database, lambda: Database("Server=Primary;"), name="Primary")
    container.register_singleton(Database, lambda: Database("Server=Replica;"), name="Replica")

    primary = container.resolve(Database, name="Primary")
    replica = container.resolve(Database, name="Replica")

    assert primary.connection_string == "Server=Primary;"
    assert replica.connection_string == "Server=Replica;"


def test_automatic_constructor_injection():
    """The container must auto-wire dependent dependencies using type hints."""
    container = PyContainer()
    container.register_singleton(Database, lambda: Database("Server=Autoinject;"))
    container.register_transient(UserRepository, UserRepository)

    # UserRepository needs a Database class in its __init__
    repo = container.resolve(UserRepository)

    assert isinstance(repo, UserRepository)
    assert repo.db.connection_string == "Server=Autoinject;"


def test_hierarchical_fallback_to_parent():
    """A child container falls back to the parent container if a registration is missing locally."""
    root = PyContainer()
    root.register_singleton(Database, lambda: Database("Server=ParentDB;"))

    child = root.create_child_container()
    
    # Child doesn't have Database, should pull it from Root
    resolved_db = child.resolve(Database)
    assert resolved_db.connection_string == "Server=ParentDB;"


def test_local_scope_shadowing_overrides_parent():
    """A child container can override a parent registration without modifying the parent."""
    root = PyContainer()
    root.register_singleton(Database, lambda: Database("Server=ParentDB;"))

    child = root.create_child_container()
    child.register_singleton(Database, lambda: Database("Server=ChildDB;"))

    assert child.resolve(Database).connection_string == "Server=ChildDB;"
    assert root.resolve(Database).connection_string == "Server=ParentDB;"


def test_automatic_resource_cleanup_on_dispose():
    """Disposing a container must clean up any disposable singletons initialized inside it."""
    container = PyContainer()
    container.register_singleton(DisposableService, DisposableService)
    
    # Needs to be resolved to get instantiated and cached
    service = container.resolve(DisposableService)
    assert service.is_disposed is False

    # Disposing the container triggers the cleanup method
    container.dispose()
    assert service.is_disposed is True


def test_context_manager_scope_cleanup():
    """Containers can use standard context manager blocks for implicit scoped cleanup."""
    service_reference = None

    with PyContainer() as scope:
        scope.register_singleton(DisposableService, DisposableService)
        service_reference = scope.resolve(DisposableService)
        assert service_reference.is_disposed is False

    # Leaving the 'with' block must automatically call dispose()
    assert service_reference.is_disposed is True


def test_actions_prevented_after_dispose():
    """After a container is closed, it should safely block further reads or writes."""
    container = PyContainer()
    container.dispose()

    with pytest.raises(Exception, match="Cannot perform actions on a disposed container."):
        container.resolve(Database)


def test_registration_with_class_mapping_overload():
    """Verifies register_singleton(Interface, Class) works like a classic compiled DI container."""
    container = PyContainer()
    
    # Overload 2: Pass the Base/Interface key, and the concrete target class
    container.register_singleton(ILogger, FileLogger)

    logger = container.resolve(ILogger)
    assert isinstance(logger, FileLogger)
    assert logger.log_type == "File"


def test_registration_with_factory_overload():
    """Verifies the factory function style still functions identically."""
    container = PyContainer()
    
    # Overload 1: Pass the key, and a lambda factory execution block
    container.register_singleton(ILogger, lambda: ConsoleLogger())

    logger = container.resolve(ILogger)
    assert isinstance(logger, ConsoleLogger)
    assert logger.log_type == "Console"        
