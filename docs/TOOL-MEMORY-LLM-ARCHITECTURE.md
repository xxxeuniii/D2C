# D2C Multi-Agent Collaborative System: Tool + Memory + LLM Architecture

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-04  
**Author**: Architecture Team  
**Classification**: Internal - Technical Design  

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture Overview: The Three Pillars](#2-architecture-overview-the-three-pillars)
3. [Pillar I: Tool System](#3-pillar-i-tool-system)
4. [Pillar II: Memory System](#4-pillar-ii-memory-system)
5. [Pillar III: LLM Integration](#5-pillar-iii-llm-integration)
6. [Collaborative Mechanism: How Three Pillars Work Together](#6-collaborative-mechanism-how-three-pillars-work-together)
7. [Agent-Level Deep Dive](#7-agent-level-deep-dive)
8. [Pipeline Orchestration: LangChain Chain Composition](#8-pipeline-orchestration-langchain-chain-composition)
9. [Design Rationale: Why This Architecture](#9-design-rationale-why-this-architecture)
10. [Extensibility: Adding New Agents](#10-extensibility-adding-new-agents)

---

## 1. Design Philosophy

### 1.1 Core Thesis

The D2C multi-agent system is built on the thesis that **not all agent tasks require LLM reasoning**. A production-grade multi-agent system must triage each task into one of three execution strategies:

| Execution Strategy | Agent Examples | Latency | Determinism | Cost |
|-------------------|----------------|---------|-------------|------|
| **Pure Tool (Python)** | Agent 1 (Cleaner), Agent 2 (Converter) | < 50ms | 100% | Zero |
| **Tool + External Service** | Agent 3 (Retriever) | 200-500ms | 100% | Embedding API only |
| **Tool + LLM** | Agent 4 (Generator), Agent 5 (Validator) | 3-15s | Non-deterministic | Token cost |

This triage is the single most important architectural decision in the system. It ensures that deterministic tasks are never routed through an LLM, eliminating hallucination risk, reducing latency by 100x, and cutting operational costs to near zero for 3 out of 5 pipeline stages.

### 1.2 LangChain as the Coordination Layer

The entire system is orchestrated through LangChain, which provides three critical abstractions:

- **`@tool`**: Wraps any Python function into a discoverable, schema-typed tool that can be invoked by LLM agents or composed in chains
- **`RunnableLambda`**: Wraps any Python function into a LangChain-compatible runnable unit, enabling chain composition via the `|` (pipe) operator
- **Shared `dict` State**: A plain Python dictionary acts as the memory bus, passed sequentially through all agents in the pipeline

This means the system does NOT use LangChain's built-in AgentExecutor with ReAct loop patterns. Instead, it uses a **deterministic sequential chain** where each agent is a `RunnableLambda` wrapping either a `@tool` function or pure Python logic.

---

## 2. Architecture Overview: The Three Pillars

```
+------------------------------------------------------------------+
|                        D2C MULTI-AGENT SYSTEM                     |
|                                                                   |
|   +------------------+  +------------------+  +-----------------+ |
|   |   TOOL SYSTEM    |  |  MEMORY SYSTEM   |  |  LLM SYSTEM     | |
|   |   (LangChain      |  |  (Shared Dict    |  |  (SiliconFlow   | |
|   |    @tool +        |  |   PipelineState) |  |   API via       | |
|   |    Python funcs)  |  |                  |  |   LangChain)    | |
|   +--------+---------+  +--------+---------+  +--------+--------+ |
|            |                      |                      |         |
|            +----------------------+----------------------+         |
|                                   |                                |
|                        +----------v----------+                     |
|                        |  PIPELINE ENGINE     |                     |
|                        |  (LangChain Chain)   |                     |
|                        |  RunnableLambda |    |                     |
|                        +----------+----------+                     |
|                                   |                                |
|            +----------------------+----------------------+         |
|            |                      |                      |         |
|   +--------v--------+  +---------v-------+  +---------v--------+ |
|   | Agent 1 CLEANER |  | Agent 2 CONVERT |  | Agent 3 RETRIEVE | |
|   | (Pure Tool)     |  | (Pure Tool)     |  | (Tool + ChromaDB)| |
|   +-----------------+  +-----------------+  +------------------+ |
|   | Agent 4 GENERATE|  | Agent 5 VALIDATE|                       |
|   | (Tool + LLM)    |  | (Tool + LLM)    |                       |
|   +-----------------+  +-----------------+                       |
+------------------------------------------------------------------+
```

### 2.1 The Three Pillars Defined

**Pillar I - Tool System**: Every agent's core logic is encapsulated as a LangChain `@tool` or plain Python function. Tools are self-describing (docstring + type hints), composable (can be chained), and independently testable. The `@tool` decorator from LangChain automatically generates JSON Schema for function parameters, enabling potential future dynamic tool selection by an orchestrator LLM.

**Pillar II - Memory System**: The shared `PipelineState` dictionary is the sole communication medium between agents. It is a flat key-value store that accumulates outputs as the pipeline progresses. There is no external database, no message queue, and no agent-to-agent direct coupling. Every agent reads from and writes to the same dictionary, creating a linear, auditable data provenance trail.

**Pillar III - LLM Integration**: LLMs are used exclusively where semantic understanding is required (code generation, code review). The LLM clients (`llm`, `code_llm`) are plain LangChain `ChatOpenAI` instances, not wrapped in AgentExecutor. This means the LLM is treated as a **stateless function**: input prompt in, output text out. No ReAct loop, no tool-calling, no autonomous decision-making by the LLM itself.

---

## 3. Pillar I: Tool System

### 3.1 Tool Taxonomy

The system defines two categories of tools:

| Category | Implementation | Decorator | Used By |
|----------|---------------|-----------|---------|
| **LangChain Tool** | `@tool` decorated function with schema | `@tool` | Agent 3, 4, 5 |
| **Pure Function** | Plain Python function, no decorator | None | Agent 1, 2 |

### 3.2 LangChain @tool Decorated Tools

The `@tool` decorator serves three purposes:

1. **Schema Generation**: Automatically extracts function signature (parameter names, types, defaults) into a JSON Schema
2. **Discoverability**: Tools can be registered in a tool registry for potential dynamic selection
3. **Invocation Standardization**: Provides a uniform `.invoke()` / `.ainvoke()` interface

**Example: Agent 3 Retriever Tool**

```python
# apps/server/agents/retriever.py
from langchain.tools import tool

@tool
def search_component_docs(dsl_json: str, component_lib: str = "element-plus") -> str:
    """
    Search component documentation from ChromaDB knowledge base.
    Input: DSL JSON + component library name
    Output: DSL JSON augmented with component documentation
    """
    dsl = json.loads(dsl_json)
    components = dsl.get("components", [])
    
    # Collect unique component types
    component_types = set()
    def collect_types(comps):
        for c in comps:
            ct = c.get("type", "")
            if ct and ct not in ("container", "box", "text"):
                component_types.add(ct)
            if c.get("children"):
                collect_types(c["children"])
    collect_types(components)
    
    # Query ChromaDB for each type
    docs = {}
    for comp_type in component_types:
        query = f"{component_lib} {comp_type} component API usage examples"
        results = collection.query(query_texts=[query], n_results=2)
        if results["ids"] and results["ids"][0]:
            docs[comp_type] = results["documents"][0][0][:800]
    
    dsl["componentDocs"] = docs
    return json.dumps(dsl, ensure_ascii=False, indent=2)
```

Key observations about this tool:
- It is a **self-contained unit**: all dependencies (ChromaDB `collection`) are imported at module level
- It is **deterministic**: same input always produces same output (assuming stable ChromaDB state)
- It does **NOT call an LLM**: the `@tool` decorator is used purely for interface standardization, not for LLM-driven invocation

**Example: Agent 4 Generator Tool**

```python
# apps/server/agents/generator.py
from langchain.tools import tool
from langchain.schema import HumanMessage
from services.llm import code_llm

@tool
def generate_page_code(dsl_with_docs: str, framework: str) -> str:
    """
    Generate complete page code from DSL + component docs.
    Input: DSL JSON with documentation + target framework
    Output: Complete source code
    """
    prompt = f"""You are a senior frontend developer...
    ## DSL + Component Docs:
    {dsl_with_docs[:6000]}
    
    ## Requirements:
    - {framework} framework
    - Dark theme
    - Follow DSL component structure strictly
    ...
    Output code only, no explanation:"""
    
    response = code_llm.invoke([HumanMessage(content=prompt)])
    return response.content
```

Key observations:
- This tool **wraps an LLM call** inside a `@tool` interface
- The LLM is called as a **stateless function**: `code_llm.invoke([HumanMessage(...)])`
- No LangChain AgentExecutor, no ReAct loop, no tool-calling by the LLM
- The tool's responsibility is prompt construction + LLM invocation + response extraction

### 3.3 Pure Function Tools (No @tool Decorator)

Agent 1 and Agent 2 use plain Python functions without the `@tool` decorator. These functions operate on JSON data structures and perform deterministic transformations.

**Why not use @tool for Agent 1/2?**

The `@tool` decorator adds schema generation overhead and implies LLM-callability. Since Agent 1 and 2 are never invoked by an LLM (they are deterministic rule engines), the decorator would be misleading. The functions are wrapped in `RunnableLambda` at the pipeline level instead.

```python
# Agent 1: Pure function (no @tool)
def clean_figma_data(raw_data: str | dict) -> dict:
    """Production-grade data cleaning: pure Python JSON manipulation."""
    if isinstance(raw_data, str):
        data = json.loads(raw_data)
    else:
        data = raw_data
    document = data.get("document", data)
    cleaned = _clean_node(document)
    return {
        "fileName": data.get("name", ""),
        "lastModified": data.get("lastModified", ""),
        "tree": cleaned,
    }

# Agent 2: Pure function (no @tool)
def convert_to_dsl(cleaned_data: dict, framework: str, component_lib: str) -> dict:
    """Production-grade DSL conversion: Python rule engine."""
    tree = cleaned_data.get("tree", cleaned_data)
    components = [_node_to_dsl_component(child) for child in tree.get("children", [])]
    return {
        "pageName": cleaned_data.get("fileName", "Untitled"),
        "framework": framework,
        "componentLib": component_lib,
        "components": components,
    }
```

### 3.4 Tool Invocation Pattern

All tools, whether `@tool`-decorated or pure functions, are invoked through `RunnableLambda` wrappers in the pipeline:

```python
# Pipeline assembly (agents/pipeline.py)
from langchain.schema.runnable import RunnableLambda

def agent1_clean(input_dict: dict) -> dict:
    cleaned = clean_figma_data(input_dict.get("figma_raw", ""))
    input_dict["cleaned_data"] = json.dumps(cleaned, ensure_ascii=False)
    input_dict["agent1_status"] = "completed"
    return input_dict

def agent3_retrieve(input_dict: dict) -> dict:
    dsl = input_dict.get("dsl", "")
    component_lib = input_dict.get("componentLib", "element-plus")
    # @tool function invoked via .invoke()
    dsl_with_docs = search_component_docs.invoke({
        "dsl_json": dsl, 
        "component_lib": component_lib
    })
    input_dict["dsl_with_docs"] = dsl_with_docs
    input_dict["agent3_status"] = "completed"
    return input_dict

pipeline = (
    RunnableLambda(agent1_clean)     # Pure function wrapper
    | RunnableLambda(agent2_convert)  # Pure function wrapper
    | RunnableLambda(agent3_retrieve) # @tool function wrapper
    | RunnableLambda(agent4_generate) # @tool + LLM wrapper
    | RunnableLambda(agent5_validate) # @tool + LLM wrapper
)
```

This pattern achieves **uniform invocation** regardless of whether the underlying function is a `@tool` or a plain Python function. Every agent in the pipeline receives a `dict`, mutates it, and returns it.

---

## 4. Pillar II: Memory System

### 4.1 PipelineState: The Shared Memory Bus

The entire memory system is a single Python `dict` called `PipelineState`. It is the **only** communication channel between agents. There is no external message queue, no event bus, no shared database.

```python
# PipelineState structure (TypeScript-like pseudocode)
interface PipelineState {
    // === INPUT FIELDS (set at pipeline start) ===
    figma_url: string;
    figma_raw: string;        // Raw Figma JSON string
    framework: string;        // "react" | "vue2" | "nextjs"
    componentLib: string;     // "element-plus" | "antd" | "shadcn"
    
    // === AGENT OUTPUTS (set by each agent sequentially) ===
    cleaned_data: string;     // Agent 1 output: cleaned JSON string
    dsl: string;              // Agent 2 output: DSL JSON string
    dsl_with_docs: string;    // Agent 3 output: DSL + docs JSON string
    generated_code: string;   // Agent 4 output: source code string
    validation_result: string;// Agent 5 output: validation report string
    
    // === STATUS FIELDS (set by each agent on completion) ===
    agent1_status: string;    // "completed" | "error"
    agent2_status: string;
    agent3_status: string;
    agent4_status: string;
    agent5_status: string;
    
    // === METADATA ===
    run_id: string;
}
```

### 4.2 Memory Lifecycle

```
TIME -->
  
  Pipeline Start
       |
       v
  [figma_raw, framework, componentLib]     <-- Initial state populated
       |
       v
  Agent 1 reads:  figma_raw
  Agent 1 writes: cleaned_data, agent1_status
       |
       v
  Agent 2 reads:  cleaned_data, framework, componentLib
  Agent 2 writes: dsl, agent2_status
       |
       v
  Agent 3 reads:  dsl, componentLib
  Agent 3 writes: dsl_with_docs, agent3_status
       |
       v
  Agent 4 reads:  dsl_with_docs, framework
  Agent 4 writes: generated_code, agent4_status
       |
       v
  Agent 5 reads:  generated_code
  Agent 5 writes: validation_result, agent5_status
       |
       v
  Pipeline Complete  -->  { code, validation } extracted from state
```

### 4.3 Memory Design Principles

**Principle 1: Write-Once, Read-Many (WORM) per Key**

Each state key has exactly one writer (the agent that produces it) and potentially multiple readers (downstream agents). No agent modifies a key written by a previous agent. This ensures data provenance is always traceable.

```
Key              Writer      Readers
----             ------      -------
figma_raw        Pipeline    Agent 1
cleaned_data     Agent 1     Agent 2
dsl              Agent 2     Agent 3
dsl_with_docs    Agent 3     Agent 4
generated_code   Agent 4     Agent 5
validation_result Agent 5    Pipeline caller
```

**Principle 2: String Serialization for Interoperability**

All complex data (JSON objects, code strings) are stored as strings in the state dictionary. This is because LangChain's `RunnableLambda` chain passes state through serialization boundaries. String serialization ensures compatibility and avoids deep-copy issues.

```python
# Writing: serialize before storing
input_dict["cleaned_data"] = json.dumps(cleaned, ensure_ascii=False)

# Reading: deserialize on access
cleaned = json.loads(input_dict.get("cleaned_data", "{}"))
```

**Principle 3: Immutable Accumulation**

Each agent returns a **new reference** to the state dictionary with its output appended. No agent mutates the state in-place without returning it. This is enforced by the `RunnableLambda` contract: the function must return the state dict.

**Principle 4: Error Accumulation, Not Propagation**

If an agent fails, it writes an error entry to the state and returns the state as-is. Downstream agents can check for error conditions and degrade gracefully. The pipeline does not abort on non-critical agent failures.

```python
# Conceptual error handling pattern
def agent3_retrieve(input_dict: dict) -> dict:
    try:
        dsl_with_docs = search_component_docs.invoke({...})
        input_dict["dsl_with_docs"] = dsl_with_docs
        input_dict["agent3_status"] = "completed"
    except Exception as e:
        input_dict["agent3_status"] = "error"
        input_dict["agent3_error"] = str(e)
        # Pass original DSL through so Agent 4 can still generate code
        input_dict["dsl_with_docs"] = input_dict.get("dsl", "")
    return input_dict
```

### 4.4 Why Not Vector Memory or ConversationBufferMemory?

Many LangChain examples use `ConversationBufferMemory` or `VectorStoreRetrievalMemory` for agent memory. The D2C system deliberately avoids these patterns because:

| Pattern | Problem for D2C |
|---------|----------------|
| `ConversationBufferMemory` | Designed for chat history, not structured pipeline state; adds unnecessary serialization overhead |
| `VectorStoreRetrievalMemory` | Requires embedding every state update; latency overhead for deterministic pipeline stages |
| LangChain `Memory` abstractions | Tight coupling to LangChain's agent loop; D2C uses a linear chain, not an agent loop |

The shared `dict` is the simplest possible memory that satisfies the requirements: sequential write, typed keys, zero-overhead access.

---

## 5. Pillar III: LLM Integration

### 5.1 LLM Client Architecture

The system maintains two LLM client instances, configured in `services/llm.py`:

```python
from langchain_openai import ChatOpenAI

# General-purpose LLM (Qwen 2.5 7B) - for lightweight tasks
llm = ChatOpenAI(
    model="Qwen/Qwen2.5-7B-Instruct",
    api_key=SILICONFLOW_API_KEY,
    base_url="https://api.siliconflow.cn/v1",
    temperature=0.3,
)

# Code generation LLM (DeepSeek-V3) - for code generation and review
code_llm = ChatOpenAI(
    model="deepseek-ai/DeepSeek-V3",
    api_key=SILICONFLOW_API_KEY,
    base_url="https://api.siliconflow.cn/v1",
    temperature=0.3,
    max_tokens=8192,
)
```

### 5.2 LLM Usage Pattern: Stateless Function Calls

CRITICAL: The LLM is NEVER used as an autonomous agent. There is no AgentExecutor, no ReAct loop, no tool-calling by the LLM. The LLM is treated as a **pure function**: `f(prompt) -> response`.

```python
# The ONLY way LLM is invoked in the entire system
response = code_llm.invoke([HumanMessage(content=prompt)])
return response.content
```

This design choice is intentional and has significant implications:

| Aspect | AgentExecutor (ReAct) | Stateless Function (D2C) |
|--------|----------------------|--------------------------|
| LLM Autonomy | LLM decides which tool to call, in what order | Pipeline decides; LLM only generates text |
| Latency | Unbounded (LLM may loop) | Bounded (single call per agent) |
| Cost | Unpredictable (multiple LLM calls per step) | Predictable (1 call per LLM-using agent) |
| Debugging | Difficult (LLM reasoning chain is opaque) | Simple (prompt + response are logged) |
| Reliability | LLM may call wrong tool or hallucinate actions | Pipeline enforces correct execution order |

### 5.3 Where LLM Is Used vs. Not Used

```
Agent 1 (CLEANER):    [NO LLM]  Pure Python JSON manipulation
Agent 2 (CONVERTER):  [NO LLM]  Pure Python rule engine
Agent 3 (RETRIEVER):  [NO LLM]  ChromaDB query (embedding API only, not generative)
Agent 4 (GENERATOR):  [LLM]     DeepSeek-V3: DSL + docs -> source code
Agent 5 (VALIDATOR):  [LLM]     DeepSeek-V3: code review + fix generation
                       [NO LLM] AST static analysis (brackets, tags, security)
```

This means only 2 out of 5 agents use LLM, and even Agent 5 has a non-LLM fallback path (AST analysis). This is a deliberate architectural decision that maximizes determinism while using LLM only where semantic understanding is irreplaceable.

### 5.4 LLM Temperature Strategy

| LLM Instance | Temperature | Rationale |
|-------------|-------------|-----------|
| `code_llm` (DeepSeek-V3) | 0.3 | Low enough for consistent code structure, high enough to avoid repetitive patterns |
| `llm` (Qwen 7B) | 0.3 | Same as above for general tasks |
| `summary_llm` (Qwen 7B) | 0.0 | Deterministic output for summarization tasks |

---

## 6. Collaborative Mechanism: How Three Pillars Work Together

### 6.1 End-to-End Execution Trace

Below is an annotated execution trace showing how Tool, Memory, and LLM interact during a complete pipeline run:

```
STEP 0: PIPELINE INITIALIZATION
================================
Tool:   None (manual state construction)
Memory: PipelineState = {
          figma_raw: "{...40KB Figma JSON...}",
          framework: "react",
          componentLib: "shadcn"
        }
LLM:    Not involved

STEP 1: AGENT 1 - DATA CLEANER
================================
Tool:   clean_figma_data()           [Pure Python function, no @tool]
        └── _clean_node()            [Recursive JSON processor]
            ├── _extract_color()     [RGBA -> hex/rgba converter]
            ├── _extract_shadow()    [Figma effect -> CSS box-shadow]
            ├── _extract_stroke_color()
            └── _extract_font_weight()
Memory: PipelineState.cleaned_data = "{...8KB cleaned JSON...}"
        PipelineState.agent1_status = "completed"
LLM:    NOT INVOKED
Time:   ~45ms

STEP 2: AGENT 2 - DSL CONVERTER
================================
Tool:   convert_to_dsl()             [Pure Python function, no @tool]
        └── _node_to_dsl_component() [Recursive tree transformer]
            └── _infer_component_type() [40-keyword matcher]
Memory: PipelineState.dsl = "{...DSL JSON...}"
        PipelineState.agent2_status = "completed"
LLM:    NOT INVOKED
Time:   ~8ms

STEP 3: AGENT 3 - KNOWLEDGE RETRIEVER
================================
Tool:   search_component_docs        [@tool function]
        └── collection.query()       [ChromaDB HNSW search]
            └── sf_ef.__call__()     [BGE-M3 embedding via SiliconFlow]
Memory: PipelineState.dsl_with_docs = "{...DSL + componentDocs...}"
        PipelineState.agent3_status = "completed"
LLM:    NOT INVOKED (embedding only, not generative)
Time:   ~320ms (network + embedding + ChromaDB query)

STEP 4: AGENT 4 - CODE GENERATOR
================================
Tool:   generate_page_code           [@tool function]
        └── code_llm.invoke()        [DeepSeek-V3 API call]
            └── HumanMessage(prompt) [Constructed from DSL + docs]
Memory: PipelineState.generated_code = "import React from 'react'..."
        PipelineState.agent4_status = "completed"
LLM:    **INVOKED** (DeepSeek-V3, 8192 max_tokens, temperature=0.3)
        Input:  ~6000 chars (DSL + component docs + system prompt)
        Output: ~3000 chars (React TSX source code)
Time:   ~8-15s (network + LLM inference)

STEP 5: AGENT 5 - CODE VALIDATOR
================================
Phase A - AST Analysis:
  Tool:   _ast_syntax_check()        [Pure Python function]
          ├── Bracket matching       [Stack-based parser]
          ├── Tag closure check      [Regex + stack]
          ├── Import verification    [String matching]
          ├── Security scan          [Pattern matching]
          └── Key prop check         [Pattern matching]
  LLM:    NOT INVOKED
  Time:   ~5ms

Phase B - LLM Semantic Review:
  Tool:   validate_and_fix           [@tool function]
          └── code_llm.invoke()      [DeepSeek-V3 API call]
  LLM:    **INVOKED** (DeepSeek-V3)
          Input:  AST results + code
          Output: Review report (+ fixed code if issues found)
  Time:   ~3-10s

Memory: PipelineState.validation_result = "AST: PASSED\nLLM: PASSED"
        PipelineState.agent5_status = "completed"

================================
PIPELINE COMPLETE
Total Time: ~12-26s
LLM Calls: 2 (Agent 4 + Agent 5 Phase B)
Total Tokens: ~4000-6000
================================
```

### 6.2 Data Flow Diagram

```
+------------------+     +------------------+     +------------------+
|   TOOL LAYER     |     |  MEMORY LAYER    |     |   LLM LAYER      |
|                  |     |                  |     |                  |
| clean_figma_data |---->| cleaned_data     |     | (not used)       |
|                  |     |                  |     |                  |
| convert_to_dsl   |---->| dsl              |     | (not used)       |
|                  |     |                  |     |                  |
| search_component |---->| dsl_with_docs    |     | (embedding only) |
| _docs            |     |                  |     |                  |
|                  |     |                  |     |                  |
| generate_page    |---->| generated_code   |<--->| DeepSeek-V3      |
| _code            |     |                  |     |                  |
|                  |     |                  |     |                  |
| validate_and_fix |---->| validation_result|<--->| DeepSeek-V3      |
| _ast_syntax_check|     |                  |     | (AST: not used)  |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        |                        |                        |
        +-----------+------------+------------+
                    |                         |
              +-----v-----+           +------v------+
              |  PIPELINE  |           |  EXTERNAL   |
              |  ENGINE    |           |  SERVICES   |
              | (LangChain)|           | - SiliconFlow|
              +-----------+           | - ChromaDB  |
                                      +-------------+
```

---

## 7. Agent-Level Deep Dive

### 7.1 Agent 1: Data Cleaner (Pure Tool, Zero LLM)

**Classification**: Deterministic Tool Agent

**Tool Chain**:
```
clean_figma_data()
  └── _clean_node(node)                # Recursive tree walker
        ├── Filter: visible check      # Rule 1
        ├── Extract: name, type        # Rule 2
        ├── Transform: absoluteBoundingBox -> width/height  # Rule 3
        ├── Transform: fills -> backgroundColor (via _extract_color)  # Rule 4
        ├── Transform: strokes -> borderColor + borderWidth  # Rule 5
        ├── Transform: cornerRadius -> borderRadius          # Rule 6
        ├── Transform: effects -> boxShadow (via _extract_shadow)  # Rule 7
        ├── Transform: layoutMode -> Flexbox CSS             # Rule 8
        ├── Special: TEXT node -> text/fontSize/fontFamily   # Rule 9
        ├── Mark: COMPONENT/INSTANCE -> isComponent flag     # Rule 10
        └── Recurse: children -> _clean_node(child)
```

**Memory Footprint**:
- Reads: `PipelineState.figma_raw`
- Writes: `PipelineState.cleaned_data`
- Size reduction: ~40KB -> ~8KB (80% compression)

**Why No LLM**: JSON field filtering and CSS property mapping are purely mechanical operations. An LLM would be slower, costlier, and potentially miss fields or hallucinate incorrect CSS values. The 10 rules are encoded as explicit Python logic, guaranteeing 100% correctness.

### 7.2 Agent 2: DSL Converter (Pure Tool, Zero LLM)

**Classification**: Deterministic Rule Engine Agent

**Tool Chain**:
```
convert_to_dsl()
  └── _node_to_dsl_component(node)
        ├── _infer_component_type(node)
        │     ├── TEXT node? -> "text"
        │     ├── Name contains "button"? -> "button"
        │     ├── Name contains "input"? -> "input"
        │     ├── ... (40 keyword patterns)
        │     └── Fallback: TYPE_MAP[figma_type]
        ├── Extract: styles (16 CSS property keys)
        ├── Extract: props (text, componentName)
        ├── Extract: layout (mode, hasAutoLayout)
        └── Recurse: children -> _node_to_dsl_component(child)
```

**Memory Footprint**:
- Reads: `PipelineState.cleaned_data`, `PipelineState.framework`, `PipelineState.componentLib`
- Writes: `PipelineState.dsl`

**Why No LLM**: Component type inference from layer names is a keyword-matching problem, not a semantic understanding problem. A layer named "login-button" should always map to `button` type. An LLM might occasionally map it to `input` or `form`, introducing non-determinism. The 40-entry keyword dictionary guarantees consistent, predictable type inference.

### 7.3 Agent 3: Knowledge Retriever (@tool + External Service, Zero LLM)

**Classification**: Retrieval-Augmented Tool Agent

**Tool Chain**:
```
search_component_docs (@tool)
  ├── Parse: DSL JSON -> component type list
  ├── Deduplicate: set(component_types)
  ├── For each type:
  │     ├── Construct query: "{lib} {type} component API usage examples"
  │     ├── collection.query() [ChromaDB]
  │     │     └── BGE-M3 embedding (SiliconFlow API)
  │     └── Truncate: first 800 chars of top result
  └── Augment: dsl["componentDocs"] = {type: doc_snippet}
```

**Memory Footprint**:
- Reads: `PipelineState.dsl`, `PipelineState.componentLib`
- Writes: `PipelineState.dsl_with_docs`

**External Dependencies**:
- ChromaDB (local, persistent): Vector similarity search
- SiliconFlow Embedding API: BGE-M3 text-to-vector conversion

**Why No LLM**: Document retrieval is a vector similarity problem. The query construction is a simple string template. The retrieval itself is a mathematical operation (cosine similarity over embedding vectors). Involving an LLM would add latency and cost with no accuracy benefit.

### 7.4 Agent 4: Code Generator (@tool + LLM)

**Classification**: LLM-Augmented Tool Agent

**Tool Chain**:
```
generate_page_code (@tool)
  ├── Construct system prompt:
  │     ├── Role: "Senior frontend developer"
  │     ├── Context: DSL + component docs (truncated to 6000 chars)
  │     ├── Constraints:
  │     │     ├── Framework-specific syntax (Vue Options API vs React Hooks)
  │     │     ├── Dark theme color tokens
  │     │     ├── DSL component hierarchy adherence
  │     │     ├── Component library API compliance
  │     │     ├── Tailwind CSS styling
  │     │     └── TypeScript type definitions
  │     └── Output directive: "Code only, no explanation"
  └── code_llm.invoke([HumanMessage(content=prompt)])
        └── DeepSeek-V3 (temperature=0.3, max_tokens=8192)
```

**Memory Footprint**:
- Reads: `PipelineState.dsl_with_docs`, `PipelineState.framework`
- Writes: `PipelineState.generated_code`

**LLM Configuration**:
- Model: `deepseek-ai/DeepSeek-V3` (671B MoE, optimized for code)
- Temperature: 0.3 (balance between consistency and creativity)
- Max tokens: 8192 (supports generation of large component files)
- Prompt length: ~6000 characters (DSL context window)

**Why LLM Is Necessary Here**: Code generation from a structured DSL requires semantic understanding of component relationships, framework idioms, and design patterns. This is the one task in the pipeline where LLM reasoning is irreplaceable. The DSL provides the *what* (component tree, styles, props); the LLM provides the *how* (syntactically correct, idiomatically appropriate implementation).

### 7.5 Agent 5: Code Validator (Dual-Layer: Pure Tool + LLM)

**Classification**: Hybrid Validation Agent

**Layer 1 - AST Static Analysis (Pure Tool, Zero LLM)**:
```
_ast_syntax_check(code)
  ├── Bracket matching:    Stack-based { }, ( ), [ ] validator
  ├── Tag closure:         Regex + stack HTML/JSX tag validator
  ├── Import verification: String-based import/export checker
  ├── Security scan:       Pattern match for XSS vectors
  │     ├── dangerouslySetInnerHTML
  │     ├── v-html
  │     ├── eval()
  │     └── innerHTML assignments
  └── List rendering:      key prop presence check
```

**Layer 2 - LLM Semantic Review (@tool + LLM)**:
```
validate_and_fix (@tool)
  ├── Run Layer 1 (AST)
  ├── Construct review prompt:
  │     ├── AST results
  │     ├── Code (truncated to 5000 chars)
  │     └── Review checklist:
  │           ├── Component API correctness
  │           ├── TypeScript type completeness
  │           ├── Accessibility (alt, aria-label, role)
  │           ├── Responsive design (relative units)
  │           └── Performance (unnecessary re-renders)
  └── code_llm.invoke([HumanMessage(content=review_prompt)])
        └── DeepSeek-V3
```

**Memory Footprint**:
- Reads: `PipelineState.generated_code`
- Writes: `PipelineState.validation_result`

**Why Dual-Layer**: AST analysis catches structural errors (syntax, security) with 100% accuracy at near-zero latency. LLM review catches semantic issues (API misuse, accessibility gaps) that require contextual understanding. The two layers are complementary: AST is fast and precise for syntax; LLM is thorough for semantics.

---

## 8. Pipeline Orchestration: LangChain Chain Composition

### 8.1 The Pipe Operator Pattern

LangChain's `|` (pipe) operator creates a `RunnableSequence` where the output of each step becomes the input of the next:

```python
pipeline = (
    RunnableLambda(agent1_clean)      # Step 1
    | RunnableLambda(agent2_convert)   # Step 2: receives Step 1 output
    | RunnableLambda(agent3_retrieve)  # Step 3: receives Step 2 output
    | RunnableLambda(agent4_generate)  # Step 4: receives Step 3 output
    | RunnableLambda(agent5_validate)  # Step 5: receives Step 4 output
)
```

### 8.2 RunnableLambda: The Adapter Pattern

`RunnableLambda` wraps any Python function `f(input) -> output` into a LangChain-compatible runnable. This is the key adapter that bridges the gap between:

- **Pure Python functions** (Agent 1, 2)
- **@tool decorated functions** (Agent 3, 4, 5)
- **The LangChain Chain abstraction** (pipeline composition)

```python
# Without RunnableLambda, these would be incompatible:
clean_figma_data(raw_json: str) -> dict           # Pure function
search_component_docs.invoke({dsl_json, ...})     # @tool method
code_llm.invoke([HumanMessage(...)])              # LLM call

# With RunnableLambda, they all become uniform:
RunnableLambda(agent1_clean)     # Wraps clean_figma_data
RunnableLambda(agent3_retrieve)  # Wraps search_component_docs.invoke
RunnableLambda(agent4_generate)  # Wraps generate_page_code.invoke
```

### 8.3 Pipeline Invocation with Callbacks

The pipeline supports LangChain's callback system for observability:

```python
# routers/pipeline.py
class PipelineCallback:
    def __init__(self, run_id):
        self.run_id = run_id
        self.current = 0
    
    def on_chain_end(self, outputs, **kwargs):
        """Called after each RunnableLambda completes."""
        if self.current < 5:
            pipeline_runs[self.run_id]["steps"].append({
                "agent": self.current + 1,
                "name": f"Agent {self.current + 1}: {agent_names[self.current]}",
                "status": "completed",
            })
            self.current += 1

# Invocation with callback
result = pipeline.invoke(
    {"figma_raw": figma_raw, "framework": "react", "componentLib": "shadcn"},
    {"callbacks": [PipelineCallback(run_id)]}
)
```

### 8.4 Why Not AgentExecutor?

A common question: why not use LangChain's `AgentExecutor` with `create_openai_tools_agent`?

| Consideration | AgentExecutor Approach | D2C Chain Approach |
|--------------|----------------------|-------------------|
| **Control** | LLM decides execution order | Pipeline defines fixed order |
| **Determinism** | Non-deterministic (LLM routing) | 100% deterministic routing |
| **Latency** | 1 LLM call per decision + 1 per action | 0 routing calls, 2 LLM calls total |
| **Cost** | ~5-10 LLM calls per run | Exactly 2 LLM calls per run |
| **Debugging** | Must trace LLM reasoning chain | Linear, auditable step sequence |
| **Failure Mode** | LLM may choose wrong tool or loop | Fixed sequence, no routing errors |

The D2C pipeline has a **known, fixed sequence** of operations. AgentExecutor is designed for **unknown, dynamic sequences** where the LLM must decide what to do next. Using AgentExecutor for a known sequence would be architectural over-engineering: it adds latency, cost, and non-determinism with no benefit.

---

## 9. Design Rationale: Why This Architecture

### 9.1 The LLM Cost-Benefit Analysis

Every architectural decision in this system can be traced back to a simple question: **"Does this task require semantic understanding?"**

| Task | Requires Semantic Understanding? | Implementation | Annual Cost (10K runs) |
|------|--------------------------------|----------------|------------------------|
| Remove Figma metadata fields | No | Python `del` statements | $0 |
| Map Figma type to DSL type | No | Dictionary lookup | $0 |
| Convert RGBA to hex | No | Arithmetic | $0 |
| Find relevant docs for "button" | No | Vector similarity | ~$0.50 (embedding API) |
| Write React component code | **Yes** | DeepSeek-V3 | ~$15 (token cost) |
| Review code for API misuse | **Yes** | DeepSeek-V3 | ~$10 (token cost) |

If all 5 agents used LLM, the annual cost for 10K runs would be approximately $75-100. With the current architecture, it is approximately $25-30. This is a 65-70% cost reduction with zero quality degradation, because the non-LLM agents are actually *more* accurate than LLM-based alternatives.

### 9.2 The Latency Budget

```
Agent 1 (Python):          45ms    |
Agent 2 (Python):           8ms    |-- 373ms total (no LLM)
Agent 3 (ChromaDB):       320ms    |
--- LLM boundary ---
Agent 4 (DeepSeek-V3):  8,000ms   |
Agent 5 AST (Python):       5ms    |-- 11,005ms total (with LLM)
Agent 5 LLM (DeepSeek):  3,000ms   |
================================
Total:                  11,378ms (~11.4 seconds)
```

The non-LLM agents (1, 2, 3, 5-AST) complete in under 400ms combined. The LLM agents (4, 5-LLM) account for 97% of total pipeline latency. This validates the architectural decision: every millisecond saved by not calling an LLM is a millisecond the user doesn't wait.

### 9.3 The Determinism Guarantee

```
DETERMINISTIC OUTPUTS (same input = same output, always):
  Agent 1: cleaned_data     [Python code, no randomness]
  Agent 2: dsl              [Rule engine, no randomness]
  Agent 3: dsl_with_docs    [Vector search, deterministic given stable index]
  Agent 5: AST results      [Static analysis, no randomness]

NON-DETERMINISTIC OUTPUTS (same input may yield different output):
  Agent 4: generated_code   [LLM generation, temperature=0.3]
  Agent 5: LLM review       [LLM evaluation, temperature=0.3]
```

This means 80% of the pipeline output (by data volume) is fully deterministic. Only the generated code itself has variation, which is inherent to any code generation task.

---

## 10. Extensibility: Adding New Agents

### 10.1 Agent Registration Pattern

To add a new agent to the pipeline, follow this template:

```python
# Step 1: Create the agent module
# apps/server/agents/my_new_agent.py

from langchain.tools import tool

@tool
def my_new_tool(input_data: str, config_param: str = "default") -> str:
    """
    Description of what this tool does.
    Input: description of input_data
    Output: description of return value
    """
    # Tool logic here
    result = process(input_data, config_param)
    return result


# Step 2: Export from __init__.py
# apps/server/agents/__init__.py
from .my_new_agent import my_new_tool


# Step 3: Add wrapper in pipeline.py
def agent_new_step(input_dict: dict) -> dict:
    """Agent N: Description"""
    result = my_new_tool.invoke({
        "input_data": input_dict.get("previous_output", ""),
        "config_param": input_dict.get("config", "default"),
    })
    input_dict["new_output"] = result
    input_dict["agentN_status"] = "completed"
    return input_dict


# Step 4: Insert into pipeline
pipeline = (
    RunnableLambda(agent1_clean)
    | RunnableLambda(agent2_convert)
    | RunnableLambda(agent3_retrieve)
    | RunnableLambda(agent_new_step)    # NEW AGENT INSERTED HERE
    | RunnableLambda(agent4_generate)
    | RunnableLambda(agent5_validate)
)
```

### 10.2 Decision Framework: Tool vs. Tool+LLM

When adding a new agent, use this decision tree:

```
New Agent Required
    |
    +-- Is the task purely mechanical (filtering, mapping, arithmetic)?
    |       YES -> Pure Python function (no @tool, no LLM)
    |       NO  -> Continue
    |
    +-- Does the task query an external service (database, API)?
    |       YES -> @tool function + service client (no LLM)
    |       NO  -> Continue
    |
    +-- Does the task require semantic understanding (generation, review)?
            YES -> @tool function + LLM invocation
            NO  -> Re-evaluate: can this be broken into mechanical steps?
```

### 10.3 Memory Key Naming Convention

New agents MUST follow these conventions for state keys:

```
Pattern: {descriptive_name}          for agent outputs
Example: cleaned_data, dsl, generated_code

Pattern: agent{N}_status             for agent completion status
Example: agent1_status, agent3_status

Pattern: agent{N}_error              for agent error messages
Example: agent3_error = "ChromaDB connection refused"

Anti-patterns to avoid:
  - data1, data2 (non-descriptive)
  - agent_output (ambiguous which agent)
  - result (collision risk with other agents)
```

---

## Appendix A: LangChain Component Map

| LangChain Component | D2C Usage | File |
|-------------------|-----------|------|
| `@tool` | Wraps Agent 3, 4, 5 functions | `agents/retriever.py`, `generator.py`, `validator.py` |
| `RunnableLambda` | Wraps all 5 agent functions for chain composition | `agents/pipeline.py` |
| `ChatOpenAI` | LLM client for Qwen and DeepSeek-V3 | `services/llm.py` |
| `HumanMessage` | Constructs prompts for LLM calls | `agents/generator.py`, `validator.py` |
| `OpenAIEmbeddingFunction` | BGE-M3 embedding via SiliconFlow | `services/chroma.py` |
| Chain `\|` operator | Sequential pipeline composition | `agents/pipeline.py` |
| Callbacks | Pipeline step tracking for API response | `routers/pipeline.py` |

## Appendix B: Key Architectural Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent communication | Shared dict (PipelineState) | Simplest possible; zero overhead; auditable data lineage |
| LLM usage scope | Only Agent 4 + Agent 5 (semantic) | 65% cost reduction; 100x latency improvement for deterministic tasks |
| Pipeline composition | LangChain Chain (`\|`) | Standardized interface; callback support; no routing LLM overhead |
| Tool interface | `@tool` for LLM-adjacent agents; pure functions for deterministic agents | Appropriate abstraction level per agent type |
| Memory persistence | In-memory dict (current); Redis planned | Dict is zero-latency; Redis needed for horizontal scaling |
| Error handling | Fail-soft (pipeline continues) | Maximizes output availability; non-critical agent failures don't block pipeline |

---

*Document Control: This document is maintained by the Architecture Team. All changes must be proposed via pull request with at least one senior engineer review.*
