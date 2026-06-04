"use client";

import { useFigmaStore } from "@/lib/store/figmaStore";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useState } from "react";

export function DesignPreview() {
  const { analysis } = useFigmaStore();
  const [zoom, setZoom] = useState(100);

  const imageUrl = analysis?.previewUrl;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <h3 className="text-xs font-semibold tracking-wider text-text-tertiary">
          预览
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 10))}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="缩小"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-text-secondary">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="放大"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="重置缩放"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto bg-[#E5E5E5] flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Figma 设计稿预览"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
            className="max-w-full transition-transform duration-200"
          />
        ) : (
          <div className="text-center text-text-tertiary">
            <p className="text-sm">暂无预览</p>
            <p className="text-xs mt-1">
              分析完成后将显示预览
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
