import { create } from "zustand";
import { Message, Conversation } from "@/types";
import { generateId } from "@/lib/utils/format";

interface ChatState {
  // 对话列表
  conversations: Conversation[];
  activeConversationId: string | null;

  // 消息（按 conversationId 分组）
  messages: Record<string, Message[]>;

  // 流式输出状态
  isStreaming: boolean;

  // Actions
  setActiveConversation: (id: string) => void;
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateLastMessage: (conversationId: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isStreaming: false,

  setActiveConversation: (id: string) => {
    set({ activeConversationId: id });
  },

  createConversation: (title?: string) => {
    const id = generateId();
    const conversation: Conversation = {
      id,
      title: title || "New Conversation",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      messages: { ...state.messages, [id]: [] },
      activeConversationId: id,
    }));
    return id;
  },

  deleteConversation: (id: string) => {
    set((state) => {
      const { [id]: _, ...restMessages } = state.messages;
      const newConversations = state.conversations.filter((c) => c.id !== id);
      return {
        conversations: newConversations,
        messages: restMessages,
        activeConversationId:
          state.activeConversationId === id
            ? newConversations[0]?.id || null
            : state.activeConversationId,
      };
    });
  },

  addMessage: (conversationId: string, message: Message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [
          ...(state.messages[conversationId] || []),
          message,
        ],
      },
    }));
  },

  updateLastMessage: (conversationId: string, content: string) => {
    set((state) => {
      const msgs = state.messages[conversationId] || [];
      if (msgs.length === 0) return state;
      const updated = [...msgs];
      const last = { ...updated[updated.length - 1], content };
      updated[updated.length - 1] = last;
      return {
        messages: { ...state.messages, [conversationId]: updated },
      };
    });
  },

  setStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },

  clearMessages: (conversationId: string) => {
    set((state) => ({
      messages: { ...state.messages, [conversationId]: [] },
    }));
  },
}));
