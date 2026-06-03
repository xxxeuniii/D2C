# Agent 3: 知识检索 — 详细设计文档

## 概述

Agent 3 负责从 ChromaDB 知识库检索组件库文档，附加到 DSL 中。Agent 4 生成代码时，LLM 可以参照这些文档确保组件 API 用法正确。

**核心原则**：直接调用 ChromaDB 的 Python API，不使用 LLM。

---

## 为什么需要 Agent 3？

Agent 4 的 LLM 是通用模型，它可能不知道某个组件库的具体 API：

```
❌ 没有 Agent 3:
   DSL: { type: "button" }
   LLM 生成: <button>登录</button>  ← 不知道要用 <el-button>

✅ 有 Agent 3:
   DSL: { type: "button" }
   → 检索: "element-plus button 组件 API 用法 示例"
   → 获取: "使用 <el-button type='primary'> 创建按钮，支持 size/disabled/loading 等属性"
   LLM 生成: <el-button type="primary">登录</el-button>  ← 正确使用组件库
```

---

## 输入 → 输出

### 输入（Agent 2 的 DSL）

```json
{
  "pageName": "登录页",
  "framework": "vue2",
  "componentLib": "element-plus",
  "components": [
    { "name": "login-form", "type": "container", "children": [
      { "name": "username", "type": "input" },
      { "name": "submit", "type": "button", "props": { "text": "登录" } },
      { "name": "user-table", "type": "table" }
    ]}
  ]
}
```

### 输出（带文档的 DSL）

```json
{
  "pageName": "登录页",
  "framework": "vue2",
  "componentLib": "element-plus",
  "components": [ ... ],
  "componentDocs": {
    "input": "<el-input> 组件用法: v-model 双向绑定, placeholder 占位符, clearable 可清空...",
    "button": "<el-button> 组件用法: type 属性控制样式(primary/success/warning), size 控制大小...",
    "table": "<el-table> 组件用法: data 属性绑定数据源, <el-table-column> 定义列, prop 绑定字段..."
  }
}
```

---

## 检索流程

### 步骤 1: 解析 DSL，提取组件类型

```python
def collect_types(components):
    types = set()
    for c in components:
        ct = c.get("type", "")
        # 跳过基础类型（container, box, text），这些不需要文档
        if ct and ct not in ("container", "box", "text"):
            types.add(ct)
        # 递归处理子组件
        if c.get("children"):
            types.update(collect_types(c["children"]))
    return types

# 示例输入: [button, input, container, table, text]
# 输出: {"button", "input", "table"}  ← 过滤了 container 和 text
```

**为什么过滤 container/box/text**：
- `container`: 就是个 div，不需要组件文档
- `box`: 就是个 div，不需要组件文档
- `text`: 就是 `<span>` / `<p>`，不需要组件文档

### 步骤 2: 构造检索查询

```python
for comp_type in component_types:
    # 查询格式: "{组件库名} {组件类型} 组件 API 用法 示例"
    query = f"{component_lib} {comp_type} 组件 API 用法 示例"

    # 示例:
    # "element-plus button 组件 API 用法 示例"
    # "antd table 组件 API 用法 示例"
    # "shadcn dialog 组件 API 用法 示例"
```

### 步骤 3: 调用 ChromaDB 检索

```python
results = collection.query(
    query_texts=[query],
    n_results=2,  # 每个类型取 top-2
)

# results 结构:
# {
#   "ids": [["doc_001_0", "doc_001_1"]],
#   "documents": [["<el-button> 用法文档...", "Button 组件 API..."]],
#   "metadatas": [[{...}, {...}]],
#   "distances": [[0.23, 0.45]]
# }
```

### 步骤 4: 截取并附加到 DSL

```python
docs[comp_type] = results["documents"][0][0][:800]  # 取第一个结果，截取 800 字符

dsl["componentDocs"] = docs
dsl["componentLib"] = component_lib
```

---

## 向量数据库配置

### ChromaDB 初始化

