"""D2C Backend API Server"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="D2C API",
    description="Design to Code Backend Service",
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
    return {"status": "ok", "service": "D2C Backend"}


@app.get("/api/chat/stream")
async def chat_stream():
    return {"message": "Chat stream endpoint (SSE)"}


@app.post("/api/figma/analyze")
async def figma_analyze():
    return {"message": "Figma analyze endpoint"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
