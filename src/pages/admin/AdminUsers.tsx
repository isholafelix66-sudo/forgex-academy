import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BadgeCheck, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const users = useQuery(api.admin.usersList, { search: search || undefined });
  const setUserRole = useMutation(api.admin.setUserRole);
  const setUserVerified = useMutation(api.admin.setUserVerified);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users & roles"
        description="Assign roles and manage tutor verification across the platform."
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="h-11 border-white/10 bg-card pl-10"
        />
      </div>

      {users === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No users match your search.
        </p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u._id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center"
            >
              <Avatar name={u.name} image={u.image} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{u.name}</p>
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                    {u.role}
                  </span>
                  {u.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-lime-400/12 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                      <BadgeCheck className="size-3" /> Verified tutor
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email ?? "No email"} · joined {timeAgo(u.joinedAt)} · {u.enrollments} enrollments · {u.certificates} certs
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) => void setUserRole({ userId: u._id as never, role: e.target.value as never })}
                  className={cn(
                    "h-9 rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs outline-none",
                    u.role === "admin" && "text-lime-300",
                  )}
                >
                  <option value="student">Student</option>
                  <option value="tutor">Tutor</option>
                  <option value="admin">Admin</option>
                </select>
                {u.role === "tutor" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1.5 border-white/15",
                      u.verified && "border-lime-400/40 text-lime-300",
                    )}
                    onClick={() => void setUserVerified({ userId: u._id as never, verified: !u.verified })}
                  >
                    <ShieldCheck className="size-3.5" />
                    {u.verified ? "Verified" : "Verify"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5 text-lime-300" />
        Seeded demo accounts are excluded from this list.
      </p>
    </div>
  );
}
