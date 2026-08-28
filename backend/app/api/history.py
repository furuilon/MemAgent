from fastapi import APIRouter
from pydantic import BaseModel

from ..db import execute, loads, query_all, query_one

router = APIRouter(prefix="/api/sessions")


@router.get("")
async def list_sessions():
    rows = query_all("SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 100")
    return {"sessions": rows}


@router.get("/{session_id}")
async def get_session(session_id: str):
    session = query_one(
        "SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?",
        (session_id,),
    )
    if not session:
        return {"session": None, "messages": []}
    rows = query_all(
        "SELECT id, role, content, meta, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,),
    )
    messages = []
    for r in rows:
        meta = loads(r["meta"], {})
        if not isinstance(meta, dict):
            meta = {}
        messages.append(
            {
                "id": r["id"],
                "role": r["role"],
                "content": r["content"],
                "meta": meta,
                "created_at": r["created_at"],
            }
        )
    return {"session": session, "messages": messages}


class SessionRename(BaseModel):
    title: str


@router.patch("/{session_id}")
async def rename_session(session_id: str, req: SessionRename):
    if not query_one("SELECT id FROM sessions WHERE id = ?", (session_id,)):
        return {"ok": False, "error": "会话不存在"}
    execute(
        "UPDATE sessions SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
        (req.title.strip()[:60] or "未命名对话", session_id),
    )
    return {"ok": True}


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    if not query_one("SELECT id FROM sessions WHERE id = ?", (session_id,)):
        return {"ok": False}
    execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    return {"ok": True}
