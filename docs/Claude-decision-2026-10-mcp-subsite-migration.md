# Plan: move mcp.global-webnet.com to a free-SSL subsite (proposed, nothing changed yet)

Status 2026-10-19. Tracks OI-1 in [Claude-open-issues.md](Claude-open-issues.md). Rule for this plan: **no panel step is done until the human confirms it; the human does every step that changes the panel, Claude does the code, CI, verification and (read-only or API-tool) checks.**

## Why

`mcp.global-webnet.com` is a custom domain mapped onto the standalone site `mcp` (`site5`). Its SSL dialog offers only paid options and `ssl_request` cannot queue a free certificate. `api.global-webnet.com` is a SmarterASP *subsite* (internal name `subsite3`, created with "+ Sub Domain" from the owned domain `global-webnet.com`) and it has the free certificate. Confidence that a subsite gets the free option is good (api is the proof) but not certain for a new one, so the old site stays until the new one has its certificate.

## What I found (read-only)

| Item | Today (mcp, site5) | api (subsite3), for parity |
|---|---|---|
| FTP user | `billkrat-mcp`, home `/mcp` | `billkrat-api`, home `/api-global` |
| App pool | no managed code, integrated, 32-bit, 1024 MB, no user profile | same |
| Environment secrets | `Jwt__SigningKey` only | `ConnectionStrings__Postgres`, `Jwt__SigningKey` |
| DNS | wildcard `*.global-webnet.com` A 208.98.35.166 already covers `mcp.`; no explicit record needed | explicit A record for `api.` |
| Deploy | `deploy-mcp.yml` uses repo secrets `SMARTERASP_MCP_FTP_USERNAME/PASSWORD`, `SMARTERASP_FTP_SERVER`, deploys to the FTP user's home | `deploy-webapi.yml` equivalent |

Consequence: if the FTP user `billkrat-mcp` is pointed at the new site's folder, **the workflow and its GitHub secrets need no change**; only its first run repopulates the new folder (the publish output includes `web.config`).

## Steps

Panel = SmarterASP control panel, https://member10-1.smarterasp.net/panel_cp (you). "Me" = Claude.

**0. Before anything (you):** make sure you have the production `Jwt__SigningKey` value (the panel masks it). If you do not, the fix is to set a new value on both the API site and the new mcp site, which logs everyone out once. Tell me which.

**1. Rename the old site (you, Websites, mcp card, "...", Site Name):** rename `mcp` to `mcp-old`, so the new subsite can take the name `mcp`. Harmless; nothing else changes. *Confirm to me when done.*

**2. Free the hostname (you, Websites, `mcp-old`, "...", Domain Manager):** Delete the mapping `mcp.global-webnet.com`. From this moment mcp is down (the API health probe already reports it unreachable, and the exception log shows it once an hour). *Confirm to me when done.*

**3. Create the subsite (you, Websites, "+ Sub Domain"):** Subdomain Name `mcp`; Domain `global-webnet.com`; Target Folder: "(create new folder)" (the panel names it; tell me the folder name); leave "Disable PHP Support" checked; Submit. *Tell me the new site's name and folder.*

**4. Application pool (you, new site, "...", Application Pool):** runtime "No Managed Code", pipeline Integrated, 32-bit enabled, memory 1024 MB (same as api). If you prefer, I can check it afterwards with the read-only pool tool and tell you what differs.

**5. Environment secret (you, new site, "...", Environment variables / secrets):** add `Jwt__SigningKey` with the production value (step 0). Do not paste it to me.

**6. FTP user (you, FTP):** change the home folder of `billkrat-mcp` from `/mcp` to the new folder from step 3 (or create a new scoped user for that folder; then you update the two GitHub secrets `SMARTERASP_MCP_FTP_USERNAME/PASSWORD`). *Confirm to me when done.*

**7. Deploy (me):** run the `Deploy McpServer.WebApi to mcp.global-webnet.com` workflow on `main` (`gh workflow run`). The step "Smoke test deployed health endpoint" will fail until step 8 gives it HTTPS: that is expected; I will instead verify the files with `curl http://mcp.global-webnet.com/` (must answer 200 "mcp ok").

**8. Certificate (me, after step 7 shows 200):** `ssl_request` for the new site and `mcp.global-webnet.com`; check `ssl_get_status`; then `curl https://mcp.global-webnet.com/api/hello` (401 without a token is the success signal) and re-run the workflow so its smoke test goes green. If the certificate is still refused, I stop and we reassess before anything is deleted.

**9. Verify end to end (me):** the API's `/api/health` shows `mcpStatus: ok` and the admin icon stops raising `health probe: mcp`; then the diagnostics tool test from the stage 5 review.

