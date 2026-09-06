import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Loader2,
  MessageCircle,
  Send,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";

type Tab = "received" | "sent" | "connected" | "blocked";

export default function Connections() {
  const connections = useQuery(api.community.myConnections);
  const respond = useMutation(api.community.respondConnection);
  const remove = useMutation(api.community.removeConnection);
  const block = useMutation(api.community.blockUser);
  const unblock = useMutation(api.community.unblockUser);
  const openConversation = useMutation(api.community.openConversationWith);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("received");
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { received: 0, sent: 0, connected: 0, blocked: 0 };
    for (const r of connections ?? []) {
      if (r.status === "pending" && r.incoming) c.received += 1;
      else if (r.status === "pending") c.sent += 1;
      else if (r.status === "accepted") c.connected += 1;
      else if (r.status === "blocked") c.blocked += 1;
    }
    return c;
  }, [connections]);

  const list = (connections ?? []).filter((r) => {
    if (tab === "received") return r.status === "pending" && r.incoming;
    if (tab === "sent") return r.status === "pending" && !r.incoming;
    if (tab === "connected") return r.status === "accepted";
    return r.status === "blocked";
  });

  const act = async (id: string, fn: () => Promise<unknown>, success?: string) => {
    setBusyId(id);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "received", label: "Requests", count: counts.received },
    { key: "sent", label: "Sent", count: counts.sent },
    { key: "connected", label: "Connected", count: counts.connected },
    { key: "blocked", label: "Blocked", count: counts.blocked },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Manage connection requests and the students you can privately message."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === t.key ? "bg-lime-400 text-black" : "bg-white/10",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {connections === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading connections…
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === "blocked" ? <Ban className="size-6" /> : <Users className="size-6" />}
          title={
            tab === "received"
              ? "No requests yet"
              : tab === "sent"
                ? "No requests sent"
                : tab === "connected"
                  ? "No connections yet"
                  : "Nothing blocked"
          }
          description={
            tab === "connected"
              ? "Find classmates and learners in the same course, then send a connection request."
              : "Requests you send and receive will appear here."
          }
          action={
            tab !== "blocked" ? (
              <Link
                to="/dashboard/discover"
                className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
              >
                <UserPlus className="size-4" /> Discover students
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <div key={r._id} className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar name={r.name} image={r.image} className="size-11" />
                  {r.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-lime-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.headline || "ForgeX learner"}
                  </p>
                  {r.status === "blocked" && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {r.blockedBy === r.userId ? "Blocked by them" : "You blocked this student"}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3.5 flex gap-2">
                {r.status === "pending" && r.incoming && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
                      disabled={busyId === r._id}
                      onClick={() =>
                        void act(
                          r._id,
                          () =>
                            respond({
                              connectionId: r._id as Id<"studentConnections">,
                              accept: true,
                            }),
                          "Connected 🎉",
                        )
                      }
                    >
                      {busyId === r._id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 border-white/10 text-muted-foreground"
                      disabled={busyId === r._id}
                      onClick={() =>
                        void act(
                          r._id,
                          () =>
                            respond({
                              connectionId: r._id as Id<"studentConnections">,
                              accept: false,
                            }),
                        )
                      }
                    >
                      <X className="size-3.5" /> Decline
                    </Button>
                  </>
                )}
                {r.status === "pending" && !r.incoming && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-white/10 text-muted-foreground"
                    disabled={busyId === r._id}
                    onClick={() =>
                      void act(
                        r._id,
                        () => remove({ connectionId: r._id as Id<"studentConnections"> }),
                        "Request cancelled",
                      )
                    }
                  >
                    {busyId === r._id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    Cancel request
                  </Button>
                )}
                {r.status === "accepted" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
                      disabled={busyId === r._id}
                      onClick={() => {
                        setBusyId(r._id);
                        openConversation({ userId: r.userId as Id<"users"> })
                          .then((convoId) => navigate(`/dashboard/dms/${convoId}`))
                          .catch((err) =>
                            toast.error(err instanceof Error ? err.message : "Couldn't open the chat."),
                          )
                          .finally(() => setBusyId(null));
                      }}
                    >
                      {busyId === r._id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                      Message
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Remove connection"
                      disabled={busyId === r._id}
                      onClick={() =>
                        void act(
                          r._id,
                          () => remove({ connectionId: r._id as Id<"studentConnections"> }),
                          "Connection removed",
                        )
                      }
                      className="border-white/10 text-muted-foreground"
                    >
                      <UserCheck className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Block student"
                      disabled={busyId === r._id}
                      onClick={() =>
                        void act(
                          r._id,
                          () => block({ userId: r.userId as Id<"users"> }),
                          "Student blocked",
                        )
                      }
                      className="border-white/10 text-rose-300 hover:border-rose-400/30"
                    >
                      <Ban className="size-3.5" />
                    </Button>
                  </>
                )}
                {r.status === "blocked" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-white/10 text-muted-foreground"
                    disabled={busyId === r._id}
                    onClick={() =>
                      void act(r._id, () => unblock({ userId: r.userId as Id<"users"> }), "Unblocked")
                    }
                  >
                    {busyId === r._id ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
                    Unblock
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
