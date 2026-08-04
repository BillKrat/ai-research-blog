import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import environment as env  # noqa: E402

# Load .env once for the whole test session - this is the one place test
# code is responsible for bootstrapping the environment; application
# modules never do it as an import-time side effect.
env.load()
