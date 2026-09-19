import { supabase, isSupabaseConfigured } from "./supabase";
import type { Citation } from "./ask-data";
import type { AgentPersonaId } from "./agent-settings";

/* ---------- UI Types (Compatible with chat.tsx) ---------- */

export interface ReActIteration {
  id: string;
  iteration: number;
  thought: string;
  action?: {
    tool: string;
    args: Record<string, unknown>;
  };
  observation?: string;
  status: "thinking" | "calling_tool" | "observing" | "complete";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | string[];
  timestamp: string;
  persona?: AgentPersonaId;
  taggedBooks?: string[];
  taggedCategories?: string[];
  personalContextUsed?: boolean;
  notesAccessed?: boolean;
  reactLoop?: ReActIteration[];
  reasoning?: string;
  isStreaming?: boolean;
  citations?: Citation[];
  booksReferenced?: string[];
  executionId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  persona: AgentPersonaId;
}

export interface TelemetryPayload {
  sessionId: string;
  messageId: string;
  executionId?: string;
  effortTier?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  modelName?: string;
  toolCallsCount?: number;
  planThought?: string;
}

/* ---------- Utility: Safe UUID Generator ---------- */

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator if crypto.randomUUID is not available
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ---------- In-Memory Cache for 0ms Session Switching ---------- */

const sessionMessageCache = new Map<string, ChatMessage[]>();

/* ---------- Cloud Chat Service ---------- */

/**
 * Fetches all chat sessions from Supabase for the current user.
 * Falls back to an empty list if Supabase is unconfigured or offline.
 */
export async function fetchCloudSessions(): Promise<ChatSession[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    let query = supabase
      .from("chat_sessions")
      .select("id, title, persona, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[ChatService] Failed to fetch sessions:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title || "Untitled Conversation",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: sessionMessageCache.get(row.id) || [],
      persona: (row.persona as AgentPersonaId) || "balanced",
    }));
  } catch (err) {
    console.error("[ChatService] Unexpected error fetching sessions:", err);
    return [];
  }
}

/**
 * Fetches message history for a specific session.
 * Uses the in-memory cache when available to eliminate loading flickers.
 */
export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured || !sessionId) return [];

  if (sessionMessageCache.has(sessionId)) {
    return sessionMessageCache.get(sessionId)!;
  }

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, citations, books_referenced, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn(`[ChatService] Failed to fetch messages for session ${sessionId}:`, error.message);
      return [];
    }

    const messages: ChatMessage[] = (data || []).map((row) => {
      const parsedParagraphs = typeof row.content === "string" ? row.content.split(/\n\n+/) : [row.content];
      const timeStr = row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

      return {
        id: row.id,
        role: row.role as "user" | "assistant",
        content: parsedParagraphs,
        timestamp: timeStr,
        citations: (row.citations as Citation[]) || [],
        booksReferenced: row.books_referenced || [],
      };
    });

    sessionMessageCache.set(sessionId, messages);
    return messages;
  } catch (err) {
    console.error(`[ChatService] Error loading messages for ${sessionId}:`, err);
    return [];
  }
}

/**
 * Creates a new chat session in Supabase.
 */
