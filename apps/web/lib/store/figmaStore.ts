import { create } from "zustand";
import { FigmaAnalysis } from "@/types";

interface FigmaState {
  // 当前分析结果
  analysis: FigmaAnalysis | null;

  // 加载状态
  isLoading: boolean;

  // 错误信息
  error: string | null;

  // Actions
  setAnalysis: (analysis: FigmaAnalysis) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useFigmaStore = create<FigmaState>((set) => ({
  analysis: null,
  isLoading: false,
  error: null,

  setAnalysis: (analysis: FigmaAnalysis) => {
    set({ analysis, error: null });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  reset: () => {
    set({
      analysis: null,
      isLoading: false,
      error: null,
    });
  },
}));
