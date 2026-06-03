import { client } from "./client";

export interface FigmaAnalyzeParams {
  url: string;
  framework: string;
  token: string;
}

export interface FigmaAnalysisResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "error";
  nodes?: any;
  previewUrl?: string;
  generatedCode?: any;
  error?: string;
}

export async function analyzeFigmaFile(
  params: FigmaAnalyzeParams
): Promise<FigmaAnalysisResult> {
  const response = await client.post<FigmaAnalysisResult>("/figma", params);
  return response.data;
}

export async function getFigmaAnalysisStatus(
  taskId: string
): Promise<FigmaAnalysisResult> {
  const response = await client.get<FigmaAnalysisResult>(
    `/figma?taskId=${taskId}`
  );
  return response.data;
}
