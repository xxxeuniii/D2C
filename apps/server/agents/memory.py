"""
Agent Memory 管理模块

使用 LangChain ConversationSummaryBufferMemory 实现：
- 跨 Agent 共享上下文（Pipeline 级别的共享记忆）
- 每个 Agent 也可以有独立记忆（Agent 级别的隔离记忆）
- 自动摘要压缩，控制 Token 消耗

LangChain 1.x 兼容：ConversationSummaryBufferMemory 可能不在 langchain.memory 中
"""
# ConversationSummaryBufferMemory 兼容导入
try:
    from langchain.memory import ConversationSummaryBufferMemory
except ImportError:
    try:
        from langchain_classic.memory import ConversationSummaryBufferMemory
    except ImportError:
        ConversationSummaryBufferMemory = None

from langchain_core.messages import SystemMessage
from services.llm import llm, summary_llm
from prompts import AGENT_SYSTEM_PROMPTS


def create_pipeline_memory():
    """
    创建流水线级别的共享记忆。
    所有 Agent 通过此 Memory 共享上下文信息，
    后续 Agent 可以了解前序 Agent 的处理结果和决策。
    """
    if ConversationSummaryBufferMemory is None:
        return None
    return ConversationSummaryBufferMemory(
        llm=summary_llm,        # 使用 temperature=0 的模型做摘要
        max_token_limit=2000,   # 记忆缓冲区 Token 上限
        return_messages=True,   # 返回消息对象而非字符串
        memory_key="chat_history",
        input_key="input",
    )


def create_agent_memory():
    """
    创建单个 Agent 的独立记忆。
    用于需要多轮对话的 Agent（如代码生成时的迭代优化），
    与流水线共享记忆隔离。
    """
    if ConversationSummaryBufferMemory is None:
        return None
    return ConversationSummaryBufferMemory(
        llm=summary_llm,
        max_token_limit=1000,
        return_messages=True,
        memory_key="chat_history",
        input_key="input",
    )


def get_agent_system_prompt(agent_name: str, agent_role: str) -> SystemMessage:
    """
    为每个 Agent 生成系统提示词。
    定义 Agent 的角色、职责和可用工具。
    
    Prompt 定义集中在 prompts/agent_prompts.py 的 AGENT_SYSTEM_PROMPTS 中。
    """
    return AGENT_SYSTEM_PROMPTS.get(
        agent_name,
        SystemMessage(content=f"你是 {agent_role}")
    )
