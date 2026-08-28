import time
from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from ..config import settings
from ..eval.tracker import record_usage


class LLMError(Exception):
    pass


class LLMClient:
    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 180.0,
        max_retries: int = 2,
    ) -> None:
        self.base_url = base_url or settings.llm_base_url
        self.api_key = api_key or settings.llm_api_key or "not-configured"
        self.model = model or settings.llm_model
        self._client = AsyncOpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=timeout,
            max_retries=max_retries,
        )

    async def chat(
        self,
        messages: list[dict[str, str]],
        purpose: str = "chat",
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        started = time.perf_counter()
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            resp = await self._client.chat.completions.create(**kwargs)
        except Exception as exc:
            if not json_mode or not _is_unsupported_feature(exc):
                record_usage(purpose, self.model, started, None, (_flatten(messages),), status="error", error=str(exc)[:500])
                raise LLMError(f"LLM 调用失败: {exc}") from exc
            kwargs.pop("response_format", None)
            try:
                resp = await self._client.chat.completions.create(**kwargs)
            except Exception as retry_exc:
                record_usage(purpose, self.model, started, None, (_flatten(messages),), status="error", error=str(retry_exc)[:500])
                raise LLMError(f"LLM 调用失败: {retry_exc}") from retry_exc
        text = resp.choices[0].message.content or ""
        record_usage(purpose, self.model, started, resp.usage, (_flatten(messages), text))
        return text

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        purpose: str = "chat",
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        started = time.perf_counter()
        chunks: list[str] = []
        usage = None
        try:
            try:
                stream = await self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    stream=True,
                    stream_options={"include_usage": True},
                )
            except Exception as first_exc:
                if not _is_unsupported_feature(first_exc):
                    raise
                stream = await self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    stream=True,
                )
            async for part in stream:
                if getattr(part, "usage", None):
                    usage = part.usage
                if not part.choices:
                    continue
                delta = part.choices[0].delta.content or ""
                if delta:
                    chunks.append(delta)
                    yield delta
            record_usage(purpose, self.model, started, usage, (_flatten(messages), "".join(chunks)))
        except LLMError:
            raise
        except Exception as exc:
            record_usage(purpose, self.model, started, usage, (_flatten(messages), "".join(chunks)), status="error", error=str(exc)[:500])
            raise LLMError(f"LLM 流式调用失败: {exc}") from exc


def _is_unsupported_feature(exc: Exception) -> bool:
    text = str(exc).lower()
    keywords = ("stream_options", "response_format", "json_object", "unsupported", "unknown parameter", "invalid type")
    status = getattr(exc, "status_code", None)
    return any(kw in text for kw in keywords) or (status == 400 and "invalid" in text)


def _flatten(messages: list[dict[str, str]]) -> str:
    return "\n".join(m.get("content", "") for m in messages)
