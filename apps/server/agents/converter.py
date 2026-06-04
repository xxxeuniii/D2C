"""
Agent 2: 结构化转换（Python 规则引擎兜底 + LLM 语义增强）
核心转换用确定性的 Python 规则引擎保证正确性，
LLM 在 DSL 基础上补充组件推断、Props 提取、关系识别、Token 化、交互逻辑。

Prompt 模板集中在 prompts/enhancement.py 中管理。
"""
import json
import time
from typing import Optional
from langchain_core.messages import HumanMessage
from services.llm import llm
from prompts.enhancement import build_converter_enhancement_prompt

# 类型映射
TYPE_MAP = {
    "FRAME": "container",
    "GROUP": "container",
    "RECTANGLE": "box",
    "TEXT": "text",
    "COMPONENT": "component",
    "INSTANCE": "component",
    "COMPONENT_SET": "component",
    "ELLIPSE": "box",
    "LINE": "box",
    "VECTOR": "box",
    "POLYGON": "box",
    "STAR": "box",
    "BOOLEAN_OPERATION": "container",
}

# 命名推断：根据图层名推断组件类型
NAME_TYPE_HINTS = {
    "button": "button", "btn": "button",
    "input": "input", "textfield": "input", "textbox": "input",
    "checkbox": "checkbox", "radio": "radio",
    "select": "select", "dropdown": "select",
    "table": "table", "datagrid": "table",
    "modal": "modal", "dialog": "modal",
    "tab": "tabs", "tabs": "tabs",
    "card": "card",
    "menu": "menu", "navbar": "navbar", "sidebar": "sidebar",
    "form": "form",
    "image": "image", "img": "image", "icon": "icon",
    "avatar": "avatar",
    "badge": "badge", "tag": "tag",
    "pagination": "pagination",
    "slider": "slider",
    "switch": "switch", "toggle": "switch",
    "breadcrumb": "breadcrumb",
    "header": "header", "footer": "footer",
    "list": "list",
    "divider": "divider", "separator": "divider",
    "tooltip": "tooltip",
    "popover": "popover",
    "progress": "progress",
    "loading": "loading", "spinner": "spinner",
}

# 样式属性列表
STYLE_KEYS = [
    "width", "height", "opacity", "backgroundColor",
    "borderColor", "borderWidth", "borderRadius",
    "boxShadow", "display", "flexDirection",
    "justifyContent", "alignItems", "gap", "padding",
    "fontSize", "fontFamily", "fontWeight", "color",
]


def _infer_component_type(node: dict) -> str:
    """根据图层名推断组件类型"""
    name = node.get("name", "").lower().replace(" ", "").replace("-", "").replace("_", "")
    figma_type = node.get("type", "")

    if figma_type == "TEXT":
        return "text"

    for keyword, comp_type in NAME_TYPE_HINTS.items():
        if keyword in name:
            return comp_type

    return TYPE_MAP.get(figma_type, "container")


def _node_to_dsl_component(node: dict, depth: int = 0) -> dict:
    """将清洗后的 Figma 节点转换为 DSL 组件，递归处理整个树。"""
    comp_type = _infer_component_type(node)

    component = {
        "name": node.get("name", ""),
        "type": comp_type,
    }

    # 样式
    styles = {}
    for key in STYLE_KEYS:
        if key in node:
            styles[key] = node[key]

    if styles:
        component["styles"] = styles

    # Props
    props = {}
    if node.get("text"):
        props["text"] = node["text"]
    if node.get("isComponent"):
        props["componentName"] = node.get("componentName", "")
    if props:
        component["props"] = props

    # 布局信息
    if node.get("layoutMode"):
        component["layout"] = {
            "mode": node["layoutMode"],
            "hasAutoLayout": True,
        }

    # 子节点
    children = node.get("children", [])
    if children:
        component["children"] = [
            _node_to_dsl_component(child, depth + 1)
            for child in children
        ]

    return component


def convert_to_dsl(cleaned_data: dict, framework: str, component_lib: str) -> dict:
    """
    生产级结构化转换：Python 规则引擎。
    100% 确定性，不依赖 LLM。
    """
    tree = cleaned_data.get("tree", cleaned_data)

    components = []
    children = tree.get("children", [])
    for child in children:
        dsl_comp = _node_to_dsl_component(child)
        components.append(dsl_comp)

    return {
        "pageName": cleaned_data.get("fileName", "Untitled"),
        "framework": framework,
        "componentLib": component_lib,
        "convertedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "components": components,
    }


# ============================================
# LLM 辅助增强：在规则引擎输出的 DSL 基础上补充语义理解
# 失败时安全降级，保留基础 DSL
# ============================================

def _collect_dsl_components(components: list, result: list, path: str = "") -> None:
    """递归收集 DSL 组件信息（用于 LLM 分析）"""
    for comp in components:
        current_path = f"{path}/{comp.get('name', '')}" if path else comp.get("name", "")
        result.append({
            "name": comp.get("name", ""),
            "type": comp.get("type", ""),
            "path": current_path,
            "styles": comp.get("styles", {}),
            "props": comp.get("props", {}),
            "childrenCount": len(comp.get("children", [])),
            "childrenNames": [c.get("name", "") for c in comp.get("children", [])[:10]],
            "childrenTypes": [c.get("type", "") for c in comp.get("children", [])[:10]],
        })
        if comp.get("children"):
            _collect_dsl_components(comp["children"], result, current_path)


