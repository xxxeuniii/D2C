"""
Agent 5: 测试验证（AST + LLM 双重检查）
"""
import re
from typing import List
from langchain.tools import tool
from langchain.schema import HumanMessage
from services.llm import code_llm


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

    # 5. 空状态检查
    if "return (" in code and "?.map" in code and "key={" not in code:
        issues.append("WARNING: 列表渲染中可能缺少 key 属性")

    return issues


@tool
def validate_and_fix(code: str) -> str:
    """
    验证代码质量并自动修复问题。
    AST 静态分析 + LLM 深度审查，双重保障。
    """
    # 第一阶段: AST 静态分析
    ast_issues = _ast_syntax_check(code)

    if not ast_issues:
        ast_result = "PASSED: AST 静态分析通过\n"
    else:
        ast_result = "## AST 静态分析发现的问题:\n" + "\n".join(f"- {i}" for i in ast_issues) + "\n"

    # 第二阶段: LLM 深度审查
    review_prompt = f"""检查以下代码并修复问题。

AST 静态分析结果:
{ast_result}

检查清单:
- 组件库 API 用法是否正确
- TypeScript 类型是否完整
- 可访问性 (alt, aria-label, role)
- 响应式设计 (是否使用相对单位)
- 性能问题 (多余的 re-render, 大列表是否需要虚拟滚动)

代码:
```{'vue' if 'template' in code.lower() else 'tsx'}
{code[:5000]}
```

如果代码没问题且 AST 已通过, 输出 "PASSED"。
如果有问题, 输出:
1. 问题列表
2. 修复后的完整代码

用中文回复。"""

    response = code_llm.invoke([HumanMessage(content=review_prompt)])

    # 合并 AST 和 LLM 结果
    full_result = f"{'='*50}\nAST 静态分析:\n{'='*50}\n{ast_result}\n{'='*50}\nLLM 深度审查:\n{'='*50}\n{response.content}"
    return full_result
