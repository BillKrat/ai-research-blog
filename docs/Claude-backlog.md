# Backlog

Ideas and planned work that are not the current path. "Put it in backlog" means append here and keep going. Newest first within a group; move an item to the Docs/AGENTS.md `Remaining` list when it becomes the current path.

Guiding aim: keep eyes on the running system at every level (logs, exceptions, health) so a human or an AI through MCP can isolate a production issue fast. Add seams for that even when they start as placeholders.

## Observability (priority)

- **CorrelationId end to end.** One id per process/request, carried through logs, outbound HTTP calls, the exception log and the error response. Plan: a Claude-decision doc (next step).
- **Exception signature.** Hash the exception (type, message shape, top app frames) so a repeat reuses its existing exception id and only the occurrence is logged.
- **MCP diagnostics tool.** The read seam exists (`IDiagnosticsReader`, `GET /api/admin/diagnostics/{id}`, stage 4); built in stage 5 (McpServer tool, scope `mcp.diagnostics.read`, client `claude-diagnostics`); remaining: the MCP wire-protocol wrapper (tool listing) and the human setting the client secret.
- **Health check detail.** `/api/health` reports each dependency (database, mcp) separately with timings.

- **No silent errors audit (from the human, 2026-10-18).** Every failure must be visible to an administrator and traceable by CorrelationId. Done in stage 4: dependency probe failures (hourly throttle) and browser errors (signed-in users). Still open: (1) anonymous browser errors (login page); (2) background work and startup failures (Serilog fatal log only); (3) handled 4xx failures are not "exceptions" but may deserve a counter; (4) the deploy workflow smoke tests are not visible in the app.
- **Diagnose button (from the human, 2026-10-18).** When the diagnostics are mature, a Diagnose action on an exception or signature that runs a triage process and reports a verdict: gather the request's log lines and exceptions by CorrelationId (`IDiagnosticsReader`), check the dependencies involved (health probe, TLS, database), compare with earlier occurrences of the same signature, and propose a cause and next step. Starts as the read-only checklist a human or Claude follows; automate each step as it proves reliable.
- **Admin dashboard.** Move the exceptions area onto a Dashboard (already planned) with signatures counted per day, acknowledge/fixed actions on a signature (Status beyond `New`), and links from a signature to its occurrences.

## Features

- Form-contract stage 1 to 3, password-change caption and "Update password", Admin menu for the exception icon, per-field messages, targeted schema read at startup (see `AGENTS.md` Remaining).

## Infrastructure

- Move schema IRIs to `https://schema.global-webnet.com/<area>/<name>` (deliberate migration; see `AGENTS.md`).
- Check TLS on `schema.global-webnet.com` before 2026-11-15; calendar the 2027-01-09 free-cert expiry.
