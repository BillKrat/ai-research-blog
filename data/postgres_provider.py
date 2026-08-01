import os
from pathlib import Path

import psycopg2
from dotenv import find_dotenv, load_dotenv

from data.interfaces import IProvider


def _load_environment() -> None:
    env_path = find_dotenv(usecwd=True)
    if env_path:
        load_dotenv(dotenv_path=env_path, override=False)
    else:
        load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)


_load_environment()


class PostgresProvider(IProvider):
    def __init__(self, conn_string=None):
        self.conn_string = conn_string or self._get_connection_string()

    def _get_connection_string(self) -> str:
        _load_environment()
        conn_string = os.environ.get("DATABASE_URL")
        if not conn_string:
            raise ValueError("DATABASE_URL must be set in the environment or .env file")
        return conn_string

    def say_hello(self) -> str:
        try:
            conn = psycopg2.connect(self.conn_string)
            cur = conn.cursor()

            cur.execute("SELECT message FROM hello_messages LIMIT 1;")
            row = cur.fetchone()

            cur.close()
            conn.close()

            return row[0] if row else "No message found"

        except Exception as ex:
            return f"PostgreSQL error: {ex}"