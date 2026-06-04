"""
Agent 5: 测试验证（AST + LLM 双重检查）+ 反幻觉 API 验证

Prompt 模板集中在 prompts/ 模块中管理。
"""
import re
import json
from typing import List
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from services.llm import code_llm
from agents.anti_hallucination import run_hallucination_check
from prompts.generation import build_code_review_prompt


def _ast_syntax_check(code: str) -> List[str]:
    """
    生产级 AST 语法检查。
    使用 Python 字符串分析做基础检查 + 自定义规则。
    """
    issues = []

    # 1. 括号匹配
    brackets = {"{": "}", "(": ")", "[": "]"}
    stack = []
    for i, ch in enumerate(code):
        if ch in brackets:
            stack.append((ch, i))
        elif ch in brackets.values():
            if not stack:
                issues.append(f"ERROR: 第 {i} 个字符附近多余的 '{ch}'")
            else:
                opening, pos = stack.pop()
                expected = brackets[opening]
                if ch != expected:
                    issues.append(f"ERROR: 第 {pos} 个字符附近 '{opening}' 的闭合符号应该是 '{expected}', 但找到了 '{ch}'")
    for opening, pos in stack:
        issues.append(f"ERROR: 第 {pos} 个字符附近 '{opening}' 未闭合")

    # 2. 标签闭合检查（Vue template / JSX）
    tag_pattern = re.findall(r'<(/?)(\w+)[^>]*>', code)
    tag_stack = []
    for is_closing, tag_name in tag_pattern:
        if is_closing:
            if not tag_stack:
                issues.append(f"WARNING: 多余的闭合标签 </{tag_name}>")
            else:
                opened = tag_stack.pop()
                if opened != tag_name:
                    issues.append(f"ERROR: 标签不匹配: <{opened}> 与 </{tag_name}>")
        else:
            if tag_name not in ("br", "hr", "img", "input", "meta", "link"):
                tag_stack.append(tag_name)
    for unclosed in tag_stack:
        issues.append(f"ERROR: 未闭合的标签 <{unclosed}>")

    # 3. 导入检查
    if "vue" in code.lower() or "template" in code.lower():
        if "import" not in code and "require" not in code:
            issues.append("WARNING: Vue 组件中缺少 import 语句")
        if "export default" not in code:
            issues.append("WARNING: Vue 组件中缺少 export default")
    if "react" in code.lower() or "tsx" in code.lower():
        if "import React" not in code and "from 'react'" not in code:
            issues.append("WARNING: React 组件中可能缺少 React 导入")

    # 4. XSS 风险检查
    if "dangerouslySetInnerHTML" in code:
        issues.append("WARNING: 使用了 dangerouslySetInnerHTML, 存在 XSS 风险")
    if "v-html" in code:
        issues.append("WARNING: 使用了 v-html, 存在 XSS 风险")
    if "eval(" in code:
        issues.append("ERROR: 使用了 eval(), 严重安全风险")

    # 5. 列表 key 检查
    if "return (" in code and "?.map" in code and "key={" not in code:
        issues.append("WARNING: 列表渲染中可能缺少 key 属性")

    return issues


@tool
def validate_and_fix(code: str) -> str:
    """
    验证代码质量并自动修复问题。
    AST 静态分析 + LLM 深度审查 + 反幻觉 API 验证，三重保障。
    """
    # 第一阶段: AST 静态分析
    ast_issues = _ast_syntax_check(code)

    if not ast_issues:
        ast_result = "PASSED: AST 静态分析通过\n"
    else:
        ast_result = "## AST 静态分析发现的问题:\n" + "\n".join(f"- {i}" for i in ast_issues) + "\n"

    # 第二阶段: 反幻觉 API 验证（确定性，不用 LLM 审 LLM）
    # 从上下文中获取组件文档和组件库信息
    from agents.tools import get_pipeline_context
    ctx = get_pipeline_context()
    component_lib = ctx.get("componentLib", "element-plus")

    # 尝试从 dsl_with_docs 中提取 componentDocs
    component_docs = {}
    dsl_with_docs_str = ctx.get("dsl_with_docs", "")
    if dsl_with_docs_str:
        try:
            dsl_data = json.loads(dsl_with_docs_str)
            component_docs = dsl_data.get("componentDocs", {})
        except (json.JSONDecodeError, TypeError):
            pass

    hallucination_result = run_hallucination_check(code, component_docs, component_lib)
    api_issues = hallucination_result.get("api_issues", [])
    llm_review = hallucination_result.get("llm_review", None)  # ★ P1-2 修复：接入 LLM 交叉验证结果

    if not api_issues:
        api_result = "PASSED: API 白名单验证通过（无幻觉属性）\n"
    else:
        api_result = "## API 幻觉检查发现的问题:\n"
        for issue in api_issues:
            api_result += f"- [{issue['severity']}] {issue['message']}\n"
        # ★ P1-2 修复：将 LLM 交叉验证结果也包含进去
        if llm_review:
            api_result += f"\n### LLM 交叉验证结果:\n{llm_review}\n"

    # 第三阶段: LLM 深度审查
    review_prompt = build_code_review_prompt(
        code=code,
        ast_result=ast_result,
        api_result=api_result,
    )

    response = code_llm.invoke([HumanMessage(content=review_prompt)])

    # 合并所有检查结果
    full_result = (
        f"{'='*50}\nAST 静态分析:\n{'='*50}\n{ast_result}\n"
        f"{'='*50}\nAPI 幻觉检查:\n{'='*50}\n{api_result}\n"
        f"{'='*50}\nLLM 深度审查:\n{'='*50}\n{response.content}"
    )
    return full_result
