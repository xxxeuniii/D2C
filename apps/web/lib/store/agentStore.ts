import { create } from "zustand";
import { AgentRun, AgentStep } from "@/types";
import { generateId } from "@/lib/utils/format";

interface AgentState {
  // 运行历史
  runs: AgentRun[];

  // 当前运行
  currentRun: AgentRun | null;

  // 运行状态
  isRunning: boolean;

  // Actions
  startRun: (type: string) => string;
  updateRunStatus: (runId: string, status: AgentRun["status"]) => void;
  addStep: (runId: string, step: AgentStep) => void;
  updateStep: (runId: string, stepId: string, updates: Partial<AgentStep>) => void;
  completeRun: (runId: string, result?: any) => void;
  setRunning: (running: boolean) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runs: [],
  currentRun: null,
  isRunning: false,

  startRun: (type: string) => {
    const id = generateId();
    const run: AgentRun = {
      id,
      type,
      status: "running",
      steps: [],
      createdAt: new Date().toISOString(),
    };

    set({
      runs: [run, ...get().runs],
      currentRun: run,
      isRunning: true,
    });

    return id;
  },

  updateRunStatus: (runId: string, status: AgentRun["status"]) => {
    set((state) => {
      const updateRuns = (runs: AgentRun[]) =>
        runs.map((r) => (r.id === runId ? { ...r, status } : r));

      return {
        runs: updateRuns(state.runs),
        currentRun: state.currentRun?.id === runId
          ? { ...state.currentRun, status }
          : state.currentRun,
      };
    });
  },

  addStep: (runId: string, step: AgentStep) => {
    set((state) => {
      const updateRuns = (runs: AgentRun[]) =>
        runs.map((r) =>
          r.id === runId ? { ...r, steps: [...r.steps, step] } : r
        );

      return {
        runs: updateRuns(state.runs),
        currentRun: state.currentRun?.id === runId
          ? { ...state.currentRun, steps: [...state.currentRun.steps, step] }
          : state.currentRun,
      };
    });
  },

  updateStep: (runId: string, stepId: string, updates: Partial<AgentStep>) => {
    set((state) => {
      const updateSteps = (steps: AgentStep[]) =>
        steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s));

      const updateRuns = (runs: AgentRun[]) =>
        runs.map((r) =>
          r.id === runId ? { ...r, steps: updateSteps(r.steps) } : r
        );

      return {
        runs: updateRuns(state.runs),
        currentRun: state.currentRun?.id === runId
          ? { ...state.currentRun, steps: updateSteps(state.currentRun.steps) }
          : state.currentRun,
      };
    });
  },

  completeRun: (runId: string, result?: any) => {
    set((state) => {
      const updateRuns = (runs: AgentRun[]) =>
        runs.map((r) =>
          r.id === runId ? { ...r, status: "completed", result } : r
        );

      return {
        runs: updateRuns(state.runs),
        currentRun:
          state.currentRun?.id === runId
            ? { ...state.currentRun, status: "completed", result }
            : state.currentRun,
        isRunning: false,
      };
    });
  },

  setRunning: (running: boolean) => {
    set({ isRunning: running });
  },
}));
