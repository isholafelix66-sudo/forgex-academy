import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Briefcase,
  Check,
  Eye,
  Flag,
  FolderKanban,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  Star,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { SafeImage } from "@/components/site/SafeImage";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { useBranding } from "@/lib/branding";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import { toast } from "sonner";

const ACCENTS: Record<string, string> = {
  lime: "#a3e635",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  amber: "#fbbf24",
  rose: "#fb7185",
  emerald: "#34d399",
};

const TEMPLATES = {
  carbon: {
    page: "bg-[#070906] text-[#f2f6ec]",
    panel: "border-white/10 bg-white/[0.03]",
    muted: "text-white/55",
    chip: "border-white/12 bg-white/[0.04] text-white/70",
    nav: "border-white/10 bg-[#070906]/85",
  },
  aurora: {
    page: "bg-[#080a14] text-[#eef1ff]",
    panel: "border-white/10 bg-white/[0.04]",
    muted: "text-white/55",
    chip: "border-white/12 bg-white/[0.05] text-white/70",
    nav: "border-white/10 bg-[#080a14]/85",
  },
  paper: {
    page: "bg-[#f7f6f2] text-[#15160f]",
    panel: "border-black/10 bg-white shadow-sm",
    muted: "text-black/55",
    chip: "border-black/10 bg-black/[0.04] text-black/70",
    nav: "border-black/10 bg-[#f7f6f2]/90",
  },
} as const;

const SECTION_LABELS: Record<string, string> = {
  about: "About",
  projects: "Projects",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  services: "Services",
  contact: "Contact",
};

