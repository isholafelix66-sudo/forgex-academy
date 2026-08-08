import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Award, CheckCircle2, Download, ImageDown, Loader2 } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/EmptyState";
import {
  CertificateTemplate,
  CertificateView,
  DEFAULT_CERTIFICATE_BRANDING,
} from "@/components/site/CertificateTemplate";
import { Button } from "@/components/ui/button";
import {
  downloadCertificatePdf,
  downloadCertificatePng,
} from "@/lib/certificate-pdf";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const cert = useQuery(api.public.verifyCertificate, {
    certificateId: certificateId ?? "",
  });
  const branding = useQuery(api.public.certificateBranding);
  const captureRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificateId}`
      : "";

  // The offscreen capture node renders on the same commit that sets
  // `exporting`, so trigger the export once it's in the DOM.
  useEffect(() => {
    if (!exporting || !cert || !captureRef.current) return;
    let cancelled = false;
    const base = `ForgeX-Certificate-${cert.certificateId}`;
    const job =
      exporting === "pdf"
        ? downloadCertificatePdf(captureRef.current, `${base}.pdf`)
        : downloadCertificatePng(captureRef.current, `${base}.png`);
    job
      .then(() => {
        if (!cancelled)
          toast.success(
            exporting === "pdf"
              ? "Certificate PDF saved"
              : "Certificate image saved",
          );
      })
      .catch(() => {
        if (!cancelled)
          toast.error("Couldn't generate the file. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setExporting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [exporting, cert]);

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
            className="overflow-hidden rounded-3xl border border-white/15 shadow-2xl shadow-black/40"
          />
        </Reveal>

        <Reveal delay={0.12} className="mt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setExporting("pdf")}
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
              onClick={() => setExporting("png")}
              disabled={exporting !== null}
              variant="outline"
              className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
            >
              {exporting === "png" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageDown className="size-4" />
              )}
              Save as image
            </Button>
          </div>
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

      {/* Offscreen full-size template used for export (no scaling, no
          Tailwind classes — rasterizes cleanly with html2canvas) */}
      {exporting && cert && (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, zIndex: -1 }}>
          <div ref={captureRef} style={{ width: 1280, height: 905 }}>
            <CertificateTemplate
              cert={{
                certificateId: cert.certificateId,
                studentName: cert.studentName,
                courseTitle: cert.courseTitle,
                issuedAt: cert.issuedAt,
              }}
              branding={branding ?? DEFAULT_CERTIFICATE_BRANDING}
              verifyUrl={verifyUrl}
            />
          </div>
        </div>
      )}
    </PageShell>
  );
}
