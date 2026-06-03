"""
Agent Memory 管理模块

使用 LangChain ConversationSummaryBufferMemory 实现：
- 跨 Agent 共享上下文（Pipeline 级别的共享记忆）
- 每个 Agent 也可以有独立记忆（Agent 级别的隔离记忆）
- 自动摘要压缩，控制 Token 消耗
"""
from langchain.memory import ConversationSummaryBufferMemory
from langchain.schema import SystemMessage
from services.llm import llm, summary_llm


def create_pipeline_memory() -> ConversationSummaryBufferMemory:
    """
    创建流水线级别的共享记忆。
    所有 Agent 通过此 Memory 共享上下文信息，
    后续 Agent 可以了解前序 Agent 的处理结果和决策。
    """
    return ConversationSummaryBufferMemory(
        llm=summary_llm,        # 使用 temperature=0 的模型做摘要
        max_token_limit=2000,   # 记忆缓冲区 Token 上限
        return_messages=True,   # 返回消息对象而非字符串
        memory_key="chat_history",
        input_key="input",
    )


def create_agent_memory() -> ConversationSummaryBufferMemory:
    """
    创建单个 Agent 的独立记忆。
    用于需要多轮对话的 Agent（如代码生成时的迭代优化），
    与流水线共享记忆隔离。
    """
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
    """
    prompts = {
        "cleaner": SystemMessage(content="""你是 Agent 1（数据清洗专家）。职责：
1. 清洗 Figma 原始 JSON 数据，移除冗余字段
2. 将 Figma 格式转换为前端 CSS 属性
3. 使用 enhance_cleaned_data 工具进行语义增强（颜色语义化、文本分类、布局推断）
4. 完成清洗后将结果通过 save_cleaned_result 保存到流水线共享上下文"""),

        "converter": SystemMessage(content="""你是 Agent 2（结构化转换专家）。职责：
1. 从流水线共享上下文中获取清洗后的数据
2. 将 Figma 节点树转换为组件 DSL
3. 使用 enhance_dsl_data 工具进行语义增强（组件推断、Props 提取、关系识别、Token 化、交互逻辑）
4. 完成转换后将结果通过 save_dsl_result 保存到流水线共享上下文"""),

        "retriever": SystemMessage(content="""你是 Agent 3（知识检索专家）。职责：
1. 从流水线共享上下文中获取 DSL 数据
2. 使用 search_component_docs 工具从 ChromaDB 检索组件库文档
3. 将检索到的文档附加到 DSL 中
4. 将结果保存到流水线共享上下文"""),

        "generator": SystemMessage(content="""你是 Agent 4（代码生成专家）。职责：
1. 从流水线共享上下文中获取带文档的 DSL
2. 使用 generate_page_code 工具生成完整的前端代码
3. 根据框架（React/Vue）和组件库生成对应代码
4. 将生成的代码保存到流水线共享上下文"""),

        "validator": SystemMessage(content="""你是 Agent 5（代码验证专家）。职责：
1. 从流水线共享上下文中获取生成的代码
2. 使用 validate_and_fix 工具进行 AST 静态分析 + LLM 深度审查
3. 如果发现安全问题（XSS、eval），必须修复
4. 将验证结果保存到流水线共享上下文"""),
    }
    return prompts.get(agent_name, SystemMessage(content=f"你是 {agent_role}"))
