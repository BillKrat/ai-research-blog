# Review: SmarterASP response to the MCP integration risk review (2026-10-02)

Target: vendor reply to ticket PD-3710717 (`docs/smarter-asp/RiskReview-SmarterASP-MCP-Integration-response.txt`), answering the questions in `docs/smarter-asp/RiskReview-SmarterASP-MCP-Integration.txt`. Owner of the integration: the human; this review is Claude's reading of it.

## What the vendor confirmed

- **Scopes:** `hosting.read` and `hosting.read hosting.write`, enforced server-side per endpoint.
- **Key lifetime:** expiry from 5 minutes to 1 year, revocation effective on the next request, last-used timestamp shown in the panel. Staff under delegated login cannot create or revoke customer keys.
- **Storage:** only a keyed HMAC is stored; plaintext shown once. The key is exchanged for a short-lived internal token.
- **Audit:** every request logged (route, method, status, outcome, duration, correlation id); callers stored as keyed HMACs. Alerting on auth denials, rate limits, errors, latency, audit-pipeline failures. HTTP 429 on excess volume.

## The accepted risk

Scopes are not granular. A write-capable key can act on any website, database, DNS zone or mailbox in the account; a DNS-only or single-site key is not possible. This is a vendor limitation, so mitigation is operational only.

## Not answered

- Whether the customer can read the audit records, or only the vendor.
- Post-breach hardening changes and log/key retention.
- A single "revoke all keys" action for incident response.

## Decision

1. Routine inspection uses a read-only key.
2. Write work uses a short-lived write key per task, expiry set, revoked afterwards.
3. The key is never typed into chat or tool parameters; it stays in the credential store and reaches the MCP server through `SMARTERASP_API_KEY` (rule 5).
4. Compare the panel's last-used timestamps with our known activity as a cheap audit.
5. Optional follow-up on the ticket for the unanswered items above.

The human issues and revokes keys; Claude does not.
