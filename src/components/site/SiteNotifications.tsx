import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Bell,
  BellRing,
  CheckCheck,
  GraduationCap,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const ICONS: Record<string, React.ReactNode> = {
  certificate: <Award className="size-4" />,
  grade: <Trophy className="size-4" />,
  message: <MessageSquare className="size-4" />,
  tutor: <GraduationCap className="size-4" />,
  role: <ShieldCheck className="size-4" />,
};

/**
 * Public header notification panel — same notifications table and mutations
 * as the in-dashboard page (`/dashboard/notifications`), opened from the
 * bell icon. Guests get a sign-in prompt instead of an error.
 */
export function SiteNotifications({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isAuthenticated } = useAuth();
  const notifications = useQuery(
    api.notifications.myNotificationsForHeader,
    open && isAuthenticated ? {} : "skip",
  );
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="right-0 top-0 left-auto h-[100dvh] max-h-[100dvh] w-full max-w-sm translate-x-0 translate-y-0 gap-0 rounded-none rounded-l-3xl border-white/10 bg-[#0b0e0c]/95 p-0 backdrop-blur-xl sm:right-2 sm:top-16 sm:h-auto sm:max-h-[70dvh] sm:rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>Your latest ForgeX Academy updates.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-lime-300" />
            <p className="font-display text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[11px] font-bold text-lime-300">
                {unread} new
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-contain p-3 sm:max-h-[28rem]">
          {!isAuthenticated ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold">Sign in to see your notifications</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Course updates, certificates, grades and announcements land here.
              </p>
              <Link
                to="/auth?mode=signin"
                onClick={() => onOpenChange(false)}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
              >
                Sign in
              </Link>
            </div>
          ) : notifications === undefined || notifications === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-white/5" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Inbox className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold">You're all caught up</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                New courses, certificates and academy updates will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 12).map((n) => {
                const body = (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                      n.read ? "border-white/8 bg-card/50" : "border-lime-400/25 bg-lime-400/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        n.read ? "bg-white/5 text-muted-foreground" : "bg-lime-400/15 text-lime-300",
                      )}
                    >
                      {ICONS[n.type] ?? <Bell className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-sm font-semibold", n.read && "text-muted-foreground")}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-lime-400" />}
                  </div>
                );
                return n.link ? (
                  <Link
                    key={n._id}
                    to={n.link}
                    onClick={() => {
                      if (!n.read) void markRead({ id: n._id });
                      onOpenChange(false);
                    }}
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
              <Link
                to="/dashboard/notifications"
                onClick={() => onOpenChange(false)}
                className="block rounded-xl border border-white/10 py-2.5 text-center text-xs font-semibold text-lime-300 transition-colors hover:border-lime-400/40"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
