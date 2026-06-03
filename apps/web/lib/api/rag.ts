import { client } from "./client";
import { RAGDocument } from "@/types";

export interface UploadDocumentParams {
  file: File;
  name: string;
}

export async function getDocuments(): Promise<RAGDocument[]> {
  const response = await client.get<RAGDocument[]>("/rag/documents");
  return response.data;
}

export async function uploadDocument(
  params: UploadDocumentParams
): Promise<RAGDocument> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("name", params.name);

  const response = await client.post<RAGDocument>("/rag/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await client.delete(`/rag/documents/${id}`);
}

export async function searchDocuments(
  query: string,
  topK: number = 5
): Promise<{ documents: RAGDocument[]; scores: number[] }> {
  const response = await client.post("/rag/search", { query, topK });
  return response.data;
}
