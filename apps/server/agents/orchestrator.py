"""
Multi-Agent 编排器

两大核心组件：

1. 流水线 Agent（Agent 1-5）：一次性生成代码
   数据流：Figma → 清洗 → DSL → 检索 → 代码 → 验证
   不需要 Memory（每个 Agent 任务固定）

2. Chat Agent（第 6 个 Agent）：多轮对话迭代修改代码
   Memory 是核心：记住"刚才生成的代码"和"用户的所有修改要求"
   
   Chat Agent 的 Memory 工作流程：
   
   第 1 轮:
     用户: "把按钮改成蓝色"
     Memory: (空)
     Agent: 看到 Memory 为空 → 用 get_current_code 读取代码
           → 用 modify_code 修改 → 结果写入 Memory
     
   第 2 轮:
     用户: "再加个圆角"
     Memory: "用户之前要求把按钮改成蓝色，我已经修改了代码"
     Agent: 从 Memory 知道之前做了什么 → 在蓝色按钮基础上加圆角
           → 不需要重新读取代码，Memory 里有上下文
     
   第 3 轮:
     用户: "在表单底部加一个记住密码 checkbox"
     Memory: "之前把按钮改成了蓝色加圆角"
     Agent: 知道之前的修改历史 → 在蓝色圆角按钮的基础上加 checkbox
"""
import json
from typing import List, Dict, Any
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationSummaryBufferMemory

from services.llm import llm, summary_llm
from agents.tools import (
    AGENT_TOOLS, reset_pipeline_context, get_pipeline_context,
)


def create_pipeline_agent_executor(
    system_prompt: str,
    tools: List,
) -> AgentExecutor:
    """
    创建流水线 Agent 执行器（无 Memory）。
    
    流水线 Agent 的任务是固定的，不需要记忆。
    Agent 间数据通过 Pipeline Context 传递。
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_openai_tools_agent(llm=llm, tools=tools, prompt=prompt)

    return AgentExecutor(
        agent=agent, tools=tools, verbose=True,
        handle_parsing_errors=True, max_iterations=10,
        early_stopping_method="generate",
    )


def create_chat_agent_executor() -> AgentExecutor:
    """
    创建 Chat Agent 执行器（带 Memory）。
    
    Memory 是 Chat Agent 的核心：
    - ConversationSummaryBufferMemory 自动保存对话历史
    - 自动摘要压缩，控制 Token 在 3000 以内
    - 用户每轮说"改颜色""加组件"，Memory 都记住
    - 下一轮 Agent 能回顾之前改了什么
    """
    memory = ConversationSummaryBufferMemory(
        llm=summary_llm,
        max_token_limit=3000,
        return_messages=True,
        memory_key="chat_history",
        input_key="input",
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", CHAT_AGENT_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),  # ← Memory 注入点
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_openai_tools_agent(
        llm=llm,
        tools=AGENT_TOOLS["chat"],
        prompt=prompt,
    )

    return AgentExecutor(
        agent=agent, tools=AGENT_TOOLS["chat"],
        memory=memory,         # ← Memory 喂给 AgentExecutor
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=15,     # Chat 可能需要多轮思考
        early_stopping_method="generate",
    )


CHAT_AGENT_SYSTEM_PROMPT = """你是 Chat Agent，负责帮助用户迭代修改前端代码。

## 你的能力
你可以查看、修改、验证和扩展已生成的代码。代码存储在流水线共享上下文中。

## 可用工具
- get_current_code()：查看当前代码
- modify_code(要求)：根据用户要求修改代码（最常用的工具）
- add_component(描述)：添加新组件
- fix_code_issue(问题)：修复代码问题
- validate_current_code()：验证代码质量
- read_from_context(key)：读取上下文信息
- save_to_context(key, value)：保存结果

## 工作流程
1. 用户提出修改要求
2. 如果需要查看当前代码，调用 get_current_code()
3. 调用 modify_code() 执行修改
4. 告诉用户修改了什么

