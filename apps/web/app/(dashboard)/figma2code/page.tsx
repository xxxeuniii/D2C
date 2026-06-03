"use client";

import { FigmaImporter } from "@/components/figma/FigmaImporter";
import { NodeTree } from "@/components/figma/NodeTree";
import { DesignPreview } from "@/components/figma/DesignPreview";
import { CodePreview } from "@/components/figma/CodePreview";
import { useFigmaStore } from "@/lib/store/figmaStore";

export default function Figma2CodePage() {
  const { analysis } = useFigmaStore();

  const hasAnalysis = analysis && analysis.nodes;

  return (
    <div className="flex h-full overflow-hidden">
      {!hasAnalysis ? (
        /* Import Stage */
        <div className="flex flex-1 items-center justify-center p-8">
          <FigmaImporter />
        </div>
      ) : (
        /* Result Stage - Three columns */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Node Tree */}
          <div className="w-72 flex-shrink-0 border-r border-border overflow-auto">
            <NodeTree />
          </div>

          {/* Center: Design Preview + Code */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top: Design Preview */}
            <div className="h-1/2 border-b border-border overflow-hidden">
              <DesignPreview />
            </div>

            {/* Bottom: Code Preview */}
            <div className="h-1/2 overflow-hidden">
              <CodePreview />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
