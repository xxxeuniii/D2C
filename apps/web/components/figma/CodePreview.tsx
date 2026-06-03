"use client";

import { useState, useMemo } from "react";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { cn } from "@/lib/utils/cn";
import { Copy, Download, Check, Code2, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";

// 动态导入 Monaco Editor（仅客户端）
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#1E1E2E] text-text-tertiary">
        <p className="text-sm">Loading editor...</p>
      </div>
    ),
  }
);

export function CodePreview() {
  const { analysis } = useFigmaStore();
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const files = useMemo(() => {
    if (!analysis?.generatedCode) return [];
    if (typeof analysis.generatedCode === "string") {
      return [{ name: "index.tsx", code: analysis.generatedCode, language: "tsx" }];
    }
    if (Array.isArray(analysis.generatedCode)) {
      return analysis.generatedCode.map((f: any, i: number) => ({
        name: f.name || `component_${i + 1}.tsx`,
        code: typeof f === "string" ? f : f.code || "",
        language: f.language || "tsx",
      }));
    }
    return Object.entries(analysis.generatedCode).map(([name, code]) => ({
      name,
      code: code as string,
      language: name.endsWith(".css")
        ? "css"
        : name.endsWith(".ts")
          ? "typescript"
          : "tsx",
    }));
  }, [analysis?.generatedCode]);

  const currentFile = files[activeTab];
  const totalLines = currentFile
    ? currentFile.code.split("\n").length
    : 0;

  const handleCopy = async () => {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-1">
          <Code2 className="h-3.5 w-3.5 text-text-tertiary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Code
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-status-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {files.length > 1 && (
        <div className="flex border-b border-border bg-bg-base">
          {files.map((file, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                "border-r border-border px-3 py-1.5 text-xs transition-colors",
                activeTab === i
                  ? "bg-bg-surface text-text-primary border-b-2 border-b-brand-primary"
                  : "text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary"
              )}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {currentFile ? (
          <MonacoEditor
            height="100%"
            language={currentFile.language}
            value={currentFile.code}
            theme="vs-dark"
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12 },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#1E1E2E] text-text-tertiary">
            <div className="text-center">
              <Code2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No generated code yet</p>
              <p className="text-xs mt-1">
                Import a Figma design to generate code
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-bg-surface px-3 py-1">
        <span className="text-xs text-text-tertiary">
          {currentFile ? `${currentFile.language.toUpperCase()} · ${totalLines} lines` : "No file"}
        </span>
        <button
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          title="Apply to project"
        >
          <ExternalLink className="h-3 w-3" />
          Apply to project
        </button>
      </div>
    </div>
  );
}
