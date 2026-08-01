# AGENTS.md

Context for AI agents picking up work on this repo. This is a learning
project — keep solutions simple and readable, not over-engineered.

## Project

- Repo: `BillKrat/ai-research-blog`
- Stack: Python, Streamlit (UI), Anthropic Claude API (backend logic),
  PostgreSQL (not yet wired up)
- Deploy: Railway, auto-deploys from `main` on push
- Live: https://blogresearch.net

## Workflow

Because every push to `main` triggers a live Railway deploy, feature
work happens on a branch and only gets merged to `main` (then pushed)
once it's working end to end. Commit as you go on the branch — no
need to squash or keep history tidy, this is a learning project.

The Postgres/triple-store work below lives on `feature/postgres`.

## What exists (as of this session)

- `app.py` — minimal end-to-end proof: a "Say Hello" button that calls
  Claude (`claude-opus-5`) and displays the response. Confirms the full
  pipeline (Streamlit → Claude API → Railway → custom domain) works.
- `requirements.txt` — `streamlit`, `anthropic`, `python-dotenv`, pinned
  to exact versions.
- `.env` (gitignored, local only) — holds the real `ANTHROPIC_API_KEY`.
  `.env.example` is the committed placeholder template — **never put a
  real secret in `.env.example`, only in `.env`.**
- `Procfile` — `web: streamlit run app.py --server.port $PORT --server.address 0.0.0.0`,
  Railway's standard way to run a Streamlit web service.
- `.vscode/launch.json` — debug config named "Streamlit: app.py" that
  launches via `python -m streamlit run app.py` so F5 debugging works
  correctly (a plain "Run Python File" won't work for Streamlit apps,
  and debugging whatever file happens to be the active editor tab is a
  common trap — make sure `app.py` or the right config is selected).
- Railway: `ANTHROPIC_API_KEY` is set in the Variables tab; custom
  domain `blogresearch.net` is attached and confirmed working (DNS
  propagation took a little while after adding it — that's normal).

## How the pieces fit together

- Streamlit is both "backend" and provides the "frontend," but as two
  separate things: `app.py` is a Python server process (started by
  `streamlit run`) — this is where `ANTHROPIC_API_KEY` is read and
  where the Claude API call happens, entirely server-side. The
  frontend is a pre-built JS/React app bundled inside the `streamlit`
  package itself (not something we write) that the browser loads; it
  talks back to the Python process over a WebSocket. The API key is
  never sent to or visible in the browser.
- `st.*` functions (buttons, inputs, layout, etc.) are the
  client-interaction API — each one maps to a frontend component
  Streamlit renders and wires up for you. For raw HTML/JS embedding,
  `st.markdown(..., unsafe_allow_html=True)` or
  `st.components.v1.html(...)` are the escape hatches.

## Local dev

```bash
python3 -m venv venv
source venv/bin/activate       # VS Code's integrated terminal does this automatically
                                # once "Python: Select Interpreter" points at ./venv/bin/python
pip install -r requirements.txt
streamlit run app.py           # python-dotenv's load_dotenv() picks up .env automatically
```

Debugging: use the "Streamlit: app.py" config in VS Code's Run and
Debug panel (not plain F5 on whatever file is open).

## Next session: PostgreSQL-backed triple store

**Status: design intent, discussed but not yet built.** Nothing below
is implemented — no schema, no connection code, no repository
interface. This is the plan to start from, not a spec to build
blindly; confirm details with the user as each piece gets built.

### Vision

Users design their own forms — choose fields, lay them out, and
CRUDL (Create/Read/Update/Delete/List) their own form data — without
a developer defining a fixed schema per form up front.

### Why a triple store

The user has real production experience with RDF triple stores (IRing
team, Utility Engineering / Zachry Engineering) and strong opinions
earned from it:

- **What's good:** a `(subject, predicate, object)` model is exactly
  the right fit for user-defined, schema-less forms — no migration
  needed every time someone adds a field.
- **What was bad:** the ontologies in that prior system were designed
  by architects for architects, and SPARQL was a barrier for
  developers. **This project intentionally skips SPARQL** — query the
  triple table with plain SQL instead, kept simple and
  developer-friendly.
- **Known tradeoff, scoped around deliberately:** pivoting triples
  back into rows/columns is expensive at volume (learned the hard way
  processing thousands of pump records). This project's use case —
  user-generated forms, picklists, simple record structures — is the
  low-hanging-fruit case where that cost doesn't bite. Do not reach
  for this pattern for high-volume/bulk-record use cases without
  re-evaluating.

### Data shape — two DTO types depending on content

- **Grid/tabular data** (rows of form submissions) → translate triples
  into a `pandas.DataFrame` → render/edit via Streamlit's built-in
  `st.data_editor`, which already gives an editable grid with
  add/delete-row support largely for free. This may cover most of the
  "generic UI control that renders and CRUDLs the data" requirement
  without a custom-built control.
- **Form layout metadata** (labels, field types, position on the
  form) → a lightweight dict or Pydantic model, not a DataFrame — this
  isn't tabular data, it's structural/config data describing a form.

Exact routing logic (how the app decides which DTO type applies) is
still to be worked out.

### Data-layer abstraction

The user has always used dependency injection to configure data
layers in .NET (interface + swappable implementation) and wants the
same discipline here: only the data layer should know triples exist.
Python's closest equivalent to a C# interface is `abc.ABC` +
`@abstractmethod` — more explicit/enforced than `typing.Protocol`,
which is looser (structural/duck-typed). Plan:

- Define a `FormDataRepository` abstract base class — `get`, `save`,
  `list`, `delete` (exact method signatures TBD).
- `PostgresTripleStore` is the first concrete implementation.
- Business logic and the Streamlit UI depend only on the
  `FormDataRepository` interface, never on Postgres or triples
  directly — this is the Repository pattern, and is what allows a
  different backend to be swapped in later for use cases that don't
  suit triples well (e.g. high-volume data).
- Python has no built-in DI container like .NET's; for a project this
  size, plain constructor injection (pass the repository instance in)
  is probably sufficient — a DI framework would likely be
  over-engineering here, but worth a short discussion next session
  since the user wants to learn the pattern properly.

### Still open — settle these before/while building

- Exact triple table schema (columns, types, how `object` values of
  different types — text, number, date — are stored).
- Where Postgres actually lives — Railway's own Postgres plugin is the
  natural fit given we're already deployed there (provides a
  `DATABASE_URL` env var automatically, same secret-handling pattern
  as `ANTHROPIC_API_KEY`: `.env` locally, Railway Variables in
  production, never in `.env.example`).
- `psycopg`/`psycopg2` raw queries vs. an ORM — lean toward raw
  queries for simplicity given the schema is just one triple table,
  but open to reconsidering.
- `FormDataRepository`'s exact method signatures and the DTO routing
  logic (DataFrame vs. dict/Pydantic).
- A first concrete form to build end-to-end as the proof of concept.
