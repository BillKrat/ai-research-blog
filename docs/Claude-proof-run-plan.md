# Proof run: install from scratch on a spare domain (plan)

**Postponed until beta (owner, 2026-10-29): beta is the priority, so this run waits for a beta state.** The plan stays as written.

**Purpose:** turn [the install guide draft](Claude-install-guide-smarterasp.md) into a proved guide by following it exactly, on a domain that is not ours, with the code in **private** repositories. Written 2026-10-29. Nothing here has been run yet.

**Window:** the sparse time before ~2026-11-03 (human). **Needs from the human before it starts:** the spare domain (written `<domain-name>`) and the day.

## What the private-repo setup changes
A GitHub fork of a public repository cannot be made private, so the proof run uses two **new private repositories** seeded from `main`:
```
gh repo create <account>/ai-research-blog --private
gh repo create <account>/Adventures.Foundation --private
git -C Adventures.Foundation push https://github.com/<account>/Adventures.Foundation.git main:main
git -C ai-research-blog push https://github.com/<account>/ai-research-blog.git main:main
```
Push `main` only (no old branches). The workflows clone Foundation from a sibling repository, which a private repository refuses anonymously. Fixed on branch `claude-session-2026-10-29` (workflows `test.yml`, `deploy-webapi.yml`, `deploy-mcp.yml`):
- `test.yml` ignored the `FOUNDATION_REPO` variable and always cloned ours; it now uses it.
- A new optional repository secret `FOUNDATION_TOKEN` (a fine-grained token with **read-only Contents** access to the Foundation repository only) is sent as an HTTP header for the clone. It is not put in the URL, so it is not stored in the clone's remote; the derived header is masked in the log. Without the secret nothing changes (public clone).

## Split of work
| Step | Who | Notes |
|---|---|---|
| Choose domain and day | Human | Spare domain whose DNS you control |
| Create the private repositories and push `main` | Human (or Claude with a one-off OK) | Commands above; the token never passes through chat |
| Create `FOUNDATION_TOKEN` and the other repository secrets and variables | Human | Install guide steps 4 and 5; types the values himself |
| Hosting panel: sites, DNS, certificates, database, FTP users, host secrets | Human | Guide steps 1 to 3 and 5; Claude may read the panel through the SmarterASP tools to confirm, never create credentials |
| Preflight check (names and secrets present, DNS answers) | Claude | Backlog: `Claude-preflight.ps1`, read-only |
| First deploy runs, health check, `Claude-verify.ps1` adapted to the domain | Claude | Reports each PASS or FAIL |
| Record every deviation from the guide and fix the guide | Claude | The point of the exercise |

## Order of the day
1. Private repositories and secrets (30 min).
2. Panel: sites, DNS, certificates (certificate issue can take a while, so do it first and work on the rest meanwhile).
3. Database and host secrets.
4. Push a branch: `Tests` workflow must be green on the private repositories (this proves the `FOUNDATION_TOKEN` path).
5. Merge to the private `main`: MCP, API, client deploys.
6. First sign-in: change the default `Admin` password at once, create a second administrator, handle the `Claude` account (guide section 8).
7. `Claude-verify.ps1` against the new domain; fix any difference in the guide.

## Success criteria
- All three deploy runs green without anyone editing a file in the repository (only variables, secrets and panel settings).
- `https://www.<domain-name>`, `https://api.<domain-name>/api/health` and the MCP site answer; anonymous admin routes are refused.
- Admin sign-in works; the tenant shown in the Admin menu is `<domain-name>`.
- A reader who has never seen the project could repeat it from the guide: every step the human had to improvise is written back into it.

## Known risks to watch
- Certificate for the MCP site only worked as a **subsite** on our account.
- The root FTP login must never be stored in GitHub; only scoped users.
- A deploy that is green while the site returns 500 (a missing host secret): the health step exists for this.
- Nothing about this run touches our live sites: separate domain, database, FTP users and repositories.

## Not covered
Tenant data scoping, the beta kit and billing are later; this run proves install and deploy only.
