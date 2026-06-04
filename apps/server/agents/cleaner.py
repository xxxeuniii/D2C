"""
Agent 1: 数据清洗（Python 代码兜底 + LLM 语义增强）
核心逻辑用确定性的 Python 代码保证正确性，
LLM 在规则引擎输出基础上补充语义理解，失败时安全降级。

Prompt 模板集中在 prompts/enhancement.py 中管理。
"""
import json
import time
from typing import Optional
from langchain_core.messages import HumanMessage
from services.llm import llm
from prompts.enhancement import build_cleaner_enhancement_prompt

# 需要移除的顶层字段
TOP_LEVEL_REMOVE = {
    "id", "lastModified", "version", "description", "editorType",
    "styleType", "remote", "scrollBehavior", "componentPropertyDefinitions",
    "constraints", "layoutGrids", "exportSettings", "transitionNodeID",
    "transitionDuration", "transitionEasing", "isAsset", "backgroundColor",
    "prototypeStartNodeID", "flowStartingPoints", "prototypeDevice",
}

# 节点级别需要移除的字段
NODE_REMOVE = {
    "id", "guid", "scrollBehavior", "componentPropertyDefinitions",
    "constraints", "layoutGrids", "exportSettings", "transitionNodeID",
    "transitionDuration", "transitionEasing", "isAsset",
    "pluginData", "sharedPluginData", "componentPropertyReferences",
    "explicitVariableModes", "boundVariables", "layoutPositioning",
    "individualStrokeWeights", "description", "remote",
    "locked", "exportSettings", "blendMode", "preserveRatio",
    "layoutAlign", "layoutGrow", "layoutSizingHorizontal", "layoutSizingVertical",
    "clipsContent", "mask", "maskType", "rectangleCornerRadii",
    "cornerSmoothing", "topLeftRadius", "topRightRadius",
    "bottomLeftRadius", "bottomRightRadius",
    "dashPattern", "strokeAlign", "strokeCap", "strokeJoin",
    "strokeMiterLimit", "strokeWeight", "strokeDashes",
    "textAutoResize", "textTruncation", "maxLines", "textAlignHorizontal",
    "textAlignVertical", "paragraphIndent", "paragraphSpacing",
    "textCase", "textDecoration", "letterSpacing", "lineHeightPx",
    "lineHeightPercent", "lineHeightUnit", "hyperlink",
    "styleId", "styles", "componentId",
}


def _extract_color(fill: dict) -> Optional[str]:
    """从 Figma fill 提取 CSS 颜色"""
    if fill.get("type") != "SOLID":
        return None
    color = fill.get("color", {})
    r = int(color.get("r", 0) * 255)
    g = int(color.get("g", 0) * 255)
    b = int(color.get("b", 0) * 255)
    a = fill.get("opacity", 1)
    if a < 1:
        return f"rgba({r}, {g}, {b}, {a:.2f})"
    return f"#{r:02x}{g:02x}{b:02x}"


def _extract_shadow(effect: dict) -> Optional[dict]:
    """从 Figma effect 提取 CSS box-shadow"""
    if effect.get("type") != "DROP_SHADOW":
        return None
    color = effect.get("color", {})
    r = int(color.get("r", 0) * 255)
    g = int(color.get("g", 0) * 255)
    b = int(color.get("b", 0) * 255)
    a = color.get("a", 1)
    offset_x = effect.get("offset", {}).get("x", 0)
    offset_y = effect.get("offset", {}).get("y", 0)
    radius = effect.get("radius", 0)
    spread = effect.get("spread", 0)
    return {
        "type": "box-shadow",
        "value": f"{offset_x}px {offset_y}px {radius}px {spread}px rgba({r},{g},{b},{a:.2f})"
    }


def _extract_stroke_color(stroke: dict) -> Optional[str]:
    """从 Figma stroke 提取 CSS border-color"""
    if stroke.get("type") != "SOLID":
        return None
    color = stroke.get("color", {})
    r = int(color.get("r", 0) * 255)
    g = int(color.get("g", 0) * 255)
    b = int(color.get("b", 0) * 255)
    return f"#{r:02x}{g:02x}{b:02x}"


def _extract_font_weight(style: dict) -> Optional[int]:
    """从 Figma 字体样式提取 font-weight"""
    name = style.get("fontPostScriptName", "")
    if "Bold" in name:
        return 700
    if "SemiBold" in name:
        return 600
    if "Medium" in name:
        return 500
    if "Light" in name:
        return 300
    return style.get("fontWeight", 400)


