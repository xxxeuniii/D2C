"""
LLM 客户端管理（带重试机制）
"""
import time
from langchain_openai import ChatOpenAI
from config import SILICONFLOW_API_KEY, SILICONFLOW_BASE_URL, LLM_MODEL, CODE_LLM_MODEL


class RetryableLLM:
    """LLM 包装器：带指数退避重试，确保即使 API 抖动也能成功"""

    def __init__(self, llm_client: ChatOpenAI, max_retries: int = 3, base_delay: float = 2.0):
        self._llm = llm_client
        self.max_retries = max_retries
        self.base_delay = base_delay

    def invoke(self, messages: list, **kwargs):
        last_error = None
        for attempt in range(self.max_retries):
            try:
                return self._llm.invoke(messages, **kwargs)
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)  # 2s, 4s, 8s
                    print(f"[LLM Retry] 第 {attempt + 1} 次失败，{delay}s 后重试... 错误: {e}")
                    time.sleep(delay)
        raise last_error  # 全部重试失败才抛出

    def __getattr__(self, name):
        return getattr(self._llm, name)


# 通用 LLM（glm-4-flash）
_llm_raw = ChatOpenAI(
    model=LLM_MODEL,
    api_key=SILICONFLOW_API_KEY,
    base_url=SILICONFLOW_BASE_URL,
    temperature=0.3,
    request_timeout=60,
    max_retries=0,  # 我们自己控制重试
)
llm = RetryableLLM(_llm_raw, max_retries=3, base_delay=2.0)

# 代码生成 LLM（glm-4-flash）
_code_llm_raw = ChatOpenAI(
    model=CODE_LLM_MODEL,
    api_key=SILICONFLOW_API_KEY,
    base_url=SILICONFLOW_BASE_URL,
    temperature=0.3,
    max_tokens=8192,
    request_timeout=120,
    max_retries=0,
)
code_llm = RetryableLLM(_code_llm_raw, max_retries=3, base_delay=3.0)

# 摘要 LLM（glm-4-flash, temperature=0）
_summary_llm_raw = ChatOpenAI(
    model=LLM_MODEL,
    api_key=SILICONFLOW_API_KEY,
    base_url=SILICONFLOW_BASE_URL,
    temperature=0,
    request_timeout=60,
    max_retries=0,
)
summary_llm = RetryableLLM(_summary_llm_raw, max_retries=2, base_delay=1.5)
