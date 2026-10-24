# Stage review: running the app locally on the live data (2026-10-23)

Branch `claude-live-data-profile` (stacked on `claude-reply-toolbar`; root repo branch of the same name for the secret-target entry). Asked by the human: a local run has its own database, so the conversation under a post there is not the one Claude reads; replies had to be made on the deployed site, which lacks the new features.

**What it is:** an opt-in mode in which the local API uses the production PostgreSQL store, so a reply written in the local app lands where Claude reads it through the MCP tools.

```mermaid
flowchart LR
  P[Launch profile https-live] --> A[AppHost: LiveData__Enabled]
  A --> W[WebApi: LiveDataMode.Apply]
  W -->|Development only, string present| C[ConnectionStrings:Postgres = ConnectionStrings:LiveData]
  W -->|refuses| X[Startup error with the reason]
  C --> S[Seeding skipped]
  C --> H[Health says liveData]
  H --> B[Red LIVE DATA banner in the client]
```

**Guards (the point of the design)**
- Off unless `LiveData:Enabled` is `true`; the only switch is the `https-live` launch profile of the AppHost, so the normal profiles are unchanged.
- Refuses to start outside the Development environment, and without `ConnectionStrings:LiveData` (error says what to do).
- The connection string lives in the WebApi's user-secrets under `ConnectionStrings:LiveData` (from the vault; never a repo file). The ordinary `ConnectionStrings:Postgres` is left alone, so switching profiles switches databases.
- **Seeding (changed 2026-10-24):** the store is the shared development environment, so live data mode now applies pending seeds and creates missing tables like any start (a named seed applies once and only adds schema and defaults), which lets a branch with a new schema run against it. Set `LiveData:SkipSeeding` to `true` (for example as an environment variable on the AppHost profile) to leave the store untouched; the startup check then names any schema the store lacks. A seed from an abandoned branch stays in the store: a change to an applied seed ships as a new seed, as always.
- A red banner "LIVE DATA ..." shows to everyone on every page while it is on; the health response carries `liveData`.

**Limits to know**
- Every click is real: publish, delete, approve, upload change the live site. Exceptions the local run logs go to the live exception log.
- A branch that ships a new seed applies it to the shared store when you start this mode (see Seeding above); review items must say so.
- Sign in with your real production Admin account (the seeded local one does not exist there).

**One-time setup (the human; I do not run it)**
1. The secret `postgres/aiblogdv/<db-user>` is already in the vault.
2. From the workspace root, in PowerShell (do not run a bare `sync`: it also rewrites `ConnectionStrings:Postgres`):

```
.\docs\Claude-secret.ps1 usersecret postgres/aiblogdv/<db-user> -Project ai-research-blog\src\AiBlogResearch.WebApi\AiBlogResearch.WebApi.csproj -Key ConnectionStrings:LiveData -Template "Host=<db-host>;Port=6432;Database=<db-name>;Username=<db-user>;Password=[PASSWORD];SSL Mode=Require;Trust Server Certificate=true"
```

3. Start the AppHost with the launch profile **https-live** (Visual Studio: pick it in the profile list; CLI: `dotnet run --project ai-research-blog\AiBlogResearch.AppHost --launch-profile https-live`).
4. Open the Angular app on `http://localhost:4200`; the red banner must show. Stop and restart with the normal `https` profile to go back to the local database.

**Verified:** WebApi 80 tests (4 new: off by default; enabled in Development switches the connection; refuses outside Development; refuses without a connection string), client 91 (2 new: banner shown only when the API says so), production build.
**Not verified:** the mode against the real production database and the AppHost profile in Visual Studio (needs the human's secret and a launch).
