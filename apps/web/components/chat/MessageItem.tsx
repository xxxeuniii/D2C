"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { Message } from "@/types";
import { CodeBlock } from "./CodeBlock";
import { User, Bot, Copy, Check } from "lucide-react";
import { formatTime } from "@/lib/utils/format";

interface MessageItemProps {
  message: Message;
  isLast: boolean;
}

export function MessageItem({ message, isLast }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 简单的 Markdown 解析：分离文本和代码块
  const parsedContent = useMemo(() => {
    const parts: { type: "text" | "code"; content: string; language?: string }[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(message.content)) !== null) {
      // 代码块之前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: message.content.slice(lastIndex, match.index),
        });
      }
      // 代码块
      parts.push({
        type: "code",
        language: match[1] || "plaintext",
        content: match[2].trim(),
      });
      lastIndex = match.index + match[0].length;
    }

    // 剩余文本
    if (lastIndex < message.content.length) {
      parts.push({
        type: "text",
        content: message.content.slice(lastIndex),
      });
    }

    return parts;
  }, [message.content]);

  // 渲染内联 Markdown（简单处理）
  const renderText = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
        if (!line.trim()) return <br key={i} />;

        // 标题
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-semibold text-text-primary mt-4 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-semibold text-text-primary mt-4 mb-1">
              {line.slice(3)}
            </h2>
          );
        }

        // 列表
        if (line.match(/^[\s]*[-*]\s/)) {
          return (
            <li key={i} className="ml-4 text-text-secondary list-disc">
              {renderInline(line.replace(/^[\s]*[-*]\s/, ""))}
            </li>
          );
        }

        // 引用
        if (line.startsWith("> ")) {
          return (
            <blockquote key={i} className="border-l-2 border-brand-primary/30 pl-3 text-text-tertiary my-1">
              {renderInline(line.slice(2))}
            </blockquote>
          );
        }

        return (
          <p key={i} className="mb-1">
            {renderInline(line)}
          </p>
        );
      });
  };

  // 内联样式（粗体、代码等）
  const renderInline = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="rounded bg-brand-primary/10 px-1 py-0.5 text-xs text-brand-primary font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-brand-primary/20 text-brand-primary"
            : "bg-bg-elevated text-text-secondary"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0",
          isUser ? "flex flex-col items-end" : ""
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            "max-w-[85%] rounded-xl px-4 py-3",
            isUser
              ? "bg-brand-primary text-white rounded-br-md"
              : "bg-bg-surface border border-border text-text-primary rounded-bl-md"
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <div className="markdown-body text-sm">
              {parsedContent.map((part, i) =>
                part.type === "code" ? (
                  <CodeBlock
                    key={i}
                    code={part.content}
                    language={part.language || "plaintext"}
                  />
                ) : (
                  <div key={i}>{renderText(part.content)}</div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer: time + copy button */}
        {!isUser && (
          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="text-xs text-text-tertiary">
              {formatTime(message.createdAt)}
            </span>
            <button
              onClick={handleCopy}
              className="rounded p-0.5 text-text-tertiary hover:text-text-secondary transition-colors"
              title="Copy message"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-status-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
