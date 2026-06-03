# Agent 5: 测试验证 — 详细设计文档

## 概述

Agent 5 负责验证 Agent 4 生成的代码质量。采用**双重验证**策略：先用 Python 做 AST 静态分析（确定性），再用 DeepSeek-V3 做深度审查（AI 辅助）。

**核心原则**：能确定的用代码，不能确定的用 LLM。

---

## 双重验证架构

```
生成的代码
    │
    ├──────────────────┐
    │                  │
    ▼                  ▼
第一阶段              第二阶段
AST 静态分析          LLM 深度审查
(Python 代码)        (DeepSeek-V3)
    │                  │
    │  确定性问题        │  主观问题
    │  ├ 括号匹配        │  ├ API 正确性
    │  ├ 标签闭合        │  ├ 可访问性
    │  ├ 导入检查        │  ├ 性能优化
    │  ├ 安全扫描        │  └ 最佳实践
    │  └ 列表 key       │
    │                  │
    ▼                  ▼
合并验证报告 + 修复建议
```

---

## 第一阶段：AST 静态分析

### 检查 1: 括号匹配

```python
def _ast_syntax_check(code: str) -> List[str]:
    issues = []

    # 检查 { }, ( ), [ ] 三种括号是否匹配
    brackets = {"{": "}", "(": ")", "[": "]"}
    stack = []
    for i, ch in enumerate(code):
        if ch in brackets:
            stack.append((ch, i))
        elif ch in brackets.values():
            if not stack:
                issues.append(f"ERROR: 第 {i} 个字符附近多余的 '{ch}'")
            else:
                opening, pos = stack.pop()
                expected = brackets[opening]
                if ch != expected:
                    issues.append(
                        f"ERROR: 第 {pos} 个字符附近 '{opening}' "
                        f"的闭合符号应该是 '{expected}', 但找到了 '{ch}'"
                    )

    # 未闭合的括号
    for opening, pos in stack:
        issues.append(f"ERROR: 第 {pos} 个字符附近 '{opening}' 未闭合")

    return issues
```

**检测示例**：

| 代码 | 检测结果 |
|------|---------|
| `function foo() { return 1; }` | ✅ 通过 |
| `function foo() { return 1;` | ❌ `{` 未闭合 |
| `const x = [1, 2);` | ❌ `[` 用 `)` 闭合了 |

### 检查 2: HTML/JSX 标签闭合

```python
# 正则匹配所有标签: <div>, </div>, <input>, <br />
tag_pattern = re.findall(r'<(/?)(\w+)[^>]*>', code)
tag_stack = []

for is_closing, tag_name in tag_pattern:
    if is_closing:  # </tag>
        if not tag_stack:
            issues.append(f"WARNING: 多余的闭合标签 </{tag_name}>")
        else:
            opened = tag_stack.pop()
            if opened != tag_name:
                issues.append(f"ERROR: 标签不匹配: <{opened}> 与 </{tag_name}>")
    else:  # <tag>
        # 自闭合标签不压栈
        if tag_name not in ("br", "hr", "img", "input", "meta", "link"):
            tag_stack.append(tag_name)

# 未闭合的标签
for unclosed in tag_stack:
    issues.append(f"ERROR: 未闭合的标签 <{unclosed}>")
```

**检测示例**：

| 代码 | 检测结果 |
|------|---------|
| `<div><span>text</span></div>` | ✅ 通过 |
| `<div><span>text</div>` | ❌ `<span>` 未闭合 |
| `<img src="x" />` | ✅ 通过（自闭合） |

### 检查 3: 导入语句检查

```python
# Vue 组件检查
if "vue" in code.lower() or "template" in code.lower():
    if "import" not in code and "require" not in code:
        issues.append("WARNING: Vue 组件中缺少 import 语句")
    if "export default" not in code:
        issues.append("WARNING: Vue 组件中缺少 export default")

# React 组件检查
if "react" in code.lower() or "tsx" in code.lower():
    if "import React" not in code and "from 'react'" not in code:
        issues.append("WARNING: React 组件中可能缺少 React 导入")
```

### 检查 4: 安全扫描

```python
# XSS 风险检查
if "dangerouslySetInnerHTML" in code:
    issues.append("WARNING: 使用了 dangerouslySetInnerHTML, 存在 XSS 风险")
if "v-html" in code:
    issues.append("WARNING: 使用了 v-html, 存在 XSS 风险")
if "eval(" in code:
    issues.append("ERROR: 使用了 eval(), 严重安全风险")
```

**为什么这些是安全风险**：

| API | 风险 | 替代方案 |
|-----|------|---------|
| `dangerouslySetInnerHTML` | 直接插入 HTML，可能注入脚本 | 使用 React 组件渲染 |
| `v-html` | Vue 中直接渲染 HTML | 使用 `{{ }}` 插值 |
| `eval()` | 执行任意代码 | 使用 JSON.parse 或函数引用 |

