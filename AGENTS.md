# AGENTS.md

Context for AI agents picking up work on this repo. This is a learning
project — keep solutions simple and readable, not over-engineered.

## Project

- Repo: `BillKrat/ai-research-blog`
- Stack: Python, Streamlit (UI), Anthropic Claude API (backend logic),
  PostgreSQL (not yet wired up)
- Deploy: Railway, auto-deploys from `main` on push
- Live: https://blogresearch.net

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

## Next session: PostgreSQL

Goal: stand up a PostgreSQL instance and retrieve/surface data from it
in the Streamlit app. Not yet started — no schema, no connection code,
no ORM choice made yet. Likely shape, to confirm with the user before
building:

- Where the Postgres instance lives (Railway's own Postgres plugin is
  the natural fit given we're already deployed there — provides a
  `DATABASE_URL` env var automatically, same pattern as
  `ANTHROPIC_API_KEY`).
- Whether to use a lightweight approach (`psycopg`/`psycopg2` raw
  queries) or an ORM (e.g. SQLAlchemy) — lean toward the simpler
  option given this is a learning project, unless the user wants ORM
  experience specifically.
- What data the blog actually needs to store/retrieve (schema is
  undefined — ask before designing tables).
- Same secret-handling pattern as `ANTHROPIC_API_KEY`: connection
  string goes in `.env` locally / Railway Variables in production,
  never hardcoded, never placed in `.env.example`.
