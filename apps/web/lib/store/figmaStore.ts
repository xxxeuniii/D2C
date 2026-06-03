import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FigmaAnalysis } from "@/types";

interface FigmaState {
  analysis: FigmaAnalysis | null;
  isLoading: boolean;
  error: string | null;
  figmaToken: string | null;

  setAnalysis: (analysis: FigmaAnalysis) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFigmaToken: (token: string) => void;
  reset: () => void;
}

export const useFigmaStore = create<FigmaState>()(
  persist(
    (set) => ({
      analysis: null,
      isLoading: false,
      error: null,
      figmaToken: null,

      setAnalysis: (analysis) => set({ analysis, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      setFigmaToken: (figmaToken) => set({ figmaToken }),
      reset: () =>
        set({ analysis: null, isLoading: false, error: null }),
    }),
    {
      name: "d2c-figma-storage",
      partialize: (state) => ({ figmaToken: state.figmaToken }),
    }
  )
);
