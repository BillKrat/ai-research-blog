# Plan: CorrelationId and exception signature (proposed, not built)

Status: **plan for review**, 2026-10-18. Branch `claude-users-roles` (both repos). Builds on the exception log already merged to the branch and on the 2026-09-26 direction note in `Adventures.Foundation/docs/Claude-decision-2026-09-exception-handling-direction.md` (signature lookup, `ErrorType`/`ErrorEx`), which this plan supersedes in practice: the existing `ExceptionLog` entity becomes the occurrence record, one new entity holds the signature.

Goal: from one id, a human or an AI (through MCP) can pull every log line and exception for a single request, across the Angular client, the API and the MCP server.

## Where we are

- Serilog writes console and a rolling file (`logs/webapi-.log`); no id ties the lines of one request together.
- `UnhandledExceptionHandler` logs the exception, calls `IExceptionLogBll.RecordAsync`, returns `{ status, title, errorId }`. Every occurrence is a new `ExceptionLog` row; identical failures are not grouped. Fields: OccurredAt, ExceptionType, Message, StackTrace, Request, UserName.
- Aspire/ServiceDefaults already has OpenTelemetry tracing with HttpClient and ASP.NET Core instrumentation, so every request already has an `Activity` with a W3C trace id, and outgoing calls (API to MCP) already send `traceparent`. Nothing reads it into the logs.

## Design

**1. The CorrelationId is the W3C trace id.** One id, no parallel scheme: 32 hex characters from `Activity.Current.TraceId`, shared with the Aspire dashboard traces. Middleware (`CorrelationIdMiddleware`, in `Adventures.WebApi` so both sites use it) runs first and:
- if the request carries `X-Correlation-Id` (Angular, a tool, or another site), starts the request `Activity` under that id; otherwise uses the one OpenTelemetry created;
- pushes `CorrelationId` into the Serilog `LogContext` so every line of the request carries it;
- echoes `X-Correlation-Id` on the response, including error responses.

**2. Logs show it.** The file and console output templates gain `{CorrelationId}`; the file sink also gets a compact JSON sibling (`webapi-.json.log`) so an MCP tool can filter by id without parsing text.

**3. Outbound calls carry it.** The `McpServer` HttpClient already propagates `traceparent`; add `X-Correlation-Id` too (a small delegating handler) so a non-OTel receiver is covered. `McpServer.WebApi` gets the same middleware.

**4. Exception signature (new `ExceptionType` entity, name to settle: `ExceptionSignature`).** Signature = SHA-256 of: exception type full name + message with volatile parts normalized (GUIDs, numbers, quoted values replaced by placeholders) + the first application stack frame (type.method, no line numbers). Holds: SignatureId (the hash), first seen, last seen, occurrence count, a status (new, acknowledged, fixed).

**5. Handler flow.** `UnhandledExceptionHandler`: compute signature, look up by hash; reuse or create it; write the occurrence (`ExceptionLog`, now with SignatureId, CorrelationId, AppName, Environment, host, app version); log with the correlation id; return `{ status, title, errorId, correlationId }`. Failure to record is still only logged, never masks the original. Redaction: stack traces and messages are truncated as now; add a scrub step for obvious secrets (connection strings, bearer tokens) before storing.

**6. Angular.** An HTTP interceptor mints a correlation id per user action (UUID without dashes), sends it as `X-Correlation-Id`, and the friendly error message shows it ("reference ...") so a user can quote it.

**7. MCP seams (placeholders now, tools later).** A read-only `IDiagnosticsReader` interface in Foundation with `FindByCorrelationId`, `ListSignatures`, `GetSignature`; a stub implementation reading the exception tables; the MCP tool registration left empty with a comment. Nothing exposed externally in this stage.

**8. Health check (separate).** Per-dependency health and the 10 s mcp delay are tracked in the backlog and OI-1, not here.

## Stages (each its own commit and stage review, then pause)

1. Middleware, log templates, JSON log, response header, unit tests (middleware echoes/creates id; log context carries it). WebApi and McpServer.
2. Signature entity, normalizer, lookup-or-create, handler writes occurrence with ids; new seed file (`schema.global-webnet.com/exception/...` IRIs per the convention); tests for normalization and grouping.
3. Angular interceptor and the reference shown in errors; admin Exceptions grid grouped by signature with counts.
4. `IDiagnosticsReader` seam and stub; backlog entry for the MCP tools.

## Questions for you

- Signature name: `ExceptionSignature` (my pick) or `ErrorType` as in the earlier note?
- Existing `ExceptionLog` rows have no signature: leave them (my pick) or backfill once?
- The new seed file would apply to production on deploy of `ai-research-blog`, like the last one: fine after your review?
