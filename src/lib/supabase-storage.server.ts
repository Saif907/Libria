/**
 * Server-only storage client for Supabase Storage.
 *
 * SERVER ONLY. Exports here are reachable exclusively inside `createServerFn().handler()`
 * bodies, which TanStack Start strips from the client bundle. The service-role key
 * must never reach the browser.
 *
 * Fully compatible with Node.js, Cloudflare Workers, and Cloud Run runtimes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------- Config ---------- */

const DEFAULT_BUCKET = "books";
const DEFAULT_OWNER_UID = "0495ddf4-f683-4205-9ba9-6375329b0cc4";
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_CACHE_MS = (SIGNED_URL_TTL_SECONDS / 2) * 1000;
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache

function env(key: string): string | undefined {
  // 1. Cloudflare runtime context (__CLOUDFLARE_ENV__)
  const cfEnv = (globalThis as unknown as { __CLOUDFLARE_ENV__?: Record<string, string> })
    .__CLOUDFLARE_ENV__;
  if (cfEnv?.[key]) return cfEnv[key];
  if (cfEnv?.[`VITE_${key}`]) return cfEnv[`VITE_${key}`];

  // 2. Standard process.env with whitespace-trimming tolerance (handles "KEY = val")
  if (typeof process !== "undefined" && process.env) {
    if (process.env[key]) return process.env[key];
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
    for (const [k, v] of Object.entries(process.env)) {
      if ((k.trim() === key || k.trim() === `VITE_${key}`) && v) {
        return v.trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  // 3. Vite SSR import.meta.env with static property access for compiler inlining
  if (key === "SUPABASE_URL" || key === "VITE_SUPABASE_URL") {
    if (import.meta.env?.VITE_SUPABASE_URL) return import.meta.env.VITE_SUPABASE_URL;
  }
  if (
    key === "SUPABASE_SERVICE_ROLE_KEY" ||
    key === "VITE_SUPABASE_SERVICE_ROLE_KEY" ||
    key === "SUPABASE_SERVICE_KEY"
  ) {
    if (import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY) return import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if ((import.meta.env as unknown as Record<string, string>)?.SUPABASE_SERVICE_ROLE_KEY) {
      return (import.meta.env as unknown as Record<string, string>).SUPABASE_SERVICE_ROLE_KEY;
    }
  }
  if (key === "SUPABASE_BUCKET" || key === "VITE_SUPABASE_BUCKET") {
    if (import.meta.env?.VITE_SUPABASE_BUCKET) return import.meta.env.VITE_SUPABASE_BUCKET;
    if ((import.meta.env as unknown as Record<string, string>)?.SUPABASE_BUCKET) {
      return (import.meta.env as unknown as Record<string, string>).SUPABASE_BUCKET;
    }
  }
  if (key === "SUPABASE_OWNER_UID" || key === "VITE_SUPABASE_OWNER_UID") {
    if (import.meta.env?.VITE_SUPABASE_OWNER_UID) return import.meta.env.VITE_SUPABASE_OWNER_UID;
    if ((import.meta.env as unknown as Record<string, string>)?.SUPABASE_OWNER_UID) {
      return (import.meta.env as unknown as Record<string, string>).SUPABASE_OWNER_UID;
    }
  }
  const viteEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
  if (viteEnv?.[key]) return viteEnv[key];
  if (viteEnv?.[`VITE_${key}`]) return viteEnv[`VITE_${key}`];

  // 4. Cloudflare Worker globalThis binding
  const globalObj = globalThis as Record<string, unknown>;
  const globalVal = globalObj[key] ?? globalObj[`VITE_${key}`];
  if (typeof globalVal === "string" && globalVal !== "") return globalVal;

  return undefined;
}

export function supabaseStorageConfig(): {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  ownerUid: string;
} {
  const url =
    env("SUPABASE_URL") ??
    env("VITE_SUPABASE_URL");

  const serviceRoleKey =
    env("SUPABASE_SERVICE_ROLE_KEY") ??
    env("VITE_SUPABASE_SERVICE_ROLE_KEY") ??
    env("SUPABASE_SERVICE_KEY") ??
    env("VITE_SUPABASE_SERVICE_KEY");

  const bucket =
    env("SUPABASE_BUCKET") ??
    env("VITE_SUPABASE_BUCKET") ??
    DEFAULT_BUCKET;

  const ownerUid =
    env("SUPABASE_OWNER_UID") ??
    env("VITE_SUPABASE_OWNER_UID") ??
    DEFAULT_OWNER_UID;

  if (!url || !serviceRoleKey) {
    const missing: string[] = [];
    if (!url) missing.push("SUPABASE_URL / VITE_SUPABASE_URL");
    if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_SERVICE_ROLE_KEY");

    // Gather available key names safely (without values) for troubleshooting
    const cf = (globalThis as unknown as { __CLOUDFLARE_ENV__?: Record<string, string> })
      .__CLOUDFLARE_ENV__;
    const detectedKeys = [
      ...Object.keys(cf ?? {}),
      ...Object.keys(typeof process !== "undefined" && process.env ? process.env : {}),
      ...Object.keys((import.meta as unknown as { env?: Record<string, string> })?.env ?? {}),
    ];

    throw new SupabaseStorageError(
      `Missing Supabase server credentials on Cloudflare: [${missing.join(", ")}]. ` +
        `Detected environment keys: [${[...new Set(detectedKeys)].filter((k) => !k.includes("KEY") && !k.includes("SECRET") && !k.includes("JSON")).join(", ")}]`,
    );
  }

  return { url, serviceRoleKey, bucket, ownerUid };
}

/* ---------- Errors ---------- */

export class SupabaseStorageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SupabaseStorageError";
  }
}

/* ---------- Client Singleton ---------- */

let clientInstance: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (clientInstance) return clientInstance;

  const { url, serviceRoleKey } = supabaseStorageConfig();
  clientInstance = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return clientInstance;
}

