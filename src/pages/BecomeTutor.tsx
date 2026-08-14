import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  GraduationCap,
  ImagePlus,
  Loader2,
  Paperclip,
  Save,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

/** Admin-configured custom form fields (stored in siteContent.tutorFormFields). */
type CustomField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  help?: string;
};

function parseCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is CustomField =>
      !!f && typeof f === "object" && typeof (f as CustomField).label === "string",
  );
}

type CustomAnswer = string | string[];
type CustomAnswers = Record<string, CustomAnswer>;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { useAuth } from "@/hooks/use-auth";
import { ImageUploader } from "@/components/media/ImageUploader";
import { PrivateDocUploader } from "@/components/media/PrivateDocUploader";

const SUGGESTED_SKILLS = [
  "Design", "Development", "Data", "Marketing", "Business", "AI",
];

const SUBJECTS = [
  "Graphic Design", "UI/UX", "Web Development", "Mobile Development",
  "Data Science", "Digital Marketing", "Business", "Photography",
  "Video Editing", "Writing", "Music", "Other",
];

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  profilePictureUrl: string;
  residentialAddress: string;
  city: string;
  state: string;
  country: string;
  professionalTitle: string;
  biography: string;
  yearsOfExperience: string;
  currentOccupation: string;
  highestQualification: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
  skills: string[];
  skillInput: string;
  areasOfExpertise: string;
  teachingExperience: string;
  teachingSubjects: string[];
  teachingFormat: string;
  teachingStatement: string;
  whyForgeX: string;
  cvUrl: string;
  cvFileName: string;
  nin: string;
  linkedin: string;
  website: string;
  portfolio: string;
  github: string;
  youtube: string;
  otherLink: string;
  acceptedAgreement: boolean;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  profilePictureUrl: "",
  residentialAddress: "",
  city: "",
  state: "",
  country: "",
  professionalTitle: "",
  biography: "",
  yearsOfExperience: "",
  currentOccupation: "",
  highestQualification: "",
  fieldOfStudy: "",
  institution: "",
  graduationYear: "",
  skills: [],
  skillInput: "",
  areasOfExpertise: "",
  teachingExperience: "",
  teachingSubjects: [],
  teachingFormat: "",
  teachingStatement: "",
  whyForgeX: "",
  cvUrl: "",
  cvFileName: "",
  nin: "",
  linkedin: "",
  website: "",
  portfolio: "",
  github: "",
  youtube: "",
  otherLink: "",
  acceptedAgreement: false,
};

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label} {required && <span className="text-lime-400">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputCls = "border-white/10 bg-black/20";

export default function BecomeTutor() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const application = useQuery(
    api.users.myTutorApplication,
    isAuthenticated ? {} : "skip",
  );
  const saveTutorApplication = useMutation(api.users.saveTutorApplication);
  const siteContent = useQuery(api.public.siteContentAll);
  const customFields = parseCustomFields(
    siteContent?.tutorFormFields,
  ).filter((f) => f.enabled);

  const [form, setForm] = useState<FormState>(() => ({
    ...initialState,
    fullName: user?.name ?? "",
    email: (user as { email?: string } | null | undefined)?.email ?? "",
  }));
  const [customAnswers, setCustomAnswers] = useState<CustomAnswers>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <GraduationCap className="mx-auto size-12 text-lime-300" />
          <h1 className="font-display mt-5 text-4xl font-bold">Become a tutor</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to apply. Applications are reviewed by our admin team before
            the tutor dashboard unlocks.
          </p>
          <Button
            className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            onClick={() =>
              navigate("/auth?mode=signup&returnTo=/become-tutor")
            }
          >
            Sign in to apply <ArrowRight className="size-4" />
          </Button>
        </section>
      </PageShell>
    );
  }

  if (user?.role === "tutor" && user.verified) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <CheckCircle2 className="mx-auto size-12 text-lime-400" />
          <h1 className="font-display mt-5 text-3xl font-bold">
            You're already a verified tutor! 🎓
          </h1>
          <p className="mt-3 text-muted-foreground">Your tutor dashboard is unlocked.</p>
          <Link to="/tutor" className="mt-6 inline-block">
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              Open tutor dashboard <ArrowRight className="size-4" />
            </Button>
          </Link>
        </section>
      </PageShell>
    );
  }

  const reviewing =
    application?.status === "submitted" || application?.status === "under-review";

  if (reviewing) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <Clock className="mx-auto size-12 text-amber-300" />
          <h1 className="font-display mt-5 text-3xl font-bold">
            Application under review
          </h1>
          <p className="mt-3 text-muted-foreground">
            Thanks for applying! Your application is still under review — most
            decisions are made within 24 hours or less. Watch your inbox: we'll
            email you the moment an admin decides.
          </p>
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-card p-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What happens next
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-amber-300" /> An admin reviews your application — expect an answer within 24 hours or less</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-lime-400" /> You're emailed the decision (approved, verified or needs changes)</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-lime-400" /> Once verified, the tutor dashboard unlocks automatically</li>
            </ul>
          </div>
          <Link to="/become-tutor" className="mt-8 inline-block text-sm text-lime-300 hover:underline">
            Back to application status
          </Link>
        </section>
      </PageShell>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSkill = (s: string) =>
    set("skills", form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s]);

  const addSkill = () => {
    const s = form.skillInput.trim();
    if (s && !form.skills.includes(s) && form.skills.length < 10) set("skills", [...form.skills, s]);
    set("skillInput", "");
  };

  const toggleSubject = (s: string) =>
    set(
      "teachingSubjects",
      form.teachingSubjects.includes(s)
        ? form.teachingSubjects.filter((x) => x !== s)
        : [...form.teachingSubjects, s],
    );

  const customRequired = customFields
    .filter((f) => f.required)
    .every((f) => {
      const a = customAnswers[f.key];
      if (Array.isArray(a)) return a.length > 0;
      return typeof a === "string" && a.trim().length > 0;
    });

  const required =
    [
      form.fullName.trim(),
      form.phone.trim(),
      form.residentialAddress.trim(),
      form.city.trim(),
      form.country.trim(),
      form.professionalTitle.trim(),
      form.biography.trim(),
      form.yearsOfExperience,
      form.highestQualification.trim(),
      form.nin.trim(),
      form.teachingStatement.trim(),
      form.skills.length > 0,
      form.acceptedAgreement,
    ].every(Boolean) && customRequired;

  const setCustom = (key: string, value: CustomAnswer) =>
    setCustomAnswers((c) => ({ ...c, [key]: value }));

  const toggleCustomChoice = (field: CustomField, option: string) => {
    const current = customAnswers[field.key];
    const arr = Array.isArray(current) ? (current as string[]) : [];
    setCustom(
      field.key,
      arr.includes(option) ? arr.filter((x) => x !== option) : [...arr, option],
    );
  };

  const renderCustomField = (field: CustomField) => {
    const value = customAnswers[field.key] ?? "";
    const baseInput =
      "h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50";
    switch (field.type) {
      case "long-text":
        return (
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setCustom(field.key, e.target.value)}
            rows={3}
            className={inputCls}
          />
        );
      case "dropdown":
        return (
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setCustom(field.key, e.target.value)}
            className={baseInput}
          >
            <option value="">Select…</option>
            {["Option 1", "Option 2", "Option 3"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      case "multiple-choice":
        return (
          <div className="flex flex-wrap gap-2">
            {["Option A", "Option B", "Option C"].map((o) => {
              const arr = Array.isArray(value) ? value : [];
              return (
                <button
                  type="button"
                  key={o}
                  onClick={() => toggleCustomChoice(field, o)}
                  className={
                    arr.includes(o)
                      ? "rounded-full border border-lime-400/50 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-300"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                  }
                >
                  {o}
                </button>
              );
            })}
          </div>
        );
      case "checkbox": {
        const arr = Array.isArray(value) ? value : [];
        return (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={arr.includes("yes")}
              onChange={(e) => setCustom(field.key, e.target.checked ? ["yes"] : [])}
              className="size-4 accent-lime-400"
            />
            Yes
          </label>
        );
      }
      case "file":
      case "profile-image":
        return (
          <div className="flex items-center gap-2">
            {field.type === "profile-image" ? (
              <ImagePlus className="size-4 text-muted-foreground" />
            ) : (
              <Paperclip className="size-4 text-muted-foreground" />
            )}
            <Input
              type="url"
              value={typeof value === "string" ? value : ""}
              onChange={(e) => setCustom(field.key, e.target.value)}
              placeholder="https://… (public link to your file)"
              className={inputCls}
            />
          </div>
        );
      default:
        return (
          <Input
            type={
              field.type === "email"
                ? "email"
                : field.type === "phone"
                  ? "tel"
                  : field.type === "number"
                    ? "number"
                    : field.type === "date"
                      ? "date"
                      : "text"
            }
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setCustom(field.key, e.target.value)}
            className={inputCls}
          />
        );
    }
  };

  const save = async (submit: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await saveTutorApplication({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        profilePictureUrl: form.profilePictureUrl || undefined,
        residentialAddress: form.residentialAddress,
        city: form.city,
        state: form.state,
        country: form.country,
        professionalTitle: form.professionalTitle,
        biography: form.biography,
        yearsOfExperience: form.yearsOfExperience,
        currentOccupation: form.currentOccupation,
        highestQualification: form.highestQualification,
        fieldOfStudy: form.fieldOfStudy,
        institution: form.institution,
        graduationYear: form.graduationYear,
        skills: form.skills,
        areasOfExpertise: form.areasOfExpertise,
        teachingExperience: form.teachingExperience,
        teachingSubjects: form.teachingSubjects,
        teachingFormat: form.teachingFormat,
        teachingStatement: form.teachingStatement,
        whyForgeX: form.whyForgeX,
        cvUrl: form.cvUrl || undefined,
        cvFileName: form.cvFileName || undefined,
        nin: form.nin,
        linkedin: form.linkedin || undefined,
        website: form.website || undefined,
        portfolio: form.portfolio || undefined,
        github: form.github || undefined,
        youtube: form.youtube || undefined,
        otherLink: form.otherLink || undefined,
        acceptedAgreement: form.acceptedAgreement,
        customAnswers:
          Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
        submit,
      });
      if (submit) {
        navigate("/become-tutor", { replace: true });
      } else {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal>
          <span className="w-fit rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300">
            Tutor applications
          </span>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight">
            Apply to teach at ForgeX Academy
          </h1>
          <p className="mt-3 text-muted-foreground">
            Every tutor is verified by an admin before teaching. Applications are
            usually reviewed within a few days — you can save a draft and return.
          </p>
        </Reveal>

        {application?.status === "rejected" && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/8 p-5 text-sm">
            <XCircle className="mt-0.5 size-5 shrink-0 text-rose-300" />
            <div>
              <p className="font-semibold text-rose-200">Previous application not approved</p>
              <p className="mt-1 text-rose-200/70">
                {application.reviewNote ?? "You're welcome to re-apply with more detail."}
              </p>
            </div>
          </div>
        )}

        {application?.status === "information-required" && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/8 p-5 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-300" />
            <div>
              <p className="font-semibold text-sky-200">More information required</p>
              <p className="mt-1 text-sky-200/70">
                {application.reviewNote ?? "Please update your application and resubmit."}
              </p>
            </div>
          </div>
        )}

        <Reveal delay={0.05}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(true);
            }}
            className="mt-8 space-y-8 rounded-3xl border border-white/10 bg-card p-6 sm:p-8"
          >
            {/* 1 — Personal */}
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold">
                1. Personal details
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Phone" required>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 800 000 0000" className={inputCls} />
                </Field>
                <Field label="Profile picture" hint="Upload from your device — works on mobile and desktop.">
                  <ImageUploader
                    value={form.profilePictureUrl || null}
                    label="Upload photo"
                    record={{ kind: "profile", label: `${form.fullName || "Tutor"} profile photo` }}
                    onUploaded={(img) => set("profilePictureUrl", img.secureUrl)}
                    onClear={() => set("profilePictureUrl", "")}
                    compact
                  />
                </Field>
                <Field label="Residential address" required>
                  <Input value={form.residentialAddress} onChange={(e) => set("residentialAddress", e.target.value)} className={inputCls} />
                </Field>
                <Field label="City / State / Country" required>
                  <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
                    <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" className={inputCls} />
                    <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State" className={inputCls} />
                    <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Country" className={inputCls} />
                  </div>
                </Field>
              </div>
            </div>

            {/* 2 — Professional */}
            <div className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="font-display text-lg font-semibold">2. Professional background</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Professional title" required hint="E.g. Product Designer · ex-IBM">
                  <Input value={form.professionalTitle} onChange={(e) => set("professionalTitle", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Current occupation">
                  <Input value={form.currentOccupation} onChange={(e) => set("currentOccupation", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Years of experience" required>
                  <select value={form.yearsOfExperience} onChange={(e) => set("yearsOfExperience", e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                    <option value="">Select…</option>
                    {["0-1", "2-3", "4-6", "7-10", "10+"].map((y) => (
                      <option key={y} value={y}>{y} years</option>
                    ))}
                  </select>
                </Field>
                <Field label="Highest qualification" required>
                  <select value={form.highestQualification} onChange={(e) => set("highestQualification", e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                    <option value="">Select…</option>
                    {["High school", "Diploma", "Bachelor's", "Master's", "PhD", "Other"].map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Field of study">
                  <Input value={form.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Institution">
                  <Input value={form.institution} onChange={(e) => set("institution", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Graduation year">
                  <Input value={form.graduationYear} onChange={(e) => set("graduationYear", e.target.value)} placeholder="2020" className={inputCls} />
                </Field>
              </div>
              <Field label="Biography" required>
                <Textarea value={form.biography} onChange={(e) => set("biography", e.target.value)} rows={4} placeholder="Your experience, what you teach, and why you're great at it…" className={inputCls} />
              </Field>
            </div>

            {/* 3 — Skills & teaching */}
            <div className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="font-display text-lg font-semibold">3. Skills & teaching</h2>
              <Field label="Skills" required>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_SKILLS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSkill(s)}
                      className={
                        form.skills.includes(s)
                          ? "rounded-full border border-lime-400/50 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-300"
                          : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={form.skillInput}
                    onChange={(e) => set("skillInput", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Add your own skill…"
                    className={inputCls}
                  />
                  <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
                </div>
              </Field>
              <Field label="Areas of expertise">
                <Input value={form.areasOfExpertise} onChange={(e) => set("areasOfExpertise", e.target.value)} placeholder="E.g. Branding, Motion, Illustration" className={inputCls} />
              </Field>
              <Field label="Subjects you can teach" required>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSubject(s)}
                      className={
                        form.teachingSubjects.includes(s)
                          ? "rounded-full border border-lime-400/50 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-300"
                          : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Teaching experience">
                  <Textarea value={form.teachingExperience} onChange={(e) => set("teachingExperience", e.target.value)} rows={3} placeholder="Tutoring, workshops, bootcamps…" className={inputCls} />
                </Field>
                <Field label="Preferred format">
                  <select value={form.teachingFormat} onChange={(e) => set("teachingFormat", e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                    <option value="">Select…</option>
                    {["Live classes", "Pre-recorded", "Mixed (live + recorded)", "1-on-1 mentoring", "Written/tutorials"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Teaching statement" required>
                <Textarea value={form.teachingStatement} onChange={(e) => set("teachingStatement", e.target.value)} rows={4} placeholder="How do you teach? What will students walk away with?" className={inputCls} />
              </Field>
              <Field label="Why ForgeX?">
                <Textarea value={form.whyForgeX} onChange={(e) => set("whyForgeX", e.target.value)} rows={3} placeholder="Why do you want to teach on ForgeX Academy?" className={inputCls} />
              </Field>
            </div>

            {/* 4 — CV & verification */}
            <div className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="font-display text-lg font-semibold">4. CV & verification</h2>
              <Field
                label="CV / resume"
                hint="PDF, DOC or DOCX. Stored in secure private storage — visible only to ForgeX admins for verification."
              >
                <PrivateDocUploader
                  value={{ name: form.cvFileName || null, url: form.cvUrl || null }}
                  purpose="cv"
                  onUploaded={(doc) => {
                    set("cvUrl", doc.url);
                    set("cvFileName", doc.name);
                  }}
                  onClear={() => {
                    set("cvUrl", "");
                    set("cvFileName", "");
                  }}
                />
              </Field>
              <Field label="National ID number (NIN)" required hint="Used for identity verification — visible only to admins.">
                <Input value={form.nin} onChange={(e) => set("nin", e.target.value)} className={inputCls} />
              </Field>
            </div>

            {/* 5 — Links */}
            <div className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="font-display text-lg font-semibold">5. Links</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="LinkedIn">
                  <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/…" className={inputCls} />
                </Field>
                <Field label="Website">
                  <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
                <Field label="Portfolio">
                  <Input value={form.portfolio} onChange={(e) => set("portfolio", e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
                <Field label="GitHub">
                  <Input value={form.github} onChange={(e) => set("github", e.target.value)} placeholder="https://github.com/…" className={inputCls} />
                </Field>
                <Field label="YouTube">
                  <Input value={form.youtube} onChange={(e) => set("youtube", e.target.value)} placeholder="https://youtube.com/@…" className={inputCls} />
                </Field>
                <Field label="Other link">
                  <Input value={form.otherLink} onChange={(e) => set("otherLink", e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Custom admin-configured fields */}
            {customFields.length > 0 && (
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h2 className="font-display text-lg font-semibold">
                  6. Additional information
                </h2>
                <p className="text-sm text-muted-foreground">
                  Extra fields requested by ForgeX Academy.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {customFields.map((f) => (
                    <div key={f.key} className={f.type === "long-text" ? "sm:col-span-2" : ""}>
                      <Field label={f.label} required={f.required} hint={f.help}>
                        {renderCustomField(f)}
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7 — Agreement */}
            <div className="border-t border-white/10 pt-6">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.acceptedAgreement}
                  onChange={(e) => set("acceptedAgreement", e.target.checked)}
                  className="mt-0.5 size-4 accent-lime-400"
                />
                <span>
                  I confirm the information provided is accurate, and I agree to
                  ForgeX Academy's tutor code of conduct and verification policy.{" "}
                  <span className="text-lime-400">*</span>
                </span>
              </label>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">{error}</p>
            )}
            {savedNotice && (
              <p className="rounded-xl border border-lime-400/25 bg-lime-400/8 p-3 text-sm text-lime-300">
                Draft saved — you can come back and finish later.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void save(false)}
                className="flex-1 gap-2 border-white/15"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save draft
              </Button>
              <Button
                type="submit"
                disabled={saving || !required}
                className="flex-1 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Submit for review
              </Button>
            </div>
            {!required && (
              <p className="text-center text-xs text-muted-foreground">
                Required: name, phone, address, city, country, title, bio, experience,
                qualification, NIN, teaching statement, at least one skill, the
                agreement, and any fields marked * above.
              </p>
            )}
          </form>
        </Reveal>
      </section>
    </PageShell>
  );
}
