# Review: BlogEngine admin (Pages, Posts, menu), 2026-10-20

What the live BlogEngine 3.3.6 admin at adventuresontheedge.net shows, read-only in the human's signed-in browser (nothing was saved, published or deleted). Purpose: settle what the Page and Post schemas and the server-supplied admin menu must carry. The legacy admin is AngularJS over DbBlogProvider / DbMembershipProvider / DbRoleProvider, "Multiple blogs/users".

## The admin menu (left)

| Section | Items |
|---|---|
| Dashboard | stats (published/draft posts and pages, approved/unapproved/spam comments), Quick draft (title + text), Draft posts list, Latest comments, Need help links |
| Content | Posts, Comments, Pages, Categories, Tags, Blogs |
| Custom | Themes, Plugins, Widgets |
| Users | Profile, Roles, Users, Contacts |
| Settings | Basic, E-mail, Feed, Comments, Controls, Advanced |
| About | version and provider information |

Settings Basic also holds the **initial role for self-registration** (Admin, Administrators, Editors, Viewer, Viewers) and "create new blog for self-registered user": the role names BlogEngine ships, which the new role model (Admin, Editor, Reviewer, Developer in the seed) will have to map onto.

## Pages

List columns: **Title, Parent, Sort order, Date, Show in list, Published**; toolbar New, a filter (All), search; row actions publish/unpublish/delete by selection. The live data is a small tree: root pages (Blood Pressure Research, Article, Disclaimer), children of "Article" (Angular 10, ASP.NET Core API 20, Authentication / Security 30, Swagger 40). Sort order orders siblings.

Editor fields: **Title**, rich-text **content**, **Slug** (optional), **Description**, **Keywords**, **Date published**, **Parent** (a select over the other pages), **Sort order**, **Is front page** ("pin as Home"), **Show in list** (puts the page in the site menu), **Author**, **Custom fields** (key/value pairs; a Customize button for per-editor layout). Buttons: Go to page, Unpublish (or Publish), Save, Cancel.

Behaviour that matters for the schema: the hierarchy is a single parent pointer on the child (the reverse relation the decision doc chose); "Is front page" is a flag that only one page may hold; "Show in list" and the parent/sort order produce the menu and submenus; a page with Show in list off is reachable by URL but not listed. Page content can embed other pages with a shortcode (seen in a post: `[Page:DCI Introduction|DciIntroduction]`).

## Posts

List columns: Title, Author, Comments, Date, Published; selection actions as for pages. Editor fields: **Title**, rich-text content, **Categories** (checkbox list with an add-category plus), **Tags** (free entry), **Date**, **Author** (select), **Custom fields**, **Enable comments**, **Slug**, **Description**; Publish/Unpublish, Save, Cancel. So: Post to Categories is many-to-many without data; Post to Tags many-to-many (tags are created by typing); Post to Comments is one-to-many (the comment points at the post); Post to Author a single pointer.

## What this means for the build

- **Schemas** (`https://schema.global-webnet.com/content/...`): Page (Title, Content, Slug, Description, Keywords, DatePublished, Parent `ref:Page`, SortOrder, IsFrontPage, ShowInList, Author `ref:User`, IsPublished), Post (Title, Content, Slug, Description, DatePublished, Author, EnableComments, IsPublished, Categories `refs:Category`, Tags `refs:Tag`), Category, Tag, Comment, Blog. Everything the legacy editors show maps to the contract already built: typed controls (date, bool, number, text), labels and order, read-only flags, pointer fields with lookups, relations (children, comments).
- **Still missing in the contract** for these screens: a rich-text control (type `Html` or a `format` hint on the field), a pointer field to the same schema (Page.Parent: a lookup over pages excluding itself, and no cycles), a tree-aware list (parent and sort order), a "only one page is the front page" rule (a Bll rule), `refs:` editing (categories as checkboxes, tags as typed entry), custom fields (a key/value relation), and publish/unpublish as a state change with its own action, not a plain field edit.
- **Menu:** one entry per row above, grouped by section, each with a route, a label and an icon; visibility by role; a badge for counts (draft posts, unapproved comments). The Dashboard stats are a read model of its own.
- **Not for now:** Custom (Themes, Plugins, Widgets: the new front end will not use BlogEngine themes), Settings subpages beyond Basic, Contacts.

## Suggested order

1. Server-supplied admin menu (this stage): sections and items as data, role-filtered, rendered by the Angular shell; items point at the generic screens that exist (Users, Roles, Exceptions) and at placeholders for Content.
2. Page and Post schemas (seed), read-only lists on the generic grid with parent and published columns.
3. Editors: rich text control, same-schema pointer, front-page rule, publish/unpublish, categories and tags.
4. Dashboard stats; comments moderation; the rest of Content.
