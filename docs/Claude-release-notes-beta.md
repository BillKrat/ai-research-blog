# Release notes: beta (draft, 2026-11-24)

Draft for the human to edit and publish. No version tag exists and none is created without his word. Written for a blog administrator or user, not a developer; the developer view is in the README and the libraries.

## What you get

- **A blog you run yourself.** Posts and pages (a Word-like editor, or Markdown), categories and tags, images, comments from readers with approval, an RSS feed, a search box, the old BlogEngine post addresses redirected, a dark or light colour mode you choose for the site (visitors can switch for themselves).
- **An admin area that looks after you.** A Dashboard (drafts, what waits for you, quick draft, latest comments), a menu that shows only what your role allows, icons with hover text on every button, language files per site that Claude can propose for you to review, widgets in four zones (a tag cloud and a category list come with it), plug-ins you switch on and off and customise.
- **People and rights.** Roles are bundles of rights that you edit on the Roles screen (Admin, Editor, Reviewer, Developer ship by default). A first sign-in with a default password forces a new one. Forgot-my-password and e-mail address verification work. One install can serve several domains, each its own site.
- **Claude as a collaborator, if you want one.** The MCP server lets Claude read and draft (never publish) and lets you review its work in Admin > Collaboration. Ask Claude about an error from the Exceptions screen. Nothing is sent anywhere until you add your own Anthropic key.
- **Nothing silent.** Every error has a reference you can trace; the Exceptions screen groups them; the health badge on the Dashboard says what is wrong.

## Install and upgrade

- The step-by-step install for SmarterASP.NET (one site, or three sites on temporary addresses) is [Claude-install-guide-smarterasp.md](Claude-install-guide-smarterasp.md). The first address that reaches an empty install becomes the first site, with an `Admin` account that must change its password at once.
- Seeds are applied once and by name, so starting a newer version adds what it needs and never overwrites what you edited. **Take a database backup before you upgrade**; how to back up and restore is in [Claude-backup-and-restore.md](Claude-backup-and-restore.md).
- The store layout is chosen by the `NQuadStore__Layout` setting (`Text`, the original, or `Dictionary`, smaller and faster at scale). Switching an existing store is a one-time, verified copy with a rollback; the runbook is [Claude-cutover-quad-layout.md](Claude-cutover-quad-layout.md). A fresh install can start on `Dictionary`.

## Things to know (limits of this beta)

- **Several blogs per domain, subscriptions, themes and the schema site are not in this beta.** One blog per install; several domains may point at it.
- **The editor is TinyMCE 6.8.6.** Newer TinyMCE versions are under a different licence; the project stays on 6.8.6 for now (human decision, 2026-11-24). Content is cleaned on the server when saved and again when shown; keep the sanitiser plug-in on (the Plugins page warns if you switch it off).
- **Counts in the menu and on the Dashboard may lag by up to five seconds** after you approve something.
- **Not for regulated use.** The software keeps no audit trail and must not be used where one is required (see NOTICE and the licence).
- **Give people the smallest role that works.** For feedback testers, create a role with only `admin.access`, `collaboration.read` and `collaboration.write`: they see the Collaboration screen and nothing else.

## Security notes

- Every admin screen and every route is guarded by a right, not a role name; guard tests fail if a route has none. Anonymous callers get nothing but the public site.
- This release closed two cases where `admin.access` alone showed information (draft titles and reader comments on the Dashboard; role, tenant and organization names in the form choices).
- Secrets live in the host's secret store, never in the repository. Encrypted settings (such as an AI key) are encrypted at rest and write-only on screen.

## Under the hood (for the curious)

- The host programs are a few lines each now: the shared start-up, store, sign-in, tenancy, plug-in and MCP code lives in the `Adventures.*` libraries (`Adventures.Hosting`, `Adventures.Mcp.WebApi` and others), so a second application reuses them instead of copying.
