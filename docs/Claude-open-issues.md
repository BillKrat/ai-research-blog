# Open issues

Known problems that are not the current path. "Put it in open issues" means append here and keep going. Remove an entry when fixed (git keeps the history).

## OI-1: mcp.global-webnet.com has no working TLS (found 2026-10-18)

- **Symptom:** the WebApi health check logs `The SSL connection could not be established` calling `https://mcp.global-webnet.com/api/hello`; the Standard-Retry resilience handler retries 3 times (about 8-10 s per `/api/health`), then reports "Failed to reach mcp".
- **Evidence:** every run since 2026-10-11 (125 failures in the 10-11 log, 15 on 10-15, repeating on 10-18 across minutes, so not a cold start). `curl` from the same machine gets `Connection was reset` during the handshake for `mcp.` while `api.` and `www.` return 200 with a valid certificate. Plain http to mcp answers 404, so the site is up; only its HTTPS binding is missing.
- **Cause (likely):** the 2026-10-11 free-SSL migration covered the bare domain, `www` and `api`, but not `mcp`.
- **Fix:** request/bind the free certificate for `mcp.global-webnet.com` in SmarterASP (panel or the `ssl_request` MCP tool), then re-run `curl https://mcp.global-webnet.com/api/hello`.
- **Related seam:** a failing optional dependency should not add 10 s to the health call; consider a shorter timeout and no retries for the health probe.
