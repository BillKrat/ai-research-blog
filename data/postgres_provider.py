"""PostgreSQL-backed implementation of IProvider."""

import os
from contextlib import closing

import psycopg2

from data.exceptions import ProviderError
from data.interfaces import IProvider


class PostgresProvider(IProvider):
    """Reads a single row from hello_messages to answer say_hello().

    The connection string is resolved from DATABASE_URL unless one is
    passed explicitly (used by tests). Assumes the environment has
    already been loaded - see config/environment.py.
    """

    def __init__(self, conn_string: str | None = None) -> None:
        self.conn_string = conn_string or self._get_connection_string()

    @staticmethod
    def _get_connection_string() -> str:
        conn_string = os.environ.get("DATABASE_URL")
        if not conn_string:
            raise ValueError("DATABASE_URL must be set in the environment or .env file")
        return conn_string

    def say_hello(self) -> str:
        try:
            with closing(psycopg2.connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT message FROM hello_messages LIMIT 1;")
                    row = cur.fetchone()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc

        return row[0] if row else "No message found"