def _collect_style_values(components: list, result: dict) -> None:
    """递归收集所有样式值，用于 Token 化分析"""
    for comp in components:
        styles = comp.get("styles", {})
        for key, value in styles.items():
            if isinstance(value, (int, float, str)):
                k = f"{key}:{value}"
                if k not in result:
                    result[k] = {"property": key, "value": value, "count": 0, "usages": []}
                result[k]["count"] += 1
                result[k]["usages"].append(comp.get("name", ""))
        if comp.get("children"):
            _collect_style_values(comp["children"], result)


def enhance_dsl_with_llm(dsl: dict, framework: str, component_lib: str) -> dict:
    """
    使用 LLM 对 DSL 进行语义增强。
    增强内容包括：组件类型推断、Props 提取、关系识别、样式 Token 化、交互逻辑推断。
    失败时返回原始 DSL，不抛异常。
    """
    try:
        components = dsl.get("components", [])
        if not components:
            return dsl

        # 收集分析素材
        flat_comps = []
        _collect_dsl_components(components, flat_comps)

        style_values = {}
        _collect_style_values(components, style_values)
        # 取出现次数 > 1 的样式值（有复用价值）
        repeated_styles = [
            {"property": v["property"], "value": v["value"], "count": v["count"],
             "usages": v["usages"][:5]}
            for v in style_values.values() if v["count"] > 1
        ][:30]

        # 找出规则引擎未识别的组件（type 为 container/box 的节点）
        unrecognized = [c for c in flat_comps if c["type"] in ("container", "box")][:20]

        # 构造 Prompt
        prompt = build_converter_enhancement_prompt(
            flat_comps=flat_comps,
            unrecognized=unrecognized,
            repeated_styles=repeated_styles,
            framework=framework,
            component_lib=component_lib,
        )

        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content.strip()

        # 提取 JSON（容错处理）
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        # 尝试找到第一个 { 到最后一个 } 之间的内容
        if not content.startswith("{"):
            start = content.find("{")
            end = content.rfind("}")
            if start >= 0 and end > start:
                content = content[start:end + 1]

        enhancement = json.loads(content)

        # 将增强结果附加到 DSL
        dsl["llmEnhancement"] = {
            "componentTypes": enhancement.get("componentTypes", []),
            "enhancedProps": enhancement.get("enhancedProps", []),
            "relationships": enhancement.get("relationships", []),
            "designTokens": enhancement.get("designTokens", []),
            "interactions": enhancement.get("interactions", []),
            "responsiveHints": enhancement.get("responsiveHints", []),
            "enhancedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }

        # 应用组件类型推断到 DSL 树
        _apply_component_types(components, enhancement.get("componentTypes", []))

        # 应用增强 Props 到 DSL 树
        _apply_enhanced_props(components, enhancement.get("enhancedProps", []))

        # 应用关系标注到 DSL 树
        _apply_relationships(components, enhancement.get("relationships", []))

        return dsl

    except Exception as e:
        # 安全降级：LLM 失败时保留原始 DSL
        dsl["llmEnhancement"] = {"error": str(e), "status": "fallback"}
        return dsl


def _apply_component_types(components: list, type_hints: list) -> None:
    """将 LLM 推断的组件类型应用到 DSL 树中"""
    type_map = {}
    for hint in type_hints:
        if isinstance(hint, dict):
            type_map[hint.get("name", "")] = {
                "inferredType": hint.get("inferredType", ""),
                "reason": hint.get("reason", ""),
            }

    if not type_map:
        return

    def _walk(comps):
        for comp in comps:
            name = comp.get("name", "")
            if name in type_map:
                hint = type_map[name]
                # 只更新规则引擎无法识别的类型
                if comp.get("type") in ("container", "box"):
                    comp["originalType"] = comp["type"]
                    comp["type"] = hint["inferredType"]
                    comp["typeInferenceReason"] = hint["reason"]
            if comp.get("children"):
                _walk(comp["children"])

    _walk(components)


def _apply_enhanced_props(components: list, enhanced_props: list) -> None:
    """将 LLM 推断的 Props 应用到 DSL 树中"""
    props_map = {}
    for ep in enhanced_props:
        if isinstance(ep, dict):
            props_map[ep.get("name", "")] = ep.get("props", {})

    if not props_map:
        return

    def _walk(comps):
        for comp in comps:
            name = comp.get("name", "")
            if name in props_map:
                existing = comp.get("props", {})
                existing.update(props_map[name])
                comp["props"] = existing
                comp["propsEnhanced"] = True
            if comp.get("children"):
                _walk(comp["children"])

    _walk(components)


def _apply_relationships(components: list, relationships: list) -> None:
    """将 LLM 识别的关系应用到 DSL 树中"""
    if not relationships:
        return

    # 构建组件名到引用的映射
    ref_map = {}

    def _build_ref_map(comps):
        for comp in comps:
            ref_map[comp.get("name", "")] = comp
            if comp.get("children"):
                _build_ref_map(comp["children"])

    _build_ref_map(components)

    # 为涉及的组件添加关系标注
    for rel in relationships:
        if not isinstance(rel, dict):
            continue
        rel_type = rel.get("type", "")
        members = rel.get("members", [])
        desc = rel.get("description", "")
        for member_name in members:
            if member_name in ref_map:
                comp = ref_map[member_name]
                if "semanticRelations" not in comp:
                    comp["semanticRelations"] = []
                comp["semanticRelations"].append({
                    "type": rel_type,
                    "description": desc,
                    "relatedTo": [m for m in members if m != member_name],
                })
