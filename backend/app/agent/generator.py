import json
from typing import Any

BASE_PROMPT = """你是「MemAgent」，一个能记住用户偏好的通用任务助手。

输出要求:
1. 用 Markdown 输出，直接给出成果本身，不写开场白和结束语
2. 语言精炼、以结果为导向
3. 只使用「素材」中提供的事实，不要编造数据"""

WEEKLY_ADDENDUM = """
4. 这是研发团队的周报撰写任务：结构包含 ## 本周进展、## 数据亮点、## 下周计划、## 风险与协调（内容不足的小节可省略或合并）"""

FILE_ADDENDUM = """
4. 涉及本地文件的任务：在正文末尾用 `---` 分隔，附一个「## 文件操作记录」小节，列出本次读/写/删了哪些文件"""

MAX_STR = 4000
MAX_LIST = 40
HISTORY_TURN_CAP = 1200
HISTORY_CHAR_BUDGET = 2400


def _cap(value: Any, depth: int = 0) -> Any:
    if isinstance(value, str):
        if len(value) > MAX_STR:
            return value[:MAX_STR] + f"…[已截断，原文共 {len(value)} 字符]"
        return value
    if depth >= 4:
        return "…"
    if isinstance(value, dict):
        return {k: _cap(v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        capped = [_cap(v, depth + 1) for v in value[:MAX_LIST]]
        if len(value) > MAX_LIST:
            capped.append(f"…[其余 {len(value) - MAX_LIST} 条已省略]")
        return capped
    return value


def build_messages(
    task_text: str,
    observations: dict[str, Any],
    memories: list[dict[str, Any]],
    history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    lowered = task_text.lower()
    used_tools = {k.split("#")[0] for k in observations}
    is_file_task = any(k in lowered for k in ("文件", "工作区", "workspace", "目录")) or bool(
        used_tools & {"read_file", "write_file", "delete_file", "search_files", "list_files"}
    )
    system = BASE_PROMPT
    if "get_task_records" in used_tools or any(k in task_text for k in ("周报", "工作汇报")):
        system += WEEKLY_ADDENDUM
    if is_file_task:
        system += FILE_ADDENDUM

    if memories:
        rules = "\n".join(f"- [{m['id']}] {m['content']}" for m in memories)
        system += (
            "\n\n## 用户历史偏好（必须严格遵守，直接体现在输出中，不要提及这些规则本身）\n"
            f"{rules}"
        )

    user_parts = [f"# 任务\n{task_text}"]
    if history:
        picked: list[tuple[str, str]] = []
        used = 0
        for h in reversed(history):
            role_label = "用户" if h["role"] == "user" else "助手"
            body = h["content"]
            if len(body) > HISTORY_TURN_CAP:
                body = body[:HISTORY_TURN_CAP] + f"…[已截断，原文共 {len(body)} 字符]"
            cost = len(body) + 4
            if used + cost > HISTORY_CHAR_BUDGET and picked:
                break
            picked.append((role_label, body))
            used += cost
        turns = [f"{label}: {body}" for label, body in reversed(picked)]
        user_parts.append("# 近期对话（仅供理解上下文，不要重复执行其中的任务）\n" + "\n\n".join(turns))
    user_parts.append(f"# 素材\n{json.dumps(_cap(observations), ensure_ascii=False, indent=2)}")

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n\n".join(user_parts)},
    ]
