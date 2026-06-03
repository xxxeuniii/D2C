"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";
import { Send, Square, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整 textarea 高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  const handleSend = () => {
    if (!value.trim() || disabled || isStreaming) return;
    onSend(value.trim());
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter 发送
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    // Enter 换行（不发送）
  };

  return (
    <div className="flex items-end gap-2">
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Select a conversation..." : "Type a message... (Cmd+Enter to send)"}
          disabled={disabled}
          rows={1}
          className={cn(
            "w-full resize-none rounded-xl bg-bg-base border border-border px-4 py-2.5 text-sm text-text-primary",
            "placeholder:text-text-tertiary",
            "focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20",
            "transition-colors duration-150",
            "max-h-[200px]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      </div>

      <div className="flex items-center gap-1">
        {/* 文件上传按钮 */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
          title="Attach file"
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* 发送/停止按钮 */}
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-error/10 text-status-error hover:bg-status-error/20 transition-colors"
            title="Stop generating"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
              value.trim() && !disabled
                ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
                : "bg-bg-elevated text-text-tertiary cursor-not-allowed"
            )}
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
