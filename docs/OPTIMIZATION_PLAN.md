# D2C 工程优化计划

> 基于产品经理 + 架构师双视角的全量审查，2024-06-04

## 一、优化优先级总览

| 优先级 | 问题 | 类型 | 修复成本 | 状态 |
|--------|------|------|----------|------|
| **P0** | 全局状态并发冲突（`_pipeline_context`） | 架构 Bug | 中 | ✅ 已修复 |
| **P0** | Chat Agent 全局单例（不支持多会话） | 架构 Bug | 中 | ✅ 已修复 |
| **P0** | 流水线无错误中断机制 | 功能缺陷 | 低 | ✅ 已修复 |
| **P0** | Figma Token 回退逻辑错误 | 逻辑 Bug | 低 | ✅ 已修复 |
| **P1** | 前端超时 30s（流水线执行远超此时间） | 体验问题 | 低 | ✅ 已修复 |
| **P1** | 反幻觉 LLM 交叉验证结果未使用 | 功能缺失 | 低 | ✅ 已修复 |
| **P2** | Prompt 模板分散管理（15+ Prompt 在 5 个文件） | 可维护性 | 低 | ✅ 已修复 |
| **P1** | 前端未接入 Agent/Chat 模式 | 功能缺失 | 中 | 🔲 待修复 |
| **P1** | Chat 全量重新生成（浪费 Token） | 性能浪费 | 高 | 🔲 待修复 |
| **P1** | RAG Worker 僵尸服务 | 冗余代码 | 低 | 🔲 待修复 |
| **P2** | 白名单手动维护（593行硬编码） | 可维护性 | 高 | 🔲 待修复 |
| **P2** | 缺少集成测试与端到端测试 | 质量保障 | 高 | 🔲 待修复 |
| **P2** | 缺少历史记录与用量统计 | 产品完整性 | 中 | 🔲 待修复 |
| **P2** | 代码预览缺少 Monaco Editor + Live Preview | 用户体验 | 中 | 🔲 待修复 |
| **P2** | ChromaDB 缺少数据初始化脚本 | 上手体验 | 低 | 🔲 待修复 |

---

## 二、已修复详情

### P0-1: 全局状态并发冲突

> 💡 **前端类比**: 相当于你在 React 里用了一个全局 `let state = {}` 存储所有请求的数据，用户 A 和用户 B 同时操作，B 的数据直接覆盖 A 的数据，最后 A 拿到的是 B 的结果。

**文件**: `apps/server/agents/tools.py`

**问题**: `_pipeline_context: dict = {}` 是模块级全局变量，所有并发请求共享同一个字典。两个人同时点"生成代码"，第一个人的 Figma 数据可能被第二个人覆盖，最终生成错误的代码。

**修复**: 用 Python 的 `contextvars.ContextVar`（相当于每个请求有自己的独立作用域，类似 React 的 `useContext`），确保并发请求互不干扰。

```python
# 修复前（全局变量，多人同时用会串数据）
_pipeline_context: dict = {}

# 修复后（每个请求独立，互不干扰）
_pipeline_context_var: contextvars.ContextVar = contextvars.ContextVar(
    "pipeline_context", default=None
)
def get_pipeline_context() -> dict:
    ctx = _pipeline_context_var.get()
    if ctx is None:
        ctx = {}
        _pipeline_context_var.set(ctx)
    return ctx
```

同时更新了 `save_to_context`、`read_from_context`、`get_current_code`、`modify_code`、`validate_current_code` 等所有引用全局变量的 Tool。

---

### P0-2: Chat Agent 全局单例

> 💡 **前端类比**: 相当于你的聊天应用只有一个全局的 `conversation` 对象，用户 A 说"改成蓝色"，用户 B 接着说"加搜索框"，结果 AI 的 Memory 里把两个用户的要求混在一起了。

**文件**: `apps/server/agents/orchestrator.py`, `pipeline.py`, `routers/pipeline.py`, `models.py`

**问题**: Chat Agent（流水线跑完后可以多轮对话改代码的功能，类似 ChatGPT 对话）原来是全局单例，所有用户共用一个聊天记忆。用户 A 的对话历史会被用户 B 覆盖。

**修复**: 引入 `session_id` 机制，每个用户拥有独立的聊天会话，用 `session_id` 区分不同用户。

```python
# 修复前（全局单例，只能存一个会话）
self.chat_executor: AgentExecutor = None

# 修复后（按 session_id 隔离，多用户独立对话）
self._chat_sessions: Dict[str, AgentExecutor] = {}

def chat(self, user_message: str, session_id: str = None) -> dict:
    sid = session_id or "default"
    if sid not in self._chat_sessions:
        self._chat_sessions[sid] = create_chat_agent_executor()
    # ...
```

