import { Link, useLocation } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import logo from "@/assets/logo.svg";
import { toExternalHref } from "@/lib/url";
import { BrandMark } from "./BrandMark";
import { useBranding } from "@/lib/branding";

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

// Shown in the footer only until the owner adds real social links in the
// admin portal (Admin → Website & branding → Social media). Once any links
// are saved there, they fully replace these defaults.
const DEFAULT_SOCIALS = [
  { platform: "facebook", url: "https://facebook.com", enabled: true, order: 0 },
  { platform: "instagram", url: "https://instagram.com", enabled: true, order: 1 },
  { platform: "x", url: "https://x.com", enabled: true, order: 2 },
  { platform: "linkedin", url: "https://linkedin.com", enabled: true, order: 3 },
  { platform: "youtube", url: "https://youtube.com", enabled: true, order: 4 },
  { platform: "tiktok", url: "https://tiktok.com", enabled: true, order: 5 },
];

/** Fallback description — editable in the admin panel's branding section. */
const DESCRIPTION =
  "The portfolio platform of ForgeX Network. Create your portfolio once, " +
  "turn it into your own professional website, and share one link anywhere.";

function AcademyFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-28 pt-8 sm:px-6 md:flex-row md:items-center md:justify-between md:pb-10">
        <div>
          <p className="font-display text-lg font-bold">ForgeX <span className="text-lime-400">Academy</span></p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Learn practical, project-led skills from verified tutors and keep building with the full ForgeX community.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Academy footer navigation">
          {[
            ["/academy/courses", "Courses"],
            ["/academy/tutors", "Tutors"],
            ["/academy/showcase", "Testimonies"],
            ["/academy/prompts", "Prompts"],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function Footer({
  product,
}: {
  product?: "academy" | "portfolio";
} = {}) {
  const { pathname } = useLocation();
  const content = useQuery(api.public.siteContentAll);
  const branding = useBranding();
  const brandLogo = (content?.logo as string | undefined) || logo;
  const description =
    typeof content?.footerDescription === "string" &&
    content.footerDescription.trim()
      ? content.footerDescription
      : DESCRIPTION;
  const contact = (content?.contact as
    | { email?: string; phone?: string; address?: string }
    | undefined) || {};
  const socials = (content?.socials ?? []) as Array<{
    platform: string;
    url: string;
    enabled?: boolean;
    order?: number;
  }>;

  // Admin-configured links win; until the owner saves any, the standard
  // platform icons keep the section alive so it never looks unfinished.
  const visibleSocials =
    socials.length > 0
      ? socials
          .filter((s) => s.enabled !== false && s.url)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : DEFAULT_SOCIALS;

  // The active product is determined by the route (or explicitly by the
  // layout that mounts this footer) — never inferred from the signed-in user.
  const isAcademy = product
    ? product === "academy"
    : pathname === "/" || pathname.startsWith("/academy");
  if (isAcademy) {
    return <AcademyFooter />;
  }

  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 md:pb-14 md:pt-14">
        {/* ── Mobile footer — compact closing brand section ──
             Navigation lives in the fixed bottom bar, so this stays
             minimal: brand, short description, tagline, utility row. */}
        <div className="md:hidden">
          <div className="flex items-center gap-2.5">
            <img src={brandLogo} alt={branding.name} className="size-8 rounded-lg" />
            <BrandMark branding={branding} size="lg" />
          </div>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-lime-400/80">
            {branding.tagline}
          </p>

          {/* Secondary navigation — the bottom tab bar only carries the four
              primary destinations, so the rest lives here on mobile. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { to: "/portfolio", label: "Home" },
              { to: "/portfolio/about", label: "About" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex max-w-full items-center whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/help"
              className="inline-flex max-w-full items-center whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              Get help
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            {/* Sends an in-app message to the ForgeX team inbox (Contact form),
                never a mailto: redirect to the visitor's email app. */}
            <Link
              to="/help"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              <MessageSquare className="size-3.5 text-lime-400" />
              Get in touch
            </Link>
            {/* Social icons managed in the admin portal — same list as the
                desktop "Follow us" section, opened in a new tab. */}
            {visibleSocials.length > 0 && (
              <div className="ml-auto flex items-center gap-1.5">
                {visibleSocials.map((s) => (
                  <a
                    key={s.platform}
                    href={toExternalHref(s.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.platform}
                    className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                  >
                    {SOCIAL_ICONS[s.platform] ?? s.platform.slice(0, 2)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop footer — unchanged ── */}
        <div className="hidden gap-10 md:grid md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={brandLogo} alt={branding.name} className="size-9 rounded-xl" />
              <BrandMark branding={branding} size="lg" />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-lime-400/80">
              {branding.tagline}
            </p>
          </div>

          {/* Quick links — desktop only; mobile uses the bottom nav + More menu */}
          <div className="hidden md:block">
            <h4 className="text-sm font-semibold text-foreground">Quick links</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/portfolio" className="transition-colors hover:text-lime-300">Home</Link></li>
              <li><Link to="/portfolio/explore" className="transition-colors hover:text-lime-300">Explore portfolios</Link></li>
              <li><Link to="/portfolio/about" className="transition-colors hover:text-lime-300">About</Link></li>
              <li>
                <Link to="/help" className="transition-colors hover:text-lime-300">
                  Get help / report an issue
                </Link>
              </li>
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
                <li><Link to="/help" className="transition-colors hover:text-lime-300">Get help</Link></li>
              )}
            </ul>

            {visibleSocials.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-foreground">Follow us</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSocials.map((s) => (
                    <a
                      key={s.platform}
                      href={toExternalHref(s.url)}
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
          <p>
            © {new Date().getFullYear()} {branding.name}. All rights reserved.
          </p>
          <p className="hidden md:block">
            Create • showcase • grow with your own professional portfolio.
          </p>
        </div>
      </div>
    </footer>
  );
}