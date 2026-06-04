"""
反幻觉模块 — 多层防御 RAG 幻觉问题

RAG 幻觉的三个来源：
1. 检索不准 → 文档不相关
2. LLM 不看文档 → 编造 API
3. 验证用 LLM 审 LLM → 审查者自己也幻觉

防御策略（从检索到验证，四层过滤）：
┌──────────────────────────────────────────────┐
│ 第一层：检索过滤（Agent 3）                    │
│   - 相关性阈值过滤低分文档                      │
│   - 提取 API 白名单（文档中真实存在的 API）      │
├──────────────────────────────────────────────┤
│ 第二层：Prompt 约束（Agent 4）                 │
│   - 强制引用文档中的 API 名称                   │
│   - 列出禁止编造的属性                           │
├──────────────────────────────────────────────┤
│ 第三层：AST API 验证（Agent 5，确定性）         │
│   - 从生成代码中提取所有组件 API 调用            │
│   - 与白名单比对，找出不在白名单中的 API          │
│   - 确定性检查，不用 LLM 审 LLM                │
├──────────────────────────────────────────────┤
│ 第四层：LLM 交叉验证（Agent 5，辅助）           │
│   - 只在 AST 通过后，用 LLM 做语义审查           │
│   - 要求 LLM 逐行对照文档检查                    │
└──────────────────────────────────────────────┘

注意: Prompt 定义已集中到 prompts/anti_hallucination.py 中管理。
"""
import re
import json
from prompts.anti_hallucination import ANTI_HALLUCINATION_PROMPT, CROSS_VALIDATION_PROMPT
from typing import List, Dict, Set, Tuple


# ============================================
# 组件库 API 白名单（确定性知识，不依赖 LLM）
# ============================================

