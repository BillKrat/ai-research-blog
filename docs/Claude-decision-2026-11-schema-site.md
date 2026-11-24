# Decision (proposed): the schema site, beta row 10

Written 2026-11-23 for the human's review. Source: the human's 2026-11-21 brief ("one place where a developer sees schemas, tables, types and people at a glance; navigated, not hardcoded: parent and children like folders, built from the data, so dimensions nobody has thought of yet show up without code changes") and the schema IRI convention (`https://schema.global-webnet.com/<area>/<name>`, decided 2026-10-11 so the IRIs can become real, documented pages). Nothing is built yet.

## What the data gives us

- Schemas are ordinary entities in the N-Quad store (`SchemaEntity`, with `SchemaFieldEntity` children), loaded today by `SchemaDal` and `SchemaBll`. Their addresses already form a hierarchy: **area, then schema, then field**, for example `identity/Tenant`, `identity/TenantRoleAssignment/Tenant` (a field of the schema before it), `content/Post`, `collaboration/PluginSetting/PluginKey`.
- The older schemas (User, SchemaField, ExceptionLog) still use `https://global-webnet.com/schema/...`. They move only by a deliberate named migration, so the site must show both conventions.
- A field says its type, label, whether it is required or read-only, and, for a pointer field, which schema it points at. The reverse of those pointers ("used by") is data too, so the tree can be walked in both directions.

## Principles

1. **Built from the data, nothing hardcoded.** The tree is computed from the IRIs and the fields. A new area, schema or field appears the next time a seed adds it, with no site change.
2. **The IRI is the address.** `https://schema.global-webnet.com/identity/Tenant` opens that schema's page. People get HTML; a tool that asks for JSON gets JSON (content negotiation, same address).
3. **Public means schemas only.** The public site never shows a row of data, a person, a tenant, an e-mail address or a count of any of them. It documents the shape, not the contents.
4. **Read-only by construction.** The host that serves it cannot write: it references only the read-side libraries, and it connects with a database user that has SELECT only (the same pattern as the legacy `blogai_reader` login).

## Recommended design

- **A new small host, `SchemaSite.WebApi`**, deployed to the existing `schema` site on its own application pool. It references `Adventures.Entities` and `Adventures.Data.NQuad(.Postgres)` only (a guard test pins the closure, as for the NQuad browser). It is not the NQuad browser: that tool edits data and sits behind an Admin sign-in, and must not become an anonymous surface.
- **A catalog in the library layer** (`SchemaCatalog`, tested without a host): reads every schema and field from the store and builds the tree, each node's page model (description, fields, "used by", sibling and parent links) and a flat index. Both IRI conventions are read; the older one appears under a **Legacy** area.
- **Pages:** the home page is the tree of areas; an area lists its schemas; a schema page lists its fields with type, label, required and read-only flags and links to the schema a pointer field targets and to the schemas that point at it. Server-rendered HTML (fast, indexable, works without JavaScript, no client build to deploy), plus the same model as JSON.
- **Hardening:** the shared API headers (a strict content policy: no inline script, no framing), a per-IP rate limit, output encoding on every value, and a response cache so a crawler cannot reach the database on every hit.
- **Signed-in view of tables, types and people (the other half of the human's wish):** a later stage, behind the same Admin sign-in as the NQuad browser, adding counts and a drill-down into data. It is a separate surface from the public pages.

## Stages (small, each verified and reviewed)

1. **`SchemaCatalog`** and its tests (tree from both IRI conventions, field and "used by" links, an unknown address is a clean "not found", nothing but schema entities is ever read).
2. **`SchemaSite.WebApi`**: the pages and JSON, the hardening, the closure guard, a local run against the dev store.
3. **Deploy to the `schema` site**: the SELECT-only database user (a grants file for the human to run), pool settings, an FTP user and a dry-run upload, then a live read-only check of the certificate and pages.
4. **The signed-in data view** (decide the shape with the human after stage 3).

## Decisions for the human (my recommendation first; an unanswered one means I go with it)

1. **Public, schemas only (yes).** The alternative, signed-in only, would stop the IRIs from being addresses a stranger can follow.
2. **A separate host with a SELECT-only database user (yes).** It means one extra database user, which you create in the panel with a grants file I write; the password goes in the vault.
3. **Both IRI conventions, the older one under a Legacy area (yes).**
4. **People and data counts only in the signed-in view, stage 4 (yes).** Public pages never show them.
5. **HTML for people and JSON for tools at the same address now; a linked-data format (Turtle) later if wanted (yes).**
