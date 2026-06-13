"use client";

import { useCallback, useRef } from "react";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { client } from "@/lib/api/client";

export function useFigma() {
  const {
    analysis,
    setAnalysis,
    isLoading,
    setLoading,
    error,
    setError,
    figmaToken,
    setSteps,
  } = useFigmaStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyze = useCallback(
    async (url: string, framework: string) => {
      if (!figmaToken) {
        setError("请先在设置中配置 Figma Token");
        return;
      }

      setLoading(true);
      setError(null);
      setAnalysis(null as any);

      try {
        // 1. 发起流水线请求
        const response = await client.post("/pipeline/run", {
          url,
          framework,
          componentLib: "element-plus",
          figmaToken,
        });

        const { runId, steps: initialSteps } = response.data;
        setSteps(initialSteps || []);

        // 2. 轮询进度
        pollRef.current = setInterval(async () => {
          try {
            const res = await client.get(`/pipeline/run/${runId}`);
            const run = res.data;
            setSteps(run.steps || []);

            if (run.status === "completed" && run.result) {
              clearInterval(pollRef.current!);
              setAnalysis({
                taskId: runId,
                status: "completed",
                generatedCode: run.result.code,
                nodes: run.steps,
              });
              setLoading(false);
            } else if (run.status === "error") {
              clearInterval(pollRef.current!);
              setError(run.error || "流水线执行失败");
              setLoading(false);
            }
          } catch {
            // 轮询失败不中断
          }
        }, 1000);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || "请求失败");
        setLoading(false);
      }
    },
    [figmaToken, setLoading, setError, setAnalysis, setSteps]
  );

  return { analyze, isLoading, error, analysis };
}
