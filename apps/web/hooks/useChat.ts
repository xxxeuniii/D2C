"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/lib/store/chatStore";
import { useSSE } from "@/lib/sse/useSSE";
import { Message } from "@/types";
import { generateId } from "@/lib/utils/format";

export function useChat() {
  const {
    activeConversationId,
    messages,
    addMessage,
    updateLastMessage,
    setStreaming,
  } = useChatStore();

  const pendingContentRef = useRef("");

  const { start, stop, isStreaming } = useSSE({
    url: "/api/chat/stream",
    onMessage: (data: string) => {
      try {
        // 尝试解析 JSON
        const parsed = JSON.parse(data);
        if (parsed.content) {
          pendingContentRef.current += parsed.content;
          if (activeConversationId) {
            updateLastMessage(activeConversationId, pendingContentRef.current);
          }
        }
      } catch {
        // 纯文本流
        pendingContentRef.current += data;
        if (activeConversationId) {
          updateLastMessage(activeConversationId, pendingContentRef.current);
        }
      }
    },
    onDone: () => {
      setStreaming(false);
    },
    onError: (error: Error) => {
      console.error("[useChat] SSE error:", error);
      setStreaming(false);
    },
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || !content.trim()) return;

      // 添加用户消息
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      addMessage(activeConversationId, userMessage);

      // 添加空的 assistant 消息（流式填充）
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      addMessage(activeConversationId, assistantMessage);
      pendingContentRef.current = "";

      setStreaming(true);

      // 构建消息历史
      const conversationMessages = messages[activeConversationId] || [];
      const allMessages = [
        ...conversationMessages,
        userMessage,
      ];

      // 启动 SSE
      await start({
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        conversationId: activeConversationId,
      });
    },
    [activeConversationId, messages, addMessage, start, setStreaming]
  );

  const stopStreaming = useCallback(() => {
    stop();
    setStreaming(false);
  }, [stop, setStreaming]);

  return {
    sendMessage,
    stopStreaming,
    isStreaming,
  };
}
