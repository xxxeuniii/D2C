"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  Play, RefreshCw, Loader2, CheckCircle2, XCircle, Circle,
  Eraser, GitBranch, Database, Code2, ShieldCheck, FileJson, ArrowRight, Download, Copy, Check, Sparkles
} from "lucide-react";

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
  input?: string;
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
        agent: s.agent, name: s.name, status: s.status, output: s.output,
      }));
      setSteps(mapped);

      const newTimers: Record<number, number> = {};
      for (const s of mapped) {
        if (s.status === "running") newTimers[s.agent] = Date.now();
      }
      setTimers(newTimers);

      // 2. SSE 监听进度
      await new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(`/api/pipeline/stream/${runId}`);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "ping") return;

            if (data.steps) {
              const updated = data.steps.map((s: any) => ({
                agent: s.agent, name: s.name, status: s.status, output: s.output,
              }));
              setSteps(updated);
              setTimers((prev) => {
                const next = { ...prev };
                for (const s of updated) {
                  if (s.status === "running" && !next[s.agent]) next[s.agent] = Date.now();
                }
                return next;
              });
            }

            if (data.type === "done") {
              eventSource.close();
              setResultCode(data.result?.code || "");
              resolve();
            } else if (data.type === "error") {
              eventSource.close();
              reject(new Error(data.error || "流水线失败"));
            }
          } catch {}
        };

        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error("SSE 连接断开"));
        };

        setTimeout(() => {
          eventSource.close();
          reject(new Error("超时"));
        }, 300000);
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
              总耗时: {Math.floor((Date.now() - totalStart) / 1000)}s
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
                <span className="ml-auto text-xs text-status-info font-mono">{elapsed[0]}s</span>
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
                    <span className="ml-auto text-xs text-status-info font-mono">{elapsed[a.id]}s</span>
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
              <div>
                <h4 className="text-xs font-semibold text-text-tertiary mb-1.5 flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3" /> 输入
                </h4>
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-bg-base rounded border border-border/50 p-3">
                  {`Figma URL: ${FIGMA_URL}\n目标框架: react\n组件库: element-plus`}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-text-tertiary mb-1.5 flex items-center gap-1.5">
                  <Download className="h-3 w-3" /> 输出
                </h4>
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-bg-base rounded border border-border/50 p-3">
                  {fetchStep0.output || "无输出"}
                </pre>
              </div>
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
                  <span className="text-xs text-status-info font-mono">{elapsed[a.id]}s</span>
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

        {/* 最终代码 */}
        {allDone && resultCode && (
          <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/3 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-primary/20 bg-brand-primary/5">
              <Code2 className="h-4 w-4 text-brand-primary" />
              <h3 className="text-sm font-medium text-brand-primary">生成的代码</h3>
              <button onClick={() => handleCopy(resultCode, 99)}
                className="ml-auto rounded p-1 text-brand-primary hover:text-brand-primary-hover transition-colors">
                {copiedIdx === 99 ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="p-4">
              <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-bg-base rounded border border-border/50 p-3 max-h-[600px] overflow-auto">
                {resultCode}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
