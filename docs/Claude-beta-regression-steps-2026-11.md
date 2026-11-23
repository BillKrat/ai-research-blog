# Beta regression test ledger (running, 2026-11-22 on)

The human's request (2026-11-22): keep coding through the beta phase without losing the test steps, then turn them into one comprehensive Developer collaboration item (DCP) for a regression pass. This file is the ledger: each stage adds its steps here when it lands, with the stage review it comes from. At the end of the beta coding it becomes the DCP (run line, ordered steps, expected results, after-approval steps) from `Claude-review-post-template.md`.

Legend: **S** = steps, **E** = expected result. Nothing below has been seen in a browser yet; every item is unverified by a person.

## A. Built on `claude-session-2026-12-11` (2026-11-22)

### A1. Site colour mode (row 14), review `artifacts/Claude-2026-11-22-site-colour-mode.md`
- S: Admin > Settings, set `ColorMode` to `light`, save. Open the public site in a private window. E: light.
- S: Use the header toggle to go dark, reload. E: stays dark even if the setting changes (the visitor's choice wins).
- S: Set `ColorMode` back to `dark`; clear site data; reload. E: dark. First visit to a light site may flash dark once (known).

### A2. Icons and keyed button text (row 13 stage 1), review `artifacts/Claude-2026-11-22-icons-and-label-keys.md`
- S: Walk every admin screen (Dashboard, Posts, Pages, Categories, Tags, Comments, Collaboration, Decisions, Users, Roles, Exceptions, Settings, Plugins, Widgets, Languages, Tenants) and the public site. E: every button has an icon, hover shows its text, no clipped or overlapping icon and text.
- S: Public site pager and comment form. E: Newer/Older with arrows; the send button shows an icon.

### A3. Language files (row 13 stages 2, 2b, 3), review `artifacts/Claude-2026-11-22-language-files.md`
- S: Admin > Languages > Load the English texts, code `en`, Save. E: listed with its count; hint says Claude now sees every key.
- S: Load the English texts, code `de`, change a few (e.g. `save`: Speichern, `menu.posts`: Beitraege), Save. Settings > `Language` = `de`, save, reload. E: those buttons and tooltips are German, the Posts menu entry reads the German text after sign-in or reload, everything else stays English.
- S: Set `Language` back to `en`; remove `de`. E: all English; Languages list empty of `de`.
- S: Save a file with a bad code (`x`), an empty text, a 301-character text, invalid JSON. E: each refused with a clear message; nothing stored.
- S (needs MCP, after deploy): with `claude-author`, `get_language_catalog` then `propose_language_file` for `fr`. E: Admin > Languages shows "Proposed by Claude"; Review opens it; Save makes it live; Discard drops it; the site never changes before you save.

### A4. Settings that change behaviour (row 12 parity stage 1), review `artifacts/Claude-2026-11-22-parity-settings-stage-1.md`
- S: `CommentsCloseAfterDays` = 30. E: a comment on a post older than 30 days is refused with the limit message; a newer post still takes comments; 0 means never.
- S: `FeedItems` = 5, open `/api/public/feed`. E: five items; 0 or text falls back to 20.
- S: `CommentsModerate` = `false`, post a comment. E: it shows at once, the page says it was published, no approval hint under the form; set back to `true`: comments wait again. A typo value (e.g. `no`) must keep moderation on.

### A5. Dashboard Quick draft and Latest comments (row 12 parity stage 3), review `artifacts/Claude-2026-11-22-dashboard-quick-draft-and-latest-comments.md`
- S: Dashboard > Quick draft: title and text, Save. E: link to the draft, Draft posts count grows, the draft is not published and is yours. Empty title: refused. As a person without the write-a-post right: refused with a permission message.
- S: Post a visitor comment. E: shown under Latest comments with author, post, state and excerpt, no e-mail address.

### A6. E-mail settings and test-send (row 12 parity stage 2), review `artifacts/Claude-2026-11-22-mail-settings-and-test-send.md`
- S: Admin > System > E-mail: sender, server, port 587, user, password, Use SSL on, Save; reopen. E: password blank with "A value is set"; nothing shows the password anywhere.
- S: Test box with your own address, Send. E: a message arrives with the subject prefix; with a wrong password: a plain failure message, no password.
- S: Save with port 22, a server like `mail.x.org:25` or `http://mail.x.org`, a sender with two addresses. E: each refused with a reason.
- S: A server name that resolves to a private address (e.g. localhost), test. E: refused (unless `Mail:AllowPrivateHosts` is true).
- S: "Tell me about new comments" on, post a visitor comment. E: a note arrives at the sender address; with the server wrong the comment is still accepted at once.
- Needs: the production encryption key set (human step) or saving the password is refused.

### A7. Tracking script, content export and clear cache (row 12 parity stage 4), review `artifacts/Claude-2026-11-22-tracking-script-export-and-cache.md`
- S: Set the `TrackingScriptUrl` setting to an https address with NO operator list configured, reload a public page. E: no script tag (feature off until the operator allows a host).
- S: Set `Site__AllowedScriptHosts__0` to that host, restart, reload a public page. E: exactly one async script tag; none under /admin; an http address, a look-alike host or `javascript:` adds nothing; clearing the setting removes the tag.
- S: Admin > System > Maintenance > Download a backup. E: a JSON file with posts, pages and drafts; no user names, ids of users or passwords; proposed revisions absent.
- S: Clear the cache. E: confirmation; the site keeps working; a just-changed host name is seen at once.

### A8. Profile fields (row 12 parity stage 5), review `artifacts/Claude-2026-11-22-profile-fields.md`
- S: Open Profile. E: About me, Website and Picture address are on the form (seed 027 applies on the first start). Fill valid values (`https://example.org`, `/media/<uploaded image>`), Save, reload. E: kept.
- S: Website `javascript:alert(1)`, `example.org`, or with a space; Picture `data:image/png;base64,AAAA` or `//evil.example/x.png`; About me over 1000 characters. E: each refused with a message on that field, nothing saved.
- S: Leave all three empty and save. E: fine (all optional); existing users and sign-in are unaffected.

### A9. Basic search (row 6), review `artifacts/Claude-2026-11-22-basic-search.md`
- S: Header search icon opens /search. Search a word in a post title, one only in a post's text, one only in a tag. E: each post is found; the title hit ranks first; each hit links to the post or page.
- S: Two words. E: only items with both. A word that is only in a draft or an unpublished page. E: not found.
- S: One letter; a 101-character query; `.*`; `<script>`. E: a message for the first two; no results and no error for the others; nothing shown as markup.
- S: A search with more than 10 results; Next, Previous, reload on page 2. E: paging works and the address keeps the search.
- S: More than 20 searches in a minute. E: a "searching too fast" message, then it works again.

### A10. Prompt Claude through MCP (row 7), review `artifacts/Claude-2026-11-22-prompt-claude-through-mcp.md`
- Needs: the API and MCP servers deployed (new tool `get_exception`), and a new Claude Code session in the workspace (the `adventures-diagnostics` server in `.mcp.json` is read at start; approve it when asked).
- S: In a new Claude Code session run `/mcp`. E: `adventures-diagnostics` is connected (the headers helper ran; no password prompt). If it does not connect, the `headersHelper` field is the first suspect.
- S: Admin > Exceptions, click Prompt Claude on a row, read the text, paste it into that session. E: Claude calls `get_exception` with the row's entry id, then `diagnose_request` with the correlation id when there is one, and reports the cause; a row with no correlation id is traced through `exception_signatures` and `recent_exceptions`.
- S: Look at the prompt text. E: it names the ids and the message, no stack trace, no secret; the vault script command is still there as a fallback.
- S: Without the `mcp.diagnostics.read` scope (an anonymous call to `/api/diagnostics/exception/<id>`). E: 401.

### A11. T4b: create a tenant and the first-run alias (row 5), review `artifacts/Claude-2026-11-22-t4b-new-tenant-and-first-run.md`
- S: Admin > Tenants > New tenant: a name and a domain such as `photos.example.org`, Create. E: a confirmation; the tenant is listed with its domain; the Tenants switcher offers it; its Posts list is empty; a Settings open creates its default settings.
- S: Create with the domain of an existing tenant, one of its aliases, a name under one, `localhost`, `127.0.0.1`, a name with no dot, or an empty name. E: each refused with a reason, nothing created.
- S (first run, needs a second host name that reaches the API site, for example a temporary address): set `Tenancy__AutoAliasToTenantDomain` to a tenant's domain in the host panel, restart, open the API on that unknown host. E: the host appears as an alias of that tenant (Tenants screen), the request works, and its preflight from the site on that address is answered; clear the setting afterwards.
- S: With the setting empty (the default), open the API on an unknown host. E: refused (404) exactly as before. A bare IP or `localhost` host with the setting on: still refused.
- Not built, so not tested: reusing another domain's data (backlog).

### A12. Seamless install and multi-site onboarding, DECIDED 2026-11-22, not built yet (`Claude-decision-2026-11-tenant-onboarding.md`)
Steps are added here as each of its four stages lands.

**Stage 1 (built, user names per tenant), review `artifacts/Claude-2026-11-22-onboarding-stage-1-per-tenant-user-names.md`:**
- S: In tenant A, Admin > Users, add a person named `owner2`, set a first password. In tenant B (its own domain, Admin > Users as a platform administrator acting in B, or on B's own host), add a person also named `owner2`, set a different first password. E: both are created; the Users list of each tenant shows only its own `owner2`; adding a second `owner2` in the same tenant is refused.
- S: Sign in at A's address as `owner2` with A's password, then at B's address with B's password. E: each lands in its own tenant, sees only its own content and people, and A's password does not work at B.
- S: A's `owner2` opens Profile. E: A's profile (name, email), not B's. Give each a role in its own tenant only: the rights match that tenant's role.
- S: A platform administrator switches to act in B. E: still looked up as themselves (platform right kept), not as B's person.
- S: An existing single person such as Admin or Claude signs in. E: nothing changes.

**Stage 2 (built, the empty-store first site), review `artifacts/Claude-2026-11-22-onboarding-stage-2-first-site.md`. The first step is the real proof, it has only been tested with fakes:**
- S: Create a scratch Postgres database (never the shared dev or the live one), point `ConnectionStrings:Postgres` at it, set `Seed:Profile=install` (or run non-Development), start the API, and call `GET /api/public/site` on a host name that reaches it (for example a hosts-file name with a dot). E: the sign-in tables exist; the log says the host is now the first site; a tenant exists with that domain; the Admin screen shows it.
- S: Open the site on that host and sign in as `Admin` with `Admin`. E: you are sent to change the password; the new password works; the old `Admin` no longer does; you are the platform administrator (Tenants screen visible).
- S: Request the API on `api.<that domain>` and `www.<that domain>`. E: the same tenant (the site domain has no prefix).
- S: With the store now holding a tenant, call the API on a second, different host. E: still refused (404), no second site is created.
- S: Start the app against our normal databases (dev or live) with the new build. E: nothing changes (the baseline is already applied), no tenant or person is created, no password changes.
- S: Delete nothing, restart the fresh install twice. E: no second Admin, no password reset. The target behaviour to regression-test at the end: a fresh install opens and signs in with Admin/Admin on the first host; a second domain shows the setup page and a platform administrator chooses attach (alias) or a new site with its own Admin/Admin; two tenants each have their own Admin; nobody signs in across tenants; an unknown host never creates a site by itself.

### A13. Single-site mode, the API serves the client, review `artifacts/Claude-2026-11-22-single-site-mode.md`
- S: Create a second SmarterASP site (a spare temporary address, for example the next `billkrat-001-siteN.dtempurl.com`) with its own database, set the repository variable `DEPLOY_MODE=single` and the API FTP secrets for that one site, run `deploy-single.yml`. E: the run is green, including its smoke test of `/api/health` and the page; the split workflows are skipped. (First ever run of this workflow: expect to fix small things.)
- S: Open the temporary address. E: the client page loads over that one address; no `api.` host is involved; on a fresh database the first request makes the first site (onboarding stage 2) and `Admin/Admin` signs in and demands a new password.
- S: Open a deep link (`/login`, `/admin/posts`) directly, and reload on it. E: the page loads (no 404). Open `/api/nope`. E: not the page.
- S: Open the browser console on the site. E: no Content-Security-Policy violations; the fonts and icons render.
- S: View the page's response headers. E: `Content-Security-Policy` starts `default-src 'self'` and lists one `sha256-` inline-script hash; an `/api/...` response still has `default-src 'none'`.
- S: With `Hosting:ServeClient=false` on the site, open `/`. E: the JSON banner, as before.
- S: Our own live layout (www and api., `DEPLOY_MODE` unset). E: nothing changes; the two split workflows run as before.

### A14. Onboarding stage 3, setup page for an unattached address, review `artifacts/Claude-2026-11-22-onboarding-stage-3-setup-page.md`
- S: With a site already set up, open the app on an address that is bound to the same site in IIS or the panel but is NOT a registered alias (for example a second temporary address). E: the client loads and sends you to `/setup`; it names no site before you sign in.
- S: On `/setup` sign in with the site's domain, a platform administrator's user name and the wrong password. E: a plain refusal, the same for a wrong site or a person who is not a platform administrator. Try ten quick attempts. E: rate limited.
- S: Sign in with a site's default Admin that has never changed its password. E: it tells you to change the password on that site first.
- S: Sign in correctly. E: you can choose a site and Attach. Attach. E: "Done"; open the site: the address shows that site and signs in with that site's accounts. The Tenants screen lists the address as an alias.
- S: On another unattached address choose Start a new site and give a name. E: a separate site with its own Admin/Admin (change forced at the first sign-in); the platform administrator who set it up is not an administrator of it; the Tenants screen lists it.
- S: With a setup token (browser tools or a script), call `/api/posts` or `/api/tenant/hosts`. E: 403. Call `/api/setup/sites` after the address has been attached. E: 404.
- S: Open `/setup` on an address that already reaches a site. E: "This address needs no setup".

### A15. Onboarding stage 4, the install guide and the listing text (documents only)
- S: Read `Claude-install-guide-smarterasp.md` from the top as someone who has never seen the project: the two install paths, the first sign-in section (fresh install, a second address and the setup page), the one-site section, the listing text at the end. E: every step matches what A12, A13 and A14 do; tell me anything that is wrong or unclear. The listing text is a draft and has not been sent to SmarterASP.

### A16. Install proof run, one site on a real second host (2026-11-22; steps 1 to 4 below are done by Claude, 5 onward by the human)
- Done and verified by Claude: the one-site build uploaded by FTP, the app starts, the first request created the first site (default site settings answer), the client and deep links load with the page policy, anonymous admin routes answer 401, an unknown path is not the page.
- Found and fixed on the real store: the first site's Admin person had no Id (`Id is required`), invisible to the fake-based tests; a first-run step that fails is now logged and never a 500.
- S: Open the site's temporary address and go to /login. Sign in as `Admin` with the default password. E: you are held on the profile page until you choose a new password; after that the Dashboard and the admin menu load.
- S: Open Admin > Tenants. E: one tenant named for the temporary host, the platform switch is on for Admin.
- S: Open Admin > Users. E: only Admin. Create a second administrator before changing anything else.
- Then: api site (split layout) and mcp site, as in the install guide.

### A17. E-mail address verification (password recovery step 2), review `artifacts/Claude-2026-11-23-email-verification.md`
- Needs the E-mail settings working first (A6): server, port 587, a mailbox, Save, then the test message arrives.
- S: Profile with no e-mail saved. E: "Save an e-mail address above first".
- S: Save an address you can read, reload Profile, press the verification mail button. E: "The mail is on its way"; a mail arrives with a link to `/verify-email?user=...&token=...` on the site you used.
- S: Open the link. E: "Your e-mail address is confirmed"; Profile now shows the address as confirmed. Open the same link again. E: the plain "not valid any more" page.
- S: Change the saved address and Save. E: Profile shows it as not confirmed again.
- S: Press the button four times within an hour. E: the fourth is refused with "Too many verification mails".
- S: Open a link with a changed character in the token. E: the same plain failure page, no reason given.
- S: With the E-mail plug-in off or no server set, press the button. E: a plain message that mail is not set up (no server details).

### A18. Forgot my password (password recovery step 3), review `artifacts/Claude-2026-11-23-forgot-password.md`
- Needs A6 (mail works) and A17 (an address confirmed on the account).
- S: On the sign-in page press Forgot my password, type the user name, send. E: the same "link is on its way" text for a confirmed address, an unconfirmed one and a name that does not exist; a mail arrives only for the confirmed one (check the others receive nothing).
- S: Type the e-mail address instead of the name. E: the same.
- S: Open the mailed link, choose a password under 12 characters. E: refused with the policy text and the link still works.
- S: Choose a long password and type it twice. E: "Your password is changed"; sign in with it works, the old one fails, no forced change at the next sign-in; a locked-out account can sign in again.
- S: Open the same link again. E: the plain "not valid any more" page. Same for an old link (over an hour) or one with a changed character.
- S: Ask for a link, then change the address on Profile, then open the link. E: not valid any more.
- S: Ask four times in an hour for the same person. E: no fourth mail; the page still answers the same.
- S: Ask from an address that is not a registered host (a stray temporary address). E: refused with a plain message, no mail.

## B. Still to build before the DCP (order from `Claude-beta-scope-2026-11.md`, "Working order from 2026-11-22")
the rest of T4 (row 5), then rows 8 to 11 as listed there. Add each stage's steps above (or in a new section) as it lands.

## C. Standing regression areas to include in the final DCP (already live, re-check after the merge)
Sign-in and first-password change; roles and rights per tenant; tenant switcher and host aliases; posts and pages (both editors, publish, slugs, images); public site (home, posts, pages, categories, tags, menu, RSS, old BlogEngine addresses); comments with moderation; collaboration items; plug-ins, Customize, widgets and the four zones; Exceptions and Diagnose; health; the MCP tool list.
