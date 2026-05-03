"""独立后端维护脚本共用的 import 引导逻辑。"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def ensure_backend_on_path() -> None:
    backend_root = str(BACKEND_ROOT)
    # 这些脚本不通过包入口运行,所以在直接 import app 模块之前
    # 把 backend 根目录加到最前面
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)
