"""
Agent Tools 定义

每个 Tool 是 Agent 可以自主调用的能力单元。
Agent 根据当前上下文和 System Prompt 决定何时调用哪个 Tool。

Tool 设计原则：
1. 单一职责：每个 Tool 只做一件事
2. 清晰输入输出：docstring 明确描述输入参数和返回值
3. 错误处理：Tool 内部处理异常，不抛给 Agent
4. 请求隔离：使用 ContextVar 确保并发请求间上下文互不干扰
"""
import json
import contextvars
from typing import Optional
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from services.llm import code_llm
from prompts.generation import build_code_modification_prompt


# ============================================
# 请求级上下文隔离（替代全局变量，支持并发）
# ============================================

# ContextVar 确保每个请求/协程有独立的上下文
_pipeline_context_var: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "pipeline_context", default=None
)


def get_pipeline_context() -> dict:
    """获取当前请求的流水线上下文（线程安全/协程安全）"""
    ctx = _pipeline_context_var.get()
    if ctx is None:
        ctx = {}
        _pipeline_context_var.set(ctx)
    return ctx


def reset_pipeline_context():
    """重置当前请求的流水线上下文"""
    _pipeline_context_var.set({})


# ============================================
# Agent 1 可用 Tools：数据清洗
# ============================================

@tool
def clean_figma_json(raw_json: str) -> str:
    """
    清洗 Figma 原始 JSON 数据。
    输入：Figma API 返回的原始 JSON 字符串
    输出：清洗后的 JSON 字符串（移除冗余字段，格式转换）
    
    处理内容：
    - 移除顶层和节点级冗余字段（id、version、pluginData 等约 70 个字段）
    - 跳过 visible=false 的隐藏节点
    - RGBA 颜色转 CSS hex/rgba
    - Figma Effect 转 CSS box-shadow
    - Auto Layout 映射为 Flexbox
    - TEXT 节点提取文本属性和样式
    - COMPONENT/INSTANCE 标记为业务组件
    """
    from agents.cleaner import clean_figma_data
    result = clean_figma_data(raw_json)
    return json.dumps(result, ensure_ascii=False, indent=2)


@tool
def enhance_colors_and_texts(cleaned_json: str) -> str:
    """
    使用 LLM 对清洗后的数据进行颜色语义化和文本分类增强。
    输入：清洗后的 JSON 字符串
    输出：附加了颜色 Token 和文本角色的 JSON 字符串
    
    增强内容：
    - colorTokens：识别主色、背景色、文字色、边框色、错误色 → CSS 变量名
    - textRoles：将文本分为 title/heading/body/placeholder/helper/cta/label
    - layoutIntent：推断布局意图 header/sidebar/content/card-grid/form
    """
    from agents.cleaner import enhance_cleaned_data_with_llm
    data = json.loads(cleaned_json)
    enhanced = enhance_cleaned_data_with_llm(data)
    return json.dumps(enhanced, ensure_ascii=False, indent=2)


# ============================================
# Agent 2 可用 Tools：结构化转换
# ============================================

@tool
def convert_figma_to_dsl(cleaned_json: str, framework: str = "react", component_lib: str = "element-plus") -> str:
    """
    将清洗后的 Figma 数据转换为组件 DSL（领域描述语言）。
    输入：清洗后的 JSON + 目标框架 + 组件库名称
    输出：DSL JSON 字符串
    """
    from agents.converter import convert_to_dsl
    data = json.loads(cleaned_json)
    dsl = convert_to_dsl(data, framework, component_lib)
    return json.dumps(dsl, ensure_ascii=False, indent=2)


@tool
def enhance_dsl_semantics(dsl_json: str, framework: str = "react", component_lib: str = "element-plus") -> str:
    """
    使用 LLM 对 DSL 进行语义增强。
    输入：DSL JSON + 目标框架 + 组件库
    输出：附加了语义信息的 DSL JSON
    
    增强内容：
    - componentTypes：对规则引擎未识别的 container/box 推断真实类型
    - enhancedProps：补充 label/placeholder/disabled/options 等 Props
    - relationships：识别 formItem/labelInput/tableRow/modalLayout 等关系
    - designTokens：将重复样式抽象为 --token-name
    - interactions：推断 onClick/onChange/onSubmit/toggle 等交互
    - responsiveHints：移动端/平板断点适配建议
    """
    from agents.converter import enhance_dsl_with_llm
    dsl = json.loads(dsl_json)
    enhanced = enhance_dsl_with_llm(dsl, framework, component_lib)
    return json.dumps(enhanced, ensure_ascii=False, indent=2)


# ============================================
# Agent 3 可用 Tools：知识检索
# ============================================

@tool
def search_component_docs(dsl_json: str, component_lib: str = "element-plus") -> str:
    """
    从 ChromaDB 知识库检索组件库文档，附加到 DSL 中。
    输入：DSL JSON + 组件库名称
    输出：附加了 componentDocs 的 DSL JSON
    """
    from agents.retriever import search_component_docs as _search
    return _search.invoke({"dsl_json": dsl_json, "component_lib": component_lib})


# ============================================
# Agent 4 可用 Tools：代码生成
# ============================================

@tool
def generate_page_code(dsl_with_docs: str, framework: str) -> str:
    """
    根据 DSL + 组件文档生成完整页面代码。
    输入：带文档的 DSL JSON + 目标框架（react/vue2）
    输出：完整的前端代码
    
    使用 DeepSeek-V3 模型，暗色主题设计系统。
    """
    from agents.generator import generate_page_code as _gen
    return _gen.invoke({"dsl_with_docs": dsl_with_docs, "framework": framework})


