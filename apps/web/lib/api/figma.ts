import { client } from "./client";

// ============================================
// Figma API（对齐后端 /api/figma/*）
// ============================================

export interface FigmaAnalyzeParams {
  url: string;
  framework: string;
  token?: string;
}

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

export interface FigmaAnalysisResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "error";
  nodes?: FigmaNode[];
  previewUrl?: string;
  generatedCode?: unknown;
  error?: string;
}

/** 分析 Figma 文件（对齐后端 /api/figma/analyze） */
export async function analyzeFigmaFile(
  params: FigmaAnalyzeParams
): Promise<FigmaAnalysisResult> {
  const response = await client.post<FigmaAnalysisResult>("/figma/analyze", params);
  return response.data;
}

/** 查询 Figma 分析状态 */
export async function getFigmaAnalysisStatus(
  taskId: string
): Promise<FigmaAnalysisResult> {
  const response = await client.get<FigmaAnalysisResult>(
    `/figma/analyze/${taskId}`
  );
  return response.data;
}

/** 获取 Figma 配置（Token 等） */
export async function getFigmaConfig(): Promise<{ token: string }> {
  const response = await client.get<{ token: string }>("/figma/config");
  return response.data;
}
