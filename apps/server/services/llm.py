"""
LLM 客户端管理
"""
from langchain_openai import ChatOpenAI
from config import SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, LLM_MODEL, CODE_LLM_MODEL

# 通用 LLM（Qwen 7B）
llm = ChatOpenAI(
    model=LLM_MODEL,
    api_key=SILICONFLOW_API_KEY,
    base_url=SILICONFLOW_BASE_URL,
    temperature=0.3,
)

# 代码生成 LLM（DeepSeek-V3）
code_llm = ChatOpenAI(
    model=CODE_LLM_MODEL,
    api_key=SILICONFLOW_API_KEY,
    base_url=SILICONFLOW_BASE_URL,
    temperature=0.3,
    max_tokens=8192,
)

# 摘要 LLM（Qwen 7B, temperature=0）
summary_llm = ChatOpenAI(
    model=LLM_MODEL,
    api_key=SILICONFLOW_API_KEY,
    base_url=SILICONFLOW_BASE_URL,
    temperature=0,
)