def _clean_node(node: dict) -> Optional[dict]:
    """
    递归清洗单个 Figma 节点。
    返回清洗后的节点，如果节点不可见或无意义则返回 None。
    """
    # 1. 跳过隐藏节点
    if not node.get("visible", True):
        return None

    # 2. 基础信息
    clean: dict = {
        "name": node.get("name", ""),
        "type": node.get("type", ""),
    }

    # 3. 尺寸
    bbox = node.get("absoluteBoundingBox", {})
    if bbox:
        w, h = bbox.get("width"), bbox.get("height")
        if w is not None and w > 0:
            clean["width"] = round(w, 1)
        if h is not None and h > 0:
            clean["height"] = round(h, 1)

    # 4. 透明度
    opacity = node.get("opacity")
    if opacity is not None and opacity != 1:
        clean["opacity"] = opacity

    # 5. 填充色
    fills = node.get("fills", [])
    if fills:
        bg_color = None
        for f in fills:
            color = _extract_color(f)
            if color:
                bg_color = color
                break
        if bg_color:
            clean["backgroundColor"] = bg_color

    # 6. 描边
    strokes = node.get("strokes", [])
    if strokes:
        stroke_color = None
        for s in strokes:
            color = _extract_stroke_color(s)
            if color:
                stroke_color = color
                break
        if stroke_color:
            clean["borderColor"] = stroke_color
        sw = node.get("strokeWeight", 1)
        if sw > 0:
            clean["borderWidth"] = sw

    # 7. 圆角
    cr = node.get("cornerRadius")
    if cr is not None and cr > 0:
        clean["borderRadius"] = round(cr, 1)

    # 8. 阴影
    effects = node.get("effects", [])
    shadows = []
    for e in effects:
        shadow = _extract_shadow(e)
        if shadow:
            shadows.append(shadow["value"])
    if shadows:
        clean["boxShadow"] = shadows

    # 9. 自动布局
    layout = node.get("layoutMode")
    if layout:
        clean["layoutMode"] = layout
        clean["display"] = "flex"
        if layout == "HORIZONTAL":
            clean["flexDirection"] = "row"
        elif layout == "VERTICAL":
            clean["flexDirection"] = "column"

        spacing = node.get("itemSpacing")
        if spacing is not None and spacing > 0:
            clean["gap"] = spacing

        pad_top = node.get("paddingTop", 0)
        pad_right = node.get("paddingRight", 0)
        pad_bottom = node.get("paddingBottom", 0)
        pad_left = node.get("paddingLeft", 0)
        if any([pad_top, pad_right, pad_bottom, pad_left]):
            clean["padding"] = f"{pad_top}px {pad_right}px {pad_bottom}px {pad_left}px"

        primary_align = node.get("primaryAxisAlignItems")
        if primary_align:
            align_map = {"MIN": "flex-start", "CENTER": "center", "MAX": "flex-end", "SPACE_BETWEEN": "space-between"}
            clean["justifyContent"] = align_map.get(primary_align, primary_align)

        counter_align = node.get("counterAxisAlignItems")
        if counter_align:
            align_map = {"MIN": "flex-start", "CENTER": "center", "MAX": "flex-end"}
            clean["alignItems"] = align_map.get(counter_align, counter_align)

    # 10. 文本属性（TEXT 节点）
    if node.get("type") == "TEXT":
        clean["text"] = node.get("characters", "")
        style = node.get("style", {})
        if style:
            fs = style.get("fontSize")
            if fs:
                clean["fontSize"] = fs
            ff = style.get("fontFamily")
            if ff:
                clean["fontFamily"] = ff
            fw = _extract_font_weight(style)
            if fw and fw != 400:
                clean["fontWeight"] = fw
            if fills:
                text_color = None
                for f in fills:
                    color = _extract_color(f)
                    if color:
                        text_color = color
                        break
                if text_color:
                    clean["color"] = text_color

    # 11. COMPONENT/INSTANCE 标记
    if node.get("type") in ("COMPONENT", "INSTANCE", "COMPONENT_SET"):
        clean["isComponent"] = True
        clean["componentName"] = node.get("name", "")

    # 12. 递归处理子节点
    children = node.get("children", [])
    if children:
        clean_children = []
        for child in children:
            cleaned = _clean_node(child)
            if cleaned:
                clean_children.append(cleaned)
        if clean_children:
            clean["children"] = clean_children

    return clean


def clean_figma_data(raw_data: str | dict) -> dict:
    """
    生产级数据清洗：用 Python 代码直接操作 JSON。
    100% 确定性，不依赖 LLM。
    """
    if isinstance(raw_data, str):
        data = json.loads(raw_data)
    else:
        data = raw_data

    document = data.get("document", data)
    cleaned = _clean_node(document)

    return {
        "fileName": data.get("name", ""),
        "lastModified": data.get("lastModified", ""),
        "cleanedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tree": cleaned,
    }


