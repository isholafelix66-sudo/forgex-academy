import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Loader2, Search, Send, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";

export default function Discover() {
  const [query, setQuery] = useState("");
  const students = useQuery(api.community.discoverStudents, { q: query });
  const requestConnection = useMutation(api.community.requestConnection);
  const openConversation = useMutation(api.community.openConversationWith);
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (userId: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(userId);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discover Students"
        description="Find classmates and other ForgeX learners. Students in the same course can message each other directly; for everyone else, send a connection request first."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or headline…"
          className="border-white/10 bg-black/20 pl-9"
        />
      </div>

      {students === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Finding students…
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={query ? "No students found" : "No students yet"}
          description={
            query
              ? `Nothing matched “${query}”. Try a different name.`
              : "There aren't any other students to show right now — check back soon."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <div
              key={s._id}
              className="rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/30"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar name={s.name} image={s.image} className="size-11" />
                  {s.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-lime-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.headline || "ForgeX learner"}</p>
                  {s.sharedCourses.length > 0 && (
                    <span className="mt-1 inline-flex items-center rounded-full border border-lime-400/25 bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                      In {s.sharedCourses.length} course{s.sharedCourses.length > 1 ? "s" : ""} together
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3.5">
                {s.connectionStatus === "accepted" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-lime-400/30 text-lime-300"
                    disabled={busyId === s._id}
                    onClick={() => {
                      setBusyId(s._id);
                      openConversation({ userId: s._id as Id<"users"> })
                        .then((convoId) => navigate(`/dashboard/dms/${convoId}`))
                        .catch((err) => {
                          toast.error(err instanceof Error ? err.message : "Couldn't open the chat.");
                        })
                        .finally(() => setBusyId(null));
                    }}
                  >
                    {busyId === s._id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Message
                  </Button>
                ) : s.connectionStatus === "pending" ? (
                  <Button variant="outline" size="sm" disabled className="w-full gap-2 border-white/10 text-muted-foreground">
                    {s.pendingFromMe ? "Request sent" : "Pending your reply"}
                  </Button>
                ) : s.connectionStatus === "blocked" ? (
                  <Button variant="outline" size="sm" disabled className="w-full border-white/10 text-muted-foreground">
                    Blocked
                  </Button>
                ) : s.connectionStatus === "declined" || s.connectionStatus === "removed" ? (
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-lime-400 text-black hover:bg-lime-300"
                    disabled={busyId === s._id}
                    onClick={() =>
                      void act(s._id, () => requestConnection({ userId: s._id as Id<"users"> }), "Request sent")
                    }
                  >
                    {busyId === s._id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    Connect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className={cn(
                      "w-full gap-2",
                      s.sharedCourses.length > 0 ? "bg-lime-400 text-black hover:bg-lime-300" : "bg-white/10 text-foreground hover:bg-white/15",
                    )}
                    disabled={busyId === s._id}
                    onClick={() =>
                      void act(s._id, () => requestConnection({ userId: s._id as Id<"users"> }), "Request sent")
                    }
                  >
                    {busyId === s._id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    Connect
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
