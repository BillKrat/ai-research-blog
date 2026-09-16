# Developer Setup Guide: Full CI/CD on a $38/Quarter Hosting Plan

**Status: living document, updated as this project grows.** This guide currently
covers local development with .NET Aspire and automated deployment for an Angular
client + .NET Web API. Sections will be added as the project adds pieces (a database,
authentication, background services) — check back as it develops.

This guide documents how to get from "nothing" to a real, professional development
setup — local dev that mirrors production, a live custom domain, a real database, and
a fully automated deploy pipeline — for $38 a quarter (about $12.67/month). No credit
card required for a trial that expires, no per-service minimums, no waiting to "graduate"
onto the real infrastructure. This is the real infrastructure, from day one.

## What you get for $38/quarter

A single SmarterASP.NET hosting account (any similarly-priced shared host that
supports FTP and your language works too) gives you:

- **Unlimited sites/domains** on one account — host as many separate projects, dev
  environments, and personal domains as you want, each with its own subdomain or
  custom domain
- **Multiple database engines** — MSSQL (2016 through 2022), MySQL, and PostgreSQL are
  all available; pick whatever your project needs, or run several side by side
- **Real IIS hosting for full ASP.NET Core apps**, not just static file hosting
- **FTP access with scoped, per-site accounts** — the piece that makes clean CI/CD
  possible, covered below

Paired with **.NET Aspire** for local development, you get a local environment that
starts your whole stack (API, client, and eventually a database container) with one
command, shaped the same way your production deployment is shaped — no "works on my
machine" gap between dev and prod.

## Prerequisites

- A GitHub account and a repo for your project (public or private both work)
- A hosting account that supports **FTP** and running your app's language (this guide
  uses [SmarterASP.NET](https://www.smarterasp.net/), which supports both static sites
  and full ASP.NET Core apps hosted under IIS)
- `dotnet` and Node.js/`npm` installed locally, matching whatever your project needs
- Comfort with basic git (branches, commits, pushes) — no CI/CD experience required

## 1. Local development with .NET Aspire

Before deploying anywhere, get the whole stack running locally with one command. .NET
Aspire orchestrates multiple projects (an API, a frontend, eventually a database
container) as a single unit:

```
AiBlogResearch.AppHost/     ← orchestrator: `dotnet run` here starts everything
src/YourApi/                ← your backend
client/your-frontend/       ← your frontend (wired in via Aspire.Hosting.NodeJs)
```

Running the AppHost brings up the API and the frontend together, with the frontend's
dev server proxying API calls to the backend automatically — so your code never needs
to know whether it's running locally or deployed. This is what makes the deployment
step later a matter of "ship what you already tested," not "hope it works differently
in production."

## 2. Set up hosting: a site per deployable piece

If your app is more than one deployable thing (a UI and an API, say), give each one
its **own site** in the hosting control panel, not a subfolder of one site. This repo
has two:

| Site name | Domain | What it hosts |
|---|---|---|
| `global` | `global-webnet.com` | Angular client (static files) |
| `api` | `api.global-webnet.com` | ASP.NET Core Web API |

Because the plan supports unlimited sites, there's no cost pressure to cram everything
into one site — separating concerns this way makes each piece easier to deploy,
secure, and scale independently.

The subdomain (`api.global-webnet.com`) needs a DNS **A record** pointing at your
hosting account's IP — most panels show you this record and let you add subdomains as
their own "site" in one step.

**Skip the host's built-in "Deploy from GitHub" button if your repo is a monorepo.**
SmarterASP.NET's version of this (and most budget hosts' equivalent) auto-detects a
`package.json` or similar at the **true repository root** with no way to point it at a
subfolder. A monorepo with `client/` and `src/` folders will fail with something like
"could not identify a project root." That's fine — we don't need it. GitHub Actions
does this job better anyway, with actual control over the build.

## 3. Scoped FTP users: one per site

Every hosting account has a root FTP login — usually the same login you use for the
control panel itself. **Keep that one out of GitHub Secrets, and out of CI entirely.**
Instead, create a **scoped FTP user per site**, restricted to that site's own folder,
via the panel's FTP Manager:

- Login: something like `yourname-api` or `yourname-global`
- Path: the specific subfolder for that site (e.g. `/api-global`, `/global`) —
  extra FTP users typically can't see the hosting root at all, which is exactly what
  you want
- Password: separate from your portal password, set here

This keeps each deploy pipeline's blast radius limited to the one site it's meant to
touch, and keeps your CI credentials fully separate from your account login.

