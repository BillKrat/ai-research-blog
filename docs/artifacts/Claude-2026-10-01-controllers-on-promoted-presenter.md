# Stage review: controllers switched to the promoted Presenter (stage F, part 2)

Date: 2026-10-01. Repo: `ai-research-blog`, branch `claude-cleanup-2026-09-26`. Not yet pushed.

## Why
`Adventures.Foundation` promoted `IUserPresenter`/`UserPresenter` into `Adventures.Entities` and
added `Adventures.WebApi` (`ApiControllerBase`, `EntityControllerBase<TEntity>`) for the
genuinely-shared controller action bodies. This half of the stage switches `UsersController`/
`ProfileController` over and deletes the local, now-superseded copy.

## What changed
- `AiBlogResearch.WebApi.csproj`: added a reference to `Adventures.Foundation`'s new
  `Adventures.WebApi` project.
- `src/AiBlogResearch.WebApi/Presenters/` deleted - `IUserPresenter`/`UserPresenter` now come from
  `Adventures.Entities` (promoted in the Foundation session).
- `UsersController : EntityControllerBase<User>`: `Get`/`List`/`Create`/`Update` are now one-line
  delegations to the inherited helpers; `Delete` stays bespoke (resolves the acting user id, then
  wraps the guarded call in the inherited `GuardedAsync`).
- `ProfileController : EntityControllerBase<User>`: `UpdateMe` delegates to the inherited
  `UpdateAsync` helper once it has resolved "me"'s id; `DeleteMe` uses `GuardedAsync` the same way.
  `Me` stays bespoke (username-based lookup doesn't match the id-based `GetAsync` helper's shape).
- **A deliberate response-shape change**: `GET /api/users` now returns `EntityDataModel[]` (full
  field values per row) instead of the old hand-written `UserSummary[]` (Id/UserName/DisplayName
  only) - per stage E's design, the generic presenter doesn't carry a bespoke summary DTO; a list
  UI projects whatever fields it wants client-side. No Angular code depends on this shape yet (the
  admin/list page was explicitly out of scope for the login/profile objective), so this is safe.
- Test fixtures (`FakeUserPresenter`, `UsersControllerTests`) updated to the new interface shape -
  `FakeUserPresenter` now implements both `DeleteAsync` overloads (the ungated base one throws
  `NotSupportedException`, since these tests only exercise the guarded one, same convention
  `FakePasswordHasher.Hash` already uses elsewhere in this codebase for an unexercised method).

## Verified
`dotnet build`/`dotnet test` clean across the whole solution (243 passing). A real `dotnet run`
smoke test (not just fakes, matching stage C's own discipline): the app starts cleanly, and
anonymous `GET /api/users`/`GET /api/profile/me` both still correctly return 401 - the promoted
presenter and controllers are wired and routed correctly, not just compiling.

## Closes out
This completes the Presenter/Controller promotion for `Adventures.Foundation` and its adoption
here. Next (in `Adventures.Foundation`): stage G (Admin/Claude seed accounts), stage H (load
`SchemaEntity`/`SchemaFieldEntity`'s `MetaSchema` from seed data), stage I (real Postgres
credentials) - all library/seed-data work, nothing further needed in this repo until stage I's
verification pass.
