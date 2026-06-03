"use client";

import { cn } from "@/lib/utils/cn";
import { ToolCall } from "@/types";
import { Wrench, Code2, Search, Globe, Terminal, FileText } from "lucide-react";

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  read_file: FileText,
  write_file: Code2,
  search: Search,
  web_fetch: Globe,
  execute_command: Terminal,
  default: Wrench,
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const Icon = toolIcons[toolCall.name] || toolIcons.default;

  return (
    <div className="rounded-lg border border-border bg-bg-base overflow-hidden">
      {/* Tool header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <Icon className="h-3.5 w-3.5 text-brand-secondary" />
        <span className="text-xs font-medium text-text-secondary">
          {toolCall.name}
        </span>
        {toolCall.status === "running" ? (
          <span className="ml-auto text-xs text-status-info animate-pulse">
            Running...
          </span>
        ) : toolCall.status === "error" ? (
          <span className="ml-auto text-xs text-status-error">Error</span>
        ) : (
          <span className="ml-auto text-xs text-status-success">Done</span>
        )}
      </div>

      {/* Input / Output */}
      <div className="px-3 py-2">
        {toolCall.input && (
          <div className="mb-1.5">
            <span className="text-xs font-medium text-text-tertiary">Input:</span>
            <pre className="mt-0.5 overflow-auto rounded bg-bg-elevated p-2 text-xs text-text-secondary font-mono">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
        )}
        {toolCall.output && (
          <div>
            <span className="text-xs font-medium text-text-tertiary">Output:</span>
            <pre className="mt-0.5 overflow-auto rounded bg-bg-elevated p-2 text-xs text-text-secondary font-mono max-h-32">
              {typeof toolCall.output === "string"
                ? toolCall.output
                : JSON.stringify(toolCall.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