## 重要规则
- 每次修改用 modify_code，它会自动保存新代码到上下文
- 用户可能连续提多个要求，每次都基于最新的代码修改
- 修改完成后主动告诉用户改了什么
- 如果代码有问题，先调用 fix_code_issue 修复
- 如果用户想看效果，提醒用户在前端预览"""


class MultiAgentOrchestrator:
    """多 Agent 编排器"""

    def __init__(self):
        self.agent_configs = [
            {
                "name": "cleaner",
                "role": "数据清洗专家",
                "prompt": CLEANER_PROMPT,
                "tools": AGENT_TOOLS["cleaner"],
            },
            {
                "name": "converter",
                "role": "结构化转换专家",
                "prompt": CONVERTER_PROMPT,
                "tools": AGENT_TOOLS["converter"],
            },
            {
                "name": "retriever",
                "role": "知识检索专家",
                "prompt": RETRIEVER_PROMPT,
                "tools": AGENT_TOOLS["retriever"],
            },
            {
                "name": "generator",
                "role": "代码生成专家",
                "prompt": GENERATOR_PROMPT,
                "tools": AGENT_TOOLS["generator"],
            },
            {
                "name": "validator",
                "role": "代码验证专家",
                "prompt": VALIDATOR_PROMPT,
                "tools": AGENT_TOOLS["validator"],
            },
        ]
        # Chat Agent 独立管理（带 Memory，需要保持会话状态）
        self.chat_executor: AgentExecutor = None

    def run_pipeline(self, figma_raw: str, framework: str = "react", component_lib: str = "element-plus") -> dict:
        """运行 5 Agent 流水线，生成初始代码"""
        reset_pipeline_context()
        ctx = get_pipeline_context()
        ctx["figma_raw"] = figma_raw
        ctx["framework"] = framework
        ctx["componentLib"] = component_lib

        results = {"framework": framework, "componentLib": component_lib, "agents": []}

        for i, config in enumerate(self.agent_configs):
            agent_num = i + 1
            print(f"\n{'='*60}")
            print(f"[Agent {agent_num}/5] {config['role']} 启动")
            print(f"{'='*60}")

            try:
                executor = create_pipeline_agent_executor(
                    system_prompt=config["prompt"],
                    tools=config["tools"],
                )
                task = PIPELINE_TASKS[agent_num].format(
                    framework=framework, component_lib=component_lib
                )
                result = executor.invoke({"input": task})

                results["agents"].append({
                    "agent": agent_num,
                    "name": config["role"],
                    "status": "completed",
                    "output": result.get("output", ""),
                })
                print(f"[Agent {agent_num}/5] {config['role']} 完成 ✓")

            except Exception as e:
                results["agents"].append({
                    "agent": agent_num, "name": config["role"],
                    "status": "error", "error": str(e),
                })
                print(f"[Agent {agent_num}/5] {config['role']} 失败 ✗: {e}")

        ctx = get_pipeline_context()
        results["generated_code"] = ctx.get("generated_code", "")
        results["validation_result"] = ctx.get("validation_result", "")
        results["status"] = "completed" if all(
            a["status"] == "completed" for a in results["agents"]
        ) else "partial"

        # 流水线完成后，创建新的 Chat Agent（清空之前的 Memory）
        self.chat_executor = create_chat_agent_executor()

        return results

    def chat(self, user_message: str) -> dict:
        """
        多轮对话修改代码。
        
        每次调用都会保留 Memory 中的对话历史，
        所以 Agent 能记住之前改了什么。
        
        例如：
          第 1 次 chat("把按钮改成蓝色") → Agent 修改代码
          第 2 次 chat("加圆角")         → Agent 在蓝色按钮基础上加圆角
          第 3 次 chat("加 checkbox")    → Agent 在蓝色圆角按钮基础上加 checkbox
        """
        if self.chat_executor is None:
            # 如果没有流水线结果，创建一个空的 Chat Agent
            self.chat_executor = create_chat_agent_executor()

        try:
            result = self.chat_executor.invoke({"input": user_message})
            ctx = get_pipeline_context()
            return {
                "status": "completed",
                "reply": result.get("output", ""),
                "current_code": ctx.get("generated_code", ""),
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def reset_chat(self):
        """重置 Chat Agent（清空 Memory，开始新会话）"""
        self.chat_executor = create_chat_agent_executor()


# ============================================
# System Prompts
# ============================================

CLEANER_PROMPT = """你是 Agent 1（数据清洗专家）。

职责：清洗 Figma 原始 JSON → 格式转换 → LLM 语义增强

