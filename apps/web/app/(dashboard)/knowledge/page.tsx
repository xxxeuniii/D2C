"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

interface KnowledgeItem {
  id: string;
  name: string;
  type: "document" | "folder";
  size?: string;
  updatedAt: string;
  status: "ready" | "processing" | "error";
}

const mockItems: KnowledgeItem[] = [
  {
    id: "1",
    name: "设计规范文档.pdf",
    type: "document",
    size: "2.4 MB",
    updatedAt: "2026-06-03",
    status: "ready",
  },
  {
    id: "2",
    name: "组件库说明",
    type: "folder",
    updatedAt: "2026-06-02",
    status: "ready",
  },
  {
    id: "3",
    name: "API 接口文档.md",
    type: "document",
    size: "156 KB",
    updatedAt: "2026-06-01",
    status: "processing",
  },
  {
    id: "4",
    name: "项目架构设计.md",
    type: "document",
    size: "892 KB",
    updatedAt: "2026-05-30",
    status: "ready",
  },
  {
    id: "5",
    name: "旧版文档(已废弃)",
    type: "folder",
    updatedAt: "2026-05-28",
    status: "error",
  },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");

  const filtered = mockItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: KnowledgeItem["status"]) => {
    switch (status) {
      case "ready":
        return <Badge variant="success">Ready</Badge>;
      case "processing":
        return <Badge variant="warning">Processing</Badge>;
      case "error":
        return <Badge variant="error">Error</Badge>;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Knowledge Base
          </h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Manage documents and context for AI
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          placeholder="Search knowledge base..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="rounded-lg border border-border">
          {/* Table Header */}
          <div className="flex items-center border-b border-border px-4 py-3 text-xs font-medium text-text-tertiary">
            <div className="flex-1">Name</div>
            <div className="w-24">Size</div>
            <div className="w-28">Updated</div>
            <div className="w-24">Status</div>
            <div className="w-10"></div>
          </div>

          {/* Table Body */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <FolderOpen className="mb-3 h-10 w-10" />
              <p className="text-sm">No documents found</p>
              <p className="mt-1 text-xs">
                Upload documents to build your knowledge base
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center border-b border-border/50 px-4 py-3 transition-colors hover:bg-bg-elevated/50 last:border-0"
              >
                <div className="flex flex-1 items-center gap-3">
                  {item.type === "folder" ? (
                    <FolderOpen className="h-5 w-5 text-brand-secondary" />
                  ) : (
                    <FileText className="h-5 w-5 text-text-tertiary" />
                  )}
                  <span className="text-sm text-text-primary">{item.name}</span>
                </div>
                <div className="w-24 text-sm text-text-tertiary">
                  {item.size || "-"}
                </div>
                <div className="w-28 text-sm text-text-tertiary">
                  {item.updatedAt}
                </div>
                <div className="w-24">{statusBadge(item.status)}</div>
                <div className="w-10 text-right">
                  <button className="rounded p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
