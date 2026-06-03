"use client";

import { cn } from "@/lib/utils/cn";
import { usePathname, useRouter } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import { Figma, Database, Wrench } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
}

const navItems = [
  { icon: Figma, label: "Figma \u2192 Code", path: "/figma2code" },
  { icon: Wrench, label: "Agent Workflow", path: "/agent" },
  { icon: Database, label: "Knowledge Base", path: "/knowledge" },
];

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => pathname.startsWith(path);

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
            ? "bg-brand-primary/15 text-brand-primary border border-brand-primary/20"
            : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );

    if (collapsed) return <Tooltip content={label} side="right">{button}</Tooltip>;
    return button;
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-bg-surface transition-all duration-300",
        collapsed ? "w-[48px]" : "w-[200px]"
      )}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "gap-2"
        )}
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-primary">
          <span className="text-xs font-bold text-text-inverse">DC</span>
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary">D2C</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavButton key={item.path} {...item} />
        ))}
      </nav>
    </aside>
  );
}
