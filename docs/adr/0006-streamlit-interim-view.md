# 0006. Streamlit remains an interim, dev-only View

Status: Accepted
Date: 2026-08-03

## Context

The stack decision (informed by verified research into the current
MCP ecosystem) settled on Next.js + AI SDK 7 as the eventual
production frontend, chosen specifically because AI SDK 7 has
confirmed native support for the MCP Apps extension. That doesn't mean
Streamlit needs to disappear immediately — the platform underneath it
(data layer, the triple store, the MCP server, identity/security) can
and should be built and validated before a production frontend exists
to sit on top of it, and a working UI gives a different, valuable kind
of feedback than pytest or MCP Inspector alone: a human can actually
use it.

Streamlit is already built, tested, and — as of ADR-0002/0003/0005 —
sitting behind the `IView` abstraction specifically so it can be
swapped without touching the Presenter or data layers. Reusing it
costs nothing additional. The alternative (throwaway scratch scripts,
or front-loading Next.js work before the platform exists) is strictly
worse for the stated goal of staying focused on the platform and
Python.

The risk, raised explicitly when this was proposed: "temporary" tools
have a well-documented tendency to become permanent by default when no
one writes down that they're not supposed to be.

## Decision

Streamlit remains the `IView` implementation (`StreamlitView`) while
the platform layers are built: the triple store (ADR-0004), the
Repository pattern over it (ADR-0007), identity/security (ADR-0005),
and the MCP server (ASR-003). It is **explicitly not the target
production UI** — that remains Next.js + AI SDK 7, once the platform
underneath it is far enough along to be worth a real frontend.

Open, not yet decided: whether Streamlit calls the platform in-process
(current pattern — `app.py` calling `IProvider`/`IDbProvider` directly
via the composition root) or as an HTTP client hitting the same
FastAPI/MCP endpoints Next.js will eventually use. The former is
simpler and is what exists today; the latter would mean "it works in
Streamlit" actually validates the API surface Next.js depends on,
which in-process calls do not. No need to decide this before the
FastAPI/MCP layer exists to call.

## Consequences

- A human-usable feedback loop exists alongside pytest and MCP
  Inspector while the platform is built.
- Explicit exit condition recorded here, so retiring Streamlit is a
  deliberate decision made once Next.js is ready to take over, not
  something that quietly never happens.
- `IView`/`IPresenter` were built for Streamlit's in-process
  rerun model (ADR-0002's "no distinct ViewModel" gap). That contract
  will need rework for a real Next.js client/server split — this ADR
  does not resolve that, it only formalizes when Streamlit's use ends
  relative to it.
