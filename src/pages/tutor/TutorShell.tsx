import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";
import { useAdminSession } from "@/hooks/use-admin-session";

export default function TutorShell() {
  const { isAdmin } = useAdminSession();
  const pending = useQuery(api.tutor.pendingSubmissions);
  const conversations = useQuery(api.messages.myConversations);
  const communityUnread = useQuery(api.community.communityUnreadCount);
  const unreadMessages = conversations?.reduce((s, c) => s + c.unread, 0) ?? 0;

  const sections = [
    {
      label: "Teaching",
      items: [
        { to: "/tutor", label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
        { to: "/tutor/courses", label: "My courses", icon: <BookOpen className="size-4" /> },
        {
          to: "/tutor/grading",
          label: "Grading",
          icon: <ClipboardCheck className="size-4" />,
          badge:
            (pending?.length ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {pending?.length}
              </span>
            ) : undefined,
        },
        { to: "/tutor/students", label: "Students", icon: <Users className="size-4" /> },
        { to: "/tutor/announcements", label: "Announcements", icon: <Megaphone className="size-4" /> },
        { to: "/tutor/support", label: "Support", icon: <LifeBuoy className="size-4" /> },
      ],
    },
    {
      label: "Communication",
      items: [
        {
          to: "/tutor/inbox",
          label: "Inbox",
          icon: <MessageSquare className="size-4" />,
          badge:
            unreadMessages > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {unreadMessages}
              </span>
            ) : undefined,
        },
        {
          to: "/tutor/communities",
          label: "Course Communities",
          icon: <MessageCircle className="size-4" />,
          badge:
            (communityUnread ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {(communityUnread ?? 0) > 99 ? "99+" : communityUnread}
              </span>
            ) : undefined,
        },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/tutor/profile", label: "Tutor Profile", icon: <UserCircle className="size-4" /> },
        { to: "/tutor/settings", label: "Settings", icon: <Settings className="size-4" /> },
      ],
    },
  ];

  // "Logout" lives in the account footer of the app shell (bottom-right),
  // keeping the sidebar exactly to the TEACHING / COMMUNICATION / ACCOUNT
  // structure.

  const banner = isAdmin ? (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-lime-400/25 bg-lime-400/10 px-4 py-2 text-xs text-lime-200 sm:px-6">
      <span className="inline-flex min-w-0 items-center gap-2 font-medium">
        <ShieldCheck className="size-3.5 shrink-0" />
        Admin preview — you're viewing the tutor dashboard without an account.
      </span>
      <Link
        to="/admin"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 font-semibold text-lime-300 transition-colors hover:bg-lime-400/20"
      >
        <ArrowLeft className="size-3.5" /> Back to admin
      </Link>
    </div>
  ) : undefined;

  return <AppShell sections={sections} title="Tutor dashboard" banner={banner} />;
}
