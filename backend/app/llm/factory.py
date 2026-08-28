from ..config import settings
from ..providers import get_active_profile, get_model_overrides
from .client import LLMClient
_client_cache: dict[tuple[str, str, str], LLMClient] = {}


def _base_config() -> tuple[str, str, str]:
    profile = get_active_profile()
    if profile and profile["base_url"]:
        return (
            profile["base_url"],
            profile["api_key"] or "not-configured",
            profile["model"] or settings.llm_model,
        )
    return (
        settings.llm_base_url,
        settings.llm_api_key or "not-configured",
        settings.llm_model,
    )


def get_client(purpose: str | None = None) -> LLMClient:
    base_url, api_key, default_model = _base_config()
    overrides = get_model_overrides()
    model = (overrides.get(purpose or "") or "").strip() or default_model
    sig = (base_url, api_key, model)
    client = _client_cache.get(sig)
    if client is None:
        client = LLMClient(base_url=sig[0], api_key=sig[1], model=sig[2])
        if len(_client_cache) >= 8:
            _client_cache.clear()
        _client_cache[sig] = client
    return client


def reset_client() -> None:
    _client_cache.clear()


def resolve_model(purpose: str | None = None) -> str:
    _url, _key, default_model = _base_config()
    overrides = get_model_overrides()
    return (overrides.get(purpose or "") or "").strip() or default_model
