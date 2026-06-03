import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, conversationId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";

    // 转发请求到后端 SSE 服务
    const response = await fetch(`${backendUrl}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(conversationId && { "X-Conversation-Id": conversationId }),
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Backend service error" }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 透传 SSE 流
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": response.headers.get("X-Conversation-Id") || "",
      },
    });
  } catch (error) {
    console.error("[Chat Stream BFF] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
