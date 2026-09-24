import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Heart,
  ImageIcon,
  Loader2,
  MessageCircleHeart,
  Quote,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Avatar } from "@/components/site/Avatar";
import { SafeImage } from "@/components/site/SafeImage";
import { useAuth } from "@/hooks/use-auth";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { formatDate } from "@/lib/format";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type StoryShape = NonNullable<ReturnType<typeof useQuery<typeof api.stories.approvedStories>>>;

function StatusChip({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 text-[11px] font-semibold text-lime-300">
        <CheckCircle2 className="size-3" /> Approved — live on the site
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
        <X className="size-3" /> Not approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
      <Clock3 className="size-3" /> Pending review
    </span>
  );
}

function StoryCard({ story, delay = 0 }: { story: NonNullable<StoryShape>[number]; delay?: number }) {
  return (
    <Reveal delay={delay} className="mb-6 break-inside-avoid">
      <figure className="group relative overflow-hidden rounded-3xl border border-white/10 bg-card transition-colors hover:border-lime-400/30">
        {story.photoUrl ? (
          <SafeImage
            src={story.photoUrl}
            alt={`${story.name}'s ForgeX story`}
            className="h-44 w-full object-cover"
            fallback={
              <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-lime-400/20 to-emerald-500/10">
                <ImageIcon className="size-8 text-lime-300/60" />
              </div>
            }
          />
        ) : (
          <div className="flex h-20 items-center justify-center bg-gradient-to-br from-lime-400/12 via-card to-emerald-500/8">
            <Quote className="size-7 text-lime-300/70" />
          </div>
        )}
        <figcaption className="p-6">
          <div className="flex items-center gap-3">
            <Avatar name={story.name} image={story.photoUrl} className="size-11" />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">{story.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {story.course} · {formatDate(story.createdAt)}
              </p>
            </div>
          </div>
          <blockquote className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">
            “{story.story}”
          </blockquote>
        </figcaption>
      </figure>
    </Reveal>
  );
}

/** Submission form — name, course/program, optional photo, story. Every
 *  submission is stored as `pending` and only appears publicly after an
 *  admin approves it. */
function ShareStoryForm({ onDone }: { onDone?: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const submitStory = useMutation(api.stories.submitStory);
  const generateUploadUrl = useMutation(api.stories.generateStoryUploadUrl);

  const [name, setName] = useState(user?.name ?? "");
  const [course, setCourse] = useState("");
  const [story, setStory] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, WebP…).");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError(`Photo is too large — the limit is ${Math.round(PHOTO_MAX_BYTES / 1024 / 1024)} MB.`);
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let photoStorageId: string | undefined;
      if (photoFile) {
        setUploading(true);
        const res = await uploadFileToConvex(photoFile, () => generateUploadUrl());
        photoStorageId = res.storageId;
        setUploading(false);
      }
      await submitStory({
        name,
        course,
        story,
        photoStorageId: photoStorageId ? (photoStorageId as never) : undefined,
      });
      setDone(true);
      if (onDone) onDone();
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-lime-400/30 bg-lime-400/8 p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime-400 text-black">
          <CheckCircle2 className="size-7" />
        </span>
        <h3 className="font-display mt-4 text-xl font-bold">Story received 🎉</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Thank you for sharing how ForgeX helped you. Your story is now{" "}
          <span className="font-semibold text-amber-300">pending review</span> — it
          will appear on the community page once the ForgeX team approves it.
        </p>
        <Button
          variant="outline"
          className="mt-6 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
          onClick={() => {
            setDone(false);
            setCourse("");
            setStory("");
            setPhotoFile(null);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }}
        >
          Share another story
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      {!isAuthenticated && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          You don&rsquo;t need an account to share a story — but{" "}
          <Link to="/academy/login"" className="font-semibold text-lime-300 hover:underline">
            signing in
          </Link>{" "}
          lets you track your submission here and helps us verify it.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="story-name">Your name</Label>
        <Input
          id="story-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amara Okonkwo"
          className="h-11 border-white/10 bg-black/20"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="story-course">Course / Program</Label>
        <Input
          id="story-course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="e.g. Digital Design — UI/UX Roadmap"
          className="h-11 border-white/10 bg-black/20"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Your photo (optional)</Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10">
            <img src={previewUrl} alt="Story preview" className="h-40 w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-rose-500"
              aria-label="Remove photo"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
          >
            <Camera className="size-4" /> Add a photo (optional)
          </button>
        )}
        {previewUrl && (
          <p className="text-xs text-muted-foreground">
            Max {Math.round(PHOTO_MAX_BYTES / 1024 / 1024)} MB · JPG, PNG or WebP
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="story-body">How has ForgeX helped you?</Label>
        <Textarea
          id="story-body"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="Tell us about the skills you gained, a course or roadmap that changed things for you, an opportunity you unlocked, the community, your growth…"
          className="min-h-40 resize-y border-white/10 bg-black/20"
          maxLength={4000}
          required
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Learning · skills · growth · opportunities · community</span>
          <span>{story.trim().length}/4000</span>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy || uploading}
        className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
      >
        {busy || uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {uploading ? "Uploading photo…" : "Submitting…"}
          </>
        ) : (
          <>
            <Send className="size-4" /> Submit for review
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Stories are reviewed by the ForgeX team before they go live.
      </p>
    </form>
  );
}

