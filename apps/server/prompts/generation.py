"""
代码生成 / 修改 / 验证用的 Prompt 模板函数

来源: 原 generator.py + tools.py (modify_code) + validator.py (review_prompt)
"""


def build_code_generation_prompt(
    dsl_with_docs: str,
    framework: str,
    anti_hallucination_prompt: str = "",
) -> str:
    """
    构造代码生成的完整 Prompt。
    
    参数:
        dsl_with_docs: 带组件文档的 DSL JSON
        framework: 目标框架 (react / vue2)
        anti_hallucination_prompt: 反幻觉约束文本
    """
    framework_spec = (
        "Vue 2 + Options API, 使用 Element Plus 组件库"
        if framework == "vue2"
        else "React 18 + TypeScript + Hooks"
    )

    return f"""你是一个资深前端开发。根据以下设计 DSL 和组件文档生成完整的 {framework} 页面代码。

## DSL + 组件文档:
{dsl_with_docs[:6000]}

{anti_hallucination_prompt}

## 要求:
- {framework_spec}
- 暗色主题: 背景 #0D1117, 文字 #E6EDF3, 边框 rgba(255,255,255,0.1)
- 所有组件必须按 DSL 的 components 结构排列, 保持父子关系
- Tailwind CSS 处理样式
- 完整可运行的代码文件
- TypeScript 类型定义

只输出代码, 不要任何解释:"""


def build_code_modification_prompt(
    current_code: str,
    modification_request: str,
    framework: str,
    component_lib: str,
) -> str:
    """
    构造代码修改的 Prompt（Chat Agent 用）。
    
    参数:
        current_code: 当前代码
        modification_request: 用户修改要求
        framework: 框架 (react / vue2)
        component_lib: 组件库名称
    """
    lang = "vue" if framework == "vue2" else "tsx"

    return f"""你是一个资深前端开发。用户要求修改以下代码。

## 当前代码:
```{lang}
{current_code[:6000]}
```

## 修改要求:
{modification_request}

## 要求:
- 只修改用户要求的部分，其他代码保持不变
- 保持原有的框架和组件库（{framework} + {component_lib}）
- 保持暗色主题设计系统
- 完整可运行
- 只输出完整代码，不要任何解释"""


def build_code_review_prompt(
    code: str,
    ast_result: str,
    api_result: str,
) -> str:
    """
    构造代码审查的 Prompt（Agent 5 验证阶段用）。
    
    参数:
        code: 待审查的代码
        ast_result: AST 静态分析结果
        api_result: API 幻觉检查结果
    """
    lang = "vue" if "template" in code.lower() else "tsx"

    return f"""检查以下代码并修复问题。

AST 静态分析结果:
{ast_result}

API 幻觉检查结果:
{api_result}

检查清单:
- 组件库 API 用法是否正确
- TypeScript 类型是否完整
- 可访问性 (alt, aria-label, role)
- 响应式设计 (是否使用相对单位)
- 性能问题 (多余的 re-render, 大列表是否需要虚拟滚动)

代码:
```{lang}
{code[:5000]}
```

如果代码没问题且所有检查通过, 输出 "PASSED"。
如果有问题, 输出:
1. 问题列表
2. 修复后的完整代码

用中文回复。"""
