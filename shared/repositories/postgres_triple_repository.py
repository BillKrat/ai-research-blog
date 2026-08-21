"""PostgreSQL-backed implementation of TripleRepository.

Talks to Postgres directly - same connection-resolution pattern as
PostgresProvider - rather than composing through IDbProvider.
IDbProvider stays the minimal, single-purpose DAL it is today; see
docs/adr/0008 for why this repository doesn't route through it.
"""

# Required - see shared/repositories/interfaces.py's own copy of this
# comment: a method named `list` shadows the builtin for the rest of
# this class body, breaking a later method's `-> list[Triple]`
# annotation unless annotations are deferred to strings.
from __future__ import annotations

import os
import uuid
from contextlib import closing
from typing import Any, Callable, Mapping

import psycopg2

from shared.exceptions import ProviderError
from shared.repositories.interfaces import Triple, TripleRepository


class PostgresTripleRepository(TripleRepository):
    """CRUDL over the triple_store table.

    The connection string is resolved from DATABASE_URL unless one is
    passed explicitly. `connect` defaults to psycopg2.connect and can
    be swapped for a fake in tests - same idea as ClaudeProvider's
    `client` parameter.
    """

    def __init__(
        self,
        conn_string: str | None = None,
        connect: Callable[[str], Any] = psycopg2.connect,
    ) -> None:
        self.conn_string = conn_string or self._get_connection_string()
        self._connect = connect

    @staticmethod
    def _get_connection_string() -> str:
        conn_string = os.environ.get("DATABASE_URL")
        if not conn_string:
            raise ValueError("DATABASE_URL must be set in the environment or .env file")
        return conn_string

    def create(
        self, subject: str, predicate: str, object_value: str, id: str | None = None
    ) -> Triple:
        resolved_id = id or str(uuid.uuid4())
        try:
            with closing(self._connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT 1 FROM triple_store WHERE subject = %s AND predicate = %s",
                        (subject, predicate),
                    )
                    if cur.fetchone() is not None:
                        raise ProviderError(
                            f"Triple already exists for subject={subject!r}, "
                            f"predicate={predicate!r}"
                        )
                    cur.execute(
                        "INSERT INTO triple_store (subject, predicate, object_value, id) "
                        "VALUES (%s, %s, %s, %s)",
                        (subject, predicate, object_value, resolved_id),
                    )
                conn.commit()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc
        return Triple(subject, predicate, object_value, id=resolved_id)

    def read(self, subject: str, predicate: str) -> Triple | None:
        try:
            with closing(self._connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT object_value, id FROM triple_store "
                        "WHERE subject = %s AND predicate = %s",
                        (subject, predicate),
                    )
                    row = cur.fetchone()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc
        return Triple(subject, predicate, row[0], id=row[1]) if row else None

    def update(self, subject: str, predicate: str, object_value: str) -> Triple:
        try:
            with closing(self._connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    # RETURNING id in the same round trip - update() must
                    # report the row's existing id, not invent a new one,
                    # since an UPDATE changes object_value, never identity.
                    cur.execute(
                        "UPDATE triple_store SET object_value = %s "
                        "WHERE subject = %s AND predicate = %s RETURNING id",
                        (object_value, subject, predicate),
                    )
                    row = cur.fetchone()
                    if row is None:
                        raise ProviderError(
                            f"No triple to update for subject={subject!r}, "
                            f"predicate={predicate!r}"
                        )
                conn.commit()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc
        return Triple(subject, predicate, object_value, id=row[0])

    def delete(self, subject: str, predicate: str) -> None:
        try:
            with closing(self._connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM triple_store WHERE subject = %s AND predicate = %s",
                        (subject, predicate),
                    )
                conn.commit()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc

    def list(self, subject: str | None = None) -> list[Triple]:
        try:
            with closing(self._connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    if subject is None:
                        cur.execute(
                            "SELECT subject, predicate, object_value, id FROM triple_store "
                            "ORDER BY subject, predicate"
                        )
                    else:
                        cur.execute(
                            "SELECT subject, predicate, object_value, id FROM triple_store "
                            "WHERE subject = %s ORDER BY predicate",
                            (subject,),
                        )
                    rows = cur.fetchall()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc
        # Column order matches Triple's field order exactly, so the row
        # tuple unpacks positionally with no manual remapping.
        return [Triple(*row) for row in rows]

    def find(self, criteria: Mapping[str, str]) -> list[Triple]:
        if not criteria:
            return []
        pairs = list(criteria.items())
        try:
            with closing(self._connect(self.conn_string)) as conn:
                with conn.cursor() as cur:
                    # A subject matches only if it has a row for every
                    # (predicate, object_value) pair - HAVING COUNT(DISTINCT
                    # predicate) = len(pairs) is what turns "at least one
                    # pair matched" into "every pair matched" (a real AND
                    # across rows, not an OR). Relies on criteria having no
                    # duplicate predicate keys, which a Mapping already
                    # guarantees by construction.
                    placeholders = ", ".join(["(%s, %s)"] * len(pairs))
                    params: list[str] = [value for pair in pairs for value in pair]
                    cur.execute(
                        f"SELECT subject FROM triple_store "
                        f"WHERE (predicate, object_value) IN ({placeholders}) "
                        f"GROUP BY subject HAVING COUNT(DISTINCT predicate) = %s",
                        (*params, len(pairs)),
                    )
                    subjects = [row[0] for row in cur.fetchall()]
                    if not subjects:
                        return []

                    cur.execute(
                        "SELECT subject, predicate, object_value, id FROM triple_store "
                        "WHERE subject = ANY(%s) ORDER BY subject, predicate",
                        (subjects,),
                    )
                    rows = cur.fetchall()
        except psycopg2.Error as exc:
            raise ProviderError(f"PostgreSQL error: {exc}") from exc
        return [Triple(*row) for row in rows]
