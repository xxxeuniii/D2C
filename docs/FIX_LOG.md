# D2C 项目修复日志

> 修复时间：2026-06-04  
> 环境：Windows + Python 3.13 + LangChain 1.3.4 + Next.js 14

---

## 1. 环境兼容性修复

### 1.1 ChromaDB 环境变量 (Python 3.13 + ChromaDB 1.x)

**问题**：新版 chromadb 的 `OpenAIEmbeddingFunction` 强制检查 `CHROMA_OPENAI_API_KEY` 环境变量，即使传了 `api_key` 参数也会报错。

**文件**：`apps/server/config.py`、`apps/server/services/chroma.py`

**修复**：
- `config.py` 中加载 `.env` 后设置 `os.environ.setdefault("CHROMA_OPENAI_API_KEY", ...)` 和 `os.environ.setdefault("OPENAI_API_KEY", ...)`
- 明确指定 `.env` 文件路径，避免从非预期目录启动时找不到配置文件

### 1.2 LangChain 1.x 导入路径变更

**问题**：LangChain 0.2.x → 1.3.x 中多个模块路径发生了变化。

| 旧路径 | 新路径 |
|--------|--------|
| `langchain.schema.HumanMessage` | `langchain_core.messages.HumanMessage` |
| `langchain.schema.SystemMessage` | `langchain_core.messages.SystemMessage` |
| `langchain.schema.runnable.RunnableLambda` | `langchain_core.runnables.RunnableLambda` |
| `langchain.tools.tool` | `langchain_core.tools.tool` |
| `langchain.prompts.ChatPromptTemplate` | `langchain_core.prompts.ChatPromptTemplate` |
| `langchain.agents.AgentExecutor` | 已移除，改用 `langchain.agents.create_agent` |
| `langchain.agents.create_openai_tools_agent` | 已移除，改用 `langchain.agents.create_agent` |
| `langchain.memory.ConversationSummaryBufferMemory` | 已移除 |

**涉及文件**：
- `apps/server/agents/cleaner.py`
- `apps/server/agents/converter.py`
- `apps/server/agents/generator.py`
- `apps/server/agents/validator.py`
- `apps/server/agents/tools.py`
- `apps/server/agents/memory.py`
- `apps/server/agents/anti_hallucination.py`
- `apps/server/agents/pipeline.py`
- `apps/server/agents/orchestrator.py`
- `apps/server/agents/retriever.py`
- `apps/server/prompts/agent_prompts.py`

**修复**：全部替换为 LangChain 1.x 兼容路径，`orchestrator.py` 中使用 `try/except` 兼容两种版本。

### 1.3 LangChain Pipeline Callback 兼容

**问题**：LangChain 1.x 中 pipeline callback 需要 `raise_error()` 和 `ignore_chain` 方法。

**文件**：`apps/server/routers/pipeline.py`

**修复**：移除 callback 机制，改为在 pipeline 完成后直接添加步骤信息。

---

## 2. 界面修复

### 2.1 浅色主题

**问题**：原项目使用深色主题（暗黑模式）。

**文件**：`apps/web/app/globals.css`、`apps/web/app/layout.tsx`

**修复**：
- CSS 变量全部改为浅色调（白底 + 蓝色品牌色）
- `layout.tsx` 去掉 `className="dark"`
- Monaco Editor 主题从 `vs-dark` 改为 `vs`
- 滚动条颜色适配浅色背景

### 2.2 全面中文化

**问题**：界面大量使用英文。

**涉及文件**（共 11 个）：
- `apps/web/app/layout.tsx` — 页面标题和描述
- `apps/web/components/layout/TopBar.tsx` — 页面标题映射
- `apps/web/components/layout/Sidebar.tsx` — 导航标签
- `apps/web/components/layout/RightPanel.tsx` — 面板标题和空状态
- `apps/web/components/figma/FigmaImporter.tsx` — 表单标签、按钮文字
- `apps/web/components/figma/CodePreview.tsx` — 代码预览区文字
- `apps/web/components/figma/DesignPreview.tsx` — 预览区文字和按钮
- `apps/web/components/figma/NodeTree.tsx` — 节点树标题
- `apps/web/app/(dashboard)/figma2code/page.tsx` — Token 提示、设置面板
- `apps/web/app/(dashboard)/agent/page.tsx` — 流水线按钮、提示
- `apps/web/app/(dashboard)/knowledge/page.tsx` — 知识库标题、表格、状态标签
- `apps/web/components/agent/AgentSteps.tsx` — 输入/输出/错误标签

