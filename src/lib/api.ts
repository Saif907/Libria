/**
 * Libria RAG — Frontend Backend API Client
 *
 * Communicates with the FastAPI backend for file uploads, live indexing job polling,
 * and vector-backed RAG queries.
 */

export type IndexingStage =
  | "queued"
  | "parsing_pdf"
  | "storing"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

export type IndexingJobStatus =
  | "queued"
  | "in_progress"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled";

export interface IndexingJobResponse {
  job_id: string;
  book_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  status: IndexingJobStatus;
  current_stage: IndexingStage;
  progress_percent: number;
  chunks_indexed: number;
  total_tokens: number;
  version: number;
  skipped_duplicate: boolean;
  cancel_requested?: boolean;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
  elapsed_seconds?: number | null;
}

export interface BookUploadResponse {
  job_id: string;
  book_id: string;
  status: string;
  current_stage: IndexingStage;
  message: string;
  poll_url: string;
}

export interface UploadBookPayload {
  file: File;
  title: string;
  author: string;
  categories: string[];
  description?: string;
  mode?: "index" | "attach_only";
  force_reindex?: boolean;
}

const API_BASE = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "https://libria-backend-996542170705.us-central1.run.app"
).replace(/\/$/, "");

/**
 * Uploads a book file (PDF or Markdown) to the backend pipeline.
 */
export async function uploadBookApi(payload: UploadBookPayload): Promise<BookUploadResponse> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("title", payload.title.trim());
  formData.append("author", (payload.author || "Unknown Author").trim());
  formData.append("categories", JSON.stringify(payload.categories));
  if (payload.description) {
    formData.append("description", payload.description.trim());
  }
  formData.append("mode", payload.mode || "index");
  formData.append("force_reindex", String(Boolean(payload.force_reindex)));

  const response = await fetch(`${API_BASE}/api/v1/books/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `Upload failed (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Keep default error text
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

/**
 * Retrieves the live status of an asynchronous background indexing job.
 */
export async function pollJobApi(jobId: string): Promise<IndexingJobResponse> {
  const response = await fetch(`${API_BASE}/api/v1/books/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to check job progress (${response.status})`);
  }
  return response.json();
}

/**
 * Requests atomic cancellation and rollback of an active indexing job.
 */
export async function cancelJobApi(jobId: string): Promise<IndexingJobResponse> {
  const response = await fetch(`${API_BASE}/api/v1/books/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to request job cancellation (${response.status})`);
  }
  return response.json();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Libria Agent Chat API Client
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ChatApiCitation {
  book_title: string;
  author?: string;
  section?: string;
  quote?: string;
  chunk_id?: string;
  source_call_id?: string;
  relevance_score?: number;
}

export interface ChatApiRequest {
  query: string;
  effort_tier?: "low" | "medium" | "high";
  active_book_id?: string | null;
  tagged_books?: string[] | null;
  tagged_categories?: string[] | null;
  images?: string[] | null;
}

export interface ChatApiResponse {
  execution_id: string;
  effort_tier: string;
  answer: string;
  citations: ChatApiCitation[];
  books_referenced: string[];
  is_conversational: boolean;
  plan_thought?: string | null;
  total_tool_calls: number;
  total_latency_ms: number;
}

/**
 * Sends a self-development question to the Libria RAG agent backend.
 */
export async function askLibriaApi(payload: ChatApiRequest): Promise<ChatApiResponse> {
  const response = await fetch(`${API_BASE}/api/v1/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: payload.query.trim(),
      effort_tier: payload.effort_tier || "low",
      active_book_id: payload.active_book_id || null,
      tagged_books: payload.tagged_books || null,
      tagged_categories: payload.tagged_categories || null,
      images: payload.images || null,
    }),
  });

  if (!response.ok) {
    let errorDetail = `Agent request failed (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Use fallback error message
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Direct Fast-Path Reading Explanation API Client
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ExplainPassagePayload {
  passage?: string;
  page_number?: number;
  page_image?: string;
  book_id?: string;
  book_title?: string;
  query?: string;
}

export interface ExplainPassageResponse {
  explanation: string;
  book_title?: string;
  page_number?: number;
  passage_snippet?: string;
  latency_ms: number;
}

/**
 * Fast-path direct explanation for highlighted excerpts and page snapshots.
 * Bypasses agent retrieval overhead for sub-second responses.
 */
export async function explainPassageApi(
  payload: ExplainPassagePayload
): Promise<ExplainPassageResponse> {
  const response = await fetch(`${API_BASE}/api/v1/reading/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `Explanation request failed (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Fallback error
    }
    throw new Error(errorDetail);
  }

  return response.json();
}
