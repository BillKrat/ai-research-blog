from data.interfaces import IToolsProvider

class ToolsProvider(IToolsProvider):
    def __init__(self, use_dci=False, use_custom_presenter=False, use_postgres=False):
        self.use_dci = use_dci
        self._use_custom_presenter = use_custom_presenter
        self.use_postgres = use_postgres

    def get_provider_name(self) -> str:
        if self.use_postgres:
            return "Postgres"
        return "DCI" if self.use_dci else "Claude"

    def use_custom_presenter(self) -> bool:
        return self._use_custom_presenter