**关联修改**:
- `pipeline.py`: `run_agent_pipeline` 传递 `session_id`
- `routers/pipeline.py`: `/api/pipeline/chat` 和 `/chat/reset` 支持 `session_id` 参数
- `models.py`: `PipelineRunRequest` 新增 `session_id` 字段

---

### P0-3: 流水线错误中断

> 💡 **前端类比**: 相当于你的 CI/CD 流水线，Lint 步骤挂了，但 Build 和 Deploy 步骤还是照样跑——结果 Build 依赖 Lint 的输出，全是无用功，还浪费了 CI 时长。

**文件**: `apps/server/agents/orchestrator.py`

**问题**: 5 个 Agent 是串行的（清洗 → 转换 → 检索 → 生成 → 验证），原来 Agent 2 失败了，Agent 3/4/5 仍然继续执行。但 Agent 3 依赖 Agent 2 的输出，后面全是空跑，白白烧 LLM API 的费用。

**修复**: Agent 失败时立刻 `break`，停止后续步骤，节省 API 费用。

```python
except Exception as e:
    results["agents"].append({...})
    print(f"[流水线中断] Agent {agent_num} 失败，停止后续 Agent 执行")
    break  # ← 失败后立即停止，不再浪费后续 API 调用
```

---

### P0-4: Figma Token 回退逻辑

> 💡 **前端类比**: 相当于你的代码里写 `const token = userToken || GITHUB_TOKEN`，拿 GitHub 的 Token 去调 Figma API——完全是两把不同的钥匙。只是恰巧之前没走到这个分支所以没暴露。

**文件**: `apps/server/config.py`, `routers/pipeline.py`

**问题**: 原来的回退逻辑是 `figma_token or SILICONFLOW_API_KEY`，把**硅基流动的 LLM API Key** 当作 Figma Token 的回退值。你的 Figma Token (`figd_KtKH...`) 已经在 `.env` 里配置好了，应该用 `FIGMA_TOKEN` 环境变量，而不是 LLM 平台的 Key。

**修复**:
- `config.py` 新增 `FIGMA_TOKEN = os.getenv("FIGMA_TOKEN", "")` 独立配置
- `routers/pipeline.py` 改为 `token = figma_token or FIGMA_TOKEN`，用你配置的 Figma Token

```python
# 修复前（拿 LLM 的 Key 当 Figma Token，完全不对）
token = figma_token or SILICONFLOW_API_KEY  # ❌ 这是 LLM 平台的 Key

# 修复后（用你配置的 Figma Token）
token = figma_token or FIGMA_TOKEN  # ✅ 这是你 .env 里的 Figma Token
```

---

### P1-1: 前端超时

> 💡 **通俗解释**: 你的后端要跑 5 步（5 个 Agent），每步都要调 LLM，整个过程可能需要 2-3 分钟。但前端的 axios 设置了 30 秒超时，后端还在跑呢，前端已经显示"请求失败"了——就像你煮饭要 30 分钟，但设了个 5 分钟的闹钟，闹钟响了就以为饭糊了。

**文件**: `apps/web/lib/api/client.ts`

**问题**: `timeout: 30000`（30 秒）不足以完成 5 个 Agent 的 LLM 调用。

**修复**: `timeout: 30000` → `timeout: 300000`（5 分钟）。

---

### P1-2: 反幻觉 LLM 交叉验证结果接入

> 💡 **通俗解释**: Agent 5（验证器）做了两层检查——第一层用代码规则检查 API 是否正确（快且准确），第二层用 LLM 再复核一遍（更深入）。但原来的代码只用了第一层的结果，第二层 LLM 的复核报告被扔掉了，等于白白调了一次 LLM，花了钱还没用上结果。

**文件**: `apps/server/agents/validator.py`

**问题**: `run_hallucination_check()` 返回的 `llm_review`（LLM 交叉验证结果）被丢弃，第四层防御未生效。

**修复**: 当发现 API 问题时，将 `llm_review` 合并到最终验证输出中。

```python
# 修复前（LLM 复核结果被丢弃，白白调了 LLM）
hallucination_result = run_hallucination_check(code, component_docs, component_lib)
api_issues = hallucination_result.get("api_issues", [])

# 修复后（LLM 复核结果接入使用）
hallucination_result = run_hallucination_check(code, component_docs, component_lib)
api_issues = hallucination_result.get("api_issues", [])
llm_review = hallucination_result.get("llm_review", None)
# ... 将 llm_review 合并到输出中
```

---

### P2-12: Prompt 模板集中管理

**问题**: 15+ 个 Prompt 散落在 5 个文件中（`orchestrator.py`、`memory.py`、`tools.py`、`generator.py`、`anti_hallucination.py`），修改 Prompt 需要翻找多处。

