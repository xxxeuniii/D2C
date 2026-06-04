"""
Pydantic Models - API 数据模型
"""
from pydantic import BaseModel
from typing import Optional


class PipelineRunRequest(BaseModel):
    url: str
    framework: str = "react"
    componentLib: str = "element-plus"
    figmaToken: str = ""
    session_id: str = ""  # 可选：会话 ID，用于 Chat 会话隔离


class RAGSearchRequest(BaseModel):
    query: str
    topK: int = 5


class DocumentInfo(BaseModel):
    id: str
    name: str
    type: str
    size: Optional[str] = None
    updatedAt: str
    status: str
    chunks: Optional[int] = None
