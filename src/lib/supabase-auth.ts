import { supabase, hasSupabaseConfig } from "./supabase";

export type SupabaseAuthState = {
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null;
  session: { access_token?: string; refresh_token?: string } | null;
};

export async function getSupabaseAuthState(): Promise<SupabaseAuthState> {
  if (!hasSupabaseConfig || !supabase) {
    return { user: null, session: null };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn("[Supabase] failed to load session:", error.message);
    return { user: null, session: null };
  }

  return {
    user: session?.user ?? null,
    session: session ?? null,
  };
}

export async function signInWithEmail({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseConfig || !supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function signOutSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseConfig || !supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function getSupabaseUser() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.warn("[Supabase] failed to get user:", error.message);
    return null;
  }

  return data.user;
}
