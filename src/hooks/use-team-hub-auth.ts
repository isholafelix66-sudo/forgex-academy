import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const TOKEN_KEY = "forgex_team_access_token";

function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore
  }
}

function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Team Hub authentication hook — password-based, per-team sessions.
 *
 * Flow:
 * 1. User visits /team → Team Hub shows team cards
 * 2. User clicks a team → /team/access/:teamSlug → password screen
 * 3. User enters password → verifyTeamPassword mutation creates session
 * 4. Token stored in localStorage
 * 5. getSession query validates token → returns team info
 * 6. User redirected to /team/:teamSlug → TeamShell
 */
export function useTeamHubAuth() {
  const [token, setToken] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    try {
      const stored = getStoredToken();
      if (mountedRef.current) {
        setToken(stored);
        setInitialized(true);
      }
    } catch {
      if (mountedRef.current) setInitialized(true);
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Watch for token changes from other tabs/windows
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        const newVal = e.newValue || "";
        if (mountedRef.current) setToken(newVal);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const verifyMutation = useMutation(api.teamAccess.verifyTeamPassword);
  const logoutMutation = useMutation(api.teamAccess.logout);

  const login = useCallback(
    async (teamSlug: string, password: string) => {
      try {
        const result = await verifyMutation({ teamSlug, password });
        if (result?.token) {
          storeToken(result.token);
          if (mountedRef.current) setToken(result.token);
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg || "Login failed.");
      }
    },
    [verifyMutation],
  );

  const logout = useCallback(async () => {
    const currentToken = token;
    clearToken();
    if (mountedRef.current) setToken("");
    if (currentToken) {
      try {
        await logoutMutation({ token: currentToken });
      } catch {
        // Ignore
      }
    }
  }, [token, logoutMutation]);

  const session = useQuery(
    api.teamAccess.getSession,
    token && initialized ? { token } : "skip",
  );

  const isLoading = !initialized || (!!token && session === undefined);
  const isAuthenticated =
    initialized && !!token && session !== undefined && session !== null;
  const teamSlug = session?.teamSlug ?? null;
  const teamName = session?.teamName ?? null;

  return {
    isAuthenticated,
    isLoading,
    teamSlug,
    teamName,
    token,
    login,
    logout,
  };
}
