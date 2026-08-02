# Architecturally Significant Requirements (ASR)

Requirements that shape the architecture, captured early and
deliberately — before implementation — so that direction is clear
whether code gets written here or fleshed out separately (e.g. with
Copilot) and brought back in. Each ASR states what's required, why it
matters architecturally, what it implies structurally, and what's
still an open decision.

Relationship to [docs/adr/](adr/): an ASR is a requirement that
*drives* architecture; an ADR is a specific decision made in response
to one. Several ASRs below already have ADRs; others don't yet because
the decision hasn't been made.

---

## ASR-001: PostgreSQL triple store with inspectable schema

**Statement:** A PostgreSQL-backed triple store, with schemas visible
to the developer, manually authored initially to emulate what blog
users will eventually create for their own forms via the product UI.
Sample data added against these schemas drives the grid + form
rendering pipeline.

**Rationale:** Foundation for the core product feature — user-designed
forms (ADR-0004). Hand-authoring the schema first de-risks the data
model before building the form-builder UI that will generate schemas
automatically.

**Scale target:** Reasonable use case is under 100 records per user
context. No hard constraints enforced at this stage; load testing is
planned, not yet scheduled.

**Architectural impact:** Extends ADR-0004 (triple store) and ADR-0003
(`IDbProvider`). Introduces the first real triple schema, distinct
from the `hello_messages` / `triple_store` fixture tables currently
used only by tests. Begins the `FormDataRepository` implementation
ADR-0004 describes.

**Open questions:**
- How is "schema" represented — a `form_definitions` triple subject
  type, or a separate structured `form_schemas` table referenced by
  the triples?
- What makes the schema "visible" to the developer — direct
  psql/Railway Postgres dashboard access is sufficient short-term;
  does the app itself need a schema browser later?
