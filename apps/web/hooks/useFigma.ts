"use client";

import { useCallback, useState } from "react";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { analyzeFigmaFile, getFigmaAnalysisStatus } from "@/lib/api/figma";

export function useFigma() {
  const {
    analysis,
    setAnalysis,
    isLoading,
    setLoading,
    error,
    setError,
    figmaToken,
  } = useFigmaStore();

  const analyze = useCallback(
    async (url: string, framework: string) => {
      if (!figmaToken) {
        setError("Please configure your Figma token in Settings first");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await analyzeFigmaFile({
          url,
          framework,
          token: figmaToken,
        });

        if (result.status === "error") {
          setError(result.error || "Analysis failed");
          return;
        }

        if (result.status === "completed") {
          setAnalysis(result);
          setLoading(false);
          return;
        }

        // 轮询状态
        const pollInterval = setInterval(async () => {
          try {
            const status = await getFigmaAnalysisStatus(result.taskId);
            if (status.status === "completed") {
              clearInterval(pollInterval);
              setAnalysis(status);
              setLoading(false);
            } else if (status.status === "error") {
              clearInterval(pollInterval);
              setError(status.error || "Analysis failed");
            }
          } catch {
            clearInterval(pollInterval);
            setError("Failed to get analysis status");
          }
        }, 2000);

        setTimeout(() => {
          clearInterval(pollInterval);
          if (!analysis) {
            setError("Analysis timeout (30s)");
            setLoading(false);
          }
        }, 30000);
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || "Request failed");
        setLoading(false);
      }
    },
    [figmaToken, setLoading, setError, setAnalysis, analysis]
  );

  return { analyze, isLoading, error, analysis };
}