# ============================================
# LLM 辅助增强：在规则引擎输出的基础上补充语义理解
# 失败时安全降级，不影响基础清洗结果
# ============================================

def _collect_text_nodes(node: dict, texts: list) -> None:
    """递归收集所有 TEXT 节点信息"""
    if node.get("type") == "TEXT" and node.get("text"):
        texts.append({
            "name": node.get("name", ""),
            "text": node.get("text", ""),
            "fontSize": node.get("fontSize"),
            "fontWeight": node.get("fontWeight"),
        })
    for child in node.get("children", []):
        _collect_text_nodes(child, texts)


def _collect_colors(node: dict, colors: list) -> None:
    """递归收集所有颜色值"""
    for key in ("backgroundColor", "color", "borderColor"):
        if node.get(key):
            colors.append({"name": node.get("name", ""), "role": key, "value": node[key]})
    for child in node.get("children", []):
        _collect_colors(child, colors)


def _collect_layout_nodes(node: dict, layouts: list, path: str = "") -> None:
    """递归收集布局节点信息"""
    current_path = f"{path}/{node.get('name', '')}" if path else node.get("name", "")
    if node.get("layoutMode") or node.get("display") == "flex":
        layouts.append({
            "name": node.get("name", ""),
            "path": current_path,
            "layoutMode": node.get("layoutMode"),
            "flexDirection": node.get("flexDirection"),
            "width": node.get("width"),
            "height": node.get("height"),
            "childrenCount": len(node.get("children", [])),
            "childrenNames": [c.get("name", "") for c in node.get("children", [])[:10]],
        })
    for child in node.get("children", []):
        _collect_layout_nodes(child, layouts, current_path)


def enhance_cleaned_data_with_llm(cleaned_data: dict) -> dict:
    """
    使用 LLM 对清洗后的数据进行语义增强。
    增强内容包括：颜色语义化、文本分类、布局意图推断。
    失败时返回原始数据，不抛异常。
    """
    try:
        tree = cleaned_data.get("tree", cleaned_data)
        if not tree:
            return cleaned_data

        # 收集分析素材
        texts = []
        _collect_text_nodes(tree, texts)

        colors = []
        _collect_colors(tree, colors)

        layouts = []
        _collect_layout_nodes(tree, layouts)

        # 构造 Prompt
        prompt = build_cleaner_enhancement_prompt(
            colors=colors,
            texts=texts,
            layouts=layouts,
        )

        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content.strip()

        # 提取 JSON（处理可能的 markdown 代码块包裹）
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

        # 将增强结果附加到清洗数据
        cleaned_data["llmEnhancement"] = {
            "colorTokens": enhancement.get("colorTokens", []),
            "textRoles": enhancement.get("textRoles", []),
            "layoutIntent": enhancement.get("layoutIntent", []),
            "enhancedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }

        # 颜色 Token 化：在 tree 中标记语义颜色
        _apply_color_tokens(tree, enhancement.get("colorTokens", []))

        # 文本角色标记：在 tree 中标记文本角色
        _apply_text_roles(tree, enhancement.get("textRoles", []))

        return cleaned_data

    except Exception as e:
        # 安全降级：LLM 失败时保留原始清洗结果
        cleaned_data["llmEnhancement"] = {"error": str(e), "status": "fallback"}
        return cleaned_data


def _apply_color_tokens(node: dict, color_tokens: list) -> None:
    """将 LLM 推断的颜色 Token 应用到节点树中"""
    token_map = {}
    for ct in color_tokens:
        if isinstance(ct, dict):
            token_map[ct.get("value", "")] = ct.get("token", "")

    if not token_map:
        return

    # 递归遍历树，替换颜色值为 CSS 变量引用
    def _walk(n):
        for key in ("backgroundColor", "color", "borderColor"):
            if n.get(key) and n[key] in token_map:
                token = token_map[n[key]]
                n[f"{key}Token"] = token
        for child in n.get("children", []):
            _walk(child)

    _walk(node)


def _apply_text_roles(node: dict, text_roles: list) -> None:
    """将 LLM 推断的文本角色应用到节点树中"""
    role_map = {}
    for tr in text_roles:
        if isinstance(tr, dict):
            role_map[tr.get("text", "")] = tr.get("role", "")

    if not role_map:
        return

    def _walk(n):
        if n.get("text") and n["text"] in role_map:
            n["textRole"] = role_map[n["text"]]
        for child in n.get("children", []):
            _walk(child)

    _walk(node)
