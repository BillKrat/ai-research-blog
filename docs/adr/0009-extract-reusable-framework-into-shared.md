# 0009. Extract the reusable framework into shared/, superseding ADR-0004's extraction deferral

Status: Accepted
Date: 2026-08-04

## Context

ADR-0004 deferred packaging/extraction into a standalone reusable
library until a second real consumer app existed, reasoning that the
framework needed room to evolve and settle before its boundary could
be trusted. Since then, MVPVM (ADR-0002), the split provider
interfaces (ADR-0003), the DI container (ADR-0002), and the Repository
pattern (ADR-0007, ADR-0008) have all been built and exercised by two
independent features - the Hello demo and `TripleRepository` - without
the shape of any of them changing. The framework has settled.

Continuing to add app-specific and framework code side by side in
`blogresearch/` risks the outcome ADR-0004 was actually trying to
avoid by deferring: work keeps accreting onto an undifferentiated
package, and by the time a second app exists, disentangling framework
from app-specific code is a redesign, not the "mechanical extraction"
ADR-0004 promised. Sorting the boundary out now, while it's cheap, is
what keeps that promise true later.

## Decision

- **Supersede ADR-0004's "packaging/extraction... explicitly
  deferred" bullet only.** Everything else in ADR-0004 (schema-less
  triples, no SPARQL, DTO routing, `FormDataRepository`) is unaffected
  and still stands.
- Move every module with no `ai-research-blog`-specific vocabulary
  into `shared/`, alongside the existing `shared/container.py`:
  - `shared/interfaces.py` — `IView`, `IViewModel`, `IPresenter`,
    `ViewModelResolver` (the MVPVM contracts, ADR-0002).
  - `shared/exceptions.py` — `ProviderError`.
  - `shared/environment.py` — `.env` loading.
  - `shared/streamlit_view.py`, `shared/session_state_view_model.py`
    — the generic Streamlit adapters (`StreamlitView`,
    `SessionStateViewModel`); neither references this app's demo
    feature.
  - `shared/repositories/` — `Triple`, `TripleRepository`,
    `PostgresTripleRepository` (ADR-0008).
- **Leave app-specific code in `blogresearch/`:** the Hello/Custom/
  DbHello presenters, `AppSettings`, and `registrations.py` (the
  composition root is inherently app-specific by definition — it
  wires *this app's* concrete choices). ~~`IProvider`/`IDbProvider`
  and the concrete Claude/DCI/Postgres providers~~ — see the
  2026-08-04 update below; these moved too.
- This is a reorganization of existing, already-settled code — a
  move plus import fixes — not a redesign. No behavior changed; the
  full test suite passes unchanged after the move, aside from import
  paths.
- **Not packaged as an installable library yet** (still no
  `pyproject.toml` / `src/` layout). That step stays reasonably
  deferred until a second app actually needs to `pip install` this
  rather than reference it directly (copy, symlink, git submodule).
  What's resolved now is the *internal* boundary — the part that's
  expensive to fix retroactively if it's left tangled.

## Consequences

- Any future app built on this framework starts from `shared/` —
  formalizing it as an installable package is still an open, later
  decision; only the code boundary is settled now.
- `blogresearch/` is now consistently "this app's specific choices,"
  never "reusable infrastructure that happens to live here" — the
  ambiguity ADR-0004 was worried about at extraction time is resolved
  as code is written, not sorted out after the fact.
- `IProvider`/`IDbProvider` staying app-specific is a real asymmetry
  worth remembering: a second app will define its *own* provider
  interfaces shaped around its own capabilities, not reuse these two.
  What's reusable is the *pattern* — a minimal ABC per swappable
  capability, raising a shared `ProviderError`, resolved through
  `shared/container.py` — documented in ADR-0002/0003, not these two
  concrete interfaces.

**Update (2026-08-04, same day):** `blogresearch/providers/` (
`IProvider`, `IDbProvider`, `ClaudeProvider`, `DCIProvider`,
`PostgresProvider`) moved to `shared/providers/` too, on review —
they're structurally decoupled from Streamlit and blog-specific
vocabulary, same as everything else in this ADR, so the argument for
keeping them app-specific was weaker than it first looked.
`IToolProvider` (`shared/tool_provider.py` above) was folded back into
`shared/providers/interfaces.py` alongside them, since the reason it
was split out — "unlike `IProvider`/`IDbProvider`, it stays in
`shared/`" — no longer applies now that all three live in the same
place.

This does **not** mean these three are fully reusable yet, only that
they're in the right *location*. `ClaudeProvider.say_hello()` and
`DCIProvider.say_hello()` still hardcode this app's one demo prompt/
response; `PostgresProvider.get_message()` still hardcodes the
`hello_messages` fixture table. A second app can depend on `IProvider`/
`IDbProvider` and resolve concrete implementations through
`shared/container.py` today, but actually reusing these specific
classes still means generalizing their method signatures first (e.g.
`complete(prompt: str) -> str` instead of a no-arg `say_hello()`) —
that generalization is real, not-yet-done work, tracked here rather
than silently implied by the move.
