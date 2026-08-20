import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// ─── localStorage helpers ───────────────────────────────────────────
const PREFIX = "forgex_team_";
const key = (slug: string) => `${PREFIX}${slug}`;
const read = (slug: string): string => {
  try { return localStorage.getItem(key(slug)) || ""; } catch { return ""; }
};
const write = (slug: string, val: string) => {
  try { localStorage.setItem(key(slug), val); } catch { /* */ }
};
const erase = (slug: string) => {
  try { localStorage.removeItem(key(slug)); } catch { /* */ }
};

// ─── Client-side token validation ───────────────────────────────────
// Token format: "username:hex32:expiryMs"
// No useQuery. No server call. Just parse + check expiry.
function isValidToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const expiry = parseInt(parts[2], 10);
  return !isNaN(expiry) && Date.now() < expiry;
}

function parseToken(token: string) {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  return { username: parts[0], expiry: parseInt(parts[2], 10) };
}

// ─── Workspace names ────────────────────────────────────────────────
const NAMES: Record<string, string> = {
  academic: "Academic Support",
  "ai-support": "AI Support",
  "tutor-support": "Tutor Support",
  "student-support": "Student Support",
};

// ─── Hook ───────────────────────────────────────────────────────────
export function useTeamWorkspace(workspaceSlug: string) {
  const [token, setToken] = useState(() => read(workspaceSlug));
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    setToken(read(workspaceSlug));
    setReady(true);
    return () => { mounted.current = false; };
  }, [workspaceSlug]);

  // useMutation — called on button click only, never on render
  const loginMutation = useMutation(api.teamAccess.verifyWorkspacePassword);

  // Client-side session check
  const unlocked = ready && isValidToken(token);

  // Login: call Convex mutation → store token → done
  const login = useCallback(async (password: string) => {
    const result = await loginMutation({ workspaceSlug, password });
    write(workspaceSlug, result.token);
    if (mounted.current) setToken(result.token);
    return result;
  }, [loginMutation, workspaceSlug]);

  // Logout: clear token
  const logout = useCallback(() => {
    erase(workspaceSlug);
    if (mounted.current) setToken("");
  }, [workspaceSlug]);

  // Parse username from token for display
  const parsed = unlocked ? parseToken(token) : null;

  return {
    unlocked,
    loading: !ready,
    login,
    logout,
    username: parsed?.username ?? null,
    workspaceName: NAMES[workspaceSlug] ?? workspaceSlug,
  };
}
