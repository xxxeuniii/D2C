# Agent 1: 数据清洗 — 详细设计文档

## 概述

Agent 1 负责清洗 Figma REST API 返回的原始 JSON 数据，去掉前端渲染不需要的冗余字段，将 Figma 内部格式转换为前端可直接使用的 CSS 属性。

**核心原则**：100% 用 Python 代码处理，不使用 LLM，保证确定性。

---

## Figma 原始数据 → 清洗后数据 对比

### 原始 Figma 节点（一个 FRAME）

```json
{
  "id": "2:1",
  "name": "Login Form",
  "type": "FRAME",
  "visible": true,
  "locked": false,
  "absoluteBoundingBox": { "x": 100, "y": 200, "width": 400, "height": 500 },
  "constraints": { "vertical": "TOP", "horizontal": "LEFT" },
  "layoutMode": "VERTICAL",
  "primaryAxisAlignItems": "CENTER",
  "counterAxisAlignItems": "CENTER",
  "paddingTop": 24, "paddingRight": 24, "paddingBottom": 24, "paddingLeft": 24,
  "itemSpacing": 16,
  "layoutSizingHorizontal": "FIXED",
  "layoutSizingVertical": "HUG",
  "clipsContent": true,
  "fills": [
    {
      "blendMode": "NORMAL",
      "type": "SOLID",
      "color": { "r": 0.1, "g": 0.11, "b": 0.15, "a": 1 }
    }
  ],
  "strokes": [
    {
      "blendMode": "NORMAL",
      "type": "SOLID",
      "color": { "r": 1, "g": 1, "b": 1, "a": 0.08 }
    }
  ],
  "strokeWeight": 1,
  "cornerRadius": 12,
  "effects": [
    {
      "type": "DROP_SHADOW",
      "visible": true,
      "color": { "r": 0, "g": 0, "b": 0, "a": 0.3 },
      "offset": { "x": 0, "y": 4 },
      "radius": 12,
      "spread": 0
    },
    {
      "type": "INNER_SHADOW",
      "visible": true,
      "color": { "r": 1, "g": 1, "b": 1, "a": 0.1 }
    }
  ]
}
```

### 清洗后

```json
{
  "name": "Login Form",
  "type": "FRAME",
  "width": 400,
  "height": 500,
  "backgroundColor": "#1A1C26",
  "borderColor": "#ffffff",
  "borderWidth": 1,
  "borderRadius": 12,
  "boxShadow": ["0px 4px 12px 0px rgba(0,0,0,0.30)"],
  "display": "flex",
  "flexDirection": "column",
  "justifyContent": "center",
  "alignItems": "center",
  "gap": 16,
  "padding": "24px 24px 24px 24px"
}
```

---

## 过滤规则详解

### 规则 1: 移除顶层冗余字段

这些字段是 Figma 文件的元信息，前端渲染不需要：

```
id, lastModified, version, description, editorType,
styleType, remote, scrollBehavior, componentPropertyDefinitions,
constraints, layoutGrids, exportSettings, transitionNodeID,
transitionDuration, transitionEasing, isAsset, backgroundColor,
prototypeStartNodeID, flowStartingPoints, prototypeDevice
```

**为什么去掉**：
- `id`: Figma 内部标识，前端组件用自己生成的 key
- `lastModified`, `version`: 编辑时间/版本，前端不关心
- `description`: 设计师备注
- `editorType`: 编辑器类型（"figma"）
- `constraints`: Figma 布局约束系统，前端用 CSS 的 position/flex/grid 替代
- `layoutGrids`: Figma 网格系统，前端用 CSS Grid

### 规则 2: 移除节点级冗余字段

每个节点上的这些字段对前端渲染无用：

```
id, guid, scrollBehavior, componentPropertyDefinitions,
constraints, layoutGrids, exportSettings, transitionNodeID,
transitionDuration, transitionEasing, isAsset,
pluginData, sharedPluginData, componentPropertyReferences,
explicitVariableModes, boundVariables, layoutPositioning,
individualStrokeWeights, description, remote,
locked, exportSettings, blendMode, preserveRatio,
layoutAlign, layoutGrow, layoutSizingHorizontal, layoutSizingVertical,
clipsContent, mask, maskType, rectangleCornerRadii,
cornerSmoothing, topLeftRadius, topRightRadius,
bottomLeftRadius, bottomRightRadius,
dashPattern, strokeAlign, strokeCap, strokeJoin,
strokeMiterLimit, strokeWeight, strokeDashes,
textAutoResize, textTruncation, maxLines, textAlignHorizontal,
textAlignVertical, paragraphIndent, paragraphSpacing,
textCase, textDecoration, letterSpacing, lineHeightPx,
lineHeightPercent, lineHeightUnit, hyperlink,
styleId, styles, componentId
```

