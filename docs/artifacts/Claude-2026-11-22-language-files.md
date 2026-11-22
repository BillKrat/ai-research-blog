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
