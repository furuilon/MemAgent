import uuid
from typing import Any

from ..db import dumps, execute, query_all, query_one


def add_memory(
    mtype: str,
    content: str,
    scope: list[str] | None = None,
    confidence: float = 0.8,
    source_feedback_id: str | None = None,
) -> dict[str, Any]:
    mem_id = f"mem_{uuid.uuid4().hex[:10]}"
    row = {
        "id": mem_id,
        "type": mtype,
        "scope": dumps(scope or ["general"]),
        "content": content.strip(),
        "confidence": max(0.0, min(float(confidence), 1.0)),
        "source_feedback_id": source_feedback_id,
    }
    execute(
        "INSERT INTO memories (id, type, scope, content, confidence, source_feedback_id)"
        " VALUES (:id, :type, :scope, :content, :confidence, :source_feedback_id)",
        row,
    )
    return get_memory(mem_id)


def get_memory(mem_id: str) -> dict[str, Any] | None:
    return query_one("SELECT * FROM memories WHERE id = ?", (mem_id,))


def list_memories(scope: str | None = None) -> list[dict[str, Any]]:
    from .retriever import parse_scope

    rows = query_all("SELECT * FROM memories ORDER BY created_at DESC, id DESC")
    results = []
    for r in rows:
        r["scope"] = parse_scope(r.get("scope"))
        if scope and scope not in r["scope"] and "general" not in r["scope"]:
            continue
        results.append(r)
    return results


def delete_memory(mem_id: str) -> bool:
    if not get_memory(mem_id):
        return False
    execute("DELETE FROM memories WHERE id = ?", (mem_id,))
    return True


def update_memory(mem_id: str, **fields: Any) -> None:
    allowed = {"confidence", "usage_count", "last_used_at", "embedding"}
    sets = ", ".join(f"{k} = :{k}" for k in fields if k in allowed)
    if not sets:
        return
    params = {k: v for k, v in fields.items() if k in allowed}
    params["id"] = mem_id
    execute(f"UPDATE memories SET {sets} WHERE id = :id", params)


def touch_usage(mem_ids: list[str]) -> None:
    for mid in mem_ids:
        execute(
            "UPDATE memories SET usage_count = usage_count + 1,"
            " last_used_at = datetime('now', 'localtime') WHERE id = ?",
            (mid,),
        )


def log_event(memory_id: str, kind: str, detail: str | None = None) -> None:
    execute(
        "INSERT INTO memory_events (memory_id, kind, detail) VALUES (?, ?, ?)",
        (memory_id, kind, detail),
    )


def all_contents() -> list[tuple[str, str]]:
    rows = query_all("SELECT id, content FROM memories")
    return [(r["id"], r["content"]) for r in rows]
