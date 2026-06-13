import { client } from "./client";

// ============================================
// 流水线 API（对齐后端 /api/pipeline/*）
// ============================================

export interface PipelineRunParams {
  url: string;
  framework: string;
  componentLib: string;
  figmaToken?: string;
}

export interface PipelineStep {
  agent: number;
  name: string;
  status: "running" | "completed" | "error" | "pending";
  output?: string;
  figmaData?: Record<string, unknown>;
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

/** 启动流水线（Simple Chain 模式） */
export async function runPipeline(
  params: PipelineRunParams
): Promise<PipelineRunResult> {
  const response = await client.post<PipelineRunResult>("/pipeline/run", params);
  return response.data;
}

/** 查询流水线运行状态 */
export async function getPipelineRunStatus(
  runId: string
): Promise<PipelineRunResult> {
  const response = await client.get<PipelineRunResult>(`/pipeline/run/${runId}`);
  return response.data;
}

/** 启动 Agent 模式流水线 */
export async function runAgentPipeline(
  params: PipelineRunParams
): Promise<PipelineRunResult> {
  const response = await client.post<PipelineRunResult>("/pipeline/agent/run", params);
  return response.data;
}

// ============================================
// Chat API
// ============================================

export interface ChatRequest {
  message: string;
  runId?: string;
  sessionId?: string;
}

export interface ChatResult {
  status: "completed" | "error";
  reply: string;
  current_code: string;
  session_id: string;
  error?: string;
}

/** 多轮对话修改代码 */
export async function chatWithAgent(
  params: ChatRequest
): Promise<ChatResult> {
  const response = await client.post<ChatResult>("/pipeline/chat", params);
  return response.data;
}

/** 重置 Chat 会话 */
export async function resetChat(sessionId: string): Promise<void> {
  await client.post("/pipeline/chat/reset", { session_id: sessionId });
}
