"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFigma } from "@/hooks/useFigma";
import { cn } from "@/lib/utils/cn";
import { Link, Loader2, Code2 } from "lucide-react";

type Framework = "vue3" | "react" | "nextjs";

const DEFAULT_FIGMA_URL = "https://www.figma.com/design/dEDv2fBxzJ9Gbsbhv2XSZP/Untitled?node-id=0-1&p=f&t=b5hI6no6Iv5Kzydx-0";

export function FigmaImporter() {
  const [url, setUrl] = useState(DEFAULT_FIGMA_URL);
  const [framework, setFramework] = useState<Framework>("react");
  const { analyze, isLoading, error } = useFigma();

  const isValidUrl = url.trim().match(
    /^https?:\/\/(www\.)?figma\.com\/(file|design|proto)\/.+/
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidUrl) return;
    await analyze(url, framework);
  };

  const frameworks: { key: Framework; label: string }[] = [
    { key: "vue3", label: "Vue 3" },
    { key: "react", label: "React" },
    { key: "nextjs", label: "Next.js" },
  ];

  return (
    <div className="w-full animate-fade-in">
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/15">
          <Code2 className="h-7 w-7 text-brand-primary" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          设计稿转代码
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          粘贴 Figma 设计稿链接，自动生成生产级前端代码
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* URL Input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Figma 链接
          </label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              type="url"
              placeholder="https://www.figma.com/file/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10 font-mono text-xs"
              disabled={isLoading}
            />
          </div>
          {error && (
            <p className="mt-1.5 text-xs text-status-error">{error}</p>
          )}
        </div>

        {/* Framework Selection */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            目标框架
          </label>
          <div className="flex gap-2">
            {frameworks.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFramework(key)}
                disabled={isLoading}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  framework === key
                    ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
                    : "border-border bg-bg-base text-text-secondary hover:border-border-strong hover:text-text-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!isValidUrl || isLoading}
          isLoading={isLoading}
        >
          {isLoading
            ? "正在分析设计稿..."
            : !isValidUrl
              ? "请输入有效的 Figma 链接"
              : "解析并生成代码"}
        </Button>
      </form>
    </div>
  );
}
