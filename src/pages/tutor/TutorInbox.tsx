import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatAttachment } from "@/lib/chat-media";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function TutorInbox() {
  const { user } = useAuth();
  const conversations = useQuery(api.messages.myConversations);
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const thread = useQuery(
    api.messages.threadMessages,
    threadId ? { threadId } : "skip",
  );
  const markThreadRead = useMutation(api.messages.markThreadRead);
  const sendMessage = useMutation(api.messages.sendMessage);

  useEffect(() => {
    if (threadId) void markThreadRead({ threadId });
  }, [threadId, markThreadRead, thread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.length]);

  const active = conversations?.find((c) => c.threadId === threadId) ?? null;

  const send = async (payload: {
    body: string;
    attachment?: ChatAttachment;
  }) => {
    if (!active) return;
    await sendMessage({
      receiverId: active.other!._id as never,
      body: payload.body,
      ...(payload.attachment
        ? {
            kind: payload.attachment.kind,
            storageId: payload.attachment.storageId as never,
            url: payload.attachment.url,
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
        title="Inbox"
        description="Message with students about their courses and progress."
      />

      {conversations === undefined ? (
        <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-card" />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="No conversations yet"
          description="Students can message you from your profile and course pages."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <div className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-card">
            {conversations.map((c) => (
              <button
                key={c.threadId}
                onClick={() => setThreadId(c.threadId)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3.5 text-left transition-colors",
                  c.threadId === threadId ? "bg-lime-400/10" : "hover:bg-white/5",
                )}
              >
                <Avatar name={c.other?.name ?? "?"} image={c.other?.image} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.other?.name}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Thread */}
          <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-5 py-4">
                  <Avatar name={active.other?.name ?? "?"} image={active.other?.image} className="size-9" />
                  <div>
                    <p className="text-sm font-semibold">{active.other?.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{active.other?.role}</p>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
                  {(thread ?? []).map((m) => (
                    <ChatBubble
                      key={m._id}
                      message={m}
                      mine={m.senderId === user?._id}
                    />
                  ))}
                  {(thread ?? []).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">Say hello 👋</p>
                  )}
                </div>
                <div className="border-t border-white/10 p-4">
                  <ChatComposer onSend={send} placeholder="Type a reply…" />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
                Select a conversation to start chatting.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
