# Decision (2026-10-24): rights-based security model owned by Claude; BlogEngine.NET migration closed

**Decided by the human, 2026-10-24, after a look at BlogEngine.NET's audience** (last release 2019-06, last code push 2023, about 990 stars, a few hundred live sites by third-party counts, unanswered security reports): the migration path from BlogEngine.NET is **no longer a goal**. The owner's own site is the only migration that mattered, and it is done to the point of the mirror and the imported posts. Claude owns the design of the security model.

## What this closes
- The legacy migration plan stages beyond B (roles and rights projection, settings, custom fields, plugins and widgets as MEF modules) leave the backlog. The faithful mirror (`legacy/be_*`, seeds 009, 010, 012) and the 18 imported posts stay as they are; nothing is deleted.
- Features of BlogEngine's admin are still welcome where they are good (the admin shell keeps taking its best ideas), but nothing is built to stay compatible with it.

## What this opens
The security model is designed for this application, not copied. The design, its stages and its reasons are in the collaboration item "Review: roles today, what they gate, and a plan for Users, Roles and test users" (Admin > Collaboration) and summarised here:

1. **Rights, not role names, are what code checks.** A right is a named capability (`posts.edit.any`, `collaboration.review`, `users.manage`). A role is data: a named bundle of rights. Deny by default; the server enforces, the client only reflects what the server's menu says.
2. **Role assignments decide access.** What an administrator assigns on Admin > Users is what the person can do. The identity store keeps credentials only.
3. **Rights are resolved per request** (briefly cached), so removing a role takes effect within seconds, not at the token's expiry.
4. **Invariants:** the Administrator role always holds every right; the last administrator cannot be removed or demoted; changes to roles and assignments are audited; machine callers keep scopes (the machine counterpart of rights).
5. **Proof:** a test fails when an admin route has no right attached; a per-role matrix test; named test users (`test-editor`, `test-reviewer`, `test-developer`, `test-nobody`) for the manual checks.
