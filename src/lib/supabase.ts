import { createClient } from "@supabase/supabase-js";

// 1. Direct static references without optional chaining so Vite AST replacement inlines them at compile time
const viteStaticUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL
    : undefined;

const viteStaticKey =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
       import.meta.env.VITE_SUPABASE_ANON_KEY)
    : undefined;

// 2. Dynamic runtime lookup for SSR / Cloudflare Workers / Node runtimes
function getRuntimeEnvVar(key: string): string | undefined {
  // Cloudflare runtime context (__CLOUDFLARE_ENV__)
  const cf = (globalThis as unknown as { __CLOUDFLARE_ENV__?: Record<string, string> })
    ?.__CLOUDFLARE_ENV__;
  if (cf?.[key]) return cf[key];
  if (cf?.[`VITE_${key}`]) return cf[`VITE_${key}`];

  // Standard process.env
  if (typeof process !== "undefined" && process.env) {
    if (process.env[key]) return process.env[key];
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
    for (const [k, v] of Object.entries(process.env)) {
      if ((k.trim() === key || k.trim() === `VITE_${key}`) && v) {
        return v.trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  // Cloudflare Worker globalThis binding
  const globalObj = globalThis as Record<string, unknown>;
  const globalVal = globalObj[key] ?? globalObj[`VITE_${key}`];
  if (typeof globalVal === "string" && globalVal !== "") return globalVal;

  return undefined;
}

function getBrowserEnv(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as unknown as Record<string, unknown>;
  if (typeof win[key] === "string" && (win[key] as string).trim() !== "") {
    return (win[key] as string).trim();
  }
  const envObj = win.__ENV__ as Record<string, string> | undefined;
  if (envObj?.[key] && envObj[key].trim() !== "") return envObj[key].trim();
  if (envObj?.[`VITE_${key}`] && envObj[`VITE_${key}`].trim() !== "") return envObj[`VITE_${key}`].trim();
  return undefined;
}

function isValidHttpUrl(candidate: string | undefined): boolean {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const rawUrl =
  (typeof viteStaticUrl === "string" && viteStaticUrl.trim() !== "" ? viteStaticUrl.trim() : undefined) ??
  getBrowserEnv("VITE_SUPABASE_URL") ??
  getBrowserEnv("SUPABASE_URL") ??
  getRuntimeEnvVar("VITE_SUPABASE_URL") ??
  getRuntimeEnvVar("SUPABASE_URL");

const rawKey =
  (typeof viteStaticKey === "string" && viteStaticKey.trim() !== "" ? viteStaticKey.trim() : undefined) ??
  getBrowserEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  getBrowserEnv("VITE_SUPABASE_ANON_KEY") ??
  getBrowserEnv("SUPABASE_PUBLISHABLE_KEY") ??
  getBrowserEnv("SUPABASE_ANON_KEY") ??
  getRuntimeEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  getRuntimeEnvVar("SUPABASE_PUBLISHABLE_KEY") ??
  getRuntimeEnvVar("VITE_SUPABASE_ANON_KEY") ??
  getRuntimeEnvVar("SUPABASE_ANON_KEY");

export const isSupabaseConfigured = Boolean(
  rawUrl &&
    rawKey &&
    isValidHttpUrl(rawUrl) &&
    !rawUrl.includes("placeholder-project") &&
    !rawUrl.includes("your-project-id") &&
    !rawKey.includes("dummy-publishable") &&
    !rawKey.includes("sb_publishable_xxxxxxxxxxxxxxxx")
);

const supabaseUrl = isSupabaseConfigured ? rawUrl! : "https://placeholder-project.supabase.co";
const supabaseKey = isSupabaseConfigured ? rawKey! : "dummy-publishable-anon-key-placeholder";

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[Supabase] Warning: Missing or invalid VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment. " +
      "Supabase client initialized in safe fallback mode with network calls disabled. " +
      "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are defined in frontend/.env",
  );
}

// Client instance: in fallback mode, auto-refresh and session persistence are disabled
// to prevent any stray network calls to dummy hosts.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
});

