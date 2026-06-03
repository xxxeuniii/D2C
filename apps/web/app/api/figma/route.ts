import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, framework, componentLib } = body;

    if (!url) {
      return NextResponse.json({ error: "Figma URL is required" }, { status: 400 });
    }

    // 验证 Figma URL 格式
    const figmaUrlPattern = /^https?:\/\/(www\.)?figma\.com\/(file|design)\/.+/;
    if (!figmaUrlPattern.test(url)) {
      return NextResponse.json(
        { error: "Invalid Figma URL format" },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";

    // 转发请求到后端 Figma 解析服务
    const response = await fetch(`${backendUrl}/api/figma/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, framework, componentLib }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Figma analysis failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Figma BFF] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";

    const response = await fetch(
      `${backendUrl}/api/figma/status?taskId=${taskId}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get task status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Figma BFF] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