/* ---------- Object Types ---------- */

export type StorageObject = {
  name: string;
  sizeBytes: number;
  updated: string;
};

export type CatalogBook = {
  id: string;
  title: string;
  author: string;
  published_date: string;
  categories: string[];
  description: string;
  has_pdf: boolean;
  has_markdown: boolean;
  status: "ready" | "pending_conversion" | "failed";
  pdf_path: string | null;
  markdown_path: string | null;
  pdf_size_bytes: number;
  markdown_size_bytes: number;
  updated_at: string;
};

export type LibraryCatalog = {
  version: string;
  user_id: string;
  updated_at: string;
  total_books: number;
  ready_books: number;
  pending_conversion_books: number;
  books: CatalogBook[];
};

/* ---------- Operations ---------- */

/**
 * Downloads a file as UTF-8 text from the Supabase bucket.
 * Returns null when the file does not exist.
 */
export async function downloadText(storagePath: string): Promise<string | null> {
  const { bucket } = supabaseStorageConfig();
  const client = getClient();

  const { data, error } = await client.storage.from(bucket).download(storagePath);
  if (error) {
    if (
      error.message?.toLowerCase().includes("not found") ||
      (error as { statusCode?: number }).statusCode === 404
    ) {
      return null;
    }
    throw new SupabaseStorageError(
      `Failed to download ${storagePath} from Supabase: ${error.message}`,
    );
  }

  if (!data) return null;
  return data.text();
}

/* ---------- Catalog In-Memory Cache & Coalescing ---------- */

type CachedCatalog = {
  data: LibraryCatalog;
  expiresAt: number;
};

const catalogCache = new Map<string, CachedCatalog>();
const catalogInFlight = new Map<string, Promise<LibraryCatalog | null>>();

/**
 * Reads and parses the user's master catalog.json file.
 *
 * Performance:
 * - Cached in RAM for 5 minutes (0ms response on subsequent calls).
 * - Concurrent calls are deduplicated into a single in-flight Promise to avoid stampeding.
 */
export async function loadCatalog(userUid?: string): Promise<LibraryCatalog | null> {
  const { ownerUid } = supabaseStorageConfig();
  const targetUid = userUid ?? ownerUid;

  const cached = catalogCache.get(targetUid);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  let inFlight = catalogInFlight.get(targetUid);
  if (!inFlight) {
    inFlight = fetchCatalogFromStorage(targetUid).finally(() => {
      catalogInFlight.delete(targetUid);
    });
    catalogInFlight.set(targetUid, inFlight);
  }

  const catalog = await inFlight;
  if (catalog) {
    catalogCache.set(targetUid, {
      data: catalog,
      expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    });
  }
  return catalog;
}

async function fetchCatalogFromStorage(targetUid: string): Promise<LibraryCatalog | null> {
  const catalogPath = `users/${targetUid}/catalog.json`;
  const raw = await downloadText(catalogPath);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        version: "1.0",
        user_id: targetUid,
        updated_at: new Date().toISOString(),
        total_books: parsed.length,
        ready_books: parsed.filter((b) => b.has_markdown || b.is_indexed).length,
        pending_conversion_books: 0,
        books: parsed,
      };
    }
    return parsed as LibraryCatalog;
  } catch (error) {
    console.warn(`Failed to parse catalog at ${catalogPath}:`, error);
    return null;
  }
}

/**
 * Explicitly invalidates the catalog cache (e.g. after uploading or deleting a book).
 */
export function invalidateCatalogCache(userUid?: string) {
  const { ownerUid } = supabaseStorageConfig();
  const targetUid = userUid ?? ownerUid;
  catalogCache.delete(targetUid);
}

/* ---------- Signed URL Caching ---------- */

const signedUrls = new Map<string, { url: string; expiresAt: number }>();

/**
 * Generates a short-lived signed URL for a private object so the client browser
 * can stream PDFs directly with HTTP range support.
 *
 * URLs are cached in-memory for half their TTL to avoid hitting the Supabase API
 * on every page reload or scroll event.
 */
export async function signedObjectUrl(
  storagePath: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const cached = signedUrls.get(storagePath);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const { bucket } = supabaseStorageConfig();
  const client = getClient();

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new SupabaseStorageError(
      `Could not sign URL for ${storagePath}: ${error?.message ?? "unknown error"}`,
    );
  }

  signedUrls.set(storagePath, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
  });

  return data.signedUrl;
}