### 2.3 默认测试链接

**文件**：`apps/web/components/figma/FigmaImporter.tsx`、`apps/web/app/(dashboard)/agent/page.tsx`

**修复**：输入框预填默认 Figma 链接，用户无需手动粘贴。

---

## 3. Figma Token 自动获取

**问题**：Figma Token 存在后端 `.env` 中，但前端每次都需要用户手动输入。

**文件**：
- `apps/server/config.py` — 加载根目录 `.env` 获取 `FIGMA_TOKEN`
- `apps/server/routers/figma.py` — 新增 `GET /api/figma/config` 接口
- `apps/web/app/api/figma/config/route.ts` — Next.js BFF 代理层
- `apps/web/app/(dashboard)/figma2code/page.tsx` — 页面加载时自动获取 Token

**修复**：前端启动时自动从后端获取 Token，无需手动填写。

---

## 4. Figma API 调用修复

### 4.1 SSL 错误

**问题**：`httpx` 在 FastAPI async 上下文中请求 `api.figma.com` 报 SSL 错误。

**文件**：`apps/server/routers/pipeline.py`、`apps/server/routers/figma.py`

**修复**：用 `urllib.request` + `ssl.create_default_context()` 替代 `httpx.get`。

### 4.2 URL 格式支持

**问题**：只支持 `/file/` 和 `/design/` 开头的 Figma 链接，不支持 `/proto/`。

**文件**：`apps/web/components/figma/FigmaImporter.tsx`、`apps/web/app/(dashboard)/agent/page.tsx`、`apps/server/routers/figma.py`、`apps/server/routers/pipeline.py`

**修复**：正则增加 `proto` 匹配。

### 4.3 API 频率限制

**问题**：频繁测试导致 Figma API 429 错误。

**文件**：`apps/server/routers/pipeline.py`

**修复**：增加本地缓存机制，首次请求后缓存到 `chroma_data/figma_cache_{file_key}.json`，后续请求直接读缓存。

---

## 5. LLM API 切换

**问题**：原 SiliconFlow API Key 余额不足。

**文件**：`apps/server/.env`

**修复**：切换到智谱 AI (BigModel) API：
- `SILICONFLOW_BASE_URL` → `https://open.bigmodel.cn/api/paas/v4`
- `LLM_MODEL` → `glm-4-flash`
- `CODE_LLM_MODEL` → `glm-4-flash`
- `EMBEDDING_MODEL` → `embedding-2`

---

## 6. 代码 Bug 修复

### 6.1 变量名不一致

**文件**：`apps/server/agents/anti_hallucination.py`

**问题**：第 385 行定义 `tag_pattern`，第 387 行使用 `tag_patterns`。

**修复**：统一为 `tag_patterns`。

### 6.2 LLM JSON 解析容错

**文件**：`apps/server/agents/cleaner.py`、`apps/server/agents/converter.py`

**问题**：LLM 返回的 JSON 前后可能包含额外文字（如解释说明），导致 `json.loads` 失败。

**修复**：在 `json.loads` 前增加容错逻辑：如果内容不以 `{` 开头，自动截取第一个 `{` 到最后一个 `}` 之间的内容。

---

## 7. 前端 API 路由修复

### 7.1 Pipeline 接口路径

**问题**：前端 `useFigma` hook 调用 `/api/figma`，但后端完整流水线接口是 `/api/pipeline/run`。

**文件**：
- `apps/web/hooks/useFigma.ts` — 改为调用 `/pipeline/run`
- `apps/web/app/api/pipeline/run/route.ts` — 新增 Next.js BFF 转发

### 7.2 Figma Config 接口路由

**问题**：Next.js App Router 中 `api/figma/route.ts` 只匹配精确路径 `/api/figma`，不匹配 `/api/figma/config`。

**文件**：`apps/web/app/api/figma/config/route.ts` — 新增独立路由文件

---

## 当前已知问题

1. **LLM 输出格式不稳定**：智谱 GLM-4 在 JSON 输出场景下偶尔返回非纯 JSON 内容，已通过容错处理缓解
2. **Agent 模式 (orchestrator.py)**：LangChain 1.x 中 `AgentExecutor` 和 `ConversationSummaryBufferMemory` 已移除，Agent 模式和 Chat 模式暂不可用，Simple Chain 模式正常
