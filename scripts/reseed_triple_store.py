"""Kill-and-fill the actively configured TripleRepository from the seed file.

Run this after changing shared/seed_data/initial_triples.json to make the
active store (whichever one TRIPLE_REPOSITORY_NAME selects - see
blogresearch/config/registrations.py) actually reflect it. Every existing
triple in that store is deleted first, then every seed triple is created
fresh - see shared.seed_data.reseed()'s docstring for why that's
necessary (seed_initial_vocabulary() can't change a value that's already
there, by design).

Usage:
    python scripts/reseed_triple_store.py            # prompts before touching a non-local store
    python scripts/reseed_triple_store.py --yes       # skips the prompt (for scripted/CI use)
"""

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Run directly as `python scripts/reseed_triple_store.py`, not as a
# package - repo root isn't on sys.path by default the way it is for
# pytest (see tests/conftest.py, which does the same fix for the same
# reason).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import shared.environment as environment
from blogresearch.config.app_settings import AppSettings
from blogresearch.config.registrations import resolve_triple_repository
from shared.seed_data import reseed


def _describe_target(settings: AppSettings) -> tuple[str, bool]:
    """Return (human-readable target description, is_local).

    is_local is a heuristic, not a guarantee - it exists to catch the
    common accidents (an unswapped Railway DATABASE_URL, a store path
    that looks like Railway's volume mount), not to be a security
    boundary. When in doubt, this errs toward is_local=False, since the
    cost of an unnecessary confirmation prompt is a keystroke and the
    cost of skipping one on a real remote store is lost data.
    """
    name = settings.triple_repository_name.strip().lower()

    if name == "postgres":
        conn_string = os.environ.get("DATABASE_URL", "")
        host = urlparse(conn_string).hostname or "(unresolved)"
        is_local = host in ("localhost", "127.0.0.1")
        return f"postgres @ {host}", is_local

    if name == "oxigraph":
        store_path = os.environ.get("OXIGRAPH_STORE_PATH")
        if not store_path:
            return "oxigraph (in-memory, unset OXIGRAPH_STORE_PATH)", True
        # Railway's volume mounts are always absolute paths (e.g.
        # /var/lib/agraph/...); local dev's OXIGRAPH_STORE_PATH in
        # .env.example is a relative path under the repo.
        is_local = not os.path.isabs(store_path)
        return f"oxigraph @ {store_path}", is_local

    return f"{name} (unrecognized)", False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt for a non-local target.",
    )
    args = parser.parse_args()

    environment.load()
    settings = AppSettings()
    description, is_local = _describe_target(settings)

    print(f"Target: {description} ({'local' if is_local else 'NOT local'})")

    if not is_local and not args.yes:
        response = input(
            "This does not look like a local store. Type 'yes' to wipe and reseed it anyway: "
        )
        if response.strip().lower() != "yes":
            print("Aborted - nothing was changed.")
            return 1

    repository = resolve_triple_repository(settings)
    before = len(repository.list())
    seeds = reseed(repository)

    print(f"Deleted {before} existing triple(s), created {len(seeds)} from the seed file.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
