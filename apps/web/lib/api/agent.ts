import { client } from "./client";

export interface AgentRunParams {
  url: string;
  framework: string;
}

export interface AgentStepResult {
  name: string;
  status: "running" | "completed" | "error" | "pending";
  input?: string;
  output?: string;
  timestamp?: string;
}

export interface AgentRunResult {
  runId: string;
  status: "running" | "completed" | "error";
  steps: AgentStepResult[];
  result?: string;
  error?: string;
}

export async function runAgent(
  params: AgentRunParams
): Promise<AgentRunResult> {
  const response = await client.post<AgentRunResult>("/agent/run", params);
  return response.data;
}

export async function getAgentRunStatus(
  runId: string
): Promise<AgentRunResult> {
  const response = await client.get<AgentRunResult>(`/agent/run/${runId}`);
  return response.data;
}
