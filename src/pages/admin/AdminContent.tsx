import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  Clapperboard,
  CloudUpload,
  ImageIcon,
  ImageOff,
  Link2,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Palette,
  PenSquare,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dash/PageHeader";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { VideoUploader } from "@/components/admin/VideoUploader";
import type { TutorialVideoConfig } from "@/lib/tutorial-video";
import {
  DEFAULT_HERO_SLIDES,
  normalizeHeroSlides,
  type HeroSlide,
} from "@/lib/hero-slides";
import { toast } from "sonner";
import { getAdminToken } from "@/lib/admin-session";
import { toExternalHref } from "@/lib/url";

const TEXT_FIELDS: Array<{ key: string; label: string; hint: string; rows: number }> = [
  { key: "heroTitle", label: "Homepage hero title", hint: "Big headline on the landing page.", rows: 2 },
  { key: "heroSubtitle", label: "Homepage hero subtitle", hint: "Supporting line under the hero.", rows: 3 },
  { key: "ctaTitle", label: "CTA section title", hint: "Bottom call-to-action heading.", rows: 2 },
  { key: "mission", label: "Mission statement", hint: "Shown on the About page.", rows: 4 },
  { key: "vision", label: "Vision statement", hint: "Shown on the About page.", rows: 4 },
  { key: "about", label: "About us (story)", hint: "Long-form About page copy.", rows: 8 },
];

const IMAGE_FIELDS: Array<{ key: string; label: string; hint: string }> = [
  { key: "logo", label: "Website logo", hint: "Replaces the logo in the nav, footer and app." },
  { key: "favicon", label: "Favicon", hint: "Small browser-tab icon." },
  { key: "missionImage", label: "Mission image", hint: "Shown beside the mission statement." },
  { key: "visionImage", label: "Vision image", hint: "Shown beside the vision statement." },
  { key: "aboutImage", label: "About image", hint: "Shown on the About page." },
];

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

type Social = { platform: string; url: string; enabled: boolean; order: number };

