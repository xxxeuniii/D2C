import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FigmaAnalysis } from "@/types";

interface PipelineStep {
  agent: number;
  name: string;
  status: string;
  output?: string;
}

interface FigmaState {
  analysis: FigmaAnalysis | null;
  isLoading: boolean;
  error: string | null;
  figmaToken: string | null;
  steps: PipelineStep[];

  setAnalysis: (analysis: FigmaAnalysis) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFigmaToken: (token: string) => void;
  setSteps: (steps: PipelineStep[]) => void;
  reset: () => void;
}

export const useFigmaStore = create<FigmaState>()(
  persist(
    (set) => ({
      analysis: null,
      isLoading: false,
      error: null,
      figmaToken: null,
      steps: [],

      setAnalysis: (analysis) => set({ analysis, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      setFigmaToken: (figmaToken) => set({ figmaToken }),
      setSteps: (steps) => set({ steps }),
      reset: () =>
        set({ analysis: null, isLoading: false, error: null, steps: [] }),
    }),
    {
      name: "d2c-figma-storage",
      partialize: (state) => ({ figmaToken: state.figmaToken }),
    }
  )
);
