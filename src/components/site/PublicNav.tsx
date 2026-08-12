import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Menu, X, LogOut, LayoutDashboard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { Avatar } from "./Avatar";

const LINKS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: "/", label: "Home", end: true },
  { to: "/courses", label: "Courses" },
  { to: "/tutors", label: "Tutors" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/updates", label: "Updates" },
  { to: "/ai-hub", label: "AI Hub" },
  { to: "/prompts", label: "Prompt Library" },
  { to: "/stories", label: "Stories" },
  { to: "/contact", label: "Contact" },
  { to: "/about", label: "About" },
];

export function PublicNav() {
  const { isAuthenticated, user, signOut } = useAuth();
  const content = useQuery(api.public.siteContentAll);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const brandLogo = (content?.logo as string | undefined) || logo;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-lime-400/10 text-lime-300"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-lg px-3 py-2.5 text-sm font-medium",
      isActive ? "bg-lime-400/10 text-lime-300" : "text-muted-foreground hover:bg-white/5",
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-white/10 bg-[#0d0f0c]/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={brandLogo} alt="ForgeX Academy" className="size-9 rounded-xl" />
          <span className="font-display text-lg font-bold tracking-tight">
            ForgeX<span className="text-lime-400"> Academy</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                data-prefetch="/dashboard"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="mr-2 size-4" />
                Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-prefetch="/dashboard/profile"
                onClick={() => navigate("/dashboard/profile")}
              >
                <User className="mr-2 size-4" />
                Profile
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleSignOut} title="Sign out">
                <LogOut className="size-4" />
              </Button>
              <Link to="/dashboard/profile">
                <Avatar name={user?.name ?? "Student"} image={user?.image} className="size-8" />
              </Link>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                data-prefetch="/auth"
                onClick={() => navigate("/auth?mode=signin")}
              >
                Login
              </Button>
              <Button
                size="sm"
                data-prefetch="/auth"
                className="bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                onClick={() => navigate("/auth?mode=signup")}
              >
                Sign up
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#0d0f0c]/95 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={mobileLinkClass}>
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              {isAuthenticated ? (
                <>
                  <Button
                    className="w-full"
                    data-prefetch="/dashboard"
                    onClick={() => navigate("/dashboard")}
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    data-prefetch="/dashboard/profile"
                    onClick={() => navigate("/dashboard/profile")}
                  >
                    Profile
                  </Button>
                  <Button variant="outline" className="w-full text-rose-300" onClick={handleSignOut}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    data-prefetch="/auth"
                    onClick={() => navigate("/auth?mode=signin")}
                  >
                    Login
                  </Button>
                  <Button
                    className="w-full"
                    data-prefetch="/auth"
                    onClick={() => navigate("/auth?mode=signup")}
                  >
                    Sign up
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
