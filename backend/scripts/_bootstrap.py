from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def ensure_backend_on_path() -> None:
    backend_root = str(BACKEND_ROOT)
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
