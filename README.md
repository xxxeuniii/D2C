# D2C - Design to Code Platform

## 项目简介

基于 LangChain 多 Agent 架构，将 Figma 设计稿到代码的全流程拆分为独立 Agent 流水线（数据清洗 → 结构化转换 → 知识检索 → 代码生成 → 测试验证），每个 Agent 基于 LLM + Tool + Memory 独立决策，Agent 间通过 DSL 传递结构化数据，结合 RAG 检索增强与 AST 代码分析，实现端到端自动化。

- 输入 Figma 设计链接 → 5 个 AI Agent 协同工作 → 输出可运行的前端代码
- 支持 React / Vue 2 / Next.js
- 支持 Element Plus / Ant Design / shadcn/ui 组件库
- 内置 RAG 知识库（ChromaDB），可上传设计规范文档

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + React 18 + TypeScript + Tailwind CSS |
| 后端 | FastAPI (Python) |
| AI 框架 | LangChain (Agent / Tool / Memory / Chain) |
| LLM | DeepSeek-V3 / Qwen2.5-7B (SiliconFlow) |
| Embedding | BGE-M3 (SiliconFlow) |
| 向量数据库 | ChromaDB |
| 代码分析 | AST + LLM |

---

## 5 Agent 协同流水线

```
Figma URL → Agent1(清洗) → Agent2(结构化) → Agent3(检索) → Agent4(生成) → Agent5(验证) → 代码输出
```

### Agent 1: 数据清洗

**职责**：清洗 Figma 原始 JSON，去掉前端渲染不需要的冗余字段。

**实现方式**：**纯 Python 代码**，`_clean_node()` 函数递归遍历 JSON 树，确定性过滤。**不使用 LLM。**

**核心函数**：`clean_figma_data_python()` → 调用 `_clean_node()` 递归清洗每个节点。

**去掉的字段**：
- 内部 ID (`id`)、编辑时间 (`lastModified`)、版本号 (`version`)
- 用户备注 (`description`)、编辑器类型 (`editorType`)
- Figma 内部样式类型 (`styleType`)、远程组件标记 (`remote`)
- `visible: false` 的隐藏图层（前端不渲染）
- 空的 `children: []` 数组
- 滚动行为 (`scrollBehavior`)、组件属性定义 (`componentPropertyDefinitions`)
- 所有 null/undefined/空字符串字段
- `absoluteBoundingBox` 中的 x, y（只保留 width, height）
- `constraints`（Figma 布局约束，用 CSS 替代）
- `layoutGrids`（Figma 网格，用 CSS Grid 替代）
- `effects` 中非 DROP_SHADOW 类型（前端只关心阴影）

**保留的字段**：name, type, width, height, fills, strokes, cornerRadius, opacity, fontSize, fontFamily, fontWeight, layoutMode, padding, itemSpacing, characters, children（递归清洗）

**✅ 生产级**：100% 确定性，Python 代码直接操作 JSON。Figma 颜色值（RGBA）自动转为 CSS hex/rgba，阴影效果转为 CSS box-shadow，自动布局转为 Flexbox。

---

### Agent 2: 结构化转换

**职责**：将清洗后的 Figma 数据转换为组件 DSL（领域描述语言），让 LLM 更容易理解。

**实现方式**：**纯 Python 规则引擎**，`_node_to_dsl_component()` 递归转换。**不使用 LLM。**

**核心函数**：`convert_to_dsl_python()` → 遍历清洗后的节点树 → `_infer_component_type()` 根据图层名智能推断组件类型 → 输出 DSL。

**转换规则**：

| Figma 节点 | DSL 输出 |
|-----------|---------|
| FRAME | Container/Page 组件 |
| TEXT | Text/Label 组件 |
| RECTANGLE | Box/Div 组件 |
| COMPONENT/INSTANCE | 对应业务组件 |
| layoutMode=HORIZONTAL | flex-direction: row |
| layoutMode=VERTICAL | flex-direction: column |
| fills | backgroundColor/color |
| cornerRadius | border-radius |
| strokes | border |
| effects(DROP_SHADOW) | box-shadow |

**DSL 输出格式**：
```json
{
  "pageName": "登录页",
  "framework": "vue2",
  "componentLib": "element-plus",
  "components": [
    {
      "name": "LoginForm",
      "type": "container",
      "props": { "width": "400px" },
      "styles": { "display": "flex", "flexDirection": "column", "padding": "24px" },
      "children": [
        { "name": "UsernameInput", "type": "input", "props": { "placeholder": "请输入用户名" } },
        { "name": "LoginButton", "type": "button", "props": { "text": "登录" } }
      ]
    }
  ]
}
```

**✅ 生产级**：100% 确定性。支持 20+ 种图层命名关键词自动推断组件类型（如 `button`→button, `input`→input），Figma 自动布局直接映射 Flexbox，颜色/阴影/圆角等样式精确转换。

