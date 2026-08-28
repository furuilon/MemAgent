import inspect
from typing import Any

from . import builtin, files

TOOLS: dict[str, dict[str, Any]] = {
    "get_task_records": {
        "description": "获取最近一段时间的工作记录（提交、会议、文档、故障处理等），用于撰写周报素材",
        "params": {
            "days": {"type": "integer", "description": "回溯天数，默认 7", "default": 7},
        },
        "func": builtin.get_task_records,
    },
    "search_memory": {
        "description": "检索用户的长期记忆/偏好规则，用于让结果符合用户习惯",
        "params": {
            "query": {"type": "string", "description": "检索查询语句"},
            "scope": {"type": "string", "description": "可选的场景过滤标签，如 weekly_report"},
            "top_k": {"type": "integer", "description": "返回条数，默认 5", "default": 5},
        },
        "func": builtin.search_memory,
    },
    "save_report": {
        "description": "将最终生成的报告保存到报告库",
        "params": {
            "title": {"type": "string", "description": "报告标题"},
            "content": {"type": "string", "description": "报告正文 Markdown"},
        },
        "func": builtin.save_report,
    },
    "list_files": {
        "description": "列出某个目录的内容（返回子目录和文件两个列表）。先用它浏览定位，再用 read_file 读取。沙箱模式下限定 workspace/，本机模式下可访问授权的任意本地目录",
        "params": {
            "path": {"type": "string", "description": "目录路径，绝对或相对 workspace，默认根目录", "default": "."},
        },
        "func": files.list_files,
    },
    "read_file": {
        "description": "读取本地文本文件内容（最大 60KB）",
        "params": {
            "path": {"type": "string", "description": "文件路径，绝对或相对 workspace"},
        },
        "func": files.read_file,
    },
    "write_file": {
        "description": "创建或更新本地文件（mode=overwrite 覆盖 / append 追加）。父目录不存在会自动创建",
        "params": {
            "path": {"type": "string", "description": "目标文件路径"},
            "content": {"type": "string", "description": "要写入的完整内容"},
            "mode": {"type": "string", "description": "overwrite 或 append，默认 overwrite", "default": "overwrite"},
        },
        "func": files.write_file,
    },
    "delete_file": {
        "description": "删除本地文件（受保护系统目录会被拒绝）",
        "params": {
            "path": {"type": "string", "description": "要删除的文件路径"},
        },
        "func": files.delete_file,
    },
    "search_files": {
        "description": "在指定目录内按关键词搜索文件内容，返回命中的行（最多 50 条）",
        "params": {
            "keyword": {"type": "string", "description": "搜索关键词"},
            "subdir": {"type": "string", "description": "搜索起始目录，默认全工作区", "default": "."},
        },
        "func": files.search_files,
    },
}


def tool_catalog() -> list[dict[str, Any]]:
    return [
        {"name": name, "description": spec["description"], "params": spec["params"]}
        for name, spec in TOOLS.items()
    ]


async def run_tool(name: str, args: dict[str, Any]) -> Any:
    spec = TOOLS.get(name)
    if spec is None:
        raise KeyError(f"未知工具: {name}")
    sig = inspect.signature(spec["func"])
    accepted = {k: v for k, v in (args or {}).items() if k in sig.parameters}
    result = spec["func"](**accepted)
    if inspect.isawaitable(result):
        result = await result
    return result
