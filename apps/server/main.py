"""
D2C Backend - 多 Agent 协同流水线 (生产级)

分层架构:
  config.py         - 集中配置管理
  models.py         - Pydantic 数据模型
  services/         - 基础设施层 (ChromaDB, LLM 客户端)
  agents/           - 业务逻辑层 (5 个 Agent + 流水线)
  routers/          - API 路由层 (health, pipeline, rag, figma)

5 个 Agent，Chain 串联:
  Agent 1: 数据清洗 → Python 代码兜底 + LLM 语义增强（颜色/文本/布局）
  Agent 2: 结构化转换 → Python 规则引擎兜底 + LLM 语义增强（组件/Props/关系/Token/交互）
  Agent 3: 知识检索 → ChromaDB RAG 检索组件文档
  Agent 4: 代码生成 → DeepSeek-V3 生成代码
  Agent 5: 测试验证 → AST + LLM 双重验证
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health_router, pipeline_router, rag_router, figma_router

# ============================================
# FastAPI 应用初始化
# ============================================
app = FastAPI(title="D2C API - Multi-Agent Pipeline", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3456"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(health_router)
app.include_router(pipeline_router)
app.include_router(rag_router)
app.include_router(figma_router)

# ============================================
# Main
# ============================================
if __name__ == "__main__":
    from config import LLM_MODEL, CODE_LLM_MODEL

    print(f"""
╔══════════════════════════════════════════════════════╗
║     D2C Backend - Multi-Agent Pipeline (Production)  ║
║                                                      ║
║  Agent 1: 数据清洗 → Python + LLM 语义增强           ║
║  Agent 2: 结构化转换 → Python + LLM 语义增强         ║
║  Agent 3: 知识检索 → ChromaDB RAG                    ║
║  Agent 4: 代码生成 → DeepSeek-V3 LLM                 ║
║  Agent 5: 测试验证 → AST + LLM 双重检查              ║
║                                                      ║
║  LLM: {LLM_MODEL:<42}║
║  Code LLM: {CODE_LLM_MODEL:<38}║
╚══════════════════════════════════════════════════════╝
    """)
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
