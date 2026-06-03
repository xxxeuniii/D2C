"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFigma } from "@/hooks/useFigma";
import { cn } from "@/lib/utils/cn";
import { Link, Loader2, Check } from "lucide-react";

type Framework = "vue3" | "react" | "nextjs";
type ComponentLib = "antd" | "element-plus" | "shadcn";

export function FigmaImporter() {
  const [url, setUrl] = useState("");
  const [framework, setFramework] = useState<Framework>("react");
  const [componentLib, setComponentLib] = useState<ComponentLib>("shadcn");
  const { analyze, isLoading, error } = useFigma();

  const isValidUrl = url.trim().match(
    /^https?:\/\/(www\.)?figma\.com\/(file|design)\/.+/
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidUrl) return;
    await analyze(url, framework, componentLib);
  };

  const frameworks: { key: Framework; label: string }[] = [
    { key: "vue3", label: "Vue 3" },
    { key: "react", label: "React" },
    { key: "nextjs", label: "Next.js" },
  ];

  const componentLibs: { key: ComponentLib; label: string }[] = [
    { key: "antd", label: "Ant Design" },
    { key: "element-plus", label: "Element Plus" },
    { key: "shadcn", label: "shadcn/ui" },
  ];

  return (
    <div className="w-full max-w-lg animate-fade-in">
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
          <svg className="h-7 w-7 text-brand-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          Import from Figma
        </h2>
        <p className="mt-2 text-sm text-text-tertiary">
          Paste a Figma design link to generate production-ready code
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* URL Input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Figma URL
          </label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              type="url"
              placeholder="https://www.figma.com/file/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10"
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
            Framework
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
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-border bg-bg-base text-text-secondary hover:border-border-strong hover:text-text-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Component Library Selection */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Component Library
          </label>
          <div className="flex gap-2">
            {componentLibs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setComponentLib(key)}
                disabled={isLoading}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  componentLib === key
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-border bg-bg-base text-text-secondary hover:border-border-strong hover:text-text-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!isValidUrl}
          isLoading={isLoading}
        >
          {isLoading ? "Analyzing design..." : "Parse & Generate"}
        </Button>
      </form>
    </div>
  );
}
