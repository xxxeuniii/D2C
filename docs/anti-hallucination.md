# RAG 反幻觉防御方案

> 用最直白的方式解释怎么解决 LLM 看了文档还瞎编的问题

---

## 一、问题是什么

LLM 生成代码时会出现幻觉——即使给了正确的组件文档，它还是可能瞎编：

```
文档写的:    <el-button type="primary">
LLM 生成的:  <el-button theme="primary" @submit="handle">
                         ↑ 瞎编的       ↑ 瞎编的
```

三个来源：
1. **检索不相关**：DSL 里需要 `input`，ChromaDB 返回了 `el-input-number` 的文档
2. **LLM 不看文档**：文档写 `type`，LLM 偏要写 `theme`
3. **审查者自己瞎**：用 LLM 审查 LLM 的代码，它看不见自己的错误

**核心原则：不用 LLM 审 LLM。** LLM 生成的代码不能靠 LLM 来检查——它自己编的 `theme`，审查时也会觉得 `theme` 没问题。要用代码检查，代码不会骗你。

---

## 二、解决方案：四层防御

整个过程是这样的：

```
LLM 生成的代码
      │
      ▼
┌─────────────────┐
│ 第一层：检索过滤  │  文档不相关的直接扔掉
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ 第二层：Prompt   │  在提示词里说"不确定就别用"
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ 第三层：白名单   │  ★ 核心防线 ★
│ Python 代码检查  │  白名单 = 正确答案，代码 = 对答案
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ 第四层：LLM 修复 │  只在白名单发现问题时才调
│ 不是审查是修复   │  省钱
└─────────────────┘
```

---

## 三、每一层具体怎么做

### 第一层：检索过滤（Agent 3）

**问题**：ChromaDB 查到的文档可能跟需求不沾边。

```
DSL 需要: input 组件
ChromaDB 返回: el-input-number 的文档
  为什么？向量相似度高，但完全是两个组件
```

**做法**：拿到文档后检查文档里有没有目标组件的名字。

```python
def filter_retrieval_results(component_type, results):
    for doc in results:
        # 文档里有没有提到 input？
        if component_type not in doc.lower():
            continue  # 没有？扔掉，这个文档不相关
        # 相关性分数太低的也扔掉
        if score > 0.5:
            continue
        # 通过的才留下
        filtered.append(doc)
    return filtered[:2]
```

**一句话**：文档里没提到目标组件名，直接扔掉。

---

### 第二层：Prompt 约束（Agent 4）

**问题**：LLM 看了文档但还是瞎编。

**做法**：在 Prompt 里加一段话：

```
## 防幻觉规则（必须严格遵守）:
1. 只使用文档里出现的 API，不要编造
2. 不确定某个属性是否存在 → 不要用
3. 不确定就写 // TODO: 确认这个 API
```

**一句话**：告诉 LLM "不确定就别用"，能减少一部分幻觉，但不能杜绝。

---

### 第三层：白名单检查（Agent 5，★ 核心）

**问题**：Prompt 约束不能 100% 杜绝幻觉，LLM 还是会编。

**做法**：用代码检查 LLM 生成的代码，像老师改卷子一样对答案。

#### 3.1 准备正确答案（白名单）

```python
白名单 = {
    "el-button": {
        "可以用的属性": ["type", "size", "disabled", "loading", "round", "circle"],
        "可以用的写法": ["@click", "@focus", "@blur"],
    },
    "el-input": {
        "可以用的属性": ["placeholder", "disabled", "clearable", "maxlength", "type"],
        "可以用的写法": ["@input", "@change", "@focus", "@blur"],
    },
    # ... 30+ 个组件
}
```

白名单从哪里来？**手工维护**。从 Element Plus 官方文档抄的，一次抄完，永久可靠。为什么不从文档自动提取？文档格式不统一（有的是 Markdown、有的是 HTML），自动提取可能漏掉或搞错。

#### 3.2 提取代码里用了什么（对答案）

