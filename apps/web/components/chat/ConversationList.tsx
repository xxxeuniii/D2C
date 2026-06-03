"use client";

import { cn } from "@/lib/utils/cn";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Conversation } from "@/types";
import { formatRelativeTime } from "@/lib/utils/format";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete?: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Conversations
        </h3>
        <button
          onClick={onCreate}
          className="rounded-md p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-primary transition-colors"
          title="New Conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto py-1">
        {conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-text-tertiary">
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "group mx-2 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                  isActive
                    ? "bg-brand-primary/10 text-text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                )}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{conv.title}</p>
                  <p className="text-xs text-text-tertiary">
                    {formatRelativeTime(conv.createdAt)}
                  </p>
                </div>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="rounded p-0.5 text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-status-error transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
