import json  # noqa: F401
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import providers
from .config import BACKEND_DIR, FRONTEND_DIST, settings
from .agent.routes import router as agent_router
from .eval import tracker
from .llm.client import LLMError
from .llm.factory import get_client, reset_client
from .api.history import router as history_router
from .api.providers import router as providers_router
from .api.workspace import router as workspace_router
from .tools.files import ensure_workspace


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_workspace()
    yield


app = FastAPI(title="MemAgent", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
app.include_router(providers_router)
app.include_router(history_router)
app.include_router(workspace_router)


def _llm_status() -> dict:
    profile = providers.get_active_profile()
    if profile and profile["base_url"]:
        return {
            "configured": bool(profile.get("api_key")),
            "base_url": profile["base_url"],
            "model": profile["model"] or settings.llm_model,
            "name": profile["name"],
        }
    return {
        "configured": settings.llm_configured,
        "base_url": settings.llm_base_url,
        "model": settings.llm_model,
        "name": ".env 默认",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm": _llm_status(),
        "embedding_remote": bool(settings.embedding_model),
    }


class ChatRequest(BaseModel):
    message: str


@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        reply = await get_client().chat(
            [{"role": "user", "content": req.message}],
            purpose="connectivity_test",
            temperature=0.5,
        )
        return {"reply": reply}
    except LLMError as exc:
        return {"reply": "", "error": str(exc)}


@app.get("/api/metrics/summary")
def metrics_summary():
    return tracker.summary()


@app.get("/api/metrics/calls")
def metrics_calls(limit: int = 50):
    return tracker.recent_calls(min(max(limit, 1), 200))


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc"):
        raise HTTPException(status_code=404)
    dist = FRONTEND_DIST.resolve()
    candidate = (dist / full_path).resolve()
    try:
        inside = candidate == dist or dist in candidate.parents
    except OSError:
        inside = False
    if full_path and inside and candidate.is_file():
        return FileResponse(candidate)
    index = dist / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(
        status_code=404,
        detail="前端未构建：请先执行 cd frontend && npm run build（或使用 npm run dev 开发模式）",
    )