**10. Clean up (you, after 9 is green and you are happy):** delete `mcp-old` (back up first if you want its folder `/mcp`, which holds only a previous publish). Delete the old `/mcp` folder with it or leave it (it is small). Then I update OI-1, the docs, the site id in the notes, and close the issue.

## Rollback

Until step 10 nothing is lost: delete the new subsite, re-add `mcp.global-webnet.com` to `mcp-old` (Domain Manager), point `billkrat-mcp` back at `/mcp`, rename the site back. mcp was already unreachable over HTTPS before this started, so the worst case is the state we have today.

## Risks

- The only data on the mcp site is code and the signing key; there is no database.
- The wildcard DNS record means no DNS change is needed; if the panel adds an explicit `mcp` A record for the subsite, that is fine too.
- The workflow's HTTPS smoke test fails until the certificate exists (step 8); expected, not a deploy fault.
- Site ids change (old `site-1885461`); the diagnostics notes and OI-1 get the new id after step 3.

## Progress log

- 2026-10-19 step 1 done (old site renamed `mcp-old`, `site-1885461`); step 2 done (`mcp.global-webnet.com` removed from it).
- 2026-10-19 step 3 done: new subsite `mcp` = `site-1896089`, `mcp.global-webnet.com` mapped to it (DNS configured, SSL not yet). **Finding:** the panel reused the existing physical folder `h:\root\home\billkrat-001\www\mcp`, the same folder the FTP user `billkrat-mcp` already points at. So step 6 (FTP user) is **not needed** and the already-deployed files are live on the new site (it answers with our app's own error JSON, 500, because steps 4-5 are not done yet). The workflow needs no change at all.
- **Warning for step 10:** `mcp-old` and `mcp` share one folder. When deleting `mcp-old`, do NOT delete its files/folder (untick any "delete files" option), or the new site loses its app. Safer: leave `mcp-old` in place, stopped, and delete it later.
- New site differences found by the read-only tools: app pool runtime `aspnet-4` (api uses `no-managed-code`) and no environment secrets (`Jwt__SigningKey` missing). Those are steps 4 and 5.
- 2026-10-19 steps 4-5 done by the human with a variation: instead of changing the new site's pool runtime, the new site `mcp` was assigned to the pool already used by `mcp-old` (`billkrat-001835`), so the pool settings and the `Jwt__SigningKey` secret are shared. Verified read-only: new site pool `no-managed-code`/integrated/32-bit/1024 MB, secret name `Jwt__SigningKey` present, and `http://mcp.global-webnet.com/` answers `200 mcp ok` from the new site.
- 2026-10-19 step 8 attempt: `ssl_request` for `site-1896089` / `mcp.global-webnet.com` fails exactly as for the old site (`ssl_request_failed`, retryable), `ssl_get_status` = `not_configured`. The new site's own SSL dialog in the panel also shows only CSR Request / Buy SSL / Import SSL (0 installed, 0 pending). So being a subsite did not by itself unlock the free certificate; the cause is on SmarterASP's side. The api and global-webnet.com certificates (Oct 11) show validation method "-" and were issued without a panel option, i.e. through the same free service the tool calls.
- 2026-10-19 12:04Z: support ticket #3715425 sent (the draft below); a retry of `ssl_request` is scheduled for 08:09 local (session-only).
- Next: retry `ssl_request` in 30-60 minutes (a new site/hostname may need time to be picked up); if it still fails, open a SmarterASP support ticket (draft below). Nothing is deleted: `mcp-old` stays as the rollback.

### Draft support ticket (not sent)

> Free SSL for mcp.global-webnet.com fails. The hostname is mapped to the subsite "mcp" (billkrat-001, plan 10668888) and answers HTTP 200 on port 80 at "/" with no redirect. The API call `ssl_request` returns "ssl_request_failed: the hosting service did not complete the operation" (operation 7de35838-9ca4-4d83-9ec1-9d8412dca6ae earlier, and again today); the panel SSL dialog for this site offers only paid options. api.global-webnet.com and global-webnet.com received free certificates on 2026-10-11. Please issue (or enable) the free certificate for mcp.global-webnet.com, or tell us what is missing.
- 2026-10-19 12:40Z: SmarterASP staff (Darren) replied on ticket 3715425 within 14 minutes: "The Free SSL is deleted status for the subdomain mcp.global-webnet.com, please confirm and request it again." Requested again: still `ssl_request_failed`, `ssl_get_status` still `not_configured`. Replied on the ticket with the facts and asked them to issue and install it from their side, as they did for api on ticket 3713141 (where the reply said they issued it for us). Waiting for staff.
