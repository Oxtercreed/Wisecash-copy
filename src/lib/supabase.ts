import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Credentials resolution order:
 * 1. localStorage (set via the in-app Connect form — survives reloads on this device)
 * 2. Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env)
 * After saving via the form we reload, so the client is created once with the right values.
 */
const LS_URL = "sd_supabase_url";
const LS_KEY = "sd_supabase_anon_key";

function readCreds(): { url: string; anonKey: string } {
  let lsUrl: string | null = null;
  let lsKey: string | null = null;
  if (typeof localStorage !== "undefined") {
    lsUrl = localStorage.getItem(LS_URL);
    lsKey = localStorage.getItem(LS_KEY);
  }
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return {
    url: (lsUrl || envUrl || "").trim(),
    anonKey: (lsKey || envKey || "").trim(),
  };
}

export const supabaseCredentials = readCreds();

export const hasSupabaseEnv = Boolean(
  supabaseCredentials.url.startsWith("http") &&
    supabaseCredentials.anonKey.length > 20
);

/** True when credentials were entered via the in-app form (shows a "reset" escape hatch). */
export function usingLocalCredentials(): boolean {
  if (typeof localStorage === "undefined") return false;
  return Boolean(localStorage.getItem(LS_URL));
}

export const supabase: SupabaseClient = createClient(
  supabaseCredentials.url || "http://localhost:54321",
  supabaseCredentials.anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export function saveSupabaseCredentials(url: string, anonKey: string) {
  localStorage.setItem(LS_URL, url.trim().replace(/\/+$/, ""));
  localStorage.setItem(LS_KEY, anonKey.trim());
}

export function clearSupabaseCredentials() {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
}

export async function verifySupabaseCredentials(
  url: string,
  anonKey: string
): Promise<{ ok: boolean; message?: string }> {
  const base = url.trim().replace(/\/+$/, "");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base}/auth/v1/health`, {
      headers: { apikey: anonKey.trim() },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403)
      return { ok: false, message: "The key was rejected. Make sure you copied the anon/public key (not the service_role key)." };
    return { ok: false, message: `The server answered with status ${res.status}. Double-check both values.` };
  } catch {
    return { ok: false, message: "Could not reach that URL. Check the Project URL and your internet connection." };
  }
}