# Element Plus 常用组件及其合法属性
ELEMENT_PLUS_API = {
    "el-button": {
        "props": ["type", "size", "disabled", "loading", "round", "circle", "plain", "text", "link", "icon", "nativeType"],
        "events": ["click", "focus", "blur"],
        "slots": ["default", "icon", "loading"],
    },
    "el-input": {
        "props": ["modelValue", "type", "size", "disabled", "placeholder", "clearable", "showPassword",
                  "prefixIcon", "suffixIcon", "maxlength", "minlength", "showWordLimit", "rows", "autosize"],
        "events": ["input", "change", "focus", "blur", "clear"],
        "slots": ["prefix", "suffix", "prepend", "append"],
    },
    "el-checkbox": {
        "props": ["modelValue", "label", "disabled", "border", "size", "checked"],
        "events": ["change"],
    },
    "el-radio": {
        "props": ["modelValue", "label", "disabled", "border", "size"],
        "events": ["change"],
    },
    "el-select": {
        "props": ["modelValue", "options", "placeholder", "disabled", "clearable", "filterable",
                  "multiple", "size", "loading", "remote", "remoteMethod"],
        "events": ["change", "visibleChange", "removeTag", "clear", "focus", "blur"],
    },
    "el-option": {
        "props": ["value", "label", "disabled"],
    },
    "el-table": {
        "props": ["data", "size", "border", "stripe", "height", "maxHeight", "loading", "emptyText",
                  "rowKey", "defaultSort", "highlightCurrentRow"],
        "events": ["select", "selectAll", "selectionChange", "sortChange", "rowClick", "rowDblclick"],
    },
    "el-table-column": {
        "props": ["prop", "label", "width", "minWidth", "fixed", "sortable", "align", "headerAlign"],
        "slots": ["default", "header"],
    },
    "el-form": {
        "props": ["model", "rules", "labelWidth", "labelPosition", "size", "disabled", "inline"],
        "events": ["validate"],
    },
    "el-form-item": {
        "props": ["prop", "label", "required", "rules", "error", "showMessage", "size"],
        "slots": ["default", "label", "error"],
    },
    "el-dialog": {
        "props": ["modelValue", "title", "width", "fullscreen", "top", "modal", "closeOnClickModal",
                  "closeOnPressEscape", "showClose", "destroyOnClose", "center", "alignCenter"],
        "events": ["open", "opened", "close", "closed"],
        "slots": ["default", "title", "footer"],
    },
    "el-card": {
        "props": ["header", "shadow", "bodyStyle"],
        "slots": ["default", "header"],
    },
    "el-tabs": {
        "props": ["modelValue", "type", "tabPosition", "editable", "addable", "closable"],
        "events": ["tabClick", "tabChange", "edit", "tabRemove", "tabAdd"],
    },
    "el-tab-pane": {
        "props": ["label", "name", "disabled", "lazy", "closable"],
        "slots": ["default", "label"],
    },
    "el-menu": {
        "props": ["mode", "collapse", "defaultActive", "defaultOpeneds", "uniqueOpened",
                  "router", "backgroundColor", "textColor", "activeTextColor"],
        "events": ["select", "open", "close"],
    },
    "el-menu-item": {
        "props": ["index", "route", "disabled"],
    },
    "el-pagination": {
        "props": ["total", "pageSize", "pageSizes", "currentPage", "layout", "background",
                  "small", "disabled", "hideOnSinglePage"],
        "events": ["sizeChange", "currentChange", "prevClick", "nextClick"],
    },
    "el-badge": {
        "props": ["value", "max", "isDot", "hidden", "type"],
    },
    "el-tag": {
        "props": ["type", "size", "closable", "effect", "round", "hit", "color", "disableTransitions"],
        "events": ["click", "close"],
    },
    "el-avatar": {
        "props": ["src", "size", "shape", "icon", "fit", "alt"],
    },
    "el-switch": {
        "props": ["modelValue", "disabled", "loading", "size", "activeText", "inactiveText",
                  "activeValue", "inactiveValue", "activeColor", "inactiveColor"],
        "events": ["change"],
    },
    "el-slider": {
        "props": ["modelValue", "min", "max", "disabled", "step", "showInput", "showStops",
                  "showTooltip", "range", "marks"],
        "events": ["change", "input"],
    },
    "el-progress": {
        "props": ["percentage", "type", "strokeWidth", "textInside", "status", "color",
                  "width", "showText", "duration", "indeterminate"],
    },
    "el-divider": {
        "props": ["direction", "contentPosition", "borderStyle"],
    },
    "el-breadcrumb": {
        "props": ["separator", "separatorIcon"],
    },
    "el-breadcrumb-item": {
        "props": ["to", "replace"],
    },
    "el-dropdown": {
        "props": ["trigger", "hideOnClick", "splitButton", "disabled", "placement"],
        "events": ["command", "visibleChange"],
    },
    "el-dropdown-item": {
        "props": ["command", "disabled", "divided"],
    },
    "el-tooltip": {
        "props": ["content", "placement", "disabled", "effect", "trigger", "showAfter",
                  "hideAfter", "enterable", "popperClass"],
    },
    "el-popover": {
        "props": ["title", "content", "width", "placement", "trigger", "disabled"],
    },
    "el-image": {
        "props": ["src", "fit", "alt", "lazy", "previewSrcList", "zIndex", "initialIndex"],
        "events": ["load", "error"],
    },
    "el-icon": {
        "props": ["size", "color"],
    },
    "el-link": {
        "props": ["type", "underline", "disabled", "href", "icon", "target"],
    },
}

