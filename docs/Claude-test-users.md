# Test users for manual checks (S4)

Four named people, one per shipped role plus one with no role, so every manual test of the rights model uses the same people. They are created through the admin screens (which also exercises the Users and Roles features); nothing creates them automatically, so a test person can never appear in a store by accident. **Create them on the local database or on a store you are content to test on; never on a store with real customers.**

| User name | Role to assign | What to expect after signing in |
|---|---|---|
| `test-editor` | Editor | Posts, Pages, Categories and Tags, Media; no Users, Roles, Settings, Plug-ins, Diagnostics |
| `test-reviewer` | Reviewer | Read-only Posts and Pages; Collaboration with Approve and Decide; Decisions; no Users or Roles |
| `test-developer` | Developer | Collaboration (write comments, no Approve), Diagnostics read; no Pages, Users or Roles |
| `test-nobody` | none | Signs in, sees no Admin menu, every admin address answers 403 |

## Steps (as Admin)
1. Admin > Users > New. Enter the user name from the table (an email such as `test-editor@example.invalid` is enough). Save.
2. On the new person's screen choose **Set password**. The password is shown once: copy it into your password manager at once. The person must change it at the first sign-in.
3. Under **Tenant roles** add the role from the table for the tenant you are testing (skip this for `test-nobody`).
4. Sign out, sign in as that person, and check the "What to expect" column. The menu comes from the server, so an item that is missing is the rights model working.

## What the tests already prove
`RoleMatrixTests` (Foundation) pins the rights of every shipped role; `RoleRouteMatrixTests` (app) pins which admin controllers each role reaches; `RouteRightsGuardTests` fails when a route has no right. The manual check above is for what no test can see: the menu and the screens as a person experiences them.

## Cleaning up
Admin > Users > the test person > Delete. Deleting is a tombstone: the person disappears from the lists (no history of who did it is kept).

## F-8 record (2026-10-26)
A read-only check of the live identity store found the seeded `Claude` account with its password-change flag still set (the human is resetting its password) and a leftover `Admin` account (role `TenantAdmin`) under the old tenant name `www.global-webnet.com`. The leftover was deleted by id after a dry run (one entity, one credential row, no other data). The store now holds only `Admin`, `Claude` and the two test people.
