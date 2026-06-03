"""D2C Agent Service"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="D2C Agent",
    description="AI Agent Service for Design to Code",
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
    return {"status": "ok", "service": "D2C Agent"}


@app.post("/api/agent/run")
async def agent_run():
    return {"message": "Agent run endpoint"}


if __name__ == "__main__":
    uvicorn.run("agent:app", host="0.0.0.0", port=8081, reload=True)
