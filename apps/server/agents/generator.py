"""
Agent 4: 代码生成（LLM - DeepSeek-V3）+ 反幻觉 Prompt

Prompt 模板集中在 prompts/ 模块中管理。
"""
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from services.llm import code_llm
from prompts.anti_hallucination import ANTI_HALLUCINATION_PROMPT
from prompts.generation import build_code_generation_prompt


@tool
def generate_page_code(dsl_with_docs: str, framework: str) -> str:
    """
    根据 DSL + 组件文档生成完整页面代码。
    输入: 带文档的 DSL JSON + 目标框架
    输出: 完整代码
    """
    prompt = build_code_generation_prompt(
        dsl_with_docs=dsl_with_docs,
        framework=framework,
        anti_hallucination_prompt=ANTI_HALLUCINATION_PROMPT,
    )
    response = code_llm.invoke([HumanMessage(content=prompt)])
    return response.content