---

### Agent 3: 知识检索

**职责**：从 ChromaDB 知识库检索组件库文档，附加到 DSL 中，让代码生成时有参考。

**实现方式**：`@tool` 函数 `search_component_docs()`，**直接用 Python 代码操作 ChromaDB**，不依赖 LLM。

**检索流程**：
1. 解析 DSL JSON，递归遍历所有 components
2. 收集所有组件类型（如 button, input, table），去重
3. 对每个组件类型，构造查询 `"{组件库名} {组件类型} 组件 用法 API"`
4. 调用 `collection.query()` 检索 top-2 结果
5. 将文档片段（前 500 字符）附加到 DSL 的 `componentDocs` 字段

**示例输出**：
```json
{
  "...DSL...,
  "componentDocs": {
    "button": "<el-button> 用法文档...",
    "input": "<el-input> API 文档..."
  }
}
```

**依赖**：ChromaDB + BGE-M3 Embedding（通过 SiliconFlow API）

**✅ 优点**：不依赖 LLM，确定性高。直接 Python 代码操作 ChromaDB。

**检索策略**：对 DSL 中每种组件类型，构造 `"{组件库} {组件类型} 组件 API 用法 示例"` 查询，取 top-2 结果。

---

### Agent 4: 代码生成

**职责**：根据 DSL + 组件文档生成完整的页面代码。

**实现方式**：`@tool` 函数 `generate_page_code()`，将 DSL + 组件文档发给 **DeepSeek-V3**（8192 tokens），生成完整代码。

**使用的 LLM**：`deepseek-ai/DeepSeek-V3`（比 Agent 1/2 的 Qwen2.5-7B 更强，专为代码优化）

**生成规则**：
- 严格按照 DSL 组件结构排列
- 优先使用组件库组件（如 `<el-button>`, `<a-button>`）
- 使用 Tailwind CSS 暗色主题
- Vue: template + script + style 完整文件
- React: TSX + TypeScript 类型定义
- 组件库文档中的 API 用法严格遵循

**✅ 优点**：使用更强的代码生成模型，max_tokens=8192 支持长代码输出。

---

### Agent 5: 测试验证

**职责**：验证代码质量并自动修复问题。

**实现方式**：`@tool` 函数 `validate_and_fix()`，**双重验证**：先用 Python `_ast_syntax_check()` 做静态分析，再用 **DeepSeek-V3** 做深度审查和修复。

**检查项目**：
1. **括号/标签匹配**：`{ }`, `( )`, `[ ]` 和 HTML/JSX 标签闭合
2. **导入检查**：Vue 组件缺少 import/export，React 缺少 React 导入
3. **安全扫描**：`dangerouslySetInnerHTML`、`v-html`、`eval()` 等 XSS 风险
4. **列表渲染**：缺少 `key` 属性
5. **LLM 深度审查**：组件库 API 正确性、TypeScript 类型、可访问性、性能

**✅ 生产级**：AST 静态分析（括号/标签/导入/安全/列表）+ LLM 深度审查，双重保障。

---

## 流水线串联方式

使用 **LangChain Chain 管道**（`|` 运算符）串联 5 个 Agent：

```python
pipeline = (
    RunnableLambda(agent1_clean)      # Agent 1
    | RunnableLambda(agent2_convert)  # Agent 2
    | RunnableLambda(agent3_retrieve) # Agent 3
    | RunnableLambda(agent4_generate) # Agent 4
    | RunnableLambda(agent5_validate) # Agent 5
)
```

**数据流**：使用共享 `dict` 在 Agent 间传递：

```
{figma_raw, framework, componentLib}
    → Agent 1 写入 cleaned_data
    → Agent 2 写入 dsl
    → Agent 3 写入 dsl_with_docs
    → Agent 4 写入 generated_code
    → Agent 5 写入 validation_result
    → 最终输出
```

**关键特点**：
- **严格顺序执行**：后一个 Agent 依赖前一个输出
- **每个 Agent 是 RunnableLambda**：包装了 Python 函数，内部硬编码调用对应 Tool
- **单独的 AgentExecutor 存在**：`create_single_agent()` 用于 `/api/agent/run` 单独调试接口
- **无错误传播机制**：如果中间 Agent 失败，后续仍会继续执行

---

## 各 Agent 实现状态

| Agent | 核心函数 | 使用 LLM | 确定性 | 状态 |
|-------|---------|---------|-------|------|
| 1. 数据清洗 | `clean_figma_data_python()` | ❌ 不用 | ✅ 100% | ✅ 生产级 |
| 2. 结构化转换 | `convert_to_dsl_python()` | ❌ 不用 | ✅ 100% | ✅ 生产级 |
| 3. 知识检索 | `search_component_docs()` | ❌ 不用 | ✅ 100% | ✅ 生产级 |
| 4. 代码生成 | `generate_page_code()` | DeepSeek-V3 | ⚠️ LLM | ✅ 可运行 |
| 5. 测试验证 | `validate_and_fix()` | DeepSeek-V3 | ⚠️ LLM | ✅ 生产级 (AST+LLM) |

