import { supabase } from "./supabase";

/** Look up a shop by its join code (SD-XXXXXX). Returns shop id or null. */
export async function resolveJoinCode(code: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const { data, error } = await supabase.rpc("resolve_join_code", { p_code: clean });
  if (error) return null;
  return (data as string | null) ?? null;
}
