import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  Ban,
  Bell,
  Check,
  Compass,
  Eye,
  FolderKanban,
  Globe,
  ImageIcon,
  KeyRound,
  Layers,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkle,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/components/site/BrandMark";
import { SharePortfolioButton } from "@/components/site/SharePortfolioButton";
import { ImageUploader } from "@/components/media/ImageUploader";
import { NavSlot } from "@/components/site/MobileBottomNav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import {
  clearPortfolioAdminToken,
  getPortfolioAdminToken,
  setPortfolioAdminToken,
} from "@/lib/portfolio-admin-session";
import {
  BRANDING_CONTENT_KEY,
  DEFAULT_BRANDING,
  normalizeBranding,
  type Branding,
} from "@/lib/branding";
import {
  DEFAULT_PORTFOLIO_SLIDES,
  normalizePortfolioSlides,
  PORTFOLIO_SLIDES_KEY,
  type PortfolioSlide,
} from "@/lib/portfolio-slides";

/* ═══════════════════════════════════════════════════════════════════════════
   /admin-brand — the ForgeX Network PORTFOLIO management portal.

   Completely separate from the Academy admin dashboard:
     • its own route (/admin-brand; /adminbrand redirects here)
     • its own credential + session (api.portfolioAdmin.*)
     • its own content store (portfolioContent)
     • its own SMTP configuration

   The gate on this page checks ONLY the Portfolio admin credential
   (api.portfolioAdmin.sessionValid) — an Academy admin session grants no
   access here, and this session grants no access to Academy.
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "creators", label: "Creators", icon: Users },
  { id: "portfolios", label: "Portfolios", icon: Globe },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "home", label: "Homepage", icon: ImageIcon },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "help", label: "Help desk", icon: LifeBuoy },
  { id: "contact", label: "Contact & socials", icon: Mail },
  { id: "email", label: "Email", icon: Send },
  { id: "seo", label: "SEO & sharing", icon: Compass },
  { id: "access", label: "Access", icon: KeyRound },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminBrand() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(getPortfolioAdminToken());
    setReady(true);
  }, []);

  const valid = useQuery(
    api.portfolioAdmin.sessionValid,
    token ? { token } : "skip",
  );

  if (!ready || (token && valid === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || valid === false) {
    return (
      <Gate
        onSignedIn={(t) => {
          setPortfolioAdminToken(t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <Portal
      token={token}
      onSignOut={() => {
        clearPortfolioAdminToken();
        setToken("");
      }}
    />
  );
}

/* ── Sign-in gate (Portfolio-only credential) ──────────────────────────── */

