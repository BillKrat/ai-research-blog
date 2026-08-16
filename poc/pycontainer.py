import inspect

class PyContainer:
    def __init__(self, parent=None):
        self.parent = parent
        self.registrations = {}  # Maps (key, name) -> (lifetime, class_or_factory)
        self.singletons = {}     # Maps (key, name) -> instantiated object instance
        self._is_disposed = False

    def register_singleton(self, service_key, cls_or_factory, name=None):
        """Registers a singleton service that can be overwritten at runtime."""
        self._ensure_not_disposed()
        registration_key = (service_key, name)
        self.registrations[registration_key] = ('singleton', cls_or_factory)
        # Clear out any old cached instance if we are overwriting
        self.singletons.pop(registration_key, None)

    def register_transient(self, service_key, cls_or_factory, name=None):
        """Registers a transient service (new instance every time)."""
        self._ensure_not_disposed()
        registration_key = (service_key, name)
        self.registrations[registration_key] = ('transient', cls_or_factory)

    def create_child_container(self):
        """Creates a nested scope that falls back to this container."""
        self._ensure_not_disposed()
        return PyContainer(parent=self)

    def resolve(self, service_key, name=None):
        """Resolves a dependency, falling back to the parent if not found locally."""
        self._ensure_not_disposed()
        registration_key = (service_key, name)

        # 1. Check local registrations first (allows local shadowing/overwriting)
        if registration_key in self.registrations:
            lifetime, target = self.registrations[registration_key]
            
            if lifetime == 'singleton':
                if registration_key not in self.singletons:
                    self.singletons[registration_key] = self._instantiate(target)
                return self.singletons[registration_key]
                
            return self._instantiate(target)

        # 2. Fall back to parent container if local registration doesn't exist
        if self.parent:
            return self.parent.resolve(service_key, name)
            
        name_str = f" with name '{name}'" if name else ""
        raise Exception(f"Service {service_key}{name_str} is not registered.")

    def dispose(self):
        """Disposes of the container and cleans up any disposable singletons it holds."""
        if self._is_disposed:
            return

        # Iterate through cached singletons created by THIS container
        for instance in list(self.singletons.values()):
            # Look for common cleanup methods
            for cleanup_method_name in ('dispose', 'close', '__exit__'):
                cleanup_method = getattr(instance, cleanup_method_name, None)
                if callable(cleanup_method):
                    try:
                        if cleanup_method_name == '__exit__':
                            cleanup_method(None, None, None)
                        else:
                            cleanup_method()
                    except Exception:
                        pass # Prevent one faulty cleanup from breaking the chain
                    break

        self.singletons.clear()
        self.registrations.clear()
        self._is_disposed = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.dispose()

    def _ensure_not_disposed(self):
        if self._is_disposed:
            raise Exception("Cannot perform actions on a disposed container.")

    def _instantiate(self, target):
        """Helper to handle constructor injection using type hints."""
        if not inspect.isclass(target):
            return target() if callable(target) else target

        init_method = getattr(target, '__init__', None)
        if init_method is None or init_method == object.__init__:
            return target()

        signature = inspect.signature(init_method)
        dependencies = {}

        for param_name, param in signature.parameters.items():
            if param_name == 'self':
                continue
                
            if param.annotation != inspect.Parameter.empty:
                dependencies[param_name] = self.resolve(param.annotation)
            else:
                dependencies[param_name] = self.resolve(param_name)

        return target(**dependencies)

    def register_singleton(self, service_key, target, name=None):
        """
        Registers a singleton service supporting two overload patterns:
        1. register_singleton(Database, lambda: Database())  <- Key + Factory Function
        2. register_singleton(IDatabase, Database)           <- Interface/Key + Implementation Class
        """
        self._ensure_not_disposed()
        registration_key = (service_key, name)

        # Look closely at what 'target' is:
        if inspect.isclass(target):
            # Signature 2: Target is an implementation class. 
            # We wrap it in a factory that auto-wires its constructor.
            self.registrations[registration_key] = ('singleton', target)
        else:
            # Signature 1: Target is a factory function or a pre-built instance.
            self.registrations[registration_key] = ('singleton', target)

        self.singletons.pop(registration_key, None)

    def register_transient(self, service_key, target, name=None):
        """Registers a transient service supporting both class type-mappings and factories."""
        self._ensure_not_disposed()
        registration_key = (service_key, name)

        self.registrations[registration_key] = ('transient', target)

        
    
