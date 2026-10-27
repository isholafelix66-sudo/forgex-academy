import { SupabaseAuthDemo } from "@/components/SupabaseAuthDemo";
import { SupabaseAuthDebugCard } from "@/components/SupabaseAuthDebugCard";

// This route is intentionally isolated and safe: it only uses Supabase when it
// is configured. The app continues to use Convex for all normal auth flows.

export function SupabaseRoute() {
  return (
    <>
      <SupabaseAuthDebugCard />
      <SupabaseAuthDemo />
    </>
  );
}
