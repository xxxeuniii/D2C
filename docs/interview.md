# D2C Multi-Agent Pipeline — 面试问答

> 按面试真实顺序排列，⭐ 表示难度和追问深度

---

## 开场：项目介绍

### ⭐ Q1：简单介绍一下你这个项目？

**答**：D2C 是一个 Design-to-Code 工具。输入 Figma 设计稿链接，输出可运行的前端代码（React/Vue）。

核心技术：用 5 个 AI Agent 把 Figma → 代码这个过程自动化。第一步清洗数据，第二步转成结构化描述，第三步查组件文档，第四步生成代码，第五步验证。用户还可以通过对话让 Agent 反复修改代码，直到满意。

技术栈：LangChain + FastAPI + ChromaDB + DeepSeek-V3 / Qwen2.5-7B，前端 Next.js。

### ⭐ Q2：你主要负责哪些部分？

**答**：整个后端 Agent 流水线是我设计和实现的。包括 5 个 Agent 的逻辑、LangChain 的 Tool/Memory/Chain 集成、ChromaDB 向量检索、LLM Prompt 工程、错误处理和降级策略。

---

## 追问：Agent 设计

### ⭐⭐ Q3：为什么分成 5 个 Agent？不能一个大模型直接生成吗？

**答**：试过，效果不好。

一个大 Prompt 塞进原始 Figma JSON + 生成要求，LLM 经常：
- 搞混 Figma 内部字段和前端 CSS（比如把 Figma 的 `constraints` 当成 CSS `position`）
- 忽略设计稿里的隐藏图层
- 组件 API 用错

拆成 5 步之后，每步只做一个确定的事。而且前两步（清洗数据、转 DSL）用纯代码不用 LLM，100% 可靠。

### ⭐⭐ Q4：你说 Agent 1 和 2 不用 LLM，那它们算什么 Agent？

**答**：Agent 的本质是"能独立完成一个子任务"，不一定要有 LLM。

Agent 1 用 Python 递归遍历 JSON 树，把 Figma 格式转成 CSS 属性（RGBA → hex、Auto Layout → Flexbox），这是确定性的，不需要 AI。

但我在代码基础上加了 LLM 辅助——比如分析所有颜色值，自动识别哪个是主色、哪个是背景色，生成 CSS 变量名。LLM 失败不影响基础清洗结果。

### ⭐⭐⭐ Q5：那 LLM 辅助增强具体做了什么？怎么保证失败不影响？

**答**：Agent 1 的 LLM 增强做三件事：颜色语义化（`#1A1C26` → `--bg-surface`）、文本分类（"请输入用户名" → `placeholder`）、布局意图推断（这个区域是 sidebar 还是 content）。

Agent 2 的 LLM 增强做六件事：组件类型推断、Props 提取、关系识别、Design Token 化、交互逻辑推断、响应式建议。

保证失败不影响的方式很简单——所有 LLM 调用都包在 `try/except` 里：
```python
try:
    enhanced = call_llm(cleaned_data)
    return enhanced
except Exception as e:
    cleaned_data["llmEnhancement"] = {"error": str(e), "status": "fallback"}
    return cleaned_data  # 返回原始数据，流水线继续
```

---

## 追问：Tool + Memory

### ⭐⭐⭐ Q6：你说 Agent 可以多轮对话修改代码，具体怎么实现的？

**答**：流水线跑完后生成初始代码，然后用户可以通过 Chat API 反复修改。

关键是 **Memory**。我用 LangChain 的 `ConversationSummaryBufferMemory`，它会自动记住每轮对话：
- 第 1 轮：用户说"把按钮改成蓝色"→ Agent 修改 → Memory 记住
- 第 2 轮：用户说"加圆角"→ Memory 告诉 Agent "上一轮改了蓝色"，Agent 在蓝色基础上加圆角
- 第 3 轮：用户说"加 checkbox"→ Agent 知道前两轮改了什么

Agent 通过 Tool 来执行修改——`get_current_code()` 看代码，`modify_code()` 调用 DeepSeek-V3 修改。

### ⭐⭐⭐ Q7：Memory 满了怎么办？

**答**：`ConversationSummaryBufferMemory` 会自动压缩。

