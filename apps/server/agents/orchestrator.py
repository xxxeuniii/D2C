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

# LangChain 1.x 兼容：AgentExecutor 和 create_openai_tools_agent 已移除
# 使用 langchain.agents.create_agent 替代
try:
    from langchain.agents import create_agent
    _LC_V1 = True
except ImportError:
    _LC_V1 = False

# ConversationSummaryBufferMemory 在 LangChain 1.x 中已移除
# 使用 langchain_classic 作为 fallback
try:
    from langchain.memory import ConversationSummaryBufferMemory
except ImportError:
    try:
        from langchain_classic.memory import ConversationSummaryBufferMemory
    except ImportError:
        ConversationSummaryBufferMemory = None

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from services.llm import llm, summary_llm
from agents.tools import (
    AGENT_TOOLS, reset_pipeline_context, get_pipeline_context,
)
from prompts import (
    CHAT_AGENT_SYSTEM_PROMPT,
    CLEANER_PROMPT, CONVERTER_PROMPT, RETRIEVER_PROMPT,
    GENERATOR_PROMPT, VALIDATOR_PROMPT,
    PIPELINE_TASKS,
)


def create_pipeline_agent_executor(
    system_prompt: str,
    tools: List,
):
    """
    创建流水线 Agent 执行器（无 Memory）。
    
    流水线 Agent 的任务是固定的，不需要记忆。
    Agent 间数据通过 Pipeline Context 传递。
    """
    if _LC_V1:
        # LangChain 1.x: 使用 create_agent
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        return create_agent(
            llm=llm,
            tools=tools,
            system_prompt=system_prompt,
        )
    else:
        # LangChain 0.x 兼容
        from langchain.agents import AgentExecutor, create_openai_tools_agent
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


def create_chat_agent_executor():
    """
    创建 Chat Agent 执行器（带 Memory）。
    
    Memory 是 Chat Agent 的核心：
    - ConversationSummaryBufferMemory 自动保存对话历史
    - 自动摘要压缩，控制 Token 在 3000 以内
    - 用户每轮说"改颜色""加组件"，Memory 都记住
    - 下一轮 Agent 能回顾之前改了什么
    """
    if _LC_V1:
        # LangChain 1.x: create_agent 内置状态管理
        return create_agent(
            llm=llm,
            tools=AGENT_TOOLS["chat"],
            system_prompt=CHAT_AGENT_SYSTEM_PROMPT,
        )
    else:
        # LangChain 0.x 兼容
        from langchain.agents import AgentExecutor, create_openai_tools_agent
        memory = ConversationSummaryBufferMemory(
            llm=summary_llm,
            max_token_limit=3000,
            return_messages=True,
            memory_key="chat_history",
            input_key="input",
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", CHAT_AGENT_SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
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
            memory=memory,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=15,
            early_stopping_method="generate",
        )


class MultiAgentOrchestrator:
    """多 Agent 编排器，支持多会话隔离"""

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
        # 多会话管理：按 session_id 存储 Chat Agent
        self._chat_sessions: Dict[str, Any] = {}

    def run_pipeline(self, figma_raw: str, framework: str = "react", component_lib: str = "element-plus", session_id: str = None) -> dict:
        """运行 5 Agent 流水线，生成初始代码。
        
        Args:
            session_id: 可选的会话 ID，用于关联后续 Chat 会话
        """
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
                # ★ P0-3 修复：Agent 失败立即中断流水线，避免连锁错误 + 浪费 API 费用
                results["agents"].append({
                    "agent": agent_num, "name": config["role"],
                    "status": "error", "error": str(e),
                })
                print(f"[Agent {agent_num}/5] {config['role']} 失败 ✗: {e}")
                print(f"[流水线中断] Agent {agent_num} 失败，停止后续 Agent 执行")
                break  # ← 关键：失败后立即停止

        ctx = get_pipeline_context()
        results["generated_code"] = ctx.get("generated_code", "")
        results["validation_result"] = ctx.get("validation_result", "")
        results["status"] = "completed" if all(
            a["status"] == "completed" for a in results["agents"]
        ) else "partial"

        # 流水线完成后，为当前会话创建新的 Chat Agent
        sid = session_id or "default"
        self._chat_sessions[sid] = create_chat_agent_executor()

        return results

    def chat(self, user_message: str, session_id: str = None) -> dict:
        """
        多轮对话修改代码，按 session_id 隔离会话。
        
        每次调用都会保留对应会话 Memory 中的对话历史。
        
        例如：
          第 1 次 chat("把按钮改成蓝色") → Agent 修改代码
          第 2 次 chat("加圆角")         → Agent 在蓝色按钮基础上加圆角
          第 3 次 chat("加 checkbox")    → Agent 在蓝色圆角按钮基础上加 checkbox
        """
        sid = session_id or "default"
        
        if sid not in self._chat_sessions:
            # 如果没有流水线结果，创建一个空的 Chat Agent
            self._chat_sessions[sid] = create_chat_agent_executor()

        chat_executor = self._chat_sessions[sid]

        try:
            result = chat_executor.invoke({"input": user_message})
            ctx = get_pipeline_context()
            return {
                "status": "completed",
                "reply": result.get("output", ""),
                "current_code": ctx.get("generated_code", ""),
                "session_id": sid,
            }
        except Exception as e:
            return {"status": "error", "error": str(e), "session_id": sid}

    def reset_chat(self, session_id: str = None):
        """重置指定会话的 Chat Agent（清空 Memory，开始新会话）"""
        sid = session_id or "default"
        self._chat_sessions[sid] = create_chat_agent_executor()

    def cleanup_session(self, session_id: str):
        """清理指定会话，释放内存"""
        self._chat_sessions.pop(session_id, None)


# ============================================
# 全局单例
# ============================================

_orchestrator: MultiAgentOrchestrator = None


def get_orchestrator() -> MultiAgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiAgentOrchestrator()
    return _orchestrator