function TextEditor({
  field,
  initial,
  onSave,
}: {
  field: (typeof TEXT_FIELDS)[number];
  initial?: string;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(field.key, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{field.label}</p>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={saving}
          className={saved ? "gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15" : "gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : "Save"}
          {saved ? "Saved" : ""}
        </Button>
      </div>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={field.rows} className="mt-3 border-white/10 bg-black/20" />
    </div>
  );
}

export default function AdminContent() {
  const content = useQuery(api.public.siteContentAll);
  const contentSet = useMutation(api.admin.contentSet);
  const deleteContent = useMutation(api.admin.deleteContent);
  const token = getAdminToken() ?? "";
  const heroImage = typeof content?.heroImage === "string" ? content.heroImage : undefined;

  const [contact, setContact] = useState<{ email: string; phone: string; address: string } | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [savedContact, setSavedContact] = useState(false);
  const [socials, setSocials] = useState<Social[] | null>(null);
  const [socialDraft, setSocialDraft] = useState<Social | null>(null);
  const [savingSocials, setSavingSocials] = useState(false);
  const [savedSocials, setSavedSocials] = useState(false);

  // ------------------------------------------------------------------
  // Homepage tutorial video manager
  // ------------------------------------------------------------------
  const [tvMode, setTvMode] = useState<"motion" | "url" | "mux">("motion");
  const [tvUrl, setTvUrl] = useState("");
  const [tvTitle, setTvTitle] = useState("");
  const [tvVideoUrl, setTvVideoUrl] = useState<string | null>(null);
  const [tvUploadError, setTvUploadError] = useState<string | null>(null);
  const [savingTv, setSavingTv] = useState(false);
  const [savedTv, setSavedTv] = useState(false);

  // Load the current tutorial-video config once site content arrives.
  useEffect(() => {
    const raw = content?.tutorialVideo;
    if (raw === undefined) return;
    if (typeof raw === "string") {
      setTvMode("url");
      setTvUrl(raw);
      return;
    }
    if (raw && typeof raw === "object") {
      const r = raw as Record<string, unknown>;
      setTvMode(r.mode === "mux" ? "mux" : r.mode === "url" ? "url" : "motion");
      setTvUrl(typeof r.url === "string" ? r.url : "");
      setTvTitle(typeof r.title === "string" ? r.title : "");
      setTvVideoUrl(typeof r.url === "string" ? r.url : null);
    }
  }, [content]);

  const saveTutorialVideo = async () => {
    setSavingTv(true);
    try {
      const value: TutorialVideoConfig =
        tvMode === "motion"
          ? { mode: "motion", title: tvTitle.trim() || undefined }
          : tvMode === "url"
            ? { mode: "url", url: tvUrl.trim(), title: tvTitle.trim() || undefined }
            : tvVideoUrl
              ? { mode: "url", url: tvVideoUrl, title: tvTitle.trim() || undefined }
              : { mode: "motion" };
      await contentSet({ key: "tutorialVideo", value, token });
      setSavedTv(true);
      setTimeout(() => setSavedTv(false), 2000);
    } finally {
      setSavingTv(false);
    }
  };



  const save = async (key: string, value: string) => {
    await contentSet({ key, value, token });
  };

  /** Slide image uploaded from the admin's device (Convex storage). */
  const saveSlideImage = (i: number, img: UploadedImage) => {
    updateSlide(i, { src: img.secureUrl });
  };

  const saveImage = async (key: string, img: UploadedImage) => {
    await contentSet({ key, value: img.secureUrl, token });
  };

  const saveContact = async () => {
    if (!contact) return;
    setSavingContact(true);
    try {
      await contentSet({ key: "contact", value: contact, token });
      setSavedContact(true);
      setTimeout(() => setSavedContact(false), 2000);
    } finally {
      setSavingContact(false);
    }
  };

  const saveSocials = async () => {
    if (!socials) return;
    setSavingSocials(true);
    try {
      await contentSet({ key: "socials", value: socials, token });
      setSavedSocials(true);
      setTimeout(() => setSavedSocials(false), 2000);
    } finally {
      setSavingSocials(false);
    }
  };

  // ------------------------------------------------------------------
  // Hero slideshow manager — admin-curated slides with device uploads.
  // Stored in siteContent under key "heroSlides"; unlimited slide count.
  // ------------------------------------------------------------------
  const adminSlides = normalizeHeroSlides(content?.heroSlides);
  const usingDefaults = !Array.isArray(content?.heroSlides);
  const [slideDrafts, setSlideDrafts] = useState<HeroSlide[] | null>(null);
  const [savingSlides, setSavingSlides] = useState(false);

  // Rebuild drafts whenever the stored value arrives or changes — but never
  // clobber in-flight edits (drafts are authoritative until saved/reset).
  useEffect(() => {
    if (slideDrafts === null && content?.heroSlides !== undefined) {
      setSlideDrafts(normalizeHeroSlides(content.heroSlides));
    }
  }, [content, slideDrafts]);

  const slides = slideDrafts ?? adminSlides;

  const updateSlide = (i: number, patch: Partial<HeroSlide>) => {
    setSlideDrafts((prev) => {
      const base = prev ?? adminSlides;
      return base.map((s, j) => (j === i ? { ...s, ...patch } : s));
    });
  };

  const addSlide = () => {
    setSlideDrafts((prev) => {
      const base = prev ?? adminSlides;
      return [
        ...base,
        {
          tag: "New slide",
          headline: "Your headline here.",
          support: "A short supporting line for this slide.",
          ctaLabel: "Start Learning",
          ctaTo: "/courses",
          src: "",
          alt: "",
        },
      ];
    });
  };

  const removeSlide = (i: number) => {
    setSlideDrafts((prev) => {
      const base = prev ?? adminSlides;
      return base.filter((_, j) => j !== i);
    });
  };

  const saveSlides = async () => {
    if (!slides.length) {
      toast.error("Add at least one slide before saving.");
      return;
    }
    const invalid = slides.findIndex((s) => !s.src.trim() || !s.headline.trim());
    if (invalid >= 0) {
      toast.error(
        `Slide ${invalid + 1} needs an image and a headline before saving.`,
      );
      return;
    }
    setSavingSlides(true);
    try {
      await contentSet({ key: "heroSlides", value: slides, token });
      setSlideDrafts(null);
      toast.success("Hero slideshow updated — live on the homepage.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingSlides(false);
    }
  };

  const resetSlides = () => {
    setSlideDrafts(null);
    void contentSet({ key: "heroSlides", value: DEFAULT_HERO_SLIDES, token });
    toast.success("Slideshow restored to the ForgeX defaults.");
  };

  // ------------------------------------------------------------------
  // Featured course slideshow manager — admin picks which REAL courses
  // appear in the homepage course showcase and in what order, with
  // SEPARATE desktop and mobile selections. Stored in siteContent under
  // keys "featuredCourseSlideshow" (desktop) and
  // "featuredCourseSlideshowMobile" (mobile; absent = mirror desktop).
  // Removed courses remain in the catalogue.
  // ------------------------------------------------------------------
  const allCourses = useQuery(api.admin.allCourses, token ? { token } : "skip");
  const [desktopPicks, setDesktopPicks] = useState<string[] | null>(null);
  const [mobilePicks, setMobilePicks] = useState<string[] | null>(null);
  const [mobileMode, setMobileMode] = useState<"mirror" | "custom">("mirror");
  const [activeSurface, setActiveSurface] = useState<"desktop" | "mobile">("desktop");
  const [savingPicks, setSavingPicks] = useState(false);

  // Saved values (empty until the site content query arrives).
  const savedDesktop: string[] = Array.isArray(content?.featuredCourseSlideshow)
    ? (content.featuredCourseSlideshow as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const savedMobile: string[] = Array.isArray(content?.featuredCourseSlideshowMobile)
    ? (content.featuredCourseSlideshowMobile as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];

  // Rebuild drafts once the stored values arrive; never clobber edits.
  useEffect(() => {
    if (desktopPicks === null && content?.featuredCourseSlideshow !== undefined) {
      setDesktopPicks(
        Array.isArray(content.featuredCourseSlideshow)
          ? (content.featuredCourseSlideshow as unknown[]).filter(
              (x): x is string => typeof x === "string",
            )
          : [],
      );
    }
    if (mobilePicks === null && content?.featuredCourseSlideshowMobile !== undefined) {
      setMobilePicks(
        Array.isArray(content.featuredCourseSlideshowMobile)
          ? (content.featuredCourseSlideshowMobile as unknown[]).filter(
              (x): x is string => typeof x === "string",
            )
          : [],
      );
      setMobileMode("custom");
    }
  }, [content]);

  const desktopPicksShown = desktopPicks ?? savedDesktop;
  const mobilePicksShown =
    mobileMode === "custom" ? (mobilePicks ?? savedMobile) : desktopPicksShown;

  const toggleCourse = (list: "desktop" | "mobile", id: string) => {
    if (list === "desktop") {
      setDesktopPicks((prev) => {
        const base = prev ?? savedDesktop;
        return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      });
    } else {
      if (mobileMode === "mirror") setMobileMode("custom");
      setMobilePicks((prev) => {
        const base = prev ?? savedMobile;
        return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      });
    }
  };

  const movePick = (list: "desktop" | "mobile", i: number, dir: -1 | 1) => {
    const setList = list === "desktop" ? setDesktopPicks : setMobilePicks;
    const base = [...(list === "desktop" ? desktopPicksShown : mobilePicksShown)];
    const j = i + dir;
    if (j < 0 || j >= base.length) return;
    [base[i], base[j]] = [base[j], base[i]];
    if (list === "mobile" && mobileMode === "mirror") setMobileMode("custom");
    setList(base);
  };

  const savePicks = async () => {
    setSavingPicks(true);
    try {
      await contentSet({
        key: "featuredCourseSlideshow",
        value: desktopPicksShown,
        token,
      });
      if (mobileMode === "custom") {
        await contentSet({
          key: "featuredCourseSlideshowMobile",
          value: mobilePicksShown,
          token,
        });
      } else {
        // Mirror mode — drop any stored mobile override.
        await deleteContent({ key: "featuredCourseSlideshowMobile", token });
      }
      setDesktopPicks(null);
      setMobilePicks(null);
      toast.success("Course slideshows updated — live on the homepage.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingPicks(false);
    }
  };

  const clearPicks = async (list: "desktop" | "mobile") => {
    try {
      if (list === "desktop") {
        await contentSet({ key: "featuredCourseSlideshow", value: [], token });
        setDesktopPicks([]);
      } else {
        // Clearing mobile returns it to mirror mode.
        await deleteContent({ key: "featuredCourseSlideshowMobile", token });
        setMobilePicks(null);
        setMobileMode("mirror");
      }
      toast.success(
        list === "desktop"
          ? "Desktop slideshow cleared — shows top featured courses."
          : "Mobile slideshow now mirrors the desktop selection.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear.");
    }
  };

  const loadedContact = contact ?? (content?.contact as { email?: string; phone?: string; address?: string } | undefined) ?? {};
  const loadedSocials = socials ?? (content?.socials as Social[] | undefined) ?? [];

  const shownContact = {
    email: typeof loadedContact.email === "string" ? loadedContact.email : "",
    phone: typeof loadedContact.phone === "string" ? loadedContact.phone : "",
    address: typeof loadedContact.address === "string" ? loadedContact.address : "",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Website & branding"
        description="Manage the logo, images, homepage copy, contact details and social media — live on the site instantly."
      />

      {content === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ForgeX robot mascot — the homepage hero centerpiece */}
          <section className="rounded-2xl border border-lime-400/30 bg-gradient-to-br from-lime-400/10 via-card to-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                  <Bot className="size-4 text-lime-300" /> ForgeX robot mascot
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  The official ForgeX robot that floats on the homepage hero with its
                  neon glow. Upload the robot PNG here and it goes live on the homepage
                  instantly — no code needed. Uploads are stored in ForgeX file
                  storage, so no Cloudinary keys are required.
                </p>
              </div>
              {heroImage ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
                  <Check className="size-3.5" /> Live on homepage
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <ImageOff className="size-3.5" /> Not set — placeholder shown
                </span>
              )}
            </div>

            <div className="mt-5 grid items-center gap-6 md:grid-cols-2">
              <ImageUploader
                value={heroImage}
                label="Upload robot PNG"
                hint="Robot mascot"
                adminToken={token}
                onUploaded={(img) => void saveImage("heroImage", img)}
                onClear={() => void contentSet({ key: "heroImage", value: "", token })}
                record={{ kind: "mascot", label: "ForgeX robot mascot" }}
              />
              <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                {heroImage ? (
                  <img src={heroImage} alt="ForgeX robot mascot preview" className="max-h-64 w-auto" />
                ) : (
                  <>
                    <Bot className="size-10 text-lime-300/40" />
                    <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
                      No robot uploaded yet. Upload the PNG on the left and it replaces
                      the homepage placeholder immediately.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Featured course slideshows — separate desktop & mobile selections */}
          <section className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                  <Clapperboard className="size-4 text-lime-300" /> Featured course slideshows
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Choose exactly which courses appear in the homepage course
                  slideshow — with separate selections for desktop and mobile.
                  Removed courses stay available in the catalogue.
                </p>
              </div>
              <div className="flex shrink-0 rounded-full border border-white/10 bg-black/30 p-1">
                {(["desktop", "mobile"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveSurface(s)}
                    className={
                      "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors " +
                      (activeSurface === s
                        ? "bg-lime-400 text-black"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {activeSurface === "mobile" && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mobileMode === "mirror"}
                    onChange={(e) => setMobileMode(e.target.checked ? "mirror" : "custom")}
                    className="size-4 shrink-0 accent-lime-400"
                  />
                  <span className="min-w-0">
                    Mirror the desktop selection
                  </span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {mobileMode === "mirror"
                    ? "— mobile shows the same courses as desktop."
                    : "— pick a custom mobile order below."}
                </span>
              </div>
            )}

            {!(activeSurface === "mobile" && mobileMode === "mirror") && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
                {/* Picker — every real course, selected ones ticked */}
                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20">
                  <p className="border-b border-white/8 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    All courses ({allCourses?.length ?? "…"})
                  </p>
                  {allCourses === undefined ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading courses…
                    </div>
                  ) : allCourses.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No courses yet.
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
                      {allCourses.map((c) => {
                        const current =
                          activeSurface === "desktop" ? desktopPicksShown : mobilePicksShown;
                        const idx = current.indexOf(c._id);
                        const chosen = idx >= 0;
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => toggleCourse(activeSurface, c._id)}
                            className={
                              "flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors " +
                              (chosen
                                ? "bg-lime-400/10 text-foreground"
                                : "hover:bg-white/5")
                            }
                          >
                            <span
                              className={
                                "flex size-5 shrink-0 items-center justify-center rounded border " +
                                (chosen
                                  ? "border-lime-400 bg-lime-400 text-black"
                                  : "border-white/20")
                              }
                            >
                              {chosen ? <Check className="size-3.5" /> : null}
                            </span>
                            {c.image ? (
                              <img
                                src={c.image}
                                alt=""
                                className="h-8 w-12 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <span className="h-8 w-12 shrink-0 rounded bg-gradient-to-br from-lime-400/30 to-emerald-500/10" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {c.title}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {c.category?.name ?? "Uncategorised"}
                                {!c.published && " · draft"}
                              </span>
                            </span>
                            {chosen && (
                              <span className="shrink-0 rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                                #{idx + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected order — reorder + remove */}
                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20">
                  <p className="border-b border-white/8 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {activeSurface === "desktop" ? "Desktop" : "Mobile"} slideshow order
                  </p>
                  {currentPicks.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      No courses selected yet. Tick courses on the left to build
                      the slideshow — top of this list shows first.
                    </p>
                  ) : (
                    <ol className="max-h-72 space-y-1.5 overflow-y-auto p-2">
                      {currentPicks.map((id, i) => {
                        const c = allCourses?.find((x) => x._id === id);
                        return (
                          <li
                            key={id}
                            className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-card px-2 py-1.5"
                          >
                            <span className="w-5 shrink-0 text-center text-xs font-bold text-lime-300">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {c?.title ?? "Course"}
                            </span>
                            <span className="flex shrink-0 items-center">
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={i === 0}
                                onClick={() => movePick(activeSurface, i, -1)}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={i === currentPicks.length - 1}
                                onClick={() => movePick(activeSurface, i, 1)}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Remove from slideshow"
                                onClick={() => toggleCourse(activeSurface, id)}
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-400/10 hover:text-rose-300"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={savePicks}
                disabled={savingPicks}
                className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {savingPicks ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {savingPicks ? "Saving…" : "Save slideshows"}
              </Button>
              <Button
                onClick={() => clearPicks(activeSurface)}
                variant="outline"
                className="gap-2"
              >
                <Trash2 className="size-4" />
                {activeSurface === "desktop" ? "Clear desktop" : "Use desktop selection"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Changes go live on the homepage after saving.
              </p>
            </div>
          </section>

          {/* Hero slideshow — admin-curated, unlimited slides */}
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                  <Layers className="size-4 text-lime-300" /> Hero slideshow
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  The rotating images on the homepage hero. Add as many slides as
                  you like, upload photos straight from your device, edit the
                  text and buttons, or remove slides you no longer want.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
                {slides.length} slide{slides.length === 1 ? "" : "s"}
                {usingDefaults ? " · defaults" : ""}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {slides.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Slide {i + 1}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeSlide(i)}
                      className="gap-1.5 border-rose-400/30 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-400/10"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-4 lg:grid-cols-[260px_1fr]">
                    {/* Device upload for the slide photo */}
                    <ImageUploader
                      value={s.src || undefined}
                      label="Upload photo"
                      hint={`Slide ${i + 1} image`}
                      adminToken={token}
                      onUploaded={(img) => saveSlideImage(i, img)}
                      onClear={() => updateSlide(i, { src: "" })}
                      record={{ kind: "hero-slide", label: `Hero slide ${i + 1}` }}
                    />

                    <div className="space-y-2.5">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Tag
                          </Label>
                          <Input
                            value={s.tag}
                            onChange={(e) => updateSlide(i, { tag: e.target.value })}
                            className="mt-1 h-9 border-white/10 bg-black/20"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Headline
                          </Label>
                          <Input
                            value={s.headline}
                            onChange={(e) =>
                              updateSlide(i, { headline: e.target.value })
                            }
                            className="mt-1 h-9 border-white/10 bg-black/20"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Supporting text
                        </Label>
                        <Input
                          value={s.support}
                          onChange={(e) =>
                            updateSlide(i, { support: e.target.value })
                          }
                          className="mt-1 h-9 border-white/10 bg-black/20"
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Button label
                          </Label>
                          <Input
                            value={s.ctaLabel}
                            onChange={(e) =>
                              updateSlide(i, { ctaLabel: e.target.value })
                            }
                            className="mt-1 h-9 border-white/10 bg-black/20"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Button link (path or URL)
                          </Label>
                          <Input
                            value={s.ctaTo}
                            onChange={(e) => updateSlide(i, { ctaTo: e.target.value })}
                            className="mt-1 h-9 border-white/10 bg-black/20"
                            placeholder="/courses"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={addSlide}
                variant="outline"
                className="gap-2 border-lime-400/40 text-lime-300 hover:bg-lime-400/10"
              >
                <Plus className="size-4" /> Add slide
              </Button>
              <Button
                onClick={() => void saveSlides()}
                disabled={savingSlides}
                className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {savingSlides ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {savingSlides ? "Saving…" : "Save slideshow"}
              </Button>
              <Button
                onClick={resetSlides}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="size-4" /> Restore defaults
              </Button>
              <p className="text-xs text-muted-foreground">
                Changes go live on the homepage after saving.
              </p>
            </div>
          </section>

          {/* Branding images */}
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <Palette className="size-4 text-lime-300" /> Logo & images
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload from your device — no image URLs needed. JPG, PNG and WebP.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {IMAGE_FIELDS.map((f) => {
                const v = content[f.key];
                const current = typeof v === "string" ? v : undefined;
                return (
                  <div key={f.key} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-4 text-lime-300" />
                      <p className="text-sm font-medium">{f.label}</p>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">{f.hint}</p>
                    <ImageUploader
                      value={current}
                      label="Upload"
                      adminToken={token}
                      onUploaded={(img) => void saveImage(f.key, img)}
                      onClear={() => void contentSet({ key: f.key, value: "", token })}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Text fields */}
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <PenSquare className="size-4 text-lime-300" /> Homepage & About copy
            </h2>
            <div className="mt-5 space-y-4">
              {TEXT_FIELDS.map((f) => {
                const v = content[f.key];
                const initial = typeof v === "string" ? v : undefined;
                return <TextEditor key={f.key} field={f} initial={initial} onSave={save} />;
              })}
            </div>
          </section>

          {/* Homepage tutorial video */}
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <Video className="size-4 text-lime-300" /> Homepage tutorial video
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Controls the “ForgeX in two minutes” section on the homepage. The built-in
              motion graphic needs nothing; you can also link a YouTube / Vimeo / Loom /
              MP4 video, or upload your own video from your device.
            </p>

            <div className="mt-5 grid h-10 max-w-md grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 text-xs font-medium">
              {(["motion", "url", "mux"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setTvMode(m);
                    setTvUploadError(null);
                  }}
                  className={
                    tvMode === m
                      ? "bg-lime-400/15 text-lime-300"
                      : "text-muted-foreground hover:text-foreground"
                  }
                >
                  {m === "motion" ? "Motion film" : m === "url" ? "Video link" : "Upload video"}
                </button>
              ))}
            </div>

            <div className="mt-4 max-w-xl space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
                <div className="space-y-2">
                  <Label>Title (shown on the player)</Label>
                  <Input
                    value={tvTitle}
                    onChange={(e) => setTvTitle(e.target.value)}
                    placeholder="ForgeX in two minutes"
                    className="border-white/10 bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current mode</Label>
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/10 px-3 text-xs font-semibold text-lime-300">
                    {tvMode === "motion" ? (
                      <><Clapperboard className="size-3.5" /> Built-in motion film</>
                    ) : tvMode === "url" ? (
                      <><Link2 className="size-3.5" /> Video link</>
                    ) : (
                      <><CloudUpload className="size-3.5" /> Device upload</>
                    )}
                  </div>
                </div>
              </div>

              {tvMode === "motion" && (
                <p className="rounded-xl border border-dashed border-lime-400/25 bg-lime-400/5 p-3.5 text-xs leading-relaxed text-muted-foreground">
                  The animated “Discover · Express · Build” tour plays instantly with no
                  upload or hosting needed. Save to publish it on the homepage.
                </p>
              )}

              {tvMode === "url" && (
                <div className="space-y-2">
                  <Label>Video URL</Label>
                  <Input
                    value={tvUrl}
                    onChange={(e) => setTvUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=… or https://…/tour.mp4"
                    className="border-white/10 bg-black/20"
                  />
                </div>
              )}

              {tvMode === "mux" && (
                <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Upload an MP4, MOV or WebM video straight from your device. It is
                    stored on Cloudinary and delivered as a fast, transcoded MP4 — no
                    extra hosting needed.
                  </p>
                  <div className="mt-3">
                    <VideoUploader
                      value={tvVideoUrl}
                      onUploaded={(v) => {
                        setTvVideoUrl(v.url);
                        setTvUploadError(null);
                      }}
                      onClear={() => setTvVideoUrl(null)}
                    />
                  </div>
                  {tvVideoUrl && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-lime-300">
                      <Check className="size-3.5" /> Uploaded — press Save to publish it on the homepage.
                    </p>
                  )}
                  {tvUploadError && (
                    <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/8 p-2.5 text-xs text-rose-300">
                      {tvUploadError}
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={() => void saveTutorialVideo()}
                disabled={savingTv || (tvMode === "url" && !tvUrl.trim())}
                className={
                  savedTv
                    ? "gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                    : "gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                }
              >
                {savingTv ? <Loader2 className="size-4 animate-spin" /> : savedTv ? <Check className="size-4" /> : <Save className="size-4" />}
                {savedTv ? "Saved" : "Save tutorial video"}
              </Button>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <Mail className="size-4 text-lime-300" /> Contact information
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shown on the Contact page and in the footer of every page.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Mail className="size-3.5" /> Email</Label>
                <Input value={shownContact.email} onChange={(e) => setContact({ ...shownContact, email: e.target.value })} placeholder="hello@forgexacademy.com" className="border-white/10 bg-black/20" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Phone className="size-3.5" /> Phone</Label>
                <Input value={shownContact.phone} onChange={(e) => setContact({ ...shownContact, phone: e.target.value })} placeholder="+1 555 000 0000" className="border-white/10 bg-black/20" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><MapPin className="size-3.5" /> Address</Label>
                <Input value={shownContact.address} onChange={(e) => setContact({ ...shownContact, address: e.target.value })} placeholder="City, Country" className="border-white/10 bg-black/20" />
              </div>
            </div>
            <Button onClick={() => void saveContact()} disabled={savingContact}
              className={savedContact ? "mt-4 gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15" : "mt-4 gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"}>
              {savingContact ? <Loader2 className="size-4 animate-spin" /> : savedContact ? <Check className="size-4" /> : <Save className="size-4" />}
              {savedContact ? "Saved" : "Save contact info"}
            </Button>
          </section>

          {/* Social media */}
          <section className="rounded-2xl border border-white/10 bg-card p-6">
            <h2 className="font-display flex items-center gap-2 text-base font-semibold">
              <Link2 className="size-4 text-lime-300" /> Social media
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only platforms you enable appear in the footer and contact page.
            </p>

            <div className="mt-5 space-y-2">
              {loadedSocials.map((s, i) => (
                <div key={`${s.platform}-${i}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
                  <input type="checkbox" checked={s.enabled !== false} onChange={(e) => {
                    const next = [...loadedSocials];
                    next[i] = { ...next[i], enabled: e.target.checked };
                    setSocials(next);
                  }} className="size-4 accent-lime-400" title="Enabled" />
                  <span className="w-24 text-sm font-medium capitalize">{s.platform}</span>
                  <a href={toExternalHref(s.url)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-xs text-muted-foreground hover:text-lime-300">
                    {s.url}
                  </a>
                  <Button variant="ghost" size="icon" onClick={() => setSocialDraft({ ...s })}>
                    <PenSquare className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => setSocials(loadedSocials.filter((_, x) => x !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {loadedSocials.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                  No social platforms configured yet.
                </p>
              )}
            </div>

            {socialDraft && (
              <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={socialDraft.platform} onChange={(e) => setSocialDraft({ ...socialDraft, platform: e.target.value })}
                    className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none">
                    {SOCIAL_PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <Input placeholder="https://…" value={socialDraft.url} onChange={(e) => setSocialDraft({ ...socialDraft, url: e.target.value })} className="border-white/10 bg-black/30" />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setSocialDraft(null)}>Cancel</Button>
                  <Button
                    className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    disabled={!socialDraft.url}
                    onClick={() => {
                      const exists = loadedSocials.some((s) => s.platform === socialDraft.platform);
                      setSocials(
                        exists
                          ? loadedSocials.map((s) => (s.platform === socialDraft.platform ? { ...socialDraft, order: s.order } : s))
                          : [...loadedSocials, { ...socialDraft, order: loadedSocials.length }],
                      );
                      setSocialDraft(null);
                    }}
                  >
                    <Plus className="size-4" /> Save platform
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => setSocialDraft({ platform: "facebook", url: "", enabled: true, order: loadedSocials.length })}>
                <Plus className="size-4" /> Add platform
              </Button>
              <Button onClick={() => void saveSocials()} disabled={savingSocials}
                className={savedSocials ? "gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15" : "gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"}>
                {savingSocials ? <Loader2 className="size-4 animate-spin" /> : savedSocials ? <Check className="size-4" /> : <Save className="size-4" />}
                {savedSocials ? "Saved" : "Save social links"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
