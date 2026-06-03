"use client";

import { cn } from "@/lib/utils/cn";
import {
  PanelLeft,
  PanelRight,
  Bell,
  User,
} from "lucide-react";
import { usePathname } from "next/navigation";

interface TopBarProps {
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
}

const pageTitles: Record<string, string> = {
  "/chat": "Chat",
  "/figma2code": "Figma to Code",
  "/agent": "Agent Workflow",
  "/knowledge": "Knowledge Base",
};

export function TopBar({ onToggleSidebar, onToggleRightPanel }: TopBarProps) {
  const pathname = usePathname();

  const title = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] || "D2C";

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-bg-surface px-3">
      {/* Left */}
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

      {/* Right */}
      <div className="flex items-center gap-1">
        <button className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors">
          <Bell className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleRightPanel}
          className="rounded-md p-1.5 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
          title="Toggle Right Panel"
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <div className="ml-2 h-5 w-[1px] bg-border" />
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-elevated transition-colors">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10">
            <User className="h-3.5 w-3.5 text-brand-primary" />
          </div>
          <span className="text-xs">User</span>
        </button>
      </div>
    </header>
  );
}
