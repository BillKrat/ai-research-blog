-- Schema the app's code and tests actually expect for hello_messages/
-- triple_store. NOT a mirror of whatever currently sits in Railway's
-- Postgres under those names - confirmed 2026-08-13 that Railway's real
-- triple_store table holds unrelated data (entity_name/entity_type/
-- parent_id, not subject/predicate/object_value) predating this
-- project's actual TripleRepository work; hello_messages doesn't even
-- exist there. This file is the source of truth for what the shape
-- *should* be; see docs/adr/0010 for the id column below and
-- [[project-local-dev-infra]] (Claude's memory) for the drift finding.

CREATE TABLE IF NOT EXISTS hello_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL
);

INSERT INTO hello_messages (message)
SELECT 'Hello from local Postgres'
WHERE NOT EXISTS (SELECT 1 FROM hello_messages);

-- id: stable identity for CRUD/admin tooling (pgAdmin, etc.) and for
-- recognizing "the same fact" across independently seeded stores/
-- environments - see docs/adr/0010. DEFAULT gen_random_uuid() is a
-- safety net for direct inserts; the app always supplies an explicit
-- id itself (PostgresTripleRepository.create()).
--
-- UNIQUE (subject, predicate): promoted from an app-layer-only check
-- (ADR-0008's original design) to a real constraint now that the
-- schema is being deliberately redesigned - the database enforces the
-- single-valued-slot invariant even if something bypasses the app
-- entirely, e.g. a direct edit through pgAdmin.
CREATE TABLE IF NOT EXISTS triple_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object_value TEXT NOT NULL,
    UNIQUE (subject, predicate)
);

-- Fixture rows the test suite asserts on directly
-- (test_container.py::test_postgres_provider_can_select_from_triple_store).
-- No explicit id - these are throwaway test fixtures, not seed
-- vocabulary, so DEFAULT gen_random_uuid() assigning a fresh one per
-- environment is fine; nothing depends on it being stable.
INSERT INTO triple_store (subject, predicate, object_value)
SELECT * FROM (VALUES
    ('unit-test-1', 'kind', 'fixture'),
    ('unit-test-2', 'kind', 'fixture')
) AS fixture(subject, predicate, object_value)
WHERE NOT EXISTS (SELECT 1 FROM triple_store WHERE subject = fixture.subject);
