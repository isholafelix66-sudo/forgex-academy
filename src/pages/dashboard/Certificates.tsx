import { Link } from "react-router";
import { useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/convex/_generated/api";
import { Award, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDate } from "@/lib/format";

export default function Certificates() {
  const certs = useQuery(api.certificates.myCertificates);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Certificates"
        description="Verified credentials with QR codes — shareable anywhere."
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
            <Link to="/courses">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Find a course to finish
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {certs.map((c) => {
            const verifyUrl = `${origin}/verify/${c.certificateId}`;
            return (
              <div
                key={c._id}
                className="overflow-hidden rounded-3xl border border-lime-400/25 bg-card"
              >
                <div className="bg-grid border-b border-white/10 bg-gradient-to-br from-lime-400/15 to-transparent p-6 text-center">
                  <Award className="mx-auto size-9 text-lime-400" />
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-lime-400/80">
                    ForgeX Academy
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
                      <Link to={`/verify/${c.certificateId}`}>
                        <Button size="sm" className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300">
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
      )}
    </div>
  );
}
