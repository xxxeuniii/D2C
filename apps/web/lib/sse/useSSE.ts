import { useRef, useCallback, useState } from "react";

interface UseSSEOptions {
  url: string;
  onMessage: (data: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

interface UseSSEReturn {
  start: (body?: any) => Promise<void>;
  stop: () => void;
  isStreaming: boolean;
}

export function useSSE({
  url,
  onMessage,
  onDone,
  onError,
}: UseSSEOptions): UseSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    async (body?: any) => {
      stop();

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsStreaming(true);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No readable stream available");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setIsStreaming(false);
            onDone?.();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          // 按行分割 SSE 事件
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();

            // 跳过空行和注释
            if (!trimmed || trimmed.startsWith(":")) continue;

            // 解析 data: 字段
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6).trim();

              // 检查结束标志
              if (data === "[DONE]") {
                setIsStreaming(false);
                onDone?.();
                return;
              }

              onMessage(data);
            }

            // 解析 event: 字段
            if (trimmed.startsWith("event: ")) {
              const event = trimmed.slice(7).trim();
              if (event === "done" || event === "error") {
                setIsStreaming(false);
                onDone?.();
                return;
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // 用户手动停止，不需要处理
          setIsStreaming(false);
          return;
        }

        setIsStreaming(false);
        const err = error instanceof Error ? error : new Error("Unknown SSE error");
        onError?.(err);
      }
    },
    [url, onMessage, onDone, onError, stop]
  );

  return { start, stop, isStreaming };
}
