"""Small, application-owned vocabulary for the triple store.

This is intentionally not a complete RDF implementation. The application
uses ordinary HTTPS URIs as names and stores facts through TripleRepository.
"""

from dataclasses import dataclass
from urllib.parse import urlparse


DEFAULT_BASE_URI = "https://blogresearch.net/2026/08/"


@dataclass(frozen=True)
class Vocabulary:
    """URIs used by the application, rooted at one deployment's base URI."""

    base_uri: str = DEFAULT_BASE_URI

    def __post_init__(self) -> None:
        parsed = urlparse(self.base_uri)
        if parsed.scheme != "https" or not parsed.netloc or not self.base_uri.endswith("/"):
            raise ValueError("base_uri must be an HTTPS URI ending with '/'")

    def uri(self, name: str) -> str:
        """Return a vocabulary URI below the configured base URI."""
        return f"{self.base_uri}{name}"

    @property
    def type(self) -> str:
        return self.uri("type")

    @property
    def name(self) -> str:
        return self.uri("name")

    @property
    def description(self) -> str:
        return self.uri("description")

    @property
    def database_schema(self) -> str:
        return self.uri("database-schema")

    @property
    def person(self) -> str:
        return self.uri("Person")

    @property
    def dataset(self) -> str:
        return self.uri("DataSet")

    @property
    def database_schema_class(self) -> str:
        return self.uri("DatabaseSchema")


__all__ = ["DEFAULT_BASE_URI", "Vocabulary"]