# Ant Design Vue 常用组件 API
ANT_DESIGN_API = {
    "a-button": {
        "props": ["type", "size", "disabled", "loading", "ghost", "danger", "block", "shape", "icon", "href", "target"],
        "events": ["click"],
    },
    "a-input": {
        "props": ["value", "type", "size", "disabled", "placeholder", "allowClear", "maxlength",
                  "prefix", "suffix", "addonBefore", "addonAfter"],
        "events": ["change", "pressEnter"],
    },
    "a-input-password": {
        "props": ["value", "size", "disabled", "placeholder", "visibilityToggle"],
        "events": ["change"],
    },
    "a-checkbox": {
        "props": ["checked", "disabled", "indeterminate"],
        "events": ["change"],
    },
    "a-select": {
        "props": ["value", "options", "placeholder", "disabled", "allowClear", "mode", "size", "loading", "showSearch"],
        "events": ["change", "search", "select", "deselect"],
    },
    "a-table": {
        "props": ["columns", "dataSource", "rowKey", "loading", "size", "bordered", "pagination",
                  "rowSelection", "scroll", "expandable"],
        "events": ["change"],
    },
    "a-form": {
        "props": ["model", "rules", "labelCol", "wrapperCol", "layout", "size"],
    },
    "a-form-item": {
        "props": ["label", "name", "rules", "required"],
    },
    "a-modal": {
        "props": ["visible", "title", "width", "okText", "cancelText", "confirmLoading",
                  "footer", "closable", "destroyOnClose", "centered"],
        "events": ["ok", "cancel"],
    },
    "a-card": {
        "props": ["title", "bordered", "hoverable", "size", "loading"],
        "slots": ["title", "extra", "actions"],
    },
    "a-tabs": {
        "props": ["activeKey", "type", "size", "tabPosition", "animated"],
        "events": ["change", "tabClick"],
    },
    "a-menu": {
        "props": ["mode", "selectedKeys", "openKeys", "theme", "inlineCollapsed"],
        "events": ["click", "openChange"],
    },
    "a-pagination": {
        "props": ["total", "pageSize", "current", "showSizeChanger", "showQuickJumper",
                  "size", "simple", "showTotal"],
        "events": ["change", "showSizeChange"],
    },
    "a-tag": {
        "props": ["color", "closable", "icon"],
        "events": ["close"],
    },
    "a-switch": {
        "props": ["checked", "disabled", "loading", "size", "checkedChildren", "unCheckedChildren"],
        "events": ["change"],
    },
    "a-avatar": {
        "props": ["src", "size", "shape", "icon", "alt"],
    },
    "a-dropdown": {
        "props": ["trigger", "disabled", "placement", "overlayClassName"],
        "events": ["visibleChange"],
    },
    "a-tooltip": {
        "props": ["title", "placement", "trigger", "mouseEnterDelay", "mouseLeaveDelay"],
    },
    "a-badge": {
        "props": ["count", "dot", "overflowCount", "status", "color", "size", "offset"],
    },
    "a-divider": {
        "props": ["type", "orientation", "plain", "dashed"],
    },
    "a-breadcrumb": {
        "props": ["separator", "routes"],
    },
    "a-image": {
        "props": ["src", "alt", "width", "height", "preview", "fallback", "placeholder"],
    },
    "a-result": {
        "props": ["status", "title", "subTitle"],
    },
    "a-spin": {
        "props": ["spinning", "size", "tip", "delay"],
    },
}

# 通用 HTML 属性（所有组件都可能有的）
UNIVERSAL_PROPS = {"class", "style", "id", "key", "ref", "v-if", "v-show", "v-for",
                   "v-model", "v-on", "v-bind", "slot", "onClick", "onChange",
                   "onFocus", "onBlur", "onMouseEnter", "onMouseLeave", "onKeyDown",
                   "onKeyUp", "data-*", "aria-*", "className"}

# 组件库 API 索引
COMPONENT_API_MAP = {
    "element-plus": ELEMENT_PLUS_API,
    "ant-design": ANT_DESIGN_API,
    "shadcn-ui": {},  # shadcn 使用原生 HTML 属性，无严格 API 限制
}


# ============================================
# 第一层防御：检索结果相关性过滤
# ============================================

