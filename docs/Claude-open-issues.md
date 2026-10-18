# Open issues

Known problems that are not the current path. "Put it in open issues" means append here and keep going. Remove an entry when fixed (git keeps the history).

## OI-1: mcp.global-webnet.com has no working TLS (found 2026-10-18)

- **Symptom:** the WebApi health check logs `The SSL connection could not be established` calling `https://mcp.global-webnet.com/api/hello`; the Standard-Retry resilience handler retries 3 times (about 8-10 s per `/api/health`), then reports "Failed to reach mcp".
- **Evidence:** every run since 2026-10-11 (125 failures in the 10-11 log, 15 on 10-15, repeating on 10-18 across minutes, so not a cold start). `curl` from the same machine gets `Connection was reset` during the handshake for `mcp.` while `api.` and `www.` return 200 with a valid certificate. Plain http to mcp answers 404, so the site is up; only its HTTPS binding is missing.
- **Cause (likely):** the 2026-10-11 free-SSL migration covered the bare domain, `www` and `api`, but not `mcp`.
- **Confirmed 2026-10-18:** SmarterASP `domains_list` shows `mcp.global-webnet.com` with `sslStatus: not_configured`. `ssl_request` was refused with `ssl_preflight_failed`: the domain must answer HTTP 200 on its root without redirecting, and the MCP site's `/` returned 404 (and every path was redirected to https).
- **Fix, in two steps:** (1) done on branch `claude-users-roles`: McpServer answers 200 on `/` and no longer redirects it (as the API already does); it takes effect when the branch is merged to `main` and deployed. (2) After that deploy, call `ssl_request` for `site-1885461` / `mcp.global-webnet.com` (or request it in the panel), then re-run `curl https://mcp.global-webnet.com/api/hello`.
- **Related seam:** a failing optional dependency should not add 10 s to the health call; consider a shorter timeout and no retries for the health probe.