我设了 `max_token_limit=3000`。当对话历史 Token 超过 3000 时，它用一个小模型（Qwen 7B, temperature=0）把早期对话压缩成摘要。比如"用户先要求把按钮改成蓝色，又要求加 8px 圆角，然后加了 checkbox"替代原始的多轮对话。最近的消息保留原文。

这样既省 Token，又不丢失关键上下文。

### ⭐⭐ Q8：Agent 之间怎么传递数据？

**答**：通过一个共享字典，我封装成了两个 Tool：`save_to_context(key, value)` 和 `read_from_context(key)`。

Agent 1 写入 `ctx["cleaned_data"]`，Agent 2 读取 `ctx["cleaned_data"]`。比 Memory 更直接——Memory 记对话，Context 传数据，各司其职。

---

## 追问：LLM 工程

### ⭐⭐ Q9：为什么用了两个模型？怎么选的？

**答**：因任务选模型。

决策类任务（Agent 决定调用哪个 Tool、Memory 摘要）用便宜的 Qwen 7B。代码生成和修改用 DeepSeek-V3，因为它代码能力强，输出窗口 8192 tokens 能生成完整文件。

成本差距很大——Qwen 7B 约 ¥0.5/百万 token，DeepSeek-V3 约 ¥2/百万 token。全用 V3 成本翻 4 倍，但决策质量提升不大。

### ⭐⭐ Q10：Prompt 怎么写的？有什么经验？

**答**：三个要点：
1. **分层约束**：角色 → 输入格式 → 框架规则 → 设计系统 → 结构规则 → 输出格式。从抽象到具体。
2. **输出控制**："只输出代码，不要任何解释"——这句必须加，否则 LLM 会在代码前后加 Markdown 标记。
3. **设计系统内置**：不说"用好看的配色"，直接给 `#0D1117`、`#E6EDF3`。不给 LLM 自由发挥空间。

### ⭐⭐ Q11：LLM 输出的代码质量怎么保证？

**答**：两层验证。先用 Python 做 AST 静态分析（括号匹配、标签闭合、XSS 风险扫描），这是确定性的，毫秒级。再用 DeepSeek-V3 做深度审查（API 用法对不对、类型全不全、有没有可访问性问题）。

---

## 追问：RAG

### ⭐⭐ Q12：知识检索（RAG）做了什么？

**答**：Agent 3 从 ChromaDB 检索组件库文档，附加到 DSL 里。

比如 DSL 里有 button 和 table 组件，Agent 3 就去 ChromaDB 查"element-plus button 组件 API"和"element-plus table 组件 API"，把文档片段附上。这样 Agent 4 生成代码时知道正确的 API 名称和属性。

用 ChromaDB 本地存储 + BGE-M3 做向量化（通过 SiliconFlow API）。

---

## 追问：工程细节

### ⭐⭐ Q13：出了错怎么办？有什么容错机制？

**答**：三层：
- LLM 增强失败 → 降级为纯代码输出，不影响流水线
- 单个 Agent 失败 → 继续执行后续 Agent，不整体崩溃
- LLM 输出格式错误 → `handle_parsing_errors=True` 自动重试

### ⭐ Q14：这个项目上线还缺什么？

**答**：主要是 API 鉴权、速率限制（防止费用失控）、持久化存储（Memory 和 Context 目前在内存里，重启就没了）、监控告警。

### ⭐ Q15：一次生成大概花多少钱？

**答**：一次完整流水线约 3-4 分钱。每轮对话修改约 1 分钱。主要开销在 DeepSeek-V3 的代码生成和验证环节。

---

## 收尾

### ⭐ Q16：你觉得最难的地方在哪？

**答**：在"什么时候用 LLM、什么时候用代码"之间做权衡。太依赖 LLM 不稳定、成本高，太依赖代码又不够智能。最终方案是代码兜底 + LLM 增强，LLM 失败时安全降级。这个设计理念贯穿了整个项目。

### ⭐ Q17：如果重新做，会改什么？

**答**：Chat Agent 的代码修改目前是全量重新生成，应该改成增量 diff 模式，只改用户要求的部分。另外流水线前两个 Agent 可以合并，减少步骤。