### 检查 5: 列表渲染 key 属性

```python
# React: 使用了 .map() 但没有 key 属性
if "?.map" in code and "key={" not in code:
    issues.append("WARNING: 列表渲染中可能缺少 key 属性")
```

**为什么需要 key**：React/Vue 用 key 追踪列表中的每个元素，缺少 key 会导致渲染错误和性能问题。

---

## 第二阶段：LLM 深度审查

AST 只能检查语法层面的问题，以下问题需要 LLM：

```python
review_prompt = f"""检查以下代码并修复问题。

AST 静态分析结果:
{ast_result}

检查清单:
- 组件库 API 用法是否正确
- TypeScript 类型是否完整
- 可访问性 (alt, aria-label, role)
- 响应式设计 (是否使用相对单位)
- 性能问题 (多余的 re-render, 大列表是否需要虚拟滚动)

代码:
```{language}
{code[:5000]}
```

如果代码没问题且 AST 已通过, 输出 "PASSED"。
如果有问题, 输出:
1. 问题列表
2. 修复后的完整代码

用中文回复。"""
```

### LLM 审查的能力范围

| 检查项 | AST 能做？ | LLM 能做？ |
|--------|-----------|-----------|
| 括号匹配 | ✅ | ✅ |
| 标签闭合 | ✅ | ✅ |
| 导入语句 | ✅ 部分 | ✅ |
| XSS 风险 | ✅ 关键词 | ✅ 上下文分析 |
| 组件 API 正确性 | ❌ | ✅ 需要语义理解 |
| TypeScript 类型 | ❌ | ✅ 需要类型推断 |
| 可访问性 a11y | ❌ | ✅ 需要语义理解 |
| 响应式设计 | ❌ | ✅ 需要设计判断 |
| 性能优化 | ❌ | ✅ 需要经验判断 |

---

## 输出格式

### 通过时

```
==================================================
AST 静态分析:
==================================================
PASSED: AST 静态分析通过

==================================================
LLM 深度审查:
==================================================
PASSED
```

### 有问题时

```
==================================================
AST 静态分析:
==================================================
## AST 静态分析发现的问题:
- ERROR: 第 156 个字符附近 '{' 未闭合
- WARNING: 列表渲染中可能缺少 key 属性

==================================================
LLM 深度审查:
==================================================
## 问题列表:
1. ERROR: 第 45 行 <el-button> 的 type 属性值 'primay' 拼写错误, 应为 'primary'
2. WARNING: 第 78 行图片缺少 alt 属性, 影响可访问性
3. INFO: 建议将登录表单提取为独立组件, 提高可复用性

## 修复后的代码:
<template>
  ...
</template>
```

---

## 处理流程

```
生成的代码
    │
    ▼
validate_and_fix()
    │
    ├── 第一阶段: _ast_syntax_check(code)
    │      ├── 括号匹配检查
    │      ├── 标签闭合检查
    │      ├── 导入语句检查
    │      ├── 安全扫描 (XSS)
    │      └── 列表 key 检查
    │
    ├── 第二阶段: code_llm.invoke(review_prompt)
    │      ├── 组件 API 正确性
    │      ├── TypeScript 类型
    │      ├── 可访问性
    │      ├── 响应式设计
    │      └── 性能优化
    │
    └── 合并输出
           ├── AST 结果
           ├── LLM 结果
           └── 修复后的代码（如有）
    │
    ▼
验证报告 + 修复建议
```

---

## 代码位置

`apps/server/main.py`

| 函数 | 职责 |
|------|------|
| `validate_and_fix()` | `@tool` 函数，入口，编排两阶段验证 |
| `_ast_syntax_check()` | AST 静态分析，5 项确定性检查 |

---

## 测试用例

### 用例 1: 括号不匹配

**输入**:
```jsx
function App() {
  return <div>Hello
}
```

**预期 AST 结果**:
```
ERROR: 第 30 个字符附近 '(' 的闭合符号应该是 ')', 但找到了 '{'
```

### 用例 2: XSS 风险

**输入**:
```jsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**预期 AST 结果**:
```
WARNING: 使用了 dangerouslySetInnerHTML, 存在 XSS 风险
```

### 用例 3: 缺少 key

**输入**:
```jsx
{items.map(item => <div>{item.name}</div>)}
```

**预期 AST 结果**:
```
WARNING: 列表渲染中可能缺少 key 属性
```

### 用例 4: 完全通过

**输入**:
```vue
<template>
  <div class="container">
    <el-button type="primary" @click="handleClick">提交</el-button>
  </div>
</template>
<script>
export default {
  methods: {
    handleClick() { console.log('clicked') }
  }
}
</script>
```

**预期结果**:
```
AST: PASSED
LLM: PASSED (或少量 INFO 建议)
```
