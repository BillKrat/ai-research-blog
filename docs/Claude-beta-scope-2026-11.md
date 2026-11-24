# Beta scope map and working order (2026-11-21)

Written at the human's request: he follows my recommendations and asked me to separate what must be in beta from what waits for the downstream project (several blogs under a domain, subscriptions to them). Source: `Claude-backlog.md`, `Claude-open-issues.md`, the human's chat decisions of 2026-11-20 and 2026-11-21. This file is current state; when an item moves, edit its row. Reasoning for any single item stays in the backlog entry it names.

**Rule used.** BETA = one blog per install (several domains may point at it), a person can sign in, write, review and extend the app through plug-ins, and nothing is lost or exposed. AFTER BETA = needs several blogs, subscriptions, money or scale that beta does not have, and is carried into the downstream project, where this project is only supported. The human's lock: finishing the MEF widgets and plug-ins and the two tool layers completes the beta feature set; the quad-storage change and the schema site come last.

## BETA (in this order)

| # | Item | Why it is beta | Size | Backlog entry |
|---|---|---|---|---|
| 1 | **Plug-in framework: MEF cleanup (discovery, report, sanitiser seam, the Customize screen, the event bus, the developer sample and widgets with zones built 2026-11-21; next encrypted fields).** Discovery from projects and a plug-in DLL directory, load failures reported; every plug-in has a Customize screen; HTML sanitising as a default-on plug-in | The human's lock for the beta feature set; the seam every later item uses | large, 3 to 4 stages | Features: Widgets and plug-ins through MEF, items 00, 0, 6, 7 |
| 1b | **An in-process event bus for plug-ins (BUILT 2026-11-21, on a branch)** (notifications and interceptors, isolated handlers, per tenant; the Slack-on-exception plug-in is the example use) | The BlogEngine-style way to extend the app without touching core code; the sample and widgets use it | medium | Widgets and plug-ins, item 9 |
| 2 | **Developer sample (BUILT 2026-11-21, on a branch; the widget part waits for row 3):** a widget and a tool in a separate project and from a DLL in the plug-in directory, proving the seam from outside (tool plan stage 4) | The proof that a developer can extend the app without us | small after 1 | Tool plan in `Claude-mcp-tool-inventory-2026-11.md` |
| 3 | **Widgets and four zones (BUILT 2026-11-21 on a branch: contract, renderer, placements, built-ins, public zones, Widgets screen; drag and drop, Angular widgets and the reviewed upload library remain)**, the phone layout, the reviewed upload library (tag cloud is widget one) | The visible half of the lock | large | Widgets and plug-ins, items 1 to 5 |
| 4 | **Encrypted field values (built 2026-11-21 for plug-in settings, awaiting merge; production key is a human step)** | A bring-your-own AI key and any credential held as data need it; security first | medium | Features: Encrypted field values |
| 5 | **T4 (T4a built 2026-11-21: CORS from registered sites): new tenant on a domain, several domains, a working default before any domain exists, per-tenant sharing settings** | Install once, point several domains at it; wanted before beta by the human | large | Next up: One app, several domains; Per-tenant data sharing |
| 6 | **Basic search of the blog's own content (Layer 1)** | A reader of a blog expects search; the AI-assisted search is not beta | medium | Tool inventory, question 3 |
| 7 | **Prompt Claude through MCP** (the diagnostics tool by exception id) | Small, makes the review loop cheaper; check the `headersHelper` first | small | Next up: Prompt Claude through MCP |
| 8 | **Beta readiness list:** install guide proved on a spare domain, Beta testers role check, backup and restore note, release notes, accessibility pass, dependency and security review including the open advisories (tinymce 8 and mermaid 12.3 need the human's browser check) | A stranger can install and trust it | medium | Beta and release readiness; Install guide |
| 9 | **Quad storage at scale** (measure per-user quads, own benchmark generator, spike, layout change, the cheap index wins) | Must be done before beta data exists, after the features above | large | `Claude-backlog-quad-storage.md` |
| 10 | **Schema site `schema.global-webnet.com`** (navigated hierarchy of the data) and its certificate | Beta-critical, the last item (human, 2026-11-21); certificate installed and verified live 2026-11-21 (SSL.com, valid to 2027-06-07; renew by 2027-06) | medium | Quad-storage backlog, section 8 |
| 11 | **Pristine beta store and data freeze** (clean database from seeds only, benchmark databases separate, rehearsed cutover) | Beta data must be clean before anyone uses it | medium | Quad-storage backlog, section 8 |
| 12 | **Admin menu parity with BlogEngine.NET (human, 2026-11-21): the BlogEngine admin menu groups and their children define what "done" means for beta.** First step is a parity matrix (each BlogEngine group and child: built here, gap that is beta, after beta, or excluded; Blogs and Contacts are the known exclusions), made from the 2026-10-20 admin review and a fresh read of the live admin in the human's browser (read-only); the matrix then reorders this table | It is the human's definition of done; every other row is checked against it | small (the matrix), then one row per gap | New: Backlog, Features, "Admin parity" |
| 13 | **Icons on every button, with localized hover text (human, 2026-11-21)** (the label seam `i18n/labels.ts` exists; audit every button and menu entry, move all text behind label keys, serve the label table as data per language, let an administrator pick the site language, and a Claude MCP configuration option so a user can have Claude produce and apply their language file for review) | Consistent, learnable admin; the seam must be real before more screens are added | medium to large, 3 stages | New: Backlog, Features, "Icons and language files" |
| 14 | **Site colour mode in Settings (human, 2026-11-21): a Dark or Light dropdown the administrator sets for the site** (the visitor's own toggle stays and wins once used) | The minimum the human wants for a site's look until themes exist | small | New: Backlog, Features, "Site colour mode" |

**Working order from 2026-11-22 (full days 2026-11-22 and 2026-11-23):** (1) row 12, the parity matrix, first because it may reorder the rest; (2) row 14, the colour mode (small, visible); (3) row 13, icons and language files in stages; (4) row 6, basic search; (5) row 7, Prompt Claude through MCP; (6) row 5, the rest of T4 (the automatic alias at first run, a new tenant on its own domain, a working default before any domain, per-tenant sharing settings; the stage-4a CORS and Admin > Tenants with delete are built and live); (7) then rows 8 to 11 as before, plus any gaps the matrix finds. Built and live as of 2026-11-21 night: rows 1 to 4 (plug-ins, event bus, sample, widgets, encrypted fields for plug-in settings) and the first part of row 5.

## AFTER BETA (stay in the backlog until the downstream project)

| Item | Why it waits |
|---|---|
| A stricter right per plug-in switch (the sanitiser first) and switches per blog instead of per domain | Needs several blogs per domain; backlog MEF entry item 8 |
| Several blogs under a domain, sub-folders per blog, subscriptions to blogs, subscribed-blog search scope | The downstream project's founding feature; the beta keeps its tenant keys compatible (the design rule in the MEF entry, item 7) |
| Subscriptions, usage meter, plans, who pays for AI beyond a bring-your-own key | Needs money and several blogs; the seams stay in every stage |
| AI-assisted search and upload processing (Layer 2) | Costs per call; needs the usage seams |
| Mail screen and notifications | Per-blog SMTP through the encrypted field; needs several blog owners to matter |
| Themes and templates (human, 2026-11-21: not matched for beta) | Added after the downstream private project is stood up; the theme support is built into the shared libraries (`Adventures.*` and the Angular libraries), so this app uses it from there. Until then row 14 (the colour mode) is the whole of it |
| A migration from an existing BlogEngine.NET install to this app (human, 2026-11-21, optional) | Not a priority; do it only if it falls out of the legacy-mode and import work already done (the BlogAI mirror and import tooling), as a documented path rather than a feature |
| Localization beyond the label seam (translated language files themselves) | Row 13 builds the mechanism and the Claude configuration option; the translations are the users' |
| Performance thresholds and alerts | The benchmarks (item 9) come first and will say what to alert on |
| Editing your own conversation entry, the "read by Claude" marker | Small comforts, no beta risk |
| Richer typed controls, richer editor and media, admin shell port leftovers | Polish |
| Public site: caching of published content, draft preview by author | Optimisation after real traffic |

## Standing items outside the order

- `schema.global-webnet.com` certificate is installed (valid to 2027-06-07); renew it by 2027-06 (paid, not part of the free quota).
- `backup --mirror` push stays skipped (it prunes old branches that the `_archive/` bundles hold).
- Human-only: Anthropic key expiry date is 2027-02-01; the tinymce 8 browser check (item 8); any legal steps in memory.

## How I will work

One session branch, one verified stage per commit with a stage review, a collaboration item only when the human needs to test something, merge and deploy on his word. I take the next item of the "Working order from 2026-11-22" paragraph unless he redirects.
