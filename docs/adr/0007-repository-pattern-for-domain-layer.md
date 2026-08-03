# 0007. Adopt the Repository pattern for the persistence-facing domain layer

Status: Accepted
Date: 2026-08-03

## Context

ADR-0002's naming correction (MVPVM) surfaced an honest gap: this
codebase doesn't yet have a distinct BLL/DAL split. `IProvider` and
`IDbProvider` currently do both jobs at once — the interface *and* the
actual external call (HTTP request, SQL query) live in the same
concrete class.

The user has known the Repository pattern for years but it never fit
cleanly into a Prism/MVPVM path before now. There's a real reason for
that, worth recording rather than treating as coincidence: in
Kratochvil's MVPVM article, the BLL layer already promises exactly
what Repository is known for — *"you'll use dependency injection to
resolve your DAL interface within the BLL, so you can later swap out
the DAL without affecting any downstream code."* When a BLL interface
already gives you swappable persistence, a separately-named Repository
layer on top is redundant — there's nothing left for it to add.

What's different here: this project doesn't have a clean BLL sitting
over a DAL yet — it has `IDbProvider`, a single interface conflating
both. ADR-0004 already informally reached for the right shape when it
described `FormDataRepository` as sitting "on top of an `IDbProvider`
implementation," without naming *why* that specific word was correct.
It's correct because Repository is a more precise term than generic
"BLL interface" for this specific role: a Repository is specifically a
collection-like abstraction over persistence for one kind of domain
object (get/save/list/delete), which is exactly `FormDataRepository`'s
job — translate triple-store queries into form-shaped domain objects.
Not every BLL interface is a Repository; only the persistence-facing
ones are.

## Decision

- `IDbProvider` (and any future `IUserProvider`) plays the DAL role —
  generic, low-level storage access, no domain vocabulary.
- Domain-specific Repository classes sit on top of it — `FormDataRepository`
  (ADR-0004) is the first; a `UserRepository`-shaped equivalent is the
  likely counterpart for ADR-0005's identity/role/group/feature data,
  once that work starts (not built yet, not committing to that exact
  name now).
- **Not every interface becomes a Repository.** `IProvider` (LLM
  completions) and `IToolProvider` (tool discovery/execution) are
  deliberately excluded — neither is a collection of domain objects
  with CRUD-shaped access, and forcing the Repository label onto them
  would be a category error, not a consistency win. Repository applies
  specifically to the persistence-facing domain layer.
- Presenters depend on Repository interfaces where the work is
  persistence-shaped, and on `IProvider`/`IToolProvider` directly
  where it isn't — both are equally valid Presenter dependencies per
  MVPVM (ADR-0002); Repository is a refinement of the DAL/BLL split
  for the specific case where the underlying data is a persisted
  collection, not a replacement for the interface-per-responsibility
  discipline already in place.

## Consequences

- `FormDataRepository`'s method signatures (`get`/`save`/`list`/`delete`,
  per ADR-0004) can now be designed against the Repository pattern's
  well-known shape rather than invented from scratch.
- Closes the "no distinct BLL/DAL split" gap ADR-0002 flagged, as a
  natural consequence of building ADR-0004's triple-store work, not as
  separate effort.
- Sets the expectation for future persistence-facing needs (identity,
  subscriptions, documents — ASR-002/ASR-004): reach for a Repository
  over the relevant `I*Provider`, not a direct `IDbProvider` dependency
  in the Presenter.
