"use client";

import { useRef, useEffect } from "react";
import { useChatStore } from "@/lib/store/chatStore";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { useChat } from "@/hooks/useChat";

export function ChatWindow() {
  const { activeConversationId, messages: allMessages, isStreaming } = useChatStore();
  const { sendMessage, stopStreaming } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = activeConversationId
    ? allMessages[activeConversationId] || []
    : [];

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = (content: string) => {
    if (!activeConversationId || !content.trim()) return;
    sendMessage(content);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
              <svg
                className="h-8 w-8 text-brand-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              Start a conversation
            </h2>
            <p className="mt-2 max-w-md text-sm text-text-tertiary">
              Describe your design requirements or paste a Figma link to get started.
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            <MessageList messages={messages} />
            {isStreaming && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border bg-bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <ChatInput
            onSend={handleSend}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            disabled={!activeConversationId}
          />
        </div>
      </div>
    </div>
  );
}
