"""
Figma API 路由
"""
import re
import time
from fastapi import APIRouter, HTTPException
from config import FIGMA_TOKEN
from models import PipelineRunRequest

router = APIRouter()


@router.get("/api/figma/config")
async def figma_config():
    """返回 Figma Token 配置（供前端自动获取）"""
    return {"figmaToken": FIGMA_TOKEN or None}


def _extract_nodes(node: dict, depth: int = 0) -> list:
    if depth > 3:
        return []
    result = []
    for child in node.get("children", [])[:30]:
        item = {"id": child.get("id", ""), "name": child.get("name", ""), "type": child.get("type", "")}
        if child.get("children"):
            item["children"] = _extract_nodes(child, depth + 1)
        result.append(item)
    return result


@router.post("/api/figma/analyze")
async def figma_analyze(req: PipelineRunRequest):
    import json
    import urllib.request
    import ssl
    import urllib.error

    match = re.search(r"figma\.com/(?:file|design|proto)/([a-zA-Z0-9]+)", req.url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Figma URL")

    figma_token = req.figmaToken or FIGMA_TOKEN
    file_key = match.group(1)
    api_url = f"https://api.figma.com/v1/files/{file_key}?depth=2"

    req_obj = urllib.request.Request(api_url, headers={"X-Figma-Token": figma_token})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req_obj, timeout=30, context=ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=f"Figma API error: {e.read().decode()}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Figma API request failed: {e}")

    return {
        "taskId": f"task_{int(time.time())}",
        "status": "completed",
        "url": req.url,
        "framework": req.framework,
        "previewUrl": f"https://www.figma.com/file/{file_key}",
        "nodes": _extract_nodes(data.get("document", {})),
        "metadata": {"fileName": data.get("name", "")},
    }