function Gate({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const signIn = useMutation(api.portfolioAdmin.signIn);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn({ password });
      onSignedIn(res.token);
      if (res.usingDefaultCredential) {
        toast.warning(
          "You're using the initial password — change it in Access as soon as possible.",
        );
      } else {
        toast.success("Signed in to the Portfolio portal.");
      }
    } catch (err) {
      setError(friendlyError(err, "Could not sign in."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <BrandMark to={null} size="lg" showProduct />
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-lime-300">
            <Lock className="size-3" /> Portfolio admin
          </p>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">
            Manage the Portfolio
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This portal is separate from ForgeX Academy. Your Academy login does
            not work here, and this password does not open Academy.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-7 rounded-3xl border border-white/10 bg-card p-6"
        >
          <Label htmlFor="portfolio-admin-password" className="text-xs">
            Portfolio admin password
          </Label>
          <Input
            id="portfolio-admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5 h-11 border-white/10 bg-black/20"
            required
          />

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="mt-5 h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Change this password from <strong>Access</strong> once you're in.
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Looking for the public site?{" "}
          <Link to="/" className="font-medium text-lime-300 hover:underline">
            Go to the Portfolio website
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ── Portal ────────────────────────────────────────────────────────────── */

function Portal({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const signOut = useMutation(api.portfolioAdmin.signOut);
  const [tab, setTab] = useState<TabId>("overview");

  const leave = async () => {
    try {
      await signOut({ token });
    } catch {
      /* session may already be gone */
    }
    onSignOut();
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0d08]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark to={null} size="lg" showProduct />
            <span className="hidden rounded-full border border-lime-400/25 bg-lime-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-lime-300 sm:inline">
              Portfolio admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SharePortfolioButton showLabel={false} />
            <Link to="/">
              <Button variant="outline" size="sm" className="border-white/15">
                View site
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void leave()}
              className="gap-1.5 border-white/15"
            >
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
        </div>

        {/* Tab strip — mobile overflow rules:
            • fits 100vw (w-full max-w-full, capped by the 7xl shell above)
            • scrolls horizontally (overflow-x-auto) with hidden scrollbars
              (.no-scrollbar) and no wrapping (whitespace-nowrap)
            • children never shrink or collapse (shrink-0) — tabs keep their
              intrinsic padding and simply scroll off-screen. */}
        <div className="no-scrollbar mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto whitespace-nowrap px-4 pb-2 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "bg-lime-400 text-black"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-10">
        {tab === "overview" && <Overview token={token} />}
        {tab === "creators" && <CreatorsSection token={token} />}
        {tab === "portfolios" && <PortfoliosSection token={token} />}
        {tab === "projects" && <ProjectsSection token={token} />}
        {tab === "branding" && <BrandingSection token={token} />}
        {tab === "home" && <HomeSlidesSection token={token} />}
        {tab === "notifications" && <NotificationsSection token={token} />}
        {tab === "help" && <HelpDeskSection token={token} />}
        {tab === "contact" && <ContactSection token={token} />}
        {tab === "email" && <EmailSection token={token} />}
        {tab === "seo" && <SeoSection token={token} />}
        {tab === "access" && <AccessSection token={token} />}
      </main>

      {/* Mobile navigation — the same floating pill as the rest of ForgeX,
          with every portal section reachable from the More sheet. */}
      <AdminMobileNav tab={tab} onTab={setTab} />
    </div>
  );
}

/** Quick destinations in the pill; everything else lives in the More sheet. */
const ADMIN_MOBILE_PRIMARY: TabId[] = ["overview", "creators", "notifications", "email"];

function AdminMobileNav({
  tab,
  onTab,
}: {
  tab: TabId;
  onTab: (tab: TabId) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const indicatorId = `admin-nav-indicator-${useId()}`;

  const go = (next: TabId) => {
    onTab(next);
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  };

  const moreActive =
    !ADMIN_MOBILE_PRIMARY.includes(tab) && moreOpen;

  return (
    <>
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden safe-area-bottom"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="mobile-nav-pill pointer-events-auto mx-auto mb-2 w-[calc(100%-1.5rem)] max-w-lg rounded-full border border-white/10 bg-[#0a0c0a]/95 px-1.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between overflow-visible">
            {ADMIN_MOBILE_PRIMARY.map((id) => {
              const def = TABS.find((t) => t.id === id)!;
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => go(id)}
                  aria-label={def.label}
                  className="flex min-w-0 flex-1 items-center justify-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-lime-400/50"
                >
                  <NavSlot active={active} layoutId={indicatorId}>
                    <def.icon className="size-5" />
                  </NavSlot>
                </button>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="More portal sections"
              className="flex min-w-0 flex-1 items-center justify-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-lime-400/50"
            >
              <NavSlot active={moreActive} layoutId={indicatorId}>
                <Layers className="size-5" />
              </NavSlot>
            </button>
          </div>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto max-h-[80dvh] w-full max-w-lg translate-x-0 translate-y-0 gap-0 rounded-b-none rounded-t-3xl border-white/10 bg-[#0b0e0c]/97 p-0 backdrop-blur-xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          <DialogHeader className="border-b border-white/10 px-4 py-3 text-left">
            <DialogTitle className="font-display text-sm">Portfolio admin</DialogTitle>
            <DialogDescription className="text-xs">
              Everything you can manage here.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto p-2 pb-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-lime-400/12 text-lime-300"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <t.icon className="size-4 shrink-0" />
                <span className="flex-1">{t.label}</span>
                {tab === t.id && <Check className="size-4 shrink-0" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Shared building blocks ────────────────────────────────────────────── */

function Panel({
  title,
  description,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            {Icon && <Icon className="size-4 text-lime-300" />}
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 border-white/10 bg-black/20"
      />
      {hint && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
          {hint}
        </p>
      )}
    </div>
  );
}

function SaveButton({
  onClick,
  busy,
  saved,
  label = "Save changes",
}: {
  onClick: () => void;
  busy: boolean;
  saved: boolean;
  label?: string;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={busy}
      className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : saved ? (
        <Check className="size-4" />
      ) : (
        <Save className="size-4" />
      )}
      {busy ? "Saving…" : saved ? "Saved" : label}
    </Button>
  );
}

/** Tiny helper for the save/busy/saved dance every section repeats. */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      setSaved(true);
      toast.success(message);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(friendlyError(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  };
  return { busy, saved, run };
}

/* ── Overview ──────────────────────────────────────────────────────────── */

function Overview({ token }: { token: string }) {
  const stats = useQuery(api.projects.projectsStats);
  const status = useQuery(api.portfolioAdmin.status);
  const settings = useQuery(api.portfolioAdmin.settings, { token });

  const cards = useMemo(
    () => [
      { label: "Public portfolios", value: stats?.portfolios ?? 0 },
      { label: "Projects showcased", value: stats?.projects ?? 0 },
      { label: "Creators", value: stats?.creators ?? 0 },
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      <Panel
        title="Portfolio status"
        description="Everything the public Portfolio website uses, owned exclusively by this portal."
        icon={Layers}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {c.label}
              </p>
              <p className="font-display mt-1 text-3xl font-extrabold text-lime-400">
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <StatusPill
            ok={!!status?.smtpConfigured}
            label={status?.smtpConfigured ? "Portfolio email ready" : "Portfolio email not set"}
          />
          <StatusPill
            ok={!status?.usingDefaultCredential}
            label={
              status?.usingDefaultCredential
                ? "Using the initial password"
                : "Custom password in place"
            }
          />
          <StatusPill ok label="Separate from Academy" />
        </div>

        {status?.usingDefaultCredential && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            You are still using the initial Portfolio admin password. Open{" "}
            <strong>Access</strong> and set your own password.
          </p>
        )}

        {settings?.adminPasswordUpdatedAt && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Password last changed{" "}
            {new Date(settings.adminPasswordUpdatedAt).toLocaleString()}.
          </p>
        )}
      </Panel>

      <Panel
        title="Portfolio content"
        description="Projects, images and the biography sections live in the Portfolio editor. Open it to add work, reorder projects and manage visibility."
        icon={ImageIcon}
      >
        <div className="flex flex-wrap gap-2">
          <Link to="/portfolio">
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              Open Portfolio editor
            </Button>
          </Link>
          <Link to="/portfolio/projects">
            <Button variant="outline" className="border-white/15">
              Manage projects
            </Button>
          </Link>
          <Link to="/portfolio/settings">
            <Button variant="outline" className="border-white/15">
              Public link &amp; visibility
            </Button>
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold",
        ok
          ? "border-lime-400/35 bg-lime-400/10 text-lime-300"
          : "border-amber-400/35 bg-amber-400/10 text-amber-200",
      )}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-lime-400" : "bg-amber-400")} />
      {label}
    </span>
  );
}

/* ── Branding ──────────────────────────────────────────────────────────── */

const BRAND_FIELDS: Array<{
  key: keyof Branding;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { key: "name", label: "Network name", placeholder: "ForgeX Network" },
  { key: "wordmark", label: "Wordmark — first part", placeholder: "ForgeX" },
  {
    key: "wordmarkAccent",
    label: "Wordmark — accent part",
    placeholder: "Network",
    hint: "Rendered in lime.",
  },
  { key: "productLabel", label: "Product label", placeholder: "Portfolio" },
  { key: "tagline", label: "Tagline", placeholder: "Create • Showcase • Grow" },
  {
    key: "shareLabel",
    label: "Share button label",
    placeholder: "Share Portfolio Link",
  },
];

function BrandingSection({ token }: { token: string }) {
  const content = useQuery(api.portfolioAdmin.publicContentAll);
  const setContent = useMutation(api.portfolioAdmin.setContent);
  const { busy, saved, run } = useSave();
  const [draft, setDraft] = useState<Branding | null>(null);

  const current = normalizeBranding(content?.branding);
  const value = draft ?? current;

  return (
    <Panel
      title="Brand identity"
      description="The name, wordmark and tagline the whole Portfolio website uses — top bar, footer, hero and share button."
      icon={Palette}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-white/15"
            onClick={() => setDraft(DEFAULT_BRANDING)}
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
          <SaveButton
            busy={busy}
            saved={saved}
            onClick={() =>
              void run(
                () =>
                  setContent({
                    token,
                    key: BRANDING_CONTENT_KEY,
                    value: normalizeBranding(value),
                  }),
                "Brand identity updated.",
              )
            }
          />
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BRAND_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            hint={f.hint}
            placeholder={f.placeholder}
            value={value[f.key]}
            onChange={(v) => setDraft({ ...value, [f.key]: v })}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Preview
        </p>
        <div className="mt-3">
          <BrandMark branding={normalizeBranding(value)} to={null} size="lg" showProduct />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{value.tagline}</p>
      </div>
    </Panel>
  );
}

/* ── Home & slideshow ──────────────────────────────────────────────────── */

function HomeSlidesSection({ token }: { token: string }) {
  const content = useQuery(api.portfolioAdmin.publicContentAll);
  const setContent = useMutation(api.portfolioAdmin.setContent);
  const deleteContent = useMutation(api.portfolioAdmin.deleteContent);
  // Device uploads for slide images: Cloudinary when configured, otherwise
  // Portfolio admin storage — never the Academy upload endpoints.
  const adminUploadUrl = useMutation(api.portfolioUploads.adminUploadUrl);
  const adminResolveUrl = useMutation(api.portfolioUploads.adminResolveUrl);
  const { busy, saved, run } = useSave();
  const [draft, setDraft] = useState<PortfolioSlide[] | null>(null);

  const stored = normalizePortfolioSlides(content?.[PORTFOLIO_SLIDES_KEY]);
  const slides = draft ?? stored;

  const update = (i: number, patch: Partial<PortfolioSlide>) =>
    setDraft(slides.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (      <Panel
        title="Home hero slideshow"
        description="The rotating images on the Home page. Paste a URL or upload straight from your device for each slide — they resize fluidly on every screen size."
        icon={ImageIcon}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-white/15"
            onClick={() => setDraft([...slides, { id: `slide-${Date.now()}`, image: "", alt: "" }])}
          >
            <Plus className="size-4" /> Add slide
          </Button>
          <SaveButton
            busy={busy}
            saved={saved}
            label="Save slideshow"
            onClick={() =>
              void run(
                () =>
                  setContent({
                    token,
                    key: PORTFOLIO_SLIDES_KEY,
                    value: slides.filter((s) => s.image.trim()),
                  }),
                "Home slideshow updated.",
              )
            }
          />
          <Button
            variant="outline"
            className="gap-2 border-white/15"
            onClick={() =>
              void run(
                () => deleteContent({ token, key: PORTFOLIO_SLIDES_KEY }),
                "Slideshow reset to the built-in defaults.",
              )
            }
          >
            <RotateCcw className="size-4" /> Defaults
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {slides.map((s, i) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Slide {i + 1}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-rose-400/30 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-400/10"
                onClick={() => setDraft(slides.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {s.image ? (
                  <img
                    src={s.image}
                    alt={s.alt || `Slide ${i + 1}`}
                    className="h-28 w-full object-cover sm:h-24"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center sm:h-24">
                    <ImageIcon className="size-6 text-muted-foreground/60" />
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <TextField
                  label="Image URL"
                  value={s.image}
                  placeholder="https://…"
                  onChange={(v) => update(i, { image: v })}
                />
                <ImageUploader
                  label="Or upload from this device"
                  hint="JPG, PNG or WEBP — up to 15 MB. Uploads work without any external keys."
                  value={s.image || null}
                  compact
                  getUploadUrl={() => adminUploadUrl({ token })}
                  resolveUploadUrl={(storageId) =>
                    adminResolveUrl({ token, storageId: storageId as never })
                  }
                  onUploaded={(img) => update(i, { image: img.secureUrl })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Caption (optional)"
                    value={s.caption ?? ""}
                    placeholder="Brand Website Redesign"
                    onChange={(v) => update(i, { caption: v })}
                  />
                  <TextField
                    label="Link (optional)"
                    value={s.href ?? ""}
                    placeholder="https://…"
                    onChange={(v) => update(i, { href: v })}
                  />
                </div>
                <TextField
                  label="Alt text"
                  value={s.alt}
                  placeholder="Describe the image for accessibility"
                  onChange={(v) => update(i, { alt: v })}
                />
              </div>
            </div>
          </div>
        ))}

        {slides.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
            No slides yet. Add one, or reset to the built-in defaults.
          </p>
        )}

        {draft === null && (
          <p className="text-[11px] text-muted-foreground">
            Currently showing the built-in defaults
            {" "}
            ({DEFAULT_PORTFOLIO_SLIDES.length} slides) until you save your own.
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ── Contact & socials ─────────────────────────────────────────────────── */

/* ── Notifications (the public header announcement) ────────────────────── */

type NotificationRow = {
  _id: string;
  title: string;
  body: string;
  link: string | null;
  linkLabel: string | null;
  tone: "info" | "success" | "warning";
  published: boolean;
  createdAt: number;
  updatedAt: number;
};

const TONE_OPTIONS: Array<{ value: NotificationRow["tone"]; label: string }> = [
  { value: "info", label: "Info (blue)" },
  { value: "success", label: "Good news (lime)" },
  { value: "warning", label: "Heads-up (amber)" },
];

/**
 * The notification shown in the Portfolio website header (bell + bar).
 *
 * Fully Portfolio-owned: whatever is published here — and ONLY what is
 * published here — appears to visitors on the public site. Academy
 * announcements live in a different system and never surface here.
 */
function NotificationsSection({ token }: { token: string }) {
  const rows = useQuery(api.portfolioNotifications.list, { token });
  const create = useMutation(api.portfolioNotifications.create);
  const update = useMutation(api.portfolioNotifications.update);
  const setPublished = useMutation(api.portfolioNotifications.setPublished);
  const remove = useMutation(api.portfolioNotifications.remove);

  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [tone, setTone] = useState<NotificationRow["tone"]>("info");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const ensureDefaults = useMutation(api.portfolioNotifications.ensureDefaults);
  const seeded = useRef(false);

  // First visit with an empty list: publish the two coming-soon announcements
  // (ForgeX Academy and the Opportunity Hub). Idempotent and fully editable.
  useEffect(() => {
    if (seeded.current || rows === undefined || rows.length > 0) return;
    seeded.current = true;
    void ensureDefaults({ token })
      .then((res) => {
        if (res.created > 0) {
          toast.success("Added coming-soon announcements for Academy and the Opportunity Hub.");
        }
      })
      .catch(() => {
        /* the admin can add them manually */
      });
  }, [rows, ensureDefaults, token]);

  const reset = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setLink("");
    setLinkLabel("");
    setTone("info");
  };

  const startEdit = (row: NotificationRow) => {
    setEditing(row._id);
    setTitle(row.title);
    setBody(row.body);
    setLink(row.link ?? "");
    setLinkLabel(row.linkLabel ?? "");
    setTone(row.tone);
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (editing) {
        await update({
          token,
          id: editing as never,
          title,
          body,
          link,
          linkLabel,
          tone,
        });
        toast.success("Notification updated.");
      } else {
        await create({ token, title, body, link, linkLabel, tone, published: true });
        toast.success("Notification published to the Portfolio header.");
      }
      reset();
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the notification."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: NotificationRow) => {
    setRowBusy(row._id);
    try {
      await setPublished({ token, id: row._id as never, published: !row.published });
      toast.success(row.published ? "Unpublished." : "Published.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not change that notification."));
    } finally {
      setRowBusy(null);
    }
  };

  const destroy = async (row: NotificationRow) => {
    setRowBusy(row._id);
    try {
      await remove({ token, id: row._id as never });
      toast.success("Notification deleted.");
      if (editing === row._id) reset();
    } catch (err) {
      toast.error(friendlyError(err, "Could not delete that notification."));
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title={editing ? "Edit notification" : "New notification"}
        description="Shown in the Portfolio website header — the bell panel and the announcement bar — to every visitor, signed in or not."
        icon={Bell}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2 border-white/15"
              onClick={() =>
                void ensureDefaults({ token })
                  .then((res) =>
                    toast.success(
                      res.created > 0
                        ? `Added ${res.created} coming-soon announcement(s).`
                        : "Coming-soon announcements are already there.",
                    ),
                  )
                  .catch((err) =>
                    toast.error(friendlyError(err, "Could not add the announcements.")),
                  )
              }
            >
              <Sparkle className="size-4" /> Add coming soon
            </Button>
            {editing ? (
              <Button variant="outline" className="gap-2 border-white/15" onClick={reset}>
                <Plus className="size-4" /> New instead
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Title"
            value={title}
            placeholder="Visitors can now message you"
            onChange={setTitle}
          />
          <div>
            <Label className="text-xs">Style</Label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as NotificationRow["tone"])}
              className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm"
            >
              {TONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Label className="text-xs">Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Every portfolio now has a Message button — no account needed to reach you."
            className="mt-1.5 border-white/10 bg-black/20"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Link (optional)"
            value={link}
            placeholder="/explore or https://…"
            hint="In-app path or a full https address."
            onChange={setLink}
          />
          <TextField
            label="Link label (optional)"
            value={linkLabel}
            placeholder="Explore portfolios"
            onChange={setLinkLabel}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            onClick={() => void submit()}
            disabled={busy}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editing ? "Save changes" : "Publish notification"}
          </Button>
          {!editing && (
            <Button
              variant="outline"
              className="gap-2 border-white/15"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    await create({ token, title, body, link, linkLabel, tone, published: false });
                    toast.success("Draft saved — publish it when you're ready.");
                    reset();
                  } catch (err) {
                    toast.error(friendlyError(err, "Could not save the draft."));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Save as draft
            </Button>
          )}
        </div>
      </Panel>

      <Panel
        title="All notifications"
        description="Published items appear in the header immediately. Drafts stay hidden from the public site."
        icon={Bell}
      >
        {rows === undefined ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-white/5" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
            No notifications yet. Publish one above and it shows up in the Portfolio header.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row._id}
                className={cn(
                  "rounded-2xl border p-4",
                  row.published
                    ? "border-lime-400/25 bg-lime-400/5"
                    : "border-white/10 bg-black/20",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold">{row.title}</p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          row.published
                            ? "border-lime-400/30 bg-lime-400/10 text-lime-300"
                            : "border-white/15 text-muted-foreground",
                        )}
                      >
                        {row.published ? "Published" : "Draft"}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {row.tone}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {row.body}
                    </p>
                    {row.link && (
                      <p className="mt-1.5 text-[11px] text-lime-300">
                        {row.linkLabel ?? "Open"} → {row.link}
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Updated {new Date(row.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-white/15"
                      disabled={rowBusy === row._id}
                      onClick={() => void toggle(row)}
                    >
                      {row.published ? (
                        <>
                          <Pause className="size-3.5" /> Unpublish
                        </>
                      ) : (
                        <>
                          <Play className="size-3.5" /> Publish
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-white/15"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                      disabled={rowBusy === row._id}
                      onClick={() => void destroy(row)}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ── Help desk (get help / report an issue) ───────────────────────────── */

type HelpReply = {
  body: string;
  adminName: string;
  createdAt: number;
  emailed: boolean;
};

type HelpRow = {
  _id: string;
  name: string;
  email: string;
  topic: string;
  topicLabel: string;
  subject: string;
  message: string;
  pageUrl: string | null;
  status: "open" | "answered" | "resolved";
  replies: HelpReply[];
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  fromCreator: boolean;
};

const HELP_STATUS_STYLES: Record<HelpRow["status"], string> = {
  open: "border-amber-400/35 bg-amber-400/10 text-amber-200",
  answered: "border-sky-400/35 bg-sky-400/10 text-sky-200",
  resolved: "border-lime-400/35 bg-lime-400/10 text-lime-300",
};

/**
 * Every request sent from the website's Get help page (or the footer link)
 * lands here: read it, reply by email, and close it out.
 */
function HelpDeskSection({ token }: { token: string }) {
  const [status, setStatus] = useState<"all" | HelpRow["status"]>("open");
  const stats = useQuery(api.portfolioHelp.stats, { token });
  const rows = useQuery(api.portfolioHelp.list, { token, status });
  const reply = useMutation(api.portfolioHelp.reply);
  const setRequestStatus = useMutation(api.portfolioHelp.setStatus);
  const remove = useMutation(api.portfolioHelp.remove);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const list = (rows ?? []) as HelpRow[];
  const active = list.find((r) => r._id === activeId) ?? list[0] ?? null;

  const send = async (resolveAfter: boolean) => {
    if (!active || draft.trim().length < 2) return;
    setBusy(true);
    try {
      await reply({ token, id: active._id as never, body: draft, resolve: resolveAfter });
      toast.success(resolveAfter ? "Replied and resolved." : "Reply sent by email.");
      setDraft("");
    } catch (err) {
      toast.error(friendlyError(err, "Could not send that reply."));
    } finally {
      setBusy(false);
    }
  };

  const move = async (row: HelpRow, next: HelpRow["status"]) => {
    try {
      await setRequestStatus({ token, id: row._id as never, status: next });
      toast.success(`Marked ${next}.`);
    } catch (err) {
      toast.error(friendlyError(err, "Could not update that request."));
    }
  };

  const destroy = async (row: HelpRow) => {
    try {
      await remove({ token, id: row._id as never });
      toast.success("Request deleted.");
      setActiveId(null);
    } catch (err) {
      toast.error(friendlyError(err, "Could not delete that request."));
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Help desk"
        description="Requests sent from the website's Get help page. Reply to answer the sender by email, then resolve it. Visitors never need an account to write in."
        icon={LifeBuoy}
        actions={
          <div className="flex flex-wrap rounded-full border border-white/10 bg-black/20 p-0.5">
            {(["open", "answered", "resolved", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors",
                  status === s
                    ? "bg-lime-400 text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
                {s === "open" && stats?.open ? ` (${stats.open})` : ""}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Open", value: stats?.open ?? 0, tone: "text-amber-300" },
            { label: "Answered", value: stats?.answered ?? 0, tone: "text-sky-300" },
            { label: "Resolved", value: stats?.resolved ?? 0, tone: "text-lime-300" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p className={cn("font-display mt-1 text-2xl font-bold", card.tone)}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
        {stats?.oldestOpen ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Oldest open request: {new Date(stats.oldestOpen).toLocaleString()}
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-card">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="font-display text-sm font-semibold">
              {status === "all" ? "All requests" : `${status[0].toUpperCase()}${status.slice(1)} requests`}
            </p>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-2">
            {rows === undefined ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <LifeBuoy className="mx-auto size-6 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">Nothing here</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Requests from the website's Get help page appear here.
                </p>
              </div>
            ) : (
              list.map((row) => (
                <button
                  key={row._id}
                  onClick={() => setActiveId(row._id)}
                  className={cn(
                    "w-full rounded-2xl px-3 py-3 text-left transition-colors",
                    active?._id === row._id ? "bg-white/8" : "hover:bg-white/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold">{row.subject}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        HELP_STATUS_STYLES[row.status],
                      )}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {row.name} · {row.email}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {row.topicLabel}
                    </span>
                    {row.fromCreator && (
                      <span className="rounded-full border border-lime-400/30 px-2 py-0.5 text-lime-300">
                        Creator
                      </span>
                    )}
                    <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {active ? (
          <div className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold">{active.subject}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {active.name} ·{" "}
                  <a href={`mailto:${active.email}`} className="text-lime-300 hover:underline">
                    {active.email}
                  </a>
                  {" · "}
                  {new Date(active.createdAt).toLocaleString()}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground">
                    {active.topicLabel}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider",
                      HELP_STATUS_STYLES[active.status],
                    )}
                  >
                    {active.status}
                  </span>
                  {active.pageUrl && (
                    <span className="truncate text-muted-foreground">from {active.pageUrl}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {active.status !== "resolved" ? (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    onClick={() => void move(active, "resolved")}
                  >
                    <Check className="size-3.5" /> Resolve
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-white/15"
                    onClick={() => void move(active, "open")}
                  >
                    Reopen
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                  onClick={() => void destroy(active)}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>

            <div className="mt-4 whitespace-pre-line rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed">
              {active.message}
            </div>

            {active.replies.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Conversation
                </p>
                {active.replies.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-3.5"
                  >
                    <p className="text-[11px] text-muted-foreground">
                      {r.adminName} · {new Date(r.createdAt).toLocaleString()}
                      {r.emailed ? " · emailed" : ""}
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">
                      {r.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Label className="text-xs">Reply by email</Label>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder={`Hi ${active.name.split(" ")[0]}, thanks for flagging this — here's what's happening…`}
                className="mt-1.5 border-white/10 bg-black/20"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => void send(false)}
                  disabled={busy || draft.trim().length < 2}
                  className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send reply
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-white/15"
                  disabled={busy || draft.trim().length < 2}
                  onClick={() => void send(true)}
                >
                  <Check className="size-4" /> Send & resolve
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Replies go out through the Portfolio mail service — if email is
                paused they queue and send when you resume.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Social = { platform: string; url: string; enabled: boolean; order: number };
const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "whatsapp",
  "telegram",
] as const;

function ContactSection({ token }: { token: string }) {
  const content = useQuery(api.portfolioAdmin.publicContentAll);
  const setContent = useMutation(api.portfolioAdmin.setContent);
  const { busy, saved, run } = useSave();

  const savedContact = (content?.contact ?? {}) as {
    email?: string;
    phone?: string;
    address?: string;
  };
  const savedSocials = (content?.socials ?? []) as Social[];

  const [contact, setContact] = useState<{
    email: string;
    phone: string;
    address: string;
  } | null>(null);
  const [socials, setSocials] = useState<Social[] | null>(null);

  const c = contact ?? {
    email: savedContact.email ?? "",
    phone: savedContact.phone ?? "",
    address: savedContact.address ?? "",
  };
  const list = socials ?? savedSocials;

  const saveAll = () =>
    run(async () => {
      await setContent({ token, key: "contact", value: c });
      await setContent({ token, key: "socials", value: list });
    }, "Contact details and social links updated.");

  return (
    <Panel
      title="Contact & social links"
      description="Shown in the Portfolio footer and on the public contact surface. Visitors never need an account to use them."
      icon={Mail}
      actions={<SaveButton busy={busy} saved={saved} onClick={() => void saveAll()} />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Contact email"
          value={c.email}
          placeholder="hello@forgex.network"
          onChange={(v) => setContact({ ...c, email: v })}
        />
        <TextField
          label="Phone"
          value={c.phone}
          placeholder="+234…"
          onChange={(v) => setContact({ ...c, phone: v })}
        />
        <TextField
          label="Address"
          value={c.address}
          placeholder="Lagos, Nigeria"
          onChange={(v) => setContact({ ...c, address: v })}
        />
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Social links
        </p>
        <div className="mt-3 space-y-2">
          {SOCIAL_PLATFORMS.map((platform) => {
            const row = list.find((s) => s.platform === platform);
            const url = row?.url ?? "";
            const enabled = row?.enabled !== false;
            return (
              <div
                key={platform}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5"
              >
                <span className="w-24 shrink-0 text-xs font-semibold capitalize text-muted-foreground">
                  {platform}
                </span>
                <Input
                  value={url}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = [...list];
                    const idx = next.findIndex((s) => s.platform === platform);
                    const item: Social = {
                      platform,
                      url: e.target.value,
                      enabled,
                      order: idx >= 0 ? next[idx].order : next.length,
                    };
                    if (idx >= 0) next[idx] = item;
                    else next.push(item);
                    setSocials(next);
                  }}
                  className="h-9 min-w-[12rem] flex-1 border-white/10 bg-black/30"
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      const next = [...list];
                      const idx = next.findIndex((s) => s.platform === platform);
                      if (idx >= 0) next[idx] = { ...next[idx], enabled: e.target.checked };
                      else
                        next.push({
                          platform,
                          url: "",
                          enabled: e.target.checked,
                          order: next.length,
                        });
                      setSocials(next);
                    }}
                    className="size-3.5 accent-lime-400"
                  />
                  Show
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

/* ── Email / SMTP ──────────────────────────────────────────────────────── */

type Smtp = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
};

const EMPTY_SMTP: Smtp = {
  host: "",
  port: 587,
  username: "",
  password: "",
  fromEmail: "",
  fromName: "ForgeX Network Portfolio",
  secure: false,
};

function EmailSection({ token }: { token: string }) {
  const settings = useQuery(api.portfolioAdmin.settings, { token });
  const updateSettings = useMutation(api.portfolioAdmin.updateSettings);
  const sendTestEmail = useAction(api.portfolioEmail.sendTestEmail);
  const { busy, saved, run } = useSave();

  const [draft, setDraft] = useState<Smtp | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const smtp: Smtp = draft ?? (settings?.smtp ?? EMPTY_SMTP);

  const save = () =>
    run(() => updateSettings({ token, smtp }), "Portfolio SMTP settings saved.");

  const test = async () => {
    setTesting(true);
    try {
      await sendTestEmail({ token, to: testTo || smtp.fromEmail || smtp.username });
      toast.success("Test email sent — check that inbox.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not send the test email."));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Portfolio Email / SMTP"
        description="Used only for Portfolio email — authentication, password reset, verification, contact and system notifications. Academy email settings are never read or changed here."
        icon={ShieldCheck}
        actions={<SaveButton busy={busy} saved={saved} onClick={() => void save()} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="SMTP host"
            value={smtp.host}
            placeholder="smtp.gmail.com"
            onChange={(v) => setDraft({ ...smtp, host: v })}
          />
          <TextField
            label="SMTP port"
            type="number"
            value={String(smtp.port)}
            placeholder="587"
            onChange={(v) => setDraft({ ...smtp, port: Number(v) || 0 })}
          />
          <TextField
            label="SMTP username"
            value={smtp.username}
            placeholder="you@yourdomain.com"
            onChange={(v) => setDraft({ ...smtp, username: v })}
          />
          <TextField
            label="SMTP password"
            type="password"
            value={smtp.password}
            placeholder="••••••••"
            hint="Stored server-side only. Never exposed to visitors."
            onChange={(v) => setDraft({ ...smtp, password: v })}
          />
          <TextField
            label="From email"
            value={smtp.fromEmail}
            placeholder="portfolio@yourdomain.com"
            onChange={(v) => setDraft({ ...smtp, fromEmail: v })}
          />
          <TextField
            label="From name"
            value={smtp.fromName}
            placeholder="ForgeX Network Portfolio"
            onChange={(v) => setDraft({ ...smtp, fromName: v })}
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={smtp.secure}
            onChange={(e) => setDraft({ ...smtp, secure: e.target.checked })}
            className="size-4 accent-lime-400"
          />
          Use an encrypted connection (implicit TLS — port 465)
        </label>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Most providers use STARTTLS on port 587 — leave the box unticked and
          choose port <strong>587</strong>. Port <strong>465</strong> needs it
          ticked.
        </p>
      </Panel>

      <Panel
        title="Send a test email"
        description="Confirms the Portfolio SMTP account can deliver. Save your settings first."
        icon={Mail}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <TextField
              label="Send test to"
              value={testTo}
              placeholder={smtp.fromEmail || "you@yourdomain.com"}
              onChange={setTestTo}
            />
          </div>
          <Button
            onClick={() => void test()}
            disabled={testing}
            className="h-10 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            {testing ? "Sending…" : "Send test email"}
          </Button>
        </div>
      </Panel>

      <EmailPausePanel token={token} />

      <EmailManagement token={token} />
    </div>
  );
}

/**
 * Pause / resume Portfolio email.
 *
 * Pausing is lossless: OTP codes, notifications and admin messages keep
 * queueing and are delivered in order the moment you resume. Every send also
 * falls back to the platform email service, so a missing or unhealthy SMTP
 * account can no longer stop Portfolio mail.
 */
function EmailPausePanel({ token }: { token: string }) {
  const settings = useQuery(api.portfolioEmailLog.emailSettings, { token });
  const setPaused = useMutation(api.portfolioEmailLog.setPaused);
  const drainQueue = useMutation(api.portfolioEmailLog.drainQueue);
  const [busy, setBusy] = useState<"toggle" | "drain" | null>(null);

  const paused = settings?.paused ?? false;

  const toggle = async () => {
    setBusy("toggle");
    try {
      const res = await setPaused({ token, paused: !paused });
      toast.success(
        !paused
          ? "Portfolio email paused — everything keeps queueing."
          : `Portfolio email resumed — ${res.dispatched} queued message(s) dispatched.`,
      );
    } catch (err) {
      toast.error(friendlyError(err, "Could not change the email service."));
    } finally {
      setBusy(null);
    }
  };

  const drain = async () => {
    setBusy("drain");
    try {
      const res = await drainQueue({ token });
      toast.success(`Re-sent ${res.dispatched} queued message(s).`);
    } catch (err) {
      toast.error(friendlyError(err, "Could not drain the queue."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Email service"
      description="Pause Portfolio email whenever you want the mailbox quiet — messages keep queueing and go out when you resume."
      icon={Pause}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-white/15"
            disabled={busy !== null}
            onClick={() => void drain()}
          >
            {busy === "drain" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Retry queue
          </Button>
          <Button
            onClick={() => void toggle()}
            disabled={busy !== null}
            className={cn(
              "gap-2 font-semibold",
              paused
                ? "bg-lime-400 text-black hover:bg-lime-300"
                : "border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
            )}
          >
            {busy === "toggle" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : paused ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
            {paused ? "Resume email" : "Pause email"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</p>
          <p
            className={cn(
              "font-display mt-1 text-lg font-bold",
              paused ? "text-amber-300" : "text-lime-300",
            )}
          >
            {settings === undefined ? "…" : paused ? "Paused" : "Running"}
          </p>
          {paused && settings?.pausedAt && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Since {new Date(settings.pausedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Queued</p>
          <p className="font-display mt-1 text-lg font-bold">{settings?.pending ?? 0}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Messages waiting to be delivered.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Delivery</p>
          <p className="font-display mt-1 text-lg font-bold">
            {settings?.smtpConfigured ? "SMTP + fallback" : "Fallback"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {settings?.smtpConfigured
              ? "Your SMTP account, with the platform sender as backup."
              : "No SMTP saved yet — mail is delivered through the platform sender."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   EMAIL MANAGEMENT — log, compose and retry for all Portfolio email.
   ═════════════════════════════════════════════════════════════════════════ */

const EMAIL_TEMPLATE_INFO: Record<
  string,
  { label: string; description: string }
> = {
  otp: {
    label: "Portfolio OTP",
    description: "The 6-digit sign-in / sign-up code email.",
  },
  welcome: {
    label: "Portfolio welcome",
    description: "Sent when a creator's portfolio is first created.",
  },
  published: {
    label: "Portfolio published",
    description: "Confirmation the first time a portfolio goes live.",
  },
  update: {
    label: "Portfolio update",
    description: "Platform updates to creators.",
  },
  admin_notification: {
    label: "Admin notification",
    description: "Internal alerts to the Portfolio team.",
  },
  custom: {
    label: "Custom email",
    description: "Composed messages from this portal.",
  },
  access: {
    label: "Portfolio access",
    description: "Access-related notices (invites, revocations).",
  },
  approval: {
    label: "Portfolio approval",
    description: "Feature/approval notices.",
  },
};

type EmailLogRow = {
  _id: string;
  to: string;
  subject: string;
  template: string;
  kind: string;
  status: string;
  error: string | null;
  attempts: number;
  sentAt: number | null;
  createdAt: number;
};

function EmailManagement({ token }: { token: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewing, setViewing] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const stats = useQuery(api.portfolioEmailLog.stats, { token });
  const logs = useQuery(api.portfolioEmailLog.listLogs, {
    token,
    status: statusFilter,
  });
  const detail = useQuery(
    api.portfolioEmailLog.getLog,
    viewing ? { token, logId: viewing as never } : "skip",
  );
  const retry = useMutation(api.portfolioEmailLog.retrySend);
  const compose = useMutation(api.portfolioEmailLog.compose);

  const doRetry = async (logId: string) => {
    setBusy(logId);
    try {
      await retry({ token, logId: logId as never });
      toast.success("Retry queued.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not queue the retry."));
    } finally {
      setBusy(null);
    }
  };

  const sendCompose = async () => {
    setBusy("compose");
    try {
      await compose({
        token,
        to: composeTo,
        subject: composeSubject,
        html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#111">${composeBody
          .split(/\n\n+/)
          .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br/>")}</p>`)
          .join("")}</div>`,
      });
      toast.success("Email queued for delivery.");
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeOpen(false);
    } catch (err) {
      toast.error(friendlyError(err, "Could not queue the email."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Panel
        title="Email management"
        description="Every email the Portfolio sends is logged here — with status, failure reason and retry."
        icon={Send}
        actions={
          <Button
            size="sm"
            onClick={() => setComposeOpen((v) => !v)}
            className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            <Plus className="size-3.5" /> Compose
          </Button>
        }
      >
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Total", stats.total],
              ["Sent", stats.sent],
              ["Failed", stats.failed],
              ["Pending", stats.pending],
              ["Last 24h", stats.last24h],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-center"
              >
                <p className="font-display text-xl font-bold text-lime-300">{value}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        {composeOpen && (
          <div className="mt-4 rounded-xl border border-lime-400/25 bg-lime-400/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lime-300">
              Compose email
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="To"
                value={composeTo}
                placeholder="creator@example.com"
                onChange={setComposeTo}
              />
              <TextField
                label="Subject"
                value={composeSubject}
                placeholder="A quick update"
                onChange={setComposeSubject}
              />
            </div>
            <div className="mt-3">
              <Label className="text-xs">Message</Label>
              <Textarea
                rows={5}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write the message…"
                className="mt-1.5 border-white/10 bg-black/20"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                disabled={busy === "compose" || !composeTo.trim() || !composeSubject.trim()}
                onClick={() => void sendCompose()}
                className="bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {busy === "compose" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Send
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {["all", "sent", "failed", "pending"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors",
                statusFilter === s
                  ? "bg-lime-400 text-black"
                  : "border border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {logs === undefined ? (
          <div className="mt-4 flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-muted-foreground">
            No email activity yet. OTP emails appear here as soon as creators
            sign in.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {logs.map((row: EmailLogRow) => (
              <div
                key={row._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.subject}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.to} · {EMAIL_TEMPLATE_INFO[row.template]?.label ?? row.template} ·{" "}
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                  {row.error && (
                    <p className="mt-1 truncate text-[11px] text-rose-300" title={row.error}>
                      {row.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                      row.status === "sent"
                        ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                        : row.status === "failed"
                          ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
                          : "border-white/15 text-muted-foreground",
                    )}
                  >
                    {row.status}
                  </span>
                  <button
                    onClick={() => setViewing(viewing === row._id ? null : row._id)}
                    className="inline-flex size-7 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:text-foreground"
                    title="View"
                  >
                    <Eye className="size-3.5" />
                  </button>
                  {row.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/15 px-2 text-[11px]"
                      disabled={busy === row._id}
                      onClick={() => void doRetry(row._id)}
                    >
                      {busy === row._id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewing && detail && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lime-300">
              {detail.subject}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              To {detail.to} · {detail.status}
            </p>
            <div
              className="mt-3 max-h-72 overflow-y-auto rounded-lg bg-white/5 p-3"
              dangerouslySetInnerHTML={{ __html: detail.html }}
            />
          </div>
        )}
      </Panel>

      <Panel
        title="Email templates"
        description="The standard Portfolio emails. Copy and tone follow your branding settings."
        icon={Mail}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(EMAIL_TEMPLATE_INFO).map(([key, info]) => (
            <div
              key={key}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-sm font-semibold">{info.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {info.description}
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                key: {key}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

/* ── SEO & sharing ─────────────────────────────────────────────────────── */

function SeoSection({ token }: { token: string }) {
  const settings = useQuery(api.portfolioAdmin.settings, { token });
  const updateSettings = useMutation(api.portfolioAdmin.updateSettings);
  const { busy, saved, run } = useSave();

  const savedSeo = settings?.seo ?? {
    titleTemplate: "{name} — {headline}",
    defaultDescription: "",
    defaultImage: "",
  };
  const [draft, setDraft] = useState<typeof savedSeo | null>(null);
  const seo = draft ?? savedSeo;

  const adminToken = token;
  const creatorToken = getPortfolioUserToken();
  const portfolio = useQuery(
    api.projects.myPortfolio,
    creatorToken ? { token: creatorToken } : "skip",
  );
  void adminToken;
  const slug = portfolio?.portfolio?.slug;
  const publicUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/p/${slug}`
      : slug
        ? `/p/${slug}`
        : null;

  return (
    <div className="space-y-6">
      <Panel
        title="Public portfolio link"
        description="One link, shareable anywhere. Visitors never need an account to view it."
        icon={Globe}
      >
        {publicUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-lime-300">
              {publicUrl}
            </code>
            <Button
              variant="outline"
              className="border-white/15"
              onClick={() => {
                void navigator.clipboard
                  .writeText(publicUrl)
                  .then(() => toast.success("Link copied."))
                  .catch(() => toast.error("Couldn't copy — select the link instead."));
              }}
            >
              Copy link
            </Button>
            <SharePortfolioButton />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Publish a portfolio in the Portfolio editor to get your public link.
          </p>
        )}
      </Panel>

      <Panel
        title="SEO & share settings"
        description="Defaults applied to public portfolio pages and share previews."
        icon={Globe}
        actions={
          <SaveButton
            busy={busy}
            saved={saved}
            onClick={() =>
              void run(() => updateSettings({ token, seo }), "SEO settings saved.")
            }
          />
        }
      >
        <div className="grid gap-4">
          <TextField
            label="Title template"
            value={seo.titleTemplate}
            placeholder="{name} — {headline}"
            hint="Placeholders: {name} and {headline}."
            onChange={(v) => setDraft({ ...seo, titleTemplate: v })}
          />
          <div>
            <Label className="text-xs text-muted-foreground">
              Default description
            </Label>
            <Textarea
              rows={3}
              value={seo.defaultDescription}
              onChange={(e) =>
                setDraft({ ...seo, defaultDescription: e.target.value })
              }
              placeholder="A professional portfolio built with ForgeX Network."
              className="mt-1 border-white/10 bg-black/20"
            />
          </div>
          <TextField
            label="Default share image URL"
            value={seo.defaultImage}
            placeholder="https://…"
            onChange={(v) => setDraft({ ...seo, defaultImage: v })}
          />
        </div>
      </Panel>
    </div>
  );
}

/* ── Access ────────────────────────────────────────────────────────────── */

function AccessSection({ token }: { token: string }) {
  const settings = useQuery(api.portfolioAdmin.settings, { token });
  const changePassword = useMutation(api.portfolioAdmin.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ token, current, next });
      toast.success("Portfolio admin password changed. Sign in again.");
      clearPortfolioAdminToken();
      window.location.reload();
    } catch (err) {
      toast.error(friendlyError(err, "Could not change the password."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Portfolio admin password"
        description="Belongs to the Portfolio only. Changing it never affects Academy credentials or sessions."
        icon={KeyRound}
      >
        {settings?.usingDefaultCredential && (
          <p className="mb-5 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            This portal is still using the initial password. Set your own now.
          </p>
        )}

        <form onSubmit={submit} className="grid gap-4 sm:max-w-md">
          <TextField
            label="Current password"
            type="password"
            value={current}
            onChange={setCurrent}
          />
          <TextField
            label="New password"
            type="password"
            value={next}
            hint="At least 8 characters."
            onChange={setNext}
          />
          <TextField
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={setConfirm}
          />
          <Button
            type="submit"
            disabled={busy}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Panel>

      <Panel
        title="Separation from Academy"
        description="How the two products stay independent."
        icon={Lock}
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Separate route — /admin-brand is the Portfolio portal only.",
            "Separate credential, hashed with PBKDF2-SHA256 (never stored or shipped in plain text).",
            "Separate sessions — a Portfolio session can never open Academy dashboards.",
            "Separate content store — editing the Portfolio cannot overwrite Academy settings.",
            "Separate SMTP configuration for all Portfolio email.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-lime-400" />
              {line}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   CREATORS — manage the Portfolio's user accounts (NOT admin credentials).
   Every call here is guarded by the PORTFOLIO ADMIN session; a creator
   session can never invoke any of these.
   ═════════════════════════════════════════════════════════════════════════ */

type CreatorRow = {
  _id: string;
  email: string;
  name: string | null;
  title: string | null;
  status: string;
  onboarded: boolean;
  invitedByAdmin: boolean;
  lastLoginAt: number | null;
  createdAt: number;
  activeSessions: number;
};

function CreatorsSection({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const stats = useQuery(api.portfolioUsers.adminUsersStats, { token });
  const users = useQuery(api.portfolioUsers.adminListUsers, {
    token,
    q: q || undefined,
  });
  const createUser = useMutation(api.portfolioUsers.adminCreateUser);
  const setStatus = useMutation(api.portfolioUsers.adminSetUserStatus);
  const revoke = useMutation(api.portfolioUsers.adminRevokeSessions);
  const remove = useMutation(api.portfolioUsers.adminDeleteUser);
  const emailUser = useMutation(api.portfolioUsers.adminEmailUser);

  const invite = async () => {
    setBusy("invite");
    try {
      await createUser({
        token,
        email: inviteEmail,
        name: inviteName || undefined,
      });
      toast.success(`Creator account created for ${inviteEmail}.`);
      setInviteEmail("");
      setInviteName("");
      setInviteOpen(false);
    } catch (err) {
      toast.error(friendlyError(err, "Could not create the account."));
    } finally {
      setBusy(null);
    }
  };

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(friendlyError(err, "Action failed."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Creators"
        description="People with a Portfolio account. Creators sign in with email + a one-time code and can only manage their own portfolio."
        icon={Users}
        actions={
          <Button
            size="sm"
            onClick={() => setInviteOpen((v) => !v)}
            className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            <Plus className="size-3.5" /> Create access
          </Button>
        }
      >
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Total", stats.total],
              ["Active", stats.active],
              ["Suspended", stats.suspended],
              ["Setting up", stats.pendingOnboarding],
              ["New today", stats.newToday],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-center"
              >
                <p className="font-display text-xl font-bold text-lime-300">{value}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        {inviteOpen && (
          <div className="mt-4 rounded-xl border border-lime-400/25 bg-lime-400/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-lime-300">
              Create creator access
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Email"
                value={inviteEmail}
                placeholder="creator@example.com"
                onChange={setInviteEmail}
              />
              <TextField
                label="Name (optional)"
                value={inviteName}
                placeholder="Ada Lovelace"
                onChange={setInviteName}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                disabled={busy === "invite" || !inviteEmail.trim()}
                onClick={() => void invite()}
                className="bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {busy === "invite" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Create account
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              The creator signs in with this email + a one-time code — no
              password is ever stored.
            </p>
          </div>
        )}

        <div className="mt-4">
          <TextField
            label="Search"
            value={q}
            placeholder="Search by email, name or title…"
            onChange={setQ}
          />
        </div>

        {users === undefined ? (
          <div className="mt-4 flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-muted-foreground">
            No creator accounts yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {users.map((u: CreatorRow) => (
              <div
                key={u._id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {u.name || u.email.split("@")[0]}
                      {u.status === "suspended" && (
                        <span className="ml-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                          Suspended
                        </span>
                      )}
                      {!u.onboarded && (
                        <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          Setting up
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email}
                      {u.title ? ` · ${u.title}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {u.activeSessions} active session{u.activeSessions === 1 ? "" : "s"}
                      {u.lastLoginAt
                        ? ` · last sign-in ${new Date(u.lastLoginAt).toLocaleDateString()}`
                        : " · never signed in"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/15 px-2.5 text-[11px]"
                      disabled={busy === `mail-${u._id}` || !u.email}
                      onClick={() => {
                        const subject = window.prompt("Email subject:");
                        if (!subject) return;
                        const body = window.prompt("Message:");
                        if (!body) return;
                        void act(
                          `mail-${u._id}`,
                          () => emailUser({ token, userId: u._id as never, subject, body }),
                          "Email queued.",
                        );
                      }}
                    >
                      <Mail className="size-3" /> Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/15 px-2.5 text-[11px]"
                      disabled={busy === `revoke-${u._id}` || u.activeSessions === 0}
                      onClick={() =>
                        void act(
                          `revoke-${u._id}`,
                          () => revoke({ token, userId: u._id as never }),
                          "Sessions revoked.",
                        )
                      }
                    >
                      <Lock className="size-3" /> Revoke
                    </Button>
                    {u.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-rose-400/30 px-2.5 text-[11px] text-rose-300 hover:border-rose-400/60"
                        disabled={busy === `status-${u._id}`}
                        onClick={() =>
                          void act(
                            `status-${u._id}`,
                            () => setStatus({ token, userId: u._id as never, status: "suspended" }),
                            "Account suspended.",
                          )
                        }
                      >
                        <Ban className="size-3" /> Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-lime-400/40 px-2.5 text-[11px] text-lime-300"
                        disabled={busy === `status-${u._id}`}
                        onClick={() =>
                          void act(
                            `status-${u._id}`,
                            () => setStatus({ token, userId: u._id as never, status: "active" }),
                            "Account restored.",
                          )
                        }
                      >
                        <Check className="size-3" /> Restore
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-rose-400 hover:text-rose-300"
                      disabled={busy === `delete-${u._id}`}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete ${u.email} and their portfolio? This cannot be undone.`,
                          )
                        )
                          return;
                        void act(
                          `delete-${u._id}`,
                          () => remove({ token, userId: u._id as never }),
                          "Account deleted.",
                        );
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   PORTFOLIOS + PROJECTS — platform-wide moderation, Portfolio-admin only.
   ═════════════════════════════════════════════════════════════════════════ */

function PortfoliosSection({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useQuery(api.projects.adminListPortfolios, {
    token,
    q: q || undefined,
  });
  const setVisibility = useMutation(api.projects.adminSetPortfolioVisibility);
  const toggleFeatured = useMutation(api.projects.adminToggleFeatured);
  const toggleSuspended = useMutation(api.projects.adminToggleSuspended);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(friendlyError(err, "Action failed."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="All portfolios"
        description="Publish, feature or take down any portfolio on the platform."
        icon={Globe}
      >
        <TextField label="Search" value={q} placeholder="Name or /p/slug…" onChange={setQ} />

        {rows === undefined ? (
          <div className="mt-4 flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-muted-foreground">
            No portfolios yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((p) => (
              <div key={p._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {p.displayName}
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        {p.visibility}
                      </span>
                      {p.featured && (
                        <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-lime-300">
                          Featured
                        </span>
                      )}
                      {p.suspended && (
                        <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                          Suspended
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      /p/{p.slug} · {p.projects} project{p.projects === 1 ? "" : "s"} · {p.views} views
                      {p.owner ? ` · ${p.owner.email}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={`/p/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/15 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                    >
                      <Eye className="size-3" /> View
                    </a>
                    <select
                      value={p.visibility}
                      disabled={busy === `vis-${p._id}`}
                      onChange={(e) =>
                        void act(
                          `vis-${p._id}`,
                          () =>
                            setVisibility({
                              token,
                              portfolioId: p._id as never,
                              visibility: e.target.value as "draft" | "published" | "discoverable",
                            }),
                          "Visibility updated.",
                        )
                      }
                      className="h-7 rounded-lg border border-white/15 bg-black/30 px-2 text-[11px] text-foreground outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="discoverable">Discoverable</option>
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/15 px-2.5 text-[11px]"
                      disabled={busy === `feat-${p._id}`}
                      onClick={() =>
                        void act(
                          `feat-${p._id}`,
                          () => toggleFeatured({ token, portfolioId: p._id as never }),
                          p.featured ? "Unfeatured." : "Featured.",
                        )
                      }
                    >
                      <Sparkle className="size-3" /> {p.featured ? "Unfeature" : "Feature"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-7 px-2.5 text-[11px]",
                        p.suspended
                          ? "border-lime-400/40 text-lime-300"
                          : "border-rose-400/30 text-rose-300 hover:border-rose-400/60",
                      )}
                      disabled={busy === `sus-${p._id}`}
                      onClick={() =>
                        void act(
                          `sus-${p._id}`,
                          () => toggleSuspended({ token, portfolioId: p._id as never }),
                          p.suspended ? "Restored." : "Suspended.",
                        )
                      }
                    >
                      {p.suspended ? <Check className="size-3" /> : <Ban className="size-3" />}
                      {p.suspended ? "Restore" : "Suspend"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ProjectsSection({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useQuery(api.projects.adminListProjects, {
    token,
    q: q || undefined,
  });
  const removeProject = useMutation(api.projects.adminRemoveProject);
  const restoreProject = useMutation(api.projects.adminRestoreProject);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(friendlyError(err, "Action failed."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="All projects"
        description="Moderate showcased work across every portfolio."
        icon={FolderKanban}
      >
        <TextField label="Search" value={q} placeholder="Search titles, summaries, tags…" onChange={setQ} />

        {rows === undefined ? (
          <div className="mt-4 flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-muted-foreground">
            No projects yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((p) => (
              <div key={p._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.portfolioName ? `${p.portfolioName} · ` : ""}
                        {p.ownerName ?? "unknown owner"}
                      </p>
                      {p.removed && (
                        <p className="mt-1 text-[11px] text-rose-300">
                          Removed: {p.removedReason ?? "no reason given"}
                        </p>
                      )}
                    </div>
                  </div>
                  {p.removed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-lime-400/40 px-2.5 text-[11px] text-lime-300"
                      disabled={busy === p._id}
                      onClick={() =>
                        void act(
                          p._id,
                          () => restoreProject({ token, projectId: p._id as never }),
                          "Project restored.",
                        )
                      }
                    >
                      <RotateCcw className="size-3" /> Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-rose-400/30 px-2.5 text-[11px] text-rose-300 hover:border-rose-400/60"
                      disabled={busy === p._id}
                      onClick={() => {
                        const reason = window.prompt("Reason for removing this project:");
                        if (!reason) return;
                        void act(
                          p._id,
                          () => removeProject({ token, projectId: p._id as never, reason }),
                          "Project removed.",
                        );
                      }}
                    >
                      <Ban className="size-3" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