export async function createCloudSession(
  title: string = "New Conversation",
  persona: AgentPersonaId = "balanced"
): Promise<ChatSession> {
  const newId = generateUuid();
  const now = new Date().toISOString();

  const newSession: ChatSession = {
    id: newId,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    persona,
  };

  sessionMessageCache.set(newId, []);

  if (!isSupabaseConfigured) return newSession;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    await supabase.from("chat_sessions").insert({
      id: newId,
      user_id: userId,
      title,
      persona,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    console.error("[ChatService] Failed to persist new session to cloud:", err);
  }

  return newSession;
}

/**
 * Deletes a session and clears its cache.
 */
export async function deleteCloudSession(sessionId: string): Promise<void> {
  sessionMessageCache.delete(sessionId);
  if (!isSupabaseConfigured || !sessionId) return;

  try {
    await supabase.from("chat_sessions").delete().eq("id", sessionId);
  } catch (err) {
    console.error(`[ChatService] Failed to delete session ${sessionId}:`, err);
  }
}

/**
 * Updates a conversation title in Supabase (e.g. after the first message).
 */
export async function updateCloudSessionTitle(sessionId: string, title: string): Promise<void> {
  if (!isSupabaseConfigured || !sessionId) return;

  try {
    await supabase
      .from("chat_sessions")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch (err) {
    console.warn(`[ChatService] Failed to update title for ${sessionId}:`, err);
  }
}

/**
 * Persists a user message, assistant message, and telemetry metrics asynchronously
 * in the background WITHOUT blocking the user or the UI.
 */
export function persistTurnInBackground(params: {
  sessionId: string;
  userMessage: {
    id?: string;
    content: string;
    taggedBooks?: string[];
  };
  assistantMessage: {
    id?: string;
    content: string | string[];
    citations?: Citation[];
    booksReferenced?: string[];
  };
  telemetry?: Partial<TelemetryPayload>;
}): void {
  // Fire and forget — run non-blockingly
  (async () => {
    if (!isSupabaseConfigured) return;

    try {
      const userMsgId = params.userMessage.id || generateUuid();
      const assistantMsgId = params.assistantMessage.id || generateUuid();

      const assistantText = Array.isArray(params.assistantMessage.content)
        ? params.assistantMessage.content.join("\n\n")
        : params.assistantMessage.content;

      // Ensure session exists in DB to prevent foreign key violation
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", params.sessionId)
        .maybeSingle();

      if (!existingSession) {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("chat_sessions").insert({
          id: params.sessionId,
          user_id: userData?.user?.id ?? null,
          title: "New Conversation",
        });
      }

      // 1. Insert Messages first so assistantMsgId is committed
      const { error: msgError } = await supabase.from("chat_messages").insert([
        {
          id: userMsgId,
          session_id: params.sessionId,
          role: "user",
          content: params.userMessage.content,
          books_referenced: params.userMessage.taggedBooks || [],
        },
        {
          id: assistantMsgId,
          session_id: params.sessionId,
          role: "assistant",
          content: assistantText,
          citations: params.assistantMessage.citations || [],
          books_referenced: params.assistantMessage.booksReferenced || [],
        },
      ]);

      if (msgError) {
        console.error("[ChatService] Failed to insert messages:", msgError.message);
        return;
      }

      // 2. Insert Telemetry record referencing the committed message_id
      if (params.telemetry) {
        const { error: telError } = await supabase.from("chat_telemetry").insert({
          session_id: params.sessionId,
          message_id: assistantMsgId,
          execution_id: params.telemetry.executionId ?? null,
          effort_tier: params.telemetry.effortTier ?? "low",
          latency_ms: params.telemetry.latencyMs ?? null,
          prompt_tokens: params.telemetry.promptTokens ?? 0,
          completion_tokens: params.telemetry.completionTokens ?? 0,
          total_tokens: params.telemetry.totalTokens ?? 0,
          estimated_cost_usd: params.telemetry.estimatedCostUsd ?? 0.0,
          model_name: params.telemetry.modelName ?? null,
          tool_calls_count: params.telemetry.toolCallsCount ?? 0,
          plan_thought: params.telemetry.planThought ?? null,
        });

        if (telError) {
          console.error("[ChatService] Failed to record telemetry:", telError.message, telError.details);
        } else {
          console.info("[ChatService] Telemetry successfully recorded in cloud.");
        }
      }
    } catch (err) {
      console.warn("[ChatService] Background persistence encountered an issue:", err);
    }
  })();
}

/**
 * Submits user feedback (thumbs up / thumbs down) for an assistant message.
 */
export async function submitMessageFeedback(
  messageId: string,
  feedback: "thumbs_up" | "thumbs_down" | "flagged",
  comment?: string
): Promise<void> {
  if (!isSupabaseConfigured || !messageId) return;

  try {
    await supabase
      .from("chat_telemetry")
      .update({
        user_feedback: feedback,
        feedback_comment: comment ?? null,
      })
      .eq("message_id", messageId);
  } catch (err) {
    console.warn(`[ChatService] Failed to record feedback for ${messageId}:`, err);
  }
}
