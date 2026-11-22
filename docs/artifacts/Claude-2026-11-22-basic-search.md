# Stage review: basic search of the blog's own content (beta row 6), 2026-11-22

A visitor can search the published posts and pages. This is layer 1 (plain, own content); AI-assisted and hybrid search stay out of beta.

```mermaid
flowchart LR
  H[Header search icon] --> P[/search?q=...&page=n]
  P --> API[GET api/public/search, anonymous, 20 a minute per address]
  API --> V{2 to 100 characters?}
  V -- no --> R[plain refusal]
  V -- yes --> S[ContentSearcher: read published posts and pages]
  S --> M[ContentSearch.Run: every word found, title 5, labels 3, description 2, text 1; newest breaks a tie]
  M --> O[hits: kind, slug, title, plain-text snippet, date, paged]
```

## What was built
- **The engine (`ContentSearch`, pure and tested):** published posts and pages only (no draft, no proposed revision); every word must be found in the title, tags and categories, description or text; ranking by where the words are (title 5, tags and categories 3, description 2, text 1), newest first on a tie; matching is plain case-insensitive text, never a pattern (`.*`, `(a|b)+`, `[[`, `C++ (beta)` are just text). Markup, Markdown marks, link addresses, scripts and styles are removed before matching, so a query cannot match a tag or attribute name, and the snippet (about 180 characters around the first match, or the description) is words only.
- **Limits against abuse:** the query must be 2 to 100 characters (a plain refusal otherwise), only the first six words count, at most 25 hits a page, and the endpoint is rate limited per client address (`RateLimit:SearchPerMinute`, default 20; a refused search is 429, shown in plain words). A refused query reads nothing from the store.
- **The endpoint:** `GET api/public/search?q=&page=&pageSize=`, anonymous, read-only.
- **The page:** a search icon in the header opens `/search`; the query and page live in the address so a search can be linked and the back button works; hits link to `/post/<slug>` or `/page/<slug>`; the snippet is shown as text; messages for no query, no result, a refusal and too many searches; paging with Previous and Next.
- **Tests:** engine (18 cases), controller (3), client (7); every suite and both builds pass.

## Not done, and honest limits
- Each search reads every published post and page of the tenant and scans it in memory. That is fine for a beta blog (hundreds of items) and the rate limit bounds the cost; the store-level index in the quad-storage plan is the real answer at scale.
- No stemming, typo tolerance, highlighting or category and tag filter; no search tool for MCP yet (AI-assisted and hybrid search are after beta).
- Not seen in a browser; `Claude-verify.ps1` does not check the search endpoint yet.

## Test steps
1. Header search icon: the Search page opens. Search a word that is in a post title, one only in a post's text, one only in a tag: each post is found, the title hit first.
2. Two words: only posts with both. A word in a draft or in an unpublished page: not found.
3. One letter: a message asks for at least two. A very long query: refused. `.*` or `<script>`: no results and no error.
4. More than 10 results: Previous and Next work and the address changes. Reload on page 2 keeps the search.
5. Run more than 20 searches in a minute: a "searching too fast" message.
