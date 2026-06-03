import { create } from "zustand";
import { RAGDocument } from "@/types";

interface RAGState {
  documents: RAGDocument[];
  isLoading: boolean;
  error: string | null;

  setDocuments: (docs: RAGDocument[]) => void;
  addDocument: (doc: RAGDocument) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<RAGDocument>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRAGStore = create<RAGState>((set) => ({
  documents: [],
  isLoading: false,
  error: null,

  setDocuments: (documents) => set({ documents }),
  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    })),
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