```python
import chromadb
from chromadb.utils import embedding_functions

# Embedding 函数: 使用 SiliconFlow 托管的 BGE-M3
ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key="sk-xxx",
    api_base="https://api.siliconflow.cn/v1",
    model_name="BAAI/bge-m3",
)

# 持久化存储
chroma_client = chromadb.PersistentClient(
    path="./chroma_data",
    settings=Settings(anonymized_telemetry=False),
)

# 获取或创建 Collection
collection = chroma_client.get_or_create_collection(
    name="design_specs",
    embedding_function=ef,
)
```

### 数据存储结构

| 字段 | 内容 | 示例 |
|------|------|------|
| `id` | `{doc_id}_{chunk_index}` | `doc_1234567890_0` |
| `document` | 文档片段文本 | `<el-button> 是 Element Plus 的按钮组件...` |
| `metadata.name` | 文档名 | `element-plus-button.md` |
| `metadata.doc_id` | 文档 ID | `doc_1234567890` |
| `metadata.chunk_index` | 片段序号 | `0` |

---

## 处理流程

```
DSL JSON
    │
    ▼
search_component_docs()
    │
    ├── json.loads(dsl) 解析 DSL
    ├── collect_types(components) 收集组件类型
    │      │
    │      └── 递归遍历 components tree
    │      └── 过滤 container/box/text
    │      └── 去重 → {"button", "input", "table"}
    │
    ├── 对每个类型:
    │      ├── 构造 query = "{lib} {type} 组件 API 用法 示例"
    │      ├── collection.query(query_texts=[query], n_results=2)
    │      └── docs[type] = results["documents"][0][0][:800]
    │
    ├── dsl["componentDocs"] = docs
    └── dsl["componentLib"] = component_lib
    │
    ▼
带文档的 DSL JSON
```

---

## 代码位置

`apps/server/main.py`

| 函数 | 职责 |
|------|------|
| `search_component_docs()` | `@tool` 函数，入口 |
| `collect_types()` | 递归收集组件类型（内嵌在 search_component_docs 中） |

---

## 知识库准备

Agent 3 依赖知识库中有组件文档。上传方式：

### 方式 1: 前端上传（Knowledge Base 页面）

在 `http://localhost:3000/knowledge` 页面，上传 MD/PDF/TXT 格式的组件文档。

### 方式 2: API 上传

```bash
curl -X POST http://localhost:8080/api/rag/upload \
  -F "file=@element-plus-button.md" \
  -F "name=element-plus-button"
```

### 建议上传的文档

| 文档 | 内容 |
|------|------|
| `element-plus-button.md` | el-button 的 type/size/disabled/loading 等 API |
| `element-plus-input.md` | el-input 的 v-model/placeholder/clearable 等 API |
| `element-plus-table.md` | el-table 的 data/columns/pagination 等 API |
| `element-plus-form.md` | el-form 的 model/rules/validate 等 API |
| `antd-button.md` | Button 的 type/size/loading/icon 等 API |
| ... | ... |

---

## 容错处理

```python
try:
    # 检索逻辑
    ...
except Exception as e:
    # 检索失败时返回原始 DSL + 错误信息
    return json.dumps({
        "error": str(e),
        "dsl": original_dsl,
    })
```

即使检索失败，流水线仍会继续。Agent 4 会收到带 `error` 字段的 DSL，LLM 可以自行判断如何处理。

---

## 测试用例

### 用例 1: 正常检索

**输入 DSL**:
```json
{ "components": [{ "type": "button" }, { "type": "input" }] }
```

**知识库中有** `element-plus-button.md` 和 `element-plus-input.md`

**预期输出**:
```json
{
  "components": [...],
  "componentDocs": {
    "button": "<el-button> 用法...",
    "input": "<el-input> 用法..."
  }
}
```

### 用例 2: 部分匹配

**输入 DSL**:
```json
{ "components": [{ "type": "button" }, { "type": "custom-widget" }] }
```

**知识库中只有** `element-plus-button.md`

**预期输出**:
```json
{
  "components": [...],
  "componentDocs": {
    "button": "<el-button> 用法..."
    // custom-widget 没有匹配的文档，不出现在 componentDocs 中
  }
}
```

### 用例 3: 知识库为空

**输入 DSL**:
```json
{ "components": [{ "type": "button" }] }
```

**知识库中无文档**

**预期输出**:
```json
{
  "components": [...],
  "componentDocs": {}
}
```
