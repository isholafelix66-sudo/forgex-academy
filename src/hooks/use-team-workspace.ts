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

export function useTeamWorkspace(workspaceSlug: string) {
  const [token, setToken] = useState(() => getStoredToken(workspaceSlug));
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    const stored = getStoredToken(workspaceSlug);
    if (mountedRef.current) { setToken(stored); setInitialized(true); }
    return () => { mountedRef.current = false; };
  }, [workspaceSlug]);
  const verifyMutation = useMutation(api.teamAccess.verifyWorkspacePassword);
  const workspace = useQuery(
    api.teamAccess.validateWorkspaceToken,
    token && initialized ? { token, workspaceSlug } : "skip",
  );
  const unlock = useCallback(async (password: string) => {
    const result = await verifyMutation({ workspaceSlug, password });
    if (result?.token) { storeToken(workspaceSlug, result.token); if (mountedRef.current) setToken(result.token); }
    return result;
  }, [verifyMutation, workspaceSlug]);
  const lock = useCallback(() => {
    clearToken(workspaceSlug);
    if (mountedRef.current) setToken("");
  }, [workspaceSlug]);
  const isLoading = !initialized || (!!token && workspace === undefined);
  const isUnlocked = initialized && !!token && workspace !== null && workspace !== undefined;
  return { isUnlocked, isLoading, unlock, lock, workspace: workspace ?? null };
}
