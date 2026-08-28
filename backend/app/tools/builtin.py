import uuid
from datetime import date, timedelta
from typing import Any


def _d(offset_days: int) -> str:
    return (date.today() - timedelta(days=offset_days)).isoformat()


MOCK_TASK_RECORDS: list[dict[str, str]] = [
    {"date": _d(6), "type": "commit", "project": "数据中台", "summary": "完成导出模块分页改造，接口 P95 耗时从 3.2s 降到 420ms"},
    {"date": _d(5), "type": "meeting", "project": "数据中台", "summary": "参与 Q3 需求评审，认领指标看板一期开发"},
    {"date": _d(5), "type": "commit", "project": "用户增长", "summary": "修复埋点 SDK 重复上报问题，日上报量下降 18%"},
    {"date": _d(4), "type": "doc", "project": "数据中台", "summary": "输出《实时数仓选型调研》并在组内做了分享"},
    {"date": _d(3), "type": "commit", "project": "数据中台", "summary": "看板服务接入本地缓存，命中率达 92%，峰值负载下降 40%"},
    {"date": _d(3), "type": "incident", "project": "用户增长", "summary": "活动页白屏 P2 故障 40 分钟内定位修复，产出复盘文档"},
    {"date": _d(2), "type": "commit", "project": "数据中台", "summary": "新增 5 条核心任务告警规则，覆盖 ETL 失败与延迟场景"},
    {"date": _d(1), "type": "meeting", "project": "团队", "summary": "周会同步各组进度，协调下周联调测试资源"},
    {"date": _d(0), "type": "code_review", "project": "用户增长", "summary": "Review 3 个 PR，指出列表分页越界与空态未处理两个问题"},
]


async def get_task_records(days: int = 7) -> list[dict[str, str]]:
    cutoff = (date.today() - timedelta(days=max(1, min(int(days), 30)))).isoformat()
    return [r for r in MOCK_TASK_RECORDS if r["date"] >= cutoff]


async def save_report(title: str, content: str) -> dict[str, Any]:
    from ..db import execute

    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    execute(
        "INSERT INTO reports (id, title, content) VALUES (?, ?, ?)",
        (report_id, title, content),
    )
    return {"report_id": report_id, "title": title}


async def search_memory(query: str, scope: str | None = None, top_k: int = 5) -> list[dict[str, Any]]:
    from ..memory.retriever import retrieve

    hits = retrieve(query, scope=scope, top_k=top_k)
    return [{k: m[k] for k in ("id", "type", "content", "confidence") if k in m} for m in hits]
