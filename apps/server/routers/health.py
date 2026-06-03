"""
Health API 路由
"""
from fastapi import APIRouter
from config import LLM_MODEL, CODE_LLM_MODEL
from services.chroma import get_collection_count

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "D2C Backend - Multi-Agent Pipeline (Production)",
        "agents": [
            "Agent 1: 数据清洗 (Python 代码 + LLM 语义增强)",
            "Agent 2: 结构化转换 (Python 规则引擎 + LLM 语义增强)",
            "Agent 3: 知识检索 (ChromaDB RAG)",
            "Agent 4: 代码生成 (DeepSeek-V3 LLM)",
            "Agent 5: 测试验证 (AST + LLM 双重检查)",
        ],
        "llm_model": LLM_MODEL,
        "code_llm_model": CODE_LLM_MODEL,
        "rag_docs": get_collection_count(),
    }
