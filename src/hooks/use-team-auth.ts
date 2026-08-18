import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const TOKEN_KEY = "forgex_team_session";

function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function useTeamAuth() {
  const [token, setToken] = useState<string>(getStoredToken);
  const [initialized, setInitialized] = useState(false);

  const session = useQuery(
    api.teamAuth.getTeamSession,
    token ? { token } : "skip",
  );
  const logoutMutation = useMutation(api.teamAuth.teamLogout);

  useEffect(() => {
    setInitialized(true);
  }, []);

  const login = useCallback((newToken: string) => {
    storeToken(newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Ignore errors on logout
      }
    }
    clearToken();
    setToken("");
  }, [token, logoutMutation]);

  const isAuthenticated = initialized && !!token && !!session;
  const isLoading = !initialized || (!!token && session === undefined);
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
