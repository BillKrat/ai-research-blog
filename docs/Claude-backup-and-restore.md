# Backing up and restoring an install

Beta readiness list item (row 8). For whoever runs an install of this app. Written 2026-11-23 from how the app stores things; the whole-database restore through the hosting panel has not been rehearsed by us yet (marked below), the N-Quad export and restore have.

## What holds your data

| What | Where | Lost if you lose it |
|---|---|---|
| Posts, pages, comments, tags, categories, tenants, roles, settings, widgets, collaboration items, exceptions | the PostgreSQL table `app_n_quads` (a statement per row; one table) | the content of the sites |
| Uploaded pictures | the table `app_media` in the same database | the pictures |
| Sign-in accounts and password hashes | the tables `entities` and `user_credentials` in the same database | every account (a restore of the other tables alone is not enough to sign in) |
| Secrets: the database connection string, `Jwt__SigningKey`, `Encryption__Keys__*` and `Encryption__CurrentKeyId`, client secrets, the AI key, mail password | the hosting panel's site settings (never in the database in clear) | you must set them again; see below |
| The application files | your repository (the deploy workflows rebuild them) | nothing: redeploy |

So the database is the one thing to back up, plus a private record of the secrets (a password manager entry per site).

## What to record outside the database

- **`Jwt__SigningKey`** of the API: lose it and everyone is signed out and must sign in again (nothing else is lost). Changing it is also the way to sign everybody out.
- **`Encryption__Keys__<id>` and `Encryption__CurrentKeyId`:** the stored mail password and any other secret-kind plug-in setting are encrypted with this key. Lose the key and those values cannot be read; open Admin > System > E-mail (and the plug-in's Customize screen) and type them again. Keep old keys listed while any value still uses them.
- **The database connection string and the machine client secrets:** replaceable from the hosting panel (rotate the database password there), but write down which site uses which.

## Backup

1. **The whole database, from the hosting panel** (Databases, then Backup, on SmarterASP). Do it before every upgrade and on a schedule you choose (weekly is a fair start for a small blog). Download the file and keep it somewhere that is not the same host.
2. **The N-Quad table as a verifiable file** (for the person with the workspace tools; read-only on the live table): `Claude-nquad-tool export -Out <file.jsonl>` through the secret vault (`Claude-secret.ps1 run ...`, see the workspace `AGENTS.md`, Secrets). It writes one JSON line per row and prints the row count and a SHA-256; keep the three numbers with the file. It does not include `app_media`, `entities` or `user_credentials`, so it complements the panel backup and does not replace it.
3. **Before anything destructive** (a tenant relabel, deleting data, a layout change): export first, check the count, then act.

## Restore

- **The N-Quad table:** `Claude-nquad-tool restore -In <file.jsonl> [-Into <table>]` inserts the lines into an EMPTY table only (it refuses a table that already has rows) and checks the count afterwards. Prove it first against a scratch table (`-Into`), compare, then restore for real.
- **The whole database:** restore the panel backup into the same database (not rehearsed by us; do it once on a spare database before you need it, and note the steps for your host).
- **After a restore:** start the API, open Admin > Dashboard (the health pill) and sign in. If sign-in fails and the people tables were not part of the restore, restore them too; do not edit the database by hand. If every address in the browser answers 404 after a restore, check that the tenant's host names are still listed under Admin > Tenants.

## Rehearse it once

An untested backup is a hope. Once before beta: take the panel backup of a spare database, restore it to another spare database, point a scratch copy of the API at it and sign in. Write down how long it took. Add the result to the beta regression ledger.
