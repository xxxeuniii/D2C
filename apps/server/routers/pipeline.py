"""
流水线 API 路由

三个端点：
- POST /api/pipeline/run       Simple Chain 模式（固定顺序，速度快）
- POST /api/pipeline/agent/run  Agent 模式（Tool + 自主决策）
- POST /api/pipeline/chat       Chat 模式（Memory + 多轮对话迭代修改）
"""
import re
import json
import time
import asyncio
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from models import PipelineRunRequest
from pydantic import BaseModel
from agents.pipeline import create_pipeline, create_agent_pipeline
from agents.orchestrator import get_orchestrator

router = APIRouter()

# 内存存储运行状态
pipeline_runs: Dict[str, Dict[str, Any]] = {}


def _fetch_figma_data(url: str, figma_token: str) -> str:
    """获取 Figma 原始数据"""
    import httpx

    match = re.search(r"figma\.com/(?:file|design)/([a-zA-Z0-9]+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Figma URL")

    from config import SILICONFLOW_API_KEY

    token = figma_token or SILICONFLOW_API_KEY
    resp = httpx.get(
        f"https://api.figma.com/v1/files/{match.group(1)}?depth=3",
        headers={"X-Figma-Token": token}, timeout=30,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=f"Figma API error: {resp.text}")

    return json.dumps(resp.json(), ensure_ascii=False)


# ============================================
# Simple Chain 模式
# ============================================

@router.post("/api/pipeline/run")
async def run_pipeline(req: PipelineRunRequest):
    """运行 Simple Chain 流水线"""
    run_id = f"pipe_{int(time.time())}"
    pipeline_runs[run_id] = {
        "id": run_id, "status": "running", "steps": [],
        "url": req.url, "framework": req.framework,
        "componentLib": req.componentLib, "mode": "simple",
    }

    try:
        figma_raw = _fetch_figma_data(req.url, req.figmaToken)
        pipeline_runs[run_id]["steps"].append({
            "agent": 0, "name": "获取 Figma 原始数据", "status": "completed",
            "output": f"获取到 {len(figma_raw)} 字符",
        })

        pipeline = create_pipeline()
        agent_names = [
            "数据清洗 (Python + LLM增强)", "结构化转换 (Python + LLM增强)",
            "知识检索 (ChromaDB)", "代码生成 (LLM)", "测试验证 (AST+LLM)",
        ]

        class PipelineCallback:
            def __init__(self, rid):
                self.rid = rid; self.current = 0
            def on_chain_end(self, outputs, **kwargs):
                if self.current < 5:
                    pipeline_runs[self.rid]["steps"].append({
                        "agent": self.current + 1,
                        "name": f"Agent {self.current + 1}: {agent_names[self.current]}",
                        "status": "completed",
                    })
                    self.current += 1

        callback = PipelineCallback(run_id)
        result = await asyncio.to_thread(
            pipeline.invoke,
            {"figma_raw": figma_raw, "framework": req.framework,
             "componentLib": req.componentLib},
            {"callbacks": [callback]},
        )

        pipeline_runs[run_id]["status"] = "completed"
        pipeline_runs[run_id]["result"] = {
            "code": result.get("generated_code", ""),
            "validation": result.get("validation_result", ""),
        }

        return {
            "runId": run_id, "status": "completed",
            "steps": pipeline_runs[run_id]["steps"],
            "result": pipeline_runs[run_id]["result"],
        }

    except Exception as e:
        pipeline_runs[run_id]["status"] = "error"
        pipeline_runs[run_id]["error"] = str(e)
        return {
            "runId": run_id, "status": "error",
            "steps": pipeline_runs[run_id].get("steps", []), "error": str(e),
        }


# ============================================
# Agent 模式
# ============================================

@router.post("/api/pipeline/agent/run")
async def run_agent_pipeline(req: PipelineRunRequest):
    """运行 Agent 模式流水线（Tool + 自主决策）"""
    run_id = f"agent_{int(time.time())}"
    pipeline_runs[run_id] = {
        "id": run_id, "status": "running", "steps": [],
        "url": req.url, "framework": req.framework,
        "componentLib": req.componentLib, "mode": "agent",
    }

    try:
        figma_raw = _fetch_figma_data(req.url, req.figmaToken)
        pipeline_runs[run_id]["steps"].append({
            "agent": 0, "name": "获取 Figma 原始数据", "status": "completed",
        })

        orchestrator = get_orchestrator()
        result = await asyncio.to_thread(
            orchestrator.run_pipeline,
            figma_raw, req.framework, req.componentLib,
        )

        for ar in result.get("agents", []):
            pipeline_runs[run_id]["steps"].append({
                "agent": ar["agent"],
                "name": ar["name"],
                "status": ar["status"],
            })

        pipeline_runs[run_id]["status"] = result.get("status", "completed")
        pipeline_runs[run_id]["result"] = {
            "code": result.get("generated_code", ""),
            "validation": result.get("validation_result", ""),
            "agentDetails": result.get("agents", []),
            "mode": "agent",
        }

        return {
            "runId": run_id,
            "status": pipeline_runs[run_id]["status"],
            "steps": pipeline_runs[run_id]["steps"],
            "result": pipeline_runs[run_id]["result"],
        }

    except Exception as e:
        pipeline_runs[run_id]["status"] = "error"
        pipeline_runs[run_id]["error"] = str(e)
        return {
            "runId": run_id, "status": "error",
            "steps": pipeline_runs[run_id].get("steps", []), "error": str(e),
        }


# ============================================
# Chat 模式（多轮对话迭代修改）★ 核心
# ============================================

class ChatRequest(BaseModel):
    """Chat 请求模型"""
    message: str
    run_id: str = ""  # 可选：关联之前的流水线运行


@router.post("/api/pipeline/chat")
async def chat_with_agent(req: ChatRequest):
    """
    多轮对话修改代码。
    
    Memory 工作原理：
    - 每次调用都会记住之前的对话
    - 第 1 轮 "改颜色" → Agent 记住
    - 第 2 轮 "加圆角" → Agent 在之前基础上修改
    - 第 3 轮 "加 checkbox" → Agent 知道前两轮做了什么
    
    必须先运行 /api/pipeline/agent/run 生成初始代码，
    然后通过此端点多轮对话迭代修改。
    """
    orchestrator = get_orchestrator()

    result = await asyncio.to_thread(
        orchestrator.chat, req.message,
    )

    return result


@router.post("/api/pipeline/chat/reset")
async def reset_chat():
    """
    重置 Chat Agent 的 Memory。
    清空对话历史，开始新的修改会话。
    """
    orchestrator = get_orchestrator()
    orchestrator.reset_chat()
    return {"status": "ok", "message": "Chat Memory 已重置"}


# ============================================
# 通用查询接口
# ============================================

@router.get("/api/pipeline/run/{run_id}")
async def get_pipeline_run(run_id: str):
    """查询流水线运行状态"""
    run = pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
