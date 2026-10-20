# Backlog

Ideas and planned work that are not the current path. "Put it in backlog" means append here and keep going. Newest first within a group; move an item to the Docs/AGENTS.md `Remaining` list when it becomes the current path.

Guiding aim: keep eyes on the running system at every level (logs, exceptions, health) so a human or an AI through MCP can isolate a production issue fast. Add seams for that even when they start as placeholders.

## Observability (priority)

- **CorrelationId end to end.** One id per process/request, carried through logs, outbound HTTP calls, the exception log and the error response. Plan: a Claude-decision doc (next step).
- **Exception signature.** Hash the exception (type, message shape, top app frames) so a repeat reuses its existing exception id and only the occurrence is logged.
- **MCP diagnostics tool.** DONE (2026-10-20): REST routes plus the MCP wire protocol at `POST /mcp` on the mcp site (initialize, tools/list, tools/call: diagnose_request, recent_exceptions, exception_signatures; scope `mcp.diagnostics.read`). Remaining: the human registers the endpoint in a Claude client and sets the client secret.
- **Health check detail.** `/api/health` reports each dependency (database, mcp) separately with timings.

- **No silent errors audit (from the human, 2026-10-18).** DONE (2026-10-20): dependency probes, signed-in and anonymous browser errors (caps), startup crashes and process-level failures (failure journal, reported on the next start), unobserved task failures, `ObservedBackgroundService` for future workers. Deliberately not done: (3) handled 4xx counter (a 4xx is the system working; revisit if abuse shows up) and (4) deploy smoke tests in the app (the GitHub workflow is their home). McpServer has no exception store, so it only logs.
- **Diagnose button (from the human, 2026-10-18): first version built 2026-10-19 (see the stage review); keep adding a rule per exception we meet; later an optional AI call (needs an API key and a data decision).** Original idea: when the diagnostics are mature, a Diagnose action on an exception or signature that runs a triage process and reports a verdict: gather the request's log lines and exceptions by CorrelationId (`IDiagnosticsReader`), check the dependencies involved (health probe, TLS, database), compare with earlier occurrences of the same signature, and propose a cause and next step. Starts as the read-only checklist a human or Claude follows; automate each step as it proves reliable.
- **Admin dashboard.** Status actions DONE (2026-10-20: Acknowledged / Fixed per kind, Regressed set by the system). Still open: move the exceptions area onto a Dashboard with signatures counted per day and links from a signature to its occurrences.

## Features

- Form-contract stage 1 to 3, password-change caption and "Update password", Admin menu for the exception icon, per-field messages, targeted schema read at startup (see `AGENTS.md` Remaining).

## Infrastructure

- Move schema IRIs to `https://schema.global-webnet.com/<area>/<name>` (deliberate migration; see `AGENTS.md`).
- Check TLS on `schema.global-webnet.com` before 2026-11-15; calendar the 2027-01-09 free-cert expiry.
