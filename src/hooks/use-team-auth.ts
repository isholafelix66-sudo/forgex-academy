import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/react";

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

/**
 * Team authentication hook — now powered by Clerk.
 *
 * Flow:
 * 1. Clerk handles sign-in/sign-out and session management
 * 2. After Clerk sign-in, we call clerkAuthTeamLogin to bridge to the
 *    existing team session system (creates a token stored in localStorage)
 * 3. The token is used by all existing workspace functions unchanged
 */
export function useTeamAuth() {
  const [token, setToken] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [clerkBridging, setClerkBridging] = useState(false);
  const mountedRef = useRef(true);

  // Clerk auth state
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();

  // Read stored token on mount (client-only)
  useEffect(() => {
    setToken(getStoredToken());
    setInitialized(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // After Clerk sign-in, bridge to team session if we don't have a token
  const clerkTeamLogin = useMutation(api.teamAuth.clerkAuthTeamLogin);
  const logoutMutation = useMutation(api.teamAuth.teamLogout);

  useEffect(() => {
    if (!clerkLoaded || !initialized || clerkBridging) return;

    if (isSignedIn && !token) {
      // Clerk is signed in but we don't have a team session token yet
      // Bridge Clerk auth → team session
      setClerkBridging(true);
      clerkTeamLogin({})
        .then((result) => {
          if (mountedRef.current && result?.token) {
            storeToken(result.token);
            setToken(result.token);
          }
        })
        .catch((err) => {
          console.warn("[TeamAuth] Clerk bridge failed:", err?.message);
          // Don't store anything — user will see "not a team member" state
        })
        .finally(() => {
          if (mountedRef.current) setClerkBridging(false);
        });
    } else if (!isSignedIn && token) {
      // Clerk is signed out but we still have a stale team token — clear it
      clearToken();
      setToken("");
    }
  }, [clerkLoaded, isSignedIn, initialized, token, clerkBridging, clerkTeamLogin]);

  // Query team session using the stored token
  const session = useQuery(
    api.teamAuth.getTeamSession,
    token && initialized ? { token } : "skip",
  );

  // Session is "loaded" once we either have data or the query resolved to null
  // Also account for Clerk bridging state
  const isLoading =
    !initialized ||
    !clerkLoaded ||
    clerkBridging ||
    (!!token && session === undefined);

  const isAuthenticated =
    initialized &&
    clerkLoaded &&
    !clerkBridging &&
    !!token &&
    session !== undefined &&
    session !== null;

  const teamMember = session ?? null;

  const login = useCallback((_newToken: string) => {
    // With Clerk, login is handled by Clerk's sign-in flow.
    // The bridging effect above handles token creation.
    // This function exists for backward-compatibility but is a no-op.
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
    // Sign out from Clerk as well
    // The actual Clerk sign-out is handled by the component calling this
  }, [token, logoutMutation]);

  return {
    isAuthenticated,
    isLoading,
    teamMember,
    token,
    login,
    logout,
    // Expose Clerk sign-out for full logout
    clerkSignOut: undefined as (() => Promise<void>) | undefined,
  };
}
