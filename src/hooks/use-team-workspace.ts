import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
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

export function useTeamWorkspace(workspaceSlug: string) {
  const [token, setToken] = useState(() => getStoredToken(workspaceSlug));
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const stored = getStoredToken(workspaceSlug);
    if (mountedRef.current) { setToken(stored); setInitialized(true); }
    return () => { mountedRef.current = false; };
  }, [workspaceSlug]);

  // Client-side validity — never throws, used for immediate UX
  const hasValidLocalToken = initialized && isTokenValidLocally(token, workspaceSlug);

  // Server-side validation — always call useQuery (hooks rules), but skip when no token
  const workspace = useQuery(
    api.teamAccess.validateWorkspaceToken,
    hasValidLocalToken && token && workspaceSlug ? { token, workspaceSlug } : "skip",
  );

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

  // isUnlocked if:
  // 1. Server validated (workspace !== null && workspace !== undefined)
  // 2. OR client-side valid AND server hasn't responded yet (workspace === undefined = still loading)
  // 3. OR client-side valid AND server returned null (server query failed — trust local)
  const isUnlocked = initialized && (
    (workspace !== null && workspace !== undefined) ||
    (hasValidLocalToken && (workspace === undefined || workspace === null))
  );

  const resolvedWorkspace = workspace ?? (hasValidLocalToken ? { workspaceSlug, workspaceName: "" } : null);

  return { isUnlocked, isLoading, unlock, lock, workspace: resolvedWorkspace };
}
