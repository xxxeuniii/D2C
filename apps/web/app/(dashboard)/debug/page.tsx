"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import dynamic from "next/dynamic";
import {
  Play, Loader2, CheckCircle2, XCircle, Circle,
  Eraser, GitBranch, Database, Code2, ShieldCheck, FileJson, Copy, Check, Sparkles, Download
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false });

const AGENTS = [
  { id: 1, name: "数据清洗", icon: Eraser, color: "text-orange-500", desc: "Python 代码清洗 Figma JSON + LLM 语义增强" },
  { id: 2, name: "结构化转换", icon: GitBranch, color: "text-blue-500", desc: "Python 规则引擎转为组件 DSL + LLM 增强" },
  { id: 3, name: "知识检索", icon: Database, color: "text-purple-500", desc: "ChromaDB RAG 检索组件库文档" },
  { id: 4, name: "代码生成", icon: Code2, color: "text-green-500", desc: "LLM 根据 DSL + 文档生成完整页面代码" },
  { id: 5, name: "测试验证", icon: ShieldCheck, color: "text-red-500", desc: "AST 静态分析 + LLM 深度审查代码" },
];

const FIGMA_URL = "https://www.figma.com/design/dEDv2fBxzJ9Gbsbhv2XSZP/Untitled?node-id=0-1";

interface StepInfo {
  agent: number;
  name: string;
  status: string;
  output?: string;
  figmaData?: any;
}