def filter_retrieval_results(
    component_type: str,
    results: dict,
    min_score: float = 0.3,
) -> List[str]:
    """
    过滤低相关性的检索结果。

    参数:
        component_type: 组件类型（如 "button"）
        results: ChromaDB 查询结果
        min_score: 最低相关性分数阈值（余弦距离，越小越相关）

    返回:
        通过过滤的文档片段列表
    """
    filtered = []
    if not results.get("ids") or not results["ids"][0]:
        return filtered

    for i, doc_id in enumerate(results["ids"][0]):
        doc_text = results["documents"][0][i] if results.get("documents") else ""
        distance = results["distances"][0][i] if results.get("distances") else 0

        # 过滤条件1：相关性分数过低
        if distance > min_score:
            continue

        # 过滤条件2：文档中必须包含目标组件名称
        # 避免把 el-input-number 的文档给 input 用
        if component_type not in doc_text.lower():
            continue

        filtered.append(doc_text[:800])

    return filtered[:2]  # 最多返回 2 个


def extract_api_from_docs(docs: Dict[str, str]) -> Dict[str, Dict[str, Set[str]]]:
    """
    从检索到的文档中提取 API 白名单。

    用正则从文档文本中提取组件标签和属性名，
    作为后续验证的"参考答案"。

    返回: { "button": {"props": {"type","size"}, "events": {"click"} } }
    """
    extracted = {}

    for comp_type, doc_text in docs.items():
        props = set()
        events = set()

        # 提取文档中的属性名（prop="xxx" 或 prop='xxx' 或 :prop）
        prop_patterns = [
            r'(\w+(?:-\w+)*)\s*=\s*"[^"]*"',   # prop="value"
            r"(\w+(?:-\w+)*)\s*=\s*'[^']*'",    # prop='value'
            r':(\w+(?:-\w+)*)\s*=',              # :prop=
            r'@(\w+(?:-\w+)*)\s*=',              # @event=
        ]

        for pattern in prop_patterns:
            matches = re.findall(pattern, doc_text)
            for m in matches:
                if m in ("class", "style", "id", "key", "ref", "slot", "v-if", "v-show", "v-for", "v-model"):
                    continue
                if pattern.startswith("@"):
                    events.add(m)
                else:
                    props.add(m)

        extracted[comp_type] = {"props": props, "events": events}

    return extracted


# ============================================
# 第三层防御：AST 确定性 API 验证
# ============================================

def extract_used_apis(code: str, component_lib: str) -> Dict[str, Dict[str, Set[str]]]:
    """
    从生成的代码中提取实际使用的组件 API。

    用正则从代码中提取所有组件标签及其属性，
    不需要 AST 解析器，容错性好。

    返回: { "el-button": {"props": {"type","size","@click"}, "events": {"click"} } }
    """
    used = {}

    api_map = COMPONENT_API_MAP.get(component_lib, {})

    # 匹配所有组件标签
    # Vue: <el-button ...> 或 <el-button ... />
    # React: <Button ...> 或 <ElButton ...>
    tag_patterns = re.findall(r'<([A-Za-z][\w-]*(?:\.[\w-]+)?)\b([^>]*)>', code)

    for tag_name, attrs_str in tag_patterns:
        # 标准化标签名
        tag_lower = tag_name.lower()

        # 只检查已知组件
        if tag_lower not in api_map:
            # 检查是否是 Element Plus 的短名（el-button → elbutton）
            for known_tag in api_map:
                if known_tag.replace("-", "") == tag_lower.replace("-", ""):
                    tag_lower = known_tag
                    break
            else:
                continue

        if tag_lower not in used:
            used[tag_lower] = {"props": set(), "events": set()}

        # 提取属性
        attr_pattern = re.findall(r'(\S+?)\s*=\s*(?:"[^"]*"|\'[^\']*\'|\{[^}]*\}|\S+)', attrs_str)
        for attr in attr_pattern:
            # 处理 Vue 事件绑定 @click → click
            if attr.startswith("@"):
                used[tag_lower]["events"].add(attr[1:].split(".")[0])
            # 处理 Vue 属性绑定 :prop
            elif attr.startswith(":"):
                used[tag_lower]["props"].add(attr[1:].split(".")[0])
            # 处理 React 事件绑定 onClick
            elif attr.startswith("on") and attr[2].isupper():
                used[tag_lower]["events"].add(attr[2:].lower())
            # 普通属性
            elif "=" in attr:
                prop_name = attr.split("=")[0].strip()
                if prop_name not in UNIVERSAL_PROPS:
                    used[tag_lower]["props"].add(prop_name)

    return used


