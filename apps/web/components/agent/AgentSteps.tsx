"use client";

import { cn } from "@/lib/utils/cn";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Figma,
  Database,
  Code2,
  FileSearch,
  FileOutput,
  Wrench,
} from "lucide-react";

interface AgentStep {
  name: string;
  status: "running" | "completed" | "error" | "pending";
  input?: string;
  output?: string;
  timestamp?: string;
}

interface AgentStepsProps {
  steps: AgentStep[];
  isRunning: boolean;
  result?: string;
  error?: string;
}

// 工具名称映射
const toolMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  read_figma_design: { label: "读取 Figma 设计", icon: Figma, desc: "调用 Figma API 获取设计结构" },
  search_design_specs: { label: "检索设计规范", icon: Database, desc: "从知识库 RAG 检索相关规范" },
  generate_frontend_code: { label: "生成前端代码", icon: Code2, desc: "LLM 根据设计+规范生成代码" },
  review_code: { label: "代码审查", icon: FileSearch, desc: "检查代码质量/类型/安全" },
  write_code_to_file: { label: "保存文件", icon: FileOutput, desc: "将代码写入 output 目录" },
};

export function AgentSteps({ steps, isRunning, result, error }: AgentStepsProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Wrench className="h-4 w-4 text-brand-primary" />
            Agent 工作流
          </h3>
          <Badge variant={isRunning ? "warning" : error ? "error" : "success"}>
            {isRunning ? "运行中..." : error ? "失败" : "完成"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">
          Agent 自主决策执行：读取设计 → 检索规范 → 生成代码 → 审查 → 保存
        </p>
      </div>

      {/* Steps */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-0">
          {steps.length === 0 && isRunning && (
            <div className="flex items-center justify-center py-16 text-text-tertiary">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-sm">Agent 正在思考...</span>
            </div>
          )}

          {steps.length === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <Wrench className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">点击 &quot;Run Agent&quot; 启动工作流</p>
              <p className="mt-1 text-xs">观察 Agent 如何使用 Tool + Memory 完成任务</p>
            </div>
          )}

          {steps.map((step, index) => {
            const meta = toolMeta[step.name] || {
              label: step.name,
              icon: Wrench,
              desc: "",
            };
            const Icon = meta.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={index} className="relative flex gap-3">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border",
                      step.status === "completed"
                        ? "border-status-success/30 bg-status-success/10"
                        : step.status === "error"
                          ? "border-status-error/30 bg-status-error/10"
                          : step.status === "running"
                            ? "border-status-info/30 bg-status-info/10"
                            : "border-border bg-bg-elevated"
                    )}
                  >
                    {step.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-status-success" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-4 w-4 text-status-error" />
                    ) : step.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-status-info" />
                    ) : (
                      <Clock className="h-4 w-4 text-text-tertiary" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-[20px]",
                        step.status === "completed"
                          ? "bg-status-success/20"
                          : "bg-border"
                      )}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div className={cn("flex-1 pb-5", isLast && "pb-0")}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-secondary" />
                    <span className="text-sm font-medium text-text-primary">
                      {meta.label}
                    </span>
                    {step.timestamp && (
                      <span className="text-xs text-text-tertiary">
                        {step.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">{meta.desc}</p>

                  {/* Input */}
                  {step.input && (
                    <div className="mt-2 rounded border border-border/50 bg-bg-base px-2.5 py-1.5">
                      <span className="text-xs text-text-tertiary">Input:</span>
                      <p className="mt-0.5 text-xs text-text-secondary font-mono line-clamp-2">
                        {step.input}
                      </p>
                    </div>
                  )}

                  {/* Output */}
                  {step.output && step.status === "completed" && (
                    <div className="mt-2 rounded border border-status-success/20 bg-status-success/5 px-2.5 py-1.5">
                      <span className="text-xs text-status-success">Output:</span>
                      <p className="mt-0.5 text-xs text-text-secondary font-mono line-clamp-3 whitespace-pre-wrap">
                        {step.output}
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {step.output && step.status === "error" && (
                    <div className="mt-2 rounded border border-status-error/20 bg-status-error/5 px-2.5 py-1.5">
                      <span className="text-xs text-status-error">Error:</span>
                      <p className="mt-0.5 text-xs text-status-error font-mono line-clamp-3">
                        {step.output}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Result */}
          {result && !isRunning && (
            <div className="mt-4 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-3 animate-fade-in">
              <h4 className="text-sm font-medium text-brand-primary mb-1">
                Agent 执行结果
              </h4>
              <p className="text-xs text-text-secondary whitespace-pre-wrap line-clamp-6">
                {result}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-status-error/20 bg-status-error/5 p-3 animate-fade-in">
              <h4 className="text-sm font-medium text-status-error mb-1">
                执行失败
              </h4>
              <p className="text-xs text-status-error font-mono">{error}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
