"""backend/scripts/legacy 下维护脚本用的引导辅助函数。"""

from __future__ import annotations

import sys
from pathlib import Path


def ensure_legacy_script_imports() -> None:
    scripts_dir = Path(__file__).resolve().parent.parent
    scripts_dir_text = str(scripts_dir)
    # 旧版脚本多一层目录,所以先把 backend/scripts 暴露出来,
    # 再复用共享引导来 import backend 包
    if scripts_dir_text not in sys.path:
        sys.path.insert(0, scripts_dir_text)

    from _bootstrap import ensure_backend_on_path

    ensure_backend_on_path()