**为什么去掉**：
- `pluginData`, `sharedPluginData`: 插件数据，前端不需要
- `layoutSizingHorizontal/Vertical`: Figma 的 HUG/FIXED/FILL 模式，前端用 CSS width/height 处理
- `clipsContent`: Figma 裁剪，前端用 `overflow: hidden`
- `rectangleCornerRadii` 等独立圆角：统一用 `cornerRadius` 或 CSS `border-radius`
- `textAutoResize`, `lineHeightPx`, `letterSpacing` 等：Figma 文本引擎属性，前端用 CSS 的 `font-size`, `line-height`, `letter-spacing`

### 规则 3: 跳过隐藏节点

```python
if not node.get("visible", True):
    return None  # 整个节点跳过，包括子节点
```

`visible: false` 的图层前端不渲染，直接丢弃整个子树。

### 规则 4: 颜色转换（RGBA → CSS）

Figma 使用 0-1 范围的 RGBA，前端需要 hex 或 rgba：

```python
def _extract_color(fill: dict) -> Optional[str]:
    """
    Figma: { r: 0.1, g: 0.11, b: 0.15, a: 1 }
    → 完全透明时: "#1A1C26"
    → 半透明时: "rgba(26, 28, 38, 0.50)"
    """
    if fill.get("type") != "SOLID":
        return None  # 跳过渐变、图片等非纯色填充
    color = fill.get("color", {})
    r = int(color.get("r", 0) * 255)
    g = int(color.get("g", 0) * 255)
    b = int(color.get("b", 0) * 255)
    a = fill.get("opacity", 1)
    if a < 1:
        return f"rgba({r}, {g}, {b}, {a:.2f})"
    return f"#{r:02x}{g:02x}{b:02x}"
```

### 规则 5: 阴影转换（Figma Effect → CSS box-shadow）

```python
def _extract_shadow(effect: dict) -> Optional[dict]:
    """
    只保留 DROP_SHADOW 类型，INNER_SHADOW 丢弃。

    Figma: { offset: {x:0, y:4}, radius:12, spread:0, color: {r:0,g:0,b:0,a:0.3} }
    → CSS: "0px 4px 12px 0px rgba(0,0,0,0.30)"
    """
    if effect.get("type") != "DROP_SHADOW":
        return None
    # ... 转换逻辑
```

### 规则 6: 描边转换（Figma Stroke → CSS border）

```python
def _extract_stroke_color(stroke: dict) -> Optional[str]:
    """
    取第一个 SOLID 类型描边的颜色。
    宽度从 strokeWeight 字段获取。
    """
```

### 规则 7: 字体粗细推断

```python
def _extract_font_weight(style: dict) -> Optional[int]:
    """
    Figma 的 fontPostScriptName 包含字体粗细信息：
    - "Inter-Bold" → 700
    - "Inter-SemiBold" → 600
    - "Inter-Medium" → 500
    - "Inter-Light" → 300
    否则使用 fontWeight 字段的值
    """
```

### 规则 8: 自动布局 → Flexbox 映射

```python
# 布局方向
if node.get("layoutMode") == "HORIZONTAL":
    clean["flexDirection"] = "row"
elif node.get("layoutMode") == "VERTICAL":
    clean["flexDirection"] = "column"

# 间距
spacing = node.get("itemSpacing")
if spacing and spacing > 0:
    clean["gap"] = spacing  # CSS gap 属性

# 内边距
clean["padding"] = f"{top}px {right}px {bottom}px {left}px"

# 主轴对齐
primary_align_map = {
    "MIN": "flex-start",
    "CENTER": "center",
    "MAX": "flex-end",
    "SPACE_BETWEEN": "space-between"
}

# 交叉轴对齐
counter_align_map = {
    "MIN": "flex-start",
    "CENTER": "center",
    "MAX": "flex-end"
}
```

### 规则 9: 文本节点特殊处理

