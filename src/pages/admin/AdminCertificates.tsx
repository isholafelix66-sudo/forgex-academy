import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Award, ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { formatDate } from "@/lib/format";

export default function AdminCertificates() {
  const certs = useQuery(api.admin.certificatesList);
  const deleteCertificate = useMutation(api.admin.deleteCertificate);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Certificates"
        description="All credentials issued on the platform."
      />

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
                  onClick={() => void deleteCertificate({ id: c._id as never })}
                  title="Delete certificate"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
