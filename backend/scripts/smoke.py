import asyncio
import os

from fastapi.testclient import TestClient


def _quiet_loop():
    loop = asyncio.new_event_loop()
    loop.set_exception_handler(lambda l, ctx: None)
    return loop


def main() -> None:
    from app.main import app

    c = TestClient(app)

    from app.tools.files import ensure_workspace

    ensure_workspace()

    from app.db import execute as _reset

    for _t in ("memories", "feedbacks", "reports", "llm_calls", "eval_runs", "sessions", "messages"):
        _reset(f"DELETE FROM {_t}")

    print("== 1. health ==")
    health = c.get("/api/health").json()
    assert health["status"] == "ok"
    print("   llm:", health["llm"])

    print("== 2. memory crud + retrieval ==")
    from app.memory import store
    from app.memory.retriever import retrieve

    m1 = store.add_memory("rule", "周报正文用要点列表，禁止使用表格", scope=["weekly_report"], confidence=0.9)
    m2 = store.add_memory("preference", "语气正式，避免口语化表达", scope=["weekly_report"], confidence=0.85)
    m3 = store.add_memory("preference", "简历照片右上角对齐", scope=["resume"], confidence=0.7)
    hits = retrieve("帮我生成本周的工作周报", scope="weekly_report")
    assert hits and hits[0]["content"].startswith("周报"), "检索排序异常"
    assert retrieve("改简历", scope="resume"), "简历场景未命中"
    print(f"   weekly={len(hits)} hits, resume ok")

    print("== 3. task stream (graceful without key) ==")
    r = c.post("/api/task", json={"task": "帮我生成本周的工作周报"})
    assert r.status_code == 200
    print("   no-key error surfaced:", str(r.json().get("error"))[:40])

    print("== 4. feedback endpoint ==")
    r2 = c.post(
        "/api/feedback",
        json={"task_text": "写周报", "original_output": "# 周报", "comment": "别用表格"},
    )
    assert r2.status_code == 200 and r2.json()["ok"] is True
    print("   ok")

    print("== 5. sessions lifecycle ==")
    assert c.get("/api/sessions").json()["sessions"] == []
    print("   empty ok")

    print("== 6. file access: sandbox ==")
    c.patch("/api/workspace/mode", json={"mode": "sandbox"})
    lst = c.get("/api/workspace/files").json()
    assert lst["ok"] and lst["mode"] == "sandbox"
    names = {f["path"] for f in lst["files"]}
    assert "README.md" in names, names
    blocked = c.get("/api/workspace/file", params={"path": "../../pyproject.toml"})
    assert not blocked.json()["ok"], "沙箱逃逸未被拦截!"
    outside = c.get("/api/workspace/files", params={"path": "C:/"})
    if os.name == "nt":
        assert not outside.json()["ok"], "沙箱模式下不应能列出 C:/"
    print("   escape blocked, workspace readable")

    w = c.post("/api/workspace/file", json={"path": "nested/dir/api-test.md", "content": "# hi"})
    assert w.json()["ok"] and w.json()["action"] == "created"
    sub = c.get("/api/workspace/files").json()
    assert any(d["name"] == "nested" for d in sub["dirs"]), sub["dirs"]
    sr = c.post("/api/workspace/search", json={"keyword": "hi", "subdir": "."})
    assert sr.json()["ok"] and len(sr.json()["hits"]) >= 1
    dl = c.post("/api/workspace/file/delete", json={"path": "nested/dir/api-test.md"}).json()
    assert dl["ok"]
    import shutil

    shutil.rmtree("workspace/nested", ignore_errors=True)
    print("   write/read/search/delete + nested dirs ok")

    print("== 7. file access: full mode ==")
    c.patch("/api/workspace/mode", json={"mode": "full"})
    drive = c.get("/api/workspace/files", params={"path": "C:/"}).json()
    assert drive["ok"] and len(drive["dirs"]) > 0, "本机模式应能列出磁盘"
    danger = c.post("/api/workspace/file", json={"path": "C:/Windows/evil.txt", "content": "x"})
    assert not danger.json()["ok"], "危险目录未被拦截!"
    danger_del = c.post("/api/workspace/file/delete", json={"path": "C:/Windows/win.ini"})
    assert not danger_del.json()["ok"]
    c.patch("/api/workspace/mode", json={"mode": "sandbox"})
    re_blocked = c.get("/api/workspace/file", params={"path": "C:/Windows/win.ini"})
    assert not re_blocked.json()["ok"], "切回沙箱后应重新拦截"
    print("   C:/ listed, danger blocked, sandbox restored")

    print("== 8. providers + purpose model routing ==")
    p = c.post(
        "/api/providers",
        json={"name": "T", "base_url": "https://example.com/v1", "api_key": "sk-test-abcd1234", "model": "main-model"},
    ).json()
    pid = p["profile_id"]
    view = c.get("/api/providers").json()["profiles"][0]
    assert view["has_key"] and "sk-te" in view["api_key_masked"]

    from app.llm.factory import get_client as _gc

    ov = c.put(
        "/api/providers/model-overrides",
        json={"overrides": {"plan": "cheap-planner", "judge": "strict-judge"}},
    ).json()
    assert ov["overrides"]["plan"] == "cheap-planner"
    assert _gc("plan").model == "cheap-planner", "规划模型路由未生效"
    assert _gc("generate").model == "main-model", "生成应回退默认模型"
    assert _gc("judge").model == "strict-judge"
    c.put("/api/providers/model-overrides", json={"overrides": {}})
    assert _gc("plan").model == "main-model", "清空覆盖后未回退"
    c.delete(f"/api/providers/{pid}")
    print("   masked key + per-purpose routing + fallback ok")

    print("== 9. session persistence (mock llm) ==")
    from app.agent import orchestrator

    class FakeClient:
        async def chat(self, messages, purpose="chat", temperature=0.7, json_mode=False):
            return '{"steps": []}' if purpose == "plan" else "ok"

        async def chat_stream(self, messages, purpose="chat", temperature=0.7):
            for chunk in ["# 本周总结\n\n", "- 内容A"]:
                yield chunk

    factory_ref = orchestrator.get_client
    orchestrator.get_client = lambda *a, **k: FakeClient()

    events: list[str] = []
    sid_holder = {}

    async def run():
        async for ev in orchestrator.event_stream("写一份周报"):
            events.append(ev["type"])
            if ev["type"] == "session":
                sid_holder["id"] = ev["data"]["session_id"]

    loop = _quiet_loop()
    try:
        loop.run_until_complete(run())
    finally:
        loop.close()
    orchestrator.get_client = factory_ref

    assert "session" in events and "done" in events, events
    detail = c.get(f"/api/sessions/{sid_holder['id']}").json()
    roles = [m["role"] for m in detail["messages"]]
    assert roles == ["user", "assistant"], roles
    meta = detail["messages"][-1]["meta"]
    assert meta["title"] == "本周总结", f"title regex broken: {meta['title']}"
    print("   session saved, title ok")

    c.delete(f"/api/sessions/{sid_holder['id']}")

    print("== 9.5 confidence reinforcement in ranking ==")
    weak = store.add_memory("preference", "周报里多用数据说话", scope=["weekly_report"], confidence=0.5)
    store.update_memory(m1["id"], confidence=0.99, usage_count=5)
    hits2 = retrieve("生成本周工作周报", scope="weekly_report")
    assert hits2[0]["id"] == m1["id"], "高置信记忆应排在前面"
    store.delete_memory(weak["id"])
    store.update_memory(m1["id"], confidence=0.9)
    print("   reinforced memory ranks first")

    print("== 10. eval endpoint graceful ==")
    er = c.post("/api/eval/run", json={"tasks": ["写周报"]})
    assert er.status_code == 200
    print("   status 200")

    print("== 11. memory -> prompt injection proof ==")
    captured = {}

    class CaptureClient:
        async def chat(self, messages, purpose="chat", temperature=0.7, json_mode=False):
            return '{"steps": []}' if purpose == "plan" else "ok"

        async def chat_stream(self, messages, purpose="chat", temperature=0.7):
            captured["messages"] = messages
            yield "# 周报"

    ref = orchestrator.get_client
    orchestrator.get_client = lambda *a, **k: CaptureClient()
    sid2 = {}

    async def run_proof():
        async for ev in orchestrator.event_stream("帮我写本周的工作周报"):
            if ev["type"] == "session":
                sid2["id"] = ev["data"]["session_id"]

    loop2 = _quiet_loop()
    try:
        loop2.run_until_complete(run_proof())
    finally:
        loop2.close()
    orchestrator.get_client = ref

    system_msg = next(m for m in captured["messages"] if m["role"] == "system")
    assert m1["content"] in system_msg["content"], "记忆未注入生成 prompt!"
    assert "必须严格遵守" in system_msg["content"]
    detail2 = c.get(f"/api/sessions/{sid2['id']}").json()
    meta2 = detail2["messages"][-1]["meta"]
    assert any(a["id"] == m1["id"] for a in meta2["applied"]), "applied 未持久化"
    c.delete(f"/api/sessions/{sid2['id']}")
    store.delete_memory(m1["id"])
    store.delete_memory(m2["id"])
    store.delete_memory(m3["id"])
    print("   rule text present in system prompt + applied persisted")

    print("== 12. short-term memory (session history) ==")
    from app.db import execute as _exec

    sid3 = "sess_hist01"
    _exec(
        "INSERT INTO sessions (id, title) VALUES (?, ?)",
        (sid3, "历史会话"),
    )
    _exec(
        "INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)",
        (sid3, "上周的周报主题是什么？"),
    )
    _exec(
        "INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)",
        (sid3, "# 上周周报\n\n主题：数据中台性能优化专项。UNIQUE_MARKER_42"),
    )

    captured2 = {}

    class HistoryCaptureClient:
        async def chat(self, messages, purpose="chat", temperature=0.7, json_mode=False):
            return '{"steps": []}' if purpose == "plan" else "ok"

        async def chat_stream(self, messages, purpose="chat", temperature=0.7):
            captured2["messages"] = messages
            yield "# 周报"

    ref2 = orchestrator.get_client
    orchestrator.get_client = lambda *a, **k: HistoryCaptureClient()

    async def run_hist():
        collected = []
        async for ev in orchestrator.event_stream("根据上周主题继续写这周的周报", session_id=sid3):
            collected.append(ev["type"])
        return collected

    loop3 = _quiet_loop()
    try:
        loop3.run_until_complete(run_hist())
    finally:
        loop3.close()
    orchestrator.get_client = ref2

    user_msg = next(m for m in captured2["messages"] if m["role"] == "user")
    assert "近期对话" in user_msg["content"], "历史未注入!"
    assert "UNIQUE_MARKER_42" in user_msg["content"], "历史内容缺失!"

    c.delete(f"/api/sessions/{sid3}")
    _exec("DELETE FROM messages WHERE session_id = ?", (sid3,))
    _exec("DELETE FROM sessions WHERE id = ?", (sid3,))
    print("   prior turn injected into context")

    print("== 13. e2e closed loop: task -> feedback -> memory auto-applies ==")
    import app.llm.factory as factory_mod
    import app.agent.planner as planner_mod
    import app.eval.judge as judge_mod
    from app.memory import extractor as ext_mod

    RULE_TEXT = "标题必须以【MemAgent周报】开头"
    captured3 = {}
    done_holder = {}

    class LoopClient:
        async def chat(self, messages, purpose="chat", temperature=0.7, json_mode=False):
            import json as _json

            if purpose == "plan":
                return '{"steps": []}'
            if purpose == "extract":
                return _json.dumps(
                    {
                        "memories": [
                            {
                                "type": "rule",
                                "scope": ["weekly_report"],
                                "content": RULE_TEXT,
                                "confidence": 0.95,
                            }
                        ]
                    },
                    ensure_ascii=False,
                )
            return "ok"

        async def chat_stream(self, messages, purpose="chat", temperature=0.7):
            captured3["messages"] = messages
            yield "# 周报"

    refs = {
        "factory": factory_mod.get_client,
        "orch": orchestrator.get_client,
        "planner": planner_mod.get_client,
        "judge": judge_mod.get_client,
    }

    def _patch(fake):
        factory_mod.get_client = lambda *a, **k: fake
        orchestrator.get_client = lambda *a, **k: fake
        planner_mod.get_client = lambda *a, **k: fake
        judge_mod.get_client = lambda *a, **k: fake

    _patch(LoopClient())
    sid4 = {}

    async def run_two_tasks():
        async for ev in orchestrator.event_stream("写第一份周报"):
            if ev["type"] == "session":
                sid4["id"] = ev["data"]["session_id"]
        fb = c.post(
            "/api/feedback",
            json={
                "task_text": "写第一份周报",
                "original_output": "# 周报",
                "comment": "以后标题都要加【MemAgent周报】前缀",
            },
        ).json()
        assert fb["ok"] and len(fb["memories"]) >= 1, f"反馈未沉淀记忆: {fb}"
        assert any(RULE_TEXT in m["content"] for m in fb["memories"]), "提取内容不符"

        async for ev in orchestrator.event_stream("写第二份周报", session_id=sid4["id"]):
            if ev["type"] == "done":
                done_holder["data"] = ev["data"]

    loop4 = _quiet_loop()
    try:
        loop4.run_until_complete(run_two_tasks())
    finally:
        loop4.close()

    factory_mod.get_client = refs["factory"]
    orchestrator.get_client = refs["orch"]
    planner_mod.get_client = refs["planner"]
    judge_mod.get_client = refs["judge"]

    data13 = done_holder["data"]
    applied_ids = [m["id"] for m in data13["memories_applied"]]
    new_mem_rows = [m for m in c.get("/api/memories").json()["memories"] if RULE_TEXT in m["content"]]
    assert new_mem_rows, "新记忆未入库"
    assert new_mem_rows[0]["id"] in applied_ids, f"新记忆未被自动应用: {applied_ids}"
    system_msg13 = next(m for m in captured3["messages"] if m["role"] == "system")
    assert RULE_TEXT in system_msg13["content"], "新规则未注入第二次生成的 prompt!"
    print("   task1 -> feedback -> memory distilled -> task2 auto-applied & injected")

    store.delete_memory(new_mem_rows[0]["id"])
    c.delete(f"/api/sessions/{sid4['id']}")

    _exec("DELETE FROM messages")
    _exec("DELETE FROM sessions")
    _exec("DELETE FROM reports")
    _exec("DELETE FROM feedbacks")

    print("\nALL INTEGRATION CHECKS PASSED [OK]")


if __name__ == "__main__":
    main()
