# AI Research Blog

BlogResearch is a small Streamlit application that demonstrates a provider-based architecture for a simple hello workflow. The app can use a Claude-backed provider, a DCI placeholder provider, or a PostgreSQL-backed provider depending on the configured environment.

## Current implementation

The app currently follows a lightweight MVP + DI structure:

- The Streamlit view lives in [app.py](app.py)
- The presenter layer is in [business/](business/)
- Providers are implemented in [data/](data/)
- Dependency resolution is handled by [config/container.py](config/container.py)

### What the app does today

- Renders a simple UI with an Ask button
- Resolves a presenter through the DI container
- Uses a provider to produce the response
- Supports:
  - Claude via the Anthropic API
  - A DCI fallback provider for local/testing flows
  - PostgreSQL through [data/postgres_provider.py](data/postgres_provider.py)

## Local setup

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create a local environment file and fill in the values you need:

   ```bash
   cp .env.example .env
   ```

   The app reads environment variables from the local .env file when available.

   Recommended values:
   - ANTHROPIC_API_KEY or CLAUDE_API_KEY for Claude-based runs
   - DATABASE_URL for PostgreSQL-backed runs

4. Run the app:

   ```bash
   streamlit run app.py
   ```

## Deployment note

The project is set up for Railway deployment through [Procfile](Procfile). Production secrets should be stored as environment variables in Railway rather than committed to source control.

## Architecture overview

The design is intentionally simple and extensible:

- Presentation layer: Streamlit UI in [app.py](app.py)
- Business layer: presenters in [business/](business/)
- Data layer: providers in [data/](data/)
- DI container: [config/container.py](config/container.py)

This keeps the UI independent from the underlying provider implementation and makes it easy to swap implementations without changing the presenter or view.

## Testing

The project uses pytest for automated checks.

### Run the test suite

```bash
pytest
```

### Current test coverage

The suite covers:

- Presenter behavior
- Container/provider resolution
- Environment-driven Postgres configuration
- Claude fallback behavior when no API key is available

## Integration test for PostgreSQL

There is also an integration-style test in [tests/test_container.py](tests/test_container.py) that exercises the PostgreSQL provider when DATABASE_URL is configured.

### What it does

- Connects to the configured database
- Queries the triple_store table for the fixed subjects `unit-test-1` and `unit-test-2`
- Verifies the returned rows match the expected fixture values
- Skips gracefully when DATABASE_URL is missing or the database is unavailable

This keeps the check stable even if additional rows are added to the table later.

## Project structure

```text
app.py
business/
config/
data/
tests/
```
