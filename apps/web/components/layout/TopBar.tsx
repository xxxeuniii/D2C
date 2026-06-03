"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { usePathname } from "next/navigation";

interface TopBarProps {
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
}

const pageTitles: Record<string, string> = {
  "/figma2code": "Figma \u2192 Code",
  "/knowledge": "Knowledge Base",
};

export function TopBar({ onToggleSidebar, onToggleRightPanel }: TopBarProps) {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] || "D2C";

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-bg-surface px-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
          title="Toggle Sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
      </div>
      <button
        onClick={onToggleRightPanel}
        className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
        title="Toggle Panel"
      >
        <PanelRight className="h-4 w-4" />
      </button>
    </header>
  );
}
