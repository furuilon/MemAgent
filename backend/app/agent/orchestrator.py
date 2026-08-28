import asyncio
import re
import uuid
from typing import Any, AsyncIterator

from ..db import dumps, execute
from ..llm.client import LLMError
from ..llm.factory import get_client
from ..memory.extractor import extract_memories
from ..memory.injector import build_injection_block, get_session_history, retrieve_for_task
from ..tools import registry
from . import planner
from .generator import build_messages


def _derive_title(task_text: str, content: str) -> str:
    match = re.search(r"^\s*#\s+(.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()[:60]
    return (task_text or "未命名报告").strip()[:40]


async def event_stream(
    task_text: str,
    use_memory: bool = True,
    session_id: str | None = None,
    persist: bool = True,
) -> AsyncIterator[dict[str, Any]]:
    task_id = f"task_{uuid.uuid4().hex[:10]}"
    yield {"type": "start", "data": {"task_id": task_id}}

    created_now = False
    persisted_done = False
    if persist:
        if not session_id:
            session_id = f"sess_{uuid.uuid4().hex[:10]}"
            created_now = True
            execute(
                "INSERT INTO sessions (id, title) VALUES (?, ?)",
                (session_id, task_text.strip()[:48]),
            )
        yield {"type": "session", "data": {"session_id": session_id}}

    try:
        yield {"type": "stage", "data": "planning"}
        plan, plan_ok = await planner.make_plan(task_text)
        if not plan_ok:
            yield {"type": "warning", "data": "规划器不可用，已使用兜底方案"}
        yield {"type": "plan", "data": [s.model_dump() for s in plan.steps]}

        observations: dict[str, Any] = {}
        if plan.steps:
            yield {
                "type": "tool_start",
                "data": {"tools": [s.tool for s in plan.steps]},
            }
            pending = [
                asyncio.create_task(registry.run_tool(step.tool, step.args))
                for step in plan.steps
            ]
            for idx, (step, task) in enumerate(zip(plan.steps, pending)):
                try:
                    result = await task
                    observations[f"{step.tool}#{idx}"] = result
                    yield {"type": "tool_result", "data": {"tool": step.tool, "args": step.args, "result": result}}
                except Exception as exc:
                    observations[f"{step.tool}#{idx}"] = {"error": str(exc)}
                    yield {"type": "tool_error", "data": {"tool": step.tool, "error": str(exc)}}

        if use_memory:
            memories = retrieve_for_task(task_text)
            block, applied = build_injection_block(memories)
            yield {"type": "memories", "data": {"applied": applied, "injection_block": block}}
        else:
            applied = []
            yield {"type": "memories", "data": {"applied": [], "injection_block": ""}}

        messages = build_messages(
            task_text,
            observations,
            applied,
            history=get_session_history(session_id if persist else None),
        )

        yield {"type": "stage", "data": "generating"}
        chunks: list[str] = []
        async for delta in get_client("generate").chat_stream(messages, purpose="generate", temperature=0.6):
            chunks.append(delta)
            yield {"type": "delta", "data": delta}

        content = "".join(chunks)
        title = _derive_title(task_text, content)
        report_id = f"rpt_{uuid.uuid4().hex[:12]}"
        execute(
            "INSERT INTO reports (id, title, content, memories_applied) VALUES (?, ?, ?, ?)",
            (report_id, title, content, str([m["id"] for m in applied])),
        )
        if persist and session_id:
            execute(
                "INSERT OR IGNORE INTO sessions (id, title) VALUES (?, ?)",
                (session_id, task_text.strip()[:48]),
            )
            execute(
                "INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)",
                (session_id, task_text),
            )
            execute(
                "INSERT INTO messages (session_id, role, content, meta) VALUES (?, 'assistant', ?, ?)",
                (session_id, content, dumps({"title": title, "applied": applied})),
            )
            execute("UPDATE sessions SET updated_at = datetime('now', 'localtime') WHERE id = ?", (session_id,))
        persisted_done = True
        yield {
            "type": "done",
            "data": {
                "task_id": task_id,
                "report_id": report_id,
                "session_id": session_id,
                "title": title,
                "content": content,
                "memories_applied": applied,
            },
        }
    except LLMError as exc:
        yield {"type": "error", "data": str(exc)}
    finally:
        if persist and created_now and not persisted_done and session_id:
            execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            execute("DELETE FROM sessions WHERE id = ?", (session_id,))


async def run_task(
    task_text: str,
    use_memory: bool = True,
    session_id: str | None = None,
    persist: bool = True,
) -> dict[str, Any]:
    done: dict[str, Any] | None = None
    error: str | None = None
    async for event in event_stream(task_text, use_memory=use_memory, session_id=session_id, persist=persist):
        if event["type"] == "done":
            done = event["data"]
        elif event["type"] == "error":
            error = event["data"]
    if done is None:
        return {"ok": False, "error": error or "任务执行失败"}
    return {"ok": True, **done}


async def handle_feedback(
    task_text: str,
    original_output: str,
    edited_output: str = "",
    comment: str = "",
) -> dict[str, Any]:
    feedback_id = f"fb_{uuid.uuid4().hex[:10]}"
    try:
        memories = await extract_memories(feedback_id, task_text, original_output, edited_output, comment)
    except LLMError as exc:
        return {"ok": False, "feedback_id": feedback_id, "memories": [], "error": str(exc)}
    execute(
        "INSERT INTO feedbacks (id, task_text, original_output, edited_output, comment, extracted_ids)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (
            feedback_id,
            task_text,
            original_output,
            edited_output,
            comment,
            str([m["id"] for m in memories]),
        ),
    )
    return {"ok": True, "feedback_id": feedback_id, "memories": memories}
