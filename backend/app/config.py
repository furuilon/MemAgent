import os
import sys
from pathlib import Path

from dotenv import load_dotenv

FROZEN = bool(getattr(sys, "frozen", False))

if FROZEN:
    BACKEND_DIR = Path(sys.executable).resolve().parent
else:
    BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")

DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

WORKSPACE_DIR = DATA_DIR / "workspace"
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

_legacy_workspace = BACKEND_DIR / "workspace"
try:
    if (
        not FROZEN
        and _legacy_workspace.is_dir()
        and not any(WORKSPACE_DIR.iterdir())
    ):
        import shutil

        shutil.copytree(_legacy_workspace, WORKSPACE_DIR, dirs_exist_ok=True)
except OSError:
    pass

if FROZEN:
    _bundle_root = Path(getattr(sys, "_MEIPASS", BACKEND_DIR))
    FRONTEND_DIST = _bundle_root / "frontend_dist"
else:
    FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"


def _get(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


class Settings:
    def __init__(self) -> None:
        self.llm_base_url = _get("LLM_BASE_URL", "https://api.deepseek.com/v1")
        self.llm_api_key = _get("LLM_API_KEY")
        self.llm_model = _get("LLM_MODEL", "deepseek-chat")
        self.embedding_base_url = _get("EMBEDDING_BASE_URL") or self.llm_base_url
        self.embedding_api_key = _get("EMBEDDING_API_KEY") or self.llm_api_key
        self.embedding_model = _get("EMBEDDING_MODEL")
        self.memory_top_k = int(_get("MEMORY_TOP_K", "4"))
        self.memory_sim_threshold = float(_get("MEMORY_SIM_THRESHOLD", "0.55"))
        self.memory_max_inject_tokens = int(_get("MEMORY_MAX_INJECT_TOKENS", "300"))
        self.cors_origins = [o.strip() for o in _get("CORS_ORIGINS").split(",") if o.strip()]
        self.db_path = DATA_DIR / "memagent.db"

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key)


settings = Settings()
