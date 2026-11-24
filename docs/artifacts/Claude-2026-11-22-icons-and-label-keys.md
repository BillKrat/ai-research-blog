# Stage review: icons and label keys (beta row 13, stage 1 of 3), 2026-11-22

Every button in every template is now an icon with its words (hover text, screen-reader name, any visible text) coming from the label table by key, and a guard spec keeps it that way.

```mermaid
flowchart LR
  T[Template: 'save' | label] --> P[LabelPipe, not memoised]
  P --> S[LabelService.text key, args]
  S --> L{Language table has a text for the key?}
  L -- yes --> R[Language text, with {0} filled]
  L -- no or empty --> E[English from LABELS]
  G[button-contract.spec] -. fails the build if a button has no icon or hard-coded words .-> T
```

## What was built
- **The seam is real:** `LabelService` (language signal plus a table that overrides English key by key; a missing, empty or non-text value falls back to English, so a bad language file never blanks a button) and an impure `label` pipe that repaints when the language changes. `{0}` and `{1}` in a text take arguments, so a name sits inside a translated sentence (`'removeNamed' | label: name`). Stage 2 only has to call `LabelService.load(language, table)` with data from the server.
- **Audit and conversion:** the 83 buttons in 22 templates: 45 text-only or hard-coded buttons were given an icon and keys (about 60 new keys). Where a button was a word (Save, Approve, Previous) the word stays visible next to the icon, now from the table; icon-only buttons keep hover text. The text arrows in grids and the widget order buttons became Material icons, the editor's H2 and H3 became icons, the 'x' remove buttons became a close icon.
- **Guard:** `src/app/button-contract.spec.ts` scans every template and fails for a button without an icon, without a table-keyed hover text and screen-reader name, or with literal words inside. Text the server supplies (server-offered action names, the banner action) is the one listed exception.
- **Tests:** label seam spec (6), button contract (4); existing specs that matched button text now match the aria-label (pager, editor switch, exception drill-down). All client projects pass; `build:libs` and the production build succeed (initial bundle 975.54 kB, was 964.92 kB; the 600 kB budget warning is as before).

## Not covered yet (later stages or noted)
- Stage 2: serve the table as data per language, an administrator picks the language, server-supplied text (menu names, field labels, validation messages, action names) localized by the server by culture, English fallback.
- Stage 3: Claude MCP tools to read the label catalog and propose a language file for review.
- Still English in templates and not buttons: headings, table headers, the account menu links (Profile and so on), status text such as "Saved.", and the `noun` word inside "Add a post".
- Not seen in a browser: icons beside the old words may need small spacing tweaks.

## Test steps
1. Open any admin screen: every button shows an icon; hover shows its text.
2. Public site: the pager shows Newer and Older with arrows; the comment form button shows a send icon.
