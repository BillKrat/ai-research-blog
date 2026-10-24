# Stage review: the Diagnose button (2026-10-19)

Branch `claude-diagnose-button` (ai-research-blog only, not merged). From the human: a button on the exception grid that sends the diagnostics the correlation id so it can triage, starting small and growing a rule at a time.

## Feasibility, and what "sends it to Claude" means here

The app cannot call Claude itself (that would need an API key in production and would ship stack traces and logs to a third party: a decision for later). So the button does two things that are possible and useful now:

1. **Triage on the server** (rule-based, read-only): click **Diagnose** under an exception row and the API gathers the recorded exceptions, the kind of failure and its history, the request's log lines, runs a **live check** where a rule knows one (is mcp or the database healthy now?), and returns a verdict (*Recovered*, *Ongoing*, *Needs attention*, *Nothing recorded*), findings with severity, next steps.
2. **Hand-off to Claude**: the result includes the exact command (vault `run` of `Claude-diagnose.ps1 -CorrelationId <id>`) with a **Copy command** button. Paste it into a Claude session (or just give me the correlation id) and I read the same evidence through the MCP diagnostics tool and go further than the rules.

## What was built

- `GET /api/admin/diagnostics/{correlationId}/triage` (admin only): `Triage.RunAsync` with rules for: the API's mcp health probe (cause by message: TLS, timeout, 401 key mismatch; live mcp check; recovered vs ongoing), the database probe, browser-reported errors, generic timeouts; every exception also gets "what happened", its history (count, first/last seen, recurring within the hour) and a log summary (errors, warnings, slow request). An exception no rule knows still gets the facts and the hand-off. `DependencyProbes` runs the live checks (the same two calls as the health endpoint).
- `EntityGrid` gained an optional `rowTools` template shown under an expanded row; the Exceptions page uses it for the Diagnose button and the result panel (verdict badge, findings coloured by severity, next steps, command to copy). Entries recorded before correlation ids existed show a note instead of the button.
- Tests: WebApi 59 (9 new for the triage rules), Angular 25 specs, `ng build` clean. Live local run against real entries: the mcp probe exceptions were triaged as *Ongoing* with the 22-line log summary and a 10.7 s slow-request finding; on a developer machine the live check reports a 401 key mismatch (expected locally; in production the live check passes and the verdict becomes *Recovered*).

## How to test (about 5 minutes)

1. Deploy (merge), reload, Admin, Exceptions, **Show purged**; open a `health probe: mcp` row; click **Diagnose**: expect *Recovered* (mcp is healthy now), the history, the log lines summary, the next steps and the command with a Copy button.
2. Open a row without a correlation id (old entries): a note instead of a button.
3. Give me a correlation id from any new error and I will triage it with the tool; each exception we meet is a candidate for a new rule in `Triage.cs`.

## Limits

Rules cover four kinds of exception so far; the live checks are mcp and database only. The triage is read-only and never changes state. Anything else falls through to the hand-off.
