# Decision: server-driven forms and grids (D-1)

**Status:** direction and contract accepted by the human 2026-10-11 after user testing; the three open questions are answered below. Only the current `EntityFormModel` is built so far.

## The pattern, mapped from MVPVM to Angular + ASP.NET Core

MVPVM is WPF-specific; the sources (Potel, Twisting the Triad) describe the underlying roles. For this stack the roles land like this:

| Role (MVPVM) | Here | Lives in |
|---|---|---|
| Model (domain objects) | `DynamicEntity`-derived types (`User`, ...) | `Adventures.Entities` |
| DAL | `IEntityRepository<T>` over the N-Quad store | `Adventures.Entities` (contract), `Adventures.Data.NQuad` (implementation) |
| BLL | `IEntityBll<T>` and entity-specific Blls (`IUserBll`) | `Adventures.Entities` |
| Presenter | `EntityPresenter<T>` / `IUserPresenter`: validates input, applies it, builds the ViewModel | `Adventures.Entities` |
| ViewModel | `EntityFormModel`, `EntityDataModel`, and the grid/relation models below: plain JSON-shaped DTOs, no logic | `Adventures.Entities` |
| View | Angular components: render a ViewModel, report what the user did | `client/` |

This is **Passive View** (App Arch Guide, ch. 10): the View is reduced to the minimum and the Presenter owns all behaviour. It is the classic web split Potel describes (view and interactor on the client, presenter and everything else on the server). The View never knows a rule, a URL pattern or an entity type; the ViewModel never knows a View (MVPVM: the View and ViewModel stay decoupled, only the Presenter couples them). Swapping Angular for anything else means writing a renderer for the same JSON contract, nothing else.

**Test of the design:** adding an entity type (Roles, Posts, Pages) requires zero TypeScript. If a change to a rule or a field needs a client release, the boundary is in the wrong place.

## The contract (proposed)

JSON over the existing API, described by OpenAPI. Names follow the current C# records.

```mermaid
classDiagram
  class EntityFormModel {
    EntitySchemaModel schema
    EntityDataModel entity
    EntityPermissions permissions
    EntityRelationModel[] relations
  }
  class EntitySchemaModel { string schemaIri; EntityFieldSchema[] fields }
  class EntityFieldSchema { name; type; isRequired; label; isReadOnly; order; options? }
  class EntityDataModel { string entityId; map values }
  class EntityPermissions { canUpdate; canDelete }
  class EntityRelationModel { name; label; EntityGridModel grid }
  class EntityGridModel { EntitySchemaModel schema; EntityDataModel[] rows; page; EntityPermissions rowPermissions; bool canCreate; links }
  EntityFormModel --> EntitySchemaModel
  EntityFormModel --> EntityDataModel
  EntityFormModel --> EntityPermissions
  EntityFormModel --> EntityRelationModel
  EntityRelationModel --> EntityGridModel
```

- **Field metadata, server-computed.** `label`, `isReadOnly`, `order`, `type` and (later) `options` for a lookup come from the schema *and the caller's role*, resolved at materialisation (decisions doc, entity-model point 5): a field the caller may not see is never sent, a field they may not change is `isReadOnly`. The client does not decide.
- **Permissions, server-computed.** `canUpdate`/`canDelete` (and `canCreate` on a grid) tell the renderer which buttons to show. The server still enforces them; the flags are for rendering only.
- **Grids.** `GET /api/users?page=1&pageSize=25&sort=UserName` returns an `EntityGridModel` (columns = `schema.fields` filtered to the list-visible ones, `rows`, paging, links). Paging, sorting and filtering are server-side (App Arch: data paging, no chatty or oversized payloads). Today's `List` returns a bare `EntityDataModel[]`; it evolves into this.
- **Parent/child.** A parent's `EntityFormModel.relations` carries one `EntityRelationModel` per child collection (for example a User's Roles), each holding an `EntityGridModel`. Selecting a child row follows that row's link to a child `EntityFormModel`. **Each entity keeps its own CRUDL endpoints and Bll rules**: a child row is saved, added or removed through its own endpoint (`/api/users/{id}/roles`, or `/api/roles/{id}`), never as one aggregate PUT of the whole parent. That keeps every rule in exactly one Bll (A3, B1).
- **Links.** The server supplies the URLs (`self`, `create`, row links). The client follows links and holds no URL templates, so routes can move without a client change. (Hypermedia-lite, not full HATEOAS: only the links a renderer needs.)
- **Errors.** Validation failures already return `ValidationProblemDetails` keyed by field name; the renderer maps `errors[field]` onto the matching control generically. Business-rule refusals are 409 with a message to display. Nothing else leaks.
- **Relationships in the schema.** A relationship is declared in the N-Quad schema (proposal: field types `ref:<Schema>` for one and `refs:<Schema>` for many, with the predicate linking the two subjects), so the presenter discovers parent/child structure from data, the same way it discovers fields today. This is the part most worth the human's eye before it is built: it also decides how the Tenant/Org role model (design page, D6) is expressed.
- **Versioning.** The model carries a `contractVersion`; a client that does not understand it refuses cleanly. This is the UI-side twin of the versioned-BLL requirement (D3).

