"use client";

import { useCallback, useState } from "react";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { analyzeFigmaFile, getFigmaAnalysisStatus } from "@/lib/api/figma";

export function useFigma() {
  const { analysis, setAnalysis, isLoading, setLoading, error, setError } =
    useFigmaStore();
  const [taskId, setTaskId] = useState<string | null>(null);

  const analyze = useCallback(
    async (url: string, framework: string, componentLib: string) => {
      setLoading(true);
      setError(null);

      try {
        const result = await analyzeFigmaFile({ url, framework, componentLib });

        if (result.status === "error") {
          setError(result.error || "Analysis failed");
          return;
        }

        setTaskId(result.taskId);

        // 如果分析已完成，直接设置结果
        if (result.status === "completed") {
          setAnalysis(result);
          setLoading(false);
          return;
        }

        // 轮询获取状态
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
          } catch (err) {
            clearInterval(pollInterval);
            setError("Failed to get analysis status");
          }
        }, 2000);

        // 30秒超时
        setTimeout(() => {
          clearInterval(pollInterval);
          if (!analysis) {
            setError("Analysis timeout");
            setLoading(false);
          }
        }, 30000);
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || "Request failed");
        setLoading(false);
      }
    },
    [setLoading, setError, setAnalysis, analysis]
  );

  return {
    analyze,
    isLoading,
    error,
    analysis,
  };
}
