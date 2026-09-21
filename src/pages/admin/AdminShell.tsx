import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Bot,
  Braces,
  ClipboardList,
  Flag,
  GraduationCap,
  Heart,
  ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Activity,
  BellRing,
  Bug,
  History,
  Mail,
  Megaphone,
  Siren,
  MessageCircle,
  MessageSquare,
  PenSquare,
  ScrollText,
  ShieldAlert,
  UserCircle,
  Users,
} from "lucide-react";
import type { MobileNavItem, MobileNavSection } from "@/components/site/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/dash/AppShell";
import { clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-session";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

/** Password gate — /admin is reachable only with the admin access password.
 *  No user account is required: the password mints a session token. */
function AdminGate({ onUnlocked }: { onUnlocked: (token: string) => void }) {
  const verify = useMutation(api.admin.verifyAccessPassword);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Label the session so the Security section can show which device it is.
      const { token } = await verify({ password, label: deviceLabel() });
      onUnlocked(token);
    } catch (err) {
      setError(friendlyError(err, "Incorrect password."));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
          <KeyRound className="size-7" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-bold">Admin access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Admin Dashboard is protected by the administrator access password.
          Enter it to continue — no account required.
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access password"
            className="h-11 border-white/10 bg-black/20 text-center"
            autoFocus
          />
          {error && (
            <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading || !password}
            className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
            Unlock admin dashboard
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useIdleAdminLock } from "@/lib/use-idle-admin-lock";

/** Short human-readable device description for the Security section. */
function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Admin session";
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua)
      ? "Mac"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/i.test(ua)
          ? "iOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "Browser";
  return `${browser} · ${os}`;
}

