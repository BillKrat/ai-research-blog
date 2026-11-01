# @adventures/blog-reader

The public site, as a library: what a visitor sees and what a signed-in author gets beside a post. The client side of the .NET `Adventures.Blog` project.

- **Routed pages**: `PageView` (home and pages), `PostList` (all posts, a category, a tag), `PostView` (one post, with its comments and approval state for an administrator).
- **`adv-site-nav`**: the header menu built from the published pages; **`adv-draft-badge`**; **`adv-content-tools`** (Add, Edit and Delete beside a post, shown by right).
- **Services**: `PublicContentService` and `SiteService` (the public API and the site settings).

Depends on `@adventures/core`, `entity-ui` and `collaboration`. Tests: `ng test blog-reader`.
