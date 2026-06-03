"""D2C RAG Worker - 文档向量化 & 检索增强"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="D2C RAG Worker",
    description="Document indexing and embedding service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "D2C RAG Worker"}


@app.post("/api/rag/embed")
async def embed_document():
    """向量化文档（可接入 OpenAI Embedding / 本地模型）"""
    return {"status": "ok", "chunks": 0}


if __name__ == "__main__":
    uvicorn.run("agent:app", host="0.0.0.0", port=8081, reload=True)