> 只有 Agent 4 必须用 LLM（代码生成），Agent 5 用 LLM 做深度审查但 AST 部分 100% 确定。Agent 1/2/3 完全不依赖 LLM。

---

## 项目结构

```
D2C/
├── apps/
│   ├── web/                          # 前端 (Next.js 14)
│   │   ├── app/(dashboard)/
│   │   │   ├── agent/                # Agent 流水线页面
│   │   │   ├── figma2code/           # Figma 导入页面
│   │   │   └── knowledge/            # 知识库管理页面
│   │   ├── components/
│   │   │   ├── agent/                # Agent 步骤可视化
│   │   │   ├── figma/                # Figma 导入 + 代码预览
│   │   │   └── layout/               # 布局组件 (Sidebar/TopBar/RightPanel)
│   │   └── lib/
│   │       ├── api/                  # API 封装 (client/agent/figma/rag)
│   │       └── store/                # Zustand 状态管理
│   │
│   ├── server/                       # 后端 (FastAPI) — 分层架构
│   │   ├── main.py                   # 入口 (60 行) — FastAPI 初始化 + 路由注册
│   │   ├── config.py                 # 配置层 — 集中管理环境变量和路径
│   │   ├── models.py                 # 模型层 — Pydantic 数据模型
│   │   ├── agents/                   # 业务逻辑层
│   │   │   ├── cleaner.py            #   Agent 1: 数据清洗 (Python 代码, 不用 LLM)
│   │   │   ├── converter.py          #   Agent 2: 结构化转换 (Python 规则引擎)
│   │   │   ├── retriever.py          #   Agent 3: 知识检索 (ChromaDB RAG)
│   │   │   ├── generator.py          #   Agent 4: 代码生成 (DeepSeek-V3 LLM)
│   │   │   ├── validator.py          #   Agent 5: 测试验证 (AST + LLM)
│   │   │   └── pipeline.py           #   流水线串联 (Chain)
│   │   ├── routers/                  # API 路由层
│   │   │   ├── health.py             #   GET  /health
│   │   │   ├── pipeline.py           #   POST /api/pipeline/run, /api/pipeline/run/{id}
│   │   │   ├── rag.py                #   /api/rag/* (documents/upload/search)
│   │   │   └── figma.py              #   POST /api/figma/analyze
│   │   └── services/                 # 基础设施层
│   │       ├── chroma.py             #   ChromaDB 向量数据库客户端
│   │       └── llm.py                #   LLM 客户端 (Qwen / DeepSeek-V3)
│   │
│   └── agent/                        # RAG Worker (独立服务, 端口 8081)
│       └── agent.py
│
├── scripts/                          # 启动脚本
│   ├── start-frontend.bat
│   ├── start-backend.bat
│   └── start-agent.bat
│
└── start-all.bat                     # 一键启动
```

### 后端分层架构说明

```
┌─────────────────────────────────────────────────┐
│  main.py (入口)                                  │
│  FastAPI 应用初始化 + CORS + 路由注册              │
├─────────────────────────────────────────────────┤
│  routers/ (API 路由层)                            │
│  health.py  pipeline.py  rag.py  figma.py        │
├─────────────────────────────────────────────────┤
│  agents/ (业务逻辑层)                             │
│  cleaner → converter → retriever → generator     │
│  → validator  (Chain 串联)                        │
├─────────────────────────────────────────────────┤
│  models.py (数据模型层)                           │
│  PipelineRunRequest  RAGSearchRequest  etc.      │
├─────────────────────────────────────────────────┤
│  services/ (基础设施层)                           │
│  chroma.py (ChromaDB)  llm.py (LLM Clients)      │
├─────────────────────────────────────────────────┤
│  config.py (配置层)                               │
│  API Keys  模型配置  路径配置                      │
└─────────────────────────────────────────────────┘
```

---

## 快速开始

1. 注册 [SiliconFlow](https://siliconflow.cn) 获取 API Key
2. 编辑 `apps/server/.env`，填入 Key
3. 双击 `start-all.bat` 启动全部服务
4. 浏览器打开 http://localhost:3000

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pipeline/run` | 运行完整 5 Agent 流水线 |
| POST | `/api/agent/run` | 单独运行某个 Agent（调试） |
| POST | `/api/rag/upload` | 上传文档到知识库 |
| POST | `/api/rag/search` | 搜索知识库 |
| GET | `/health` | 服务健康检查 |
