"""
Agent 4: 代码生成（LLM - DeepSeek-V3）
"""
from langchain.tools import tool
from langchain.schema import HumanMessage
from services.llm import code_llm


@tool
def generate_page_code(dsl_with_docs: str, framework: str) -> str:
    """
    根据 DSL + 组件文档生成完整页面代码。
    输入: 带文档的 DSL JSON + 目标框架
    输出: 完整代码
    """
    prompt = f"""你是一个资深前端开发。根据以下设计 DSL 和组件文档生成完整的 {framework} 页面代码。

## DSL + 组件文档:
{dsl_with_docs[:6000]}

## 要求:
- {"Vue 2 + Options API, 使用 Element Plus 组件库" if framework == "vue2" else "React 18 + TypeScript + Hooks"}
- 暗色主题: 背景 #0D1117, 文字 #E6EDF3, 边框 rgba(255,255,255,0.1)
- 所有组件必须按 DSL 的 components 结构排列, 保持父子关系
- 组件库文档中的 API 用法严格遵循
- Tailwind CSS 处理样式
- 完整可运行的代码文件
- TypeScript 类型定义

只输出代码, 不要任何解释:"""

    response = code_llm.invoke([HumanMessage(content=prompt)])
    return response.content