def validate_api_usage(
    used_apis: Dict[str, Dict[str, Set[str]]],
    component_lib: str,
) -> List[Dict]:
    """
    验证代码中使用的 API 是否在白名单中。

    对比实际使用的 API 和预定义的白名单，
    找出所有不在白名单中的属性和事件。

    返回问题列表: [{"component": "el-button", "type": "prop", "name": "theme", "severity": "ERROR"}]
    """
    issues = []
    api_map = COMPONENT_API_MAP.get(component_lib, {})

    for component, usage in used_apis.items():
        if component not in api_map:
            # 组件本身不在白名单中
            issues.append({
                "component": component,
                "type": "component",
                "name": component,
                "severity": "ERROR",
                "message": f"组件 {component} 不在已知白名单中，可能是幻觉组件",
            })
            continue

        known = api_map[component]

        # 检查属性
        for prop in usage.get("props", set()):
            if prop not in known.get("props", []) and prop not in UNIVERSAL_PROPS:
                # 模糊匹配：检查是否有相似的合法属性
                similar = _find_similar(prop, known.get("props", []))
                msg = f"{component} 的属性 '{prop}' 不在白名单中，可能是幻觉属性"
                if similar:
                    msg += f"，你是不是想用 '{similar}'？"
                issues.append({
                    "component": component,
                    "type": "prop",
                    "name": prop,
                    "severity": "ERROR",
                    "message": msg,
                    "suggestion": similar,
                })

        # 检查事件
        for event in usage.get("events", set()):
            if event not in known.get("events", []):
                similar = _find_similar(event, known.get("events", []))
                msg = f"{component} 的事件 '@{event}' 不在白名单中"
                if similar:
                    msg += f"，你是不是想用 '@{similar}'？"
                issues.append({
                    "component": component,
                    "type": "event",
                    "name": f"@{event}",
                    "severity": "WARNING",
                    "message": msg,
                    "suggestion": similar,
                })

    return issues


def _find_similar(target: str, candidates: List[str]) -> str:
    """在候选项中找最相似的字符串（简单编辑距离）"""
    if not candidates:
        return ""
    target_lower = target.lower()
    # 优先完全包含匹配
    for c in candidates:
        if target_lower == c.lower():
            return ""
        if target_lower in c.lower() or c.lower() in target_lower:
            return c
    return ""


# ============================================
# 工具函数：完整幻觉检查流程
# ============================================

def run_hallucination_check(code: str, component_docs: Dict[str, str], component_lib: str) -> Dict:
    """
    运行完整的反幻觉检查流程。

    返回:
    {
        "status": "passed" | "issues_found",
        "api_issues": [...],       # AST 确定性检查结果
        "llm_review": "...",       # LLM 交叉验证结果（可选）
    }
    """
    # 第三层：AST 确定性验证
    used_apis = extract_used_apis(code, component_lib)
    api_issues = validate_api_usage(used_apis, component_lib)

    # 第四层：LLM 交叉验证（只在 AST 发现问题时才调用，节省成本）
    llm_review = None
    if api_issues:
        from langchain_core.messages import HumanMessage
        from services.llm import code_llm

        issues_text = "\n".join(f"- {i['message']}" for i in api_issues)
        docs_text = json.dumps({k: v[:500] for k, v in component_docs.items()}, ensure_ascii=False, indent=2)
        lang = "vue" if "template" in code.lower() else "tsx"

        prompt = CROSS_VALIDATION_PROMPT.format(
            component_docs=docs_text,
            ast_issues=issues_text,
            lang=lang,
            code=code[:4000],
        )
        response = code_llm.invoke([HumanMessage(content=prompt)])
        llm_review = response.content

    return {
        "status": "passed" if not api_issues else "issues_found",
        "api_issues": api_issues,
        "llm_review": llm_review,
    }
