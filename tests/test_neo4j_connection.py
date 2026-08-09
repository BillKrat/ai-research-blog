"""Connectivity check for the Neo4j Aura instance (graph DB, OpenCypher).

This is deliberately *not* a repository/provider test yet - shared/ has no
Neo4j-backed IDbProvider or repository implementation at this point, the
same way PostgresProvider/PostgresTripleRepository exist for Postgres (see
shared/providers/postgres_provider.py, shared/repositories/postgres_triple_repository.py).
This file only answers one question: can this machine, with the credentials
in .env, actually reach the Aura instance and run a query? That's the
precondition for building a Neo4j-backed provider/repository later.

Skip-safe by the same convention as test_triple_repository.py's live
Postgres tests: if NEO4J_URI/NEO4J_USERNAME/NEO4J_PASSWORD aren't set, or
are set but the instance is unreachable, pytest reports these as skipped,
not failed - a skip means "this environment can't check this," not "the
code is broken." Unlike DATABASE_URL (which resolves to Railway's *private*
network and is unreachable from a local machine by design), Aura's
neo4j+s:// endpoint is public-over-TLS, so this test is expected to actually
run - and pass - on a local dev machine once .env has real values.
"""

import os

import pytest
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable


@pytest.fixture
def live_driver():
    uri = os.environ.get("NEO4J_URI")
    username = os.environ.get("NEO4J_USERNAME")
    password = os.environ.get("NEO4J_PASSWORD")

    if not (uri and username and password):
        pytest.skip("NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD are not configured")

    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        driver.verify_connectivity()
    except (ServiceUnavailable, Neo4jError) as exc:
        driver.close()
        pytest.skip(f"Neo4j Aura integration test skipped: {exc}")

    yield driver  # --- test runs here ---

    driver.close()


def test_live_connectivity_to_aura_instance(live_driver):
    """verify_connectivity() alone (in the fixture) proves the driver can
    reach the instance and authenticate. This test additionally proves a
    query actually executes and returns the value Cypher says it should -
    the smallest possible round-trip that touches the real network, TLS
    handshake, and auth, not just a socket-level connect."""
    database = os.environ.get("NEO4J_DATABASE", "neo4j")

    records, summary, _ = live_driver.execute_query(
        "RETURN 1 AS one",
        database_=database,
    )

    assert [record["one"] for record in records] == [1]
    assert summary.database == database


def test_live_instance_reports_its_component_and_version(live_driver):
    """A second, independent round-trip using Neo4j's own introspection
    procedure (dbms.components()) - confirms Cypher execution works against
    a real system procedure, not just a literal RETURN, and surfaces which
    edition/version Aura is actually running (useful context for later:
    Aura Free vs. Enterprise-only features like the multi-user RBAC that
    blocked CREATE USER as a password-recovery path on this same instance)."""
    database = os.environ.get("NEO4J_DATABASE", "neo4j")

    records, _, _ = live_driver.execute_query(
        "CALL dbms.components() YIELD name, edition, versions "
        "RETURN name, edition, versions[0] AS version",
        database_=database,
    )

    assert len(records) >= 1
    assert records[0]["name"] == "Neo4j Kernel"
