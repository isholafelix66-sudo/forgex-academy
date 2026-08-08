import { Link } from "react-router";
import logo from "@/assets/logo.svg";

const UPCOMING = [
  "Opportunity Hub",
  "Internships",
  "Scholarships",
  "Recruitment",
  "Mentorship",
  "AI Career Coach",
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="ForgeX Academy" className="size-9 rounded-xl" />
              <span className="font-display text-lg font-bold">
                ForgeX<span className="text-lime-400"> Academy</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The learning platform of ForgeX Network. Learn practical skills,
              follow structured roadmaps, and earn verifiable certificates that
              unlock real opportunities.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-lime-400/80">
              Learn. Build. Succeed.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Explore</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/courses" className="transition-colors hover:text-lime-300">Courses</Link></li>
              <li><Link to="/roadmap" className="transition-colors hover:text-lime-300">Learning roadmaps</Link></li>
              <li><Link to="/tutors" className="transition-colors hover:text-lime-300">Tutors</Link></li>
              <li><Link to="/updates" className="transition-colors hover:text-lime-300">Updates</Link></li>
              <li><Link to="/about" className="transition-colors hover:text-lime-300">About us</Link></li>
              <li><Link to="/become-tutor" className="transition-colors hover:text-lime-300">Become a tutor</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Coming soon from ForgeX Network
            </h4>
            <ul className="mt-4 flex flex-wrap gap-2">
              {UPCOMING.map((m) => (
                <li
                  key={m}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                >
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} ForgeX Network. All rights reserved.</p>
          <p>
            A module of{" "}
            <span className="font-medium text-lime-400">ForgeX Network</span> —
            learn, build, succeed.
          </p>
        </div>
      </div>
    </footer>
  );
}
