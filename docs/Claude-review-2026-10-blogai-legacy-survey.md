# First survey of the legacy BlogAI database (2026-10-21)

Read through the new MCP `blogai_*` tools (local server, real SELECT-only login). Counts and structure only; no post bodies read yet, no personal data copied here. This is the starting point for the `be_*` to N-Quad migration map.

## What is there

| Area | Finding | Migration note |
|---|---|---|
| Blogs | 3: `Primary` (the main site), `BlogAI` (design pages and posts), `BlogHelp` (one welcome post) | A blog is the tenant/org seam in the new model: map `BlogId` to Org, not to a new entity type |
| Posts | 30 (21 on Primary, 8 on BlogAI design, 1 on BlogHelp); themes: MCP bridge series, DI, prompting discipline, design docs | Becomes `Post` (Markdown, not HTML: needs HTML to Markdown conversion and a check of embedded images and code blocks) |
| Pages | 8, with a parent: an "Article" page with 4 children (Angular, Authentication / Security, ASP.NET Core API, Swagger), Disclaimer, a deleted BP page, "Blog AI Design" as a front page | Maps to `Page` with `parent`; page tree feeds the public menu |
| Categories | 9; `General` appears twice (one per blog); `AI Systems Author` 8 posts, `MCP Bridge` 6 | De-duplicate by name within a blog; keep id mapping |
| Tags | 34 post-tag rows | Plain tag names, many to many |
| Comments | 0 | Nothing to migrate; Comments slice can be designed fresh |
| Users | 6 rows (one user name appears twice, one per blog) | Password hashes are not migrated (BlogEngine format, and the tool cannot read them); migrated accounts get must-change-password and a reset |
| Roles and rights | 12 roles, 120 rights, 240 role-right rows, 11 user-role rows | Stock BlogEngine rights; map to the Roles screen, only the roles in use |
| Settings | 315 rows (multi-blog) | Mostly stock; review for theme, title, feed settings that matter |
| Custom fields | 690 rows | Largest unknown: find out what writes them (likely the wiki and post extras) before deciding |
| Extensions | 56 extension rows: stock (Akismet, BBCode, BreakPost, syntax highlighter, resolve links, smilies, mail, pings, newsletters, captchas, StopForumSpam) plus the fork's `GwnWikiExtension`; widget zones and widgets | See MEF candidates below |
| File store | 0 files in the database store | Files live on disk (`App_Data` / `Content`): needs the file-system tool stage |

The login sees only the 17 `be_*` tables, so the other applications' tables sharing the database (Identity, grants, triples) are invisible to it, as intended.

## MEF / extension candidates (first view, to confirm after reading the code)

Worth keeping as drop-in modules: the wiki (the fork's own feature), syntax highlighting / code formatting (the posts are code-heavy), link resolution, post break ("read more"), and a captcha provider. Candidates to drop rather than port: Akismet, TypePad, StopForumSpam, pings and newsletters (spam-era features with no comments to protect and no subscribers table in scope), BBCode, smilies.

## Next reads

1. `blogai_custom_fields` grouped by type and key: what the 690 rows are.
2. `blogai_post` for two or three representative posts: HTML shape, images, code blocks, the wiki links.
3. `blogai_settings`: the settings that drive the public site.
4. The file-system stage (legacy `mcp-webapi` or FTP read) for `App_Data`, themes, uploaded images.
5. Draft the N-Quad schemas for what is left after the above, under the `https://schema.global-webnet.com/` convention.
