"use client";

import { useCallback, useRef } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import { generateId } from "@/lib/utils/format";

export function useAgent() {
  const {
    currentRun,
    isRunning,
    startRun,
    addStep,
    updateStep,
    updateRunStatus,
    completeRun,
    setRunning,
  } = useAgentStore();

  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const simulateWorkflow = useCallback(
    async (type: string) => {
      const runId = startRun(type);

      // 模拟步骤（演示用）
      const steps = [
        { name: "Parse Figma Design", toolCalls: [{ name: "read_file", status: "completed" as const, input: { fileKey: "abc123" }, output: "Parsed 45 nodes" }] },
        { name: "Extract Components", toolCalls: [{ name: "search", status: "completed" as const, input: { query: "component patterns" }, output: "Found 12 components" }] },
        { name: "Generate Layout Tree" },
        { name: "Map to Framework Components" },
        { name: "Generate Code", toolCalls: [{ name: "write_file", status: "completed" as const, input: { path: "components/Button.tsx" }, output: "Generated 5 files" }] },
        { name: "Optimize & Format" },
        { name: "Final Review" },
      ];

      for (const stepDef of steps) {
        const stepId = generateId();
        const step = {
          id: stepId,
          name: stepDef.name,
          status: "running" as const,
          toolCalls: stepDef.toolCalls || [],
          output: "",
        };

        addStep(runId, step);

        // 模拟执行时间
        await new Promise((resolve) => setTimeout(resolve, 1500));

        updateStep(runId, stepId, {
          status: "completed",
          output: `${stepDef.name} completed successfully.`,
        });
      }

      completeRun(runId, { filesGenerated: 5, linesOfCode: 342 });
    },
    [startRun, addStep, updateStep, completeRun]
  );

  return {
    currentRun,
    isRunning,
    startRun: simulateWorkflow,
  };
}
