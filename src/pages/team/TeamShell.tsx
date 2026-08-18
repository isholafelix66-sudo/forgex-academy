import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  MessageSquare,
  Activity,
  UserCircle,
  Settings,
  Users,
  GraduationCap,
  FileCheck,
  Palette,
  Bot,
  HeartHandshake,
  Headphones,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/dash/AppShell";

/** Map team slug → team type for nav customization. */
function getTeamType(slug?: string): string {
  if (!slug) return "generic";
  if (slug.includes("academic")) return "academic";
  if (slug.includes("content")) return "content";
  if (slug.includes("ai")) return "ai";
  if (slug.includes("student") || slug.includes("experience")) return "student-experience";
  if (slug.includes("tutor-support")) return "tutor-support";
  return "generic";
}

function getNavSections(teamType: string, basePath: string) {
  // Common sections shared by all teams
  const common = [
    {
      label: "Team",
      items: [
        { to: `${basePath}/members`, label: "Members", icon: <Users className="size-4" /> },
        { to: `${basePath}/profile`, label: "Profile", icon: <UserCircle className="size-4" /> },
        { to: `${basePath}/settings`, label: "Settings", icon: <Settings className="size-4" /> },
      ],
    },
  ];

  switch (teamType) {
    case "academic":
      return [
        {
          label: "Workspace",
          items: [
            { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
            { to: `${basePath}/tutors`, label: "Tutor Verification", icon: <GraduationCap className="size-4" /> },
            { to: `${basePath}/courses`, label: "Course Reviews", icon: <BookOpen className="size-4" /> },
            { to: `${basePath}/work`, label: "Work Items", icon: <ClipboardList className="size-4" /> },
            { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
          ],
        },
        ...common,
      ];

    case "content":
      return [
        {
          label: "Workspace",
          items: [
            { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
            { to: `${basePath}/submissions`, label: "Content Submissions", icon: <FileCheck className="size-4" /> },
            { to: `${basePath}/testimonials`, label: "Testimonials", icon: <MessageSquare className="size-4" /> },
            { to: `${basePath}/courses`, label: "Approved Content", icon: <BookOpen className="size-4" /> },
            { to: `${basePath}/work`, label: "Work Items", icon: <ClipboardList className="size-4" /> },
            { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
          ],
        },
        ...common,
      ];

    case "ai":
      return [
        {
          label: "Workspace",
          items: [
            { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
            { to: `${basePath}/ai-tools`, label: "AI Tools", icon: <Bot className="size-4" /> },
            { to: `${basePath}/prompts`, label: "Prompt Library", icon: <Palette className="size-4" /> },
            { to: `${basePath}/work`, label: "Work Items", icon: <ClipboardList className="size-4" /> },
            { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
          ],
        },
        ...common,
      ];

    case "student-experience":
      return [
        {
          label: "Workspace",
          items: [
            { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
            { to: `${basePath}/support`, label: "Support Tickets", icon: <HeartHandshake className="size-4" /> },
            { to: `${basePath}/feedback`, label: "Student Feedback", icon: <MessageSquare className="size-4" /> },
            { to: `${basePath}/escalations`, label: "Escalations", icon: <AlertTriangle className="size-4" /> },
            { to: `${basePath}/work`, label: "Work Items", icon: <ClipboardList className="size-4" /> },
            { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
          ],
        },
        ...common,
      ];

    case "tutor-support":
      return [
        {
          label: "Workspace",
          items: [
            { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
            { to: `${basePath}/cases`, label: "Support Cases", icon: <Headphones className="size-4" /> },
            { to: `${basePath}/tutor-profiles`, label: "Tutor Profiles", icon: <Users className="size-4" /> },
            { to: `${basePath}/escalations`, label: "Escalations", icon: <AlertTriangle className="size-4" /> },
            { to: `${basePath}/work`, label: "Work Items", icon: <ClipboardList className="size-4" /> },
            { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
          ],
        },
        ...common,
      ];

    default:
      return [
        {
          label: "Workspace",
          items: [
            { to: basePath, label: "Overview", icon: <LayoutDashboard className="size-4" />, end: true },
            { to: `${basePath}/work`, label: "Work", icon: <ClipboardList className="size-4" /> },
            { to: `${basePath}/courses`, label: "Courses", icon: <BookOpen className="size-4" /> },
            { to: `${basePath}/reviews`, label: "Reviews", icon: <MessageSquare className="size-4" /> },
            { to: `${basePath}/activity`, label: "Activity", icon: <Activity className="size-4" /> },
          ],
        },
        ...common,
      ];
  }
}

export default function TeamShell() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { teamMember } = useTeamAuth();

  const teamName = teamMember?.team?.name ?? teamMember?.name ?? "Team";

  const basePath = `/team/${teamSlug}`;
  const teamType = getTeamType(teamSlug);
  const sections = getNavSections(teamType, basePath);

  return <AppShell sections={sections} title={`${teamName} Workspace`} />;
}
