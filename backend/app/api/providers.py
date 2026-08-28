import time
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..llm.client import LLMClient, LLMError
from ..llm.factory import reset_client
from ..providers import (
    delete_profile,
    get_active_id,
    get_model_overrides,
    get_profiles,
    public_view,
    set_active,
    set_model_overrides,
    upsert_profile,
    PURPOSES,
)

router = APIRouter(prefix="/api/providers")


class ProfileRequest(BaseModel):
    id: str | None = None
    name: str = ""
    base_url: str = ""
    api_key: str = ""
    model: str = ""


class ActivateRequest(BaseModel):
    id: str


class TestRequest(BaseModel):
    id: str | None = None
    name: str = ""
    base_url: str = ""
    api_key: str = ""
    model: str = ""


@router.get("")
async def list_providers():
    return public_view()


@router.post("")
async def save_provider(req: ProfileRequest):
    profile: dict[str, Any] = {
        "id": req.id,
        "name": req.name,
        "base_url": req.base_url,
        "api_key": req.api_key.strip(),
        "model": req.model,
    }
    profiles = upsert_profile(profile)
    reset_client()
    saved_id = req.id or profiles[-1]["id"]
    if not get_active_id():
        set_active(saved_id)
        reset_client()
    return {"ok": True, "profile_id": saved_id, "count": len(profiles)}


@router.post("/activate")
async def activate(req: ActivateRequest):
    ids = {p["id"] for p in get_profiles()}
    if req.id not in ids:
        return {"ok": False, "error": "配置不存在"}
    set_active(req.id)
    reset_client()
    return {"ok": True}


@router.get("/model-overrides")
async def get_overrides():
    from ..llm.factory import resolve_model

    overrides = get_model_overrides()
    return {
        "overrides": overrides,
        "purposes": list(PURPOSES),
        "resolved": {p: resolve_model(p) for p in PURPOSES},
    }


class OverridesRequest(BaseModel):
    overrides: dict[str, str] = {}


@router.put("/model-overrides")
async def put_overrides(req: OverridesRequest):
    cleaned = set_model_overrides(req.overrides)
    reset_client()
    return {"ok": True, "overrides": cleaned}


@router.delete("/{provider_id}")
async def remove(provider_id: str):
    ok = delete_profile(provider_id)
    if ok:
        reset_client()
    return {"ok": ok}


@router.post("/test")
async def test_provider(req: TestRequest):
    profile: dict[str, Any] | None = None
    if req.id:
        profile = next((p for p in get_profiles() if p["id"] == req.id), None)
    if profile is None:
        profile = {
            "id": f"tmp_{uuid.uuid4().hex[:6]}",
            "name": req.name or "临时配置",
            "base_url": req.base_url.strip(),
            "api_key": req.api_key.strip(),
            "model": req.model.strip(),
        }
    if not profile.get("base_url"):
        return {"ok": False, "latency_ms": 0, "error": "缺少 base_url"}
    client = LLMClient(
        base_url=profile["base_url"],
        api_key=profile.get("api_key") or "not-configured",
        model=profile.get("model") or "",
        timeout=15.0,
        max_retries=0,
    )
    started = time.perf_counter()
    try:
        reply = await client.chat(
            [{"role": "user", "content": "只回复两个字：连通"}],
            purpose="connectivity_test",
            temperature=0.0,
        )
        return {"ok": True, "latency_ms": int((time.perf_counter() - started) * 1000), "reply": reply[:50]}
    except LLMError as exc:
        return {"ok": False, "latency_ms": int((time.perf_counter() - started) * 1000), "error": str(exc)[:300]}
