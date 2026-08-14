import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ArrowLeft,
  Lock,
  MessageCircle,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { getAdminToken } from "@/lib/admin-session";
import { MessageThread, type ThreadMessage } from "@/components/community/MessageThread";

export default function AdminDMDetail() {
  const { id } = useParams<{ id: string }>();
  const conversationId = id as Id<"studentConversations">;
  const token = getAdminToken() ?? "";
  const [cursor, setCursor] = useState<number | undefined>(undefined);

  const thread = useQuery(
    api.communityAdmin.adminConversationMessages,
    token ? { token, conversationId, cursor } : "skip",
  );
  const lockConversation = useMutation(api.communityAdmin.adminLockConversation);
  const removeMessage = useMutation(api.communityAdmin.adminRemoveMessage);
  const warnUser = useMutation(api.communityAdmin.adminWarnUser);
  const suspend = useMutation(api.communityAdmin.adminSuspendUserComms);
  const logView = useMutation(api.communityAdmin.adminLogConversationView);
  const logAudio = useMutation(api.communityAdmin.adminLogAudioPlay);

  const [confirmMsg, setConfirmMsg] = useState<ThreadMessage | null>(null);
  const [warnTarget, setWarnTarget] = useState<{ userId: string; name: string } | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ userId: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Log the (authorized) admin view once when the conversation opens.
  useEffect(() => {
    if (token) void logView({ token, conversationId }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const [cache, setCache] = useState<Map<string, ThreadMessage>>(new Map());
  useEffect(() => {
    if (!thread) return;
    setCache((prev) => {
      const next = new Map(prev);
      for (const m of thread.messages) {
        next.set(m._id, m as unknown as ThreadMessage);
      }
      return next;
    });
  }, [thread]);
  const messages = useMemo(
    () => [...cache.values()].sort((a, b) => a.createdAt - b.createdAt),
    [cache],
  );

  const convo = thread?.convo ?? null;
  const participants = convo?.participants ?? [];
  const locked = convo?.status === "locked";

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={participants.map((p) => p.name).join(" ↔ ") || "Conversation"}
        description={`${messages.length} messages${locked ? " · locked by a moderator" : ""} · opened in review mode — all views are audit-logged.`}
        actions={
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
            <Link to="/admin/communication/dms">
              <ArrowLeft className="size-4" /> All DMs
            </Link>
          </Button>
        }
      />

      {locked && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Conversation locked.</p>
            <p className="text-xs text-amber-200/70">
              {convo?.lockedReason ? `Reason: ${convo.lockedReason}` : "No reason recorded."}
            </p>
          </div>
        </div>
      )}

      {/* Moderation actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className={locked ? "gap-2 border-lime-400/30 text-lime-300" : "gap-2 border-amber-400/25 text-amber-300"}
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                lockConversation({
                  token,
                  conversationId,
                  locked: !locked,
                  reason: locked ? undefined : "Locked by moderator",
                }),
              locked ? "Conversation unlocked" : "Conversation locked",
            )
          }
        >
          {locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          {locked ? "Unlock conversation" : "Lock conversation"}
        </Button>
        {participants.map((p) => (
          <Button
            key={p._id}
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 text-muted-foreground"
            disabled={busy}
            onClick={() => setWarnTarget({ userId: p._id as string, name: p.name })}
          >
            <UserCog className="size-4" /> Warn {p.name.split(" ")[0]}
          </Button>
        ))}
        {participants.map((p) => (
          <Button
            key={p._id}
            variant="outline"
            size="sm"
            className="gap-2 border-rose-400/25 text-rose-300 hover:bg-rose-400/10"
            disabled={busy}
            onClick={() => setSuspendTarget({ userId: p._id as string, name: p.name })}
          >
            <ShieldAlert className="size-4" /> Suspend {p.name.split(" ")[0]}
          </Button>
        ))}
      </div>

      {/* Thread */}
      <div className="flex h-[62vh] flex-col rounded-2xl border border-white/10 bg-card">
        {participants.length > 0 && (
          <div className="flex items-center gap-2 border-b border-white/8 bg-black/20 px-4 py-2.5 text-[11px] text-muted-foreground">
            <MessageCircle className="size-3.5" />
            {participants.map((p) => (
              <span key={p._id} className="flex items-center gap-1.5">
                {p.name}
                {p.email ? <span className="text-muted-foreground/70">({p.email})</span> : null}
              </span>
            ))}
          </div>
        )}
        <MessageThread
          messages={messages}
          myUserId=""
          showDeletedContent
          loading={thread === undefined}
          nextCursor={thread?.nextCursor ?? null}
          onLoadMore={() => {
            if (thread?.nextCursor) setCursor(thread.nextCursor);
          }}
          readOnly
          onVoicePlay={(m) => {
            void logAudio({
              token,
              scope: "dm",
              conversationId,
              messageId: m._id,
            }).catch(() => undefined);
          }}
          extraActions={(m) =>
            !m.deleted ? (
              <button
                type="button"
                onClick={() => setConfirmMsg(m)}
                className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-rose-400/10 hover:text-rose-300"
              >
                <Trash2 className="size-3" /> Remove
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Warn dialog */}
      <Dialog open={!!warnTarget} onOpenChange={(o) => !o && setWarnTarget(null)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle>Warn {warnTarget?.name}</DialogTitle>
            <DialogDescription>
              The student receives a moderation warning in their notifications. The action is
              audit-logged.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Warning message for the student"
            className="border-white/10 bg-black/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarnTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="gap-2 bg-amber-400 text-black hover:bg-amber-300"
              disabled={!reason.trim() || busy}
              onClick={() => {
                if (!warnTarget) return;
                const t = warnTarget;
                setWarnTarget(null);
                setReason("");
                void run(
                  () => warnUser({ token, userId: t.userId as Id<"users">, reason: reason.trim() }),
                  `Warning sent to ${t.name}`,
                );
              }}
            >
              <UserCog className="size-4" /> Send warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle>Suspend {suspendTarget?.name}?</DialogTitle>
            <DialogDescription>
              The account is immediately suspended — the student can no longer sign in or use any
              ForgeX feature until an admin reactivates them.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="border-white/10 bg-black/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="gap-2 bg-rose-500 text-white hover:bg-rose-400"
              disabled={!reason.trim() || busy}
              onClick={() => {
                if (!suspendTarget) return;
                const t = suspendTarget;
                setSuspendTarget(null);
                setReason("");
                void run(
                  () => suspend({ token, userId: t.userId as Id<"users">, reason: reason.trim() }),
                  `${t.name} suspended`,
                );
              }}
            >
              <ShieldAlert className="size-4" /> Suspend account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove message confirm */}
      <ConfirmDialog
        open={!!confirmMsg}
        onOpenChange={(o) => !o && setConfirmMsg(null)}
        title="Remove this message?"
        description="The message is removed from the conversation for both students. The action is written to the audit log."
        confirmLabel="Remove message"
        busy={busy}
        onConfirm={() => {
          if (!confirmMsg) return;
          const m = confirmMsg;
          setConfirmMsg(null);
          void run(
            () =>
              removeMessage({
                token,
                scope: "dm",
                conversationId,
                messageId: m._id,
                reason: "Removed by moderator",
              }),
            "Message removed",
          );
        }}
      />
    </div>
  );
}
