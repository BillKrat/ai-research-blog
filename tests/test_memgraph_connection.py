"""Connectivity check for the local Memgraph instance (graph DB, openCypher).

Companion to test_neo4j_connection.py: same "just prove the network/driver
path works" scope, no Memgraph-backed IDbProvider or repository exists yet.
See shared/repositories/ for the Postgres-backed IDal implementations this
would eventually sit alongside.

Why a second graph DB at all: Neo4j Aura Free is the deployed-testing target
(small, fixed resource limits - see the Aura console's Resource Limits
panel), while Memgraph runs locally in Docker
(~/data/memgraph-platform/docker-compose.yml, autostarted by the
com.bill.startmemgraph LaunchAgent) with no such ceiling, so it's the target
for heavy data loads during development. Both speak Bolt + openCypher, so
the same `neo4j` driver package (already a requirements.txt dependency for
Aura) talks to either - Memgraph doesn't need its own driver dependency.

Skip-safe by the same convention as test_neo4j_connection.py: if the local
Memgraph container isn't reachable (Docker not running, LaunchAgent hasn't
caught up yet, port not published), pytest reports these as skipped, not
failed - a skip means "this environment can't check this," not "the code is
broken." Unlike Aura, there's no required-env-vars gate here: the whole
point of local Memgraph is that it works out of the box at
bolt://localhost:7687 with no credentials, matching
~/data/memgraph-platform/docker-compose.yml's unauthenticated setup - so
this test tries to connect first and only skips if that actually fails.
"""

import os

import pytest
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable


@pytest.fixture
def live_driver():
    uri = os.environ.get("MEMGRAPH_URI", "bolt://localhost:7687")
    username = os.environ.get("MEMGRAPH_USERNAME", "")
    password = os.environ.get("MEMGRAPH_PASSWORD", "")

    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        driver.verify_connectivity()
    except (ServiceUnavailable, Neo4jError) as exc:
        driver.close()
        pytest.skip(f"Local Memgraph integration test skipped: {exc}")

    yield driver  # --- test runs here ---

    driver.close()


def test_live_connectivity_to_local_memgraph(live_driver):
    """verify_connectivity() alone (in the fixture) proves the driver can
    reach the container. This test additionally proves a query actually
    executes and returns the value Cypher says it should - the smallest
    possible round-trip that touches the real Bolt connection, not just a
    socket-level connect."""
    records, _, _ = live_driver.execute_query("RETURN 1 AS one")

    assert [record["one"] for record in records] == [1]


def test_live_memgraph_write_round_trip(live_driver):
    """Neo4j Aura's connectivity test stops at a read-only round-trip
    because Aura Free is the small, fixed-limit deployed-testing target -
    not where heavy writes belong. Memgraph is the other way around: it's
    specifically the target for heavy data loads during development, so its
    connectivity test proves a write actually round-trips too - create a
    node, read it back, then delete it so the test leaves no state behind."""
    marker = "memgraph-connectivity-test-node"

    live_driver.execute_query(
        "CREATE (n:ConnectivityCheck {marker: $marker})",
        marker=marker,
    )
    try:
        records, _, _ = live_driver.execute_query(
            "MATCH (n:ConnectivityCheck {marker: $marker}) RETURN count(n) AS created",
            marker=marker,
        )
        assert [record["created"] for record in records] == [1]
    finally:
        live_driver.execute_query(
            "MATCH (n:ConnectivityCheck {marker: $marker}) DELETE n",
            marker=marker,
        )
