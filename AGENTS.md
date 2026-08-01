# AGENTS.md

Context for AI agents working in this repository. This is a learning project, so keep changes small, readable, and easy to verify.

## Project summary

- Repository: BillKrat/ai-research-blog
- Stack: Python, Streamlit, pytest, Anthropic Claude API, PostgreSQL
- Deployment: Railway from the main branch via Procfile
- Live site: https://blogresearch.net

## Working style

- Keep solutions simple and pragmatic; do not over-engineer.
- Prefer the existing architecture patterns over introducing new frameworks.
- Make changes that are easy to understand and test.
- When adding or changing behavior, verify it with pytest or the relevant local run.
- Keep secrets out of the repository. Use .env locally and environment variables in deployment.

## Current codebase state

The app is now structured around a lightweight MVP + DI + provider model:

- Streamlit UI: app.py
- Presenter layer: business/
  - HelloPresenter
  - CustomPresenter
- Provider layer: data/
  - ClaudeProvider
  - DCIProvider
  - PostgresProvider
- Dependency resolution: config/container.py
- Tool/config selection: data/tools_provider.py

The current behavior is intentionally simple: the UI resolves a presenter through the container, and the presenter delegates to a provider.

## Architecture notes

- The view should stay focused on UI concerns and should not know about provider implementations.
- Presenters should orchestrate behavior and delegate to the injected provider.
- Providers should encapsulate external dependencies such as Claude, DCI, or PostgreSQL.
- The DI container should be the place where provider/presenter choices are resolved.

If you add a new provider, implement the provider interface and wire it through the container and tool-selection layer.

## Environment and secrets

- Local development should use .env.
- Do not commit secrets.
- .env.example is the safe template; do not place real credentials in it.
- The PostgreSQL provider reads DATABASE_URL from the environment or .env.
- The Claude provider reads ANTHROPIC_API_KEY or CLAUDE_API_KEY.

## Local development

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

If you need to debug the app, use the VS Code Streamlit launch configuration rather than running an arbitrary Python file.

## Testing

Run the test suite with:

```bash
pytest
```

The repository currently includes tests for:

- Presenter behavior
- Container/provider selection
- Environment-driven Postgres configuration
- A Postgres integration-style test that checks a fixed set of rows when DATABASE_URL is available

If a test is environment-dependent, keep it skip-safe when the required runtime is not available.

## Deployment notes

- The app is deployed via Railway using Procfile.
- Production configuration should be managed through Railway environment variables.
- Keep deployment changes minimal and compatible with the existing app structure.

## What to avoid

- Avoid introducing a heavy framework or new architecture unless the task clearly needs it.
- Avoid making the app more complex than the current MVP requires.
- Avoid hard-coding provider credentials or connection strings.
- Avoid changing the public behavior of the app without updating tests or documenting the change.
