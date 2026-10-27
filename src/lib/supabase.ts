import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseConfig || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = getSupabaseClient();

export function isSupabaseReady(): boolean {
  return Boolean(supabase);
}
