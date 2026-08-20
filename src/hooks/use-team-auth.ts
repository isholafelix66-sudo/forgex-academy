import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const TOKEN_KEY = "forgex_team_session";

// All known stale auth keys from previous Clerk/Convex Auth attempts
const STALE_KEYS = [
  "forgex_clerk_session",
  "forgex_clerk_token",
  "clerk_session",
  "convex_auth_token",
  "__convexAuthUser",
  "forgex_session",
  "convex-auth-storage",
];

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

/** Remove any stale auth keys from previous auth systems */
function clearStaleAuthKeys() {
  if (typeof window === "undefined") return;
  try {
    for (const key of STALE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

/**
 * Team authentication hook — credential-based, no Clerk, no Convex Auth.
 *
 * Flow:
 * 1. User enters Team ID + password on /team/login
 * 2. teamLogin mutation validates credentials, returns a session token
 * 3. Token is stored in localStorage
 * 4. getTeamSession query validates the token and returns team data
 * 5. Role-based routing sends the user to the correct workspace
 */
export function useTeamAuth() {
  const [token, setToken] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);

  // Read stored token on mount (client-only) + clear stale auth keys
  useEffect(() => {
    try {
      clearStaleAuthKeys();
      const stored = getStoredToken();
      if (mountedRef.current) {
        setToken(stored);
        setInitialized(true);
      }
    } catch {
      if (mountedRef.current) {
        setInitialized(true);
      }
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Login with credentials
  const teamLoginMutation = useMutation(api.teamAuth.teamLogin);

  const login = useCallback(
    async (teamId: string, password: string) => {
      try {
        const result = await teamLoginMutation({ teamId, password });
        if (result?.token) {
          storeToken(result.token);
          if (mountedRef.current) {
            setToken(result.token);
          }
        }
        return result;
      } catch (err) {
        // Re-throw with clean message
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg || "Login failed. Please try again.");
      }
    },
    [teamLoginMutation],
  );

  // Logout
  const logoutMutation = useMutation(api.teamAuth.teamLogout);

  const logout = useCallback(async () => {
    const currentToken = token;
    clearToken();
    if (mountedRef.current) {
      setToken("");
    }
    if (currentToken) {
      try {
        await logoutMutation({ token: currentToken });
      } catch {
        // Ignore errors on logout — token is already cleared locally
      }
    }
  }, [token, logoutMutation]);

  // Query team session using the stored token
  const session = useQuery(
    api.teamAuth.getTeamSession,
    token && initialized ? { token } : "skip",
  );

  // Session is "loaded" once we either have data or the query resolved to null/undefined
  const isLoading = !initialized || (!!token && session === undefined);

  const isAuthenticated =
    initialized && !!token && session !== undefined && session !== null;

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
