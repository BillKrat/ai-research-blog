# Cutover: moving a site to the dictionary quad layout (and the pristine beta store)

Beta rows 9 and 11. Written 2026-11-23 after the rehearsal on the local dev store (results at the end). The live site is untouched until the human says "go"; every step before the switch only reads the old table or writes to new tables beside it.

## Two ways to start the new layout

| | A. Carry the content over | B. Pristine start |
|---|---|---|
| What the new store holds | every row of the old table except the dead audit records | only the install seed (schemas and defaults, no people, no content) |
| When to choose it | the site has content worth keeping (posts, pages, tenants, people, collaboration items) | a clean beta, or a fresh install |
| Steps | 1, 2, 3 (copy), 4, 5 | 4, 5 only (empty prefix) |
| After the switch | the old table stays untouched, for rollback | the first request to the address creates the first site (Admin with the default password, changed at the first sign-in) |

The deployed app uses the install seed by default (a Development run uses the developer seed), so an empty prefix on a deployed site is pristine without any extra setting; `Seed__Profile=install` makes it explicit.

## Steps (live site; replace names with yours)

1. **Back up first, two ways** (see `Claude-backup-and-restore.md`): the hosting panel's database backup, and `Claude-nquad-tool export` of the text table (note the row count and SHA-256).
2. **Dry run of the copy** (reads only, creates nothing):
   `.\docs\Claude-secret.ps1 run postgres/aiblogdv/a2cb58_aiblogdv -EnvVar PGPASSWORD -Exec dotnet -ExecArgs 'run','--project','docs\Claude-nquad-tool\Claude-nquad-tool.csproj','--','copy','-To','app_dq','-Host','<db-host>','-Port','6432','-Database','<db-name>','-User','<db-user>'`
   It prints the rows per graph that would be copied and excluded. Default exclusions: the audit records (subjects under `.../id/audit/`, predicates under `.../ontology/audit#`), which belong to the feature removed on 2026-10-29. `-KeepAudit` copies them too. Read the list; if something else should stay behind, say so before the real copy.
3. **The copy** (still only reading the old table; the new tables `app_dq_terms` and `app_dq_quads` are created beside it): the same command with `-Apply`. It refuses a target that already holds rows, copies in batches of 5,000, then **proves the copy**: the count and the SHA-256 over the rows sorted by id must equal the same figures from the filtered source, or it stops and says so (drop the two new tables and run again). The human runs `-Apply` against the live database.
4. **Switch:** set the API site's setting `NQuadStore__Layout` to `Dictionary` (the prefix defaults to `app_dq`; set `NQuadStore__Prefix` only to use another) and restart the site. Nothing else changes: the media table, the people tables and every secret are the same.
5. **Check:** `docs\Claude-verify.ps1` (health, public endpoints, the anonymous refusals); sign in; open the Dashboard, Posts, Admin > Tenants and the menu; read the API log for the line `N-Quad store: postgres at ...`; run the beta ledger's smoke steps.

**Quiet window.** Anything written to the old table after step 3 started is not in the new store. For a site with real traffic, stop the API site (the hosting panel or `website_stop`) around steps 3 and 4, or accept re-running the copy into a new prefix (`-To app_dq2`, then `NQuadStore__Prefix=app_dq2`) when you notice a gap. The old table is never changed by any step.

## Rollback

Set `NQuadStore__Layout` back to `Text` (or remove it) and restart: the site reads the old table again, exactly as it was at step 3. Nothing was deleted anywhere. Keep the old table for at least one release after the switch; dropping it is a separate decision for the human.

## What the rehearsal proved (local dev store, 2026-11-23, nothing on the live site)

- **Dry run** on the dev store: 33,663 rows, 5,115 to copy and 28,548 excluded (85% audit, the same share as live).
- **Copy with the audit kept** (33,663 rows) and the same rows exported from the text table, from the dictionary copy and from a dictionary store restored from that export: **all three files have the same SHA-256** (`68AD5591...`). So the copy and the restore lose and change nothing.
- **Copy in the cutover shape** (audit excluded): verified count and hash.
- **Refusals:** a copy or a restore into a store that already has rows is refused.
- **Size on real data:** 616 bytes a row in the text table against 327 in the dictionary layout for the same content (1.88 times smaller; the synthetic benchmark said 1.64).
- **The real API** started on the copied store and on an empty store with the install seed. The pristine store holds 1,449 rows (schemas and defaults), no account names and no audit rows. The API answered the public endpoints identically on both layouts, but the dev store holds no published posts in the new format, so that comparison shows the endpoints work and not content equality; content equality is the matching hashes above.
- **Not rehearsed:** the switch on the hosted site (it needs the human's go), the quiet-window procedure, a restore from the hosting panel backup.
