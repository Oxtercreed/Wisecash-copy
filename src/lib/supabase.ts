import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseEnv = Boolean(
  url && anonKey && url.startsWith("http") && anonKey.length > 20
);

/**
 * The client is created even when env vars are missing so modules can import it
 * safely — the app shows a Setup screen and never uses it in that state.
 */
export const supabase: SupabaseClient = createClient(
  url || "http://localhost:54321",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
