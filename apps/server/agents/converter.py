"""
Agent 2: 结构化转换（生产级：Python 规则引擎）
不用 LLM！用确定性的 Python 代码将 Figma 节点转为 DSL。
"""
import json
import time
from typing import Optional

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