# ============================================
# Agent 5 可用 Tools：测试验证
# ============================================

@tool
def validate_and_fix_code(code: str) -> str:
    """
    验证代码质量并自动修复问题。
    输入：生成的代码字符串
    输出：验证结果（PASSED 或问题列表 + 修复后代码）
    
    检查项目：
    - AST 静态分析：括号匹配、标签闭合、导入检查、XSS 扫描、列表 key
    - LLM 深度审查：组件库 API 正确性、TypeScript 类型、可访问性、响应式、性能
    """
    from agents.validator import validate_and_fix as _val
    return _val.invoke(code)


# ============================================
# 上下文管理 Tools（Agent 间数据传递，请求级隔离）
# ============================================


@tool
def save_to_context(key: str, value: str) -> str:
    """
    将处理结果保存到当前请求的流水线上下文，供后续 Agent 读取。
    可用 key：cleaned_data, dsl, dsl_with_docs, generated_code, validation_result
    
    注意：上下文通过 ContextVar 隔离，不同请求间互不干扰。
    """
    ctx = get_pipeline_context()
    ctx[key] = value
    return f"已保存 {key} 到流水线上下文"


@tool
def read_from_context(key: str) -> str:
    """
    从当前请求的流水线上下文中读取数据。
    可用 key：figma_raw, cleaned_data, dsl, dsl_with_docs, generated_code,
            validation_result, framework, componentLib
    """
    ctx = get_pipeline_context()
    if key in ctx:
        val = ctx[key]
        return val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
    return f"错误：上下文中没有 {key}"


# ============================================
# Chat Agent 专用 Tools：代码迭代修改
# ============================================

@tool
def get_current_code() -> str:
    """
    获取当前请求上下文中保存的最新代码。
    用于 Chat Agent 在多轮对话中查看需要修改的代码。
    输出：当前代码字符串，如果没有代码则返回提示
    """
    ctx = get_pipeline_context()
    code = ctx.get("generated_code", "")
    if not code:
        return "当前没有代码。请先运行流水线生成代码。"
    # 截断过长代码
    if len(code) > 8000:
        return code[:8000] + "\n\n... (代码过长已截断，如需完整代码请指定查看范围)"
    return code


@tool
def modify_code(modification_request: str) -> str:
    """
    根据用户的修改要求，使用 LLM 修改当前代码。
    输入：修改要求（自然语言描述，如"把按钮改成蓝色，加圆角"）
    输出：修改后的完整代码
    
    这个 Tool 会：
    1. 读取当前上下文中保存的代码
    2. 将代码 + 修改要求发给 DeepSeek-V3
    3. 返回修改后的完整代码
    4. 自动更新上下文中的 generated_code
    
    支持的操作：修改样式、添加组件、删除组件、调整布局、修改文案、添加交互等
    """
    ctx = get_pipeline_context()
    current_code = ctx.get("generated_code", "")
    if not current_code:
        return "错误：当前没有代码，请先生成代码。"

    framework = ctx.get("framework", "react")
    component_lib = ctx.get("componentLib", "element-plus")

    prompt = build_code_modification_prompt(
        current_code=current_code,
        modification_request=modification_request,
        framework=framework,
        component_lib=component_lib,
    )

    response = code_llm.invoke([HumanMessage(content=prompt)])
    new_code = response.content

    # 自动保存到当前请求的上下文
    ctx["generated_code"] = new_code

    return f"代码已修改完成。修改内容：{modification_request}\n\n修改后的代码已自动保存，用户可以直接查看。"


@tool
def validate_current_code() -> str:
    """
    对当前上下文中的代码进行 AST + LLM 双重验证。
    输出：验证结果（PASSED 或问题列表 + 修复建议）
    """
    from agents.validator import validate_and_fix as _val

    ctx = get_pipeline_context()
    code = ctx.get("generated_code", "")
    if not code:
        return "当前没有代码，无法验证。"

    result = _val.invoke(code)
    ctx["validation_result"] = result
    return result


@tool
def add_component(component_description: str) -> str:
    """
    向当前代码中添加一个新组件。
    输入：组件描述（如"在表单底部添加一个记住密码的 checkbox"）
    输出：修改后的完整代码
    
    这个 Tool 会分析当前代码结构，在合适位置插入新组件。
    """
    return modify_code.invoke(f"添加以下组件：{component_description}，保持其他代码不变")


@tool
def fix_code_issue(issue_description: str) -> str:
    """
    修复当前代码中的问题。
    输入：问题描述（如"登录按钮点击后没有 loading 状态"）
    输出：修复后的完整代码
    
    这个 Tool 会分析问题并修复，不改变其他功能。
    """
    return modify_code.invoke(f"修复以下问题：{issue_description}，保持其他功能不变")


# ============================================
# 各 Agent 的 Tool 集合
# ============================================

AGENT_TOOLS = {
    "cleaner": [clean_figma_json, enhance_colors_and_texts, save_to_context],
    "converter": [convert_figma_to_dsl, enhance_dsl_semantics, read_from_context, save_to_context],
    "retriever": [search_component_docs, read_from_context, save_to_context],
    "generator": [generate_page_code, read_from_context, save_to_context],
    "validator": [validate_and_fix_code, read_from_context, save_to_context],
    "chat": [
        get_current_code,      # 查看当前代码
        modify_code,           # 修改代码（核心 Tool）
        add_component,         # 添加组件（modify_code 的便捷包装）
        fix_code_issue,        # 修复问题（modify_code 的便捷包装）
        validate_current_code, # 验证代码
        save_to_context,       # 保存结果
        read_from_context,     # 读取上下文
    ],
}
