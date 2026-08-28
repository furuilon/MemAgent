from typing import Any

from ..config import settings
from ..db import query_all
from . import retriever


def retrieve_for_task(task_text: str, touch: bool = True) -> list[dict[str, Any]]:
    scope = retriever.detect_scope(task_text)
    hits = retriever.retrieve(task_text, scope=scope, touch=touch)
    if not hits:
        hits = retriever.retrieve(task_text, scope=None, touch=touch)
    return hits


def get_session_history(session_id: str | None, limit: int = 6) -> list[dict[str, str]]:
    if not session_id:
        return []
    rows = query_all(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    )
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def build_injection_block(memories: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
    if not memories:
        return "", []
    header = "用户历史偏好（必须严格遵守，直接体现在输出中，不要提及这些规则本身）:"
    lines: list[str] = []
    applied: list[dict[str, Any]] = []
    budget = settings.memory_max_inject_tokens
    used = 6
    for idx, mem in enumerate(memories, start=1):
        line = f"{idx}. {mem['content']}"
        used += len(line) // 2 + 2
        if used > budget and lines:
            break
        lines.append(line)
        applied.append({"id": mem["id"], "content": mem["content"], "type": mem["type"]})
    if not lines:
        return "", []
    return f"## {header}\n" + "\n".join(lines), applied


__all__ = ["retrieve_for_task", "get_session_history", "build_injection_block"]
