import asyncio

from app.agent import orchestrator
from app.db import execute, query_all


def _quiet_loop():
    loop = asyncio.new_event_loop()
    loop.set_exception_handler(lambda l, ctx: None)
    return loop


class SlowFakeClient:
    async def chat(self, messages, purpose="chat", temperature=0.7, json_mode=False):
        return '{"steps": []}' if purpose == "plan" else "ok"

    async def chat_stream(self, messages, purpose="chat", temperature=0.7):
        for chunk in ["a", "b", "c", "d", "e"]:
            yield chunk


async def main() -> None:
    orch_get = orchestrator.get_client
    planner_get = orchestrator.planner.get_client
    orchestrator.get_client = lambda *a, **k: SlowFakeClient()
    orchestrator.planner.get_client = lambda *a, **k: SlowFakeClient()

    gen = orchestrator.event_stream("断开测试任务")
    sid = None
    events = []
    async for ev in gen:
        events.append(ev["type"])
        if ev["type"] == "session":
            sid = ev["data"]["session_id"]
        if ev["type"] == "delta":
            break
    await gen.aclose()

    rows = query_all("SELECT id FROM sessions WHERE id = ?", (sid,) if isinstance(sid, str) else ())
    print("events until drop:", events)
    print("ghost session remaining:", rows)
    assert rows == [], "幽灵会话未被清理!"

    execute("DELETE FROM messages")
    execute("DELETE FROM sessions")
    orchestrator.get_client = orch_get
    orchestrator.planner.get_client = planner_get
    print("DISCONNECT CLEANUP VERIFIED [OK]")


asyncio.run(main())
