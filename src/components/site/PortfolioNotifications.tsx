import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BellRing,
  CheckCheck,
  Inbox,
  Info,
  TriangleAlert,
  X,
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

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO HEADER NOTIFICATIONS

   The bell and the announcement strip in the public Portfolio header read from
   the Portfolio's OWN announcements (published in /adminbrand → Notifications).
   Nothing here touches Academy notifications, and a visitor — signed in or not
   — sees the same Portfolio announcements.
   ═══════════════════════════════════════════════════════════════════════════ */

const SEEN_KEY = "fx-portfolio-notifs-seen";

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    /* ignore */
  }
}

type Notification = {
  _id: string;
  title: string;
  body: string;
  link: string | null;
  linkLabel: string | null;
  tone: "info" | "success" | "warning";
  createdAt: number;
};

const TONE_STYLES: Record<Notification["tone"], string> = {
  info: "border-sky-400/25 bg-sky-400/5 text-sky-200",
  success: "border-lime-400/25 bg-lime-400/5 text-lime-200",
  warning: "border-amber-400/25 bg-amber-400/5 text-amber-200",
};

const TONE_ICON: Record<Notification["tone"], React.ReactNode> = {
  info: <Info className="size-4" />,
  success: <BellRing className="size-4" />,
  warning: <TriangleAlert className="size-4" />,
};

/** Shared state: published portfolio announcements + locally tracked "seen". */
function usePortfolioAnnouncements() {
  const notifications = useQuery(api.portfolioNotifications.active);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => setSeen(readSeen()), []);

  const items = useMemo(
    () => (notifications ?? []) as Notification[],
    [notifications],
  );
  const unread = items.filter((n) => !seen.includes(n._id)).length;

  const markAllSeen = useCallback(() => {
    const ids = items.map((n) => n._id);
    setSeen(ids);
    writeSeen(ids);
  }, [items]);

  return { items, seen, unread, markAllSeen, loading: notifications === undefined };
}

/** Small dot badge for the header bell. */
export function usePortfolioNotificationCount() {
  const { unread } = usePortfolioAnnouncements();
  return unread;
}

/* ── Bell panel ────────────────────────────────────────────────────────── */

export function PortfolioNotifications({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, seen, unread, markAllSeen, loading } = usePortfolioAnnouncements();

  useEffect(() => {
    if (open) markAllSeen();
  }, [open, markAllSeen]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="right-0 top-0 left-auto h-[100dvh] max-h-[100dvh] w-full max-w-sm translate-x-0 translate-y-0 gap-0 rounded-none rounded-l-3xl border-white/10 bg-[#0b0e0c]/95 p-0 backdrop-blur-xl sm:right-2 sm:top-16 sm:h-auto sm:max-h-[70dvh] sm:rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Portfolio announcements</DialogTitle>
          <DialogDescription>News from the ForgeX Network Portfolio.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-lime-300" />
            <p className="font-display text-sm font-bold">Announcements</p>
            {unread > 0 && (
              <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[11px] font-bold text-lime-300">
                {unread} new
              </span>
            )}
          </div>
          {items.length > 0 && (
            <button
              onClick={markAllSeen}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-contain p-3 sm:max-h-[28rem]">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-white/5" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Inbox className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold">Nothing new right now</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Portfolio announcements from the team will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const isUnread = !seen.includes(n._id);
                const body = (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                      isUnread ? TONE_STYLES[n.tone] : "border-white/8 bg-card/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        isUnread ? "bg-white/10" : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {TONE_ICON[n.tone]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-sm font-semibold", !isUnread && "text-muted-foreground")}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {n.body}
                      </p>
                      {n.link && (
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-lime-300">
                          {n.linkLabel ?? "Open"} →
                        </span>
                      )}
                    </div>
                  </div>
                );
                return n.link ? (
                  /^https?:\/\//i.test(n.link) ? (
                    <a
                      key={n._id}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onOpenChange(false)}
                      className="block"
                    >
                      {body}
                    </a>
                  ) : (
                    <Link
                      key={n._id}
                      to={n.link}
                      onClick={() => onOpenChange(false)}
                      className="block"
                    >
                      {body}
                    </Link>
                  )
                ) : (
                  <div key={n._id}>{body}</div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Header strip (the announcement itself) ────────────────────────────── */

/**
 * Thin, dismissible announcement bar under the header showing the newest
 * published notification. Dismissal lasts for that notification only — the
 * next published announcement shows up again.
 */
export function PortfolioAnnouncementStrip({ className }: { className?: string }) {
  const { items } = usePortfolioAnnouncements();
  const latest = items[0] ?? null;
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem("fx-portfolio-notif-dismissed"));
    } catch {
      /* ignore */
    }
  }, []);

  if (!latest || dismissed === latest._id) return null;

  const dismiss = () => {
    setDismissed(latest._id);
    try {
      window.sessionStorage.setItem("fx-portfolio-notif-dismissed", latest._id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 border-b px-4 py-2 text-xs sm:px-6",
        TONE_STYLES[latest.tone],
        className,
      )}
    >
      <span className="shrink-0">{TONE_ICON[latest.tone]}</span>
      <p className="min-w-0 flex-1 truncate">
        <span className="font-bold">{latest.title}</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span className="opacity-90">{latest.body}</span>
      </p>
      {latest.link && (
        /^https?:\/\//i.test(latest.link) ? (
          <a
            href={latest.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 rounded-full border border-current/30 px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex"
          >
            {latest.linkLabel ?? "Open"}
          </a>
        ) : (
          <Link
            to={latest.link}
            className="hidden shrink-0 rounded-full border border-current/30 px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex"
          >
            {latest.linkLabel ?? "Open"}
          </Link>
        )
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-lg p-1 transition-colors hover:bg-white/10"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

