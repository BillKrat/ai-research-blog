# Backlog: the legacy site load test, the last task before the beta code cut-off

Owner: Claude. Asked for by the human on 2026-11-27; reviewed the same day, nothing built. **Order:** after the schema browser separation work ([foundation apps](Claude-decision-2026-11-foundation-apps.md)) and any work its reviews raise; full regression testing runs on this site; then code cut-off for beta.

## The task (the human's words, condensed)

Create a `legacysite` folder (single-site layout) holding the application, populated with years of legacy blogs. Then performance and load testing on it. The purpose of the whole run-up: a framework solid enough that beta users with real production data are not put at risk by a later change.

## What the inventory holds (reviewed: counts only)

Source: the `legacy-blogs` folder of the private `poc` workspace repository (an inventory made by another assistant; its own notes apply: the source blogs are read only, post text is personal and is not copied into chat, logs or repositories). It holds metadata and file paths, **no content**; the content is in BlogEngine.NET XML files on a local drive, which was readable on the review day.

| Measure | Value |
|---|---|
| Posts and pages found | 645 posts, 127 pages (772) |
| In real blogs (placeholders left out) | 755 in 11 blog folders |
| Distinct by type and slug / also by day | 497 / 521, so the copies overlap heavily |
| Published and not deleted | 569 (some deleted flags are blank: unknown) |
| Dates | 2007-07 to 2018-05 |
| Content size | 9.1 MB of XML; the largest single file about 2.1 MB |
| Image references | 1,764 distinct; matches are candidates only: 1,024 rows by path, 11,587 by file name, 45 not found |

The inventory scripts still point at another tool's session folder, and the folder was not committed to its repository on the review day.

## Gaps to close

1. **No importer for this source.** `tools/LegacyImport` reads the legacy SQL database; nothing reads BlogEngine XML files.
2. **Which copy is canonical** among the three overlapping main-blog folders.
3. **Layout of the test:** one tenant per legacy blog (exercises multi-tenant) or one merged blog (one large tenant). Recommendation: one tenant per distinct blog, plus one deliberately large tenant.
4. **Images:** pick one file per reference (prefer the blog's own `App_Data\files`), report the missing ones.
5. **Volume:** 755 entries is small for a load test. Add repeatable synthetic copies (10 and 100 times) to find where it bends.
6. **Personal data:** legacy comments can carry names, e-mail and network addresses. Decide what is imported; recommendation: comment text and display name only.
7. **Hosting:** a new site folder, its own database (check the plan's size limit first), certificate and pool settings; never the production database. Ask the host whether load testing a shared plan is allowed before running any against it.

## Stages (each test first, with a review)

1. **Importer** (private tool or `tools/`): XML to the application through its own business rules (sanitiser, slugs), original dates and flags, stable ids so a re-run changes nothing, a dry run with a report. Test fixtures are made-up files, never real posts.
2. **Local load:** import into a local database; record page and API timings, memory and database size at 1x, 10x and 100x.
3. **Fix what it shows.** Expected first: lists load every entry of a kind and page in memory (`NQuadEntityRepository.ListAsync`); store-level paging and sorting is already parked in the Foundation.
4. **The `legacysite` installation:** deploy, import, verify. Nothing is uploaded without the human's word.
5. **Performance and load test** with agreed targets (propose: page responses under 1 second at the 95th percentile with 20 concurrent visitors; no errors; memory inside the pool limit).
6. **Full regression pass** on `legacysite`, then the code cut-off.

## Decide before the cut-off: costly to change once users have data

| Decision | Why it matters |
|---|---|
| **The IRIs in stored data** | Predicates, ids, graphs and older schemas are fixed under `https://global-webnet.com/...` in code and in every installation's data; newer schemas use `https://schema.global-webnet.com/...`. Changing them later is a data migration for every user |
| **The default quad layout for a new installation** | The default is the text table; the hybrid dictionary layout is the measured choice. A user who starts on text needs a cut-over later |
| **How stored data is upgraded** | A named seed applies once and cannot replace a value; changed defaults ship as hand-written upgrade steps. Beta needs a stated, tested upgrade path and a version a store reports |
| **Backup and restore for a user** | The export, restore and cut-over tool lives in the private workspace; a beta user needs a documented, tested way to back up and restore their own data |
| **A restore rehearsal before each upgrade** | Proves the point of this section: an update can be undone |
