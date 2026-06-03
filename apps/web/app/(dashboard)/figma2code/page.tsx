"use client";

import { useState, useEffect } from "react";
import { FigmaImporter } from "@/components/figma/FigmaImporter";
import { CodePreview } from "@/components/figma/CodePreview";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { useRAGStore } from "@/lib/store/ragStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, BookOpen, X } from "lucide-react";

export default function Figma2CodePage() {
  const { analysis, figmaToken, setFigmaToken } = useFigmaStore();
  const { documents } = useRAGStore();
  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState(figmaToken || "");

  const hasAnalysis = analysis && analysis.nodes;

  // 获取关联的规范文档
  const linkedDocs = documents.filter((d) => d.status === "ready");

  return (
    <div className="flex h-full overflow-hidden">
      {!hasAnalysis ? (
        /* === Import Stage === */
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-lg">
            {/* Token 状态提示 */}
            {!figmaToken ? (
              <div className="mb-6 rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <Key className="mt-0.5 h-5 w-5 text-status-warning flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-status-warning">
                      Figma Token Required
                    </h3>
                    <p className="mt-1 text-xs text-text-secondary">
                      Please configure your Figma Personal Access Token to access design files.
                    </p>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="mt-2 text-xs text-brand-primary hover:text-brand-primary-hover transition-colors"
                    >
                      Configure Token →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 flex items-center gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-success" />
                  Token configured
                </span>
                {linkedDocs.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    {linkedDocs.length} design specs loaded
                  </span>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="ml-auto flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>
              </div>
            )}

            <FigmaImporter />

            {/* Settings Panel */}
            {showSettings && (
              <div className="mt-6 animate-slide-up rounded-lg border border-border bg-bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Figma Personal Access Token
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="figd_..."
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          setFigmaToken(tokenInput);
                          setShowSettings(false);
                        }}
                        disabled={!tokenInput.trim()}
                      >
                        Save
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary">
                      Get token from Figma → Settings → Personal Access Tokens
                    </p>
                  </div>

                  {linkedDocs.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Active Design Specs
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {linkedDocs.map((doc) => (
                          <Badge key={doc.id} variant="success" className="text-xs">
                            {doc.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* === Result Stage === */
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodePreview />
          </div>
        </div>
      )}
    </div>
  );
}
