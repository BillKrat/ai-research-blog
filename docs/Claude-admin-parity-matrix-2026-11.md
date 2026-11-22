# Admin parity matrix: BlogEngine.NET 3.3.6 vs this app (2026-11-22)

Beta row 12. Source: `Claude-review-2026-10-blogengine-admin-pages-posts.md` (the live admin read 2026-10-20) and our menu in `AdminMenuController.cs`. **Not yet done: the fresh read-only look at the live admin.** The pane was signed out on 2026-11-22 and I never enter passwords; the human signs in on `www.adventuresontheedge.net/admin` in the browser pane and says so, then I check this table against it. Sub-pages the 2026-10-20 review did not open are marked "to check".

Status words: **Built** (equivalent exists), **Partial** (exists, fields or actions missing), **Gap-beta** (needed for beta, one small stage each), **After beta**, **Excluded** (human's decision), **Ours** (no BlogEngine twin).

## Menu groups

| BlogEngine group / child | Ours | Status | Note |
|---|---|---|---|
| **Dashboard** (stats, quick draft, draft list, latest comments, help links) | Dashboard (counts, waiting items, drafts, tenant panel, health) | Partial | Gap-beta (small): Quick draft box and Latest comments list; to check against the live read |
| **Content > Posts** | Posts (list, TinyMCE or Markdown editor, publish, slug, categories, tags, comments switch) | Built | BlogEngine list has bulk select actions (publish, unpublish, delete): to check whether ours has bulk |
| **Content > Comments** | Comments (approve, moderation, badge) | Partial | Not built: spam state, reply, edit, bulk actions (backlog says no spam scoring or pingbacks in beta); Gap-beta only for spam and bulk if the live read shows them in use |
| **Content > Pages** | Pages (tree, parent, sort order, front page, show in list) | Built | Custom fields and Keywords: to check |
| **Content > Categories** | Categories | Built | Category parent/description: to check |
| **Content > Tags** | Tags (tag cloud of pills) | Built | |
| **Content > Blogs** | none | Excluded | Human, 2026-11-19; tenants replace multi-blog |
| **Custom > Themes** | none | After beta | Human: themes come after beta; the Dark/Light setting (row 14) is the beta minimum |
| **Custom > Plugins** | Plugins (switches, Customize, discovery report) | Built | Ours is richer (MEF, settings, events) |
| **Custom > Widgets** | Widgets (four zones, placements, settings) | Built | |
| **Users > Profile** | Profile (edit, change password) | Built | Photo, about text: to check |
| **Users > Roles** | Roles (rights checklist) | Built | |
| **Users > Users** | Users (create, roles, tenant membership, platform switch) | Built | Self-registration initial role (Settings Basic in BlogEngine): Gap-beta only if self-registration is wanted; ours is invitation only |
| **Users > Contacts** | none | Excluded | Human, 2026-11-19 |
| **Settings > Basic** | Settings (site title, tagline, posts per page, comments switch) | Partial | Gap-beta: timezone, date and time format, language, self-registration, contact address: to check against the live read |
| **Settings > E-mail** | none (mail screen is a listed beta item, row in the backlog) | Gap-beta | Mail settings and a test-send; secrets use encrypted fields (built) |
| **Settings > Feed** | RSS feed is built; no Settings screen for it | Gap-beta (small) | Feed title, post count, full text versus summary as settings |
| **Settings > Comments** | Comments switch only | Partial | Gap-beta: moderation default, close comments after N days, per-site rules; to check |
| **Settings > Controls** | none | After beta | Controls were theme widgets; the widget zones replace them |
| **Settings > Advanced** | none | To check | Likely HTTP handlers, compression, tracking code; head/tracking script is the only item likely wanted (Gap-beta, small) |
| **About** (version and provider) | Dashboard health pill and version are partial | Gap-beta (tiny) | Show app version, store mode and tenant in one place |

## Ours, no BlogEngine twin (stay)

Collaboration, Decisions (plug-ins), Exceptions (with signatures and Diagnose), Tenants, and the Dashboard health pill.

## Proposed new rows and reordering

The matrix adds these small stages to the working order, after the colour mode (row 14) and before search:

1. **Settings > Basic and Feed completeness** (one stage: the missing fields, grouped on the Settings screen).
2. **Mail settings screen** with test-send (already a beta item; the matrix confirms it is needed for parity).
3. **Dashboard: Quick draft and Latest comments.**
4. **Comments settings** (moderation default, close after N days) and bulk actions on Posts, Pages and Comments if the live read shows them.
5. **About** panel.

Nothing here moves rows 13 (icons and language files), 6 (search) or 7 (Prompt Claude) ahead of row 14; the matrix does not change the working order above, it adds the five stages after row 14.

## Questions for the human

1. Sign in on the live admin in the browser pane so I can confirm the "to check" cells read-only.
2. Is self-registration wanted at beta (ours is invitation only; the tenant ideas file screening for the private repo)?
3. Are bulk actions on lists (publish, unpublish, delete) wanted at beta?
