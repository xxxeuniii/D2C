"""
Agent 1: 数据清洗（生产级：Python 代码直接操作 JSON）
不用 LLM！用确定性的 Python 代码处理。
"""
import json
import time
from typing import Optional

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
