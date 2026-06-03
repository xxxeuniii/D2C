"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { RightPanel } from "@/components/layout/RightPanel";
import { TopBar } from "@/components/layout/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base">
      {/* Top Bar */}
      <TopBar
        onToggleSidebar={toggleSidebar}
        onToggleRightPanel={toggleRightPanel}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} />

        {/* Center Content */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {children}
        </main>

        {/* Right Panel */}
        <RightPanel open={rightPanelOpen} onClose={() => setRightPanelOpen(false)} />
      </div>
    </div>
  );
}
