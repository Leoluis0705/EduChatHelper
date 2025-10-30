from __future__ import annotations

import os
from typing import List, Dict, Optional, Any

from dotenv import load_dotenv
from openai import OpenAI

# 加载根目录 .env
load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

if not DEEPSEEK_API_KEY:
    raise RuntimeError("DEEPSEEK_API_KEY 未配置。请在项目根目录创建 .env 并设置 DEEPSEEK_API_KEY。")

# 使用 OpenAI 兼容客户端，指定 base_url 指向 DeepSeek
client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


def chat(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
    **kwargs: Any,
) -> str:
    """
    与 DeepSeek 模型进行对话。
    :param messages: OpenAI 兼容的消息数组，例如：
                     [{"role": "system", "content": "..."},
                      {"role": "user", "content": "..."}]
    :param model: 覆盖默认模型（默认取环境变量 DEEPSEEK_MODEL 或 deepseek-chat）
    :param temperature: 采样温度
    :param max_tokens: 最多生成的 token 数
    :param top_p: nucleus sampling
    :param kwargs: 透传给 chat.completions.create 的其他参数
    :return: 模型返回的文本内容
    """
    resp = client.chat.completions.create(
        model=model or DEEPSEEK_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        **kwargs,
    )
    return resp.choices[0].message.content


if __name__ == "__main__":
    # 简单自测：确保 .env 已设置 DEEPSEEK_API_KEY
    test_messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "用一句话介绍你自己"},
    ]
    print(chat(test_messages))