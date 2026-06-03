"""
RAG API 路由
"""
import time
from fastapi import APIRouter, UploadFile, File, Form
from models import RAGSearchRequest, DocumentInfo
from services.chroma import collection

router = APIRouter()


@router.get("/api/rag/documents")
async def get_documents():
    try:
        results = collection.get()
        doc_map = {}
        if results["ids"]:
            for i, doc_id in enumerate(results["ids"]):
                metadata = results["metadatas"][i] if results["metadatas"] else {}
                pid = metadata.get("doc_id", doc_id)
                if pid not in doc_map:
                    doc_map[pid] = {
                        "id": pid, "name": metadata.get("name", pid),
                        "type": metadata.get("type", "document"),
                        "size": metadata.get("size"),
                        "updatedAt": metadata.get("updatedAt", ""),
                        "status": "ready", "chunks": 1,
                    }
                else:
                    doc_map[pid]["chunks"] += 1
        return {"documents": list(doc_map.values())}
    except Exception as e:
        return {"documents": [], "error": str(e)}


@router.post("/api/rag/upload")
async def upload_document(file: UploadFile = File(...), name: str = Form(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("gbk", errors="ignore")

    chunks = [c.strip()[:4000] for c in text.split("\n\n") if c.strip()]
    if not chunks:
        chunks = [text[:4000]]

    doc_id = f"doc_{int(time.time())}"
    now = time.strftime("%Y-%m-%dT%H:%M:%S")

    collection.add(
        ids=[f"{doc_id}_{i}" for i in range(len(chunks))],
        documents=chunks,
        metadatas=[
            {
                "name": name, "type": "document",
                "size": f"{len(content)/1024:.1f} KB", "updatedAt": now,
                "doc_id": doc_id, "chunk_index": i,
            }
            for i in range(len(chunks))
        ],
    )

    return DocumentInfo(
        id=doc_id, name=name, type="document",
        size=f"{len(content)/1024:.1f} KB", updatedAt=now,
        status="ready", chunks=len(chunks),
    ).model_dump()


@router.post("/api/rag/search")
async def search_documents(req: RAGSearchRequest):
    try:
        results = collection.query(query_texts=[req.query], n_results=req.topK)
        documents = []
        if results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                documents.append({
                    "id": metadata.get("doc_id", ""),
                    "name": metadata.get("name", ""),
                    "chunk": results["documents"][0][i] if results["documents"] else "",
                    "score": results["distances"][0][i] if results["distances"] else 0,
                })
        return {"documents": documents}
    except Exception as e:
        return {"documents": [], "error": str(e)}


@router.delete("/api/rag/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        all_ids = collection.get()["ids"]
        ids_to_delete = [i for i in all_ids if i.startswith(doc_id)]
        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