## Angular side (deliberately small)

- `EntityForm` (exists) renders `schema.fields` + `entity.values`, typed controls (date picker for `date`, checkbox for `bool`, number input, `isReadOnly` honoured), shows server field errors.
- `EntityGrid` (new): renders a grid model, emits `select`, `page`, `sort`, `add`, `delete` events; knows nothing about what a row is.
- `EntityScreen` (new): a route-driven container: takes a link, fetches the model, renders form + relation grids, follows links on events. One screen component for every entity.
- One thin `ApiClient`. No per-entity services, models or components; the existing `ProfileService` becomes "fetch this link".
- Auth stays as is (JWT interceptor, guard). Role-aware navigation later comes from a server-supplied menu model, not client role checks.

## Staging (each stage reviewable on its own)

1. **Field metadata and permissions** (label, read-only, order, `canUpdate`/`canDelete`), typed controls in `EntityForm`. Smallest step; improves the live profile page.
2. **Grid contract** with server-side paging/sorting; `EntityGrid`; Admin > Users list on it.
3. **Relations**: schema relationship types, parent/child, the Users → Roles screen. First real test of the contract; also where the Tenant/Org role design is settled.
4. **Role-based field filtering** at materialisation.
5. Then the BlogEngine entity set (Posts, Pages, Categories, Tags, Comments, Settings) as schemas only, per the design page, with no new client code.

## Decisions (2026-10-11)

### 1. Relationships in the N-Quad schema

The human delegated this, ranking **query performance first, then standards, then complexity**. Decision: **a relationship is a plain quad between the two entities' subjects; there is no join entity unless the link itself carries data.**

- **One-to-many (parent/child):** the pointer lives on the **child**: `(child, parent-predicate, parent)`. Page → parent Page, Comment → Post, Post → Blog. The children of P are one reverse lookup, `predicate = X AND object = P`. No multi-valued field grows on the parent, and moving a child is one superseded quad plus one new quad.
- **Many-to-many without data** (Post ↔ Tag, Post ↔ Category): one quad per link, stored on the owning side; the other direction is the same reverse lookup.
- **Many-to-many with data** (User ↔ Role *scoped to a Tenant or Org*, the design page's role model): an explicit association entity (`RoleAssignment`: User, Role, Scope), because the scope is data about the link. This is the only case that needs one.
- **Schema syntax:** a field of type `ref:<Schema>` (one) or `refs:<Schema>` (many) holds the pointer; the *inverse* side (the parent's children) is a **computed** relation `children:<Schema>.<Field>` that is never stored. The presenter discovers parent/child structure from the schema, the way it discovers fields.
- **Why this wins on the ranked criteria:** *Performance:* both directions are single index seeks, `(subject, predicate)` forward and `(predicate, left(object, 255))` reverse. Both indexes now exist (`NpgsqlNQuadStore`); a reified relationship entity costs an extra hop and two or three extra quads per link, on every read of the relation. *Standards:* a quad whose object is another subject is exactly an RDF object property, and it maps one to one onto BlogEngine's foreign-key columns (`ParentID` and the like), which the migration needs. *Complexity:* fewest moving parts; the association entity appears only where data demands it.
- **Not yet decided:** the exact predicate IRIs, and how a computed `children:` relation declares its page size and sort.

### 2. List-visible columns

A **visibility flag on the schema field** (`isListVisible`, sent with every field of a grid's schema). A gear icon on a grid lists all available columns with their types and a toggle each; the toggle starts from the flag. Per-user overrides are a later, separate piece (a stored per-user column preference); the server-computed default comes first.

### 3. Menu and navigation

Deferred until the Users and Roles work is complete; it is driven by the Admin > Content > Pages work and is its own phase. Brief recorded from the human so it is not lost:

- No hardcoded pages (BlogEngine hardcodes Home, Contact and Disclaimer). A page such as Contact is not shown unless it has been configured and validated; by default it is a dead page.
- The Home link appears only if a Page is pinned as Home **or** at least one post exists (BlogEngine's existing logic).
- A page's "show in list" flag puts it in the menu; its parent/child hierarchy produces menus and submenus; one page can be pinned as the Home page, otherwise the blog posts are the main page.
- Before that phase starts, Claude reviews how BlogEngine's Page editor manages those fields (list visibility, hierarchy, pin as Home versus posts as the main page).
