import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAdminToken } from "@/lib/admin-session";

/**
 * Whether the password-gated admin session is currently unlocked. The admin
 * area needs no user account, so this is also the only way the admin can
 * preview the tutor dashboard without registering.
 *
 * `loading` is true while a stored token is still being validated — route
 * guards must wait for it, otherwise the preview gets redirected away
 * before the session check finishes.
 */
export function useAdminSession() {
  const token = getAdminToken();
  const unlocked = useQuery(
    api.admin.isAdminUnlocked,
    token ? { token } : "skip",
  );
  return {
    token,
    isAdmin: unlocked === true,
    loading: token ? unlocked === undefined : false,
  };
}
