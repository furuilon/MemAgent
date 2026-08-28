import json
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..memory import store
from . import orchestrator

router = APIRouter(prefix="/api")


class TaskRequest(BaseModel):
    task: str = Field(min_length=2)
    session_id: str | None = None
    use_memory: bool = True
    persist: bool = True


class FeedbackRequest(BaseModel):
    task_text: str
    original_output: str
    edited_output: str = ""
    comment: str = ""


class MemoryRequest(BaseModel):
    type: str = "preference"
    content: str = Field(min_length=4)
    scope: list[str] = Field(default_factory=lambda: ["general"])
    confidence: float = 0.9


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/task/stream")
async def task_stream(req: TaskRequest):
    async def gen():
        async for event in orchestrator.event_stream(
            req.task,
            use_memory=req.use_memory,
            session_id=req.session_id,
            persist=req.persist,
        ):
            yield _sse(event)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/task")
async def task(req: TaskRequest):
    return await orchestrator.run_task(
        req.task, use_memory=req.use_memory, session_id=req.session_id, persist=req.persist
    )


@router.post("/feedback")
async def feedback(req: FeedbackRequest):
    return await orchestrator.handle_feedback(
        task_text=req.task_text,
        original_output=req.original_output,
        edited_output=req.edited_output,
        comment=req.comment,
    )


@router.get("/memories")
async def get_memories(scope: str | None = None):
    return {"memories": store.list_memories(scope=scope)}


@router.post("/memories")
async def create_memory(req: MemoryRequest):
    from ..memory import retriever

    dup = retriever.find_most_similar(req.content)
    if dup:
        store.update_memory(dup["id"], confidence=min(1.0, float(dup.get("confidence") or 0.8) + 0.05))
        memory = {**dup, "status": "merged", "scope": retriever.parse_scope(dup.get("scope"))}
        return memory
    memory = store.add_memory(req.type, req.content, scope=req.scope, confidence=req.confidence)
    memory["status"] = "new"
    return memory


@router.delete("/memories/{memory_id}")
async def remove_memory(memory_id: str):
    ok = store.delete_memory(memory_id)
    return {"ok": ok}


@router.get("/memory-events")
async def get_memory_events(limit: int = 200):
    from ..db import query_all

    rows = query_all(
        "SELECT e.id, e.memory_id, e.kind, e.detail, e.created_at, m.content"
        " FROM memory_events e LEFT JOIN memories m ON m.id = e.memory_id"
        " ORDER BY e.id DESC LIMIT ?",
        (min(max(limit, 1), 500),),
    )
    return {"events": rows}


@router.post("/memory-summary")
async def memory_summary():
    from ..llm.client import LLMError
    from ..llm.factory import get_client

    TYPE_LABEL = {"rule": "硬性规则", "preference": "风格偏好", "experience": "经验"}
    mems = store.list_memories()
    if not mems:
        return {"ok": True, "summary": "还没有任何记忆。给它一次反馈，它就会开始学习你的习惯。", "count": 0}
    rules = "\n".join(
        f"- {m['content']}（{TYPE_LABEL.get(m['type'], m['type'])}）" for m in mems[:20]
    )
    system = "你是 MemAgent 的自我介绍模块。根据给定的记忆规则列表，用两到三句自然、略带温度的中文，向用户总结你学到了关于他/她的什么习惯。不要罗列条目，不要夸奖用户，直接说'我记住了…''我知道了…'这类口吻。"
    user = f"记忆规则列表：\n{rules}"
    try:
        text = await get_client("generate").chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            purpose="summary",
            temperature=0.6,
        )
    except LLMError:
        text = "我记住了这些偏好：" + "；".join(m["content"] for m in mems[:8]) + "。"
    return {"ok": True, "summary": text.strip(), "count": len(mems)}


@router.get("/reports")
async def list_reports():
    from ..db import query_all

    rows = query_all("SELECT id, title, created_at, memories_applied FROM reports ORDER BY created_at DESC, id DESC LIMIT 50")
    return {"reports": rows}


class EvalRequest(BaseModel):
    tasks: list[str] | None = None


@router.post("/eval/run")
async def eval_run(req: EvalRequest | None = None):
    import asyncio

    from ..eval.ab_test import run_ab_test

    tasks = req.tasks if req else None
    result = await asyncio.wait_for(run_ab_test(tasks), timeout=600)
    return {"ok": True, **result}


@router.get("/eval/latest")
async def eval_latest():
    from ..eval.ab_test import latest_report

    report = latest_report()
    return {"report": report}
