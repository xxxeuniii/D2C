"use client";

import { useState } from "react";
import { useFigmaStore } from "@/lib/store/figmaStore";
import { cn } from "@/lib/utils/cn";
import { ChevronRight, ChevronDown, Component, Frame, Image, Type } from "lucide-react";

interface TreeNodeProps {
  node: any;
  depth?: number;
}

const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  COMPONENT: Component,
  FRAME: Frame,
  IMAGE: Image,
  TEXT: Type,
};

function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = nodeTypeIcons[node.type] || Frame;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer hover:bg-bg-elevated/50 transition-colors text-sm",
          depth > 0 && "ml-4"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
        <span className="truncate text-text-secondary">{node.name}</span>
        <span className="ml-auto flex-shrink-0 text-xs text-text-tertiary">
          {node.type}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child: any, i: number) => (
            <TreeNode key={child.id || i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NodeTree() {
  const { analysis } = useFigmaStore();

  if (!analysis?.nodes) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-text-tertiary">
        <p className="text-sm">No nodes available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Node Tree
        </h3>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-2">
        {Array.isArray(analysis.nodes) ? (
          analysis.nodes.map((node: any, i: number) => (
            <TreeNode key={node.id || i} node={node} depth={0} />
          ))
        ) : (
          <TreeNode node={analysis.nodes} depth={0} />
        )}
      </div>
    </div>
  );
}
