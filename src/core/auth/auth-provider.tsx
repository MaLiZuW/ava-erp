"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabase, isSupabaseConfigured } from "@/core/supabase/client";
import {
  linkTypeFromHash,
  MUST_SET_PASSWORD_KEY,
  resolveAuthStatus,
  type AppRole,
  type AuthStatus,
} from "./status";

export interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  roles: AppRole[];
  /** re-reads session, assurance level and roles (after sign-in, MFA verification …) */
  refresh: () => Promise<AuthStatus>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Exposed for tests and for pages that render outside the provider in isolation. */
export const AuthContextProvider = AuthContext.Provider;

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

type Snapshot = Omit<AuthState, "refresh" | "signOut">;

const SIGNED_OUT: Snapshot = {
  status: "signed-out",
  userId: null,
  email: null,
  fullName: null,
  roles: [],
};

async function readSnapshot(): Promise<Snapshot> {
  if (!isSupabaseConfigured()) return { ...SIGNED_OUT, status: "config-error" };
  const sb = getSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData.session;
  if (!session) return SIGNED_OUT;

  const { data: aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return SIGNED_OUT;
  const mustSetPassword = window.sessionStorage.getItem(MUST_SET_PASSWORD_KEY) === "1";
  const status = resolveAuthStatus(true, aal.currentLevel, aal.nextLevel, mustSetPassword);
  const base: Snapshot = {
    status,
    userId: session.user.id,
    email: session.user.email ?? null,
    fullName: null,
    roles: [],
  };
  if (status !== "ready") return base;

  // with aal2 the database returns the user's own roles and profile (RLS)
  const [roles, profile] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", session.user.id),
    sb.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
  ]);
  return {
    ...base,
    roles: (roles.data ?? []).map((r) => r.role),
    fullName: profile.data?.full_name ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    ...SIGNED_OUT,
    status: isSupabaseConfigured() ? "loading" : "config-error",
  }));

  const refresh = useCallback(async () => {
    const next = await readSnapshot();
    setSnapshot(next);
    return next.status;
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      // "local" revokes this session's refresh token on the server and clears the browser storage
      await getSupabase().auth.signOut({ scope: "local" });
    }
    window.sessionStorage.removeItem(MUST_SET_PASSWORD_KEY);
    queryClient.clear();
    setSnapshot(SIGNED_OUT);
  }, [queryClient]);

  useEffect(() => {
    // must run before the client parses (and removes) the URL fragment of an invitation link
    if (linkTypeFromHash(window.location.hash)) {
      window.sessionStorage.setItem(MUST_SET_PASSWORD_KEY, "1");
    }
    if (!isSupabaseConfigured()) return;
    // the first event (INITIAL_SESSION) arrives right after subscribing and triggers the first read
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      // never call Supabase synchronously inside the callback (auth lock) – defer
      setTimeout(() => {
        if (event === "SIGNED_OUT") queryClient.clear();
        void refresh();
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, queryClient]);

  const value = useMemo<AuthState>(
    () => ({ ...snapshot, refresh, signOut }),
    [snapshot, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
