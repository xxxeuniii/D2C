"use client";

import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useChatStore } from "@/lib/store/chatStore";
import { useEffect } from "react";

export default function ChatPage() {
  const { conversations, activeConversationId, setActiveConversation, createConversation } =
    useChatStore();

  // 如果没有任何对话，自动创建一个
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation("新对话");
    }
  }, [conversations.length, createConversation]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation List Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-border">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={setActiveConversation}
          onCreate={() => createConversation("新对话")}
        />
      </div>

      {/* Chat Window */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
