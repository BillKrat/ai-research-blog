-- Local mirror of ai-research-blog's Railway Postgres schema.
-- Railway's tables were created out of band (no migration file in the
-- repo) - this reconstructs the same shape from what the app's code and
-- tests expect, so local dev/test behaves the same as against Railway.

CREATE TABLE IF NOT EXISTS hello_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL
);

INSERT INTO hello_messages (message)
SELECT 'Hello from local Postgres'
WHERE NOT EXISTS (SELECT 1 FROM hello_messages);

-- No unique constraint on (subject, predicate) - ADR-0008 deliberately
-- enforces that at the application layer (PostgresTripleRepository's
-- check-then-insert), not the database.
CREATE TABLE IF NOT EXISTS triple_store (
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object_value TEXT NOT NULL
);

-- Fixture rows the test suite asserts on directly
-- (test_container.py::test_postgres_provider_can_select_from_triple_store).
INSERT INTO triple_store (subject, predicate, object_value)
SELECT * FROM (VALUES
    ('unit-test-1', 'kind', 'fixture'),
    ('unit-test-2', 'kind', 'fixture')
) AS fixture(subject, predicate, object_value)
WHERE NOT EXISTS (SELECT 1 FROM triple_store WHERE subject = fixture.subject);