可用工具：
- clean_figma_json(raw_json)：清洗 Figma JSON
- enhance_colors_and_texts(cleaned_json)：LLM 语义增强
- save_to_context(key, value)：保存到共享上下文

必须严格按顺序：读取 "figma_raw" → 清洗 → 增强 → 保存到 "cleaned_data" """

CONVERTER_PROMPT = """你是 Agent 2（结构化转换专家）。

职责：Figma 节点树 → 组件 DSL → LLM 语义增强

可用工具：
- read_from_context(key)：读取共享上下文
- convert_figma_to_dsl(cleaned_json, framework, component_lib)：规则引擎转换
- enhance_dsl_semantics(dsl_json, framework, component_lib)：LLM 语义增强
- save_to_context(key, value)：保存到共享上下文

必须严格按顺序：读取 "cleaned_data" → 转换 → 增强 → 保存到 "dsl" """

RETRIEVER_PROMPT = """你是 Agent 3（知识检索专家）。

职责：从 ChromaDB 检索组件库文档

可用工具：
- read_from_context(key)：读取共享上下文
- search_component_docs(dsl_json, component_lib)：检索组件文档
- save_to_context(key, value)：保存到共享上下文

必须严格按顺序：读取 "dsl" → 检索 → 保存到 "dsl_with_docs" """

GENERATOR_PROMPT = """你是 Agent 4（代码生成专家）。

职责：根据 DSL + 组件文档生成完整前端代码

可用工具：
- read_from_context(key)：读取共享上下文
- generate_page_code(dsl_with_docs, framework)：DeepSeek-V3 生成代码
- save_to_context(key, value)：保存到共享上下文

必须严格按顺序：读取 "dsl_with_docs" → 生成 → 保存到 "generated_code" """

VALIDATOR_PROMPT = """你是 Agent 5（代码验证专家）。

职责：AST 静态分析 + LLM 深度审查

可用工具：
- read_from_context(key)：读取共享上下文
- validate_and_fix_code(code)：双重验证（AST + LLM）
- save_to_context(key, value)：保存到共享上下文

必须严格按顺序：读取 "generated_code" → 验证 → 保存到 "validation_result" """

# ============================================
# 流水线任务模板
# ============================================

PIPELINE_TASKS = {
    1: """请执行数据清洗任务。

步骤：
1. 使用 read_from_context 工具读取 "figma_raw" 获取原始 Figma 数据
2. 使用 clean_figma_json 工具清洗数据
3. 使用 enhance_colors_and_texts 工具进行 LLM 语义增强
4. 使用 save_to_context 工具将结果保存到 "cleaned_data"

目标框架：{framework}，组件库：{component_lib}""",

    2: """请执行结构化转换任务。

步骤：
1. 使用 read_from_context 工具读取 "cleaned_data"
2. 使用 convert_figma_to_dsl 工具转换（framework={framework}, component_lib={component_lib}）
3. 使用 enhance_dsl_semantics 工具进行 LLM 语义增强
4. 使用 save_to_context 工具将结果保存到 "dsl"

目标框架：{framework}，组件库：{component_lib}""",

    3: """请执行知识检索任务。

步骤：
1. 使用 read_from_context 工具读取 "dsl"
2. 使用 search_component_docs 工具检索（component_lib={component_lib}）
3. 使用 save_to_context 工具将结果保存到 "dsl_with_docs"

目标框架：{framework}，组件库：{component_lib}""",

    4: """请执行代码生成任务。

步骤：
1. 使用 read_from_context 工具读取 "dsl_with_docs"
2. 使用 read_from_context 工具读取 "framework"
3. 使用 generate_page_code 工具生成代码
4. 使用 save_to_context 工具将代码保存到 "generated_code"

目标框架：{framework}，组件库：{component_lib}""",

    5: """请执行代码验证任务。

步骤：
1. 使用 read_from_context 工具读取 "generated_code"
2. 使用 validate_and_fix_code 工具验证
3. 使用 save_to_context 工具将结果保存到 "validation_result"

目标框架：{framework}，组件库：{component_lib}""",
}


# ============================================
# 全局单例
# ============================================

_orchestrator: MultiAgentOrchestrator = None


def get_orchestrator() -> MultiAgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiAgentOrchestrator()
    return _orchestrator
