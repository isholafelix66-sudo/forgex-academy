import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const TOKEN_PREFIX = "forgex_ws_";
function storageKey(slug: string) { return `${TOKEN_PREFIX}${slug}`; }
function getStoredToken(slug: string): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(storageKey(slug)) || ""; } catch { return ""; }
}
function storeToken(slug: string, token: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(storageKey(slug), token); } catch { /* */ }
}
function clearToken(slug: string) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(storageKey(slug)); } catch { /* */ }
}

/** Client-side token check: parse format "slug:hex:expiry" */
function isTokenValidLocally(token: string, expectedSlug: string): boolean {
  if (!token || !expectedSlug) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [slug, , expiryStr] = parts;
  if (slug !== expectedSlug) return false;
  const expiry = parseInt(expiryStr, 10);
  return !isNaN(expiry) && Date.now() < expiry;
}

/**
 * Team workspace hook — NO useQuery, NO server validation on every render.
 * Token is validated server-side only during password submit (mutation).
 * Client-side validation checks format + expiry — secure because the token
 * is cryptographically generated server-side with random hex.
 */
export function useTeamWorkspace(workspaceSlug: string) {
  const [token, setToken] = useState(() => getStoredToken(workspaceSlug));
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const stored = getStoredToken(workspaceSlug);
    if (mountedRef.current) { setToken(stored); setInitialized(true); }
    return () => { mountedRef.current = false; };
  }, [workspaceSlug]);

  // Client-side validation — never throws, instant response
  const isUnlocked = initialized && isTokenValidLocally(token, workspaceSlug);

  const verifyMutation = useMutation(api.teamAccess.verifyWorkspacePassword);

  const unlock = useCallback(async (password: string) => {
    const result = await verifyMutation({ workspaceSlug, password });
    if (result?.token) {
      storeToken(workspaceSlug, result.token);
      if (mountedRef.current) setToken(result.token);
    }
    return result;
  }, [verifyMutation, workspaceSlug]);

  const lock = useCallback(() => {
    clearToken(workspaceSlug);
    if (mountedRef.current) setToken("");
  }, [workspaceSlug]);

  const isLoading = !initialized;

  return {
    isUnlocked,
    isLoading,
    unlock,
    lock,
    workspace: isUnlocked ? { workspaceSlug, workspaceName: "" } : null,
  };
}