```python
# LLM 生成的代码
代码 = '<el-button theme="primary" @submit="handle">'

# 用正则提取
提取结果 = {
    "el-button": {
        "用了这些属性": ["theme"],      # type= 后面的 "primary" 不用管
        "用了这些写法": ["submit"],      # @submit 里的 submit
    }
}
```

#### 3.3 跟白名单比对（判对错）

```python
# 白名单里 el-button 可以用的属性: [type, size, disabled, loading, round, circle]
# 代码里用了: theme
# theme 在不在白名单里？→ 不在 → 幻觉！

# 白名单里 el-button 可以用的写法: [click, focus, blur]
# 代码里用了: submit
# submit 在不在白名单里？→ 不在 → 幻觉！

# 报告
"el-button 的 theme 属性不存在，你是不是想用 type？"
"el-button 不支持 @submit，请用 @click"
```

**就这么简单。白名单是正确答案，代码做的是对答案。**

---

### 第四层：LLM 修复（Agent 5，辅助）

**问题**：白名单只负责"发现问题"，不负责"修问题"。

**做法**：只在白名单发现问题时才调 LLM，让它修复：

```python
if 白名单发现了问题:
    # 把发现的问题告诉 LLM
    prompt = f"""
    代码: <el-button theme="primary" @submit="handle">
    问题: theme 属性不存在，应该是 type
          @submit 事件不存在，应该是 @click
    请修复这些幻觉，其他代码不要动。
    """
    LLM修复 = code_llm.invoke(prompt)
else:
    # 没发现问题，不调 LLM，省钱
    pass
```

**LLM 在这里不是"审查者"，是"修理工"。** 审查是代码做的（100% 确定），修复才是 LLM 做的。

---

## 四、一张图看懂整个流程

```
LLM 生成的代码: <el-button theme="primary" @submit="handle">
                         │
                         ▼
              ┌─────────────────────┐
              │  Python 白名单检查   │  ← 确定性，100% 可靠
              │                     │
              │  theme 在白名单里吗？ │
              │  → 不在！幻觉！       │
              │                     │
              │  submit 在白名单里吗？│
              │  → 不在！幻觉！       │
              └─────────────────────┘
                         │
                    发现问题了
                         │
                         ▼
              ┌─────────────────────┐
              │  LLM 修复代码        │  ← 只在发现问题时调用
              │                     │
              │  "改成 type='primary'│
              │   改成 @click"       │
              └─────────────────────┘
                         │
                         ▼
              修复后: <el-button type="primary" @click="handle">  ✅
```

**白名单是裁判（判对错），LLM 是修理工（改错误）。裁判不能说瞎话，修理工可以。**

---

## 五、效果对比

| 场景 | 没防御 | 有防御 |
|------|--------|--------|
| LLM 写 `<el-button theme="primary">` | 直接输出，没人发现 | **拦截**：白名单里没有 `theme` |
| LLM 写 `<el-button @submit="...">` | 直接输出 | **拦截**：白名单里没有 `submit` 事件 |
| ChromaDB 返回了不相关文档 | LLM 照着错文档写 | **拦截**：检索过滤，文档不含目标组件名就扔 |
| LLM 写 `<el-button type="primary">` | 正确 | **放行**：白名单里有 `type` |

---

## 六、常见疑问

### 为什么用正则不用真正的 AST 解析器？

因为代码可能是 Vue 也可能是 React，没有一种 AST 能同时解析两种。而且 LLM 生成的代码可能有语法错误，真 AST 直接报错退出，正则还能继续提取。

### 为什么手工维护白名单？

白名单是知识不是数据。从文档自动提取不可靠（格式不统一），手工抄一次就永久可靠。30 个组件的白名单，抄完就完了。

### 为什么不用 LLM 审 LLM？

同一个 LLM 生成的代码，它审查时会觉得自己写的是对的。`theme` 是它编的，审查时也会觉得 `theme` 没问题。LLM 不会自己打自己脸。

### 白名单不完整怎么办？

不完整比没有好。30 个常用组件覆盖了 90% 的场景。新组件可以随时加到白名单里。shadcn/ui 这种无严格 API 的库，白名单为空，走第四层 LLM 修复兜底。
