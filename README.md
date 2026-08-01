# AI Research Blog

A minimal Streamlit app that proves the full pipeline works end to end: click a
button, call the Anthropic Claude API, and display the response.

## What it does

`app.py` renders a single "Say Hello" button. Clicking it sends a request to
Claude asking it to respond with exactly "Hello World", and displays whatever
Claude returns.

## Running locally

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Set your Anthropic API key as an environment variable (copy
   `.env.example` to `.env` and fill it in, or export it directly):

   ```bash
   cp .env.example .env
   # then edit .env and set ANTHROPIC_API_KEY=sk-ant-...
   export $(cat .env | xargs)
   ```

4. Run the app:

   ```bash
   streamlit run app.py
   ```

## Deploying to Railway

This repo auto-deploys to Railway from the `main` branch via the `Procfile`.
Before it will work, set `ANTHROPIC_API_KEY` as an environment variable in the
Railway project's **Variables** tab — the app reads it from the environment
and never has it hardcoded.
