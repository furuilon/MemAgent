import asyncio
import time

from app.agent import orchestrator


def _quiet_loop():
    loop = asyncio.new_event_loop()
    loop.set_exception_handler(lambda l, ctx: None)
    return loop


class FakeClient:
    async def chat(self, messages, purpose="chat", temperature=0.7, json_mode=False):
        return '{"steps": [{"tool": "get_task_records", "args": {}}, {"tool": "list_files", "args": {}}]}'

    async def chat_stream(self, messages, purpose="chat", temperature=0.7):
        yield "# done"


async def fake_run_tool(name: str, args: dict) -> dict:
    await asyncio.sleep(0.3)
    return {"tool": name}


async def run_pipeline() -> tuple[list[str], float]:
    events = []
    started = time.perf_counter()

    async def consume():
        async for ev in orchestrator.event_stream("并行测试", persist=False):
            if ev["type"] == "tool_result":
                events.append(ev["data"]["tool"])

    await consume()
    return events, time.perf_counter() - started


def main() -> None:
    orch_get = orchestrator.get_client
    planner_get = orchestrator.planner.get_client
    registry_ref = orchestrator.registry.run_tool

    orchestrator.get_client = lambda *a, **k: FakeClient()
    orchestrator.planner.get_client = lambda *a, **k: FakeClient()
    orchestrator.registry.run_tool = fake_run_tool

    loop = _quiet_loop()
    try:
        events, elapsed = loop.run_until_complete(run_pipeline())
    finally:
        loop.close()

    orchestrator.get_client = orch_get
    orchestrator.planner.get_client = planner_get
    orchestrator.registry.run_tool = registry_ref

    print("order:", repr(events))
    print(f"elapsed: {elapsed:.2f}s")
    assert events == ["get_task_records", "list_files"], f"结果顺序错乱! got={events}"
    print("PARALLEL EXECUTION VERIFIED [OK]")


main()
