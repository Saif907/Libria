import { createClient } from "@supabase/supabase-js";

function getEnvVar(key: string): string | undefined {
  // 1. Cloudflare runtime context
  const cf = (globalThis as unknown as { __CLOUDFLARE_ENV__?: Record<string, string> })
    ?.__CLOUDFLARE_ENV__;
  if (cf?.[key]) return cf[key];
  if (cf?.[`VITE_${key}`]) return cf[`VITE_${key}`];

  // 2. Standard process.env
  if (typeof process !== "undefined" && process.env) {
    if (process.env[key]) return process.env[key];
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
    for (const [k, v] of Object.entries(process.env)) {
      if ((k.trim() === key || k.trim() === `VITE_${key}`) && v) {
        return v.trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  // 3. Vite client / SSR import.meta.env
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (meta?.[key]) return meta[key];
    if (meta?.[`VITE_${key}`]) return meta[`VITE_${key}`];
  } catch {
    // Ignore environments where import.meta is unavailable
  }

  // 4. Cloudflare Worker globalThis binding
  const globalObj = globalThis as Record<string, unknown>;
  const globalVal = globalObj[key] ?? globalObj[`VITE_${key}`];
  if (typeof globalVal === "string" && globalVal !== "") return globalVal;

  return undefined;
}

const supabaseUrl =
  getEnvVar("VITE_SUPABASE_URL") ??
  getEnvVar("SUPABASE_URL");

const supabaseKey =
  getEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  getEnvVar("SUPABASE_PUBLISHABLE_KEY") ??
  getEnvVar("VITE_SUPABASE_ANON_KEY") ??
  getEnvVar("SUPABASE_ANON_KEY");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[Supabase] Warning: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment. " +
      "Supabase client initialized in safe fallback mode. " +
      "Please configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Cloudflare Pages dashboard -> Settings -> Environment variables.",
  );
}

// Fallback client prevents catastrophic SSR crash if environment variables are not yet configured in Cloudflare Pages
export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseKey || "dummy-publishable-anon-key-placeholder",
);

