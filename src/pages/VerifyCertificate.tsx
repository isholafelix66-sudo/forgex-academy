import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Award, Download, Loader2, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/EmptyState";
import { CertificateView } from "@/components/site/CertificateTemplate";
import { Button } from "@/components/ui/button";
import { downloadCertificatePdf } from "@/lib/certificate-pdf";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const cert = useQuery(api.public.verifyCertificate, {
    certificateId: certificateId ?? "",
  });
  const branding = useQuery(api.public.certificateBranding);
  const captureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificateId}`
      : "";

  const handleDownload = async () => {
    if (!captureRef.current || !cert) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(
        captureRef.current,
        `ForgeX-Certificate-${cert.certificateId}.pdf`,
      );
      toast.success("Certificate downloaded");
    } catch {
      toast.error("Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
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

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
            <ShieldCheck className="size-3.5" /> Official verification
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
            captureRef={captureRef}
            className="overflow-hidden rounded-3xl border border-lime-400/25 shadow-2xl shadow-lime-400/5"
          />
        </Reveal>

        <Reveal delay={0.12} className="mt-8 text-center">
          <Button
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download as PDF
          </Button>
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
