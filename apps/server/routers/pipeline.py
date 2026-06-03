"""
流水线 API 路由
"""
import re
import json
import time
import asyncio
from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from models import PipelineRunRequest
from agents.pipeline import create_pipeline

router = APIRouter()

# 内存存储运行状态
pipeline_runs: Dict[str, Dict[str, Any]] = {}


@router.post("/api/pipeline/run")
async def run_pipeline(req: PipelineRunRequest):
    """运行完整的 5 Agent 流水线"""
    import httpx

    run_id = f"pipe_{int(time.time())}"
    pipeline_runs[run_id] = {
        "id": run_id, "status": "running", "steps": [],
        "url": req.url, "framework": req.framework, "componentLib": req.componentLib,
    }

    try:
        # 1. 获取 Figma 原始数据
        match = re.search(r"figma\.com/(?:file|design)/([a-zA-Z0-9]+)", req.url)
        if not match:
            raise HTTPException(status_code=400, detail="Invalid Figma URL")

        from config import SILICONFLOW_API_KEY

        figma_token = req.figmaToken or SILICONFLOW_API_KEY
        resp = httpx.get(
            f"https://api.figma.com/v1/files/{match.group(1)}?depth=3",
            headers={"X-Figma-Token": figma_token}, timeout=30,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"Figma API error: {resp.text}")

        figma_raw = json.dumps(resp.json(), ensure_ascii=False)
        pipeline_runs[run_id]["steps"].append({
            "agent": 0, "name": "获取 Figma 原始数据", "status": "completed",
            "output": f"获取到 {len(figma_raw)} 字符",
        })

        # 2. 运行流水线
        pipeline = create_pipeline()
        agent_names = [
            "数据清洗 (Python)", "结构化转换 (Python)",
            "知识检索 (ChromaDB)", "代码生成 (LLM)", "测试验证 (AST+LLM)",
        ]

        class PipelineCallback:
            def __init__(self, rid):
                self.rid = rid
                self.current = 0

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
            {"figma_raw": figma_raw, "framework": req.framework, "componentLib": req.componentLib},
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


@router.get("/api/pipeline/run/{run_id}")
async def get_pipeline_run(run_id: str):
    run = pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