One detail that will save you an hour: **once a scoped FTP user's home folder is set
to `/api-global`, logging in with that user already puts you inside `/api-global`.**
Your deploy tool's "remote directory" setting should be `/` for that user, not
`/api-global` again — otherwise you'll write into `/api-global/api-global/` and wonder
why nothing shows up.

## 4. Repo layout

```
your-repo/
├── .github/
│   └── workflows/
│       ├── deploy-client.yml
│       └── deploy-api.yml
├── client/
│   └── your-frontend/          ← Angular, React, whatever — builds to static files
└── src/
    └── YourApi/                ← ASP.NET Core Web API
```

Each workflow is path-filtered so a change to the client doesn't redeploy the API and
vice versa — that's the whole trick for making a monorepo work with per-service
deploys.

## 5. GitHub Secrets

Add these under your repo's **Settings → Secrets and variables → Actions**. Use
separate username/password pairs per site, sharing only the server hostname:

| Secret | Example value |
|---|---|
| `FTP_SERVER` | `yourserver.site4now.net` |
| `CLIENT_FTP_USERNAME` | `yourname-global` |
| `CLIENT_FTP_PASSWORD` | (the scoped user's password) |
| `API_FTP_USERNAME` | `yourname-api` |
| `API_FTP_PASSWORD` | (the scoped user's password) |

Never put a real password directly in a workflow file — always reference it via
`${{ secrets.NAME }}`.

## 6. The two workflows

**Frontend** (`.github/workflows/deploy-client.yml`) — builds a static Angular app and
FTP-syncs the build output:

```yaml
name: Deploy Client

on:
  push:
    branches: [main]
    paths:
      - "client/your-frontend/**"
      - ".github/workflows/deploy-client.yml"
  workflow_dispatch: {}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client/your-frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"
          cache-dependency-path: client/your-frontend/package-lock.json

      - run: npm ci
      - run: npm run build

      - uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.CLIENT_FTP_USERNAME }}
          password: ${{ secrets.CLIENT_FTP_PASSWORD }}
          protocol: ftp
          local-dir: client/your-frontend/dist/your-frontend/browser/
          server-dir: /
```

(The exact `dist/.../browser/` path depends on your framework's build output — check
what your build actually produces before assuming this path.)

**Backend** (`.github/workflows/deploy-api.yml`) — publishes a .NET app and FTP-syncs
the publish output, which includes the `web.config` IIS needs to run it:

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - "src/YourApi/**"
      - ".github/workflows/deploy-api.yml"
  workflow_dispatch: {}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "10.0.x"

      - run: dotnet publish src/YourApi/YourApi.csproj -c Release -o publish

      - uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.API_FTP_USERNAME }}
          password: ${{ secrets.API_FTP_PASSWORD }}
          protocol: ftp
          local-dir: publish/
          server-dir: /
```

`dotnet publish` on a `Microsoft.NET.Sdk.Web` project generates `web.config`
automatically — that's what tells IIS to route requests into the ASP.NET Core Module.
You don't need to write one by hand.

Both workflows also accept a manual trigger (`workflow_dispatch`) so you can re-run a
deploy from the Actions tab without pushing an empty commit.

## 7. Connecting API and client across subdomains (CORS)

If your client and API are on different subdomains (as above), the browser will block
API calls from the client unless the API explicitly allows that origin — **in every
environment, not just local development.** It's an easy trap: CORS configured only for
`IsDevelopment()` works perfectly on your machine and silently breaks the moment you
deploy, because production requests get rejected client-side before you ever see a
server error. In ASP.NET Core:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("Client", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",       // local dev
                "https://yourclientdomain.com" // production
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
// ...
app.UseCors("Client"); // apply unconditionally, not just in Development
```

## 8. Adapting this to your own project

- Swap the framework-specific build steps (`npm run build`, `dotnet publish`) for
  whatever your stack uses — the pattern (checkout → build → FTP-sync the output)
  stays the same regardless of language.
- If you have more than two deployable pieces, repeat the pattern: one scoped FTP
  user and one path-filtered workflow per piece.
- Pick whichever database engine fits your project (MSSQL, MySQL, PostgreSQL are all
  available on the same account) and add its connection string as another GitHub
  Secret when you wire it up — that section will be added here once this project
  reaches that step.
- None of this is specific to SmarterASP.NET — any host offering scoped FTP accounts
  and enough compute to run your app works the same way.

## Coming as this project builds it

- Wiring a database (connection strings, migrations in CI)
- Authentication setup
- Deploying background/agent services alongside the API
