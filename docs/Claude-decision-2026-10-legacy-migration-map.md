# Legacy BlogAI to N-Quad: migration map (draft, 2026-10-21)

Status: **proposed, nothing built.** Evidence: the production data read through the `blogai_*` MCP tools on 2026-10-21 (counts, structure, and per-post HTML statistics; no post text copied here). Earlier human decision to respect: *no import of BlogEngine content* (AGENTS.md). This map is design work so that the choice, if the human re-opens it, is made on facts. Companion: [Claude-review-2026-10-blogai-legacy-survey.md](Claude-review-2026-10-blogai-legacy-survey.md).

## What the data says

| Fact | Value | Consequence |
|---|---|---|
| Posts | 30, **19 published**, none soft-deleted; 22 Primary (11 published), 7 BlogAI design (all published), 1 BlogHelp (unpublished) | A small, hand-checkable set |
| Body size | 492 KB of HTML in total; typical post 8 to 16 KB; two design posts are 82 KB and 135 KB | The two big ones are almost entirely one inline `data:image` each (82 KB and 135 KB): extract to files, do not store as text |
| Code | 43 `<pre>` blocks, 215 `<code>` spans; the MCP bridge series is code-heavy | HTML to Markdown must keep fenced code with language hints (the syntax highlighter wrote CSS classes) |
| Images | 34 `<img>`, 24 pointing at this site's own paths; 0 files in the database file store | Images live on disk (`Content/`, `image.axd`): the file-system stage must fetch them |
| Tables / iframes / scripts / Mermaid / wiki double-bracket links | 2 / 0 / 0 / 0 / 0 | Nothing exotic to convert |
| Comments | 0 | No comment migration; design Comments fresh |
| Pages | 8: an "Article" parent with 4 children, Disclaimer, a deleted BP page, "Blog AI Design" as the front page of the BlogAI blog | Maps to the page tree already supported (`parent`) |
| Categories / tags | 9 categories (`General` twice, one per blog), 34 post-tag rows | Merge duplicate names per blog |
| Users | 6 rows, 5 distinct names (one repeated per blog); roles Admin, Administrators, Editors, Viewers, Viewer, Anonymous; 39 distinct rights, all stock BlogEngine | Only the administrators matter; do not port the BlogEngine rights matrix |
| Custom fields | 690 rows: almost all `THEME` (theme option values for 7 themes: social account links, logo, colours), plus 6 `PAGE`, 5 `POST`, 1 `PROFILE` | THEME rows are presentation settings of the old skins, not content: drop; keep only site-level values (social links, about text) as settings |
| `Role` custom field | 5 pages and 4 posts carry `Role = <name>` (Article, CodeMagazine, ContactManager, Diaconete, Administrators, Admin) | A real feature: role-restricted pages and posts. The new app has none yet; decide per item whether it still matters (most look like leftovers from the Contact Manager and CodeMagazine articles) |
| Settings | 306 rows over 3 blogs; stock options plus site name, description, author, e-mail subject prefix, culture, comments off | Only name, description, author and the public contact text are worth carrying |
| Extensions | 56 rows (stock set plus the fork's `GwnWikiExtension`) | See MEF section |

## Mapping to the new model

Reuse the existing content schemas of the app (Page, Post, Category, Tag; see seeds 006 to 008): **no new content schema is needed.** The only addition is a place to remember where an item came from.

| Legacy | New | Rules |
|---|---|---|
| `be_Blogs` row | Org (tenant stays `global-webnet.com`) | Three orgs: Primary, BlogAI, BlogHelp; or fold BlogAI and BlogHelp into categories if the human wants one site |
| `be_Posts` | Post | `Title`, `Slug` (keep, so old links can redirect), `DateCreated`/`DateModified` (keep as given dates), `Author` (map to a user or to Claude/Admin), `IsPublished` (keep), `Description`, `PostContent` HTML to Markdown, `IsCommentEnabled` |
| `be_Pages` | Page | `Parent`, `Slug`, `IsFrontPage`, `ShowInList` (menu), `IsPublished`; skip `IsDeleted` |
| `be_Categories`, `be_PostCategory` | Category, `Post.categories` pointers | Merge duplicates by name |
| `be_PostTag` | Tag, `Post.tags` pointers | Distinct tag text becomes a Tag entity |
| `be_Users`, `be_UserRoles` | User, Role assignment | No password hash; set must-change-password; only people in use |
| `be_Settings` | Site settings (not yet an entity) | Defer until a Settings screen exists |
| `be_CustomFields` THEME | nothing | Presentation of retired skins |
| `be_CustomFields` Role | optional access rule on a post/page | Defer |
| Legacy ids | `legacyId` / `legacyUrl` on each migrated item | Idempotent re-runs and an old-URL redirect table |

## How it would be done (if re-opened)

1. **Convert with review, not blind.** A one-off script reads each post through `blogai_post`, converts HTML to Markdown, extracts inline `data:` images to files, rewrites local image paths, and writes the result through the existing drafts-only authoring surface (`Claude-author.ps1` pattern). Everything lands as a **draft**; the human publishes after checking. 30 items, so a review pass is realistic.
2. Old URLs: keep slugs; add redirects from the legacy path shapes (`/post/<slug>`, `/page/<slug>`) once the public site's routes are compared.
3. Images and attachments: needs the file-system read (the deferred stage), because 24 images are on disk.
4. Users and roles: recreate by hand (about three people).

## Extensions: what to carry as modules (MEF candidates)

Keep as small drop-in modules, later: syntax highlighting (the posts are code-heavy), a wiki module (the fork's own feature: needs a closer look at `BlogEngine.Wiki` before deciding), link resolution, "read more" breaks, one captcha provider if comments return. Drop: Akismet, TypePad, StopForumSpam, pings and trackbacks, newsletters, BBCode, smilies, widget zones (the new site renders menus from the page tree).

## Open questions for the human

1. Re-open the *no import* decision, or keep only the 19 published posts as hand-curated rewrites?
2. One site or three orgs (Primary, BlogAI design, BlogHelp)?
3. Do any of the `Role`-restricted pages still matter?
4. The two 80 to 135 KB design posts: import the images as files, or leave those two out?

## Recommendations (the human re-opened the decision; his concern: the editor is Markdown only)

**Decision: import as Markdown, reviewed, no WYSIWYG needed.** The concern is answered by the data: the content is simple enough to convert to editable Markdown without loss that matters.

- **Why it converts well:** the 30 posts contain only headings, paragraphs, lists, links, code (`<pre>`/`<code>`), 34 images and 2 tables; no iframes, scripts or widgets. Markdown (GFM, which the reader's `marked` renders, including tables and fenced code) covers all of it. The result is plain Markdown the existing editor can edit and re-save, so there is nothing a WYSIWYG would be needed for.
- **Images:** converted to `![alt](url)`. The 24 local images and the two inline base64 images (82 KB and 135 KB) are written out as files and referenced by URL. That needs a home for the files: a folder on the www site (`/media/legacy/<slug>/...`, uploaded with `Claude-ftp.ps1`) is enough for now, because the reader only needs a URL. A real media library (upload from the editor) stays the later feature it already is. The 10 external images keep their URLs.
- **What is lost, knowingly:** inline `style=` attributes (6 in total; Angular's sanitiser strips them anyway), the syntax-highlighter CSS classes (fenced code with a language hint replaces them), and the old theme. Raw HTML for anything unusual may be left inside the Markdown; the reader sanitises it.
- **Editing afterwards:** the Markdown is the source of truth from then on, so later edits never touch HTML again.

Answers to the four open questions:
1. **Re-open: yes**, for the 19 published posts plus the page tree. The 11 unpublished posts stay behind unless the human names any.
2. **One site, with a category per origin** (for example "BlogAI design" for the design posts), not three orgs: the three blogs share one author and one audience, and orgs would split the public menu.
3. **Role-restricted pages:** drop the `Role` fields, but **do not publish** any item that carried one until the human has looked at it: they look like leftovers from retired articles (Contact Manager, CodeMagazine); import those as drafts.
4. **The two large design posts:** import them as drafts with their images extracted as files; they are the best test of the image path. If the result is unwieldy, split or trim by hand.

Staged plan (each stage ends in a review, as usual):
1. **Convert one**: a short post ("How to publish your own blog") end to end: HTML to Markdown, image to file, draft created; the human compares it with the live post.
2. **Convert the code-heavy series**: the MCP bridge posts, checking fenced code and language hints.
3. **Page tree and the rest**: pages with `parent`, the design posts with their large images, categories and tags merged.
4. **Redirects and links**: map old paths to new ones, fix internal links between migrated posts.
5. **Human publishes** each draft after a side-by-side check.
Tooling: a `docs/Claude-migrate-post.ps1` in the workspace root using `blogai_post` to read and `Claude-author.ps1`'s create-draft path to write, with the converter kept small and tested on the real HTML.

> **Update 2026-10-21:** the human confirmed the goal is a schema-faithful table-level migration; see [Claude-decision-2026-10-legacy-table-migration-plan.md](Claude-decision-2026-10-legacy-table-migration-plan.md). This map remains the record of the content import.
