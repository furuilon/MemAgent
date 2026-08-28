import json
import re
from typing import Any

from ..config import settings
from . import store


def tokenize(text: str) -> list[str]:
    text = text.lower()
    tokens = re.findall(r"[a-z0-9]+", text)
    cleaned = re.sub(r"[a-z0-9\s]+", "", text)
    tokens.extend(cleaned[i : i + 2] for i in range(len(cleaned) - 1))
    return tokens


def vec(text: str) -> dict[str, float]:
    counts: dict[str, int] = {}
    for t in tokenize(text):
        counts[t] = counts.get(t, 0) + 1
    norm = sum(x * x for x in counts.values()) ** 0.5 or 1.0
    return {k: x / norm for k, x in counts.items()}


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(t, 0.0) for t, x in a.items())


def parse_scope(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return raw
    try:
        value = json.loads(raw) if isinstance(raw, str) else []
        return value if isinstance(value, list) else []
    except (TypeError, ValueError):
        return []


def find_most_similar(content: str, threshold: float = 0.85) -> dict[str, Any] | None:
    v = vec(content)
    best: tuple[float, dict[str, Any]] | None = None
    for mem_id, text in store.all_contents():
        sim = cosine(v, vec(text))
        if best is None or sim > best[0]:
            row = store.get_memory(mem_id)
            if row:
                best = (sim, row)
    if best and best[0] >= threshold:
        return best[1]
    return None


SCOPE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("weekly_report", ("周报", "周记", "工作汇报", "weekly")),
    ("resume", ("简历", "resume", "cv")),
    ("email", ("邮件", "email", "mail", "信")),
]


def detect_scope(task_text: str) -> str | None:
    lowered = task_text.lower()
    for scope, keywords in SCOPE_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            return scope
    return None


def retrieve(query: str, scope: str | None = None, top_k: int | None = None, touch: bool = True) -> list[dict[str, Any]]:
    top_k = top_k or settings.memory_top_k
    threshold = settings.memory_sim_threshold
    qv = vec(query)
    candidates: list[tuple[float, dict[str, Any]]] = []
    for mem in store.list_memories():
        scopes = parse_scope(mem.get("scope"))
        scope_hit = 1.0 if bool(scope) and (scope in scopes or "general" in scopes) else 0.0
        sim = cosine(qv, vec(mem["content"]))
        confidence = float(mem.get("confidence") or 0.8)
        usage_boost = min(int(mem.get("usage_count") or 0), 10) * 0.004
        score = 0.55 * sim + 0.35 * scope_hit + 0.08 * confidence + usage_boost
        if scope_hit > 0 or sim >= threshold:
            candidates.append((score, mem))
    candidates.sort(key=lambda x: x[0], reverse=True)
    picked = [m for _, m in candidates[:top_k]]
    if picked and touch:
        store.touch_usage([m["id"] for m in picked])
    return picked
