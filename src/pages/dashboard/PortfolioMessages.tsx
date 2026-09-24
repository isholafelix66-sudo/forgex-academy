import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowUpRight, Loader2, MessageSquare } from "lucide-react";
import { PortfolioInbox } from "@/components/chat/PortfolioChat";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";

/**
 * /portfolio/dashboard/messages — the portfolio owner's inbox.
 *
 * Every conversation started from a shared portfolio lands here: guest name,
 * optional contact, timestamps, read/unread state, and the same chat UI the
 * rest of ForgeX uses for replies. Owner-only — the creator token is required,
 * and the backend scopes conversations to portfolios this creator owns.
 */
export default function PortfolioMessages() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getPortfolioUserToken());
  }, []);

  const session = useQuery(
    api.portfolioUsers.validateSession,
    token ? { token } : "skip",
  );

  if (token && session === undefined) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || session === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
        <MessageSquare className="mx-auto size-7 text-muted-foreground/50" />
        <h1 className="font-display mt-4 text-lg font-bold">Sign in to see messages</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Messages visitors send from your public portfolio show up here.
        </p>
        <Link
          to="/portfolio/auth"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
        >
          Sign in <ArrowUpRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Messages</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Everyone who used the Message button on your public portfolio. Visitors
          don't need an account — you'll see their name, and their email address
          when they chose to share it.
        </p>
      </div>
      <PortfolioInbox token={token} />
    </div>
  );
}
