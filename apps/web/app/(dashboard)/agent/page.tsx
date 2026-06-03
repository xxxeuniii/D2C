"use client";

import { AgentWorkflow } from "@/components/agent/AgentWorkflow";
import { useAgentStore } from "@/lib/store/agentStore";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function AgentPage() {
  const { currentRun, isRunning, startRun } = useAgentStore();

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Agent Workflow
          </h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Monitor and control AI agent execution
          </p>
        </div>
        <Button
          onClick={() => startRun("figma-to-code")}
          isLoading={isRunning}
          disabled={isRunning}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Start New Run
        </Button>
      </div>

      {/* Workflow Visualization */}
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-bg-surface">
        {currentRun ? (
          <AgentWorkflow />
        ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <div className="text-center">
              <div className="mb-2 text-4xl">🤖</div>
              <p>No active agent run</p>
              <p className="text-xs mt-1">Click &quot;Start New Run&quot; to begin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
