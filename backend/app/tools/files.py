import asyncio
import os
from pathlib import Path
from typing import Any

from ..config import WORKSPACE_DIR, settings
from ..db import execute, query_one

WORKSPACE = WORKSPACE_DIR

MODE_KEY = "file_access_mode"
SANDBOX_MODE = "sandbox"
FULL_MODE = "full"

DANGER_DIRS = {
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "$recycle.bin",
    "system volume information",
    "appdata",
}


def get_access_mode() -> str:
    row = query_one("SELECT value FROM app_settings WHERE key = ?", (MODE_KEY,))
    return FULL_MODE if row and row["value"] == FULL_MODE else SANDBOX_MODE


def set_access_mode(mode: str) -> None:
    value = FULL_MODE if mode == FULL_MODE else SANDBOX_MODE
    execute(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)"
        " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (MODE_KEY, value),
    )


def _resolve(raw: str) -> Path:
    text = (raw or ".").strip().strip('"').strip("'").strip()
    if not text:
        text = "."
    candidate = Path(text)
    target = candidate if candidate.is_absolute() else WORKSPACE / candidate
    target = Path(os.path.normpath(str(target)))
    if get_access_mode() == SANDBOX_MODE:
        root = WORKSPACE.resolve()
        resolved = target.resolve()
        if resolved != root and root not in resolved.parents:
            raise ValueError("当前为沙箱模式，只能访问 workspace/ 目录。可在设置中开启本机访问。")
        return resolved
    return target


def _guard_mutation(target: Path) -> None:
    if get_access_mode() != FULL_MODE:
        return
    parts = {p.lower().strip() for p in target.parts}
    if parts & DANGER_DIRS:
        raise ValueError(f"拒绝操作受保护目录: {target}")
    if target == target.anchor:
        raise ValueError("拒绝操作磁盘根目录")


def _display(target: Path) -> str:
    try:
        return str(target.relative_to(WORKSPACE)).replace("\\", "/")
    except ValueError:
        return str(target)


def _is_hidden(child: Path) -> bool:
    return child.name.startswith(".") or child.name.lower() in {
        "$recycle.bin",
        "system volume information",
        "__pycache__",
        "desktop.ini",
        "thumbs.db",
    }


async def list_files(path: str = ".") -> dict[str, Any]:
    target = _resolve(path)
    if not target.exists():
        raise FileNotFoundError(f"目录不存在: {_display(target)}")
    if not target.is_dir():
        target = target.parent

    dirs: list[dict[str, Any]] = []
    files: list[dict[str, Any]] = []
    try:
        children = sorted(target.iterdir(), key=lambda c: (c.is_file(), c.name.lower()))
    except PermissionError:
        children = []
    for child in children:
        if _is_hidden(child):
            continue
        try:
            if child.is_dir():
                dirs.append({"name": child.name, "path": _display(child)})
            else:
                files.append(
                    {
                        "path": _display(child),
                        "size_bytes": child.stat().st_size,
                        "ext": child.suffix.lstrip(".").lower(),
                    }
                )
        except OSError:
            continue
        if len(dirs) + len(files) >= 300:
            break

    mode = get_access_mode()
    return {
        "mode": mode,
        "cwd": _display(target),
        "sandbox_root": str(WORKSPACE),
        "dirs": dirs,
        "files": files,
    }


async def read_file(path: str) -> dict[str, Any]:
    target = _resolve(path)
    if not target.is_file():
        raise FileNotFoundError(f"文件不存在: {_display(target)}")
    data = target.read_bytes()
    truncated = len(data) > 60000
    text = data[:60000].decode("utf-8", errors="replace")
    return {
        "path": _display(target),
        "size_bytes": len(data),
        "truncated": truncated,
        "content": text,
    }


async def write_file(path: str, content: str, mode: str = "overwrite") -> dict[str, Any]:
    target = _resolve(path)
    _guard_mutation(target)
    existed = target.is_file()
    target.parent.mkdir(parents=True, exist_ok=True)
    if mode == "append":
        with target.open("a", encoding="utf-8") as f:
            f.write(content)
    else:
        target.write_text(content, encoding="utf-8")
    return {
        "path": _display(target),
        "action": "appended" if mode == "append" else ("updated" if existed else "created"),
        "size_bytes": target.stat().st_size,
    }


