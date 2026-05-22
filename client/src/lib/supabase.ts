import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

type SupabaseAuthSnapshot = {
  session: Session | null;
  accessToken: string | null;
  ready: boolean;
};

let snapshot: SupabaseAuthSnapshot = {
  session: null,
  accessToken: null,
  ready: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSupabaseAuth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSupabaseAuthSnapshot(): SupabaseAuthSnapshot {
  return snapshot;
}

export function setSupabaseAuthSession(session: Session | null) {
  snapshot = {
    session,
    accessToken: session?.access_token ?? null,
    ready: true,
  };
  emit();
}

export async function bootstrapSupabaseAuthSession() {
  if (!supabase) {
    setSupabaseAuthSession(null);
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[Supabase] Failed to load session:", error);
  }

  setSupabaseAuthSession(data.session);
  return data.session;
}

export function getSupabaseAuthHeaders(): Record<string, string> {
  return snapshot.accessToken
    ? { Authorization: `Bearer ${snapshot.accessToken}` }
    : {};
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase Auth is not configured");
  }
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName?: string
) {
  if (!supabase) {
    throw new Error("Supabase Auth is not configured");
  }
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { full_name: displayName } : undefined,
    },
  });
}

export async function signOutSupabaseAuth() {
  if (!supabase) {
    return;
  }
  await supabase.auth.signOut();
}
