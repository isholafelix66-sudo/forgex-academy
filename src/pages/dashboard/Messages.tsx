import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatAttachment } from "@/lib/chat-media";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function Messages() {
  const { user } = useAuth();
  const conversations = useQuery(api.messages.myConversations);
  const [searchParams] = useSearchParams();
  // Support starting a brand-new conversation: /dashboard/messages?to=<userId>
  const toParam = searchParams.get("to");
  const validTo =
    toParam && /^[a-z0-9]{8,}$/.test(toParam) ? toParam : null;
  const target = useQuery(
    api.users.getPublicUser,
    validTo ? { id: validTo as never } : "skip",
  );
  const existingThread = conversations?.find(
    (c) => c.other?._id === validTo,
  );
  const [threadId, setThreadId] = useState<string | null>(null);
  const thread = useQuery(
    api.messages.threadMessages,
    threadId ? { threadId } : "skip",
  );
  const markRead = useMutation(api.messages.markThreadRead);
  const sendMessage = useMutation(api.messages.sendMessage);

  const threadScrollRef = useRef<HTMLDivElement>(null);

  const active = conversations?.find((c) => c.threadId === threadId);

  useEffect(() => {
    if (threadId) void markRead({ threadId });
  }, [threadId, markRead, thread?.length]);

  // Pin the transcript to the newest message. Scrolling the container itself
  // (rather than a sentinel via scrollIntoView) keeps the page from jumping and
  // works the same on mobile and desktop.
  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.length, threadId]);

  // Once the first message creates the thread, open it automatically.
  useEffect(() => {
    if (existingThread && !threadId) setThreadId(existingThread.threadId);
  }, [existingThread, threadId]);

  const sendTo = async (
    receiverId: string,
    payload: { body: string; attachment?: ChatAttachment },
  ) => {
    if (receiverId === user?._id) {
      throw new Error("You can't message yourself.");
    }
    await sendMessage({
      receiverId: receiverId as never,
      body: payload.body,
      ...(payload.attachment
        ? {
            kind: payload.attachment.kind,
            storageId: payload.attachment.storageId as never,
            fileName: payload.attachment.fileName,
            fileSize: payload.attachment.fileSize,
            mimeType: payload.attachment.mimeType,
            duration: payload.attachment.duration,
          }
        : {}),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Talk to tutors, students and the Academy team."
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="space-y-2">
          {validTo && !existingThread && (
            <div className="rounded-2xl border border-lime-400/30 bg-lime-400/8 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={target?.name ?? "…"} image={target?.image ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    New conversation with {target?.name ?? "…"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Send the first message to get started.
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <ChatComposer
                  onSend={(payload) => sendTo(validTo, payload)}
                  placeholder="Write a message…"
                />
              </div>
            </div>
          )}
          {conversations === undefined ? (
            <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card p-6">
              <MessageSquare className="size-6 text-lime-300" />
              <p className="mt-3 text-sm font-medium">No conversations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Message a tutor from their profile page, or check back after
                enrolling in a course.
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.threadId}
                onClick={() => setThreadId(c.threadId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                  threadId === c.threadId
                    ? "border-lime-400/40 bg-lime-400/8"
                    : "border-white/10 bg-card hover:border-white/20",
                )}
              >
                <Avatar name={c.other?.name ?? "?"} image={c.other?.image} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {c.other?.name}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(c.lastAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastMessage}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                    {c.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="flex h-[65dvh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card lg:h-[calc(100dvh-12rem)]">
          {!threadId || !active ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                Select a conversation to start chatting.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setThreadId(null)}>
                  <ArrowLeft className="size-4" />
                </Button>
                <Avatar name={active.other?.name ?? "?"} image={active.other?.image} />
                <div>
                  <p className="text-sm font-semibold">{active.other?.name}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">
                    {active.other?.role ?? "user"}
                  </p>
                </div>
              </div>

              <div
                ref={threadScrollRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
              >
                {thread?.map((m) => (
                  <ChatBubble
                    key={m._id}
                    message={m}
                    mine={m.senderId === user?._id}
                  />
                ))}
              </div>

              <div className="border-t border-white/10 p-3">
                <ChatComposer
                  onSend={(payload) => sendTo(active.other!._id, payload)}
                  placeholder="Write a message…"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: visit a{" "}
        <Link to="/tutors" className="text-lime-300 hover:underline">
          tutor's profile
        </Link>{" "}
        to start a conversation with them.
      </p>
    </div>
  );
}
