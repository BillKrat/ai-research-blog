# Architecture Decision Log

Records of significant architectural decisions for this project, in
the lightweight Nygard ADR format (Context / Decision / Consequences).
[`AGENTS.md`](../../AGENTS.md) is the quick-reference surface for
setup, configuration, and current capabilities; this is where the
reasoning behind it lives.

| # | Title | Status |
|---|---|---|
| [0001](0001-branch-then-merge-workflow.md) | Branch-then-merge workflow | Accepted |
| [0002](0002-mvp-di-provider-architecture.md) | MVPVM + DI + provider-registry architecture | Accepted |
| [0003](0003-provider-interface-split.md) | Split IProvider into IProvider / IDbProvider / IToolProvider | Accepted |
| [0004](0004-triple-store-for-user-forms.md) | Postgres-backed triple store for user-defined forms | Proposed (extraction-deferral bullet superseded by 0009) |
| [0005](0005-identity-data-in-triple-store.md) | Identity, role, group, and feature data lives in the triple store | Accepted |
| [0006](0006-streamlit-interim-view.md) | Streamlit remains an interim, dev-only View | Accepted |
| [0007](0007-repository-pattern-for-domain-layer.md) | Adopt the Repository pattern for the persistence-facing domain layer | Accepted |
| [0008](0008-triple-repository-first-implementation.md) | TripleRepository: first Repository implementation, CRUDL over triple_store | Accepted |
| [0009](0009-extract-reusable-framework-into-shared.md) | Extract the reusable framework into shared/, superseding ADR-0004's extraction deferral | Accepted |

## Adding a new ADR

Copy the shape of an existing one: **Context** (what prompted this),
**Decision** (what we're doing), **Consequences** (what this costs or
unlocks). Number sequentially. Never renumber or delete a past one —
if a decision is later reversed, mark it Superseded and link to the
ADR that replaces it, rather than editing history away.
