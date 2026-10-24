# Local development database (Windows in Parallels)

Why: the shared dev Postgres at `<db-host>:6432` only accepts connections from an allow-listed IP, and a home connection has no fixed IP, so local runs timed out at startup (`NpgsqlNQuadStore.CreateTableAsync`, inner `TimeoutException`). Docker Desktop cannot run inside the Parallels ARM VM, and the Mac is a separate machine on the LAN, so the database now runs in the Windows VM itself.

## What is installed (2026-10-20)

- **PostgreSQL 17** (EDB x64 installer through `winget install PostgreSQL.PostgreSQL.17`; runs under x64 emulation on Windows ARM), service `postgresql-x64-17`, port **5432**, listening on this machine only, command line tools only (no pgAdmin).
- Database **`aiblog_dev`** owned by login role **`aiblog_dev`**. Its connection string is in the API project's user-secrets as `ConnectionStrings:Postgres` (Host=localhost). The password was generated at install time and never displayed or committed.
- The superuser `postgres` has a password nobody recorded (the installer needed one and it was discarded). To use `postgres` again, reset it: stop the service, set `host all postgres 127.0.0.1/32 trust` at the top of `C:\Program Files\PostgreSQL\17\data\pg_hba.conf`, start the service, `ALTER ROLE postgres PASSWORD '...'` through `psql`, restore the file.

## Using it

- **First time, once:** the API creates and seeds the N-Quad store by itself, but login reads the older JSONB identity tables, which it does not create. Run `powershell -File docs\Claude-local-db-init.ps1` from the workspace root (schema plus the Admin and Claude dev accounts; it refuses any non-local host). Without it, signing in fails with `42P01: relation "entities" does not exist`. After a reset (below), run it again.

- Run Aspire or the API as before: startup creates `app_n_quads` and applies the seed files once (baseline, 002 to 007). `/api/health` shows the database as ok.
- **Reset to a clean state:** `psql -h localhost -U aiblog_dev -d aiblog_dev -c "drop table app_n_quads cascade"` (the password is in the user-secrets entry; use the vault tool rather than typing it), or drop and recreate the database as `postgres`. The next start recreates and reseeds it.
- The old shared dev connection string is not lost: `.\docs\Claude-secret.ps1 sync` writes it back into user-secrets (it overwrites `ConnectionStrings:Postgres`, so run it only to go back to the shared database, from an allow-listed IP). The live-Postgres tests in `Adventures.Data.NQuad.Tests` keep using their own user-secret.
- Without any database: `NQuadStore__Provider=Memory` runs the API on the in-memory store (data is lost on restart).

## Undo

`winget uninstall PostgreSQL.PostgreSQL.17` removes the server (the data directory under `C:\Program Files\PostgreSQL\17\data` is kept by the uninstaller until you delete it); then `sync` the shared connection string if wanted.
