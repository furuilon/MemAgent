import json
import re
from typing import Any

from ..llm.client import LLMError
from ..llm.factory import get_client

JUDGE_SYSTEM = """你是严格的评测员。给定一份 AI 生成的结果和若干条用户历史偏好规则，逐条判断结果是否遵守了该规则。

判定标准:
1. 只有当输出明确体现该规则时 followed 才为 true；部分遵守或无法判断一律 false
2. 与任务类型无关的规则视为不适用，followed 为 false 并在 reason 说明 not_applicable
3. 只输出 JSON: {"results": [{"id": "记忆id", "followed": true, "reason": "一句话依据"}]}"""


async def judge_compliance(task_text: str, output: str, memories: list[dict[str, Any]]) -> dict[str, Any]:
    if not memories:
        return {"applicable": 0, "followed": 0, "compliance_rate": None, "details": []}
    if not (output or "").strip():
        return {
            "applicable": len(memories),
            "followed": 0,
            "compliance_rate": None,
            "skipped": True,
            "details": [],
        }

    rules = "\n".join(f"- [{m['id']}] {m['content']}" for m in memories)
    user = f"# 任务\n{task_text}\n\n# 用户偏好规则\n{rules}\n\n# AI 输出\n{output[:3000]}"
    try:
        raw = await get_client("judge").chat(
            [
                {"role": "system", "content": JUDGE_SYSTEM},
                {"role": "user", "content": user},
            ],
            purpose="judge",
            temperature=0.0,
            json_mode=True,
        )
        data = _parse_json(raw)
        by_id = {r.get("id"): r for r in data.get("results", [])}
        details = []
        followed = 0
        for m in memories:
            r = by_id.get(m["id"], {})
            ok = bool(r.get("followed"))
            followed += int(ok)
            details.append({"id": m["id"], "rule": m["content"], "followed": ok, "reason": str(r.get("reason", ""))[:120]})
        return {
            "applicable": len(memories),
            "followed": followed,
            "compliance_rate": round(followed / len(memories), 3) if memories else None,
            "details": details,
        }
    except LLMError as exc:
        return {"applicable": len(memories), "followed": 0, "compliance_rate": None, "error": str(exc)[:200], "details": []}


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("judge 响应中未找到 JSON")
