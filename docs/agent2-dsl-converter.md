# Agent 2: 结构化转换 — 详细设计文档

## 概述

Agent 2 负责将清洗后的 Figma 数据转换为结构化组件 DSL（Domain Specific Language）。Figma 的节点树是平面化的图形描述（FRAME/TEXT/RECTANGLE），前端需要的是组件树（container/button/input/table）。

**核心原则**：100% 用 Python 规则引擎处理，不使用 LLM。

---

## 输入 → 输出对比

### 输入（Agent 1 清洗后的数据）

```json
{
  "name": "LoginForm",
  "type": "FRAME",
  "width": 400,
  "backgroundColor": "#1A1C26",
  "borderRadius": 12,
  "display": "flex",
  "flexDirection": "column",
  "gap": 16,
  "padding": "24px 24px 24px 24px",
  "children": [
    {
      "name": "username-input",
      "type": "INSTANCE",
      "width": 352,
      "height": 44,
      "isComponent": true
    },
    {
      "name": "login-button",
      "type": "FRAME",
      "width": 352,
      "height": 48,
      "backgroundColor": "#2EA043",
      "borderRadius": 8,
      "children": [
        { "name": "登录", "type": "TEXT", "text": "登 录", "fontSize": 16, "color": "#ffffff" }
      ]
    }
  ]
}
```

### 输出（组件 DSL）

```json
{
  "pageName": "登录页",
  "framework": "react",
  "componentLib": "element-plus",
  "components": [
    {
      "name": "LoginForm",
      "type": "container",
      "styles": {
        "width": 400,
        "backgroundColor": "#1A1C26",
        "borderRadius": 12,
        "display": "flex",
        "flexDirection": "column",
        "gap": 16,
        "padding": "24px 24px 24px 24px"
      },
      "layout": { "mode": "VERTICAL", "hasAutoLayout": true },
      "children": [
        {
          "name": "username-input",
          "type": "input",
          "styles": { "width": 352, "height": 44 },
          "props": { "componentName": "username-input" }
        },
        {
          "name": "login-button",
          "type": "button",
          "styles": { "width": 352, "height": 48, "backgroundColor": "#2EA043", "borderRadius": 8 },
          "props": { "text": "登 录" },
          "children": [
            { "name": "登录", "type": "text", "styles": { "fontSize": 16, "color": "#ffffff" }, "props": { "text": "登 录" } }
          ]
        }
      ]
    }
  ]
}
```

---

## 核心转换规则

### 规则 1: Figma 类型 → 组件类型映射

```python
TYPE_MAP = {
    "FRAME": "container",      # 布局容器
    "GROUP": "container",      # 分组容器
    "RECTANGLE": "box",        # 矩形块
    "TEXT": "text",            # 文本
    "COMPONENT": "component",  # 组件定义
    "INSTANCE": "component",   # 组件实例
    "COMPONENT_SET": "component",
    "ELLIPSE": "box",          # 椭圆
    "LINE": "box",             # 线条
    "VECTOR": "box",           # 矢量图形
    "POLYGON": "box",
    "STAR": "box",
    "BOOLEAN_OPERATION": "container",
}
```

### 规则 2: 图层命名 → 组件类型智能推断

根据图层名称的关键词推断具体的组件类型。这是最重要的规则，因为 Figma 的 `type` 字段只能区分 FRAME/TEXT 等基础类型，无法区分 button/input/table 等业务组件。

```python
NAME_TYPE_HINTS = {
    # 表单类
    "button": "button", "btn": "button",
    "input": "input", "textfield": "input", "textbox": "input",
    "checkbox": "checkbox", "radio": "radio",
    "select": "select", "dropdown": "select",
    "slider": "slider", "switch": "switch", "toggle": "switch",

    # 数据展示
    "table": "table", "datagrid": "table",
    "card": "card",
    "list": "list",
    "avatar": "avatar",
    "badge": "badge", "tag": "tag",
    "image": "image", "img": "image", "icon": "icon",

    # 导航
    "menu": "menu", "navbar": "navbar", "sidebar": "sidebar",
    "tab": "tabs", "tabs": "tabs",
    "breadcrumb": "breadcrumb",
    "pagination": "pagination",

    # 反馈
    "modal": "modal", "dialog": "modal",
    "tooltip": "tooltip", "popover": "popover",
    "progress": "progress",
    "loading": "loading", "spinner": "spinner",

    # 布局
    "header": "header", "footer": "footer",
    "divider": "divider", "separator": "divider",
    "form": "form",
}
```

**推断逻辑**：

```python
def _infer_component_type(node: dict) -> str:
    name = node.get("name", "").lower()
    # 去掉空格、连字符、下划线
    name = name.replace(" ", "").replace("-", "").replace("_", "")

    # TEXT 类型固定为 text
    if node.get("type") == "TEXT":
        return "text"

    # 按关键词匹配
    for keyword, comp_type in NAME_TYPE_HINTS.items():
        if keyword in name:
            return comp_type

    # 兜底：Figma 类型映射
    return TYPE_MAP.get(node.get("type", ""), "container")
```

