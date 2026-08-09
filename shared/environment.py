"""Loads environment variables from a local .env file, if present.

This has no import-time side effects - call load() explicitly, once,
at the start of the process (app.py for the running app,
tests/conftest.py for the test suite). Everything downstream
(blogresearch/config/registrations.py, the providers, and any future
app built on this shared/ layer) just reads os.environ and assumes
it's already been populated.
"""

import os
from pathlib import Path

import certifi
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
    _ensure_tls_trust_store()


def _ensure_tls_trust_store() -> None:
    """Point Python's default TLS trust store at certifi's CA bundle.

    On macOS, a python.org-installed Python's built-in
    ssl.create_default_context() trust store can be missing or stale
    root CAs - discovered concretely when connecting to Neo4j Aura,
    whose certificate chains through an SSL.com root that isn't in
    it, failing with "self-signed certificate in certificate chain"
    even though the OS's own `openssl` CLI (which uses the system
    keychain, not Python's bundled cert.pem) trusts it fine.

    Setting SSL_CERT_FILE makes every stdlib
    ssl.create_default_context() call in the process - any library
    that opens a TLS connection without supplying its own CA bundle,
    not just this app's code - use certifi's instead. Doesn't
    override a real SSL_CERT_FILE already set in the environment
    (e.g. a corporate CA setup), same override=False policy as the
    .env values loaded above.
    """
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
