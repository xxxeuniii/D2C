import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";
    const response = await fetch(`${backendUrl}/api/figma/config`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Figma Config] Error:", error);
    return NextResponse.json({ figmaToken: null });
  }
}
