import { cn } from "@/lib/utils";

/** Small status chip for course lifecycle states. */
export function StatusChip({
  status,
  published,
}: {
  status?: string | null;
  published?: boolean | null;
}) {
  if (published && status === "approved") {
    return <span className="shrink-0 rounded-full bg-lime-400/12 px-2.5 py-0.5 text-[10px] font-semibold text-lime-300">Live</span>;
  }
  const map: Record<string, string> = {
    draft: "bg-white/8 text-muted-foreground",
    pending: "bg-amber-400/12 text-amber-300",
    approved: "bg-lime-400/12 text-lime-300",
    rejected: "bg-rose-400/12 text-rose-300",
  };
  const label =
    status === "pending"
      ? "In review"
      : status === "approved"
        ? "Approved"
        : status === "rejected"
          ? "Rejected"
          : "Draft";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
        map[status ?? "draft"] ?? map.draft,
      )}
    >
      {label}
    </span>
  );
}
