import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, framework, componentLib, figmaToken } = body;

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";

    const response = await fetch(`${backendUrl}/api/figma/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, framework, componentLib, figmaToken: figmaToken || "" }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Figma Analyze BFF] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
