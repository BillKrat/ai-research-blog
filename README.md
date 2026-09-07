# ai-research-blog

Fresh start. FastAPI hello-world now; TDD from the DAL up on a branch.

## Setup

```bash
uv sync
```

## Run

```bash
uv run uvicorn app:app --reload
```

Then open http://localhost:8000 — and http://localhost:8000/health.

## Test

```bash
uv run pytest
```

## Deploy

Railway builds with NIXPACKS and starts `uvicorn app:app` on `$PORT`
(see `railway.toml`). Pushing `main` deploys.
