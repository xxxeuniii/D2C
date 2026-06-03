import { client } from "./client";

export interface ChatMessagePayload {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SendMessageParams {
  messages: ChatMessagePayload[];
  conversationId?: string;
}

export async function sendChatMessage(
  params: SendMessageParams,
  onChunk?: (chunk: string) => void,
  onDone?: () => void,
  onError?: (error: Error) => void
): Promise<AbortController> {
  const controller = new AbortController();

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          onDone?.();
          return controller;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            onChunk?.(parsed.content);
          }
        } catch {
          // 如果不是 JSON，直接作为文本
          onChunk?.(data);
        }
      }
    }

    onDone?.();
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      onError?.(error as Error);
    }
  }

  return controller;
}