export default function PublicPortfolio() {
  const branding = useBranding();
  const { slug = "" } = useParams();
  const viewerToken = getPortfolioUserToken();
  const data = useQuery(
    api.projects.publicPortfolio,
    viewerToken ? { slug, viewerToken } : { slug },
  );
  const recordView = useMutation(api.projects.recordView);
  const report = useMutation(api.projects.reportPortfolio);

  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const portfolio = data?.status === "ok" ? data.portfolio : null;

  // Count one view per browser session per portfolio (never the owner's own).
  useEffect(() => {
    if (data?.status !== "ok" || data.isOwner) return;
    const key = `fx:portfolio-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked — count it anyway */
    }
    void recordView({ slug, viewerToken: viewerToken ?? undefined }).catch(() => {});
  }, [data, slug, recordView]);

  const theme = TEMPLATES[portfolio?.template ?? "carbon"];
  const accent = ACCENTS[portfolio?.accent ?? "lime"] ?? ACCENTS.lime;

  const sections = useMemo(() => {
    if (!portfolio) return [] as string[];
    const present: string[] = [];
    if (portfolio.about || portfolio.bio) present.push("about");
    if (portfolio.skills.length) present.push("skills");
    if (portfolio.experience.length) present.push("experience");
    if (portfolio.education.length) present.push("education");
    if (portfolio.services.length) present.push("services");
    present.push("projects");
    present.push("contact");
    const order = portfolio.sectionOrder ?? [];
    if (order.length === 0) return present;
    return [...present].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [portfolio]);

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : `/p/${slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Portfolio link copied.");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy automatically — select the address bar instead.");
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not public ───────────────────────────────────────────────────────────
  if (data.status !== "ok") {
    const title =
      data.status === "draft"
        ? "This portfolio isn't public yet"
        : data.status === "removed"
          ? "This portfolio isn't available"
          : "We couldn't find that portfolio";
    const body =
      data.status === "draft"
        ? `${data.displayName || "This creator"} is still working on their portfolio. Only they can see it right now.`
        : "The link may be wrong, or the owner has unpublished this portfolio.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
            <Lock className="size-6" />
          </span>
          <h1 className="font-display mt-5 text-xl font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/explore">
              <Button variant="outline" className="border-white/15">
                Explore portfolios
              </Button>
            </Link>
            <Link to="/portfolio/auth">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolio) return null;

  const contactEmail = portfolio.email;
  const contactPhone = portfolio.phone;

  return (
    <div className={cn("min-h-screen", theme.page)}>
      {/* Owner preview banner */}
      {data.isOwner && (
        <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 border-b border-lime-400/25 bg-lime-400/10 px-4 py-2 text-xs font-semibold text-lime-200 backdrop-blur">
          <Eye className="size-3.5" />
          {portfolio.visibility === "draft"
            ? "Only you can see this — your portfolio is still a draft."
            : "You're viewing your live portfolio."}
          <Link
            to="/portfolio/edit"
            className="rounded-full border border-lime-400/40 px-3 py-0.5 transition-colors hover:bg-lime-400 hover:text-black"
          >
            Edit portfolio
          </Link>
        </div>
      )}

      {/* Sticky section nav */}
      <header
        className={cn(
          "sticky top-0 z-30 border-b backdrop-blur-xl",
          theme.nav,
          data.isOwner && "top-9",
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="font-display truncate text-sm font-bold tracking-tight">
            {portfolio.displayName}
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {sections.map((s) => (
              <a
                key={s}
                href={`#${s}`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors hover:opacity-100",
                  theme.muted,
                )}
              >
                {SECTION_LABELS[s] ?? s}
              </a>
            ))}
          </nav>
          <button
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-current/20 px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: accent, borderColor: `${accent}55` }}
          >
            {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative pt-14 sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 left-1/2 h-[280px] w-[80%] -translate-x-1/2 rounded-full blur-[110px]"
            style={{ background: `${accent}22` }}
          />
          {portfolio.coverUrl && (
            <SafeImage
              src={portfolio.coverUrl}
              alt=""
              className="relative mb-8 h-40 w-full rounded-3xl object-cover sm:h-56"
              fallback={null}
            />
          )}
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <Avatar
              name={portfolio.displayName}
              image={portfolio.avatarUrl}
              className="size-24 text-2xl sm:size-28"
            />
            <div className="min-w-0">
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
              >
                {portfolio.displayName}
              </motion.h1>
              {portfolio.headline && (
                <p className="mt-2 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: accent }}>
                  {portfolio.headline}
                </p>
              )}
              <div className={cn("mt-3 flex flex-wrap items-center gap-3 text-sm", theme.muted)}>
                {portfolio.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {portfolio.location}
                  </span>
                )}
                {portfolio.availability && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: accent }}
                    />
                    {portfolio.availability}
                  </span>
                )}
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <Mail className="size-4" /> {contactEmail}
                  </a>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-4" /> {portfolio.views} views
                </span>
              </div>
              {portfolio.links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {portfolio.links.map((l) => (
                    <a
                      key={`${l.label}-${l.url}`}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        theme.chip,
                      )}
                    >
                      {l.label}
                      <ArrowUpRight className="size-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── About ──────────────────────────────────────────────────────── */}
        {(portfolio.about || portfolio.bio) && (
          <Section id="about" title="About" theme={theme} accent={accent}>
            <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed opacity-90">
              {portfolio.about || portfolio.bio}
            </p>
          </Section>
        )}

        {/* ── Skills ─────────────────────────────────────────────────────── */}
        {portfolio.skills.length > 0 && (
          <Section id="skills" title="Skills" theme={theme} accent={accent}>
            <div className="flex flex-wrap gap-2">
              {portfolio.skills.map((s) => (
                <span
                  key={s.name}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium",
                    theme.chip,
                  )}
                >
                  {s.name}
                  {typeof s.level === "number" && (
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="size-1.5 rounded-full"
                          style={{
                            background: i < (s.level ?? 0) ? accent : `${accent}33`,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* ── Projects ───────────────────────────────────────────────────── */}
        {data.projects.length > 0 && (
          <Section id="projects" title="Projects" theme={theme} accent={accent}>
            <div className="grid gap-5 sm:grid-cols-2">
              {[...data.projects]
                .sort((a, b) => Number(b.featured) - Number(a.featured))
                .map((p) => (
                  <Link
                    key={p._id}
                    to={`/p/${slug}/project/${p._id}`}
                    className={cn(
                      "group flex flex-col overflow-hidden rounded-2xl border transition-transform hover:-translate-y-0.5",
                      theme.panel,
                    )}
                  >
                    <SafeImage
                      src={p.imageUrl}
                      alt={p.title}
                      className="h-44 w-full object-cover"
                      fallback={
                        <div
                          className="flex h-44 w-full items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${accent}22, transparent)`,
                          }}
                        >
                          <FolderKanban className="size-8" style={{ color: accent }} />
                        </div>
                      }
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold leading-snug">
                          {p.title}
                        </h3>
                        {p.year && (
                          <span className={cn("shrink-0 text-xs", theme.muted)}>
                            {p.year}
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-2 text-sm leading-relaxed", theme.muted)}>
                        {p.summary}
                      </p>
                      {p.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Tools used">
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                theme.chip,
                              )}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100" style={{ color: accent }}>
                        View case study <ArrowUpRight className="size-3" />
                      </span>
                      {(p.liveUrl || p.repoUrl) && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-1">
                          {p.liveUrl && (
                            <a
                              href={p.liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-black"
                              style={{ background: accent }}
                            >
                              View live <ArrowUpRight className="size-3" />
                            </a>
                          )}
                          {p.repoUrl && (
                            <a
                              href={p.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold",
                                theme.chip,
                              )}
                            >
                              Source <ArrowUpRight className="size-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
            </div>
          </Section>
        )}

        {/* ── Experience ─────────────────────────────────────────────────── */}
        {portfolio.experience.length > 0 && (
          <Section id="experience" title="Experience" theme={theme} accent={accent} icon={
            <Briefcase className="size-4" />
          }>
            <Timeline
              theme={theme}
              accent={accent}
              items={portfolio.experience.map((e) => ({
                key: `${e.role}-${e.org}-${e.start ?? ""}`,
                title: e.role,
                subtitle: e.org,
                meta: [e.start, e.current ? "Present" : e.end]
                  .filter(Boolean)
                  .join(" — "),
                location: e.location,
                body: e.description,
              }))}
            />
          </Section>
        )}

        {/* ── Education ──────────────────────────────────────────────────── */}
        {portfolio.education.length > 0 && (
          <Section id="education" title="Education" theme={theme} accent={accent} icon={
            <GraduationCap className="size-4" />
          }>
            <Timeline
              theme={theme}
              accent={accent}
              items={portfolio.education.map((e) => ({
                key: `${e.school}-${e.qualification ?? ""}-${e.start ?? ""}`,
                title: e.qualification || e.school,
                subtitle: e.qualification ? e.school : e.field || "",
                meta: [e.start, e.end].filter(Boolean).join(" — "),
                body: e.description,
              }))}
            />
          </Section>
        )}

        {/* ── Services ───────────────────────────────────────────────────── */}
        {portfolio.services.length > 0 && (
          <Section id="services" title="Services" theme={theme} accent={accent} icon={
            <Wrench className="size-4" />
          }>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.services.map((s) => (
                <div
                  key={s.title}
                  className={cn("rounded-2xl border p-5", theme.panel)}
                >
                  <h3 className="font-display text-base font-semibold">{s.title}</h3>
                  {s.description && (
                    <p className={cn("mt-2 text-sm leading-relaxed", theme.muted)}>
                      {s.description}
                    </p>
                  )}
                  {s.price && (
                    <p className="mt-3 text-sm font-bold" style={{ color: accent }}>
                      {s.price}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Contact ────────────────────────────────────────────────────── */}
        <Section id="contact" title="Contact" theme={theme} accent={accent}>
          <div className={cn("rounded-2xl border p-6", theme.panel)}>
            <p className="text-[15px] leading-relaxed opacity-90">
              Want to work together or just say hello? Reach out.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-black"
                  style={{ background: accent }}
                >
                  <Mail className="size-4" /> Email me
                </a>
              )}
              {contactPhone && (
                <a
                  href={`tel:${contactPhone}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold",
                    theme.chip,
                  )}
                >
                  <Phone className="size-4" /> {contactPhone}
                </a>
              )}
              {!contactEmail && !contactPhone && (
                <p className={cn("text-sm", theme.muted)}>
                  Contact details haven't been added yet.
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer
          className={cn(
            "mt-20 flex flex-col items-center justify-between gap-4 border-t pt-8 text-xs sm:flex-row",
            theme.muted,
            portfolio.template === "paper" ? "border-black/10" : "border-white/10",
          )}
        >
          <span>
            © {new Date().getFullYear()} {portfolio.displayName}
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 transition-colors hover:opacity-100"
            >
              <Flag className="size-3.5" /> Report
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-semibold transition-colors"
              style={{ color: accent }}
            >
              <Sparkles className="size-3.5" /> Built with {branding.name}
            </Link>
          </div>
        </footer>
      </main>

      {/* Floating "create yours" pill */}
      <Link
        to="/portfolio/auth"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/85 px-4 py-2.5 text-xs font-semibold text-lime-300 shadow-xl shadow-black/40 backdrop-blur transition-colors hover:bg-black"
      >
        <Sparkles className="size-3.5" /> Portfolio sign in
      </Link>

      {reportOpen && (
        <ReportDialog
          onClose={() => setReportOpen(false)}
          onSubmit={async (reason, details) => {
            try {
              await report({ slug, reason, details });
              toast.success("Thanks — our team will review this.");
              setReportOpen(false);
            } catch (err) {
              toast.error(friendlyError(err, "Could not send the report."));
            }
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Section({
  id,
  title,
  icon,
  children,
  theme,
  accent,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  theme: (typeof TEMPLATES)[keyof typeof TEMPLATES];
  accent: string;
}) {
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex size-8 items-center justify-center rounded-lg"
          style={{ background: `${accent}1f`, color: accent }}
        >
          {icon ?? <Star className="size-4" />}
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        <span
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, ${accent}55, transparent)` }}
        />
      </div>
      {children}
    </section>
  );
}

function Timeline({
  items,
  theme,
  accent,
}: {
  items: {
    key: string;
    title: string;
    subtitle: string;
    meta: string;
    location?: string;
    body?: string;
  }[];
  theme: (typeof TEMPLATES)[keyof typeof TEMPLATES];
  accent: string;
}) {
  return (
    <ol className="relative space-y-6 border-l pl-6" style={{ borderColor: `${accent}33` }}>
      {items.map((item) => (
        <li key={item.key} className="relative">
          <span
            className="absolute -left-[31px] top-1.5 size-2.5 rounded-full ring-4"
            style={{ background: accent, boxShadow: `0 0 0 4px ${accent}22` }}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold">{item.title}</h3>
            {item.meta && (
              <span className={cn("text-xs font-medium", theme.muted)}>{item.meta}</span>
            )}
          </div>
          {(item.subtitle || item.location) && (
            <p className="mt-0.5 text-sm" style={{ color: accent }}>
              {item.subtitle}
              {item.location ? ` · ${item.location}` : ""}
            </p>
          )}
          {item.body && (
            <p className={cn("mt-2 text-sm leading-relaxed", theme.muted)}>{item.body}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function ReportDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("Inappropriate content");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const REASONS = [
    "Inappropriate content",
    "Spam or misleading",
    "Impersonation",
    "Copyright issue",
    "Something else",
  ];
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold">Report this portfolio</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2 text-sm transition-colors has-[:checked]:border-lime-400/40 has-[:checked]:bg-lime-400/10"
            >
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-lime-400"
              />
              {r}
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Anything else we should know? (optional)"
          rows={3}
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-lime-400/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="border-white/15" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={sending}
            onClick={async () => {
              setSending(true);
              await onSubmit(reason, details);
              setSending(false);
            }}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {sending && <Loader2 className="size-4 animate-spin" />} Send report
          </Button>
        </div>
      </div>
    </div>
  );
}
