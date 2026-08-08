import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/convex/_generated/api";
import { Award, BadgeCheck, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const cert = useQuery(api.public.verifyCertificate, {
    certificateId: certificateId ?? "",
  });

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificateId}`
      : "";

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
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
            <ShieldCheck className="size-3.5" /> Official verification
          </span>
          <h1 className="font-display mt-5 text-4xl font-bold tracking-tight">
            This certificate is <span className="text-gradient">genuine</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Issued by ForgeX Academy · ForgeX Network
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-10">
          <div className="overflow-hidden rounded-3xl border border-lime-400/25 bg-card">
            <div className="bg-grid border-b border-white/10 bg-gradient-to-br from-lime-400/15 to-transparent p-10 text-center">
              <BadgeCheck className="mx-auto size-12 text-lime-400" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-lime-400/80">
                ForgeX Academy
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">
                Certificate of Completion
              </h2>
              <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
              <p className="font-display mt-2 text-3xl font-bold text-gradient">
                {cert.studentName}
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                has successfully completed the course
              </p>
              <p className="font-display mt-2 text-2xl font-semibold">
                {cert.courseTitle}
              </p>
              <p className="mt-8 text-xs text-muted-foreground">
                Awarded {formatDate(cert.issuedAt)}
              </p>
            </div>

            <div className="flex flex-col items-center justify-between gap-6 border-t border-white/10 p-8 sm:flex-row">
              <div className="text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Certificate ID
                </p>
                <p className="mt-1 font-mono text-sm text-lime-300">
                  {cert.certificateId}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-3 py-1 text-xs font-semibold text-lime-300">
                    <BadgeCheck className="size-3.5" /> Verified online
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white p-4">
                <QRCodeSVG value={verifyUrl} size={128} fgColor="#0a0a0a" bgColor="#ffffff" />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
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
