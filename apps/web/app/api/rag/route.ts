import { NextRequest, NextResponse } from "next/server";

// BFF: 转发 RAG 请求到后端 ChromaDB 服务
const RAG_BACKEND = process.env.RAG_BACKEND_URL || "http://localhost:8080";

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${RAG_BACKEND}/api/rag/documents`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[RAG BFF] GET Error:", error);
    return NextResponse.json({ documents: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // 文件上传
      const formData = await req.formData();
      const response = await fetch(`${RAG_BACKEND}/api/rag/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // 搜索查询
      const body = await req.json();
      const response = await fetch(`${RAG_BACKEND}/api/rag/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("[RAG BFF] POST Error:", error);
    return NextResponse.json(
      { error: "RAG service error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const docId = pathParts[pathParts.length - 1];

    await fetch(`${RAG_BACKEND}/api/rag/documents/${docId}`, {
      method: "DELETE",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RAG BFF] DELETE Error:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
