import { useState, useEffect } from "react";
import { useParams, Outlet, Link, NavLink, useLocation } from "react-router";
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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/site/Avatar";
import logo from "@/assets/logo.svg";

/** Map team slug → team type for nav customization. */
function getTeamType(slug?: string): string {
  if (!slug) return "generic";
  if (slug.includes("academic")) return "academic";
  if (slug.includes("content")) return "content";
  if (slug.includes("ai")) return "ai";
  if (slug.includes("student") || slug.includes("experience"))
    return "student-experience";
  if (slug.includes("tutor-support")) return "tutor-support";
  return "generic";
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

function getNavSections(teamType: string, basePath: string) {
  const common: NavSection[] = [
    {
      label: "Team",
      items: [
        {
          to: `${basePath}/members`,
          label: "Members",
          icon: <Users className="size-4" />,
        },
        {
          to: `${basePath}/profile`,
          label: "Profile",
          icon: <UserCircle className="size-4" />,
        },
        {
          to: `${basePath}/settings`,
          label: "Settings",
          icon: <Settings className="size-4" />,
        },
      ],
    },
  ];

  switch (teamType) {
    case "academic":
      return [
        {
          label: "Workspace",
          items: [
            {
              to: basePath,
              label: "Overview",
              icon: <LayoutDashboard className="size-4" />,
              end: true,
            },
            {
              to: `${basePath}/tutors`,
              label: "Tutor Verification",
              icon: <GraduationCap className="size-4" />,
            },
            {
              to: `${basePath}/courses`,
              label: "Course Reviews",
              icon: <BookOpen className="size-4" />,
            },
            {
              to: `${basePath}/work`,
              label: "Work Items",
              icon: <ClipboardList className="size-4" />,
            },
            {
              to: `${basePath}/activity`,
              label: "Activity",
              icon: <Activity className="size-4" />,
            },
          ],
        },
        ...common,
      ];

    case "content":
      return [
        {
          label: "Workspace",
          items: [
            {
              to: basePath,
              label: "Overview",
              icon: <LayoutDashboard className="size-4" />,
              end: true,
            },
            {
              to: `${basePath}/submissions`,
              label: "Content Submissions",
              icon: <FileCheck className="size-4" />,
            },
            {
              to: `${basePath}/testimonials`,
              label: "Testimonials",
              icon: <MessageSquare className="size-4" />,
            },
            {
              to: `${basePath}/courses`,
              label: "Approved Content",
              icon: <BookOpen className="size-4" />,
            },
            {
              to: `${basePath}/work`,
              label: "Work Items",
              icon: <ClipboardList className="size-4" />,
            },
            {
              to: `${basePath}/activity`,
              label: "Activity",
              icon: <Activity className="size-4" />,
            },
          ],
        },
        ...common,
      ];

    case "ai":
      return [
        {
          label: "Workspace",
          items: [
            {
              to: basePath,
              label: "Overview",
              icon: <LayoutDashboard className="size-4" />,
              end: true,
            },
            {
              to: `${basePath}/ai-tools`,
              label: "AI Tools",
              icon: <Bot className="size-4" />,
            },
            {
              to: `${basePath}/prompts`,
              label: "Prompt Library",
              icon: <Palette className="size-4" />,
            },
            {
              to: `${basePath}/work`,
              label: "Work Items",
              icon: <ClipboardList className="size-4" />,
            },
            {
              to: `${basePath}/activity`,
              label: "Activity",
              icon: <Activity className="size-4" />,
            },
          ],
        },
        ...common,
      ];

    case "student-experience":
      return [
        {
          label: "Workspace",
          items: [
            {
              to: basePath,
              label: "Overview",
              icon: <LayoutDashboard className="size-4" />,
              end: true,
            },
            {
              to: `${basePath}/support`,
              label: "Support Tickets",
              icon: <HeartHandshake className="size-4" />,
            },
            {
              to: `${basePath}/feedback`,
              label: "Student Feedback",
              icon: <MessageSquare className="size-4" />,
            },
            {
              to: `${basePath}/escalations`,
              label: "Escalations",
              icon: <AlertTriangle className="size-4" />,
            },
            {
              to: `${basePath}/work`,
              label: "Work Items",
              icon: <ClipboardList className="size-4" />,
            },
            {
              to: `${basePath}/activity`,
              label: "Activity",
              icon: <Activity className="size-4" />,
            },
          ],
        },
        ...common,
      ];

    case "tutor-support":
      return [
        {
          label: "Workspace",
          items: [
            {
              to: basePath,
              label: "Overview",
              icon: <LayoutDashboard className="size-4" />,
              end: true,
            },
            {
              to: `${basePath}/cases`,
              label: "Support Cases",
              icon: <Headphones className="size-4" />,
            },
            {
              to: `${basePath}/tutor-profiles`,
              label: "Tutor Profiles",
              icon: <Users className="size-4" />,
            },
            {
              to: `${basePath}/escalations`,
              label: "Escalations",
              icon: <AlertTriangle className="size-4" />,
            },
            {
              to: `${basePath}/work`,
              label: "Work Items",
              icon: <ClipboardList className="size-4" />,
            },
            {
              to: `${basePath}/activity`,
              label: "Activity",
              icon: <Activity className="size-4" />,
            },
          ],
        },
        ...common,
      ];

    default:
      return [
        {
          label: "Workspace",
          items: [
            {
              to: basePath,
              label: "Overview",
              icon: <LayoutDashboard className="size-4" />,
              end: true,
            },
            {
              to: `${basePath}/work`,
              label: "Work",
              icon: <ClipboardList className="size-4" />,
            },
            {
              to: `${basePath}/courses`,
              label: "Courses",
              icon: <BookOpen className="size-4" />,
            },
            {
              to: `${basePath}/reviews`,
              label: "Reviews",
              icon: <MessageSquare className="size-4" />,
            },
            {
              to: `${basePath}/activity`,
              label: "Activity",
              icon: <Activity className="size-4" />,
            },
          ],
        },
        ...common,
      ];
  }
}

export default function TeamShell() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { teamMember, logout } = useTeamAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const teamName = teamMember?.team?.name ?? teamMember?.name ?? "Team";
  const basePath = `/team/${teamSlug}`;
  const teamType = getTeamType(teamSlug);
  const sections = getNavSections(teamType, basePath);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/team/login";
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/8 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="ForgeX Academy"
            className="size-8 rounded-lg"
          />
          <span className="font-display text-base font-bold">
            ForgeX<span className="text-lime-400"> Academy</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-lime-400/12 text-lime-300"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )
                  }
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar
            name={teamMember?.name}
            className="size-9"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {teamMember?.name ?? "Team Member"}
            </p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {teamMember?.team?.name ?? teamMember?.teamSlug ?? "Team"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-clip bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/8 bg-sidebar lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/8 bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="font-display min-w-0 truncate text-lg font-bold">
              {teamName} Workspace
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Avatar
              name={teamMember?.name}
              className="size-9"
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto min-w-0 max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
