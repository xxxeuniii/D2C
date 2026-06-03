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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Preview
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 10))}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-text-secondary">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
            title="Reset zoom"
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
            alt="Figma design preview"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
            className="max-w-full transition-transform duration-200"
          />
        ) : (
          <div className="text-center text-text-tertiary">
            <p className="text-sm">No preview available</p>
            <p className="text-xs mt-1">
              Preview will appear after analysis completes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
