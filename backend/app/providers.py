import uuid
from typing import Any

from .db import dumps, execute, loads, query_all, query_one

PROFILES_KEY = "provider_profiles"
ACTIVE_KEY = "active_provider"
OVERRIDES_KEY = "purpose_models"
PURPOSES = ("plan", "generate", "extract", "judge")


def get_model_overrides() -> dict[str, str]:
    row = query_one("SELECT value FROM app_settings WHERE key = ?", (OVERRIDES_KEY,))
    raw = loads(row["value"], {}) if row else {}
    if not isinstance(raw, dict):
        return {}
    return {k: str(v).strip() for k, v in raw.items() if k in PURPOSES and str(v).strip()}


def set_model_overrides(overrides: dict[str, str]) -> dict[str, str]:
    cleaned = {
        k: str(v).strip()
        for k, v in (overrides or {}).items()
        if k in PURPOSES and str(v).strip()
    }
    execute(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)"
        " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (OVERRIDES_KEY, dumps(cleaned)),
    )
    return cleaned


def get_profiles() -> list[dict[str, Any]]:
    row = query_one("SELECT value FROM app_settings WHERE key = ?", (PROFILES_KEY,))
    raw = loads(row["value"], []) if row else []
    profiles = []
    for p in raw if isinstance(raw, list) else []:
        if not isinstance(p, dict):
            continue
        profiles.append(
            {
                "id": p.get("id") or f"prov_{uuid.uuid4().hex[:8]}",
                "name": str(p.get("name", "")).strip() or "未命名",
                "base_url": str(p.get("base_url", "")).strip(),
                "api_key": str(p.get("api_key", "")),
                "model": str(p.get("model", "")).strip(),
            }
        )
    return profiles


def save_profiles(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = []
    for p in profiles[:20]:
        cleaned.append(
            {
                "id": p.get("id") or f"prov_{uuid.uuid4().hex[:8]}",
                "name": str(p.get("name", "")).strip() or "未命名",
                "base_url": str(p.get("base_url", "")).strip(),
                "api_key": str(p.get("api_key", "")),
                "model": str(p.get("model", "")).strip(),
            }
        )
    execute(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)"
        " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (PROFILES_KEY, dumps(cleaned)),
    )
    active = get_active_id()
    ids = {p["id"] for p in cleaned}
    if active not in ids:
        set_active(cleaned[0]["id"] if cleaned else "")
    return cleaned


def get_active_id() -> str:
    row = query_one("SELECT value FROM app_settings WHERE key = ?", (ACTIVE_KEY,))
    return str(row["value"]) if row else ""


def set_active(provider_id: str) -> None:
    execute(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)"
        " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (ACTIVE_KEY, provider_id),
    )


def get_active_profile() -> dict[str, Any] | None:
    profiles = get_profiles()
    if not profiles:
        return None
    active = get_active_id()
    for p in profiles:
        if p["id"] == active:
            return p
    return profiles[0]


def upsert_profile(profile: dict[str, Any]) -> list[dict[str, Any]]:
    profiles = get_profiles()
    pid = profile.get("id")
    if pid:
        for i, p in enumerate(profiles):
            if p["id"] == pid:
                merged = {**p, **{k: v for k, v in profile.items() if v}}
                profiles[i] = {**merged, "id": pid}
                break
        else:
            profiles.append({**profile, "id": pid})
    else:
        new_id = f"prov_{uuid.uuid4().hex[:8]}"
        profiles.append({**profile, "id": new_id})
    return save_profiles(profiles)


def delete_profile(provider_id: str) -> bool:
    profiles = get_profiles()
    remaining = [p for p in profiles if p["id"] != provider_id]
    if len(remaining) == len(profiles):
        return False
    save_profiles(remaining)
    return True


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 10:
        return key[:2] + "****"
    return f"{key[:5]}****{key[-4:]}"


def public_view() -> dict[str, Any]:
    active = get_active_id()
    return {
        "profiles": [
            {
                "id": p["id"],
                "name": p["name"],
                "base_url": p["base_url"],
                "model": p["model"],
                "api_key_masked": mask_key(p["api_key"]),
                "has_key": bool(p["api_key"]),
                "active": p["id"] == active,
            }
            for p in get_profiles()
        ],
        "model_overrides": get_model_overrides(),
    }
