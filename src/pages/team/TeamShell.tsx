import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  LayoutDashboard,
  ListTodo,
  BookOpen,
  MessageSquare,
  Activity,
  UserCircle,
  Settings,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";

export default function TeamShell() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam);

  const team = myTeam?.team as any;
  const teamName = team?.name ?? "Team";

  const basePath = `/team/${teamSlug}`;

  const sections = [
    {
      label: "Workspace",
      items: [
        { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
        { to: `${basePath}/work`, label: "Work", icon: <ListTodo className="size-4" /> },
        { to: `${basePath}/courses`, label: "Courses", icon: <BookOpen className="size-4" /> },
        { to: `${basePath}/reviews`, label: "Reviews", icon: <MessageSquare className="size-4" /> },
        { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
      ],
    },
    {
      label: "Team",
      items: [
        { to: `${basePath}/members`, label: "Members", icon: <Users className="size-4" /> },
        { to: `${basePath}/profile`, label: "Profile", icon: <UserCircle className="size-4" /> },
        { to: `${basePath}/settings`, label: "Settings", icon: <Settings className="size-4" /> },
      ],
    },
  ];

  return <AppShell sections={sections} title={`${teamName} Workspace`} />;
}
