export type DocumentStatus = "pending" | "processing" | "done" | "failed";

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  status: DocumentStatus;
  chunk_count: number;
  created_at: string;
  error_message?: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  was_refused?: boolean;
  citations?: Citation[];
  debug?: DebugInfo;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  excerpt: string;
  rerank_score?: number;
}

export interface DebugInfo {
  rewritten_query: string;
  retrieved_count: number;
  reranked_chunks: { id: string; content: string; rerank_score: number }[];
  answerability: { verdict: string; reason: string };
  source?: string;
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  occurrence_count: number;
  last_asked_at: string;
  status: "new" | "answered" | "ignored";
  manual_answer?: string;
}

export interface HandoffRequest {
  id: string;
  tenant_id: string;
  conversation_id?: string;
  end_user_id?: string;
  summary: string;
  contact_email?: string | null;
  suggested_answer?: string | null;
  kb_added?: boolean;
  status: "new" | "read" | "resolved";
  created_at: string;
}

export interface DashboardStats {
  today_queries: number;
  today_refused: number;
  unanswered_new: number;
  daily_llm_used: number;
  daily_llm_limit: number;
}
