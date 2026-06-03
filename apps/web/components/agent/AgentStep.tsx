"use client";

import { cn } from "@/lib/utils/cn";
import { AgentStep as AgentStepType } from "@/types";
import { ToolCallCard } from "./ToolCallCard";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronRight,
} from "lucide-react";

interface AgentStepProps {
  step: AgentStepType;
  isLast: boolean;
  isFirst: boolean;
}

export function AgentStep({ step, isLast, isFirst }: AgentStepProps) {
  const statusIcon = () => {
    switch (step.status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-status-success" />;
      case "error":
        return <XCircle className="h-5 w-5 text-status-error" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-status-info" />;
      default:
        return <Clock className="h-5 w-5 text-text-tertiary" />;
    }
  };

  return (
    <div className="relative flex gap-3">
      {/* Timeline line & dot */}
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-surface">
          {statusIcon()}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1",
              step.status === "completed"
                ? "bg-status-success/30"
                : step.status === "running"
                  ? "bg-status-info/30"
                  : "bg-border"
            )}
          />
        )}
      </div>

      {/* Step Content */}
      <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-medium text-text-primary">
              {step.name}
            </h4>
            <p className="text-xs text-text-tertiary mt-0.5">
              Step {step.id.slice(0, 4)}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              step.status === "completed"
                ? "bg-status-success/10 text-status-success"
                : step.status === "error"
                  ? "bg-status-error/10 text-status-error"
                  : step.status === "running"
                    ? "bg-status-info/10 text-status-info"
                    : "bg-bg-elevated text-text-tertiary"
            )}
          >
            {step.status}
          </span>
        </div>

        {/* Output */}
        {step.output && (
          <div className="mt-2 rounded-lg border border-border bg-bg-base p-3">
            <p className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
              {step.output}
            </p>
          </div>
        )}

        {/* Running indicator */}
        {step.status === "running" && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-status-info/20 bg-status-info/5 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-status-info" />
            <span className="text-xs text-status-info">
              Executing...
            </span>
          </div>
        )}

        {/* Tool Calls */}
        {step.toolCalls && step.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {step.toolCalls.map((call, i) => (
              <ToolCallCard key={i} toolCall={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
