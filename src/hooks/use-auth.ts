import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuth as useClerkAuth, useSignIn, useSignOut } from "@clerk/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signOut: clerkSignOut } = useSignOut();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  // Provide signIn/signOut wrappers that match the existing interface.
  // signIn delegates to the Auth page's own Clerk flow; signOut calls Clerk.
  const signIn = async (_strategy: string, _formData: FormData) => {
    // The Auth page handles its own Clerk sign-in flow directly.
    // This wrapper exists for backward-compatibility with code that
    // calls useAuth().signIn but the actual sign-in is in the Auth page.
    console.warn("useAuth().signIn is a no-op — use the Auth page's Clerk flow instead.");
  };

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut: clerkSignOut,
  };
}
