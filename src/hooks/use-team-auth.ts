import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const TOKEN_KEY = "forgex_team_session";

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
    // Ignore storage errors
  }
}

function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function useTeamAuth() {
  const [token, setToken] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);

  // Read from localStorage only once, after mount (client-only)
  useEffect(() => {
    setToken(getStoredToken());
    setInitialized(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const session = useQuery(
    api.teamAuth.getTeamSession,
    token && initialized ? { token } : "skip",
  );
  const logoutMutation = useMutation(api.teamAuth.teamLogout);

  const login = useCallback((newToken: string) => {
    storeToken(newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token;
    clearToken();
    setToken("");
    if (currentToken) {
      try {
        await logoutMutation({ token: currentToken });
      } catch {
        // Ignore errors on logout — token is already cleared locally
      }
    }
  }, [token, logoutMutation]);

  // Session is "loaded" once we either have data or the query resolved to null
  const isAuthenticated =
    initialized && !!token && session !== undefined && session !== null;
  const isLoading =
    !initialized || (!!token && session === undefined);
  const teamMember = session ?? null;

  return {
    isAuthenticated,
    isLoading,
    teamMember,
    token,
    login,
    logout,
  };
}
