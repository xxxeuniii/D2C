"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Check, Copy, Code2, FileCode } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    // TODO: 插入到编辑器逻辑
    console.log("Insert code to editor");
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between bg-bg-elevated px-4 py-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-text-tertiary" />
          {filename ? (
            <span className="text-xs text-text-secondary">{filename}</span>
          ) : (
            <span className="text-xs text-text-tertiary uppercase">
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleInsert}
            className="rounded px-2 py-0.5 text-xs text-text-tertiary hover:bg-bg-surface hover:text-text-secondary transition-colors"
            title="Insert to editor"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              "rounded px-2 py-0.5 text-xs transition-colors",
              copied
                ? "text-status-success"
                : "text-text-tertiary hover:bg-bg-surface hover:text-text-secondary"
            )}
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="overflow-auto bg-[#1E1E2E] p-4">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-mono)",
            lineHeight: "1.6",
          }}
          codeTagProps={{
            style: {
              fontFamily: "inherit",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
