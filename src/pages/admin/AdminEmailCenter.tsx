import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { getAdminToken } from "@/lib/admin-session";
import { toast } from "sonner";

type Tab = "dashboard" | "compose" | "history" | "failed" | "sent" | "automated";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "compose", label: "Compose" },
  { key: "history", label: "History" },
  { key: "failed", label: "Failed" },
  { key: "sent", label: "Sent" },
  { key: "automated", label: "Automated" },
];

const TYPE_LABELS: Record<string, string> = {
  otp: "Authentication code",
  password_reset: "Password reset",
  welcome: "Welcome",
  enrollment: "Enrollment",
  quiz: "Quiz",
  exam: "Exam",
  certificate: "Certificate",
  support: "Support",
  admin_broadcast: "Admin broadcast",
};

const FRIENDLY_ERRORS: Record<string, string> = {
  not_configured: "Email service is not configured yet.",
  auth_failed: "Email credentials were rejected — check the SMTP keys.",
  rate_limited: "The email service is busy. Try again shortly.",
  network: "Connection problem reaching the email service.",
  send_failed: "The email could not be delivered.",
};

function fmtDate(t?: number | null): string {
  if (!t) return "—";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    sent: {
      cls: "border-lime-400/30 bg-lime-400/10 text-lime-300",
      icon: <CheckCircle2 className="size-3" />,
    },
    pending: {
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-300",
      icon: <Clock className="size-3" />,
    },
    failed: {
      cls: "border-rose-400/30 bg-rose-400/10 text-rose-300",
      icon: <AlertCircle className="size-3" />,
    },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${s.cls}`}
    >
      {s.icon}
      {status}
    </span>
  );
}

export default function AdminEmailCenter() {
  const token = getAdminToken() ?? "";
  const authed = !!token;
  const [tab, setTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmResendId, setConfirmResendId] = useState<string | null>(null);

  // Compose state
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [audience, setAudience] = useState<"single" | "multi" | "all_students" | "all_tutors" | "all_team">("all_students");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sending, setSending] = useState(false);

  const stats = useQuery(api.emailData.adminStats, authed ? { token } : "skip");
  const emails = useQuery(
    api.emailData.adminListEmails,
    authed ? { token, search: search || undefined } : "skip",
  );
  const recipients = useQuery(api.emailData.adminListRecipients, authed ? { token } : "skip");
  const detail = useQuery(
    api.emailData.adminGetEmail,
    authed && detailId ? { token, id: detailId as never } : "skip",
  );

  const compose = useMutation(api.emailData.adminCompose);
  const retryEmail = useMutation(api.emailData.adminRetryEmail);
  const resendEmail = useMutation(api.emailData.adminResendEmail);

  const filtered = useMemo(() => {
    if (!emails) return [];
    return emails.filter((e) => {
      if (tab === "failed") return e.status === "failed";
      if (tab === "sent") return e.status === "sent";
      if (tab === "automated") return e.automated;
      if (statusFilter) return e.status === statusFilter;
      return true;
    });
  }, [emails, tab, statusFilter]);

  const recipientChoices = useMemo(() => {
    if (!recipients) return [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return recipients.slice(0, 60);
    return recipients
      .filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
      .slice(0, 60);
  }, [recipients, userSearch]);

  const runEditor = (cmd: string) => {
    document.execCommand(cmd);
  };

  const targetCount =
    audience === "single" || audience === "multi"
      ? selectedUsers.length
      : (recipients ?? []).filter((r) =>
          audience === "all_students"
            ? r.role === "student"
            : audience === "all_tutors"
              ? r.role === "tutor"
              : !!r.teamRole,
        ).length;

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await compose({
        token,
        subject,
        messageHtml,
        userIds: audience === "single" || audience === "multi" ? selectedUsers : undefined,
        audience:
          audience === "all_students" || audience === "all_tutors" || audience === "all_team"
            ? audience
            : undefined,
      });
      toast.success(
        res.queued > 0
          ? `${res.queued} email${res.queued === 1 ? "" : "s"} queued for delivery.`
          : "No matching recipients found.",
      );
      if (res.queued > 0) {
        setSubject("");
        setMessageHtml("");
        setSelectedUsers([]);
        setTab("history");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't queue the email.");
    } finally {
      setSending(false);
      setConfirmingSend(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryEmail({ token, id: id as never });
      toast.success("Re-queued for sending.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't retry that email.");
    }
  };

  const handleResend = async () => {
    if (!confirmResendId) return;
    try {
      await resendEmail({ token, id: confirmResendId as never });
      toast.success("A copy has been queued for sending.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resend that email.");
    } finally {
      setConfirmResendId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Center"
        description="Transactional and broadcast email for the whole ForgeX platform — powered by Gmail SMTP."
        actions={
          <span className="hidden items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/8 px-3 py-1 text-xs font-medium text-lime-300 sm:inline-flex">
            <Mail className="size-3.5" /> ForgeX Academy sender
          </span>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-lime-400 font-semibold text-black"
                : "border border-white/10 bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.key === "failed" && (stats?.failed ?? 0) > 0 ? (
              <span className="ml-1.5 rounded-full bg-rose-400/20 px-1.5 text-[10px] font-bold text-rose-300">
                {stats!.failed}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === "dashboard" && (
        stats === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/8 bg-card" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total emails", value: stats.total, icon: <Mail className="size-5 text-muted-foreground" /> },
                { label: "Sent", value: stats.sent, icon: <CheckCircle2 className="size-5 text-lime-300" /> },
                { label: "Failed", value: stats.failed, icon: <AlertCircle className="size-5 text-rose-300" /> },
                { label: "Pending", value: stats.pending, icon: <Clock className="size-5 text-amber-300" /> },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-white/10 bg-card p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    {c.icon}
                  </div>
                  <p className="font-display mt-2 text-3xl font-bold">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-card p-5">
              <h3 className="text-sm font-semibold">Automated emails by type</h3>
              {stats.byType.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No emails logged yet.</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {stats.byType.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs text-muted-foreground">
                        {TYPE_LABELS[type] ?? type}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full rounded-full bg-lime-400"
                          style={{ width: `${Math.max(4, (count / Math.max(stats.total, 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* Compose */}
      {tab === "compose" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-card p-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Recipients</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as typeof audience)}
                className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-black/30 px-3 text-sm focus:border-lime-400/40 focus:outline-none"
              >
                <option value="all_students">All students ({(recipients ?? []).filter((r) => r.role === "student").length})</option>
                <option value="all_tutors">All tutors ({(recipients ?? []).filter((r) => r.role === "tutor").length})</option>
                <option value="all_team">All team members ({(recipients ?? []).filter((r) => r.teamRole).length})</option>
                <option value="single">One user</option>
                <option value="multi">Multiple selected users</option>
              </select>
            </div>

            {(audience === "single" || audience === "multi") && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users…"
                  className="mb-2 h-9 border-white/10 bg-black/30"
                />
                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {recipientChoices.map((r) => {
                    const checked = selectedUsers.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5"
                      >
                        <input
                          type={audience === "single" ? "radio" : "checkbox"}
                          name="fx-email-recipient"
                          checked={checked}
                          onChange={() =>
                            setSelectedUsers((prev) =>
                              audience === "single"
                                ? [r.id]
                                : checked
                                  ? prev.filter((x) => x !== r.id)
                                  : [...prev, r.id],
                            )
                          }
                          className="size-4 accent-lime-400"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.email}</span>
                        <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                          {r.role}
                        </Badge>
                      </label>
                    );
                  })}
                  {recipientChoices.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No users found.</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                className="h-10 border-white/10 bg-black/30"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium">Message</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => runEditor("bold")}
                    className="rounded-md border border-white/10 px-2 py-0.5 text-xs font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => runEditor("italic")}
                    className="rounded-md border border-white/10 px-2 py-0.5 text-xs italic text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => runEditor("insertUnorderedList")}
                    className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    • List
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand("formatBlock", false, "h3");
                    }}
                    className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    H
                  </button>
                </div>
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setMessageHtml(e.currentTarget.innerHTML)}
                className="min-h-36 rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-relaxed focus:border-lime-400/40 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!subject.trim() || !messageHtml.trim() || targetCount === 0 || sending}
                onClick={() => setConfirmingSend(true)}
                className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send to {targetCount} recipient{targetCount === 1 ? "" : "s"}
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-black/20"
                onClick={() => setPreviewing(true)}
                disabled={!messageHtml.trim()}
              >
                <MailOpen className="mr-1.5 size-4" /> Preview
              </Button>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-white/10 bg-card p-5 text-sm text-muted-foreground">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="size-4 text-lime-300" /> How sending works
            </h3>
            <ul className="space-y-2 leading-relaxed">
              <li>• Emails are delivered through Gmail SMTP with the sender name “ForgeX Academy”.</li>
              <li>• Bulk sends are queued and delivered in batches — watch History move Pending → Sent live.</li>
              <li>• A confirmation is always shown before a bulk send.</li>
              <li>• Authentication codes are never visible here — OTP emails are stored without their content.</li>
            </ul>
          </aside>
        </div>
      )}

      {/* Lists (history / failed / sent / automated share one table) */}
      {tab !== "dashboard" && tab !== "compose" && (
        <>
          {tab === "history" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search recipient or subject…"
                  className="h-9 border-white/10 bg-black/30 pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 appearance-none rounded-lg border border-white/10 bg-black/30 px-3 text-sm focus:border-lime-400/40 focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          )}

          {emails === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl border border-white/8 bg-card" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
              No emails here{tab === "failed" ? " — everything delivered 🎉" : " yet"}.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
              <div className="divide-y divide-white/5">
                {filtered.map((e) => (
                  <div key={e._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <button
                      onClick={() => setDetailId(e._id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">{e.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.to} · {TYPE_LABELS[e.emailType] ?? e.emailType} · {fmtDate(e.createdAt)}
                        {e.retryCount > 0 ? ` · retried ${e.retryCount}×` : ""}
                      </p>
                    </button>
                    <StatusBadge status={e.status} />
                    {e.status === "failed" && (
                      <Button size="sm" variant="outline" className="gap-1.5 border-white/15 bg-black/20" onClick={() => void handleRetry(e._id)}>
                        <RefreshCw className="size-3.5" /> Retry
                      </Button>
                    )}
                    {e.status === "sent" && (
                      <Button size="sm" variant="outline" className="gap-1.5 border-white/15 bg-black/20" onClick={() => setConfirmResendId(e._id)}>
                        <Send className="size-3.5" /> Resend
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-card sm:max-w-xl">
          {detail === undefined ? (
            <Loader2 className="mx-auto my-10 size-6 animate-spin text-muted-foreground" />
          ) : !detail ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Email not found.</p>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{detail.subject}</DialogTitle>
                <DialogDescription>
                  {TYPE_LABELS[detail.emailType] ?? detail.emailType} · to {detail.to}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={detail.status} />
                <span className="text-muted-foreground">Created</span><span>{fmtDate(detail.createdAt)}</span>
                <span className="text-muted-foreground">Sent</span><span>{fmtDate(detail.sentAt)}</span>
                <span className="text-muted-foreground">Source</span>
                <span>{detail.automated ? "System (automated)" : "Admin (Email Center)"}</span>
                {detail.lastError && (
                  <>
                    <span className="text-muted-foreground">Failure</span>
                    <span>{FRIENDLY_ERRORS[detail.lastError] ?? "Could not be delivered."}</span>
                  </>
                )}
              </div>
              {detail.html ? (
                <iframe
                  title="Email preview"
                  srcDoc={detail.html}
                  sandbox=""
                  className="mt-4 h-80 w-full rounded-xl border border-white/10 bg-white"
                />
              ) : (
                <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
                  Content isn't stored for authentication emails to keep verification codes private.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>This is how the email will look in an inbox.</DialogDescription>
          </DialogHeader>
          <iframe
            title="Compose preview"
            srcDoc={`<!doctype html><html><body style="margin:0;background:#f4f4f5;"><div style="max-width:560px;margin:24px auto;padding:32px;font-family:sans-serif;color:#111;">${messageHtml}</div></body></html>`}
            sandbox=""
            className="h-96 w-full rounded-xl border border-white/10 bg-white"
          />
        </DialogContent>
      </Dialog>

      {/* Bulk-send confirmation */}
      <Dialog open={confirmingSend} onOpenChange={setConfirmingSend}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to {targetCount} recipients?</DialogTitle>
            <DialogDescription>
              This email will be queued for every selected recipient via Gmail SMTP. Bulk deliveries take a few minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" className="border-white/15 bg-black/20" onClick={() => setConfirmingSend(false)}>
              Cancel
            </Button>
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" disabled={sending} onClick={() => void handleSend()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Confirm & send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resend confirmation */}
      <Dialog open={!!confirmResendId} onOpenChange={(o) => !o && setConfirmResendId(null)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resend this email?</DialogTitle>
            <DialogDescription>
              A fresh copy will be sent to the same recipient. This creates a new entry in the history so duplicates stay traceable.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" className="border-white/15 bg-black/20" onClick={() => setConfirmResendId(null)}>
              Cancel
            </Button>
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => void handleResend()}>
              <Send className="size-4" /> Resend
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
