# Stage review: more legacy widgets (DCP c62c213c)

**Branch:** `claude-session-2026-12-14` in the app repo and in `Adventures.Foundation`.

## What was built

Two widgets from the legacy BlogEngine set, as built-ins of the `widgets` plug-in (placed on Admin > Widgets like the others):

- **Post list:** the newest published posts as links to `/post/<slug>`. Setting: how many (1 to 50, default 5).
- **Page list:** the pages of the site menu as links to `/page/<slug>`, sub-pages nested.

Both are plain lists. Titles are HTML-encoded and addresses URL-encoded, so a title with markup in it injects nothing, and the sanitiser still runs over the result like for any widget. A list with nothing in it renders nothing and the widget is left out of the page.

## Legacy widgets considered and not built

| Legacy widget | Decision | Why |
|---|---|---|
| Search | skipped | the header already has the search icon, and the sanitiser removes form controls from widget HTML |
| Subscribe (RSS) | later | the feed lives on the API address, which a widget does not know in the split layout |
| Month list (archive) | later | no archive-by-month route exists yet |
| Recent comments | later | needs a new "latest approved comments" query and a privacy decision on what is shown |
| Blog list | not applicable | each tenant is its own site, not a blog inside one install |
| Link list | later | needs a place to hold the links (a setting per placement would do) |

Already there: Administration (previous stage), Tag cloud, Category list, Text box.

## Verified

- Foundation `Adventures.Blog.Tests` 370 (new tests first: the two lists, encoding, the limit passed to the post list, empty cases, the registration), `Adventures.Blog.WebApi.Tests` 71 pass; app host tests 51 pass.
- Not seen in a browser.

## Test steps for the human

1. Run `.\docs\Claude-run.ps1 -Branch claude-session-2026-12-14`, sign in as Admin, open Admin > Widgets.
2. Place **Post list** (set How many to 3) and **Page list** in the right zone.
3. On the public site the right zone lists three posts and the menu pages; the links open the right post and page.
4. Say which of the "later" widgets you want, in order.
