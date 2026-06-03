# Agent 4: 代码生成 — 详细设计文档

## 概述

Agent 4 是整个流水线中**唯一使用 LLM** 的 Agent。它接收 Agent 3 输出的 DSL（包含组件文档），调用 DeepSeek-V3 生成完整的、可运行的前端页面代码。

**为什么必须用 LLM**：代码生成是创造性任务，需要理解设计意图、选择合适的组件 API、处理边界情况。规则引擎无法完成。

---

## 输入 → 输出

### 输入（Agent 3 的带文档 DSL）

```json
{
  "pageName": "登录页",
  "framework": "vue2",
  "componentLib": "element-plus",
  "components": [
    {
      "name": "LoginForm",
      "type": "container",
      "styles": { "display": "flex", "flexDirection": "column", "gap": 16, "padding": "24px", "width": 400, "backgroundColor": "#1A1C26" },
      "children": [
        { "name": "username", "type": "input", "styles": { "width": 352, "height": 44 } },
        { "name": "submit", "type": "button", "styles": { "width": 352, "height": 48, "backgroundColor": "#2EA043" }, "props": { "text": "登 录" } }
      ]
    }
  ],
  "componentDocs": {
    "input": "<el-input v-model=\"value\" placeholder=\"请输入\" clearable></el-input>",
    "button": "<el-button type=\"primary\" :loading=\"loading\">提交</el-button>"
  }
}
```

### 输出（完整 Vue 2 代码）

```vue
<template>
  <div class="login-page">
    <div class="login-form" :style="formStyles">
      <el-input
        v-model="username"
        placeholder="请输入用户名"
        clearable
        :style="{ width: '352px', height: '44px' }"
      />
      <el-button
        type="primary"
        :style="{ width: '352px', height: '48px', backgroundColor: '#2EA043' }"
        :loading="loading"
        @click="handleLogin"
      >
        登 录
      </el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginPage',
  data() {
    return {
      username: '',
      loading: false,
      formStyles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        width: '400px',
        backgroundColor: '#1A1C26',
      },
    }
  },
  methods: {
    async handleLogin() {
      this.loading = true
      try {
        // TODO: 调用登录 API
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #0D1117;
}
</style>
```

---

## LLM 配置

```python
code_llm = ChatOpenAI(
    model="deepseek-ai/DeepSeek-V3",
    api_key=SILICONFLOW_API_KEY,
    base_url="https://api.siliconflow.cn/v1",
    temperature=0.3,     # 较低温度保证一致性
    max_tokens=8192,     # 足够生成完整页面
)
```

**为什么选择 DeepSeek-V3**：
- 代码生成能力强，比 Qwen2.5-7B 好很多
- 8192 tokens 输出，支持长代码
- 通过 SiliconFlow 调用，成本低

---

## Prompt 设计

### System Prompt（隐式，通过 HumanMessage 传递）

```
你是一个资深前端开发。根据以下设计 DSL 和组件文档生成完整的 {framework} 页面代码。

## DSL + 组件文档:
{dsl_with_docs}

## 要求:
- {框架特定要求}
- 暗色主题: 背景 #0D1117, 文字 #E6EDF3, 边框 rgba(255,255,255,0.1)
- 所有组件必须按 DSL 的 components 结构排列, 保持父子关系
- 组件库文档中的 API 用法严格遵循
- Tailwind CSS 处理样式
- 完整可运行的代码文件
- TypeScript 类型定义

只输出代码, 不要任何解释:
```

### 框架特定要求

| 框架 | 额外要求 |
|------|---------|
| `react` | React 18 + TypeScript + Hooks, 使用函数组件 |
| `vue2` | Vue 2 + Options API, 使用 Element Plus 组件库 |
| `nextjs` | Next.js 14 App Router, React Server Components |

---

## 代码生成规则

### 规则 1: 组件结构严格遵循 DSL

DSL 中的组件层级关系必须保留：

```
DSL: LoginForm (container)
      ├── username (input)
      └── submit (button)

生成的代码结构:
<div class="login-form">
  <el-input ... />
  <el-button ... />
</div>
```

### 规则 2: 组件库 API 优先

```python
# DSL 中有 componentDocs 时，优先使用文档中的 API

# 例如 componentDocs.button 提到 <el-button type="primary">
# → 生成时使用 type="primary"
<el-button type="primary">登录</el-button>

# 而不是
<button class="...">登录</button>
```

### 规则 3: 样式处理

DSL 中的 styles 直接映射为 CSS：

```
DSL: { "backgroundColor": "#2EA043", "borderRadius": 8 }
→ CSS: background-color: #2EA043; border-radius: 8px;
→ Tailwind: 或使用 bg-[#2EA043] rounded-lg
```

### 规则 4: 暗色主题

全局应用暗色主题变量：

```
背景: #0D1117 (最深)
卡片: #1A1C26 (表面)
文字: #E6EDF3 (高对比)
次要文字: #8B949E
边框: rgba(255, 255, 255, 0.1)
```

---

## 处理流程

```
DSL + componentDocs
    │
    ▼
generate_page_code()
    │
    ├── 构建 Prompt
    │      ├── 系统角色定义
    │      ├── DSL 数据 (截取 6000 字符)
    │      ├── 框架特定要求
    │      └── 输出格式要求
    │
    ├── code_llm.invoke(prompt)
    │
    └── 返回生成的代码字符串
    │
    ▼
完整代码
```

---

## 代码位置

`apps/server/main.py`

| 函数 | 职责 |
|------|------|
| `generate_page_code()` | `@tool` 函数，构建 Prompt 并调用 DeepSeek-V3 |

---

## 为什么 Agent 4 必须用 LLM？

| 任务 | 能否用代码？ | 原因 |
|------|------------|------|
| 数据清洗 (Agent 1) | ✅ 可以 | 确定性过滤规则 |
| 结构化转换 (Agent 2) | ✅ 可以 | 关键词匹配 + 字段映射 |
| 知识检索 (Agent 3) | ✅ 可以 | ChromaDB API 调用 |
| **代码生成 (Agent 4)** | ❌ 不行 | 需要理解设计意图、选择 API、处理边界 |
| 测试验证 (Agent 5) | ⚠️ 部分可以 | AST 可以，深度审查需要 LLM |

代码生成是流水线中唯一真正需要 AI 创造力的环节。

---

## 测试用例

### 用例 1: React 按钮组件

**输入 DSL**:
```json
{
  "framework": "react",
  "components": [{
    "name": "action-button",
    "type": "button",
    "styles": { "backgroundColor": "#2EA043", "borderRadius": 8 },
    "props": { "text": "提交" }
  }]
}
```

**预期输出**（关键检查点）:
- 使用 React 函数组件
- 按钮背景色 `#2EA043`
- 圆角 `8px`
- 文本 "提交"

### 用例 2: Vue 2 表单

**输入 DSL**:
```json
{
  "framework": "vue2",
  "componentLib": "element-plus",
  "components": [{
    "name": "search-form",
    "type": "container",
    "children": [
      { "name": "keyword", "type": "input" },
      { "name": "search-btn", "type": "button", "props": { "text": "搜索" } }
    ]
  }],
  "componentDocs": {
    "input": "<el-input v-model=\"value\"></el-input>",
    "button": "<el-button type=\"primary\">按钮</el-button>"
  }
}
```

**预期输出**（关键检查点）:
- Vue 2 Options API 格式
- 使用 `<el-input>` 和 `<el-button>`
- data() 中有 keyword 变量
- methods 中有搜索方法
