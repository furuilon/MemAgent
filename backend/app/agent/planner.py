import json
import re
from typing import Any

from pydantic import BaseModel, Field

from ..llm.client import LLMError
from ..llm.factory import get_client
from ..tools.registry import TOOLS, tool_catalog


class Step(BaseModel):
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)


class Plan(BaseModel):
    steps: list[Step] = Field(default_factory=list)


PLAN_SYSTEM_PROMPT = """你是 Agent 的任务规划器。根据用户任务，从工具目录中选择必要的调用步骤。

工具目录:
{catalog}

要求:
1. 只输出 JSON，格式: {{"steps": [{{"tool": "工具名", "args": {{...}}}}]}}
2. 最多 3 步，按执行顺序排列
3. 无需任何工具时输出 {{"steps": []}}"""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("plan 响应中未找到 JSON")


def _fallback_plan(task_text: str) -> Plan:
    lowered = task_text.lower()
    if any(kw in task_text for kw in ("周报", "周记", "工作汇报")) or "weekly" in lowered:
        return Plan(steps=[Step(tool="get_task_records", args={"days": 7})])
    if any(kw in task_text for kw in ("文件", "工作区", "目录")) or "workspace" in lowered:
        steps: list[Step] = [Step(tool="list_files", args={})]
        if any(kw in task_text for kw in ("整理", "清单", "报告", "汇总")):
            steps.append(Step(tool="read_file", args={"path": "meeting-notes.md"}))
            steps.append(Step(tool="read_file", args={"path": "todo.txt"}))
        return Plan(steps=steps)
    return Plan()


async def make_plan(task_text: str) -> tuple[Plan, bool]:
    messages = [
        {"role": "system", "content": PLAN_SYSTEM_PROMPT.format(catalog=json.dumps(tool_catalog(), ensure_ascii=False))},
        {"role": "user", "content": task_text},
    ]
    try:
        raw = await get_client("plan").chat(messages, purpose="plan", temperature=0.1, json_mode=True)
        data = _extract_json(raw)
        plan = Plan.model_validate(data)
    except (LLMError, ValueError):
        return _fallback_plan(task_text), False
    valid_steps = [s for s in plan.steps if s.tool in TOOLS][:3]
    return Plan(steps=valid_steps), True