**修复**: 创建 `apps/server/prompts/` 包，按功能分为 4 个模块：

```
apps/server/prompts/
├── __init__.py              # 统一导出接口
├── agent_prompts.py         # 6 个 Agent Prompt + 5 个流水线任务模板
├── anti_hallucination.py    # 2 个反幻觉 Prompt（约束 + 交叉验证）
├── generation.py            # 3 个代码 Prompt 构建函数（生成/修改/审查）
└── enhancement.py           # 2 个语义增强 Prompt 构建函数（cleaner/converter）
```

**各文件 Prompt 迁移明细**:

| 原文件 | 迁移的 Prompt | 迁移到 | 迁移方式 |
|--------|-------------|--------|---------|
| `orchestrator.py` | `CHAT_AGENT_SYSTEM_PROMPT` | `agent_prompts.py` | 直接常量 |
| `orchestrator.py` | `CLEANER/CONVERTER/RETRIEVER/GENERATOR/VALIDATOR_PROMPT` | `agent_prompts.py` | 直接常量 |
| `orchestrator.py` | `PIPELINE_TASKS` | `agent_prompts.py` | 字典常量 |
| `memory.py` | 5 个 `SystemMessage` | `agent_prompts.py` | `AGENT_SYSTEM_PROMPTS` 字典 |
| `anti_hallucination.py` | `ANTI_HALLUCINATION_PROMPT` | `prompts/anti_hallucination.py` | 直接常量 |
| `anti_hallucination.py` | `CROSS_VALIDATION_PROMPT` | `prompts/anti_hallucination.py` | 模板字符串 |
| `generator.py` | 内联 f-string | `prompts/generation.py` | `build_code_generation_prompt()` |
| `tools.py` | `modify_code` 内联 f-string | `prompts/generation.py` | `build_code_modification_prompt()` |
| `validator.py` | `review_prompt` 内联 f-string | `prompts/generation.py` | `build_code_review_prompt()` |
| `cleaner.py` | 语义增强内联 f-string | `prompts/enhancement.py` | `build_cleaner_enhancement_prompt()` |
| `converter.py` | 语义增强内联 f-string | `prompts/enhancement.py` | `build_converter_enhancement_prompt()` |

---

## 三、修复后架构对比

```
修复前:                              修复后:
┌─────────────────────────┐         ┌─────────────────────────┐
│  全局 _pipeline_context  │         │  ContextVar 请求级隔离   │
│  全局 chat_executor      │         │  SessionManager 多会话   │
│  Agent 失败继续执行      │         │  Agent 失败立即 break    │
│  SILICONFLOW_KEY→Figma  │         │  FIGMA_TOKEN→Figma      │
│  前端 30s 超时           │         │  前端 300s 超时          │
│  LLM 交叉验证结果丢弃    │         │  LLM 交叉验证结果接入    │
│  Prompt 分散 5 个文件    │         │  Prompt 集中 prompts/    │
└─────────────────────────┘         └─────────────────────────┘
```

## 四、涉及文件清单

本次修复共涉及 **12 个文件**：

| 文件 | 修改类型 |
|------|---------|
| `apps/server/agents/tools.py` | 重构：ContextVar 替代全局变量 |
| `apps/server/agents/orchestrator.py` | 重构：session_id 隔离 + 错误中断 |
| `apps/server/agents/pipeline.py` | 修改：传递 session_id |
| `apps/server/agents/memory.py` | 重构：Prompt 改用 import |
| `apps/server/agents/generator.py` | 重构：Prompt 改用构建函数 |
| `apps/server/agents/validator.py` | 修复：LLM 交叉验证结果接入 + Prompt 迁移 |
| `apps/server/agents/anti_hallucination.py` | 重构：Prompt 改用 import |
| `apps/server/agents/cleaner.py` | 重构：Prompt 改用构建函数 |
| `apps/server/agents/converter.py` | 重构：Prompt 改用构建函数 |
| `apps/server/routers/pipeline.py` | 修改：session_id 支持 + Figma Token 修正 |
| `apps/server/config.py` | 新增：FIGMA_TOKEN 配置 |
| `apps/server/models.py` | 新增：session_id 字段 |
| `apps/web/lib/api/client.ts` | 修改：超时 30s → 300s |
| `apps/server/prompts/__init__.py` | 新增：统一导出 |
| `apps/server/prompts/agent_prompts.py` | 新增：Agent Prompt 集中管理 |
| `apps/server/prompts/anti_hallucination.py` | 新增：反幻觉 Prompt 集中管理 |
| `apps/server/prompts/generation.py` | 新增：代码 Prompt 构建函数 |
| `apps/server/prompts/enhancement.py` | 新增：语义增强 Prompt 构建函数 |
