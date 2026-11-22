# Admin parity matrix: BlogEngine.NET 3.3.6 vs this app (2026-11-22)

Beta row 12. Source: `Claude-review-2026-10-blogengine-admin-pages-posts.md` (the live admin read 2026-10-20) and our menu in `AdminMenuController.cs`. **Fresh read done 2026-11-22:** the human signed in on `www.adventuresontheedge.net/admin` in the browser pane and I opened every menu page read-only (nothing saved; user e-mail addresses seen on the Users page are not recorded here). Findings are in "Live read, field by field" below; where the table says "to check" the read settled it in that section. There is no About entry in the live menu.

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
| **About** (version and provider) | Dashboard health pill and version are partial | Excluded | Not in the live menu (2026-11-22 read); our health pill and tenant card cover it |

## Live read, field by field (2026-11-22)

- **Dashboard:** Stats (published and draft posts and pages, approved, unapproved and spam comments, each a link to the filtered list), Latest comments, Quick draft (with Save), Draft posts, Draft pages, Need help links. Ours lacks Quick draft, Latest comments and the clickable stats.
- **Posts list:** columns Title, Author, Date, Published; New, filter All, paging; no bulk-action buttons were visible without selecting rows (to confirm by selecting one).
- **Comments list:** columns Title, Date, Approved, Spam; filter All. The spam state exists but the live site has 0 comments.
- **Themes:** a list of installed themes with Active marks and New. After beta.
- **Profile:** Display name, User id, Title, First, Middle, Last name, E-mail, Address (two lines, city, state, zip, country), Birthday, three phone numbers, Company, Organization, About me, Spouse, Website, Tags, Custom fields, Change picture, Change password. Ours holds a smaller set; beta needs Display name, E-mail, About me, Website and the picture, the rest is after beta.
- **Users list:** Title, Roles, E-mail, New.
- **Settings > Basic:** Blog title, Description, Posts per page, Add date to post links, Only show description of posts, Blog language (about 40), Timezone. Ours has title, tagline and posts per page: **gap** Add date to links, description-only lists, language and timezone.
- **Settings > E-mail:** E-mail address, Username, Password, SMTP server, Port, Subject prefix, Enable SSL, Send comment e-mail, Test mail settings. **Gap**: password goes through the encrypted field kind.
- **Settings > Feed:** Author, E-mail, Endorsement link, Alternate and Help feed URLs, Language code, Default output (RSS 2.0 or Atom 1.0), Items shown, Enable enclosures, Enable tag export. Ours has a fixed RSS feed: **gap** is Items shown, author and full text versus description only; Atom after beta.
- **Settings > Comments:** Provider (BlogEngine, Disqus, Facebook), Enable comments, Moderate comments, Trust authenticated authors, Enable nested comments, Show live preview, Enable website in comments, Close comments after N days (never to 365). Ours has Enable comments only: **gap** Moderate (ours always moderates, so make it a setting), Trust authenticated authors, Close after N days. Disqus, Facebook, nested comments and live preview are after beta.
- **Settings > Controls:** Contact form messages and attachments, Recaptcha, Error page title and text, and **Custom code for the HTML head and Tracking Script**. Gap-beta: the tracking and head script (sanitised, administrator only). The contact form is excluded with Contacts.
- **Settings > Advanced:** www subdomain policy, HTTP compression, OpenSearch, post navigation links, password resets, trackbacks and pingbacks, remote file downloads; Tools: BlogML import and export, clear cache. Ours handles www in the host, compression in IIS; beta gap is only **Export** (a backup of content) and **Clear cache**; BlogML import is the migration path, after beta. Trackbacks and pingbacks are not in beta.

## Ours, no BlogEngine twin (stay)

Collaboration, Decisions (plug-ins), Exceptions (with signatures and Diagnose), Tenants, and the Dashboard health pill.

## Proposed new rows and reordering

The matrix adds these small stages to the working order, after the colour mode (row 14) and before search:

1. **Settings > Basic, Feed and Comments fields** (one stage: Add date to links, description-only lists, language, timezone, feed items and full text, moderate and trust authenticated authors, close after N days).
2. **Mail settings screen** with test-send (already a beta item; the matrix confirms it is needed for parity).
3. **Dashboard: Quick draft, Latest comments, stats as links.**
4. **Head and tracking script setting** (Controls), **Export and Clear cache** (Advanced tools).
5. **Profile fields** (display name, about me, website, picture).

Nothing here moves rows 13 (icons and language files), 6 (search) or 7 (Prompt Claude) ahead of row 14; the matrix does not change the working order above, it adds the five stages after row 14.

## Questions for the human

1. (Answered by the 2026-11-22 live read; the "to check" cells are settled in the field-by-field section. Bulk actions on lists were not visible without selecting rows, so question 3 stays.)
2. Is self-registration wanted at beta (ours is invitation only; the tenant ideas file screening for the private repo)?
3. Are bulk actions on lists (publish, unpublish, delete) wanted at beta?
