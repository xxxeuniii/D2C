"""
统一 Prompt 管理中心

所有 System Prompt 和模板集中在此模块，按功能分为:
  - agent_prompts.py  : 5 个流水线 Agent 的 System Prompt + Chat Agent Prompt
  - anti_hallucination.py : 反幻觉相关的 Prompt
  - generation.py    : 代码生成 / 修改 / 验证用的 Prompt 模板
  - enhancement.py   : LLM 语义增强用的 Prompt 模板（cleaner / converter）
"""

from prompts.agent_prompts import (
    CHAT_AGENT_SYSTEM_PROMPT,
    CLEANER_PROMPT,
    CONVERTER_PROMPT,
    RETRIEVER_PROMPT,
    GENERATOR_PROMPT,
    VALIDATOR_PROMPT,
    AGENT_SYSTEM_PROMPTS,
    PIPELINE_TASKS,
)

from prompts.anti_hallucination import (
    ANTI_HALLUCINATION_PROMPT,
    CROSS_VALIDATION_PROMPT,
)

from prompts.generation import (
    build_code_generation_prompt,
    build_code_modification_prompt,
    build_code_review_prompt,
)

from prompts.enhancement import (
    build_cleaner_enhancement_prompt,
    build_converter_enhancement_prompt,
)
