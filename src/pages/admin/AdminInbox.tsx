import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  Reply,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

type Status = "new" | "replied" | "resolved";

const STATUS_STYLES: Record<Status, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-lime-400/15 text-lime-300 border-lime-400/30",
  },
  replied: {
    label: "Replied",
    className: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  },
};

/**
 * Admin inbox — issue reports and questions submitted through the public
 * contact form. Registered users' contact messages go through the chat system
 * instead (Admin → Chat logs), so this holds visitor submissions that the
 * admin answers by email.
 */
export default function AdminInbox() {
  const token = getAdminToken() ?? "";
  const submissions = useQuery(
    api.contact.adminContactList,
    token ? { token } : "skip",
  );
  const sendReply = useMutation(api.contact.adminContactReply);
  const setStatus = useMutation(api.contact.adminContactStatus);

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<Id<"contactSubmissions"> | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<Id<"contactSubmissions"> | null>(null);

  const filtered = submissions?.filter((s) => {
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.subject.toLowerCase().includes(q) ||
      s.body.toLowerCase().includes(q)
    );
  });
  const unreadCount =
    submissions?.filter((s) => s.status === "new").length ?? 0;

  const open = openId
    ? submissions?.find((s) => s._id === openId) ?? null
    : null;

  const handleReply = async () => {
    if (!openId || !replyText.trim()) return;
    setSending(true);
    try {
      await sendReply({ token, id: openId, reply: replyText });
      toast.success("Reply emailed to the visitor.");
      setReplyText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the reply.");
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (status: Status) => {
    if (!openId) return;
    setBusyId(openId);
    try {
      await setStatus({ token, id: openId, status });
      toast.success(`Marked as ${status}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update status.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Issue reports & questions from the contact form — reply by email or mark resolved."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Submission list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or message…"
              className="border-white/10 bg-black/20 pl-9"
            />
          </div>
          {submissions === undefined ? (
            <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ) : (filtered?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-card p-8 text-center">
              <Inbox className="size-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {submissions.length === 0
                  ? "No contact messages yet. Submissions from the contact form land here."
                  : "Nothing matches your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
              {filtered?.map((s) => {
                const st = STATUS_STYLES[s.status];
                return (
                  <button
                    key={s._id}
                    onClick={() => {
                      setOpenId(s._id);
                      setReplyText("");
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-white/5 px-4 py-3.5 text-left transition-colors",
                      openId === s._id ? "bg-lime-400/10" : "hover:bg-white/5",
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          st.className,
                        )}
                      >
                        {st.label}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {s.name}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(s.createdAt)}
                      </span>
                    </div>
                    <p className="truncate text-xs font-medium text-foreground/80">
                      {s.subject || "No subject"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {s.email}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail + reply */}
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
          {!open ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground">
              <Mail className="size-8 text-muted-foreground/40" />
              <p className="mt-3">Select a message to read and reply to it.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted-foreground">
                <Reply className="size-3.5" /> Replies are emailed to the
                visitor
              </span>
              {unreadCount > 0 && (
                <p className="mt-4 text-xs text-lime-300">
                  {unreadCount} new message{unreadCount === 1 ? "" : "s"} waiting
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{open.subject || "No subject"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {open.name} · {open.email} · {timeAgo(open.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {open.status !== "resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === open._id}
                      onClick={() => void handleStatus("resolved")}
                      className="gap-1.5 border-white/15"
                    >
                      {busyId === open._id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      Mark resolved
                    </Button>
                  )}
                  {open.status !== "new" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === open._id}
                      onClick={() => void handleStatus("new")}
                      className="text-muted-foreground"
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-lime-300">
                    Message
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                    {open.body}
                  </p>
                </div>

                {open.reply && (
                  <div className="rounded-2xl border border-sky-400/25 bg-sky-400/8 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                      <Reply className="size-3.5" /> Last reply sent
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                      {open.reply}
                    </p>
                    {open.repliedAt && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {timeAgo(open.repliedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Reply composer (email) */}
              <div className="border-t border-white/10 bg-black/20 p-4">
                <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Reply className="size-3.5 text-lime-300" />
                  Reply by email to {open.email}
                </label>
                <div className="mt-2.5 flex items-end gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleReply();
                      }
                    }}
                    placeholder="Write the visitor a reply… (Enter to send)"
                    rows={3}
                    className="min-h-[64px] flex-1 resize-none border-white/10 bg-black/30 focus:border-lime-400/50"
                  />
                  <Button
                    onClick={() => void handleReply()}
                    disabled={sending || !replyText.trim()}
                    className="shrink-0 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
