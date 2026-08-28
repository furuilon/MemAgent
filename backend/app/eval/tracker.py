import time
from typing import Any

from ..db import execute, query_all, query_one


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    other = len(text) - cjk
    return max(1, int(cjk * 0.6 + other / 4))


def record_call(
    purpose: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: int = 0,
    status: str = "ok",
    error: str | None = None,
) -> None:
    execute(
        "INSERT INTO llm_calls (purpose, model, prompt_tokens, completion_tokens, latency_ms, status, error)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (purpose, model, prompt_tokens, completion_tokens, latency_ms, status, error),
    )


def record_usage(
    purpose: str,
    model: str,
    started_at: float,
    usage: Any = None,
    fallback_texts: tuple[str, ...] = (),
    status: str = "ok",
    error: str | None = None,
) -> None:
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    prompt_tokens = getattr(usage, "prompt_tokens", None) if usage else None
    completion_tokens = getattr(usage, "completion_tokens", None) if usage else None
    if prompt_tokens is None or completion_tokens is None:
        joined = "".join(fallback_texts)
        prompt_tokens = prompt_tokens or estimate_tokens(joined[: len(joined) // 2] or joined)
        completion_tokens = completion_tokens or estimate_tokens(joined[len(joined) // 2 :] if len(joined) > 1 else joined)
    record_call(purpose, model, int(prompt_tokens), int(completion_tokens), latency_ms, status, error)


def summary() -> dict[str, Any]:
    total = query_one(
        "SELECT COUNT(*) AS calls,"
        " COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,"
        " COALESCE(SUM(completion_tokens), 0) AS completion_tokens,"
        " COALESCE(AVG(latency_ms), 0) AS avg_latency_ms"
        " FROM llm_calls WHERE status='ok'"
    ) or {}
    by_purpose = query_all(
        "SELECT purpose, COUNT(*) AS calls,"
        " SUM(prompt_tokens) AS prompt_tokens,"
        " SUM(completion_tokens) AS completion_tokens,"
        " AVG(latency_ms) AS avg_latency_ms"
        " FROM llm_calls WHERE status='ok' GROUP BY purpose ORDER BY calls DESC"
    )
    errors = query_one("SELECT COUNT(*) AS n FROM llm_calls WHERE status!='ok'") or {"n": 0}
    return {
        "total": {
            "calls": total.get("calls", 0),
            "tokens_in": total.get("prompt_tokens", 0),
            "tokens_out": total.get("completion_tokens", 0),
            "avg_latency_ms": round(total.get("avg_latency_ms", 0)),
            "errors": errors.get("n", 0),
        },
        "by_purpose": by_purpose,
    }


def recent_calls(limit: int = 50) -> list[dict[str, Any]]:
    return query_all("SELECT * FROM llm_calls ORDER BY id DESC LIMIT ?", (limit,))
