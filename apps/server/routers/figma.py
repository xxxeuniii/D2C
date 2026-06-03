"""
Figma API 路由
"""
import re
import time
from fastapi import APIRouter, HTTPException
from models import PipelineRunRequest

router = APIRouter()


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
    import httpx
    from config import SILICONFLOW_API_KEY

    match = re.search(r"figma\.com/(?:file|design)/([a-zA-Z0-9]+)", req.url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Figma URL")

    figma_token = req.figmaToken or SILICONFLOW_API_KEY
    resp = httpx.get(
        f"https://api.figma.com/v1/files/{match.group(1)}?depth=2",
        headers={"X-Figma-Token": figma_token}, timeout=30,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    return {
        "taskId": f"task_{int(time.time())}",
        "status": "completed",
        "url": req.url,
        "framework": req.framework,
        "previewUrl": f"https://www.figma.com/file/{match.group(1)}",
        "nodes": _extract_nodes(data.get("document", {})),
        "metadata": {"fileName": data.get("name", "")},
    }
