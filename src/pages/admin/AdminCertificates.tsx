import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Check,
  ExternalLink,
  Loader2,
  Palette,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import {
  CertificateView,
  DEFAULT_CERTIFICATE_BRANDING,
  type CertificateBranding,
} from "@/components/site/CertificateTemplate";
import { ImageUploader, type UploadedImage } from "@/components/media/ImageUploader";
import { getAdminToken } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";

const SAMPLE_CERT = {
  certificateId: "FA-SAMPLE-0000",
  studentName: "Jane Doe",
  courseTitle: "Sample Course Title",
  issuedAt: Date.now(),
};

export default function AdminCertificates() {
  const token = getAdminToken() ?? "";
  const certs = useQuery(api.admin.certificatesList, token ? { token } : "skip");
  const branding = useQuery(api.public.certificateBranding);
  const contentSet = useMutation(api.admin.contentSet);
  const deleteCertificate = useMutation(api.admin.deleteCertificate);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const [draft, setDraft] = useState<CertificateBranding | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const shown: CertificateBranding = draft ?? branding ?? DEFAULT_CERTIFICATE_BRANDING;
  const patch = (p: Partial<CertificateBranding>) => setDraft({ ...shown, ...p });

  const save = async () => {
    setSaving(true);
    try {
      await contentSet({ key: "certificateBranding", value: shown, token });
      setDraft(null); // re-sync from the saved value
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Certificates"
        description="Customize the certificate template (logo, signature, institution) and manage all credentials issued on the platform."
      />

      {/* Template branding */}
      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display flex items-center gap-2 text-base font-semibold">
          <Palette className="size-4 text-lime-300" /> Certificate template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These appear on every certificate — live on the student dashboard and
          public verification pages, and in the downloaded PDF.
        </p>

        {branding === undefined ? (
          <div className="mt-5 h-64 animate-pulse rounded-2xl border border-white/8 bg-black/20" />
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            {/* Editor */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Institution name</Label>
                <Input
                  value={shown.institutionName}
                  onChange={(e) => patch({ institutionName: e.target.value })}
                  className="border-white/10 bg-black/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Signatory name</Label>
                  <Input
                    value={shown.signatoryName}
                    onChange={(e) => patch({ signatoryName: e.target.value })}
                    placeholder="e.g. Dr. Ada Obi"
                    className="border-white/10 bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signatory title</Label>
                  <Input
                    value={shown.signatoryTitle}
                    onChange={(e) => patch({ signatoryTitle: e.target.value })}
                    placeholder="e.g. Director of Education"
                    className="border-white/10 bg-black/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Accent color
                  <span
                    className="inline-block size-4 rounded-full border border-white/20"
                    style={{ background: shown.accentColor }}
                  />
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(shown.accentColor) ? shown.accentColor : "#a3e635"}
                    onChange={(e) => patch({ accentColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-white/15 bg-black/20 p-1"
                  />
                  <Input
                    value={shown.accentColor}
                    onChange={(e) => patch({ accentColor: e.target.value })}
                    className="w-32 border-white/10 bg-black/20 font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand logo</Label>
                  <ImageUploader
                    value={shown.logoUrl ?? undefined}
                    label="Upload logo"
                    compact
                    onUploaded={(img: UploadedImage) => patch({ logoUrl: img.secureUrl })}
                    onClear={() => patch({ logoUrl: null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signature (PNG with transparency)</Label>
                  <ImageUploader
                    value={shown.signatureUrl ?? undefined}
                    label="Upload signature"
                    compact
                    onUploaded={(img: UploadedImage) => patch({ signatureUrl: img.secureUrl })}
                    onClear={() => patch({ signatureUrl: null })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => void save()}
                  disabled={saving}
                  className={
                    saved
                      ? "gap-1.5 border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                      : "gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                  }
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : saved ? (
                    <Check className="size-4" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {saved ? "Saved" : "Save template"}
                </Button>
                {draft && (
                  <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                    Discard changes
                  </Button>
                )}
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Live preview
              </p>
              <CertificateView
                cert={SAMPLE_CERT}
                branding={shown}
                verifyUrl={`${origin}/verify/${SAMPLE_CERT.certificateId}`}
              />
            </div>
          </div>
        )}
      </section>

      {/* Issued certificates */}
      <section>
        {certs === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
            No certificates issued yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            <div className="divide-y divide-white/5">
              {certs.map((c) => (
                <div key={c._id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                    <Award className="size-5" />
                  </span>
                  <Avatar name={c.student?.name ?? "?"} image={c.student?.image} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.studentName} <span className="text-muted-foreground">· {c.courseTitle}</span>
                    </p>
                    <p className="truncate font-mono text-xs text-lime-300">{c.certificateId}</p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {formatDate(c.issuedAt)}
                  </span>
                  <a
                    href={`${origin}/verify/${c.certificateId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-lime-300"
                  >
                    <ShieldCheck className="size-3.5" /> Verify <ExternalLink className="size-3" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-rose-300"
                    onClick={() => void deleteCertificate({ id: c._id as never, token })}
                    title="Delete certificate"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
