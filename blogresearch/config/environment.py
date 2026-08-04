"""Loads environment variables from a local .env file, if present.

This has no import-time side effects - call load() explicitly, once,
at the start of the process (app.py for the running app,
tests/conftest.py for the test suite). Everything downstream
(blogresearch/config/registrations.py, the providers) just reads
os.environ and assumes it's already been populated.
"""

from pathlib import Path

from dotenv import find_dotenv, load_dotenv

_REPO_ROOT = Path(__file__).resolve().parents[1]


def load() -> None:
    """Load .env into the process environment.

    Idempotent and safe to call more than once: python-dotenv does not
    override a variable that's already set (override=False), so a
    real environment variable - e.g. one set in Railway - always wins
    over whatever is in .env.
    """
    env_path = find_dotenv(usecwd=True) or str(_REPO_ROOT / ".env")
    load_dotenv(dotenv_path=env_path, override=False)
