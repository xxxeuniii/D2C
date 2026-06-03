# D2C Multi-Agent Pipeline 技术文档

> **版本 0.4.0 | 2026-06-04**
>
> Design to Code — 从 Figma 设计稿到可运行前端代码

---

## 目录

- [第一章 项目概述](#第一章-项目概述)
  - [1.1 项目定位](#11-项目定位)
  - [1.2 技术栈](#12-技术栈)
  - [1.3 架构总览](#13-架构总览)
  - [1.4 5 Agent 流水线](#14-5-agent-流水线)
- [第二章 Agent 1：数据清洗](#第二章-agent-1数据清洗)
  - [2.1 核心职责](#21-核心职责)
  - [2.2 核心设计理念：确定性优于概率](#22-核心设计理念确定性优于概率)
  - [2.3 技术实现](#23-技术实现)
- [第三章 Agent 2：结构化转换](#第三章-agent-2结构化转换)
  - [3.1 核心职责](#31-核心职责)
  - [3.2 核心设计理念：语义化中间层](#32-核心设计理念语义化中间层)
  - [3.3 技术实现](#33-技术实现)
- [第四章 Agent 3：知识检索](#第四章-agent-3知识检索)
  - [4.1 核心职责](#41-核心职责)
  - [4.2 核心设计理念：RAG 检索增强](#42-核心设计理念rag-检索增强)
  - [4.3 技术实现](#43-技术实现)
  - [4.4 文档管理 API](#44-文档管理-api)
- [第五章 Agent 4：代码生成](#第五章-agent-4代码生成)
  - [5.1 核心职责](#51-核心职责)
  - [5.2 核心设计理念：专用模型策略](#52-核心设计理念专用模型策略)
  - [5.3 技术实现](#53-技术实现)
  - [5.4 Prompt 工程要点](#54-prompt-工程要点)
- [第六章 Agent 5：测试验证](#第六章-agent-5测试验证)
  - [6.1 核心职责](#61-核心职责)
  - [6.2 核心设计理念：双重验证](#62-核心设计理念双重验证)
  - [6.3 技术实现](#63-技术实现)
- [第七章 RAG Worker 服务](#第七章-rag-worker-服务)
  - [7.1 服务概述](#71-服务概述)
  - [7.2 技术实现](#72-技术实现)
  - [7.3 设计理念](#73-设计理念)
- [第八章 流水线串联机制](#第八章-流水线串联机制)
  - [8.1 技术架构](#81-技术架构)
  - [8.2 执行模式](#82-执行模式)
  - [8.3 主 API 端点](#83-主-api-端点)
- [第九章 Agent 开发注意事项](#第九章-agent-开发注意事项)
  - [9.1 什么时候用 LLM，什么时候不用](#91-什么时候用-llm什么时候不用)
  - [9.2 模型选择策略](#92-模型选择策略)
  - [9.3 "代码兜底 + LLM 增强"模式](#93-代码兜底--llm-增强模式)
  - [9.4 Prompt 工程](#94-prompt-工程)
  - [9.5 错误处理与鲁棒性](#95-错误处理与鲁棒性)
  - [9.6 性能优化](#96-性能优化)
  - [9.7 可观测性](#97-可观测性)
  - [9.8 安全注意事项](#98-安全注意事项)
  - [9.9 测试策略](#99-测试策略)
- [第十章 附录](#第十章-附录)
  - [10.1 项目结构](#101-项目结构)
  - [10.2 API 接口汇总](#102-api-接口汇总)
  - [10.3 环境配置](#103-环境配置)
  - [10.4 快速启动](#104-快速启动)

---

## 第一章 项目概述

### 1.1 项目定位

D2C（Design to Code）是一个基于 LangChain 多 Agent 架构的自动化前端代码生成平台。平台将 Figma 设计稿到前端代码的转换过程拆解为 5 个独立的 Agent，每个 Agent 各司其职，通过流水线协同工作，实现端到端的自动化代码生成。

**核心流程**：输入 Figma 设计链接 → 5 个 AI Agent 协同工作 → 输出可运行的前端代码

**支持的框架**：React 18 / Vue 2 / Next.js

**支持的组件库**：Element Plus / Ant Design / shadcn/ui

### 1.2 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | Next.js 14 + React 18 + TypeScript + Tailwind CSS |
| 后端 | FastAPI (Python) |
| AI 框架 | LangChain (Agent / Tool / Memory / Chain) |
| 通用 LLM | Qwen2.5-7B (SiliconFlow) |
| 代码生成 LLM | DeepSeek-V3 (8192 tokens, SiliconFlow) |
| Embedding 模型 | BGE-M3 (SiliconFlow) |
| 向量数据库 | ChromaDB (本地持久化) |
| 代码分析 | AST 静态分析 + LLM 深度审查 |

### 1.3 架构总览

平台采用前后端分离架构，包含三个独立服务：

- **前端服务（Next.js）**：端口 3000，提供用户交互界面、Agent 流水线可视化、Figma 导入、知识库管理等功能
- **后端服务（FastAPI）**：端口 8080，核心 5 Agent 流水线、ChromaDB 向量检索、LLM 调用、Figma API 代理
- **RAG Worker 服务（FastAPI）**：端口 8081，预留文档向量化服务接口

数据流采用 BFF（Backend For Frontend）模式：前端通过 Next.js API Route 转发请求到 FastAPI 后端，保证安全性并支持中间层数据处理。

### 1.4 5 Agent 流水线

流水线采用 LangChain 的 Chain 管道模式，使用 `|` 运算符串联 5 个 `RunnableLambda`。每个 Agent 接收上游输出，处理后写入新的字段，通过共享 `dict` 传递数据。流水线严格顺序执行，后一个 Agent 依赖前一个输出。

**流水线数据流**：

```
{figma_raw, framework, componentLib}
  → Agent 1 写入 cleaned_data
  → Agent 2 写入 dsl
  → Agent 3 写入 dsl_with_docs
  → Agent 4 写入 generated_code
  → Agent 5 写入 validation_result
```

**Agent 总览**：

| 编号 | 名称 | 实现方式 | 使用 LLM | 确定性 | 状态 |
|------|------|----------|----------|--------|------|
| Agent 1 | 数据清洗 | Python 代码 + LLM 语义增强 | 辅助增强 | 基础 100% | 生产级 |
| Agent 2 | 结构化转换 | Python 规则引擎 + LLM 语义增强 | 辅助增强 | 基础 100% | 生产级 |
| Agent 3 | 知识检索 | Python + ChromaDB | 否 | 100% | 生产级 |
| Agent 4 | 代码生成 | DeepSeek-V3 LLM | 是 | 非确定 | 可运行 |
| Agent 5 | 测试验证 | AST 静态分析 + LLM 深度审查 | 部分 | 部分 | 生产级 |

> 设计策略：Agent 1/2 采用"代码兜底 + LLM 增强"模式——Python 规则引擎保证基础正确性（100% 确定），LLM 在规则引擎结果之上补充语义理解，LLM 失败不影响流水线运行。只有 Agent 4 必须依赖 LLM。

---

## 第二章 Agent 1：数据清洗

### 2.1 核心职责

Agent 1 负责清洗 Figma REST API 返回的原始 JSON 数据，去掉前端渲染不需要的冗余字段，将 Figma 内部格式（0-1 RGBA、Effect、Auto Layout 等）转换为前端可直接使用的 CSS 属性（hex/rgba、box-shadow、Flexbox 等）。

**文件位置**：`apps/server/main.py` 第 84-353 行

### 2.2 核心设计理念：确定性优于概率 + LLM 语义增强

Agent 1 的核心清洗逻辑**必须用 Python 代码处理**，LLM 只做辅助增强。这是因为：

1. **确定性要求**：数据清洗是确定性的映射任务（字段筛选、格式转换），不存在需要"理解"或"推理"的环节。LLM 每次可能产生不同结果，代码 100% 确定。
2. **性能要求**：Figma 文件可能包含数千个节点。Python 代码毫秒级处理，LLM 需要秒级网络调用。
3. **成本考量**：LLM 消耗 Token，大文件可能超出 Token 限制。Python 代码免费且无限制。
4. **可维护性**：Prompt 调优依赖经验，代码逻辑清晰、可测试、可复用。

同时，在规则引擎输出的基础上，LLM 可以补充语义理解（颜色语义化、文本分类、布局意图推断等），失败时不影响基础清洗结果。

> **核心原则：代码兜底 + LLM 增强。能用代码解决的问题用代码保证确定性，LLM 在确定性的基础上补充语义理解。**

### 2.3 技术实现

#### 2.3.1 入口函数

**`clean_figma_data_python(raw_data: str) -> dict`**

接收原始 Figma JSON 字符串，解析后调用 `_clean_node()` 递归清洗整个文档树，最后附加元信息（fileName、lastModified、cleanedAt）返回。

#### 2.3.2 核心递归函数

**`_clean_node(node: dict) -> Optional[dict]`**

递归清洗单个 Figma 节点，返回清洗后的 dict 或 None（节点不可见时）。处理流程：

1. **可见性检查**：如果 `visible` 为 false，直接返回 None，跳过整个子树
2. **基础信息提取**：`name`、`type`
3. **尺寸提取**：从 `absoluteBoundingBox` 提取 `width`/`height`（去掉 x/y 坐标）
4. **透明度提取**：仅当 `opacity != 1` 时保留
5. **填充色转换**：`_extract_color()` 将 Figma RGBA(0-1) 转为 CSS hex 或 rgba
6. **描边转换**：`_extract_stroke_color()` 提取第一个 SOLID 描边颜色
7. **圆角提取**：`cornerRadius` → `borderRadius`
8. **阴影转换**：`_extract_shadow()` 只保留 DROP_SHADOW，转为 CSS box-shadow
9. **自动布局映射**：`layoutMode` → `display:flex` + `flexDirection` + `gap` + `padding` + `justifyContent` + `alignItems`
10. **文本节点处理**：提取 `text`、`fontSize`、`fontFamily`、`fontWeight`、`color`
11. **组件标记**：COMPONENT/INSTANCE/COMPONENT_SET 标记 `isComponent`
12. **递归子节点**：对每个 child 递归调用 `_clean_node()`

#### 2.3.3 辅助函数

| 函数名 | 职责 | 输入 | 输出 |
|--------|------|------|------|
| `_extract_color()` | Figma RGBA → CSS 颜色 | fill dict {r,g,b,a} | CSS hex 或 rgba 字符串 |
| `_extract_shadow()` | Figma Effect → CSS box-shadow | effect dict | CSS box-shadow 字符串 |
| `_extract_stroke_color()` | Figma Stroke → CSS 颜色 | stroke dict | CSS hex 字符串 |
| `_extract_font_weight()` | 字体粗细推断 | style dict | CSS font-weight 数值 |

#### 2.3.4 需要移除的字段

**顶层移除字段（TOP_LEVEL_REMOVE，共 17 个）**：

`id`, `lastModified`, `version`, `description`, `editorType`, `styleType`, `remote`, `scrollBehavior`, `componentPropertyDefinitions`, `constraints`, `layoutGrids`, `exportSettings`, `transitionNodeID`, `transitionDuration`, `transitionEasing`, `isAsset`, `backgroundColor`, `prototypeStartNodeID`, `flowStartingPoints`, `prototypeDevice`

这些字段是 Figma 文件的元信息或内部编辑器属性，前端渲染完全不需要。

**节点级移除字段（NODE_REMOVE，约 50 个）**：

包括 `pluginData`、`sharedPluginData`（插件数据）、`layoutSizingHorizontal/Vertical`（Figma 的 HUG/FIXED 模式）、`clipsContent`（Figma 裁剪）、`rectangleCornerRadii` 等独立圆角属性、`textAutoResize`/`lineHeightPx` 等文本引擎属性、`blendMode`、`strokeAlign` 等。这些字段对前端渲染无用，或前端有对应的 CSS 方案替代。

#### 2.3.5 自动布局到 Flexbox 映射

| Figma 属性 | CSS 属性 | 映射规则 |
|------------|----------|----------|
| `layoutMode = HORIZONTAL` | `display: flex; flex-direction: row` | 水平布局 → flex row |
| `layoutMode = VERTICAL` | `display: flex; flex-direction: column` | 垂直布局 → flex column |
| `itemSpacing` | `gap` | 子元素间距 → CSS gap |
| `paddingTop/Right/Bottom/Left` | `padding` | 四向内边距 → padding 简写 |
| `primaryAxisAlignItems` | `justifyContent` | MIN→flex-start, CENTER→center, MAX→flex-end, SPACE_BETWEEN→space-between |
| `counterAxisAlignItems` | `alignItems` | MIN→flex-start, CENTER→center, MAX→flex-end |

### 2.4 LLM 辅助增强（规划中）

虽然 Agent 1 的核心清洗逻辑必须用 Python 代码保证确定性，但在以下场景可以引入 LLM 做**辅助增强**——LLM 在规则引擎输出的基础上补充语义信息，失败时不影响基础清洗结果。

#### 2.4.1 组件语义识别

**当前状态**：只标记 `COMPONENT`/`INSTANCE` 类型为 `isComponent: true`。

**LLM 辅助**：分析节点树的结构和命名，识别出哪些 FRAME/GROUP 实际上是业务组件（如"登录表单容器"、"商品卡片"），补充语义标签。例如：一个名为 `"ProductCard"` 的 FRAME 包含图片+TEXT+按钮，LLM 可推断这是 `card` 组件。

#### 2.4.2 智能颜色语义化

**当前状态**：`_extract_color()` 只做 RGBA→hex 的机械转换。

**LLM 辅助**：识别颜色的语义角色——哪个是主色（`--primary-color`）、哪个是背景色（`--bg-surface`）、哪个是错误色（`--color-error`）、哪个是边框色（`--border-default`）。输出 CSS 变量名而非硬编码色值，便于生成可维护的主题系统。

#### 2.4.3 布局意图推断

**当前状态**：只做机械映射（HORIZONTAL→flex row, VERTICAL→flex column）。

**LLM 辅助**：分析节点层级关系，推断布局的真实意图：
- "这个横向排列的 3 个等宽卡片应该用 CSS Grid 而非 Flexbox"
- "这个 FRAME 实际是页面的 header/sidebar/content 区域，应使用语义化布局"
- "这个纵向排列中有 sticky 定位需求"

#### 2.4.4 文本内容分类

**当前状态**：TEXT 节点只提取原始 `characters`。

**LLM 辅助**：识别文本的语义角色，补充到 DSL 中指导代码生成：
- 标题文字 → `role: "heading"`, 推断层级 `h1`/`h2`/`h3`
- 正文内容 → `role: "body"`
- 占位符文字 → `role: "placeholder"`（如"请输入用户名"）
- 提示文字 → `role: "tooltip"` 或 `role: "helper"`
- 按钮文字 → `role: "cta"`（Call to Action）

#### 2.4.5 冗余节点智能过滤

**当前状态**：只跳过 `visible: false` 的节点。

**LLM 辅助**：识别设计稿中的装饰性节点（纯视觉分隔线、背景装饰层）和功能性节点，给出更精准的过滤建议，减少无用节点传递到下游 Agent。

---

## 第三章 Agent 2：结构化转换

### 3.1 核心职责

Agent 2 将清洗后的 Figma 节点树转换为组件 DSL（Domain Specific Language，领域描述语言），让后续的 LLM 代码生成环节更容易理解设计意图。DSL 将 Figma 原始节点类型（FRAME、RECTANGLE 等）映射为语义化的组件类型（container、button、input 等）。

**文件位置**：`apps/server/main.py` 第 355-497 行

### 3.2 核心设计理念：语义化中间层

Agent 2 以 Python 规则引擎为核心，LLM 做辅助增强。核心理念是：

1. **降低 LLM 理解成本**：Figma 原始节点（FRAME、RECTANGLE）语义模糊，DSL 将其映射为明确的组件类型（button、input、card），LLM 更容易理解设计意图
2. **解耦设计源与代码输出**：DSL 作为中间层，隔离了 Figma 数据格式的变化，后续 Agent 只需理解 DSL
3. **命名规范的重要性**：设计师的图层命名直接影响组件推断准确率。建议使用 `button`、`input`、`card` 等语义化命名
4. **确定性转换 + LLM 增强**：规则引擎 100% 确定保证基础正确，LLM 在复杂推断场景补充语义理解

### 3.3 技术实现

#### 3.3.1 入口函数

**`convert_to_dsl_python(cleaned_data: dict, framework: str, component_lib: str) -> dict`**

接收清洗后的数据、目标框架和组件库名称，遍历顶层子节点调用 `_node_to_dsl_component()`，返回包含 `pageName`、`framework`、`componentLib`、`components` 的完整 DSL。

#### 3.3.2 组件类型推断

**`_infer_component_type(node: dict) -> str`**

类型推断分三级优先级：

1. **TEXT 类型优先**：如果 Figma 类型是 TEXT，直接返回 `'text'`
2. **命名关键词匹配**：检查图层名（忽略空格、连字符、下划线）中是否包含已知关键词。支持 20+ 种组件类型：

   `button/btn`, `input/textfield`, `checkbox`, `radio`, `select/dropdown`, `table`, `modal/dialog`, `tab/tabs`, `card`, `menu`, `navbar`, `sidebar`, `form`, `image/icon`, `avatar`, `badge/tag`, `pagination`, `slider`, `switch/toggle`, `breadcrumb`, `header`, `footer`, `list`, `divider`, `tooltip`, `popover`, `progress`, `loading/spinner`

3. **默认类型映射**：TYPE_MAP 将 Figma 类型映射到 DSL 类型

   | Figma 类型 | DSL 类型 |
   |------------|----------|
   | FRAME | container |
   | GROUP | container |
   | RECTANGLE | box |
   | TEXT | text |
   | COMPONENT / INSTANCE | component |
   | ELLIPSE / LINE / VECTOR / POLYGON / STAR | box |
   | BOOLEAN_OPERATION | container |

#### 3.3.3 DSL 输出结构

每个 DSL 组件包含以下字段：

- `name`：组件名称（来自 Figma 图层名）
- `type`：推断的组件类型（container/button/input/text 等）
- `styles`：CSS 样式集合（width、height、backgroundColor、borderRadius、flexDirection、gap、padding、fontSize 等）
- `props`：组件属性（text、componentName 等）
- `layout`：布局信息（mode、hasAutoLayout）
- `children`：递归子组件

### 3.4 LLM 辅助增强（规划中）

Agent 2 的 Python 规则引擎保证基础 DSL 转换的确定性，但在以下场景可以引入 LLM 做**语义增强**——LLM 在规则引擎输出的 DSL 基础上补充语义字段，失败时保留基础 DSL。

#### 3.4.1 组件类型推断增强

**当前状态**：`_infer_component_type()` 仅靠关键词匹配（如 `"button" in name`）。

**LLM 辅助**：当关键词匹配失败时，分析节点的子结构来推断：
- "一个 TEXT + 一个 RECTANGLE + 带圆角和背景色 → 很可能是 button"
- "一个 TEXT + 一个矩形框 + 内部有 TEXT '请输入' → 很可能是 input"
- 处理复杂命名如 `"submit-btn-primary-large"` 的语义拆解（识别出 button + primary + large 三层语义）

#### 3.4.2 组件 Props 智能提取

**当前状态**：只提取 `text` 和 `componentName`。

**LLM 辅助**：分析节点属性和上下文推断更多 Props：
- "这个输入框前面有 TEXT 节点写着'用户名'，应该是 label"
- "TEXT 写着'请输入'且颜色偏灰，应该是 placeholder"
- "按钮有 disabled 状态的设计变体，应提取 disabled prop"
- "select 组件内部有多个 option 文本项"

#### 3.4.3 组件间关系推断

**当前状态**：`children` 只反映 Figma 层级，不做语义关联。

**LLM 辅助**：识别父子关系的语义：
- "这个 TEXT 和这个 RECTANGLE 是同一个表单项的 label + input"
- "这组横向排列的节点是表格的一行（table row）"
- "这是一个完整表单，包含 3 个表单项（form item）"
- "这个 modal 包含 header + body + footer 三个区域"

#### 3.4.4 样式 Token 化

**当前状态**：样式值是硬编码的 px 值和 hex 颜色（如 `"24px"`、`"#1A1C26"`）。

**LLM 辅助**：将重复的样式值抽象为 Design Token：
- 识别出所有 `24px` 的内边距实际是 `--spacing-lg`
- 所有 `#1A1C26` 是 `--color-bg-primary`
- 所有 `16px` 的字体大小是 `--font-size-base`
- 生成完整的 Design Token 体系（颜色、间距、字号、圆角、阴影）

#### 3.4.5 响应式断点推断

**当前状态**：只有固定的 width/height 值。

**LLM 辅助**：分析整体布局结构，推断响应式策略：
- "这个 400px 宽的卡片在移动端应该 100% 宽度"
- "这个 sidebar 在小屏幕应该折叠为汉堡菜单"
- "这个横向排列（3 列）在移动端应该变成纵向堆叠"
- "页面最大宽度应该是 1200px 并居中"

#### 3.4.6 交互逻辑推断

**当前状态**：DSL 只有静态结构。

**LLM 辅助**：根据组件类型和命名推断交互行为，补充到 DSL 中：
- "这个 button 旁边有 input，应该是提交按钮，需要 onClick 事件 + 表单验证"
- "这个 nav 里有多个 item，应该有 active 状态切换"
- "这个 modal 组件需要 open/close 状态管理和 backdrop"
- "这个 tabs 组件需要 tab 切换逻辑"
- "这个 dropdown 需要展开/收起状态"

#### 3.4.7 LLM 辅助增强总结

| 优先级 | 增强点 | 方式 | 预期收益 |
|--------|--------|------|----------|
| ⭐⭐⭐ | 组件类型推断增强 | 规则引擎先行，LLM 兜底 | 提升复杂组件的识别准确率 |
| ⭐⭐⭐ | 样式 Token 化 | LLM 后处理 DSL | 生成可维护的主题系统 |
| ⭐⭐⭐ | 组件 Props 智能提取 | LLM 分析节点子结构 | 生成更完整的组件属性 |
| ⭐⭐ | 交互逻辑推断 | LLM 补充 DSL 字段 | 代码生成包含事件处理 |
| ⭐⭐ | 颜色语义化（Agent 1） | LLM 分析色板 | 输出 CSS 变量体系 |
| ⭐⭐ | 组件间关系推断 | LLM 分析层级语义 | 更精准的表单/表格识别 |
| ⭐ | 布局意图推断（Agent 1） | LLM 辅助判断 | 减少 Flex 误用为 Grid 的场景 |
| ⭐ | 文本内容分类（Agent 1） | LLM 分析文本角色 | 更语义化的 HTML 标签 |
| ⭐ | 响应式断点推断 | LLM 分析整体布局 | 自动生成响应式代码 |
| ⭐ | 冗余节点过滤（Agent 1） | LLM 识别装饰节点 | 减少无用数据传递 |

> **核心原则**：LLM 只做"增强"而非"替代"。规则引擎保证基础正确性，LLM 在规则引擎结果之上补充语义理解，LLM 失败不影响流水线运行。这种"代码兜底 + LLM 增强"的模式是最稳健的 Agent 设计方式。

## 第四章 Agent 3：知识检索

### 4.1 核心职责

Agent 3 从 ChromaDB 知识库中检索组件库文档，附加到 DSL 中，为 Agent 4 的代码生成提供参考。这是典型的 **RAG（Retrieval-Augmented Generation，检索增强生成）** 模式。

**文件位置**：`apps/server/main.py` 第 499-538 行

### 4.2 核心设计理念：RAG 检索增强

Agent 3 体现了 RAG 模式在 Agent 开发中的关键价值：

1. **突破 LLM 知识边界**：LLM 的训练数据可能不包含最新版本的组件库文档，RAG 可以检索任意上传的文档
2. **降低幻觉风险**：有文档作为参考，LLM 生成代码时会使用正确的 API 签名和属性名
3. **知识可管理**：用户可以通过上传文档来更新知识库，无需重新训练模型
4. **确定性检索**：ChromaDB 的向量检索结果在相同索引和查询下是确定的

### 4.3 技术实现

#### 4.3.1 检索流程

**`search_component_docs(dsl_json: str, component_lib: str) -> str`**

1. 解析 DSL JSON，递归遍历所有 components，收集所有非基础组件类型（排除 container、box、text）
2. 对每个组件类型，构造检索查询：`"{组件库名} {组件类型} 组件 API 用法 示例"`
3. 调用 `collection.query()` 在 ChromaDB 中检索，取 top-2 结果
4. 将检索到的文档片段（前 800 字符）附加到 DSL 的 `componentDocs` 字段
5. 返回完整的 DSL JSON（包含 componentDocs）

#### 4.3.2 技术栈

- **向量数据库**：ChromaDB（本地持久化存储）
- **Embedding 模型**：BGE-M3（通过 SiliconFlow API）
- **Collection 名称**：`design_specs`
- **检索数量**：top-2（每个组件类型）

### 4.4 文档管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rag/documents` | 获取所有已上传文档列表 |
| POST | `/api/rag/upload` | 上传文档（支持文本、Markdown） |
| POST | `/api/rag/search` | 搜索知识库（手动查询） |
| DELETE | `/api/rag/documents/{id}` | 删除指定文档 |

---

## 第五章 Agent 4：代码生成

### 5.1 核心职责

Agent 4 是整个流水线的核心——根据 DSL + 组件文档生成完整的前端页面代码。这是**唯一必须使用 LLM** 的环节，因为代码生成需要创造性推理和对 DSL 的语义理解。

**文件位置**：`apps/server/main.py` 第 541-569 行

### 5.2 核心设计理念：专用模型策略

Agent 4 采用双模型策略，体现了 Agent 开发中"因任务选模型"的重要原则：

1. **通用任务使用 Qwen2.5-7B**：成本低、响应快，用于简单问答和文档摘要
2. **代码生成使用 DeepSeek-V3**：更强的代码生成能力，8192 tokens 输出窗口支持长代码，温度 0.3 保证质量稳定
3. **成本优化**：不是所有 Agent 都需要最强的模型，按任务需求分配模型可以大幅降低 API 成本

### 5.3 技术实现

#### 5.3.1 生成函数

**`generate_page_code(dsl_with_docs: str, framework: str) -> str`**

构造精心设计的 Prompt，包含以下要素：

- **角色设定**："你是一个资深前端开发"——设定专业角色提升代码质量
- **输入数据**：DSL + 组件文档（截断至 6000 字符避免超 Token 限制）
- **框架指定**：Vue 2 + Options API + Element Plus 或 React 18 + TypeScript + Hooks
- **设计系统**：暗色主题（背景 `#0D1117`、文字 `#E6EDF3`、边框 `rgba(255,255,255,0.1)`）
- **约束条件**：严格按 DSL 组件结构排列、遵循组件库 API、使用 Tailwind CSS、完整可运行
- **输出格式**："只输出代码，不要任何解释"——防止 LLM 添加冗余文字

#### 5.3.2 LLM 配置

| 参数 | 值 | 说明 |
|------|-----|------|
| model | `deepseek-ai/DeepSeek-V3` | 专用代码生成模型 |
| temperature | `0.3` | 较低温度保证代码稳定性和一致性 |
| max_tokens | `8192` | 大输出窗口支持长代码文件 |
| base_url | `https://api.siliconflow.cn/v1` | SiliconFlow API |

### 5.4 Prompt 工程要点

Agent 4 的 Prompt 设计是代码质量的关键。以下是重要原则：

1. **明确的角色设定**：让 LLM 进入专业开发者的思维模式
2. **结构化约束**：分层次列出要求（框架 → 设计系统 → 组件结构 → API 规范 → 样式方案 → 输出格式）
3. **输出格式控制**：明确要求"只输出代码"，防止 Markdown 标记和解释文字混入代码
4. **设计系统内置**：在 Prompt 中内置暗色主题的色板值，而不是让 LLM 自行选择颜色
5. **Token 预算管理**：输入 DSL 截断至 6000 字符，避免超出上下文窗口

---

## 第六章 Agent 5：测试验证

### 6.1 核心职责

Agent 5 负责验证 Agent 4 生成的代码质量，并自动修复发现的问题。采用**双重验证机制**：先用 Python AST 静态分析做确定性检查，再用 LLM 做深度语义审查。

**文件位置**：`apps/server/main.py` 第 572-688 行

### 6.2 核心设计理念：双重验证

Agent 5 体现了 Agent 开发中"混合验证"的设计模式：

1. **第一层——确定性检查（AST 静态分析）**：括号匹配、标签闭合、导入检查、安全扫描、列表 key 检查。这些是确定性的语法规则，Python 代码处理更可靠。
2. **第二层——语义审查（LLM）**：组件库 API 正确性、TypeScript 类型完整性、可访问性、响应式设计、性能问题。这些需要语义理解，LLM 更适合。
3. **互补优势**：AST 保证基本语法正确，LLM 保证代码质量和可维护性
4. **成本控制**：AST 分析免费且毫秒级，只在需要时调用 LLM

### 6.3 技术实现

#### 6.3.1 AST 静态分析

**`_ast_syntax_check(code: str) -> List[str]`**

纯 Python 实现的 5 项静态检查：

| 检查项 | 检测方法 | 严重级别 |
|--------|----------|----------|
| 括号匹配 | 栈遍历检测 `{ }`、`( )`、`[ ]` 配对 | ERROR |
| 标签闭合 | 正则匹配 HTML/JSX 标签，栈验证闭合 | ERROR / WARNING |
| 导入检查 | 检测 Vue/React 组件缺少 import/export | WARNING |
| 安全扫描 | 检测 `dangerouslySetInnerHTML`、`v-html`、`eval()` | ERROR / WARNING |
| 列表 key | 检测 `.map()` 渲染缺少 key 属性 | WARNING |

#### 6.3.2 LLM 深度审查

**`validate_and_fix(code: str) -> str`**

在 AST 分析之后，调用 DeepSeek-V3 进行深度审查。LLM 检查清单包括：

- 组件库 API 用法是否正确（如 `el-button` 的属性名是否拼写正确）
- TypeScript 类型是否完整（Props 接口、事件类型等）
- 可访问性检查（alt 属性、aria-label、role 属性）
- 响应式设计检查（是否使用相对单位、媒体查询）
- 性能问题检查（多余的 re-render、大列表是否需要虚拟滚动）

LLM 审查使用 `code_llm`（DeepSeek-V3），温度 0.3，max_tokens 8192。如果代码无问题且 AST 已通过，输出 `'PASSED'`；否则输出问题列表和修复后的完整代码。

---

## 第七章 RAG Worker 服务

### 7.1 服务概述

RAG Worker 是一个独立的 FastAPI 微服务（端口 8081），专门负责文档向量化和 Embedding 相关任务。将 RAG 处理与主后端解耦，便于独立扩展和维护。

**文件位置**：`apps/agent/agent.py`

### 7.2 技术实现

当前实现为精简版，核心代码仅 33 行，提供两个端点：

- `GET /health`：服务健康检查
- `POST /api/rag/embed`：文档向量化接口（预留，可接入 OpenAI Embedding 或本地模型）

### 7.3 设计理念

- **微服务解耦**：将 Embedding 计算独立为单独服务，避免阻塞主流水线
- **可替换性**：Embedding 接口预留，可根据需求切换不同的 Embedding 模型
- **独立扩展**：RAG Worker 可独立部署到 GPU 服务器进行大规模向量化

---

## 第八章 流水线串联机制

### 8.1 技术架构

流水线使用 LangChain 的 Chain 管道模式实现。每个 Agent 被包装为 `RunnableLambda`，通过 `|` 运算符串联。

**核心函数**：`create_multi_agent_pipeline()`（`apps/server/main.py` 第 695-760 行）

```python
pipeline = (
    RunnableLambda(agent1_clean)      # Agent 1
    | RunnableLambda(agent2_convert)  # Agent 2
    | RunnableLambda(agent3_retrieve) # Agent 3
    | RunnableLambda(agent4_generate) # Agent 4
    | RunnableLambda(agent5_validate) # Agent 5
)
```

每个 Agent 的内部函数：

| 函数名 | 对应 Agent | 核心操作 | 输出字段 |
|--------|------------|----------|----------|
| `agent1_clean` | Agent 1 | 调用 `clean_figma_data_python()` | `cleaned_data`, `agent1_status` |
| `agent2_convert` | Agent 2 | 调用 `convert_to_dsl_python()` | `dsl`, `agent2_status` |
| `agent3_retrieve` | Agent 3 | 调用 `search_component_docs.invoke()` | `dsl_with_docs`, `agent3_status` |
| `agent4_generate` | Agent 4 | 调用 `generate_page_code.invoke()` | `generated_code`, `agent4_status` |
| `agent5_validate` | Agent 5 | 调用 `validate_and_fix.invoke()` | `validation_result`, `agent5_status` |

### 8.2 执行模式

**严格顺序执行**：后一个 Agent 依赖前一个输出，因此必须按顺序执行。如果中间 Agent 失败，后续仍会继续执行（当前版本无错误传播中断机制，生产中应添加）。

### 8.3 主 API 端点

**`POST /api/pipeline/run`**：运行完整 5 Agent 流水线

请求参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | string | Figma 文件链接 |
| `framework` | string | 目标框架，可选 `react` / `vue2` |
| `componentLib` | string | 组件库，可选 `element-plus` / `ant-design` / `shadcn-ui` |
| `figmaToken` | string（可选） | Figma Personal Access Token |

响应包含：`runId`、`status`、`steps`（每步状态）、`result`（code + validation）

---

## 第九章 Agent 开发注意事项

### 9.1 什么时候用 LLM，什么时候不用

这是 Agent 开发中最核心的决策。判断标准如下：

| 场景 | 推荐方式 | 原因 |
|------|----------|------|
| 数据清洗/格式转换 | Python 代码 + LLM 语义增强 | 基础用代码保证确定性，LLM 补充语义 |
| 规则匹配/字段映射 | Python 代码 + LLM 兜底 | 规则引擎 100% 确定，LLM 处理规则未覆盖的 case |
| 向量检索/数据库查询 | Python 代码 | 数据库操作天然确定 |
| 代码生成/内容创作 | LLM | 需要创造性推理 |
| 代码审查/语义分析 | AST + LLM 混合 | 语法用代码，语义用 LLM |
| 文本总结/翻译 | LLM | 需要语言理解 |

> **黄金法则：代码兜底 + LLM 增强。能用代码解决的问题用代码保证确定性，LLM 在确定性的基础上补充语义理解。LLM 失败时降级为纯代码输出，不影响流水线运行。**

### 9.2 模型选择策略

- **按任务难度分配模型**：简单任务用 7B 模型，代码生成用专业模型，避免一刀切
- **温度参数控制**：代码生成用低温度（0.1-0.3），创意任务用高温度（0.7-1.0）
- **Token 预算管理**：输入截断、输出限制、分块处理大文件
- **Fallback 机制**：主模型不可用时自动切换到备用模型
- **增强模式成本控制**：Agent 1/2 的 LLM 增强使用便宜的 7B 模型，只在规则引擎无法确定时才调用

### 9.3 "代码兜底 + LLM 增强"模式

这是本项目核心的 Agent 设计模式，适用于 Agent 1 和 Agent 2：

```
输入数据
  │
  ├──→ Python 规则引擎（确定性）──→ 基础输出（100% 可靠）
  │
  └──→ LLM 语义分析（可选）──────→ 语义增强字段
                                          │
                                    失败时丢弃，不影响基础输出
```

**适用场景**：
- 基础逻辑可以用规则引擎覆盖 80%+ 的场景
- 剩余 20% 需要语义理解（命名推断、关系识别、意图分析）
- 增强结果不影响核心功能，失败可安全降级

**不适用场景**：
- 核心逻辑本身就需要创造性推理（如代码生成）
- 规则引擎无法给出有意义的基础输出
- 增强结果和基础结果耦合太紧，无法独立降级

### 9.4 Prompt 工程

- **角色设定**：明确告知 LLM 它的身份（资深前端/代码审查专家），激活对应领域知识
- **结构化输出**：要求 JSON、代码块、特定格式，方便后续解析
- **约束明确**：列出必须遵守的规则和禁止的行为
- **示例驱动**：提供输入-输出示例，Few-Shot 提示显著提升质量
- **输出格式控制**："只输出代码，不要任何解释"这类指令非常重要

### 9.5 错误处理与鲁棒性

- 每个 Agent 必须独立处理异常，单个 Agent 失败不应导致整个流水线崩溃
- LLM 调用必须设置超时和重试机制（本项目使用 httpx 30s 超时）
- LLM 输出必须做格式校验，不能假设输出总是合法的 JSON/代码
- 关键路径使用确定性代码做 fallback，LLM 不可用时降级处理

### 9.6 性能优化

- **避免不必要的 LLM 调用**：能用代码解决的问题坚决不用 LLM
- **缓存策略**：相同输入缓存 LLM 结果，减少重复调用
- **并行化**：不依赖彼此结果的 Agent 可以并行执行
- **输入精简**：传给 LLM 的数据只保留必要信息，去除冗余字段

### 9.7 可观测性

- **日志记录**：每个 Agent 的执行时间、输入输出大小、LLM Token 消耗
- **状态追踪**：流水线运行时实时更新步骤状态（running/completed/error）
- **指标监控**：Agent 成功率、平均耗时、Token 消耗趋势
- **调试友好**：保留中间结果（cleaned_data、dsl、dsl_with_docs），方便问题排查

### 9.8 安全注意事项

- **Prompt Injection 防护**：用户输入的数据要做清洗，防止注入恶意指令
- **输出安全扫描**：生成的代码必须检查 XSS 风险（`dangerouslySetInnerHTML`、`v-html`、`eval`）
- **API Key 管理**：使用环境变量存储，不硬编码在代码中
- **速率限制**：对 LLM API 调用添加速率控制，防止费用失控

### 9.9 测试策略

- **确定性 Agent（1/2/3）**：使用单元测试验证输入-输出映射正确性
- **LLM Agent（4/5）**：使用 Golden Test（标准输入-预期输出对）和人工评审
- **流水线集成测试**：端到端测试完整 Figma URL → 代码输出流程
- **回归测试**：每次 Prompt 修改后重新运行测试套件

---

## 第十章 附录

### 10.1 项目结构

```
D2C/
├── apps/
│   ├── web/                         # 前端 (Next.js 14)
│   │   ├── app/(dashboard)/
│   │   │   ├── agent/page.tsx       # Agent 流水线页面
│   │   │   ├── knowledge/page.tsx   # 知识库管理页面
│   │   │   └── api/rag/route.ts     # RAG BFF 代理
│   │   ├── components/
│   │   │   ├── agent/AgentSteps.tsx # Agent 步骤可视化
│   │   │   └── layout/Sidebar.tsx   # 侧边栏导航
│   │   ├── lib/
│   │   │   ├── api/agent.ts         # Agent API 客户端
│   │   │   ├── api/rag.ts           # RAG API 客户端
│   │   │   ├── store/figmaStore.ts  # Figma 状态管理
│   │   │   └── store/ragStore.ts    # RAG 状态管理
│   │   └── types/index.ts           # 全局类型定义
│   ├── server/                      # 后端 (FastAPI)
│   │   ├── main.py                  # ★ 核心：5 Agent 流水线实现
│   │   ├── requirements.txt
│   │   └── .env                     # API Keys
│   └── agent/                       # RAG Worker
│       └── agent.py                 # 文档向量化服务
├── scripts/                         # 启动脚本
│   ├── start-frontend.bat
│   ├── start-backend.bat
│   └── start-agent.bat
├── docs/                            # 文档
├── start-all.bat                    # 一键启动
└── README.md
```

### 10.2 API 接口汇总

| 方法 | 路径 | 说明 | 所属服务 |
|------|------|------|----------|
| GET | `/health` | 服务健康检查 | 后端 (8080) |
| POST | `/api/pipeline/run` | 运行完整 5 Agent 流水线 | 后端 (8080) |
| GET | `/api/pipeline/run/{id}` | 查询流水线状态 | 后端 (8080) |
| GET | `/api/rag/documents` | 获取知识库文档列表 | 后端 (8080) |
| POST | `/api/rag/upload` | 上传文档到知识库 | 后端 (8080) |
| POST | `/api/rag/search` | 搜索知识库 | 后端 (8080) |
| DELETE | `/api/rag/documents/{id}` | 删除文档 | 后端 (8080) |
| POST | `/api/figma/analyze` | Figma 文件直接解析 | 后端 (8080) |
| GET | `/health` | 服务健康检查 | RAG Worker (8081) |
| POST | `/api/rag/embed` | 文档向量化 | RAG Worker (8081) |

### 10.3 环境配置

`apps/server/.env` 配置项：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SILICONFLOW_API_KEY` | SiliconFlow API 密钥（必填） | — |
| `SILICONFLOW_BASE_URL` | API 地址 | `https://api.siliconflow.cn/v1` |
| `LLM_MODEL` | 通用 LLM 模型 | `Qwen/Qwen2.5-7B-Instruct` |
| `CODE_LLM_MODEL` | 代码生成模型 | `deepseek-ai/DeepSeek-V3` |
| `EMBEDDING_MODEL` | Embedding 模型 | `BAAI/bge-m3` |

### 10.4 快速启动

1. 注册 [SiliconFlow](https://siliconflow.cn) 获取 API Key
2. 编辑 `apps/server/.env`，填入 API Key
3. 双击 `start-all.bat` 启动全部服务
4. 浏览器打开 `http://localhost:3000`