export default function AdminShell() {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const unlocked = useQuery(
    api.admin.isAdminUnlocked,
    token ? { token } : "skip",
  );
  // IMPORTANT: hooks must run unconditionally — the incident badge lives here
  // (before the password gate early-returns) so lock/unlock transitions never
  // change the hook order.
  const incidentBadge = useQuery(
    api.monitorData.adminIncidentBadge,
    token && unlocked === true ? { token } : "skip",
  );

  // IMPORTANT: gate every privileged subscription behind a *verified* session.
  // requireAdminSession THROWS for stale/expired tokens — if these queries ran
  // with an unverified token they would throw during render and crash the
  // entire /admin tree (the "hit a snag" bug affecting all admin pages).
  const sessionValid = token !== null && unlocked === true;
  const pendingApps = useQuery(
    api.admin.tutorApplications,
    sessionValid ? { token } : "skip",
  );
  const pendingCourses = useQuery(
    api.admin.coursesPendingReview,
    sessionValid ? { token } : "skip",
  );
  const supportStats = useQuery(
    api.tutorSupport.adminSupportStats,
    sessionValid ? { token } : "skip",
  );

  // A stored token that the backend rejects (expired 12h TTL, cleared
  // sessions, DB reset) must be purged immediately so no page ever renders
  // with credentials the server will reject.
  useEffect(() => {
    if (token && unlocked === false) {
      clearAdminToken();
      setToken(null);
    }
  }, [token, unlocked]);

  const handleUnlocked = (t: string) => {
    setAdminToken(t);
    setToken(t);
  };

  // Session heartbeat: keeps lastSeenAt fresh so the Security section shows
  // genuinely-active devices. Silent — never disturbs the admin UI.
  const heartbeat = useMutation(api.adminSecurity.heartbeatSession);
  useEffect(() => {
    if (!token || unlocked !== true) return;
    const beat = () => {
      heartbeat({ token }).catch(() => {
        // Heartbeat failures are non-fatal; the next tick retries.
      });
    };
    beat();
    const id = setInterval(beat, 60 * 1000);
    return () => clearInterval(id);
  }, [token, unlocked, heartbeat]);

  // Auto-lock: after ADMIN_IDLE_LOCK_MS with no user activity, the admin
  // session is cleared and the password gate is shown again.
  useIdleAdminLock({
    enabled: !!token && unlocked === true,
    onLock: () => {
      clearAdminToken();
      setToken(null);
      toast.info("Admin dashboard locked due to inactivity.");
    },
  });

  if (unlocked === undefined && token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!unlocked) return <AdminGate onUnlocked={handleUnlocked} />;

  const incidentCount =
    typeof incidentBadge === "number" && incidentBadge > 0
      ? incidentBadge > 99
        ? "99+"
        : String(incidentBadge)
      : undefined;

  const pendingCount =
    (pendingApps?.filter((a) => a.status === "submitted" || a.status === "under-review").length ?? 0) +
    (pendingCourses?.length ?? 0);

  const sections = [
    {
      label: "Platform",
      items: [
        { to: "/admin", label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
        { to: "/admin/users", label: "Users & roles", icon: <Users className="size-4" /> },
        { to: "/admin/inbox", label: "Inbox", icon: <Inbox className="size-4" /> },
        { to: "/admin/chat", label: "Chat logs", icon: <MessageSquare className="size-4" /> },
        {
          to: "/admin/applications",
          label: "Tutor verification",
          icon: <BadgeCheck className="size-4" />,
          badge:
            pendingCount > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {pendingCount}
              </span>
            ) : undefined,
        },
        { to: "/admin/courses", label: "Courses", icon: <BookOpen className="size-4" /> },
        { to: "/admin/catalog", label: "Categories & roadmaps", icon: <ListChecks className="size-4" /> },
        { to: "/admin/teams", label: "Team Access", icon: <Users className="size-4" /> },
        { to: "/admin/ai-support", label: "AI Support", icon: <Bot className="size-4" /> },
        { to: "/admin/email-center", label: "Email Center", icon: <Mail className="size-4" /> },
        { to: "/tutor", label: "Tutor dashboard (preview)", icon: <GraduationCap className="size-4" /> },
      ],
    },
    {
      label: "System",
      items: [
        { to: "/admin/system", label: "System health", icon: <Activity className="size-4" /> },
        { to: "/admin/system/errors", label: "Error tracking", icon: <Bug className="size-4" /> },
        {
          to: "/admin/system/incidents",
          label: "Incidents",
          icon: <Siren className="size-4" />,
          badge: incidentCount ? (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {incidentCount}
            </span>
          ) : undefined,
        },
        { to: "/admin/system/activity", label: "Activity log", icon: <History className="size-4" /> },
        { to: "/admin/system/alerts", label: "Alerts", icon: <BellRing className="size-4" /> },
      ],
    },
    {
      label: "Content",
      items: [
        { to: "/admin/updates", label: "Updates & news", icon: <Megaphone className="size-4" /> },
        { to: "/admin/stories", label: "Student stories", icon: <Heart className="size-4" /> },
        { to: "/admin/ai-hub", label: "AI Hub", icon: <Bot className="size-4" /> },
        { to: "/admin/prompts", label: "Prompt Library", icon: <Braces className="size-4" /> },
        { to: "/admin/content", label: "Website & branding", icon: <PenSquare className="size-4" /> },
        { to: "/admin/media", label: "Media library", icon: <ImageIcon className="size-4" /> },
        { to: "/admin/form-builder", label: "Tutor registration form", icon: <ClipboardList className="size-4" /> },
        { to: "/admin/certificates", label: "Certificates", icon: <Award className="size-4" /> },
        { to: "/admin/audit", label: "Audit log", icon: <ScrollText className="size-4" /> },
      ],
    },
    {
      label: "Communication",
      items: [
        { to: "/admin/communication", label: "Communities", icon: <MessageCircle className="size-4" /> },
        { to: "/admin/communication/dms", label: "Private DMs", icon: <MessageSquare className="size-4" /> },
        {
          to: "/admin/communication/reports",
          label: "Reports & tutor support",
          icon: <Flag className="size-4" />,
          badge:
            (supportStats?.open ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {(supportStats?.open ?? 0) > 99 ? "99+" : supportStats?.open}
              </span>
            ) : undefined,
        },
        { to: "/admin/communication/audit", label: "Audit log", icon: <ScrollText className="size-4" /> },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/admin/profile", label: "Admin profile", icon: <UserCircle className="size-4" /> },
      ],
    },
  ];

  const mobilePrimary: MobileNavItem[] = [
    { to: "/admin", label: "Overview", icon: <LayoutDashboard className="size-5" />, end: true },
    { to: "/admin/users", label: "Users", icon: <Users className="size-5" /> },
    { to: "/admin/courses", label: "Courses", icon: <BookOpen className="size-5" /> },
    { to: "/admin/inbox", label: "Inbox", icon: <Inbox className="size-5" /> },
  ];

  const mobileMore: MobileNavSection[] = [
    {
      label: "Platform",
      items: [
        { to: "/admin/applications", label: "Tutor verification", icon: <BadgeCheck className="size-4" /> },
        { to: "/admin/chat", label: "Chat logs", icon: <MessageSquare className="size-4" /> },
        { to: "/admin/catalog", label: "Categories & roadmaps", icon: <ListChecks className="size-4" /> },
        { to: "/admin/teams", label: "Team Access", icon: <Users className="size-4" /> },
        { to: "/admin/ai-support", label: "AI Support", icon: <Bot className="size-4" /> },
        { to: "/admin/email-center", label: "Email Center", icon: <Mail className="size-4" /> },
        { to: "/admin/system", label: "System health", icon: <Activity className="size-4" /> },
        { to: "/admin/system/incidents", label: "Incidents", icon: <Siren className="size-4" /> },
      ],
    },
    {
      label: "Content",
      items: [
        { to: "/admin/updates", label: "Updates & news", icon: <Megaphone className="size-4" /> },
        { to: "/admin/stories", label: "Student stories", icon: <Heart className="size-4" /> },
        { to: "/admin/ai-hub", label: "AI Hub", icon: <Bot className="size-4" /> },
        { to: "/admin/prompts", label: "Prompt Library", icon: <Braces className="size-4" /> },
        { to: "/admin/content", label: "Website & branding", icon: <PenSquare className="size-4" /> },
        { to: "/admin/media", label: "Media library", icon: <ImageIcon className="size-4" /> },
        { to: "/admin/certificates", label: "Certificates", icon: <Award className="size-4" /> },
        { to: "/admin/audit", label: "Audit log", icon: <ScrollText className="size-4" /> },
      ],
    },
    {
      label: "Communication",
      items: [
        { to: "/admin/communication", label: "Communities", icon: <MessageCircle className="size-4" /> },
        { to: "/admin/communication/dms", label: "Private DMs", icon: <MessageSquare className="size-4" /> },
        { to: "/admin/communication/reports", label: "Reports & support", icon: <Flag className="size-4" /> },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/admin/profile", label: "Admin profile", icon: <UserCircle className="size-4" /> },
      ],
    },
  ];

  return <AppShell sections={sections} title="Admin dashboard" mobilePrimaryItems={mobilePrimary} mobileMoreSections={mobileMore} />;
}
