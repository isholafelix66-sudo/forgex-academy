import { Navigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Bell,
  BookOpen,
  FileText,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Map,
  MessageCircle,
  MessageSquare,
  Settings,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import type { MobileNavItem, MobileNavSection } from "@/components/site/MobileBottomNav";
import { AppShell } from "@/components/dash/AppShell";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardShell() {
  const { user } = useAuth();
  const unread = useQuery(api.notifications.unreadCount);
  const conversations = useQuery(api.messages.myConversations);
  const communityUnread = useQuery(api.community.communityUnreadCount);
  const dmUnread = useQuery(api.community.dmUnreadCount);

  const unreadMessages = conversations?.reduce((s, c) => s + c.unread, 0) ?? 0;

  // Role is the source of truth: /dashboard/* is the STUDENT portal. A tutor
  // (or admin) account never sees student pages — not even by typing the URL
  // directly. Tutors belong in /tutor/*, admins in /admin/*.
  if (user?.role === "tutor") return <Navigate to="/academy/tutor" replace />;
  if (user?.role === "admin") return <Navigate to="/academy/admin" replace />;

  const sections = [
    {
      label: "Learning",
      items: [
        { to: "/academy/dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" />, end: true },
        { to: "/academy/dashboard/my-courses", label: "My Courses", icon: <BookOpen className="size-4" /> },
        { to: "/academy/dashboard/roadmap", label: "Roadmap", icon: <Map className="size-4" /> },
        { to: "/academy/dashboard/assignments", label: "Assignments", icon: <FileText className="size-4" /> },
        { to: "/academy/dashboard/certificates", label: "Certificates", icon: <Award className="size-4" /> },
      ],
    },
    {
      label: "Community",
      items: [
        {
          to: "/academy/dashboard/communities",
          label: "My Communities",
          icon: <MessageCircle className="size-4" />,
          badge:
            (communityUnread ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {(communityUnread ?? 0) > 99 ? "99+" : communityUnread}
              </span>
            ) : undefined,
        },
        { to: "/academy/dashboard/discover", label: "Discover Students", icon: <UserPlus className="size-4" /> },
        { to: "/academy/dashboard/connections", label: "Connections", icon: <Users className="size-4" /> },
      ],
    },
    {
      label: "Account",
      items: [
        {
          to: "/academy/dashboard/messages",
          label: "Messages",
          icon: <MessageSquare className="size-4" />,
          badge:
            unreadMessages > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {unreadMessages}
              </span>
            ) : undefined,
        },
        {
          to: "/academy/dashboard/dms",
          label: "Student DMs",
          icon: <MessageCircle className="size-4" />,
          badge:
            (dmUnread ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {(dmUnread ?? 0) > 99 ? "99+" : dmUnread}
              </span>
            ) : undefined,
        },
        {
          to: "/academy/dashboard/notifications",
          label: "Notifications",
          icon: <Bell className="size-4" />,
          badge:
            (unread ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {unread}
              </span>
            ) : undefined,
        },
        { to: "/academy/dashboard/profile", label: "Profile", icon: <User className="size-4" /> },
        { to: "/academy/dashboard/settings", label: "Settings", icon: <Settings className="size-4" /> },
      ],
    },
    {
      label: "Support",
      items: [
        { to: "/academy/dashboard/support", label: "Need Help?", icon: <HelpCircle className="size-4" /> },
      ],
    },
  ];

  const mobilePrimary: MobileNavItem[] = [
    { to: "/academy/dashboard", label: "Home", icon: <LayoutDashboard className="size-5" />, end: true },
    { to: "/academy/dashboard/my-courses", label: "Courses", icon: <BookOpen className="size-5" /> },
    { to: "/academy/dashboard/certificates", label: "Certificates", icon: <Award className="size-5" /> },
    { to: "/academy/dashboard/profile", label: "Profile", icon: <User className="size-5" /> },
  ];

  const mobileMore: MobileNavSection[] = [
    {
      label: "Learning",
      items: [
        { to: "/academy/dashboard/roadmap", label: "Roadmap", icon: <Map className="size-4" /> },
        { to: "/academy/dashboard/assignments", label: "Assignments", icon: <FileText className="size-4" /> },
      ],
    },
    {
      label: "Community",
      items: [
        { to: "/academy/dashboard/communities", label: "Communities", icon: <MessageCircle className="size-4" /> },
        { to: "/academy/dashboard/discover", label: "Discover Students", icon: <UserPlus className="size-4" /> },
        { to: "/academy/dashboard/connections", label: "Connections", icon: <Users className="size-4" /> },
        { to: "/academy/dashboard/dms", label: "Student DMs", icon: <MessageCircle className="size-4" /> },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/academy/dashboard/messages", label: "Messages", icon: <MessageSquare className="size-4" /> },
        { to: "/academy/dashboard/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
        { to: "/academy/dashboard/settings", label: "Settings", icon: <Settings className="size-4" /> },
      ],
    },
    {
      items: [
        { to: "/academy/dashboard/support", label: "Need Help?", icon: <HelpCircle className="size-4" /> },
        { to: "/academy", label: "Back to Academy home", icon: <Globe className="size-4" /> },
      ],
    },
  ];

  return <AppShell sections={sections} title="Student dashboard" mobilePrimaryItems={mobilePrimary} mobileMoreSections={mobileMore} />;
}
