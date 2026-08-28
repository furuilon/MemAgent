import json
import time
import uuid
from typing import Any

from ..agent.orchestrator import run_task
from ..db import dumps, execute, query_one
from ..memory.injector import retrieve_for_task
from .judge import judge_compliance

DEFAULT_TASKS = [
    "帮我生成本周的工作周报",
    "根据这周的工作记录，写一份给团队看的周报",
]


def _token_snapshot() -> int:
    row = query_one("SELECT COALESCE(MAX(id), 0) AS max_id FROM llm_calls")
    return int(row["max_id"]) if row else 0


def _tokens_since(snapshot: int) -> dict[str, int]:
    row = query_one(
        "SELECT COUNT(*) AS calls,"
        " COALESCE(SUM(prompt_tokens),0) AS tokens_in,"
        " COALESCE(SUM(completion_tokens),0) AS tokens_out"
        " FROM llm_calls WHERE id > ? AND status='ok'",
        (snapshot,),
    ) or {}
    return {
        "calls": int(row.get("calls", 0)),
        "tokens_in": int(row.get("tokens_in", 0)),
        "tokens_out": int(row.get("tokens_out", 0)),
    }


async def run_ab_test(tasks: list[str] | None = None) -> dict[str, Any]:
    tasks = [t for t in (tasks or DEFAULT_TASKS) if t.strip()][:4] or DEFAULT_TASKS
    cases: list[dict[str, Any]] = []

    for task in tasks:
        applicable = retrieve_for_task(task, touch=False)
        rule_contents = [
            {"id": m["id"], "content": m["content"]} for m in applicable
        ]

        snap_a = _token_snapshot()
        t0 = time.perf_counter()
        base = await run_task(task, use_memory=False, persist=False)
        a_latency = int((time.perf_counter() - t0) * 1000)
        a_usage = _tokens_since(snap_a)

        snap_b = _token_snapshot()
        t1 = time.perf_counter()
        mem_run = await run_task(task, use_memory=True, persist=False)
        b_latency = int((time.perf_counter() - t1) * 1000)
        b_usage = _tokens_since(snap_b)

        judge_base = await judge_compliance(task, base.get("content", ""), applicable)
        judge_mem = await judge_compliance(task, mem_run.get("content", ""), applicable)

        cases.append(
            {
                "task": task,
                "applicable_memories": rule_contents,
                "baseline": {
                    "ok": base.get("ok"),
                    "usage": a_usage,
                    "latency_ms": a_latency,
                    "judge": judge_base,
                },
                "with_memory": {
                    "ok": mem_run.get("ok"),
                    "usage": b_usage,
                    "latency_ms": b_latency,
                    "applied": mem_run.get("memories_applied", []),
                    "judge": judge_mem,
                },
            }
        )

    def _avg_rate(key: str) -> float | None:
        rates = [c[key]["judge"].get("compliance_rate") for c in cases]
        rates = [r for r in rates if r is not None]
        return round(sum(rates) / len(rates), 3) if rates else None

    report: dict[str, Any] = {
        "cases": cases,
        "summary": {
            "tasks": len(cases),
            "baseline_compliance": _avg_rate("baseline"),
            "memory_compliance": _avg_rate("with_memory"),
            "baseline_avg_latency_ms": round(sum(c["baseline"]["latency_ms"] for c in cases) / len(cases)),
            "memory_avg_latency_ms": round(sum(c["with_memory"]["latency_ms"] for c in cases) / len(cases)),
            "baseline_avg_tokens_in": round(sum(c["baseline"]["usage"]["tokens_in"] for c in cases) / len(cases)),
            "memory_avg_tokens_in": round(sum(c["with_memory"]["usage"]["tokens_in"] for c in cases) / len(cases)),
        },
    }

    run_id = f"eval_{uuid.uuid4().hex[:10]}"
    execute(
        "INSERT INTO eval_runs (id, result_json) VALUES (?, ?)",
        (run_id, dumps(report)),
    )
    return {"id": run_id, **report}


def latest_report() -> dict[str, Any] | None:
    row = query_one("SELECT * FROM eval_runs ORDER BY created_at DESC, id DESC LIMIT 1")
    if not row:
        return None
    try:
        return {"id": row["id"], "created_at": row["created_at"], **json.loads(row["result_json"])}
    except ValueError:
        return None
