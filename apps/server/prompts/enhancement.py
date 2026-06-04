"""
LLM 语义增强用的 Prompt 模板函数

来源: 原 cleaner.py + converter.py 中的内联 Prompt
"""
import json
from typing import List, Dict, Any


def build_cleaner_enhancement_prompt(
    colors: List[Dict],
    texts: List[Dict],
    layouts: List[Dict],
) -> str:
    """
    构造数据清洗阶段的 LLM 语义增强 Prompt（Agent 1）。

    用途: 对清洗后的 Figma 数据进行颜色语义化、文本分类、布局推断。

    参数:
        colors: 提取的颜色信息列表
        texts: 提取的文本信息列表
        layouts: 提取的布局结构列表
    """
    return f"""你是一个设计系统专家。分析以下 Figma 设计稿的清洗数据，补充语义信息。

## 颜色信息:
{json.dumps(colors[:30], ensure_ascii=False, indent=2)}

## 文本信息:
{json.dumps(texts[:20], ensure_ascii=False, indent=2)}

## 布局结构:
{json.dumps(layouts[:20], ensure_ascii=False, indent=2)}

## 请输出 JSON，包含以下字段:
- colorTokens: 将颜色语义化为 CSS 变量名。识别主色(--color-primary)、背景色(--bg-surface, --bg-elevated)、文字色(--text-primary, --text-secondary)、边框色(--border-default)、错误色等。value 是原始色值，token 是建议的 CSS 变量名。
- textRoles: 将文本按语义角色分类。title/heading/body/placeholder/helper/cta/label。输出格式: {{"text": "原文", "role": "角色"}}
- layoutIntent: 对主要布局节点推断意图。header/sidebar/content/footer/card-grid/form/hero 等。

只输出 JSON，不要任何解释。"""


def build_converter_enhancement_prompt(
    flat_comps: List[Dict],
    unrecognized: List[Dict],
    repeated_styles: Dict,
    framework: str,
    component_lib: str,
) -> str:
    """
    构造 DSL 语义增强的 Prompt（Agent 2）。

    用途: 对规则引擎转换后的 DSL 进行组件类型推断、Props 补充等。

    参数:
        flat_comps: 扁平化的组件列表
        unrecognized: 规则引擎未识别的组件（type 为 container/box）
        repeated_styles: 重复出现的样式值
        framework: 目标框架
        component_lib: 组件库名称
    """
    return f"""你是一个前端架构专家和设计系统专家。分析以下从 Figma 转换的 DSL，补充语义信息。

## 目标框架: {framework}
## 组件库: {component_lib}

## DSL 组件列表:
{json.dumps(flat_comps[:50], ensure_ascii=False, indent=2)}

## 规则引擎未识别的组件（需要 LLM 推断类型）:
{json.dumps(unrecognized, ensure_ascii=False, indent=2)}

## 重复出现的样式值（可用于 Token 化）:
{json.dumps(repeated_styles, ensure_ascii=False, indent=2)}

## 请输出 JSON，包含以下字段:

1. componentTypes: 对未识别组件推断具体类型。根据子结构判断（如"一个 TEXT+一个 RECTANGLE+圆角=button"）。格式: [{{"name": "组件名", "inferredType": "推断类型", "reason": "推断依据"}}]

2. enhancedProps: 为组件补充 Props。分析上下文推断 label/placeholder/disabled/options 等。格式: [{{"name": "组件名", "props": {{"key": "value"}}}}]

3. relationships: 识别组件间语义关系。格式: [{{"type": "formItem/labelInput/tableRow/modalLayout/formGroup/tabPanel", "members": ["组件名1","组件名2"], "description": "关系描述"}}]

4. designTokens: 将重复样式抽象为 Design Token。格式: [{{"token": "--token-name", "value": "样式值", "category": "color/spacing/fontSize/borderRadius/shadow", "usages": ["组件名"]}}]

5. interactions: 推断交互逻辑。格式: [{{"trigger": "组件名", "action": "onClick/onChange/onSubmit/toggle", "description": "交互描述", "relatedComponents": ["关联组件"]}}]

6. responsiveHints: 响应式布局建议。格式: [{{"target": "组件名", "breakpoint": "mobile/tablet", "suggestion": "具体建议"}}]

只输出 JSON，不要任何解释。"""
