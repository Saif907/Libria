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

export type IndexingJobStatus = "pending" | "processing" | "completed" | "failed";

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
  "http://127.0.0.1:8000"
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
