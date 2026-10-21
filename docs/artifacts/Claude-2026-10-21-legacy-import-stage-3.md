# Stage review: legacy import, stage 3 (the remaining published posts and the page tree)

*2026-10-21. Branch `claude-legacy-import` here and in the workspace root. 13 more drafts on the live site and 21 images under `/media/legacy/`; nothing published.*

## Result

Of the 19 published legacy posts, **18 are now drafts** (stage 1: 1, stage 2: 4, stage 3: 13). The 19th, the stock BlogHelp "Welcome" post (149 characters), was left out on purpose.

| Group | Drafts | Notes |
|---|---|---|
| AI essays (category **AI**) | Shiney Object Syndrome, The End of Loose Prompting, Models and Agents and Tools, DCI Abstract, DCI Introduction | 1 image in Shiney, 1 mind map in Models and Agents |
| Dependency injection | Understanding Dependency Injection (DI) | 13 images incl. a 2.4 MB animated GIF |
| BlogAI design (category **BlogAI design**) | BlogAI design, About, Content, Custom, Dashboard, Users, Settings | each had one inline base64 image, now a file; the design pages' wiki navigation bar was removed |

Draft ids are in Admin > Posts (all unpublished). Images: 21 files copied from the legacy host and from inline `data:` URIs, served from `https://www.global-webnet.com/media/legacy/<slug>/` (spot checks return 200 with the right content type).

## Converter fixes found on real content (all with tests, 10 node tests pass)

1. Wiki navigation: `[Page:...]` markers at the start of a post, and paragraphs that are only a bar of bracketed names (`[A] * [B]`, `[Admin] | [Dashboard] | ...`), are removed and reported; inline ones keep their text.
2. An `<img>` with no source (left behind in the editor when a picture was deleted) used to come out as `![]()`; it is now dropped. Two drafts had it and were corrected with `update` before you saw them.
3. A legacy image that is already missing on the legacy host (the "Article" page's `blogengine.png`) is reported instead of stopping the run.

## The page tree: recommendation, not an import

The legacy site has 7 live pages. Reading them:

- **Article** ("Under development" plus one missing image) and its four children **Angular** ("ng new webclient --no-standalone"), **ASP.NET Core API**, **Authentication / Security**, **Swagger** are 180 to 220 character stubs of an article that was never written. Migrating them would publish empty pages in the menu. **Recommendation: do not migrate.**
- **Disclaimer** (about 2 KB) is a standard disclaimer that names the legacy site and its e-mail address. **Recommendation:** migrate, after you reword the site name and contact line.
- **Blog AI Design** (the front page of the BlogAI blog) is *your design notes for Claude*. **Recommendation:** do not publish it as a page; keep it as a repository document (I can save it under `ai-research-blog/docs` as a dated reference). See the next section: it contains decisions that matter to the migration.

Staged for you anyway, ready to paste (Admin > Pages > New): `M:\Dev\Websites\global\migration\page-disclaimer\page.md` (and the others, same folder pattern). The authoring surface has no page tool, so pages cannot be created like posts; adding a drafts-only page tool is a small, separate slice if you want pages automated.

## Something your own Blog AI Design page says that changes the migration map

The page states the intent as: *"SQL Server tables: maintain the same schema ... generate N-Quad schemas to match the legacy BlogEngine.NET SQL schema ... one-to-one migration ... versioning could be king"* (and Contacts excluded). My migration map proposed **mapping onto the existing Page/Post/Category/Tag schemas**, which is what the draft import did. Those are two different goals:

1. **Content import** (what stages 1 to 3 did): the posts exist in the new app in its own model. Done, pending your review and publishing.
2. **Data-level, schema-faithful migration** (the design page's intent): N-Quad schemas generated per legacy table, so any BlogEngine data (ratings, custom fields, roles and rights, settings, extension settings) can be moved without loss and re-exported. Nothing of this is built.

Decision for you: is the content import enough for now (it covers everything that exists as readable content), with schema-faithful tables as a later slice, or is the table-level migration still the goal? I would treat the import as sufficient for launching the new site and plan the table-level work against the features actually ported (roles and rights, settings, custom fields).

## What to check

Open the 13 new drafts in Admin > Posts and spot-check: code blocks (DI post), the 13 figures in the DI post, the mind map in "Models and Agents", the design posts (one image each). The two DCI posts lost a navigation line that linked them to each other: once published, add links between them by hand.
