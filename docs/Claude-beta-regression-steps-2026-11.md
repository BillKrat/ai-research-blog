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
Steps are added here as each of its four stages lands. The target behaviour to regression-test at the end: a fresh install opens and signs in with Admin/Admin on the first host; a second domain shows the setup page and a platform administrator chooses attach (alias) or a new site with its own Admin/Admin; two tenants each have their own Admin; nobody signs in across tenants; an unknown host never creates a site by itself.

## B. Still to build before the DCP (order from `Claude-beta-scope-2026-11.md`, "Working order from 2026-11-22")
the rest of T4 (row 5), then rows 8 to 11 as listed there. Add each stage's steps above (or in a new section) as it lands.

## C. Standing regression areas to include in the final DCP (already live, re-check after the merge)
Sign-in and first-password change; roles and rights per tenant; tenant switcher and host aliases; posts and pages (both editors, publish, slugs, images); public site (home, posts, pages, categories, tags, menu, RSS, old BlogEngine addresses); comments with moderation; collaboration items; plug-ins, Customize, widgets and the four zones; Exceptions and Diagnose; health; the MCP tool list.
