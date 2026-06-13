"""
流水线 API 路由

端点：
- POST /api/pipeline/run       Simple Chain 模式
- WS   /api/pipeline/ws/{run_id}  WebSocket 实时推送
"""
import re
import json
import time
import asyncio
import threading
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from models import PipelineRunRequest
from pydantic import BaseModel
from agents.pipeline import create_pipeline, create_agent_pipeline
from agents.orchestrator import get_orchestrator

router = APIRouter()

# WebSocket 连接池
_ws_connections: Dict[str, WebSocket] = {}


def _push_ws_sync(run_id: str, data: dict):
    """向 WebSocket 推送消息（同步版，供后台线程调用）"""
    ws = _ws_connections.get(run_id)
    if ws:
        try:
            # 用 asyncio.run 在线程中发送
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(ws.send_json(data))
            loop.close()
        except Exception:
            pass


@router.websocket("/api/pipeline/ws/{run_id}")
async def ws_pipeline(ws: WebSocket, run_id: str):
    """WebSocket 实时推送流水线进度"""
    await ws.accept()
    _ws_connections[run_id] = ws
    try:
        while True:
            await ws.receive_text()  # 保持连接
    except WebSocketDisconnect:
        pass
    finally:
        _ws_connections.pop(run_id, None)

# 内存存储运行状态
pipeline_runs: Dict[str, Dict[str, Any]] = {}


def _fetch_figma_data(url: str, figma_token: str) -> str:
    """获取 Figma 原始数据（优先使用缓存避免 API 频率限制）"""
    import urllib.request
    import urllib.error
    import ssl
    import os

    match = re.search(r"figma\.com/(?:file|design|proto)/([a-zA-Z0-9]+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Figma URL")

    from config import FIGMA_TOKEN

    token = figma_token or FIGMA_TOKEN
    file_key = match.group(1)
    api_url = f"https://api.figma.com/v1/files/{file_key}?depth=3"

    # 优先使用缓存
    from config import CHROMA_PATH
    cache_file = os.path.join(CHROMA_PATH, f"figma_cache_{file_key}.json")
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return f.read()

    req = urllib.request.Request(api_url, headers={"X-Figma-Token": token})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=f"Figma API error: {e.read().decode()}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Figma API request failed: {e}")

    # 缓存到本地
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            f.write(raw)
    except Exception:
        pass

    data = json.loads(raw)
    return json.dumps(data, ensure_ascii=False)


# ============================================
# Simple Chain 模式
# ============================================

@router.post("/api/pipeline/run")
async def run_pipeline(req: PipelineRunRequest):
    """运行 Simple Chain 流水线（后台异步，通过 /run/{run_id} 查询进度）"""
    import threading

    run_id = f"pipe_{int(time.time())}"
    pipeline_runs[run_id] = {
        "id": run_id, "status": "running", "steps": [],
        "url": req.url, "framework": req.framework,
        "componentLib": req.componentLib, "mode": "simple",
    }

    agent_names = [
        "获取 Figma 原始数据",
        "数据清洗 (Python + LLM增强)",
        "结构化转换 (Python + LLM增强)",
        "知识检索 (ChromaDB)",
        "代码生成 (LLM)",
        "测试验证 (AST+LLM)",
    ]

    def _run_background():
        def _push(data: dict):
            pipeline_runs[run_id]["steps"] = data.get("steps", pipeline_runs[run_id]["steps"])
            _push_ws_sync(run_id, {"type": "progress", "steps": data["steps"]})

        def _update_step(idx: int, status: str, output: str = "", extra: dict = None):
            """更新步骤并推送"""
            step = dict(pipeline_runs[run_id]["steps"][idx])
            step["status"] = status
            if output:
                step["output"] = output
            if extra:
                step.update(extra)
            pipeline_runs[run_id]["steps"][idx] = step
            _push({"steps": list(pipeline_runs[run_id]["steps"])})

        try:
            # Step 0: 获取 Figma 数据
            _update_step(0, "running")
            figma_raw = _fetch_figma_data(req.url, req.figmaToken)
            # 解析节点树信息
            try:
                figma_obj = json.loads(figma_raw)
                doc = figma_obj.get("document", {})
                def count_nodes(node, depth=0):
                    if depth > 10: return 0
                    c = 1
                    for child in node.get("children", []):
                        c += count_nodes(child, depth + 1)
                    return c
                total_nodes = count_nodes(doc)
                figma_info = {
                    "fileName": figma_obj.get("name", ""),
                    "totalNodes": total_nodes,
                    "pages": len(doc.get("children", [])),
                    "tree": doc,
                }
            except Exception:
                figma_info = {"fileName": "Unknown", "totalNodes": 0, "pages": 0, "tree": {}}
            _update_step(0, "completed",
                f"获取到 {len(figma_raw)} 字符，{figma_info['totalNodes']} 个节点",
                {"figmaData": figma_info})

            # Step 1-5: 复用 create_pipeline() 链
            pipeline_chain = create_pipeline()
            result = pipeline_chain.invoke({
                "figma_raw": figma_raw,
                "framework": req.framework,
                "componentLib": req.componentLib,
            })

            # 同步步骤状态
            agent_outputs = [
                (1, f"清洗完成"),
                (2, f"转换完成"),
                (3, "知识检索完成"),
                (4, f"代码生成完成，{len(result.get('generated_code', ''))} 字符"),
                (5, "验证完成"),
            ]
            for idx, output in agent_outputs:
                _update_step(idx, "completed", output)

            code = result.get("generated_code", "")
            validation = result.get("validation_result", "")
            pipeline_runs[run_id]["status"] = "completed"
            pipeline_runs[run_id]["result"] = {"code": code, "validation": validation}
            _push_ws_sync(run_id, {"type": "done", "steps": list(pipeline_runs[run_id]["steps"]),
                                "result": pipeline_runs[run_id]["result"]})
        except Exception as e:
            pipeline_runs[run_id]["status"] = "error"
            pipeline_runs[run_id]["error"] = str(e)
            _push_ws_sync(run_id, {"type": "error", "error": str(e)})

    # 先添加初始步骤（Figma 数据获取在后台线程中执行）
    pipeline_runs[run_id]["steps"].append({
        "agent": 0, "name": agent_names[0], "status": "running",
        "output": "正在获取 Figma 数据...",
    })

    # 添加占位步骤
    for i in range(1, 6):
        pipeline_runs[run_id]["steps"].append({
            "agent": i, "name": f"Agent {i}: {agent_names[i]}",
            "status": "pending",
        })

    # 后台线程执行
    t = threading.Thread(target=_run_background, daemon=True)
    t.start()

    return {
        "runId": run_id, "status": "running",
        "steps": pipeline_runs[run_id]["steps"],
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
            figma_raw, req.framework, req.componentLib, run_id,
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
    session_id: str = ""  # 可选：会话 ID，用于多会话隔离


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
    
    session_id 用于隔离不同用户的会话。
    """
    orchestrator = get_orchestrator()

    result = await asyncio.to_thread(
        orchestrator.chat, req.message, session_id=req.session_id or req.run_id,
    )

    return result


@router.post("/api/pipeline/chat/reset")
async def reset_chat(session_id: str = ""):
    """
    重置指定会话的 Chat Agent 的 Memory。
    清空对话历史，开始新的修改会话。
    """
    orchestrator = get_orchestrator()
    orchestrator.reset_chat(session_id=session_id or None)
    return {"status": "ok", "message": "Chat Memory 已重置", "session_id": session_id}


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
