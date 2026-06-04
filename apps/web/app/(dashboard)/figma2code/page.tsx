"use client";

import { useState, useEffect } from "react";
import { FigmaImporter } from "@/components/figma/FigmaImporter";
import { CodePreview } from "@/components/figma/CodePreview";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { useRAGStore } from "@/lib/store/ragStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, BookOpen, X, Loader2, CheckCircle2, Circle, ArrowDown, Sparkles } from "lucide-react";
import { client } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

export default function Figma2CodePage() {
  const { analysis, figmaToken, setFigmaToken, isLoading, steps, error } = useFigmaStore();
  const { documents } = useRAGStore();
  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState(figmaToken || "");

  // 页面加载时从后端获取 Figma Token
  useEffect(() => {
    if (figmaToken) return;
    client.get("/figma/config").then((res) => {
      if (res.data?.figmaToken) {
        setFigmaToken(res.data.figmaToken);
        setTokenInput(res.data.figmaToken);
      }
    }).catch(() => {});
  }, []);

  const hasAnalysis = analysis && analysis.nodes;
  const linkedDocs = documents.filter((d) => d.status === "ready");

  return (
    <div className="flex h-full overflow-hidden">
      {!hasAnalysis && !isLoading && !error && (
        /* === 输入阶段 === */
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-lg">
            {!figmaToken ? (
              <div className="mb-6 rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <Key className="mt-0.5 h-5 w-5 text-status-warning flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-status-warning">需要配置 Figma Token</h3>
                    <p className="mt-1 text-xs text-text-secondary">请配置 Figma Personal Access Token 以访问设计文件</p>
                    <button onClick={() => setShowSettings(true)} className="mt-2 text-xs text-brand-primary hover:text-brand-primary-hover transition-colors">配置 Token →</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 flex items-center gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-status-success" />Token 已配置</span>
                {linkedDocs.length > 0 && <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />已加载 {linkedDocs.length} 份设计规范</span>}
                <button onClick={() => setShowSettings(true)} className="ml-auto flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors"><Settings className="h-3.5 w-3.5" />设置</button>
              </div>
            )}
            <FigmaImporter />
            {showSettings && (
              <div className="mt-6 animate-slide-up rounded-lg border border-border bg-bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text-primary flex items-center gap-2"><Settings className="h-4 w-4" />设置</h3>
                  <button onClick={() => setShowSettings(false)} className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">Figma Personal Access Token</label>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="figd_..." value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} className="flex-1 font-mono text-xs" />
                      <Button size="sm" onClick={() => { setFigmaToken(tokenInput); setShowSettings(false); }} disabled={!tokenInput.trim()}>保存</Button>
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary">从 Figma → Settings → Personal Access Tokens 获取 Token</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === 运行中 / 错误 / 结果阶段 === */}
      {(isLoading || steps.length > 0 || error || hasAnalysis) && (
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧步骤面板 */}
          <div className="w-80 flex-shrink-0 border-r border-border bg-bg-surface flex flex-col">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-primary" />
                Agent 流水线
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-1">
              {steps.length === 0 && isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="text-sm">正在启动流水线...</p>
                </div>
              )}
              {steps.map((step, i) => (
                <div key={i}>
                  <div className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all",
                    step.status === "completed" ? "bg-status-success/5 border border-status-success/20" : "bg-bg-base border border-border/50"
                  )}>
                    {step.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-text-tertiary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{step.name}</p>
                      {step.output && (
                        <p className="text-xs text-text-tertiary truncate mt-0.5">{step.output}</p>
                      )}
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-3 w-3 text-text-tertiary/40" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && steps.length > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm bg-status-info/5 border border-status-info/20 mt-1">
                  <Loader2 className="h-4 w-4 text-status-info animate-spin flex-shrink-0" />
                  <p className="text-xs text-status-info">处理中...</p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧主区域 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {error && (
              <div className="border-b border-status-error/20 bg-status-error/5 px-4 py-3">
                <p className="text-sm font-medium text-status-error">流水线错误</p>
                <p className="text-xs text-status-error mt-1">{error}</p>
              </div>
            )}
            {hasAnalysis ? (
              <div className="flex-1 overflow-hidden">
                <CodePreview />
              </div>
            ) : isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-primary mb-4" />
                  <p className="text-sm text-text-secondary">Agent 流水线运行中...</p>
                  <p className="text-xs text-text-tertiary mt-1">5 个 Agent 正在协同工作，预计需要 30-60 秒</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
