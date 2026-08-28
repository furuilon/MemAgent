import json
import re
from typing import Any

from . import retriever, store

KNOWN_SCOPES = {"weekly_report", "resume", "email", "general"}
KNOWN_TYPES = {"preference", "rule", "experience"}


async def extract_memories(
    feedback_id: str,
    task_text: str,
    original_output: str,
    edited_output: str = "",
    comment: str = "",
) -> list[dict[str, Any]]:
    from ..llm.client import LLMError
    from ..llm.factory import get_client

    system = """你是偏好提取器。分析用户对 AI 生成结果的修改与反馈，蒸馏出可长期复用的记忆规则。

判断标准:
1. 只提取跨任务稳定成立的偏好或规则，忽略一次性事实（如"这周上线了某功能"）
2. 每条必须原子化、具体、可执行，例如："周报正文用要点列表，禁止表格"
3. type 取值: preference(风格偏好) / rule(硬性规则) / experience(有效经验)
4. scope 只能从这些标签中选(可多个): weekly_report, resume, email, general
5. 用户反馈没有可沉淀内容时返回空数组
6. 不要输出与已有规则重复的条目

输出 JSON: {"memories": [{"type": "...", "scope": ["..."], "content": "...", "confidence": 0.9}]}"""

    def _cut(text: str, limit: int = 1200) -> str:
        text = (text or "").strip()
        return text[:limit] + ("…" if len(text) > limit else "")

    user = (
        f"# 原始任务\n{task_text}\n\n"
        f"# AI 原始输出\n{_cut(original_output)}\n\n"
    )
    if edited_output:
        user += f"# 用户修改后的版本\n{_cut(edited_output)}\n\n"
    if comment:
        user += f"# 用户反馈说明\n{comment}\n"

    try:
        raw = await get_client("extract").chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            purpose="extract",
            temperature=0.2,
            json_mode=True,
        )
        data = _parse_json(raw)
        raw_list = data.get("memories") or []
    except (LLMError, ValueError):
        return []

    extracted: list[dict[str, Any]] = []
    for item in raw_list[:6]:
        try:
            content = str(item.get("content", "")).strip()
            if len(content) < 4:
                continue
            mtype = item.get("type", "preference")
            if mtype not in KNOWN_TYPES:
                mtype = "preference"
            scope = [s for s in (item.get("scope") or []) if s in KNOWN_SCOPES] or ["general"]
            raw_confidence = item.get("confidence", 0.8)
            if not isinstance(raw_confidence, (int, float)):
                raw_confidence = 0.8
            confidence = max(0.0, min(float(raw_confidence), 1.0))
        except (TypeError, ValueError, AttributeError):
            continue
        dup = retriever.find_most_similar(content)
        if dup:
            merged = {
                **dup,
                "confidence": round(min(1.0, float(dup.get("confidence") or 0.8) + 0.05), 2),
                "status": "merged",
                "scope": parse_scope_list(dup.get("scope")),
            }
            store.update_memory(dup["id"], confidence=merged["confidence"])
            store.log_event(dup["id"], "merged", "新反馈与已有规则相似，置信度提升")
            extracted.append(merged)
            continue
        saved = store.add_memory(mtype, content, scope=scope, confidence=confidence, source_feedback_id=feedback_id)
        store.log_event(saved["id"], "born", f"由反馈「{(comment or edited_output or task_text).strip()[:40]}」蒸馏而来")
        saved["status"] = "new"
        extracted.append(saved)
    return extracted


def parse_scope_list(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return raw
    try:
        value = json.loads(raw) if isinstance(raw, str) else []
        return value if isinstance(value, list) else []
    except ValueError:
        return []


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("extract 响应中未找到 JSON")
