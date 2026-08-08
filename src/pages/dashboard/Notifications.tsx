import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Bell,
  BellRing,
  CheckCheck,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

const ICONS: Record<string, React.ReactNode> = {
  certificate: <Award className="size-4" />,
  grade: <Trophy className="size-4" />,
  message: <MessageSquare className="size-4" />,
  tutor: <GraduationCap className="size-4" />,
  role: <ShieldCheck className="size-4" />,
};

export default function Notifications() {
  const notifications = useQuery(api.notifications.myNotifications);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.`
            : "You're all caught up."
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" className="border-white/15" onClick={() => void markAllRead()}>
              <CheckCheck className="mr-2 size-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {notifications === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellRing className="size-6" />}
          title="No notifications yet"
          description="Grades, certificates, messages and announcements will land here."
        />
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const body = (
              <div
                className={cn(
                  "flex items-start gap-4 rounded-2xl border p-4 transition-colors",
                  n.read
                    ? "border-white/8 bg-card/60"
                    : "border-lime-400/25 bg-lime-400/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    n.read ? "bg-white/5 text-muted-foreground" : "bg-lime-400/15 text-lime-300",
                  )}
                >
                  {ICONS[n.type] ?? <Bell className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-sm font-semibold", n.read && "text-muted-foreground")}>
                      {n.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                </div>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-lime-400" />}
              </div>
            );
            return n.link ? (
              <Link
                key={n._id}
                to={n.link}
                onClick={() => !n.read && void markRead({ id: n._id })}
                className="block"
              >
                {body}
              </Link>
            ) : (
              <div
                key={n._id}
                onClick={() => !n.read && void markRead({ id: n._id })}
                className="cursor-pointer"
              >
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
