import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { getSupabaseAuthState } from "@/lib/supabase-auth";

export function SupabaseAuthDebugCard() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    void getSupabaseAuthState().then((state) => {
      console.info("[Supabase debug]", {
        convexAuthenticated: isAuthenticated,
        convexUser: user ? { id: user._id, email: user.email } : null,
        supabase: state,
      });
    });
  }, [isAuthenticated, user]);

  return null;
}