- Grid/form rendering pipeline is DataFrame → `st.data_editor` per
  ADR-0004; the first concrete form to prove it out end-to-end is
  still undecided (ADR-0004's own "Still open" list).

---

## ASR-002: Security as the cross-cutting foundation

**Statement:** All resource access — blog accounts, Postgres data,
Claude access — is gated by a lightweight, self-issued JWT-based
identity system. A user id (and role/claim information) is passed
through every process boundary so the process that owns a resource can
authorize access to it.

**Rationale:** Called out explicitly as the foundation everything else
builds on, not a bolt-on added later. Everything downstream (ASR-003,
ASR-004) depends on this being right.

**Architectural impact:**
- Identity/role/group/feature data lives in the **same triple store**
  as form data, not a separate relational schema — reversed from this
  ASR's original recommendation here. See
  [ADR-0005](adr/0005-identity-data-in-triple-store.md) for the full
  reasoning (it corrects a performance argument this document
  originally made incorrectly) and the reversibility plan that makes
  it a low-risk choice.
- `IUserProvider` (data: role/group/feature triples for a user) and
  `IAuthorizationProvider` (service: resolves and enforces
  credentials/roles for a given user + resource) are two separate
  interfaces, not one — the same shape as `FormDataRepository` sitting
  on top of `IDbProvider`. Neither is built yet.
- Enforcement principle: authorization must gate what the backend
  *retrieves* (scoped queries, e.g. row-level filtering by user/
  subscription), not filter results after the fact based on
  client-held role information. This is already how ASR-003's MCP
  tools are designed (`search_subscribed_blogs` scopes its own query),
  so this principle doesn't require reworking that design — it
  confirms it.
- "Claude access" isn't really a per-user role — the app holds one
  Anthropic API key, not per-user credentials. What actually varies
  per user is *which data* Claude's tools are allowed to touch when
  reasoning on that user's behalf. This row is better scoped as
  "data-scoped authorization enforced when Claude's tools run" (see
  ASR-003) than as a literal Claude access role.

**Open questions:**
- **Token handling (preliminary, not yet designed):** after
  authentication, don't pass the token itself between internal
  processes — store it in a vault and pass only the bare user id.
  `IAuthorizationProvider` is the component that takes that user id,
  retrieves credentials, authenticates against downstream systems,
  determines roles, and returns them — MCP's own authorization spec
  covers client↔MCP-server auth but says nothing about this
  resolution step, so it's squarely this project's own design.
  Undecided: does `IAuthorizationProvider` run in-process, or is it
  (per the user's own framing) "a separate app" — a dedicated
  deployable, echoing the same same open question ASR-003 has about
  whether the MCP server is its own Railway service. Worth deciding
  both together rather than piecemeal, since together they determine
  how many separate deployables this system ends up with.
- Self-contained JWT (roles embedded in the token's claims, no lookup
  needed per request) vs. a centralized authorization/policy service
  the token is checked against (easier revocation and central control,
  but a new service and a network hop per check). Leaning toward
  self-contained JWT for this project's current scale — revisit if
  role logic grows complex enough to need central management.
- "Railway vault" — Railway doesn't have a distinct secrets-manager
  product; this most likely means storing the JWT signing secret as a
  Railway environment variable, the same pattern already used for
  `ANTHROPIC_API_KEY` / `DATABASE_URL`. Confirm this is what's meant,
  versus wanting an actual dedicated secrets-management service (new
  infrastructure, likely more than this stage needs). Separately, the
  token vault mentioned above (for post-auth tokens, not the signing
  secret) is a distinct thing and also undecided.
- JWT expiry/refresh strategy, and whether revocation-before-expiry
  matters (plain JWTs can't be revoked early without a blocklist).
- Exact roles/claims model — what roles exist (owner, subscriber,
  admin?) and how they map onto blog accounts vs. Postgres data vs.
  Claude-mediated data access.

---

## ASR-003: MCP as the tool-layer gateway for the AI assistant

**Statement:** Define and implement MCP's role as the interface
between Claude (the AI assistant) and the resources it needs to act
on — addressing the security and collaboration concerns from ASR-002.

**Rationale:** Explicitly flagged as needing direct discussion before
any of ASR-004's assistant features can be built responsibly.

**Decision (recommended, not yet committed to code):**

- MCP is the right mechanism specifically for *LLM-tool-mediated*
  access: what Claude calls as a tool while reasoning (search my
  blogs, search subscribed blogs, search my documents, possibly
  draft/edit content). It is **not** a replacement for the plain CRUD
  path a user drives directly through the UI — that stays on the
  existing `IDbProvider`/repository path, no LLM round-trip involved.
- The browser does not talk to MCP servers directly. The MCP client
  role lives in a backend: either Anthropic's own infrastructure via
  the Claude API's native MCP connector (`mcp_servers` +
  `mcp_toolset` request parameters), or a hand-rolled client/loop in
  this app's own backend.
- **Recommended: use the native Claude API MCP connector**, not a
  hand-rolled loop — less code to own, Anthropic handles the tool-call
  round trip.
- One MCP server (Python, official `mcp` SDK), not one per resource,
  exposing multiple tools (`search_my_blogs`, `search_subscribed_blogs`,
  `search_documents`, etc.), each delegating internally to the
  existing `IDbProvider`/repository layer, scoped to the authenticated
  user. Split into multiple servers later only for a real
  deployment/scaling reason.
- Security integration: MCP's OAuth 2.1-based authorization for remote
  servers (resource indicators, RFC 8707) is the mechanism for
  enforcing ASR-002's per-user authorization on tool calls. The JWT
  (or a short-lived derived token) is passed as the connector's
  `authorization_token`; the MCP server validates it per call and
  enforces row-level scoping (e.g. only blogs this user owns or
  subscribes to).
- This directly reopens `IToolProvider` (ADR-0003, stub only): a real
  MCP server may replace the need for that in-process interface
  entirely, rather than being built as a fifth-wheel alongside it.
  **This is a decision to make explicitly, not a default** — see open
  questions.

**Open questions:**
- Confirm: native Claude API MCP connector vs. self-hosted MCP
  client/loop. (Recommendation above; not yet decided.)
- Does the MCP server retire `IToolProvider`, or does `IToolProvider`
  become a thin wrapper around an MCP client? Needs a decision before
  either is built.
- Where does the MCP server run — same Railway service as the
  Streamlit app, or a separate deployable? Separate is a cleaner
  security boundary and scales independently; same-service is less
  infrastructure to manage. No decision yet.
- Exact tool list and schemas for v1 — depends on ASR-004's scope
  being nailed down first.

---

## ASR-004: AI-assisted blog platform with documents and cross-user subscriptions

**Statement:** A blog platform where an AI assistant helps users
construct posts. Users can upload architectural documents referenced
by their posts. Queries can span the user's own blogs and documents,
and any other user's blogs they subscribe to.

**Rationale:** This is the actual product — everything else in this
list exists to support it.

**Architectural impact:**
- Needs a `subscriptions` relational table (`user_id`,
  `subscribed_to_user_id`) — same reasoning as ASR-002: relationship
  data that's checked on every cross-user query, not triple data.
- Cross-user querying is the sharpest edge of ASR-002's authorization
  model — a query must never leak a non-subscribed user's private
  content. This is exactly what ASR-003's `search_*` MCP tools need to
  enforce internally, not something to bolt on after the fact.
- Document upload/storage is a new capability with no existing
  interface — likely a new `IDocumentStore` (or similar), and likely
  where embeddings/RAG enter the picture for document search. Not yet
  covered by any ADR.

**Open questions:**
- Document storage medium — Postgres (bytea/large objects) vs. an
  external object store. Railway doesn't have a built-in blob-storage
  product equivalent to S3, so this may require an external service.
- Embedding/RAG approach for searching uploaded documents.
- What "reference via blogs" means functionally — inline citation,
  full-text search only, something else.

---

## ASR-005: AI cost mitigation via model routing

**Statement:** Mitigate Claude's cost by routing between a small/cheap
reasoning path and Claude itself, based on task importance — not
everything needs Claude (particularly Opus-tier), but important work
does.

**Rationale:** Explicit cost concern, called out directly.

**Architectural impact:** Largely already supported by the existing
`IProvider` abstraction (ADR-0002/0003) — adding a second `IProvider`
implementation (a cheap/fast Claude tier, or a genuinely local/small
model) is a natural extension, not new architecture. The real new work
is a **routing policy**: something has to decide, per request, which
provider handles it. That policy doesn't exist yet and is a good
candidate for its own ADR once a rule is chosen.

**Open questions:**
- What defines "important" — a user-facing setting, a heuristic, a
  classifier step of its own? Starting point worth considering: Haiku
  for simple/high-volume tasks (classification, simple retrieval
  shaping), Opus/Claude proper for actual content generation and
  reasoning — revisit once real usage patterns exist rather than
  guessing at a policy now.
