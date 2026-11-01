# @adventures/admin

The signed-in side of an Adventures app.

- **`AdminShell`**: the admin frame; its menu comes from the server, so a new collection or plug-in shows up without a client release.
- **`AdminGrid` and `AdminEntity`**: the one list screen and one entity screen that serve every collection (the route data names the collection and the title).
- **`AdminPlugins`, `AdminExceptions`, `RightsChecklist`**: plug-in switches, the exception log and triage, role rights.
- **`Login` and `Profile`**: sign-in and the person's own profile.
- **Services**: admin menu, exceptions (with the server-error interceptor that refreshes the count on a 5xx), plugins, roles, tenant, health.

The host composes the routes (which collections, which titles); the library supplies the screens. Depends on `@adventures/core`, `entity-ui` and `collaboration`. Tests: `ng test admin`.
