import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Lock, MessageCircle, Search, ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/admin-session";
import { timeAgo } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  active: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  locked: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  archived: "border-white/15 bg-white/5 text-muted-foreground",
};

export default function AdminCommunication() {
  const token = getAdminToken() ?? "";
  const [query, setQuery] = useState("");
  const communities = useQuery(
    api.communityAdmin.adminCommunities,
    token ? { token, search: query } : "skip",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communities"
        description="Every course community on the platform — view activity, review messages, lock or archive communities and manage members from here."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search communities…"
          className="border-white/10 bg-black/20 pl-9"
        />
      </div>

      {communities === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading communities…
        </div>
      ) : communities.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No communities yet"
          description="Communities are created automatically when students enroll in courses."
        />
      ) : (
        <div className="space-y-3">
          {communities.map((c) => (
            <div
              key={c._id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display truncate text-base font-bold">{c.name}</h3>
                  <span
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[c.status] ?? ""}`}
                  >
                    {c.status === "locked" && <Lock className="size-3" />}
                    {c.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.courseTitle} · last activity {c.lastActivityAt ? timeAgo(c.lastActivityAt) : "—"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> {c.memberCount} members
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-3.5" /> {c.messageCount} messages
                </span>
                {c.reportCount > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 font-semibold text-rose-300">
                    <ShieldAlert className="size-3.5" /> {c.reportCount} open reports
                  </span>
                )}
              </div>

              <Button variant="outline" size="sm" asChild className="border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
                <Link to={`/admin/communication/communities/${c._id}`}>Manage</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
