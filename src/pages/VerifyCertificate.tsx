import { useRef, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Download,
  ImageDown,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/EmptyState";
import { CertificateView } from "@/components/site/CertificateTemplate";
import { saveCertificateFile } from "@/lib/certificate-download";
import { exportCertificateImage, saveExportedImage } from "@/lib/certificate-export";
import { buildCertificatePdf } from "@/lib/certificate-pdf";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/hooks/use-auth";

type ExportKind = "pdf" | "jpg";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const cert = useQuery(api.public.verifyCertificate, {
    certificateId: certificateId ?? "",
  });
  const branding = useQuery(api.public.certificateBranding);
  const user = useAuth().user;
  const updateProfile = useMutation(api.users.updateProfile);
  const generateCertificate = useAction(api.apitemplate.generateCertificate);

  const captureRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);

  useEffect(() => {
    setCaptureReady(true);
  }, []);

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificateId}`
      : "";

  const ownerNeedsName =
    cert &&
    user &&
    user._id === cert.studentId &&
    !!user.needsName;

  const handleDownload = async (kind: ExportKind) => {
    if (!cert || exporting !== null) return;
    setExporting(kind);
    setExportError(null);
    try {
      if (ownerNeedsName) {
        if (!captureReady) throw new Error("The certificate isn't ready yet. Please try again.");
        setExporting(null);
        throw new Error("name-required");
      }
      if (kind === "pdf") {
        try {
          const file = await generateCertificate({
            certificateId: cert.certificateId,
            verifyUrl,
          });
          await saveCertificateFile(file.fileName, file.mime, file.base64);
        } catch (serverErr) {
          console.warn(
            "[certificate] Server-side PDF failed — using client-side fallback:",
            serverErr,
          );
          const node = captureRef.current;
          if (!node) throw new Error("The certificate isn't ready yet. Please try again.");
          const image = await exportCertificateImage(node);
          const pdf = await buildCertificatePdf(
            image.dataUrl,
            cert.studentName,
            cert.certificateId,
          );
          await saveCertificateFile(pdf.fileName, pdf.mime, pdf.base64);
        }
      } else {
        const node = captureRef.current;
        if (!node) throw new Error("The certificate isn't ready yet. Please try again.");
        const image = await exportCertificateImage(node);
        await saveExportedImage(
          image.dataUrl,
          image.ext,
          cert.studentName,
          cert.certificateId,
        );
      }
      toast.success(
        kind === "pdf" ? "Certificate PDF downloaded" : "Certificate image downloaded",
      );
    } catch (e) {
      if (e instanceof Error && e.message === "name-required") {
        toast.error("Add your name to your profile before downloading this certificate.");
        return;
      }
      const message =
        e instanceof Error && e.message
          ? e.message
          : "Couldn't generate the file. Please try again.";
      console.error("[certificate] generation failed:", e);
      setExportError(message);
      toast.error(message);
    } finally {
      setExporting(null);
    }
  };

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Please enter your name before we can finish the certificate.");
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await updateProfile({ name: trimmed });
      setName("");
      setSavingName(false);
      toast.success("Name saved — your certificate is ready.");
    } catch (err) {
      console.error("Name save error:", err);
      setNameError(
        friendlyError(
          err,
          "We couldn't save your name just now. Please try again.",
        ),
      );
    } finally {
      setSavingName(false);
    }
  };

  if (cert === undefined) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <div className="mx-auto h-64 w-full max-w-xl animate-pulse rounded-3xl border border-white/8 bg-card" />
        </div>
      </PageShell>
    );
  }

  if (!cert) {
    return (
      <PageShell>
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <EmptyState
            icon={<Award className="size-6" />}
            title="Certificate not found"
            description="We couldn't find a certificate with that ID. Check the link and try again."
            action={
              <Link to="/">
                <Button variant="outline">Back to home</Button>
              </Link>
            }
          />
        </section>
      </PageShell>
    );
  }

  if (ownerNeedsName) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
            <Award className="size-6" />
          </div>
          <h1 className="font-display mt-5 text-2xl font-bold text-center">
            Certificate waiting
          </h1>
          <p className="mt-2 text-center text-muted-foreground">
            This certificate won&rsquo;t be released with a placeholder on it.
          </p>

          <form onSubmit={handleSetName} className="mt-8 rounded-3xl border border-lime-400/25 bg-card p-6">
            <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
              <UserCheck className="size-5" />
            </div>
            <h2 className="font-display mt-4 text-center text-lg font-bold">
              What should we call you?
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              This is the name that will appear on your certificate.
            </p>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="cv-name">
                Full name
              </label>
              {nameError && (
                <p className="mb-2 text-sm text-rose-300">{nameError}</p>
              )}
              <Input
                id="cv-name"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Your certificate name"
                disabled={savingName}
                className="h-11 border-white/10 bg-black/30"
              />
            </div>

            <div className="mt-5">
              <Button
                type="submit"
                disabled={savingName || !name.trim()}
                className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {savingName ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving & finishing…
                  </>
                ) : (
                  <>
                    Confirm name & unlock certificate
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground/80">
            You can change this later from your profile settings, but the name
            is locked when the certificate is issued.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
            <CheckCircle2 className="size-3.5" /> Official verification
          </span>
          <h1 className="font-display mt-5 text-4xl font-bold tracking-tight">
            This certificate is <span className="text-gradient">genuine</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Issued by {branding?.institutionName ?? "ForgeX Academy"} · ForgeX Network
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-10">
          <CertificateView
            cert={{
              certificateId: cert.certificateId,
              studentName: cert.studentName,
              courseTitle: cert.courseTitle,
              issuedAt: cert.issuedAt,
            }}
            branding={branding}
            verifyUrl={verifyUrl}
            captureRef={(el) => { captureRef.current = el; }}
            className="overflow-hidden rounded-3xl border border-white/15 shadow-2xl shadow-black/40"
          />
        </Reveal>

        <Reveal delay={0.12} className="mt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => handleDownload("pdf")}
              disabled={exporting !== null}
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {exporting === "pdf" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download as PDF
            </Button>
            <Button
              onClick={() => handleDownload("jpg")}
              disabled={exporting !== null}
              variant="outline"
              className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
            >
              {exporting === "jpg" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageDown className="size-4" />
              )}
              Download image
            </Button>
          </div>

          {exporting !== null && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-lime-300">
              <Loader2 className="size-3.5 animate-spin" />
              {exporting === "pdf"
                ? "Generating certificate…"
                : "Capturing certificate…"}
            </p>
          )}
          {exportError && (
            <p className="mt-4 text-sm text-rose-400">{exportError}</p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Recruiters can scan the QR code or visit the verification URL to
            confirm this credential at any time.
          </p>
          <Link to="/" className="mt-5 inline-block">
            <Button variant="outline" className="border-white/15 hover:border-lime-400/40 hover:text-lime-300">
              Explore ForgeX Academy
            </Button>
          </Link>
        </Reveal>
      </section>
    </PageShell>
  );
}
