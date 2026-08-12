import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Bell,
  BookOpen,
  FileText,
  Globe,
  LayoutDashboard,
  Map,
  MessageSquare,
  Settings,
  User,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";

export default function DashboardShell() {
  const unread = useQuery(api.notifications.unreadCount);
  const conversations = useQuery(api.messages.myConversations);

  const unreadMessages = conversations?.reduce((s, c) => s + c.unread, 0) ?? 0;

  const sections = [
    {
      // Public ForgeX homepage — no label so it sits at the very top of the
      // sidebar, above the Learning section.
      items: [
        {
          to: "/",
          label: "Explore ForgeX",
          icon: <Globe className="size-4" />,
          end: true,
        },
      ],
    },
    {
      label: "Learning",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" />, end: true },
        { to: "/dashboard/my-courses", label: "My Courses", icon: <BookOpen className="size-4" /> },
        { to: "/dashboard/roadmap", label: "Roadmap", icon: <Map className="size-4" /> },
        { to: "/dashboard/assignments", label: "Assignments", icon: <FileText className="size-4" /> },
        { to: "/dashboard/certificates", label: "Certificates", icon: <Award className="size-4" /> },
      ],
    },
    {
      label: "Account",
      items: [
        {
          to: "/dashboard/messages",
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
          to: "/dashboard/notifications",
          label: "Notifications",
          icon: <Bell className="size-4" />,
          badge:
            (unread ?? 0) > 0 ? (
              <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {unread}
              </span>
            ) : undefined,
        },
        { to: "/dashboard/profile", label: "Profile", icon: <User className="size-4" /> },
        { to: "/dashboard/settings", label: "Settings", icon: <Settings className="size-4" /> },
      ],
    },
  ];

  return <AppShell sections={sections} title="Student dashboard" />;
}