async def delete_file(path: str) -> dict[str, Any]:
    target = _resolve(path)
    _guard_mutation(target)
    if target == WORKSPACE.resolve():
        raise ValueError("不能删除工作区根目录")
    if not target.is_file():
        raise FileNotFoundError(f"文件不存在: {_display(target)}")
    target.unlink()
    return {"path": _display(target), "deleted": True}


async def search_files(keyword: str, subdir: str = ".") -> list[dict[str, Any]]:
    root = _resolve(subdir)
    if not root.is_dir():
        raise FileNotFoundError(f"目录不存在: {_display(root)}")
    hits: list[dict[str, Any]] = []
    visited = 0
    for p in root.rglob("*"):
        if not p.is_file() or _is_hidden(p):
            continue
        visited += 1
        if visited > 2000 or len(hits) >= 50:
            break
        try:
            if p.stat().st_size > 1_000_000:
                continue
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for no, line in enumerate(lines, start=1):
            if keyword in line:
                hits.append({"path": _display(p), "line": no, "text": line.strip()[:200]})
    return hits


async def list_drives() -> list[dict[str, Any]]:
    if os.name != "nt":
        return [{"name": "/", "path": "/"}]
    import string

    drives = []
    for letter in string.ascii_uppercase:
        root = f"{letter}:\\"
        if Path(root).exists():
            drives.append({"name": f"{letter}:", "path": root})
    return drives


QUICK_FOLDER_CANDIDATES: list[tuple[str, str, list[str]]] = [
    ("桌面", "desktop", ["Desktop", "OneDrive/Desktop", "OneDrive/桌面"]),
    ("文档", "documents", ["Documents", "OneDrive/Documents", "OneDrive/文档"]),
    ("下载", "downloads", ["Downloads"]),
    ("图片", "pictures", ["Pictures", "OneDrive/Pictures", "OneDrive/图片"]),
    ("视频", "videos", ["Videos", "OneDrive/Videos"]),
    ("音乐", "music", ["Music", "OneDrive/Music"]),
]


def home_dir() -> str:
    return os.path.expanduser("~")


async def list_quick_folders() -> list[dict[str, Any]]:
    home = Path(home_dir())
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    for label, key, candidates in QUICK_FOLDER_CANDIDATES:
        for cand in candidates:
            p = home / cand
            rp = str(p.resolve())
            if p.is_dir() and rp not in seen:
                seen.add(rp)
                results.append({"label": label, "key": key, "path": _display(Path(os.path.normpath(rp)))})
                break
    return results


_picker_busy = False


async def pick_directory() -> dict[str, Any]:
    global _picker_busy
    if _picker_busy:
        return {"ok": False, "error": "已有一个选择窗口正在打开"}
    _picker_busy = True
    try:
        return await asyncio.to_thread(_run_picker)
    finally:
        _picker_busy = False


def _run_picker() -> dict[str, Any]:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        return {"ok": False, "error": "当前 Python 环境不支持系统对话框 (tkinter)"}
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        try:
            chosen = filedialog.askdirectory(title="MemAgent · 选择要打开的文件夹")
        finally:
            root.destroy()
        if not chosen:
            return {"ok": False, "canceled": True}
        normalized = Path(os.path.normpath(chosen))
        return {"ok": True, "path": _display(normalized)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def ensure_workspace() -> None:
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    readme = WORKSPACE / "README.md"
    if not readme.exists():
        readme.write_text(
            "# 工作区\n\n默认沙箱目录：Agent 的文件工具在这里读写。\n\n在设置里开启「本机访问」后，\nAgent 可以在授权范围内读写整台电脑的文件。\n",
            encoding="utf-8",
        )
    notes = WORKSPACE / "meeting-notes.md"
    if not notes.exists():
        notes.write_text(
            "# 会议纪要\n\n## 周一 · 数据中台需求评审\n- 指标看板一期范围确认，本周交付看板 MVP\n- 导出性能问题已修复，进入回归测试\n\n## 周四 · 故障复盘\n- 活动页白屏 P2 复盘完成，补充了发布前 checklist\n",
            encoding="utf-8",
        )
    todo = WORKSPACE / "todo.txt"
    if not todo.exists():
        todo.write_text("整理周报素材\n更新告警规则文档\n给增长组同步埋点修复结果\n", encoding="utf-8")
