# Stage review: beta security pass 1 (2026-11-24)

The beta audience is a blog administrator or user, so dependencies and rights come before polish. Three findings, two fixed, one handed to you.

## 1. mermaid 12.3 (done) and tinymce 8 (held: a licence decision)

- `npm audit` showed three findings: `katex` and `mermaid` (low) and `tinymce` (high, five XSS advisories in the editor's own sanitising).
- **mermaid** moved to 12.3 (MIT). The katex advisories are gone. The client builds (main chunk 379 kB) and the 155 client tests pass. I have **not** looked at a diagram in a browser: add one to your regression pass.
- **tinymce 8 is not a bump.** Version 6.8.6, the one we use, is MIT. Version 8.x is licensed "see license.md" (a GPL-2.0-or-later or commercial licence). Adopting it changes the licence of what we ship to people, next to BUSL-1.1 and the later AGPL, so it is a decision for you (and the attorney when one is engaged), not something I do on my own.
- **What protects us today.** The editor is only used by signed-in people who can write posts; the HTML it produces is sanitised on the server on save and again on serve by the default-on sanitiser plug-in (`IHtmlContentSanitizer`), so the advisories need the editor's client-side sanitising to fail *and* the server sanitiser to be switched off or bypassed. The plug-in page warns when the sanitiser is off.
- **Options for you:** (a) stay on 6.8.6 and document the compensating control (my recommendation until beta, cheapest, no licence change); (b) replace TinyMCE with TipTap (already in the app for Markdown, MIT), which is a larger editor change with a browser check; (c) accept the TinyMCE 8 licence. I recommend (a) now and (b) as a post-beta item if the advisories keep coming.

## 2. Dashboard leaked to anyone with admin access (fixed)

While writing the beta tester role check I found that the dashboard needed only `admin.access`. A person with that right and nothing else would see draft post and page titles, the exception count and the latest reader comments (author, post, excerpt). `DashboardSummary.Restrict` now zeroes each figure and empties each list unless the person holds the right to see what it counts (posts, pages, diagnostics, collaboration, comment moderation). Tests first (`DashboardRightsTests`).

## 3. Lookups open to anyone with admin access (fixed)

`GET /api/lookups` (the choices for pointer fields: role, tenant and organization names) needed only `admin.access`. It now needs one of the rights to manage or read what those forms edit (users, roles, posts, pages, taxonomy, settings, plug-ins). Tests first (`LookupsRightsTests`).

## Beta tester role check (done)

There is no shipped "Beta tester" role to seed: roles are data per tenant, created on Admin > Roles. The recipe (exactly `admin.access`, `collaboration.read`, `collaboration.write`) is pinned in `RoleRouteMatrixTests`: it reaches the collaboration screens and nothing else, cannot approve or decide (no `collaboration.review`, no `decisions.read`) and cannot read posts. The two findings above were what that check turned up. The manual steps are ledger item A20.

## Verified

Foundation full suite (new: dashboard rights 3, lookups rights 7), app API 68, host 51 pass. Not verified in a browser: the mermaid diagrams and the tester's menu and dashboard. Not deployed.

## Accessibility scan, first result (axe-core 4.10.2 in the local browser pane, with the human's permission)

Built client served by the API in memory mode on localhost, a pinned axe-core copy served from the same origin (nothing loaded from the internet, the page CSP unchanged). **Public posts page and sign-in page, dark colour mode: 0 violations** (32 and 37 checks passed, contrast included). **Not scanned:** the admin screens: the build's client points at the configured API address, not the local one, so I did not sign in (it would have sent a password to the wrong host). Next: scan the admin screens with the client proxied to the local API (`ng serve` with `BACKEND_URL`), and add axe to the screens you test by hand. The static template scan (no image without alt, no icon button without a label, no clickable div) is also clean.

## Order for the rest of the beta list (recommended)

1. Your decision on TinyMCE (above), no code until then.
2. Release notes (small, text), then accessibility pass (medium: labels, focus, contrast, the icon buttons' text alternatives), both before testers arrive.
3. The pristine store question (row 11: accounts on the live site after a data clean, or a fresh install): needs your answer.
4. Your DCP prioritisation, then the comprehensive regression DCP from the ledger.
