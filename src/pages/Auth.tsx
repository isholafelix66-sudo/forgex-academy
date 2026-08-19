import { Suspense } from "react";
import { SignIn } from "@clerk/react";
import { useNavigate, useSearchParams } from "react-router";
import { PublicNav } from "@/components/site/PublicNav";
import { Footer } from "@/components/site/Footer";
import { BackgroundFX } from "@/components/site/PageShell";
import logo from "@/assets/logo.svg";
import { Flame } from "lucide-react";
import { resolveRedirectAfterAuth } from "@/lib/auth-redirect";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundFX />
      <PublicNav />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <img
              src={logo}
              alt="ForgeX Academy"
              className="mx-auto size-14 rounded-2xl shadow-lg"
            />
            <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">
              Welcome to ForgeX Academy
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue your learning path, or create a free account.
            </p>
          </div>

          <div className="clerk-auth-wrapper rounded-3xl border border-white/10 bg-card p-6 shadow-2xl sm:p-8 [&>.cl-rootBox]:!bg-transparent [&>.cl-card]:!bg-transparent [&>.cl-card]:!shadow-none [&>.cl-card]:!border-none [&>.cl-headerTitle]:!text-foreground [&>.cl-headerSubtitle]:!text-muted-foreground [&>.cl-formButtonPrimary]:!bg-lime-400 [&>.cl-formButtonPrimary]:!text-black [&>.cl-formButtonPrimary:hover]:!bg-lime-300 [&>.cl-footerActionLink]:!text-lime-300 [&>.cl-dividerLine]:!bg-white/10 [&>.cl-dividerText]:!text-muted-foreground [&>.cl-formFieldInput]:!bg-black/20 [&>.cl-formFieldInput]:!border-white/10 [&>.cl-formFieldLabel]:!text-foreground">
            <SignIn
              routing="path"
              path="/auth"
              afterSignInUrl={redirect}
              afterSignUpUrl={redirect}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "w-full bg-transparent shadow-none border-none",
                  headerTitle: "text-foreground font-display text-lg font-bold",
                  headerSubtitle: "text-muted-foreground text-sm",
                  formButtonPrimary:
                    "bg-lime-400 text-black hover:bg-lime-300 font-semibold !shadow-none",
                  formFieldInput:
                    "bg-black/20 border-white/10 text-foreground",
                  formFieldLabel: "text-foreground text-sm font-medium",
                  footerActionLink: "text-lime-300 hover:text-lime-200",
                  dividerLine: "bg-white/10",
                  dividerText: "text-muted-foreground",
                  socialButtonsBlockButton:
                    "border-white/10 bg-black/20 text-foreground hover:bg-white/5",
                  socialButtonsBlockButtonText: "text-foreground font-medium",
                  identityPreviewEditButton: "text-lime-300",
                },
              }}
            />
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-3.5 text-lime-400" />
            Free forever · Discover. Express. Build.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
