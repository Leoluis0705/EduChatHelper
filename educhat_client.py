from __future__ import annotations
import os, json, re
from typing import Any
from dotenv import load_dotenv

# 加载 .env（若存在）
load_dotenv()

TEMPERATURE = float(os.getenv("TEMPERATURE", "0.2"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "768"))

OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com/v1")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("DEEPSEEK_API_KEY", "")
OPENAI_ORG = os.getenv("OPENAI_ORG", "")
OPENAI_PROJECT = os.getenv("OPENAI_PROJECT", "")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-chat")
TIMEOUT = float(os.getenv("TIMEOUT", "120"))
RETRIES = int(os.getenv("RETRIES", "3"))
RETRY_BACKOFF = float(os.getenv("RETRY_BACKOFF", "1.2"))

# 关键配置校验
if not OPENAI_API_KEY:
    raise RuntimeError("未配置 API Key。请在 .env 中设置 OPENAI_API_KEY=你的Key（或 DEEPSEEK_API_KEY）。")

def _extract_json(text: str) -> str:
    try:
        json.loads(text); return text
    except Exception:
        pass
    m = re.search(r"\{.*\}", text, flags=re.S)
    return m.group(0) if m else text

class EduChatHTTPError(RuntimeError):
    ...

async def http_complete(system: str, user: str) -> str:
    import httpx
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

    @retry(
        reraise=True,
        stop=stop_after_attempt(RETRIES),
        wait=wait_exponential(multiplier=RETRY_BACKOFF, min=RETRY_BACKOFF, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, EduChatHTTPError)),
    )
    async def _call():
        url = f"{OPENAI_BASE_URL.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
        if OPENAI_ORG:
            headers["OpenAI-Organization"] = OPENAI_ORG
        if OPENAI_PROJECT:
            headers["OpenAI-Project"] = OPENAI_PROJECT
        payload: dict[str, Any] = {
            "model": MODEL_NAME,
            "temperature": TEMPERATURE,
            "max_tokens": MAX_TOKENS,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code == 429:
                raise EduChatHTTPError("Rate limited")
            r.raise_for_status()
            data = r.json()
            return _extract_json(data["choices"][0]["message"]["content"])

    return await _call()

class EduChatClient:
    async def acomplete(self, system: str, user: str) -> str:
        # 仅使用 HTTP（DeepSeek/OpenAI 兼容）
        return await http_complete(system, user)