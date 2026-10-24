# Schema-faithful migration of the legacy BlogAI tables to N-Quad: plan (proposed, 2026-10-21)

Status: **proposed, nothing built.** Intent comes from the human's *Blog AI Design* page (read 2026-10-21): keep the legacy SQL schema one to one ("generate N-Quad schemas to match the legacy BlogEngine.NET SQL schema"), N-Quad only in the new app, SQL left intact, Contacts excluded, BLL and DAL kept apart, versioning so data can be read forwards and backwards, Tenant = www.global-webnet.com and Organization = Blog, roles at tenant and organization level, MEF for plugins and widgets. First features to port: Users (Profile, Roles, Users), Posts, Pages. This plan refines [Claude-decision-2026-10-legacy-migration-map.md](Claude-decision-2026-10-legacy-migration-map.md) (which mapped onto the live schemas) and does not replace the content import already done as drafts.

## 1. Where the live model already stands

The live schemas already mirror part of the legacy tables, so the work is smaller than it looks:

| Legacy table | Live schema today | Gaps against the legacy columns |
|---|---|---|
| `be_Posts` | `content/Post` (Title, Slug, Description, Content as Markdown, DatePublished, EnableComments, IsPublished, Author, Categories, Tags, RevisionOf) | DateCreated, DateModified, Raters, Rating, the legacy HTML, soft delete, owning blog |
| `be_Pages` | `content/Page` (Title, Slug, Description, Keywords, Content, Parent, SortOrder, DatePublished, ShowInList, IsFrontPage, IsPublished, Author) | DateCreated, DateModified, the legacy HTML, soft delete, owning blog |
| `be_Categories`, `be_PostCategory` | `content/Category` (Name, Description), `Post.Categories` | Category parent |
| `be_PostTag` | `content/Tag` (Name), `Post.Tags` | none (legacy stores the tag text per post) |
| `be_Blogs` | `identity/Blog`, `identity/Organization` (Tenant + Blog) | hostname, virtual path, primary/active flags |
| `be_Roles`, `be_UserRoles` | `identity/Role`, tenant and organization role assignments | the legacy per-blog role scope |
| `be_Users` | User (older `global-webnet.com/schema/User` IRI) | last login; the legacy password hash is deliberately not carried |
| `be_Rights`, `be_RightRoles` | none | whole table |
| `be_PostComment` | none | whole table (0 rows today) |
| `be_Settings`, `be_CustomFields`, `be_DataStoreSettings`, `be_Profiles` | none | whole table |

## 2. Approach: two layers

1. **Legacy mirror layer.** For every table we port, a schema `https://schema.global-webnet.com/legacy/<TableName>` with one field per column, original column names, mapped types, and the original row identity (the legacy GUID where there is one, otherwise a stable UUID derived from table and key). Nothing is dropped except secret columns. This is the "schema-faithful, one to one" part and makes the migration lossless and repeatable.
2. **Live layer.** The existing content and identity schemas, projected from the mirror by one small, tested mapping per table (HTML to Markdown, `BlogId` to organization, role names to roles), idempotent through a `legacyId` field. The drafts imported in stages 1 to 3 are matched to their mirror rows by slug and given their `legacyId`, so nothing is imported twice.

Why two layers: the live model keeps evolving (Markdown, revisions, server-driven forms) while the mirror stays a faithful, versioned copy of BlogEngine 3.3.6 plus the fork; plugins and widgets (MEF) and future re-imports read the mirror, not a model that has moved on. The cost is duplicate rows, which is negligible at this size (30 posts, 8 pages, 6 users).

## 3. Rules

