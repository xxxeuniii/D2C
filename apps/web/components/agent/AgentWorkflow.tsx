"use client";

import { useAgentStore } from "@/lib/store/agentStore";
import { AgentStep } from "./AgentStep";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AgentWorkflow() {
  const { currentRun } = useAgentStore();

  if (!currentRun) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Run Info Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Run #{currentRun.id.slice(0, 8)}
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Type: {currentRun.type} · Status: {currentRun.status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                currentRun.status === "running"
                  ? "bg-status-info/10 text-status-info"
                  : currentRun.status === "completed"
                    ? "bg-status-success/10 text-status-success"
                    : currentRun.status === "error"
                      ? "bg-status-error/10 text-status-error"
                      : "bg-bg-elevated text-text-tertiary"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  currentRun.status === "running"
                    ? "bg-status-info animate-pulse"
                    : currentRun.status === "completed"
                      ? "bg-status-success"
                      : currentRun.status === "error"
                        ? "bg-status-error"
                        : "bg-text-tertiary"
                }`}
              />
              {currentRun.status}
            </span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <ScrollArea className="flex-1 p-4">
        <div className="relative space-y-0">
          {currentRun.steps.map((step, index) => (
            <AgentStep
              key={step.id}
              step={step}
              isLast={index === currentRun.steps.length - 1}
              isFirst={index === 0}
            />
          ))}

          {currentRun.steps.length === 0 && (
            <div className="flex items-center justify-center py-16 text-text-tertiary">
              <p className="text-sm">Waiting for steps to execute...</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
