import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import logo from "@/assets/logo.svg";

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "f",
  instagram: "ig",
  x: "𝕏",
  linkedin: "in",
  youtube: "▶",
  tiktok: "♫",
  whatsapp: "wa",
  telegram: "✈",
};

const UPCOMING = [
  "Opportunity Hub",
  "Internships",
  "Scholarships",
  "Recruitment",
  "Mentorship",
  "AI Career Coach",
];

const DESCRIPTION =
  "The learning platform of ForgeX Network. Discover skills, express " +
  "yourself, and build the career you want — with structured paths, " +
  "verified tutors and certificates that unlock real opportunities.";

// The dedicated ForgeX Network platform URL. Social profile links always
// stay in the "Follow us" section below and are never used here.
const NETWORK_URL = "https://forgex.network";

// Only trust an admin-configured networkUrl if it points at a ForgeX-branded
// domain (e.g. forgex.network / forgex.academy). Anything else — stale social
// profile URLs, typos — falls back to the dedicated platform URL above.
function resolveNetworkUrl(raw: unknown): string {
  const candidate = typeof raw === "string" ? raw.trim() : "";
  if (/^https?:\/\/(?:[\w-]+\.)?forgex\.[a-z]{2,}\/?$/i.test(candidate)) {
    return candidate;
  }
  return NETWORK_URL;
}

export function Footer() {
  const content = useQuery(api.public.siteContentAll);
  const brandLogo = (content?.logo as string | undefined) || logo;
  const networkUrl = resolveNetworkUrl(content?.networkUrl);
  const contact = (content?.contact as
    | { email?: string; phone?: string; address?: string }
    | undefined) || {};
  const socials = (content?.socials ?? []) as Array<{
    platform: string;
    url: string;
    enabled?: boolean;
    order?: number;
  }>;

  const visibleSocials = socials
    .filter((s) => s.enabled !== false && s.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 md:pb-14 md:pt-14">
        {/* ── Mobile footer — compact closing brand section ──
             Navigation lives in the fixed bottom bar, so this stays
             minimal: brand, short description, tagline, utility row. */}
        <div className="md:hidden">
          <div className="flex items-center gap-2.5">
            <img src={brandLogo} alt="ForgeX Academy" className="size-8 rounded-lg" />
            <span className="font-display text-base font-bold">
              ForgeX<span className="text-lime-400"> Academy</span>
            </span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {DESCRIPTION}
          </p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-lime-400/80">
            Discover. Express. Build.
          </p>

          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                <Mail className="size-3.5 text-lime-400" />
                Get in touch
              </a>
            ) : (
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                <Mail className="size-3.5 text-lime-400" />
                Get in touch
              </Link>
            )}
            <a
              href={networkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              ForgeX Network
              <ExternalLink className="size-3 text-lime-400/70" />
            </a>
          </div>
        </div>

        {/* ── Desktop footer — unchanged ── */}
        <div className="hidden gap-10 md:grid md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={brandLogo} alt="ForgeX Academy" className="size-9 rounded-xl" />
              <span className="font-display text-lg font-bold">
                ForgeX<span className="text-lime-400"> Academy</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {DESCRIPTION}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-lime-400/80">
              Discover. Express. Build.
            </p>
          </div>

          {/* Quick links — desktop only; mobile uses the bottom nav + More menu */}
          <div className="hidden md:block">
            <h4 className="text-sm font-semibold text-foreground">Quick links</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/" className="transition-colors hover:text-lime-300">Home</Link></li>
              <li><Link to="/about" className="transition-colors hover:text-lime-300">About</Link></li>
              <li><Link to="/courses" className="transition-colors hover:text-lime-300">Courses</Link></li>
              <li><Link to="/tutors" className="transition-colors hover:text-lime-300">Tutors</Link></li>
              <li><Link to="/roadmap" className="transition-colors hover:text-lime-300">Roadmap</Link></li>
              <li><Link to="/ai-hub" className="transition-colors hover:text-lime-300">AI Hub</Link></li>
              <li><Link to="/prompts" className="transition-colors hover:text-lime-300">Prompt Library</Link></li>
              <li><Link to="/stories" className="transition-colors hover:text-lime-300">Stories</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-lime-300">Contact</Link></li>
            </ul>
          </div>

          {/* Get in touch — desktop only */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">Get in touch</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {contact.email && (
                <li className="flex items-center gap-2">
                  <Mail className="size-3.5 text-lime-400" />
                  <a href={`mailto:${contact.email}`} className="transition-colors hover:text-lime-300">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-3.5 text-lime-400" />
                  <span>{contact.phone}</span>
                </li>
              )}
              {contact.address && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-lime-400" />
                  <span>{contact.address}</span>
                </li>
              )}
              {!contact.email && !contact.phone && !contact.address && (
                <li><Link to="/contact" className="transition-colors hover:text-lime-300">Contact page</Link></li>
              )}
            </ul>

            {visibleSocials.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-foreground">Follow us</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSocials.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.platform}
                      className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                    >
                      {SOCIAL_ICONS[s.platform] ?? s.platform.slice(0, 2)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-muted-foreground sm:flex-row md:mt-12 md:pt-6">
          <p>© {new Date().getFullYear()} ForgeX Network. All rights reserved.</p>
          <p className="hidden md:block">
            A module of{" "}
            <span className="font-medium text-lime-400">ForgeX Network</span> —
            discover, express, build.
          </p>
        </div>
      </div>
    </footer>
  );
}