// Figma 节点树递归组件
function FigmaNodeTree({ node, depth = 0 }: { node: any; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const typeColors: Record<string, string> = {
    DOCUMENT: "text-blue-500", CANVAS: "text-purple-500", FRAME: "text-green-500",
    TEXT: "text-orange-500", RECTANGLE: "text-cyan-500", COMPONENT: "text-pink-500",
    GROUP: "text-yellow-500", INSTANCE: "text-teal-500",
  };
  const nodeType = node.type || "UNKNOWN";
  const nodeName = node.name || "(未命名)";

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-bg-elevated/50 cursor-pointer text-xs transition-colors"
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <span className="text-text-tertiary w-3">▼</span> : <span className="text-text-tertiary w-3">▶</span>
        ) : <span className="w-3" />}
        <span className={cn("font-medium", typeColors[nodeType] || "text-text-tertiary")}>{nodeType}</span>
        <span className="text-text-secondary truncate">{nodeName}</span>
        {node.characters && <span className="text-text-tertiary truncate ml-1">"{node.characters.slice(0, 20)}"</span>}
      </div>
      {expanded && hasChildren && node.children.map((child: any, i: number) => (
        <FigmaNodeTree key={child.id || i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function DebugPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [error, setError] = useState("");
  const [resultCode, setResultCode] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [timers, setTimers] = useState<Record<number, number>>({}); // agent -> 开始时间戳
  const [elapsed, setElapsed] = useState<Record<number, number>>({}); // agent -> 已用秒数
  const [totalStart, setTotalStart] = useState(0);

  // 定时更新已用秒数（两位小数）
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => {
      const now = Date.now();
      const e: Record<number, number> = {};
      for (const [agent, start] of Object.entries(timers)) {
        e[Number(agent)] = Math.round((now - start) / 10) / 100;
      }
      setElapsed(e);
    }, 100);
    return () => clearInterval(t);
  }, [isRunning, timers]);

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const run = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSteps([]);
    setError("");
    setResultCode("");
    setTimers({});
    setElapsed({});
    setTotalStart(Date.now());

    try {
      // 1. 发起流水线
      const pipeRes = await client.post("/pipeline/run", {
        url: FIGMA_URL,
        framework: "react",
        componentLib: "element-plus",
        figmaToken: "",
      });
      const { runId, steps: initSteps } = pipeRes.data;

      // 显示初始步骤
      const mapped: StepInfo[] = (initSteps || []).map((s: any) => ({
        agent: s.agent, name: s.name, status: s.status, output: s.output, figmaData: s.figmaData,
      }));
      setSteps(mapped);

      // 初始计时器清空
      setTimers({});

      // 2. 轮询进度（简单可靠）
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const res = await client.get(`/pipeline/run/${runId}`);
            const run = res.data;
            const runSteps = run.steps || [];

            const updated = runSteps.map((s: any) => ({
              agent: s.agent, name: s.name, status: s.status, output: s.output, figmaData: s.figmaData,
            }));
            setSteps(updated);
            setTimers((prev) => {
              const next = { ...prev };
              for (const s of updated) {
                if (s.status === "running" && !next[s.agent]) next[s.agent] = Date.now();
                if (s.status !== "running" && next[s.agent]) delete next[s.agent];
              }
              return next;
            });

            if (run.status === "completed") {
              clearInterval(poll);
              setResultCode(run.result?.code || "");
              resolve();
            } else if (run.status === "error") {
              clearInterval(poll);
              reject(new Error(run.error || "流水线失败"));
            }
          } catch {
            // 继续轮询
          }
        }, 500);

        setTimeout(() => { clearInterval(poll); reject(new Error("超时")); }, 300000);
      });
    } catch (err: any) {
      setError(err?.message || "执行失败");
    } finally {
      setIsRunning(false);
    }
  };

  const fetchStep0 = steps.find((s) => s.agent === 0);
  const agentSteps = steps.filter((s) => s.agent >= 1 && s.agent <= 5);
  const allDone = steps.length === 6 && steps.every((s) => s.status === "completed");

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧步骤列表 */}
      <div className="w-72 flex-shrink-0 border-r border-border bg-bg-surface flex flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-primary" />
              流水线进度
            </h3>
            <Button size="sm" onClick={run} disabled={isRunning} className="gap-1">
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {isRunning ? "运行中" : "执行"}
            </Button>
          </div>
          {isRunning && totalStart > 0 && (
            <p className="text-xs text-text-tertiary mt-1">
              总耗时: {(Math.round((Date.now() - totalStart) / 10) / 100).toFixed(2)}s
            </p>
          )}
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          {/* Step 0: 获取数据 */}
          <div className={cn(
            "rounded-lg px-3 py-2 text-xs border transition-all",
            fetchStep0?.status === "completed" ? "border-status-success/30 bg-status-success/3" :
            fetchStep0?.status === "running" ? "border-status-info/30 bg-status-info/3" :
            "border-border/50 bg-bg-base"
          )}>
            <div className="flex items-center gap-2">
              {fetchStep0?.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-status-success" /> :
               fetchStep0?.status === "running" ? <Loader2 className="h-3.5 w-3.5 text-status-info animate-spin" /> :
               <Circle className="h-3.5 w-3.5 text-text-tertiary/50" />}
              <FileJson className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="font-medium text-text-primary">获取 Figma 数据</span>
              {fetchStep0?.status === "running" && elapsed[0] != null && (
                <span className="ml-auto text-xs text-status-info font-mono">{elapsed[0]?.toFixed(2)}s</span>
              )}
            </div>
            {fetchStep0?.output && (
              <p className="text-text-tertiary mt-1 truncate">{fetchStep0.output}</p>
            )}
          </div>

          {/* Agent 1-5 */}
          {AGENTS.map((a) => {
            const step = agentSteps.find((s) => s.agent === a.id);
            return (
              <div key={a.id} className={cn(
                "rounded-lg px-3 py-2 text-xs border transition-all",
                step?.status === "completed" ? "border-status-success/30 bg-status-success/3" :
                step?.status === "running" ? "border-status-info/30 bg-status-info/3" :
                step?.status === "error" ? "border-status-error/30 bg-status-error/3" :
                "border-border/50 bg-bg-base"
              )}>
                <div className="flex items-center gap-2">
                  {step?.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-status-success" /> :
                   step?.status === "running" ? <Loader2 className="h-3.5 w-3.5 text-status-info animate-spin" /> :
                   step?.status === "error" ? <XCircle className="h-3.5 w-3.5 text-status-error" /> :
                   <Circle className="h-3.5 w-3.5 text-text-tertiary/50" />}
                  <a.icon className={cn("h-3.5 w-3.5", a.color)} />
                  <span className="font-medium text-text-primary">Agent {a.id}: {a.name}</span>
                  {step?.status === "running" && elapsed[a.id] != null && (
                    <span className="ml-auto text-xs text-status-info font-mono">{elapsed[a.id]?.toFixed(2)}s</span>
                  )}
                </div>
                {step?.output && (
                  <p className="text-text-tertiary mt-1 truncate">{step.output}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 右侧详情面板 */}
      <div className="flex-1 overflow-auto p-4">
        {!isRunning && steps.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
            <Play className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm">点击左侧「执行」按钮启动流水线</p>
            <p className="text-xs mt-1">6 个步骤依次执行，输入输出实时展示</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-status-error/20 bg-status-error/5 p-4 mb-4">
            <h3 className="text-sm font-medium text-status-error flex items-center gap-2">
              <XCircle className="h-4 w-4" /> 执行失败
            </h3>
            <pre className="text-xs text-status-error mt-2 font-mono whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {isRunning && steps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-10 w-10 animate-spin text-brand-primary mb-4" />
            <p className="text-sm text-text-secondary">正在启动流水线...</p>
          </div>
        )}

        {/* Step 0 详情 */}
        {fetchStep0 && fetchStep0.status === "completed" && (
          <div className="rounded-lg border border-border bg-bg-surface mb-4 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-bg-elevated/30">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <FileJson className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-sm font-medium text-text-primary">Step 0: 获取 Figma 原始数据</h3>
              <Badge variant="success" className="text-xs ml-auto">完成</Badge>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span>📁 <b>{fetchStep0.figmaData?.fileName || "Untitled"}</b></span>
                <span>📄 {fetchStep0.figmaData?.pages || 0} 个页面</span>
                <span>🔢 {fetchStep0.figmaData?.totalNodes || 0} 个节点</span>
              </div>
              {/* Figma 节点树 */}
              {fetchStep0.figmaData?.tree && (
                <div>
                  <h4 className="text-xs font-semibold text-text-tertiary mb-1.5">📐 设计稿节点树</h4>
                  <div className="bg-bg-base rounded border border-border/50 p-2 max-h-96 overflow-auto">
                    <FigmaNodeTree node={fetchStep0.figmaData.tree} depth={0} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agent 1-5 详情 */}
        {AGENTS.map((a, idx) => {
          const step = agentSteps.find((s) => s.agent === a.id);
          if (!step || step.status === "pending") return null;

          return (
            <div key={a.id} className={cn(
              "rounded-lg border mb-4 overflow-hidden",
              step.status === "completed" ? "border-status-success/30 bg-status-success/3" :
              step.status === "running" ? "border-status-info/30 bg-status-info/3" :
              "border-status-error/30 bg-status-error/3"
            )}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-bg-elevated/30">
                {step.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-status-success" /> :
                 step.status === "running" ? <Loader2 className="h-4 w-4 text-status-info animate-spin" /> :
                 <XCircle className="h-4 w-4 text-status-error" />}
                <a.icon className={cn("h-4 w-4", a.color)} />
                <h3 className="text-sm font-medium text-text-primary">Agent {a.id}: {a.name}</h3>
                {step.status === "running" && elapsed[a.id] != null && (
                  <span className="text-xs text-status-info font-mono">{elapsed[a.id]?.toFixed(2)}s</span>
                )}
                <Badge
                  variant={step.status === "completed" ? "success" : step.status === "running" ? "warning" : "error"}
                  className="text-xs ml-auto"
                >
                  {step.status === "completed" ? "完成" : step.status === "running" ? "运行中" : "失败"}
                </Badge>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-text-tertiary">{a.desc}</p>

                {/* 输出 */}
                {step.output && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-xs font-semibold text-text-tertiary flex items-center gap-1.5">
                        <Download className="h-3 w-3" /> 输出
                      </h4>
                      <button onClick={() => handleCopy(step.output || "", a.id)}
                        className="rounded p-1 text-text-tertiary hover:text-text-primary transition-colors">
                        {copiedIdx === a.id ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-bg-base rounded border border-border/50 p-3 max-h-80 overflow-auto">
                      {step.output.length > 2000 ? step.output.slice(0, 2000) + "\n\n... (截断，点击复制按钮获取完整内容)" : step.output}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* 最终代码 - Monaco Editor */}
        {allDone && resultCode && (
          <div className="rounded-lg border border-brand-primary/30 overflow-hidden flex flex-col" style={{ minHeight: "400px" }}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-brand-primary/20 bg-brand-primary/5 flex-shrink-0">
              <Code2 className="h-4 w-4 text-brand-primary" />
              <span className="text-xs font-medium text-brand-primary">index.tsx</span>
              <span className="text-xs text-text-tertiary">{resultCode.length} 字符</span>
              <button onClick={() => handleCopy(resultCode, 99)}
                className="ml-auto rounded p-1 text-brand-primary hover:text-brand-primary-hover transition-colors">
                {copiedIdx === 99 ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language="typescript"
                value={resultCode}
                theme="vs"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                  padding: { top: 8 },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
