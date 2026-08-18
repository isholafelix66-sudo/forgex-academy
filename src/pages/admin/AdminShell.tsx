import { useState } from "react";
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
  Megaphone,
  MessageCircle,
  MessageSquare,
  PenSquare,
  ScrollText,
  ShieldAlert,
  UserCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/dash/AppShell";
import { clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-session";

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
      const { token } = await verify({ password });
      onUnlocked(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password.");
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

export default function AdminShell() {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const unlocked = useQuery(
    api.admin.isAdminUnlocked,
    token ? { token } : "skip",
  );
  const pendingApps = useQuery(
    api.admin.tutorApplications,
    token ? { token } : "skip",
  );
  const pendingCourses = useQuery(
    api.admin.coursesPendingReview,
    token ? { token } : "skip",
  );
  const supportStats = useQuery(
    api.tutorSupport.adminSupportStats,
    token ? { token } : "skip",
  );

  const handleUnlocked = (t: string) => {
    setAdminToken(t);
    setToken(t);
  };

  if (unlocked === undefined && token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!unlocked) return <AdminGate onUnlocked={handleUnlocked} />;

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
        { to: "/admin/teams", label: "Team management", icon: <Users className="size-4" /> },
        { to: "/tutor", label: "Tutor dashboard (preview)", icon: <GraduationCap className="size-4" /> },
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

  return <AppShell sections={sections} title="Admin dashboard" />;
}
