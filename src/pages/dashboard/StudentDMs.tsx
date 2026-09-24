import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { Loader2, Lock, MessageCircle, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function StudentDMs() {
  const conversations = useQuery(api.community.myStudentConversations);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student DMs"
        description="Private conversations with other students. Message classmates from your courses directly, or connect with students from Discover first."
      />

      {conversations === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading conversations…
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No conversations yet"
          description="Find a classmate and start a private chat — students in the same course can message each other right away."
          action={
            <Link
              to="/academy/dashboard"/discover"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              <UserPlus className="size-4" /> Discover students
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          {conversations.map((c, i) => (
            <Link
              key={c.conversationId}
              to={`/dashboard/dms/${c.conversationId}`}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/5",
                i > 0 && "border-t border-white/8",
              )}
            >
              <div className="relative shrink-0">
                <Avatar name={c.other?.name ?? "?"} image={c.other?.image ?? null} className="size-12" />
                {c.other?.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-lime-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm", c.unread > 0 ? "font-bold text-foreground" : "font-medium")}>
                    {c.other?.name}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {c.lastAt ? timeAgo(c.lastAt) : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-xs",
                      c.unread > 0 ? "font-medium text-lime-300" : "text-muted-foreground",
                    )}
                  >
                    {c.status === "locked" ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3" /> Conversation locked by a moderator
                      </span>
                    ) : (
                      c.lastMessage || "Start the conversation"
                    )}
                  </p>
                  {c.unread > 0 && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
