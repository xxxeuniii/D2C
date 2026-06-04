"use client";

import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RightPanel({ open, onClose }: RightPanelProps) {
  if (!open) return null;

  return (
    <aside className="flex w-[320px] flex-shrink-0 flex-col border-l border-border bg-bg-surface animate-slide-in-right">
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <h3 className="text-sm font-medium text-text-primary">上下文</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="mb-3 rounded-full bg-bg-elevated p-3">
            <svg
              className="h-6 w-6 text-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          </div>
          <p className="text-sm text-text-secondary">未选择上下文</p>
          <p className="mt-1 text-xs text-text-tertiary">
            选择一个文件或组件以查看详情
          </p>
        </div>
      </div>
    </aside>
  );
}