export default function Stories() {
  const approved = useQuery(api.stories.approvedStories);
  const myStories = useQuery(api.stories.myStories);
  const { isAuthenticated } = useAuth();

  const loading = approved === undefined || myStories === undefined;

  return (
    <PageShell>
      {/* ------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
              <MessageCircleHeart className="size-3.5" /> ForgeX Community
            </span>
            <h1 className="font-display mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              Stories from the <span className="text-gradient">ForgeX</span> community
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Real students, real growth. Share how ForgeX helped you learn,
              build, connect and grow — and read the journeys of the people
              learning alongside you.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Share + stories */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Approved stories */}
          <div>
            <SectionHeading
              align="left"
              eyebrow="Community stories"
              title="What ForgeX is doing for learners"
            />
            {loading ? (
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-72 animate-pulse rounded-3xl border border-white/10 bg-card" />
                ))}
              </div>
            ) : approved.length === 0 ? (
              <div className="mt-10 rounded-3xl border border-white/10 bg-card p-10 text-center">
                <Heart className="mx-auto size-10 text-lime-300/70" />
                <h3 className="font-display mt-4 text-lg font-semibold">
                  Be the first to share your story
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Approved stories appear here. Share how ForgeX has helped
                  you — your journey could inspire the next learner.
                </p>
              </div>
            ) : (
              <div className="mt-10 columns-1 gap-6 sm:columns-2">
                {approved.map((s, i) => (
                  <StoryCard key={s._id} story={s} delay={(i % 2) * 0.06} />
                ))}
              </div>
            )}

            {/* My submissions */}
            {isAuthenticated && myStories && myStories.length > 0 && (
              <div className="mt-12">
                <h3 className="font-display text-lg font-semibold">Your submissions</h3>
                <div className="mt-4 space-y-3">
                  {myStories.map((s) => (
                    <div key={s._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card px-5 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-semibold">
                          {s.course}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          “{s.story}”
                        </p>
                      </div>
                      <StatusChip status={s.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Share form (sticky on desktop) */}
          <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-7 lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">Share your story</h2>
                <p className="text-xs text-muted-foreground">It takes two minutes</p>
              </div>
            </div>
            <div className="mt-5">
              <ShareStoryForm />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ CTA */}
      <section className="border-t border-white/8 bg-black/30 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Your ForgeX journey could be the next story here.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              Not learning with us yet? Every story above started with one
              course. Find yours.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/academy/courses">
                <Button size="lg" className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft">
                  Explore courses <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/academy/login"?mode=signup">
                <Button size="lg" variant="outline" className="border-white/15 hover:border-lime-400/40 hover:text-lime-300">
                  Join ForgeX free
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
