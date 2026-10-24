# Stage review: health surfaces dependency failures (2026-10-19)

Branch `claude-health-degraded` (ai-research-blog only, not merged). From the human: "the mcp exception has turned into a silent failure; fix and surface it".

## What was built

- `GET /api/health` now reports each dependency: `dependencies: [{name, status ok|failed, durationMs, detail}]` plus the request's `correlationId`. `status` is **Healthy**, **Degraded** (mcp failed; HTTP 200, so deploys of the API do not fail for it) or **Unhealthy** (database failed; HTTP 503, so a deploy smoke test does fail). `detail` is a short code (`ok`, `timeout`, `http_401`, `exception_<Type>`), never an exception message, because this endpoint is anonymous; the full exception goes to the exception log (throttled hourly) and the logs, found by the correlation id.
- A database check (a count against the N-Quad store, 5 second limit) joins the mcp check; a failing database is also recorded in the exception log (`health probe: database`).
- The health client no longer retries (the default resilience handler made one failure take 8-10 s); the call answers in about 2 s even when mcp is down.
- Angular: the header status badge now shows **degraded: mcp (http_401) as of 7:49:40 AM** (amber) or **unhealthy: database (...)** (red) instead of a green "healthy"; hover shows the trace id. It re-checks every two minutes, so a failure or a recovery appears without a reload. A 503 body is shown, not collapsed to "unreachable".
- Tests: WebApi 50 (4 new/changed health tests), Angular 21 specs, `ng build` clean. Live local run: `status: Degraded`, `mcp failed http_401` (local key differs from production), `database ok 63 ms`, in 2.0 s.

## Where mcp stands

The free certificate was issued by SmarterASP staff, so production health is Healthy again. The mcp workflow re-run is green. See OI-1 in Claude-open-issues.md.

## How to test

1. Merge to `main` (deploys); production shows the green "healthy" badge as before.
2. To see Degraded: stop the `mcp` site briefly in the panel (or rename its secret) and reload; the badge turns amber within two minutes and the exception log gets one `health probe: mcp` entry per hour.

## Question

Merge `claude-health-degraded` (and the docs branch it contains) to `main`?
