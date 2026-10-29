# Decision (proposed, 2026-10-24): collaboration as its own item type, switched by built-in plug-ins

Asked by the human: collaboration drafts swamp the Posts page, so give them their own section, and add a Plugins page (like BlogEngine's) with built-ins Developer Collaboration, Research Collaboration and Decisions that appear under Content when enabled. Answers given 2026-10-24: one engine with two kinds; the conversation works across every current use case; migrate the existing drafts.

## Design
- **Item type.** A new schema, `CollaborationItem` (under `https://schema.global-webnet.com/collaboration/...`), separate from Post, so public reader queries cannot return one by construction. Common fields: title, body (Markdown), kind, review state, author, created and changed times, tenant. A `kind` selects the field set and the allowed states, each kind shipping as a seed file.
  - **Developer** kind: branch, repos, commit or PR, test steps, verify result; states Needs review, Approved, Changes requested.
  - **Research** kind: question, sources, findings; states Open, Accepted into a post, Closed. No approval.
- **Conversation** is a shared capability keyed by the id of whatever it sits under (a collaboration item or a post). Moving an item keeps its id, so its thread, decisions and review state survive the migration.
- **Decisions** lists conversation entries recorded as decisions across both; it depends on the conversation, not on any kind.
- **Plug-ins.** A built-in plug-in is a code-declared bundle: menu items, schema, endpoints, MCP tools and settings. A `Plugin` entity (per blog, with the tenant field) stores Enabled, Priority and its settings; the Plugins page lists them with Enable and Customize. Disabled: the menu entry is gone, the endpoints refuse, the MCP tools are not listed; data is kept. Changing the enabled state is administrator-only. MEF-loaded plug-ins stay deferred until a second author exists; the page and the entity do not change when they arrive.

## Stages (one branch each, review loop between)
1. **Split the type.** `CollaborationItem` schema and Developer kind (seed), its own admin menu section under Content, API and grid and form, new MCP tools (create, update, list, read conversation) with `Claude-author.ps1` and the review post template retargeted, and the migration of the existing Collaboration-category drafts (a dry-run report first, then apply; ids kept). Fixes the Posts clutter by itself.
2. **Plugins page.** `Plugin` entity, the three built-ins, Enable and Customize, menu, endpoint and MCP gating.
3. **Research kind** and the per-kind fields and states.

## Risks and decisions to confirm
- The review loop depends on this type, so stage 1 moves the app and the tooling together; no half-way state in production.
- The migration changes production data: dry run, backup of the affected rows, then apply, per the usual production-write rule.
- Existing Claude-author drafts of category Collaboration stay readable by id throughout.
