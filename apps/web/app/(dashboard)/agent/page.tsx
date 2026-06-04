"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentSteps } from "@/components/agent/AgentSteps";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  Play, RefreshCw, Link, Wrench, Eraser, GitBranch, Database, Code2, ShieldCheck, ArrowDown,
} from "lucide-react";

const AGENTS = [
  { num: 1, name: "数据清洗", icon: Eraser, color: "text-orange-400", desc: "去版本号/隐藏层/冗余字段" },
  { num: 2, name: "结构化转换", icon: GitBranch, color: "text-blue-400", desc: "Figma JSON → 组件 DSL" },
  { num: 3, name: "知识检索", icon: Database, color: "text-purple-400", desc: "RAG 匹配组件库文档" },
  { num: 4, name: "代码生成", icon: Code2, color: "text-green-400", desc: "DSL + 文档 → 页面代码" },
  { num: 5, name: "测试验证", icon: ShieldCheck, color: "text-red-400", desc: "AST 检查 + 编译验证" },
];

const DEFAULT_FIGMA_URL = "https://www.figma.com/design/dEDv2fBxzJ9Gbsbhv2XSZP/Untitled?node-id=0-1&p=f&t=b5hI6no6Iv5Kzydx-0";

export default function AgentPage() {
  const [url, setUrl] = useState(DEFAULT_FIGMA_URL);
  const [framework, setFramework] = useState<"react" | "vue2" | "nextjs">("react");
  const [componentLib, setComponentLib] = useState<"element-plus" | "antd" | "shadcn">("element-plus");
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [result, setResult] = useState<any>();
  const [error, setError] = useState<string | undefined>();

  const runPipeline = useCallback(async () => {
    if (!url.trim() || isRunning) return;
    setIsRunning(true);
    setSteps([]);
    setResult(undefined);
    setError(undefined);

    try {
      const response = await client.post("/pipeline/run", {
        url: url.trim(), framework, componentLib,
      });
      const data = response.data;
      setSteps(data.steps || []);
      setResult(data.result);
      if (data.status === "error") setError(data.error);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "流水线执行失败");
    } finally {
      setIsRunning(false);
    }
  }, [url, framework, componentLib, isRunning]);

  const isValidUrl = url.trim().match(/^https?:\/\/(www\.)?figma\.com\/(file|design|proto)\/.+/);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="border-b border-border px-4 py-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Wrench className="h-4 w-4 text-brand-primary" />
            多 Agent 流水线
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">
            5 个 Agent 协同: 清洗 → 结构化 → 检索 → 生成 → 验证
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* URL */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Figma 链接</label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input placeholder="https://www.figma.com/file/..." value={url}
                onChange={(e) => setUrl(e.target.value)} className="pl-10 font-mono text-xs" disabled={isRunning} />
            </div>
          </div>

          {/* Framework */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">目标框架</label>
            <div className="flex gap-2">
              {(["react", "vue2", "nextjs"] as const).map((fw) => (
                <button key={fw} onClick={() => setFramework(fw)} disabled={isRunning}
                  className={cn("flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                    framework === fw ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
                      : "border-border bg-bg-base text-text-secondary hover:border-border-strong")}>
                  {fw === "nextjs" ? "Next.js" : fw === "vue2" ? "Vue 2" : "React"}
                </button>
              ))}
            </div>
          </div>

          {/* Component Library */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">组件库</label>
            <div className="flex gap-2">
              {(["element-plus", "antd", "shadcn"] as const).map((lib) => (
                <button key={lib} onClick={() => setComponentLib(lib)} disabled={isRunning}
                  className={cn("flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                    componentLib === lib ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
                      : "border-border bg-bg-base text-text-secondary hover:border-border-strong")}>
                  {lib === "element-plus" ? "Element+" : lib === "antd" ? "Ant Design" : "shadcn/ui"}
                </button>
              ))}
            </div>
          </div>

          {/* Run */}
          <Button onClick={runPipeline} disabled={!isValidUrl || isRunning} isLoading={isRunning} className="w-full gap-2" size="lg">
            <Play className="h-4 w-4" />
            {isRunning ? `Agent ${Math.min(steps.length + 1, 5)}/5 运行中...` : "运行流水线"}
          </Button>

          {!isRunning && steps.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full gap-2"
              onClick={() => { setSteps([]); setResult(undefined); setError(undefined); }}>
              <RefreshCw className="h-3.5 w-3.5" /> 重置
            </Button>
          )}

          {/* Pipeline Visualization */}
          <div className="rounded-lg border border-border bg-bg-surface p-3">
            <h4 className="text-xs font-medium text-text-tertiary mb-2">流水线结构</h4>
            <div className="space-y-1">
              {AGENTS.map((a, i) => (
                <div key={a.num}>
                  <div className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-xs",
                    steps.find((s: any) => s.agent === a.num)?.status === "completed"
                      ? "bg-status-success/5 border border-status-success/20"
                      : steps.length >= a.num
                        ? "bg-status-info/5 border border-status-info/20"
                        : "bg-bg-base border border-border/50")}>
                    <a.icon className={cn("h-3.5 w-3.5", a.color)} />
                    <span className="text-text-secondary">Agent {a.num}</span>
                    <span className="font-medium text-text-primary">{a.name}</span>
                    {steps.find((s: any) => s.agent === a.num)?.status === "completed" && (
                      <span className="ml-auto text-xs text-status-success">✓</span>
                    )}
                  </div>
                  {i < AGENTS.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="h-3 w-3 text-text-tertiary/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agent Details */}
          <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-3 space-y-2">
            <h4 className="text-xs font-medium text-brand-primary">各 Agent 职责</h4>
            {AGENTS.map((a) => (
              <div key={a.num} className="text-xs">
                <span className={cn("font-medium", a.color)}>Agent {a.num}:</span>
                <span className="text-text-secondary ml-1">{a.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Steps + Result */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Progress Bar */}
        {isRunning && (
          <div className="border-b border-border px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>Agent {Math.min(steps.length + 1, 5)}/5</span>
              <div className="flex-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                <div className="h-full bg-brand-primary rounded-full transition-all duration-500"
                  style={{ width: `${((steps.length) / 5) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="flex-1 overflow-auto p-4">
          {steps.length === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
              <Wrench className="mb-3 h-12 w-12 opacity-20" />
              <p className="text-sm">输入 Figma 链接，点击「运行流水线」</p>
              <p className="text-xs mt-1">观察 5 个 Agent 如何协同工作</p>
            </div>
          )}

          {steps.map((step: any, i: number) => (
            <div key={i} className="mb-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const agent = AGENTS[step.agent - 1];
                  if (!agent) return null;
                  const Icon = agent.icon;
                  return (
                    <>
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated border border-border")}>
                        <Icon className={cn("h-3.5 w-3.5", agent.color)} />
                      </div>
                      <span className="text-sm font-medium text-text-primary">{step.name}</span>
                      <Badge variant="success" className="text-xs">完成</Badge>
                    </>
                  );
                })()}
              </div>
              {step.output && (
                <div className="ml-8 rounded border border-border/50 bg-bg-surface p-2.5">
                  <p className="text-xs text-text-secondary font-mono line-clamp-3">{step.output}</p>
                </div>
              )}
            </div>
          ))}

          {/* Result */}
          {result && !isRunning && (
            <div className="mt-6 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-4 animate-fade-in">
              <h3 className="text-sm font-medium text-brand-primary mb-3">生成结果</h3>
              {result.code && (
                <div className="rounded border border-border/50 bg-bg-base p-3 mb-3">
                  <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                    {result.code.slice(0, 1500)}
                  </pre>
                </div>
              )}
              {result.validation && (
                <div className="rounded border border-border/50 bg-bg-base p-3">
                  <h4 className="text-xs font-medium text-text-secondary mb-1">Agent 5 验证结果:</h4>
                  <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                    {result.validation.slice(0, 1000)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-status-error/20 bg-status-error/5 p-4">
              <h4 className="text-sm font-medium text-status-error mb-1">流水线错误</h4>
              <p className="text-xs text-status-error font-mono">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
