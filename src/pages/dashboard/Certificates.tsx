import { useRef, useState } from "react";
import { Link } from "react-router";
import { useAction, useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Award,
  Download,
  ExternalLink,
  ImageDown,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import type { CertificateData } from "@/components/site/CertificateTemplate";
import { CertificateView } from "@/components/site/CertificateTemplate";
import { saveCertificateFile } from "@/lib/certificate-download";
import { exportCertificateImage, saveExportedImage } from "@/lib/certificate-export";
import { formatDate } from "@/lib/format";

type ExportJob = { certificateId: string; mode: "pdf" | "jpg" };

export default function Certificates() {
  const certs = useQuery(api.certificates.myCertificates);
  const branding = useQuery(api.public.certificateBranding);
  const generateCertificate = useAction(api.apitemplate.generateCertificate);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Hidden full-size certificate nodes (one per cert) used for client-side
  // image capture. They live off-screen so the page layout is untouched.
  const captureRefs = useRef(new Map<string, HTMLDivElement | null>());

  const [exporting, setExporting] = useState<ExportJob | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handlePdfDownload(target: CertificateData) {
    if (exporting !== null) return; // prevent duplicate generation
    setExporting({ certificateId: target.certificateId, mode: "pdf" });
    setExportError(null);
    try {
      const file = await generateCertificate({
        certificateId: target.certificateId,
        verifyUrl: `${origin}/verify/${target.certificateId}`,
      });
      await saveCertificateFile(file.fileName, file.mime, file.base64);
      toast.success("Certificate PDF downloaded");
    } catch (e) {
      const message =
        e instanceof Error && e.message
          ? e.message
          : "Couldn't generate the file. Please try again.";
      console.error("[certificate] PDF generation failed:", e);
      setExportError(message);
      toast.error(message);
    } finally {
      setExporting(null);
    }
  }

  async function handleImageDownload(target: CertificateData) {
    if (exporting !== null) return; // prevent duplicate generation
    setExporting({ certificateId: target.certificateId, mode: "jpg" });
    setExportError(null);
    try {
      const node = captureRefs.current.get(target.certificateId);
      if (!node) {
        throw new Error("The certificate isn't ready yet. Please try again.");
      }
      const image = await exportCertificateImage(node);
      await saveExportedImage(
        image.dataUrl,
        image.ext,
        target.studentName,
        target.certificateId,
      );
      toast.success("Certificate image downloaded");
    } catch (e) {
      const message =
        e instanceof Error && e.message
          ? e.message
          : "Couldn't generate the file. Please try again.";
      console.error("[certificate] image export failed:", e);
      setExportError(message);
      toast.error(message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Certificates"
        description="Verified credentials with QR codes — download as PDF or share anywhere."
      />

      {certs === undefined ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <EmptyState
          icon={<Award className="size-6" />}
          title="No certificates yet"
          description="Complete all lessons in a course to earn a verifiable certificate."
          action={
            <Link to="/academy/courses">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Find a course to finish
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Off-screen full-size certificates — invisible, only used to
              capture high-res images (the QR canvas is swapped for an <img>
              inside the exporter so it rasterizes correctly). */}
          <div aria-hidden className="pointer-events-none fixed -left-[100000px] top-0 h-0 w-0 overflow-hidden">
            {certs.map((c) => {
              const verifyUrl = `${origin}/verify/${c.certificateId}`;
              return (
                <CertificateView
                  key={c._id}
                  cert={{
                    certificateId: c.certificateId,
                    studentName: c.studentName,
                    courseTitle: c.courseTitle,
                    issuedAt: c.issuedAt,
                  }}
                  branding={branding}
                  verifyUrl={verifyUrl}
                  captureRef={(el) => {
                    captureRefs.current.set(c.certificateId, el);
                  }}
                />
              );
            })}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {certs.map((c) => {
              const verifyUrl = `${origin}/verify/${c.certificateId}`;
              const busy = exporting?.certificateId === c.certificateId;
              return (
                <div
                  key={c._id}
                  className="overflow-hidden rounded-3xl border border-lime-400/25 bg-card"
                >
                  <div className="bg-grid border-b border-white/10 bg-gradient-to-br from-lime-400/15 to-transparent p-6 text-center">
                    <Award className="mx-auto size-9 text-lime-400" />
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-lime-400/80">
                      {branding?.institutionName ?? "ForgeX Academy"}
                    </p>
                    <h3 className="font-display mt-2 text-xl font-bold text-gradient">
                      {c.courseTitle}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.studentName} · {formatDate(c.issuedAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Certificate ID
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-lime-300">
                        {c.certificateId}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={exporting !== null}
                          onClick={() =>
                            handlePdfDownload({
                              certificateId: c.certificateId,
                              studentName: c.studentName,
                              courseTitle: c.courseTitle,
                              issuedAt: c.issuedAt,
                            })
                          }
                          className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                        >
                          {busy && exporting?.mode === "pdf" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          Download PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={exporting !== null}
                          onClick={() =>
                            handleImageDownload({
                              certificateId: c.certificateId,
                              studentName: c.studentName,
                              courseTitle: c.courseTitle,
                              issuedAt: c.issuedAt,
                            })
                          }
                          className="gap-1.5 border-white/15"
                          title="Save the certificate as a JPG image"
                        >
                          {busy && exporting?.mode === "jpg" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ImageDown className="size-3.5" />
                          )}
                          Image
                        </Button>
                        <Link to={`/verify/${c.certificateId}`}>
                          <Button size="sm" variant="outline" className="gap-1.5 border-white/15">
                            <ShieldCheck className="size-3.5" /> View & verify
                          </Button>
                        </Link>
                        <a
                          href={verifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-lime-300"
                        >
                          Public link <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-xl border border-white/15 bg-white p-2">
                      <QRCodeSVG value={verifyUrl} size={84} fgColor="#0a0a0a" bgColor="#ffffff" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {exportError && (
        <p className="text-center text-sm text-rose-400">{exportError}</p>
      )}
    </div>
  );
}