- **Types:** `uniqueidentifier` to Guid, `nvarchar`/`varchar` to String (Text above 255 or `max`), `bit` to bool, `int` to Int, `real` to Double, `datetime` to DateTimeOffset, `varbinary` not migrated. Legacy `datetime` has no zone; treat it as UTC (BlogEngine stored server time; the server's zone is a question for the human).
- **Identity and delete:** entity Id = legacy GUID; `IsDeleted = 1` becomes a tombstone in the store's own sense, and the flag is also kept as a field so the mirror stays faithful.
- **Organization:** every mirror row carries its `BlogId` as a reference to the `Organization` of that blog (Primary, BlogAI, BlogHelp).
- **Versioning:** each mirror schema carries `schemaVersion` (`blogengine-3.3.6+gwn-2026.09.26`), and each imported entity records `importedAt` and the legacy `DateModified` or row key, so a later import can tell new from changed.
- **Secrets stay out:** `be_Users.Password`, extension setting values and anything named like a secret are never read (the SELECT-only login cannot).
- **Contacts:** the `Contact` table is excluded (the design page's own rule). The page's admin outline still lists a Contacts screen under Users; I read that as a leftover and recommend dropping both.
- **Schemas are generated, not hand-typed:** a generator reads columns and keys from the live database (through `blogai_columns` and `blogai_foreign_keys`) and writes one new seed file, `seed-009-legacy-schemas.nq`, following the existing convention (a named seed applies once; changes ship as a new seed). A test checks that every ported table has a schema and every column a field.

## 4. Waves (tables, in order)

Row counts are the production counts read on 2026-10-21; "visible" means the read-only login can see the table today.

| Wave | Tables (rows) | Why now |
|---|---|---|
| **1: Users, Posts, Pages** (the design page's first features) | `be_Blogs` (3), `be_Users` (6; no hash), `be_Roles` (12), `be_UserRoles` (11), `be_Rights` (120), `be_RightRoles` (240), `be_Posts` (30), `be_Pages` (8), `be_Categories` (9), `be_PostCategory` (17), `be_PostTag` (34); also `be_Profiles` (not visible yet: needs a grant) | The Users section (Profile, Roles, Users) and CRUDL Posts and Pages are the agreed first features |
| **2: Content and Settings** | `be_PostComment` (0, schema only), `be_Settings` (315; Basic, E-Mail, Feed, Comments, Controls), `be_CustomFields` (690, of which only the `PAGE`, `POST` and `PROFILE` rows matter; the `THEME` rows belong to retired skins) | Comments and Settings screens; the `Role` custom field is the legacy restricted-content feature |
| **3: Extensions** | `be_DataStoreSettings` (56 rows: plugin and widget settings; values can hold keys, so the import must run with redaction and secrets kept in the vault) | Plugins and Widgets as MEF modules |
| **Not migrated** | `Contact`, `be_Referrers`, `be_PingService`, `be_PostNotify`, `be_StopWords`, `be_QuickNotes`, `be_QuickSettings`, `be_BlogRollItems`, `be_Packages`, `be_PackageFiles`, `be_FileStoreFileThumbs` | Spam-era, per-admin or tooling data with no counterpart; revisit on request. `be_FileStoreDirectory` and `be_FileStoreFiles` are empty; the real files live on disk (separate file-system stage) |

## 5. Mechanics and stage gates

| Stage | Work | Needs from the human |
|---|---|---|
| A | Add a table-scoped, paged `blogai_rows` read tool (allowlist = granted tables and columns only; same login, same scope); extend `Claude-blogai-reader-grants.sql` for `be_Profiles`; write the schema generator and `seed-009-legacy-schemas.nq` for wave 1; tests | run the extended grants; review the generated schemas |
| B | A .NET import tool (reads through `blogai_rows`, writes the mirror and the live projection through the entity repository), run first against the **local** Postgres, with a report of counts and a field-by-field spot check; slug match to the 18 imported drafts | review the report |
| C | Users, roles and rights: tenant-level and organization-level assignments from `be_UserRoles` and `be_RightRoles`; no password hashes (accounts get must-change-password) | confirm which of the 5 distinct user names stay |
| D | Settings and custom fields (wave 2) and the `Role` restriction rule | decide which legacy `Role` restrictions still matter |
| E | Plugins and widgets as MEF modules, from the extension settings | pick the first module |

Each stage ends with a stage review and a pause, as usual. Production is touched only after a clean local run and your go.

## 6. Decisions I need (recommendation first)

1. **Mirror layer plus projection (recommended)** versus extending the live schemas to carry every legacy column. The mirror keeps the migration lossless and the live model free; extending would be simpler but pollutes the live schemas with BlogEngine specifics.
2. **Data load path:** a .NET import tool writing through the entity repository (recommended: typed, testable, idempotent, local first) versus generated `.nq` data seeds in git (reviewable but would commit user data and about 500 KB of HTML).
3. **Add the paged `blogai_rows` tool (recommended)** versus one named query per table. The grants remain the guard, but this is a wider read surface than the named queries, so it is your call.
4. **Contacts:** drop the table and the Contacts admin screen (recommended).
5. **Time zone** of the legacy `datetime` values (server local; UTC assumed unless you say otherwise).
