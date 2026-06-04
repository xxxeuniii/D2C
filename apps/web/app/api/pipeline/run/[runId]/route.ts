import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";
    const response = await fetch(
      `${backendUrl}/api/pipeline/run/${params.runId}`
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Pipeline Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
