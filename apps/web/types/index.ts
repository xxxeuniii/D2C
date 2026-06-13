// ============================================
// Figma Types
// ============================================

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  style?: Record<string, unknown>;
}

export interface GeneratedCodeFile {
  name: string;
  code: string;
  language: string;
  path?: string;
}

export interface FigmaAnalysis {
  taskId: string;
  status: "pending" | "processing" | "completed" | "error";
  url?: string;
  framework?: string;
  nodes?: FigmaNode[];
  previewUrl?: string;
  generatedCode?: string | GeneratedCodeFile[] | Record<string, string>;
  error?: string;
  metadata?: {
    nodeCount?: number;
    componentCount?: number;
    processingTime?: number;
  };
}

// ============================================
// RAG Types
// ============================================

export interface RAGDocument {
  id: string;
  name: string;
  type: "document" | "folder";
  size?: string;
  updatedAt: string;
  status: "ready" | "processing" | "error";
  chunks?: number;
}

export interface RAGSearchResult {
  document: RAGDocument;
  chunk: string;
  score: number;
}

// ============================================
// Pipeline Types
// ============================================

export interface PipelineStep {
  agent: number;
  name: string;
  status: "running" | "completed" | "error" | "pending";
  output?: string;
  figmaData?: {
    fileName: string;
    totalNodes: number;
    pages: number;
    tree: FigmaNode;
  };
}

export interface PipelineRunResult {
  runId: string;
  status: "running" | "completed" | "error";
  steps: PipelineStep[];
  result?: {
    code: string;
    validation: string;
  };
  error?: string;
}

// ============================================
// API Types
// ============================================

export interface APIResponse<T = unknown> {
  data: T;
  message?: string;
  code?: number;
}

export interface APIError {
  error: string;
  message: string;
  status: number;
}
