# Stage review: language files (beta row 13, stage 2 of 3), 2026-11-22

The site language is a setting; its texts come from a language file the administrator keeps per tenant; the browser loads that table at start-up and every button and hover text follows it. A key the file leaves out shows English.

```mermaid
flowchart LR
  A[Admin > Settings: Language = de] --> S[GET /api/public/site language]
  F[Admin > Languages: table of texts per code, per tenant] --> L[(LanguageFile rows, tenant graph)]
  L --> P[GET /api/public/labels: site language + its table]
  A --> P
  P --> C[LanguageLoader at start-up and after leaving Settings or Languages]
  C --> LS[LabelService.load language, table]
  LS --> U['key' | label in every template, English where the key is missing]
```

## Decision: where the files live and their format
- **Store rows per tenant, one JSON table per language code** (not files in the plug-in directory). Why: tenant-safe like every other site data, nothing to write on the shared host's disk, and stage 3 (Claude proposes, the administrator reviews and applies) edits the same rows the screen edits. Format: a JSON object of key to text, with `{0}`, `{1}` for arguments. English stays in the client as the fallback, so a file may be finished a little at a time.

## What was built
- **Foundation:** `LanguageFile` entity and seed 026, `ILanguageFiles`/`LanguageFiles` (get, list, save, remove; codes are two or three letters with an optional region and kept lower case; keys are letters and digits; texts are limited to 300 characters, no control characters, at most 500 texts; a bad file is refused whole), the `Language` site setting (default `en`, a non-code falls back to `en`), `PublicSiteSettings.Language`, `LanguagesController` (`api/languages`, site-settings right) and the anonymous `PublicLabelsController` (`api/public/labels`).
- **Host:** the entity registered tenant scoped, seed applied at start-up, the scoped-types list and its guard test updated, the Languages entry in the admin menu (System).
- **Client:** `LanguageLoader` (reads the table at start-up and again after leaving Settings or Languages; failure or a malformed answer keeps English), Admin > Languages (stored languages with counts, open one, "Load the English texts" fills the editor with every key, save, remove; the table is checked as JSON before it is sent).
- **Tests:** Foundation 12 file tests, 4 Language setting cases, 5 controller tests; host and API guard tests updated; client loader (3), App language (1), Languages screen (7). Every suite and both builds pass (initial bundle 982.35 kB, over the old 600 kB warning budget as before).

## Stage 2b: server text through the standard localizer (added the same day)
Decision (after the human asked why not the ASP.NET Core native support): the native abstractions for the server's own words, our store for the data. The engine on the client is small and replaceable (a runtime table, like ngx-translate); the lasting value is the per-tenant store and the review workflow.
- **`IStringLocalizer` and `IStringLocalizer<T>` are the interface** (package `Microsoft.Extensions.Localization.Abstractions`, framework-free, so the layering holds). The implementation is `ServerStringLocalizer` over `IRequestLanguage`: the tenant's site-language table read once per request (the store is asynchronous, the localizer is not), then the declared English default (`AddServerText(key, english)`), then the key itself (marked not found). `{0}` arguments are filled after the text is chosen so a translation can move them. A failed read leaves English; lookups never take a request down. The generic one is `ServerStringLocalizerOf<T>` (the architecture guard wants unique type names).
- **First use: the admin menu.** Every section and entry is declared (`menu.<id>`, `menu.section.<Section>`) and `AdminMenuController` localizes the names (ids, routes, icons and badges untouched). `GET api/languages/catalog` lists the server's keys with their English defaults, and "Load the English texts" on Admin > Languages now returns the screens' keys plus the server's.
- **Deliberately lazy:** callers that localize call `IRequestLanguage.LoadAsync()` themselves (the menu controller does); there is no middleware reading the store on every request. Keys may now contain dots and hyphens (`menu.section.Content`).
- **Tests:** 7 server text tests, 3 menu localization tests (every menu name is declared; names with a translation change and the rest keep English; nothing but names changes), catalog controller test, client catalog merge (2). All suites and both builds pass.
- **Still English on the server:** field labels (they come from the schema data), the names of server-offered actions, validation and business-rule messages. Those are the next uses of the same localizer; the culture is the tenant's site language (an `Accept-Language` or per-person language would be a later addition). The menu reads its names when it loads (sign-in), so a changed language shows in the menu after the next sign-in or reload.

## Threat addressed
A stored language file is data an administrator (or Claude, in stage 3) writes and every visitor reads. Texts are shown as plain text (Angular interpolation, attributes and tooltips, never as HTML), and the server limits length, count, key shape and control characters, so a hostile file can change words but not run script. Writing needs the site-settings right; the public read exposes words only.

## Not done (stage 3 and later)
- **Server-supplied text** (admin menu names, field labels, validation messages, server action names) is still English; localizing it by culture on the server is its own stage.
- Headings, table headers and page paragraphs in templates are not keyed yet.
- Stage 3: Claude MCP tools to read the key catalog and propose a language file for review.
- Not seen in a browser; the Language setting is plain text on the Settings screen (a code such as `de`).

## Test steps
1. Admin > Languages: "Load the English texts", set the code to `de`, change a few texts (for example `save`), Save.
2. Admin > Settings: set Language to `de`, save, open another screen: the changed hover texts and button words follow; untranslated keys stay English.
3. Set Language back to `en`; remove the `de` file.