**示例**：

| 图层名 | 推断结果 | 原因 |
|--------|---------|------|
| `login-button` | `button` | 匹配 "button" |
| `username-input` | `input` | 匹配 "input" |
| `user-table` | `table` | 匹配 "table" |
| `confirm-modal` | `modal` | 匹配 "modal" |
| `Header` | `header` | 匹配 "header" |
| `Rectangle 1` | `box` | 无匹配 → 用 TYPE_MAP |

### 规则 3: 样式透传

清洗后的数据已经是 CSS 格式，直接透传：

```python
styles = {}
for key in ["width", "height", "opacity", "backgroundColor",
             "borderColor", "borderWidth", "borderRadius",
             "boxShadow", "display", "flexDirection",
             "justifyContent", "alignItems", "gap", "padding",
             "fontSize", "fontFamily", "fontWeight", "color"]:
    if key in node:
        styles[key] = node[key]
```

### 规则 4: Props 提取

从节点属性中提取组件 Props：

```python
props = {}
# 文本内容
if node.get("text"):
    props["text"] = node["text"]
# 组件信息
if node.get("isComponent"):
    props["componentName"] = node.get("componentName", "")
```

### 规则 5: 布局信息保留

自动布局信息单独记录，方便 Agent 4 生成代码时处理：

```python
if node.get("layoutMode"):
    component["layout"] = {
        "mode": node["layoutMode"],    # HORIZONTAL / VERTICAL
        "hasAutoLayout": True,
    }
```

### 规则 6: 递归转换子节点

```python
children = node.get("children", [])
if children:
    component["children"] = [
        _node_to_dsl_component(child, depth + 1)
        for child in children
    ]
```

---

## DSL 完整格式

```json
{
  "pageName": "页面名称（来自 Figma 文件名）",
  "framework": "react | vue2 | nextjs",
  "componentLib": "element-plus | antd | shadcn",
  "convertedAt": "2026-06-04T01:00:00",
  "components": [
    {
      "name": "组件名（来自 Figma 图层名）",
      "type": "button | input | table | modal | container | text | ...",
      "styles": {
        "width": 400,
        "backgroundColor": "#1A1C26",
        "borderRadius": 12,
        "display": "flex",
        "flexDirection": "column",
        "gap": 16,
        "padding": "24px"
      },
      "props": {
        "text": "登录",
        "componentName": "LoginButton"
      },
      "layout": {
        "mode": "VERTICAL",
        "hasAutoLayout": true
      },
      "children": [ ... ]
    }
  ]
}
```

---

## 处理流程

```
清洗后的 Figma 数据
    │
    ▼
convert_to_dsl_python()
    │
    ├── 提取 pageName (fileName)
    ├── 记录 framework, componentLib
    │
    └── 遍历 tree.children
            │
            └── _node_to_dsl_component(每个子节点)
                    │
                    ├── _infer_component_type() → 推断组件类型
                    ├── 提取 styles (透传 CSS 属性)
                    ├── 提取 props (text, componentName)
                    ├── 提取 layout (自动布局信息)
                    └── 递归处理 children
    │
    ▼
输出 DSL JSON
```

---

## 代码位置

`apps/server/main.py`

| 函数 | 职责 |
|------|------|
| `convert_to_dsl_python()` | 入口函数，接收清洗后的数据 + framework + componentLib |
| `_node_to_dsl_component()` | 递归转换单个节点为 DSL 组件 |
| `_infer_component_type()` | 根据图层名推断组件类型 |

---

## 为什么不使用 LLM？

| 对比维度 | LLM 方式 | Python 规则引擎 |
|---------|---------|---------------|
| 确定性 | ❌ 同一个 FRAME 可能被推断为不同组件 | ✅ 规则固定，结果一致 |
| 速度 | ❌ 秒级 | ✅ 毫秒级 |
| 可扩展性 | ❌ 加规则要改 Prompt | ✅ 加一行 KEYWORDS 字典即可 |
| 准确性 | ❌ 可能错误推断 | ✅ 规则明确，行为可预测 |

**结论**：结构化转换本质是字段映射 + 关键词匹配，不需要 AI。Python 规则引擎是最佳方案。

---

## 测试用例

### 用例 1: 按钮推断

**输入**：
```json
{ "name": "submit-btn", "type": "FRAME", "backgroundColor": "#2EA043" }
```

**预期输出**：
```json
{ "name": "submit-btn", "type": "button", "styles": { "backgroundColor": "#2EA043" } }
```

### 用例 2: 输入框推断

**输入**：
```json
{ "name": "email-input", "type": "INSTANCE", "isComponent": true }
```

**预期输出**：
```json
{ "name": "email-input", "type": "input", "props": { "componentName": "email-input" } }
```

### 用例 3: 未知组件兜底

**输入**：
```json
{ "name": "decorative-box", "type": "RECTANGLE" }
```

**预期输出**：
```json
{ "name": "decorative-box", "type": "box" }
```
