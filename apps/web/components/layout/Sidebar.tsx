"use client";

import { cn } from "@/lib/utils/cn";
import { usePathname, useRouter } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import {
  MessageSquare,
  Figma,
  Bot,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
}

const navItems = [
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: Figma, label: "Figma to Code", path: "/figma2code" },
  { icon: Bot, label: "Agent", path: "/agent" },
  { icon: Database, label: "Knowledge", path: "/knowledge" },
];

const bottomItems = [
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === "/chat") {
      return pathname === "/chat";
    }
    return pathname.startsWith(path);
  };

  const NavButton = ({
    icon: Icon,
    label,
    path,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    path: string;
  }) => {
    const active = isActive(path);
    const button = (
      <button
        onClick={() => router.push(path)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
          collapsed ? "justify-center px-2" : "px-3",
          active
            ? "bg-brand-primary/10 text-brand-primary"
            : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );

    if (collapsed) {
      return <Tooltip content={label} side="right">{button}</Tooltip>;
    }
    return button;
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-bg-surface transition-all duration-300",
        collapsed ? "w-[48px]" : "w-[220px]"
      )}
    >
      {/* Logo Area */}
      <div
        className={cn(
          "flex h-12 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "gap-2"
        )}
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-primary">
          <span className="text-xs font-bold text-white">DC</span>
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary">D2C</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavButton key={item.path} {...item} />
        ))}
      </nav>

      {/* Bottom Items */}
      <div className="border-t border-border p-2 space-y-1">
        {bottomItems.map((item) => (
          <NavButton key={item.path} {...item} />
        ))}
      </div>
    </aside>
  );
}
