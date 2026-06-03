# D2C - Design to Code Platform - Enterprise Architecture Specification

**Document Version**: 2.0.0  
**Last Updated**: 2026-06-04  
**Author**: Architecture Team  
**Classification**: Internal - Confidential  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack & Rationale](#3-technology-stack--rationale)
4. [Multi-Agent Pipeline Design](#4-multi-agent-pipeline-design)
5. [Module-Level Design](#5-module-level-design)
6. [Data Flow & Communication Protocol](#6-data-flow--communication-protocol)
7. [API Contract Specification](#7-api-contract-specification)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Security & Compliance](#10-security--compliance)
11. [Quality Assurance Strategy](#11-quality-assurance-strategy)
12. [Operational Runbook](#12-operational-runbook)
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Executive Summary

### 1.1 Purpose

D2C (Design-to-Code) is an enterprise-grade automated code generation platform that transforms Figma design artifacts into production-ready frontend source code through a deterministic multi-agent pipeline architecture. The system eliminates manual translation errors, enforces design system compliance, and reduces frontend implementation effort by an estimated 60-80% for standard CRUD and form-based interfaces.

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Determinism First** | Non-generative tasks use pure algorithmic processing; LLM is reserved exclusively for code generation and semantic validation |
| **Contract-Driven Communication** | All inter-agent communication occurs via structured DSL (Domain Specific Language) contracts with explicit schemas |
| **Observability by Default** | Every pipeline execution is traceable with step-level granularity, timing metrics, and artifact preservation |
| **Framework Agnostic Core** | The pipeline engine is framework-agnostic; framework-specific logic is isolated to the code generation layer |
| **Fail-Safe Design** | Individual agent failures are isolated; pipeline continues execution with degraded but useful output |

### 1.3 System Capabilities

- Input: Figma design file URL (REST API integration)
- Processing: 5-agent sequential pipeline with LangChain orchestration
- Output: Production-ready frontend source code (React / Vue 2 / Next.js)
- Component Libraries: Element Plus, Ant Design, shadcn/ui
- Knowledge Enhancement: ChromaDB-powered RAG retrieval with BGE-M3 embeddings
- Validation: Dual-layer verification (AST static analysis + LLM semantic review)

---

## 2. System Architecture Overview

### 2.1 Physical Topology

```
                          +------------------+
                          |   Load Balancer  |
                          |   (Nginx/Envoy)  |
                          +--------+---------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
     +--------v--------+  +-------v-------+  +---------v--------+
     |  Web Frontend   |  |  API Server   |  |  RAG Worker      |
     |  Next.js 14     |  |  FastAPI       |  |  FastAPI         |
     |  Port: 3000     |  |  Port: 8080    |  |  Port: 8081      |
     +--------+--------+  +-------+-------+  +---------+--------+
              |                    |                    |
              |  BFF Proxy         |                    |
              +--------------------+--------------------+
                                   |
                          +--------v--------+
                          |  External APIs  |
                          |  - SiliconFlow  |
                          |  - Figma REST   |
                          +-----------------+
```

### 2.2 Logical Architecture (Layered View)

```
+-------------------------------------------------------------+
|                    PRESENTATION LAYER                        |
|  Next.js 14 App Router  |  shadcn/ui  |  Tailwind CSS       |
|  Zustand State Mgmt     |  React Query  |  Monaco Editor    |
+-------------------------------------------------------------+
|                    API GATEWAY LAYER                         |
|  Next.js Route Handlers (BFF Pattern)                       |
|  /api/figma/*  |  /api/rag/*  |  /api/pipeline/*           |
+-------------------------------------------------------------+
|                    BUSINESS LOGIC LAYER                      |
|  +------------------+  +------------------+  +------------+ |
|  | Pipeline Engine  |  | Agent Registry   |  | DSL Engine | |
|  | (LangChain)      |  | (5 Agents)       |  | (Schema)   | |
|  +------------------+  +------------------+  +------------+ |
|  +------------------+  +------------------+  +------------+ |
|  | Figma Adapter    |  | RAG Service      |  | Validator  | |
|  | (REST Client)    |  | (ChromaDB)       |  | (AST+LLM)  | |
|  +------------------+  +------------------+  +------------+ |
+-------------------------------------------------------------+
|                    INFRASTRUCTURE LAYER                      |
|  ChromaDB  |  SiliconFlow API  |  LangChain  |  FastAPI     |
+-------------------------------------------------------------+
```

### 2.3 Process Architecture (Agent Pipeline)

```
INPUT                   PIPELINE STAGES                      OUTPUT
------    -----------------------------------------------    ------

Figma URL
    |
    v
[Figma API] --> raw JSON
    |
    v
+-----------+    +-----------+    +-----------+    +-----------+    +-----------+
| Agent 1   |    | Agent 2   |    | Agent 3   |    | Agent 4   |    | Agent 5   |
| CLEANER   |--->| CONVERTER |--->| RETRIEVER |--->| GENERATOR |--->| VALIDATOR |
| (Python)  |    | (Python)  |    | (ChromaDB)|    | (DeepSeek)|    | (AST+LLM) |
+-----------+    +-----------+    +-----------+    +-----------+    +-----------+
     |                |                |                |                |
     v                v                v                v                v
cleaned_data      DSL tree       DSL+docs         source code      validated
    .json           .json          .json            .tsx/.vue        .tsx/.vue
```

---

## 3. Technology Stack & Rationale

### 3.1 Selection Matrix

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Frontend Framework** | Next.js | 14.x | App Router for file-system routing; React Server Components for reduced client JS; built-in API routes for BFF pattern |
| **UI Components** | shadcn/ui | latest | Headless, copy-paste model eliminates dependency lock-in; Tailwind-native; full TypeScript support |
| **Styling** | Tailwind CSS | 3.x | Utility-first approach enforces design consistency; zero-runtime; excellent dark mode support via CSS variables |
| **State Management** | Zustand | 4.x | Minimal boilerplate vs Redux; built-in persist middleware; excellent TypeScript inference |
| **Server Cache** | React Query | 5.x | Declarative server state; automatic background refetch; optimistic updates |
| **Code Editor** | Monaco Editor | latest | VS Code parity; syntax highlighting for 60+ languages; diff view support |
| **API Framework** | FastAPI | 0.104+ | Native async/await; automatic OpenAPI schema generation; Pydantic validation; performance parity with Node.js |
| **AI Orchestration** | LangChain | 0.1+ | Standardized agent/tool/chain abstractions; multi-provider LLM support; built-in callback system for observability |
| **LLM (Generation)** | DeepSeek-V3 | via SiliconFlow | 671B MoE architecture; superior code generation vs GPT-4 on HumanEval; 128K context window |
| **LLM (Embedding)** | BGE-M3 | via SiliconFlow | State-of-the-art multilingual embedding; supports dense + sparse retrieval; 8192 token limit |
| **Vector Database** | ChromaDB | 0.4+ | Embedded deployment (no external service); HNSW indexing; metadata filtering; Python-native API |

### 3.2 Technology Anti-Patterns (Explicitly Avoided)

| Anti-Pattern | Reason for Avoidance |
|--------------|---------------------|
| Monolithic backend with all logic in `main.py` | Violates Single Responsibility; hinders testing; current codebase has this issue and is being refactored |
| LLM for deterministic tasks (data cleaning, type mapping) | Non-deterministic output; latency overhead; token cost; hallucination risk |
| Direct database access from frontend | Security risk; tight coupling; violates layered architecture |
| Hardcoded configuration | Environment-specific drift; deployment fragility; addressed via `config.py` |
| Missing error boundaries in UI components | Uncaught exceptions crash the entire React tree |

---

## 4. Multi-Agent Pipeline Design

### 4.1 Agent Contract Schema

Each agent MUST implement the following interface:

```python
from typing import Protocol, TypedDict, Any

class PipelineState(TypedDict, total=False):
    """Shared state dictionary passed through the pipeline."""
    # Input fields
    figma_url: str
    figma_raw: dict
    framework: str          # "react" | "vue2" | "nextjs"
    component_lib: str      # "element-plus" | "antd" | "shadcn"
    
    # Stage outputs
    cleaned_data: dict      # Agent 1 output
    dsl: dict               # Agent 2 output
    dsl_with_docs: dict     # Agent 3 output
    generated_code: str     # Agent 4 output
    validation_result: dict # Agent 5 output
    
    # Metadata
    run_id: str
    errors: list[dict]

class Agent(Protocol):
    """Agent interface contract."""
    name: str
    version: str
    uses_llm: bool
    
    async def execute(self, state: PipelineState) -> PipelineState:
        """Execute agent logic. Returns mutated state."""
        ...
    
    def rollback(self, state: PipelineState) -> PipelineState:
        """Rollback on failure. Removes this agent's output from state."""
        ...
```

### 4.2 Agent Specification

#### Agent 1: Data Cleaner (`agents/cleaner.py`)

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0.0 |
| **Uses LLM** | No |
| **Determinism** | 100% (pure Python) |
| **Average Latency** | < 50ms for typical Figma files |
| **Input** | `state.figma_raw` (raw Figma REST API response) |
| **Output** | `state.cleaned_data` (sanitized JSON with CSS-mapped properties) |

**Processing Rules (10 rules total)**:

1. Remove top-level Figma metadata fields (`id`, `lastModified`, `version`, `description`, `editorType`, `styleType`, `remote`, `scrollBehavior`, `componentPropertyDefinitions`)
2. Remove node-level internal fields (`pluginData`, `sharedPluginData`, `layoutSizingHorizontal/Vertical`, `clipsContent`, `rectangleCornerRadii`, individual corner radii, `strokeAlign/Cap/Join/MiterLimit`, `textAutoResize/Truncation/maxLines`, `lineHeightPx/Percent/Unit`, `letterSpacing`, `textCase/Decoration`, `hyperlink`, `styleId`, `componentId`)
3. Skip `visible: false` nodes and their entire subtrees
4. Convert Figma RGBA (0-1 range) to CSS hex/rgba strings
5. Convert Figma DROP_SHADOW effects to CSS `box-shadow`; discard INNER_SHADOW and other effect types
6. Convert Figma strokes to CSS `borderColor` + `borderWidth`
7. Infer font-weight from `fontPostScriptName` (e.g., "Inter-Bold" -> 700)
8. Map Figma Auto Layout to CSS Flexbox (`layoutMode` -> `flexDirection`, `itemSpacing` -> `gap`, `padding*` -> `padding` shorthand, `primaryAxisAlignItems` -> `justifyContent`, `counterAxisAlignItems` -> `alignItems`)
9. TEXT node special handling: extract `characters` -> `text`, `fontSize`, `fontFamily`, `fontWeight`, text `color`
10. Mark COMPONENT/INSTANCE/COMPONENT_SET nodes with `isComponent: true` and `componentName`

#### Agent 2: DSL Converter (`agents/converter.py`)

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0.0 |
| **Uses LLM** | No |
| **Determinism** | 100% (rule engine) |
| **Average Latency** | < 10ms |
| **Input** | `state.cleaned_data` |
| **Output** | `state.dsl` (structured component DSL) |

**DSL Schema**:

```json
{
  "$schema": "https://d2c.internal/schemas/dsl-v1.json",
  "pageName": "string",
  "framework": "react | vue2 | nextjs",
  "componentLib": "element-plus | antd | shadcn",
  "convertedAt": "ISO8601 datetime",
  "components": [
    {
      "name": "string (Figma layer name)",
      "type": "button | input | table | modal | container | text | box | checkbox | radio | select | slider | switch | card | list | avatar | badge | image | icon | menu | navbar | sidebar | tabs | breadcrumb | pagination | tooltip | popover | progress | loading | header | footer | divider | form | component",
      "styles": { "CSSProperty": "value" },
      "props": { "propName": "value" },
      "layout": { "mode": "HORIZONTAL | VERTICAL", "hasAutoLayout": "boolean" },
      "children": ["...recursive"]
    }
  ]
}
```

**Type Inference Rules**: Component type is determined by layer name keyword matching against a 40-entry keyword dictionary, with fallback to Figma base type mapping (FRAME->container, TEXT->text, RECTANGLE->box, etc.).

#### Agent 3: Knowledge Retriever (`agents/retriever.py`)

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0.0 |
| **Uses LLM** | No (uses embedding API only) |
| **Determinism** | 100% (deterministic retrieval) |
| **Average Latency** | 200-500ms (network + embedding) |
| **Input** | `state.dsl` |
| **Output** | `state.dsl_with_docs` (DSL augmented with `componentDocs`) |

**Retrieval Strategy**:

1. Parse DSL to extract unique component types (e.g., `["button", "input", "table"]`)
2. For each type, construct query: `"{componentLib} {type} component API usage examples"`
3. Query ChromaDB collection with `n_results=2`
4. Attach retrieved document excerpts (truncated to 500 chars) to `dsl.componentDocs[type]`
5. The augmented DSL is passed to Agent 4 for context-aware code generation

#### Agent 4: Code Generator (`agents/generator.py`)

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0.0 |
| **Uses LLM** | DeepSeek-V3 (SiliconFlow) |
| **Determinism** | Non-deterministic (LLM) |
| **Average Latency** | 3-15s (network + generation) |
| **Max Tokens** | 8192 |
| **Temperature** | 0.3 (low for consistency) |
| **Input** | `state.dsl_with_docs` |
| **Output** | `state.generated_code` |

**Generation Constraints (embedded in system prompt)**:

1. Strict adherence to DSL component hierarchy order
2. Prioritize component library components over raw HTML elements
3. Apply Tailwind CSS dark theme via design token classes
4. Vue output format: single-file component (template + script + style)
5. React output format: TSX with TypeScript interface definitions
6. Follow component library API documentation from `componentDocs`
7. Include proper import statements for all used components
8. Generate semantic, accessible markup (ARIA labels, alt text, heading hierarchy)

#### Agent 5: Code Validator (`agents/validator.py`)

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0.0 |
| **Uses LLM** | DeepSeek-V3 (for semantic review only) |
| **Determinism** | Partially deterministic (AST layer is 100%) |
| **Average Latency** | 500ms (AST) + 3-10s (LLM review) |
| **Input** | `state.generated_code` + `state.framework` |
| **Output** | `state.validation_result` (pass/fail + issues + fixed_code) |

**Dual-Layer Validation**:

*Layer 1 - AST Static Analysis (Python, no LLM)*:
- Bracket/tag matching: `{ }`, `( )`, `[ ]`, HTML/JSX tag closure
- Import verification: Required imports present, no missing exports
- Security scan: `dangerouslySetInnerHTML`, `v-html`, `eval()`, `innerHTML`
- List rendering: `key` prop presence on mapped elements
- Component library API correctness: Props match component documentation

*Layer 2 - LLM Semantic Review (DeepSeek-V3)*:
- TypeScript type safety and completeness
- Accessibility compliance (WCAG 2.1 AA baseline)
- Performance anti-patterns (unnecessary re-renders, missing memoization)
- Design token consistency with Tailwind theme
- Edge case handling (empty states, loading states, error states)

**Fix Strategy**: If issues found, Agent 5 requests LLM to generate a corrected version. The corrected code is returned in `validation_result.fixed_code`.

### 4.3 Pipeline Orchestration

The pipeline is assembled using LangChain's Runnable composition:

```python
from langchain_core.runnables import RunnableLambda, RunnableParallel

# Sequential pipeline with explicit error boundaries
pipeline = (
    RunnableLambda(agent1_clean)
    | RunnableLambda(agent2_convert)
    | RunnableLambda(agent3_retrieve)
    | RunnableLambda(agent4_generate)
    | RunnableLambda(agent5_validate)
)

# Execution with retry and timeout
result = await pipeline.ainvoke(
    initial_state,
    config={
        "run_name": f"pipeline-{run_id}",
        "timeout": 120,  # 2 minute hard timeout
        "max_retries": 1,
        "callbacks": [LoggingCallback(), MetricsCallback()],
    }
)
```

**Error Handling Protocol**:

1. Each agent wraps its execution in try/except
2. On failure, the agent logs the error to `state.errors` with agent name, timestamp, and traceback
3. The pipeline continues to the next agent (fail-soft mode)
4. If Agent 1 or 2 fails, the pipeline is aborted (no meaningful downstream work possible)
5. If Agent 3 fails, code generation proceeds without RAG augmentation
6. If Agent 4 fails, this is a hard failure (no code produced)
7. If Agent 5 fails, the unvalidated code is returned with a warning flag

---

## 5. Module-Level Design

### 5.1 Backend Module Structure

```
apps/server/
├── main.py                  # FastAPI application factory + route mounting
├── config.py                # Centralized configuration (env vars, defaults)
├── models.py                # Pydantic request/response models
├── requirements.txt         # Dependency manifest (pinned versions)
├── .env                     # Secrets (NEVER committed to VCS)
│
├── agents/                  # Agent implementations
│   ├── __init__.py          # Agent registry + exports
│   ├── cleaner.py           # Agent 1: Data cleaning
│   ├── converter.py         # Agent 2: DSL conversion
│   ├── retriever.py         # Agent 3: Knowledge retrieval
│   ├── generator.py         # Agent 4: Code generation (LLM)
│   ├── validator.py         # Agent 5: Code validation (AST + LLM)
│   └── pipeline.py          # Pipeline assembly + execution
│
├── routers/                 # API route modules
│   ├── __init__.py          # Router aggregation
│   ├── health.py            # GET /health
│   ├── figma.py             # POST /api/figma/analyze
│   ├── pipeline.py          # POST /api/pipeline/run, GET /api/pipeline/run/{id}
│   └── rag.py               # CRUD /api/rag/*
│
└── services/                # Infrastructure services
    ├── __init__.py          # Service exports
    ├── chroma.py            # ChromaDB client + collection management
    └── llm.py               # LLM client abstraction (provider-agnostic)
```

### 5.2 Frontend Module Structure

```
apps/web/
├── app/
│   ├── layout.tsx           # Root layout (fonts, metadata, providers)
│   ├── globals.css          # CSS custom properties (design tokens)
│   ├── page.tsx             # Root redirect
│   │
│   ├── (dashboard)/         # Route group: authenticated dashboard
│   │   ├── layout.tsx       # Dashboard shell (Sidebar + TopBar + Content)
│   │   ├── figma2code/      # Figma import + code preview
│   │   │   └── page.tsx
│   │   ├── agent/           # Pipeline execution visualization
│   │   │   └── page.tsx
│   │   └── knowledge/       # Knowledge base management
│   │       └── page.tsx
│   │
│   └── api/                 # BFF route handlers
│       ├── figma/route.ts   # Proxy to backend /api/figma/*
│       └── rag/route.ts     # Proxy to backend /api/rag/*
│
├── components/
│   ├── layout/              # Layout shell components
│   │   ├── Providers.tsx    # React Query + Theme providers
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   ├── TopBar.tsx       # Top navigation bar
│   │   └── RightPanel.tsx   # Context panel
│   ├── agent/               # Agent visualization
│   │   └── AgentSteps.tsx   # Pipeline step tracker
│   ├── figma/               # Figma-specific components
│   │   ├── FigmaImporter.tsx# URL input + framework selection
│   │   ├── CodePreview.tsx  # Monaco Editor wrapper
│   │   ├── DesignPreview.tsx# Figma image preview
│   │   └── NodeTree.tsx     # Figma node tree viewer
│   └── ui/                  # Primitive UI components (shadcn/ui)
│
├── hooks/                   # Custom React hooks
│   └── useFigma.ts          # Figma analysis hook with polling
│
├── lib/
│   ├── api/                 # API client layer
│   │   ├── client.ts        # Axios instance with interceptors
│   │   ├── figma.ts         # Figma API functions
│   │   ├── rag.ts           # RAG API functions
│   │   └── agent.ts         # Agent pipeline API functions
│   ├── store/               # Zustand stores
│   │   ├── figmaStore.ts    # Figma state (persisted)
│   │   └── ragStore.ts      # RAG document state
│   └── utils/               # Utility functions
│       ├── cn.ts            # Class name merger (clsx + tailwind-merge)
│       └── format.ts        # Date formatting, truncation, ID generation
│
└── types/
    └── index.ts             # Shared TypeScript type definitions
```

---

## 6. Data Flow & Communication Protocol

### 6.1 Pipeline Data Flow Diagram

```
User Action: Submit Figma URL
    |
    v
[FigmaImporter.tsx]
    | POST { figma_url, framework, component_lib }
    v
[api/figma/route.ts] -- BFF Proxy --> [FastAPI: /api/figma/analyze]
    |                                        |
    |                                   [Figma REST API]
    |                                        |
    |                                   raw JSON response
    |                                        |
    v                                        v
[figmaStore.ts] <-- response { raw_data, preview_url, node_count }
    |
    | User clicks "Generate Code"
    v
[api/pipeline/route.ts] -- BFF Proxy --> [FastAPI: /api/pipeline/run]
    |                                        |
    |                                   [Agent 1: Cleaner]
    |                                   [Agent 2: Converter]
    |                                   [Agent 3: Retriever]
    |                                   [Agent 4: Generator]
    |                                   [Agent 5: Validator]
    |                                        |
    v                                        v
[AgentSteps.tsx] <-- SSE stream or poll --> { run_id, status, steps[], result }
    |
    v
[CodePreview.tsx] renders generated_code
```

### 6.2 Inter-Agent Communication Protocol

All agents communicate exclusively through the shared `PipelineState` dictionary. There is no direct agent-to-agent coupling.

```
STATE KEY LIFECYCLE:

figma_url         [SET at pipeline start, READ by Agent 0 (Figma adapter)]
figma_raw         [SET by Figma adapter, READ by Agent 1]
framework         [SET at pipeline start, READ by Agent 2, 4, 5]
component_lib     [SET at pipeline start, READ by Agent 2, 3, 4]
cleaned_data      [SET by Agent 1, READ by Agent 2]
dsl               [SET by Agent 2, READ by Agent 3]
dsl_with_docs     [SET by Agent 3, READ by Agent 4]
generated_code    [SET by Agent 4, READ by Agent 5]
validation_result [SET by Agent 5, READ by pipeline caller]
errors            [APPENDED by any agent on failure]
run_id            [SET at pipeline start, READ by all agents for logging]
```

### 6.3 BFF Pattern Rationale

The Next.js API routes act as a Backend-for-Frontend (BFF) layer, not a simple proxy. Responsibilities:

1. **Request Enrichment**: Add client-side context (user agent, timezone, locale) to backend requests
2. **Response Transformation**: Adapt backend responses to frontend-optimal shapes
3. **Error Normalization**: Transform backend error codes into user-facing messages
4. **Rate Limiting**: Apply per-user rate limits at the edge before hitting backend
5. **Caching**: Cache Figma analysis results (TTL: 5 minutes) to reduce backend load

---

## 7. API Contract Specification

### 7.1 REST API Endpoints

#### POST /api/pipeline/run

Initiates a full 5-agent pipeline execution.

**Request**:
```json
{
  "figma_url": "https://www.figma.com/file/abc123/MyDesign",
  "framework": "react",
  "component_lib": "shadcn",
  "options": {
    "skip_validation": false,
    "include_comments": false
  }
}
```

**Response (202 Accepted)**:
```json
{
  "run_id": "run_a1b2c3d4",
  "status": "processing",
  "started_at": "2026-06-04T01:30:00Z",
  "estimated_completion": "2026-06-04T01:30:30Z"
}
```

#### GET /api/pipeline/run/{run_id}

Polls pipeline execution status.

**Response (200 OK)**:
```json
{
  "run_id": "run_a1b2c3d4",
  "status": "completed",
  "started_at": "2026-06-04T01:30:00Z",
  "completed_at": "2026-06-04T01:30:22Z",
  "duration_ms": 22000,
  "steps": [
    {
      "agent": "cleaner",
      "status": "completed",
      "duration_ms": 45,
      "node_count": 156
    },
    {
      "agent": "converter",
      "status": "completed",
      "duration_ms": 8,
      "component_count": 34
    },
    {
      "agent": "retriever",
      "status": "completed",
      "duration_ms": 320,
      "docs_retrieved": 12
    },
    {
      "agent": "generator",
      "status": "completed",
      "duration_ms": 18400,
      "tokens_used": 3200,
      "lines_generated": 245
    },
    {
      "agent": "validator",
      "status": "completed",
      "duration_ms": 2800,
      "issues_found": 2,
      "issues_fixed": 2
    }
  ],
  "result": {
    "code": "<generated source code>",
    "framework": "react",
    "component_lib": "shadcn",
    "validation": {
      "passed": true,
      "score": 92,
      "warnings": []
    }
  }
}
```

#### POST /api/figma/analyze

Analyzes a Figma design file and returns the node tree.

**Request**:
```json
{
  "figma_url": "https://www.figma.com/file/abc123/MyDesign"
}
```

**Response (200 OK)**:
```json
{
  "file_name": "MyDesign",
  "last_modified": "2026-06-03T15:00:00Z",
  "preview_url": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/...",
  "node_count": 245,
  "raw_data": { "...full Figma JSON..." }
}
```

#### POST /api/rag/upload

Uploads a document to the knowledge base.

**Request**: `multipart/form-data`
- `file`: Document file (.txt, .md, .pdf)
- `metadata`: JSON string with `{ title, tags, component_lib }`

**Response (201 Created)**:
```json
{
  "doc_id": "doc_x1y2z3",
  "title": "Element Plus Button API",
  "chunks": 5,
  "indexed_at": "2026-06-04T01:35:00Z"
}
```

#### GET /api/rag/documents

Lists all documents in the knowledge base.

**Response (200 OK)**:
```json
{
  "documents": [
    {
      "doc_id": "doc_x1y2z3",
      "title": "Element Plus Button API",
      "chunks": 5,
      "created_at": "2026-06-04T01:35:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/rag/search

Searches the knowledge base.

**Request**:
```json
{
  "query": "button component usage",
  "top_k": 5
}
```

**Response (200 OK)**:
```json
{
  "results": [
    {
      "doc_id": "doc_x1y2z3",
      "score": 0.92,
      "content": "The el-button component...",
      "metadata": { "title": "Element Plus Button API" }
    }
  ]
}
```

#### DELETE /api/rag/documents/{doc_id}

Deletes a document from the knowledge base.

**Response (200 OK)**:
```json
{
  "deleted": true,
  "doc_id": "doc_x1y2z3"
}
```

#### GET /health

Health check endpoint.

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "services": {
    "chromadb": "connected",
    "llm_api": "connected"
  }
}
```

### 7.2 Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "PIPELINE_AGENT_FAILURE",
    "message": "Agent 4 (generator) failed: LLM API timeout after 30s",
    "run_id": "run_a1b2c3d4",
    "details": {
      "agent": "generator",
      "step_index": 3,
      "retryable": true
    }
  }
}
```

**Error Code Catalog**:

| Code | HTTP Status | Retryable | Description |
|------|-------------|-----------|-------------|
| `FIGMA_INVALID_URL` | 400 | No | Malformed or inaccessible Figma URL |
| `FIGMA_API_ERROR` | 502 | Yes | Figma REST API returned an error |
| `FIGMA_RATE_LIMITED` | 429 | Yes | Figma API rate limit exceeded |
| `PIPELINE_INVALID_STATE` | 400 | No | Missing required pipeline input fields |
| `PIPELINE_AGENT_FAILURE` | 500 | Yes | Individual agent execution failure |
| `PIPELINE_TIMEOUT` | 504 | Yes | Pipeline exceeded 120s timeout |
| `LLM_API_ERROR` | 502 | Yes | SiliconFlow API unavailable |
| `LLM_RATE_LIMITED` | 429 | Yes | LLM API rate limit exceeded |
| `RAG_INDEX_ERROR` | 500 | Yes | ChromaDB indexing failure |
| `RAG_NOT_FOUND` | 404 | No | Document ID not found in knowledge base |
| `VALIDATION_ERROR` | 422 | No | Request body fails Pydantic validation |

---

## 8. Frontend Architecture

### 8.1 Component Hierarchy

```
<RootLayout>
  <Providers>                              # React Query + Theme
    <DashboardLayout>                      # (dashboard) route group
      <Sidebar>                            # Persistent left navigation
        <NavItem href="/figma2code" />
        <NavItem href="/agent" />
        <NavItem href="/knowledge" />
      </Sidebar>
      <main>
        <TopBar>                           # Breadcrumb + actions
          <Breadcrumb />
          <RightPanelToggle />
        </TopBar>
        <PageContent>                      # Route-specific content
          {/* /figma2code */}
          <FigmaImporter />
          <DesignPreview />
          <NodeTree />
          <CodePreview />
          
          {/* /agent */}
          <AgentSteps />
          
          {/* /knowledge */}
          <KnowledgeManager />
        </PageContent>
      </main>
      <RightPanel>                         # Contextual info panel
        <ComponentDetails />
        <ExecutionLog />
      </RightPanel>
    </DashboardLayout>
  </Providers>
</RootLayout>
```

### 8.2 State Management Architecture

```
+------------------+     +------------------+     +------------------+
|   Server State   |     |   Client State   |     |   UI State       |
| (React Query)    |     | (Zustand)        |     | (React useState) |
+------------------+     +------------------+     +------------------+
| - figma analysis |     | - selected figma |     | - sidebar open   |
| - pipeline runs  |     |   URL (persist)  |     | - panel visible  |
| - RAG documents  |     | - framework pref |     | - modal open     |
| - search results |     | - component lib  |     | - tab active     |
+------------------+     +------------------+     +------------------+
```

**State Management Principles**:

1. **Server state** (data fetched from API) MUST use React Query for automatic caching, background refetch, and optimistic updates
2. **Client state** (user preferences, selections) SHOULD use Zustand with `persist` middleware for localStorage durability
3. **UI state** (ephemeral toggle states) SHOULD use React `useState` within the relevant component scope
4. No prop drilling beyond 2 levels; use component composition or context for shared state

### 8.3 Design Token System

The application uses CSS custom properties for theming, defined in `globals.css`:

```css
:root {
  /* Background scale */
  --bg-primary: #0D1117;
  --bg-secondary: #161B22;
  --bg-tertiary: #21262D;
  
  /* Foreground scale */
  --fg-primary: #E6EDF3;
  --fg-secondary: #8B949E;
  --fg-muted: #484F58;
  
  /* Brand scale */
  --brand-primary: #2EA043;
  --brand-hover: #3FB950;
  --brand-muted: rgba(46, 160, 67, 0.15);
  
  /* Border scale */
  --border-default: #30363D;
  --border-muted: #21262D;
  
  /* Semantic scale */
  --danger: #F85149;
  --warning: #D29922;
  --info: #58A6FF;
}
```

All components MUST reference these tokens rather than hardcoded color values. This ensures theme consistency and enables future light-mode support without component refactoring.

---

## 9. Infrastructure & Deployment

### 9.1 Development Environment

**Prerequisites**:
- Python 3.11+ (backend services)
- Node.js 20 LTS (frontend)
- Git 2.40+

**Local Startup Sequence**:

```
1. start-all.bat
   ├── start-backend.bat   # uvicorn main:app --port 8080 --reload
   ├── start-agent.bat     # uvicorn agent:app --port 8081 --reload
   └── start-frontend.bat  # next dev --port 3000
```

### 9.2 Environment Configuration

All configuration is centralized in `apps/server/config.py` with the following hierarchy:

1. Environment variables (highest priority)
2. `.env` file (development only)
3. Default values in `config.py` (lowest priority)

```python
# apps/server/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8080
    
    # Figma
    figma_token: str = ""
    figma_api_base: str = "https://api.figma.com/v1"
    
    # LLM (SiliconFlow)
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    llm_model_code_gen: str = "deepseek-ai/DeepSeek-V3"
    embedding_model: str = "BAAI/bge-m3"
    
    # ChromaDB
    chroma_persist_dir: str = "./chroma_data"
    chroma_collection_name: str = "component_docs"
    
    # Pipeline
    pipeline_timeout_seconds: int = 120
    pipeline_max_retries: int = 1
    
    class Config:
        env_file = ".env"
```

### 9.3 Containerization (Planned)

```dockerfile
# apps/web/Dockerfile (existing)
FROM node:20-alpine AS base
# ... multi-stage build for Next.js

# apps/server/Dockerfile (planned)
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## 10. Security & Compliance

### 10.1 Secrets Management

| Secret | Storage | Access Pattern |
|--------|---------|---------------|
| `FIGMA_TOKEN` | `.env` file (dev), Vault/Secrets Manager (prod) | Server-side only, never exposed to frontend |
| `SILICONFLOW_API_KEY` | `.env` file (dev), Vault/Secrets Manager (prod) | Server-side only |
| User session tokens | HTTP-only cookies | Set by auth service, auto-attached by browser |

### 10.2 Input Validation

All user inputs are validated at multiple layers:

1. **Frontend**: Zod/React Hook Form for form validation
2. **BFF Layer**: Next.js route handler input sanitization
3. **Backend**: Pydantic model validation with strict type checking
4. **LLM Prompts**: Input sanitization before injection into prompts (XSS prevention)

### 10.3 API Security

- CORS: Whitelist-only origins (localhost:3000 for dev, production domain for prod)
- Rate Limiting: 10 requests/minute per IP for pipeline runs, 60/minute for reads
- Request Size Limit: 10MB for file uploads, 1MB for JSON bodies
- Timeout: 120s hard timeout on pipeline execution

### 10.4 Code Output Security

Agent 5's validation layer specifically scans for:

- `dangerouslySetInnerHTML` (React)
- `v-html` (Vue)
- `eval()`, `new Function()`, `setTimeout(string)`
- `innerHTML`, `outerHTML` assignments
- Unsanitized user input in rendered output

Any generated code containing these patterns is flagged and auto-corrected before delivery.

---

## 11. Quality Assurance Strategy

### 11.1 Testing Pyramid

```
           +-------+
          /  E2E    \
         / Playwright \
        +-------------+
       /   Integration  \
      /   API Tests       \
     +--------------------+
    /     Unit Tests         \
   /   (Pytest + Vitest)      \
  +---------------------------+
```

**Coverage Targets**:

| Layer | Target | Framework |
|-------|--------|-----------|
| Unit Tests (Backend) | 85% line coverage | Pytest + pytest-cov |
| Unit Tests (Frontend) | 80% line coverage | Vitest + Testing Library |
| Integration Tests | All API endpoints | Pytest + httpx |
| E2E Tests | Critical user flows | Playwright |

### 11.2 Critical Test Scenarios

**Agent Unit Tests**:

- Agent 1: Verify all 10 cleaning rules with fixture Figma data; verify hidden node filtering; verify color conversion accuracy (RGBA to hex/rgba)
- Agent 2: Verify type inference for all 40 keyword patterns; verify style passthrough; verify recursive child handling
- Agent 3: Verify retrieval with empty DSL (no components); verify retrieval with unknown component types; verify document truncation at 500 chars
- Agent 4: Verify prompt construction includes all required context; verify output parsing extracts code correctly
- Agent 5: Verify AST detects unmatched brackets; verify security pattern detection; verify LLM review trigger conditions

**Integration Tests**:

- Full pipeline execution with mock Figma data and mock LLM responses
- Pipeline error recovery: verify Agent 3 failure does not block Agent 4
- RAG CRUD lifecycle: upload -> search -> retrieve -> delete
- Figma URL validation: malformed URLs, private files, non-existent files

### 11.3 Code Quality Gates

All commits must pass:

1. **Linting**: Ruff (Python) + ESLint (TypeScript)
2. **Type Checking**: mypy (Python, strict mode) + tsc --noEmit (TypeScript)
3. **Formatting**: Black (Python) + Prettier (TypeScript)
4. **Unit Tests**: All tests pass with current coverage above threshold
5. **Build**: `next build` succeeds without warnings

---

## 12. Operational Runbook

### 12.1 Service Health Monitoring

**Health Check Endpoints**:

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Frontend | `GET /` | 200 OK, HTML page |
| Backend | `GET /health` | `{"status": "healthy", "services": {...}}` |
| RAG Worker | `GET /health` | `{"status": "healthy", "chromadb": "connected"}` |

### 12.2 Common Failure Scenarios

| Symptom | Root Cause | Resolution |
|---------|-----------|------------|
| Pipeline returns 504 | LLM API timeout | Check SiliconFlow status page; increase timeout to 180s; retry |
| RAG search returns empty | ChromaDB collection deleted | Re-index documents via `POST /api/rag/upload` |
| Figma analysis fails with 403 | Expired Figma token | Regenerate token at Figma Account Settings; update `.env` |
| Frontend shows blank page | Next.js build error | Check `npm run build` output; verify Node.js version >= 20 |
| Agent 4 generates malformed code | LLM hallucination | Retry pipeline; consider lowering temperature to 0.1 |

### 12.3 Logging Standards

```python
# Structured logging format
logger.info(
    "pipeline.step.completed",
    extra={
        "run_id": run_id,
        "agent": "cleaner",
        "duration_ms": 45,
        "node_count": 156,
    }
)

# Log levels
# DEBUG: Detailed agent internals (only in development)
# INFO: Pipeline step completion, API request/response summaries
# WARNING: Retryable errors, degraded functionality
# ERROR: Agent failures, API errors, unrecoverable issues
# CRITICAL: Service startup failures, data corruption
```

---

## 13. Future Roadmap

### 13.1 Short-Term (Q2 2026)

- [ ] Extract agent logic from `main.py` into `agents/` module (in progress)
- [ ] Add Redis-based pipeline state persistence (currently in-memory only)
- [ ] Implement SSE streaming for real-time pipeline progress updates
- [ ] Add comprehensive test suite for all 5 agents
- [ ] Docker Compose for one-command local development environment

### 13.2 Medium-Term (Q3 2026)

- [ ] Multi-file code generation (component files + styles + types)
- [ ] Design system theme extraction from Figma variables
- [ ] Interactive code editing with Figma-to-code bidirectional sync
- [ ] Figma plugin for one-click "Generate Code" from within Figma
- [ ] Batch processing: generate code for multiple Figma frames simultaneously

### 13.3 Long-Term (Q4 2026+)

- [ ] Custom component library training (fine-tune LLM on organization's component library)
- [ ] Visual regression testing: compare generated UI against Figma screenshot
- [ ] CI/CD integration: auto-generate code on Figma file update
- [ ] Multi-platform output: React Native, Flutter, SwiftUI
- [ ] Collaborative review workflow: designer + developer approval pipeline

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **Agent** | An autonomous processing unit in the pipeline with a single responsibility |
| **AST** | Abstract Syntax Tree; used for deterministic code analysis without LLM |
| **BFF** | Backend-for-Frontend; API proxy layer in Next.js for request enrichment |
| **ChromaDB** | Embedded vector database for storing and retrieving component documentation |
| **DSL** | Domain Specific Language; the structured JSON format used for inter-agent communication |
| **LangChain** | Python framework providing Agent, Tool, Chain, and Runnable abstractions |
| **LLM** | Large Language Model; DeepSeek-V3 via SiliconFlow API |
| **Pipeline State** | Shared dictionary passed sequentially through all agents |
| **RAG** | Retrieval-Augmented Generation; enhances LLM output with knowledge base context |
| **SiliconFlow** | Third-party API provider hosting DeepSeek-V3 and BGE-M3 models |

## Appendix B: References

- [LangChain Documentation](https://python.langchain.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Figma REST API Documentation](https://www.figma.com/developers/api)
- [SiliconFlow Platform](https://siliconflow.cn)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

---

*Document Control: This document is maintained by the Architecture Team. All changes must be proposed via pull request with at least one senior engineer review. Version increments follow Semantic Versioning: MAJOR.MINOR.PATCH.*
