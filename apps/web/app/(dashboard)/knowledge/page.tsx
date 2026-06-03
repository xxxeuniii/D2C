"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRAGStore } from "@/lib/store/ragStore";
import { uploadDocument, deleteDocument } from "@/lib/api/rag";
import { RAGDocument } from "@/types";
import { generateId, formatRelativeTime } from "@/lib/utils/format";
import {
  Search,
  Plus,
  FileText,
  FolderOpen,
  Trash2,
  Upload,
  Loader2,
  MoreHorizontal,
  BookOpen,
} from "lucide-react";

export default function KnowledgePage() {
  const { documents, addDocument, removeDocument, updateDocument } =
    useRAGStore();
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = documents.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = [".pdf", ".md", ".txt", ".json", ".docx"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      alert("Supported formats: PDF, Markdown, TXT, JSON, DOCX");
      return;
    }

    const docId = generateId();
    const newDoc: RAGDocument = {
      id: docId,
      name: file.name,
      type: "document",
      size: formatFileSize(file.size),
      updatedAt: new Date().toISOString(),
      status: "processing",
    };

    addDocument(newDoc);
    setIsUploading(true);

    try {
      await uploadDocument({ file, name: file.name });

      // 模拟向量化处理
      await new Promise((r) => setTimeout(r, 2000));

      updateDocument(docId, { status: "ready" });
    } catch (err) {
      updateDocument(docId, { status: "error" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      removeDocument(id);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const statusBadge = (status: RAGDocument["status"]) => {
    const config = {
      ready: { variant: "success" as const, label: "Indexed" },
      processing: { variant: "warning" as const, label: "Indexing..." },
      error: { variant: "error" as const, label: "Failed" },
    };
    const c = config[status];
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            Knowledge Base
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Upload design specs, coding standards, and component docs for RAG
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt,.json,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Total Docs", value: documents.length, icon: FileText },
          { label: "Indexed", value: documents.filter((d) => d.status === "ready").length, icon: BookOpen },
          { label: "Processing", value: documents.filter((d) => d.status === "processing").length, icon: Loader2 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-bg-surface p-3"
          >
            <div className="flex items-center gap-2 text-text-tertiary">
              <stat.icon className="h-3.5 w-3.5" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {stat.value}
            </p>
          </div>
        ))}
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

      {/* Document List */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <ScrollArea className="h-full">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <FolderOpen className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">
                {documents.length === 0
                  ? "No documents yet"
                  : "No matching documents"}
              </p>
              <p className="mt-1 text-xs">
                Upload design specs and coding standards to enable RAG
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="w-24 px-4 py-2.5">Size</th>
                  <th className="w-32 px-4 py-2.5">Updated</th>
                  <th className="w-24 px-4 py-2.5">Status</th>
                  <th className="w-12 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 transition-colors hover:bg-bg-elevated/30 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-text-tertiary flex-shrink-0" />
                        <span className="text-sm text-text-primary truncate">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary">
                      {item.size || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-tertiary">
                      {formatRelativeTime(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1 text-text-tertiary hover:text-status-error transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
