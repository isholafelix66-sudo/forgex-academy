import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";

export default function TutorShell() {
  const pending = useQuery(api.tutor.pendingSubmissions);
  const conversations = useQuery(api.messages.myConversations);
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
      ],
    },
  ];

  return <AppShell sections={sections} title="Tutor dashboard" />;
}
