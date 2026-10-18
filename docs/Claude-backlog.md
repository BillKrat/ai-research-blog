# Backlog

Ideas and planned work that are not the current path. "Put it in backlog" means append here and keep going. Newest first within a group; move an item to the Docs/AGENTS.md `Remaining` list when it becomes the current path.

Guiding aim: keep eyes on the running system at every level (logs, exceptions, health) so a human or an AI through MCP can isolate a production issue fast. Add seams for that even when they start as placeholders.

## Observability (priority)

- **CorrelationId end to end.** One id per process/request, carried through logs, outbound HTTP calls, the exception log and the error response. Plan: a Claude-decision doc (next step).
- **Exception signature.** Hash the exception (type, message shape, top app frames) so a repeat reuses its existing exception id and only the occurrence is logged.
- **Log and exception read tools for MCP.** Read-only tools on the MCP server: search logs by CorrelationId, list/inspect exceptions. Placeholder seam first.
- **Health check detail.** `/api/health` reports each dependency (database, mcp) separately with timings.

## Features

- Form-contract stage 1 to 3, password-change caption and "Update password", Admin menu for the exception icon, per-field messages, targeted schema read at startup (see `AGENTS.md` Remaining).

## Infrastructure

- Move schema IRIs to `https://schema.global-webnet.com/<area>/<name>` (deliberate migration; see `AGENTS.md`).
- Check TLS on `schema.global-webnet.com` before 2026-11-15; calendar the 2027-01-09 free-cert expiry.
