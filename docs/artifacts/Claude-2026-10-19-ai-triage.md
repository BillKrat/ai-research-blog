# Stage review: "Ask Claude" (AI triage) on the exception grid (2026-10-19)

Branch `claude-ai-triage` (ai-research-blog only). Builds on the Diagnose button ([review](Claude-2026-10-19-diagnose-button.md)).

## What was built

- Under a row's Diagnose result: **Ask Claude**. It sends a **scrubbed** report of that request to Anthropic's Messages API and shows Claude's assessment: a summary (about 60 words), the likely cause with a confidence, ordered next steps, and what evidence is missing, plus the model and token counts.
- **What is sent** (`AiTriage.BuildReportAsync`): the rule-based triage, the exception type, message and stack (5,000 characters), the history of the kind of failure, up to 40 log lines (time, level, message, first line of the exception), all capped at 24,000 characters. A signed-in user shows only as "yes/no", never the name.
- **Redaction** (`Redactor`): JWTs, Bearer tokens, API keys, connection-string parts (Host, Username, Password...), `password=`/`secret=`/`token=` pairs, e-mail addresses, IP addresses, the user name in `C:\Users\<name>`. Kept: exception types and messages, our own host names, request paths, times, the correlation id. It is a safety net with limits (a secret that reads like prose would pass), so the builder also limits what is included at all.
- **Cost and safety guards**: only from a click (POST), admin only; the answer is cached an hour per request (a second click costs nothing); at most 20 calls an hour in all (`Anthropic:MaxCallsPerHour`); no automatic retries (a retry would double the cost); every call is logged (id, model, token counts, characters sent; never the report or the key); an error from the AI (limit, outage, unexpected answer) is shown as a plain reason, not an exception.
- **Configuration**: `Anthropic:ApiKey` (secret), `Anthropic:Model` (default `claude-sonnet-5-5`), `MaxOutputTokens`, `MaxCallsPerHour`. **Without a key the button says "not set up"** and the rule-based triage is unaffected, so this is safe to deploy before the key exists.
- Tests: WebApi 77 (18 new: redaction cases, key only in the header, the report that leaves is scrubbed, cache, hourly cap, HTTP error, non-JSON answer, network failure), Angular 26 specs, `ng build` clean.

## Your steps to switch it on (the key is yours; I never see it)

1. Dev: `powershell -File docs\Claude-secret.ps1 set anthropic/ai-research-blog/diagnose`, then `.\docs\Claude-secret.ps1 sync` (the target was added to `docs/Claude-secret-targets.json`).
2. Production: in the SmarterASP panel, api site, environment secrets: `Anthropic__ApiKey` (two underscores) = the key; restart the api site.
3. Optional: `Anthropic__Model` (for example `claude-haiku-5-5` for a cheaper, faster answer) and `Anthropic__MaxCallsPerHour`.

## How to test

Sign in as Admin, Exceptions, Show purged, expand a row, **Diagnose**, then **Ask Claude**: expect a short assessment in a few seconds, with the model and tokens shown. Click again: "kept from earlier" and no new cost.

## Not done / later

- The key has a 30-day expiry: rotate it (vault `set`, `sync`, and the host secret).
- Per-user budget and a monthly total in the UI; today only the hourly cap.
- Sending the MCP server's logs too, and a rule-learning loop (turn Claude's good answers into `Triage.cs` rules).
