import { clearDevSession, safeLocalStorageSetItem, getDevSessionOpenId } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  getSupabaseAuthSnapshot,
  signOutSupabaseAuth,
  subscribeSupabaseAuth,
} from "@/lib/supabase";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/" } =
    options ?? {};
  const utils = trpc.useUtils();
  const devSessionOpenId = getDevSessionOpenId();
  const supabaseAuth = useSyncExternalStore(
    subscribeSupabaseAuth,
    getSupabaseAuthSnapshot,
    getSupabaseAuthSnapshot
  );

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !devSessionOpenId,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      clearDevSession();
      await signOutSupabaseAuth();
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      clearDevSession();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  useEffect(() => {
    if (devSessionOpenId) return;
    safeLocalStorageSetItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
  }, [devSessionOpenId, meQuery.data]);

  const state = useMemo(() => {
    const devUser = devSessionOpenId
      ? {
          id: devSessionOpenId === "dev-admin" ? 2 : devSessionOpenId === "dev-reviewer" ? 3 : 1,
          openId: devSessionOpenId,
          name: devSessionOpenId === "dev-admin" ? "Demo Admin" : devSessionOpenId === "dev-reviewer" ? "Demo Reviewer" : "Demo Teacher",
          email: devSessionOpenId === "dev-admin" ? "admin@demo.local" : devSessionOpenId === "dev-reviewer" ? "reviewer@demo.local" : "teacher@demo.local",
          loginMethod: "dev",
          role: devSessionOpenId === "dev-admin" ? "admin" : devSessionOpenId === "dev-reviewer" ? "reviewer" : "teacher",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null;
    return {
    user: devUser ?? meQuery.data ?? null,
      loading: devSessionOpenId
        ? logoutMutation.isPending
        : (!supabaseAuth.ready || meQuery.isLoading || logoutMutation.isPending),
      error: devSessionOpenId ? logoutMutation.error ?? null : meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(devUser ?? meQuery.data),
    };
  }, [
    devSessionOpenId,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    supabaseAuth.ready,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