TEXT 类型节点提取文本内容、字体、颜色：

```python
if node.get("type") == "TEXT":
    clean["text"] = node.get("characters", "")      # 文本内容
    clean["fontSize"] = style.get("fontSize")        # 字号
    clean["fontFamily"] = style.get("fontFamily")    # 字体
    clean["fontWeight"] = _extract_font_weight(style) # 字重
    clean["color"] = _extract_color(first_fill)       # 文本颜色（覆盖背景色）
```

### 规则 10: 组件标记

COMPONENT/INSTANCE 类型标记为业务组件：

```python
if node.get("type") in ("COMPONENT", "INSTANCE", "COMPONENT_SET"):
    clean["isComponent"] = True
    clean["componentName"] = node.get("name", "")
```

---

## 处理流程

```
原始 Figma JSON
    │
    ▼
json.loads() 解析
    │
    ▼
clean_figma_data_python()
    │
    ├── 提取 fileName, lastModified
    │
    └── _clean_node(document)
            │
            ├── 1. 检查 visible → false 则跳过
            ├── 2. 提取 name, type
            ├── 3. 提取 width, height (从 absoluteBoundingBox)
            ├── 4. 提取 opacity
            ├── 5. 提取 fills → backgroundColor (RGBA→hex/rgba)
            ├── 6. 提取 strokes → borderColor + borderWidth
            ├── 7. 提取 cornerRadius → borderRadius
            ├── 8. 提取 effects → boxShadow (只保留 DROP_SHADOW)
            ├── 9. 提取 layoutMode → display:flex + flexDirection + gap + padding + justifyContent + alignItems
            ├── 10. TEXT 节点特殊处理: text, fontSize, fontFamily, fontWeight, color
            ├── 11. COMPONENT/INSTANCE 标记: isComponent, componentName
            └── 12. 递归处理 children
    │
    ▼
输出清洗后的 JSON
```

---

## 代码位置

`apps/server/main.py`

| 函数 | 职责 |
|------|------|
| `clean_figma_data_python()` | 入口函数，接收原始 JSON 字符串，返回清洗后的 dict |
| `_clean_node()` | 递归清洗单个节点，返回清洗后的 dict 或 None |
| `_extract_color()` | Figma RGBA → CSS hex/rgba |
| `_extract_shadow()` | Figma Effect → CSS box-shadow |
| `_extract_stroke_color()` | Figma Stroke → CSS border-color |
| `_extract_font_weight()` | 字体粗细推断 |

---

## 为什么不使用 LLM？

| 对比维度 | LLM 方式 | Python 代码方式 |
|---------|---------|---------------|
| 确定性 | ❌ 每次结果可能不同 | ✅ 100% 确定 |
| 速度 | ❌ 需要网络调用，秒级 | ✅ 毫秒级 |
| 成本 | ❌ 消耗 Token | ✅ 免费 |
| 准确性 | ❌ 可能遗漏或误删字段 | ✅ 精确控制每个字段 |
| 可维护性 | ❌ 依赖 Prompt 调优 | ✅ 代码逻辑清晰 |
| 大文件处理 | ❌ Token 限制（8K-32K） | ✅ 无限制 |

**结论**：数据清洗是确定性任务，不需要 AI 参与。Python 代码处理 JSON 是唯一正确的做法。

---

## 测试用例

### 输入：隐藏图层

```json
{ "name": "Hidden", "type": "FRAME", "visible": false, "children": [...] }
```

### 预期输出

```python
None  # 整个节点被跳过
```

### 输入：颜色转换

```json
{ "fills": [{ "type": "SOLID", "color": { "r": 0.1, "g": 0.63, "b": 0.26, "a": 1 } }] }
```

### 预期输出

```json
{ "backgroundColor": "#1AA126" }
```

### 输入：阴影过滤

```json
{
  "effects": [
    { "type": "DROP_SHADOW", "offset": { "x": 0, "y": 2 }, "radius": 8, "color": { "r": 0, "g": 0, "b": 0, "a": 0.2 } },
    { "type": "INNER_SHADOW", "color": { "r": 1, "g": 1, "b": 1, "a": 0.1 } }
  ]
}
```

### 预期输出

```json
{ "boxShadow": ["0px 2px 8px 0px rgba(0,0,0,0.20)"] }
```
（INNER_SHADOW 被过滤）
