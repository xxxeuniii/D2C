// ============================================
// Chat Types
// ============================================

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: {
    tokens?: number;
    model?: string;
    files?: string[];
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt?: string;
}

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
  fills?: any[];
  strokes?: any[];
  effects?: any[];
  style?: Record<string, any>;
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
  componentLib?: string;
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
// Agent Types
// ============================================

export interface ToolCall {
  name: string;
  status: "running" | "completed" | "error";
  input?: Record<string, any>;
  output?: string | Record<string, any>;
  error?: string;
  timestamp?: string;
}

export interface AgentStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  output?: string;
  toolCalls?: ToolCall[];
  startedAt?: string;
  completedAt?: string;
}

export interface AgentRun {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "error";
  steps: AgentStep[];
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// ============================================
// API Types
// ============================================

export interface APIResponse<T = any> {
  data: T;
  message?: string;
  code?: number;
}

export interface APIError {
  error: string;
  message: string;
  status: number;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// SSE Types
// ============================================

export interface SSEEvent {
  type: "message" | "done" | "error" | "tool_call";
  data: string;
  id?: string;
}

// ============================================
// UI Types
// ============================================

export interface NavItem {
  icon: string;
  label: string;
  path: string;
  badge?: number;
}

export interface FileTab {
  id: string;
  name: string;
  language: string;
  code: string;
}
