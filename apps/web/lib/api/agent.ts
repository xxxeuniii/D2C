import { client } from "./client";

export interface StartAgentRunParams {
  type: string;
  input?: Record<string, any>;
}

export interface AgentRunResponse {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "error";
  steps: any[];
  result?: any;
}

export async function startAgentRun(
  params: StartAgentRunParams
): Promise<AgentRunResponse> {
  const response = await client.post<AgentRunResponse>(
    "/agent/run",
    params
  );
  return response.data;
}

export async function getAgentRunStatus(
  runId: string
): Promise<AgentRunResponse> {
  const response = await client.get<AgentRunResponse>(
    `/agent/run/${runId}`
  );
  return response.data;
}

export async function confirmAgentStep(
  runId: string,
  stepId: string,
  confirmed: boolean
): Promise<void> {
  await client.post(`/agent/run/${runId}/confirm`, {
    stepId,
    confirmed,
  });
}
