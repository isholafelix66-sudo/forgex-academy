import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import {
  BadgeCheck,
  Ban,
  Eye,
  FlaskConical,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";
import { formatDateShort, timeAgo } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";

const ROLE_TABS = [
  { key: undefined, label: "All" },
  { key: "student", label: "Students" },
  { key: "tutor", label: "Tutors" },
  { key: "admin", label: "Admins" },
] as const;

const STATUS_TABS = [
  { key: undefined, label: "All statuses" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "verified", label: "Verified" },
  { key: "suspended", label: "Suspended" },
] as const;

type UserRow = FunctionReturnType<typeof api.admin.usersList>[number];

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof ROLE_TABS)[number]["key"]>(undefined);
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["key"]>(undefined);
  const [viewing, setViewing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [suspending, setSuspending] = useState<UserRow | null>(null);
  const token = getAdminToken() ?? "";

  const users = useQuery(
    api.admin.usersList,
    token ? { search: search || undefined, role, status, token } : "skip",
  );
  const setUserRole = useMutation(api.admin.setUserRole);
  const setUserVerified = useMutation(api.admin.setUserVerified);
  const suspendUser = useMutation(api.admin.suspendUser);
  const reactivateUser = useMutation(api.admin.reactivateUser);
  const deleteUser = useMutation(api.admin.deleteUser);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users & roles"
        description="View, filter, verify, suspend and permanently delete accounts."
      />

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-11 border-white/10 bg-card pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setRole(t.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                role === t.key
                  ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                  : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-1 w-px bg-white/10" />
          {STATUS_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setStatus(t.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                status === t.key
                  ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                  : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {users === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No users match your filters.
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
                  {u.isSeed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/12 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                      <FlaskConical className="size-3" /> Demo
                    </span>
                  )}
                  {u.suspended && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/12 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                      <Ban className="size-3" /> Suspended
                    </span>
                  )}
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
                  {u.email ?? "No email"} · joined {timeAgo(u.joinedAt)} · {u.enrollments} enrollments ·{" "}
                  {u.certificates} certs
                  {u.lastActivity ? ` · active ${timeAgo(u.lastActivity)}` : " · no recent activity"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setViewing(u)}>
                  <Eye className="size-3.5" /> View
                </Button>
                <select
                  value={u.role}
                  onChange={(e) => void setUserRole({ userId: u._id as never, role: e.target.value as never, token })}
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
                    onClick={() => void setUserVerified({ userId: u._id as never, verified: !u.verified, token })}
                  >
                    <ShieldCheck className="size-3.5" />
                    {u.verified ? "Verified" : "Verify"}
                  </Button>
                )}
                {u.suspended ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-lime-400/30 text-lime-300 hover:bg-lime-400/10"
                    onClick={() => void reactivateUser({ userId: u._id as never, token })}
                  >
                    <RotateCcw className="size-3.5" /> Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
                    onClick={() => setSuspending(u)}
                  >
                    <Ban className="size-3.5" /> Suspend
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-rose-300"
                  onClick={() => setDeleting(u)}
                  title="Permanently delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5 text-lime-300" />
        Deleting a user permanently removes their account and associated records
        (enrollments, certificates, submissions, messages, courses they taught).
        Demo accounts can be bulk-wiped from the Overview page.
      </p>

      {/* View user */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-3">
                  <Avatar name={viewing.name} image={viewing.image} className="size-10" />
                  <span>{viewing.name}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-0.5 break-all font-medium">{viewing.email ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="mt-0.5 font-medium capitalize">{viewing.role}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="mt-0.5 font-medium">{formatDateShort(viewing.joinedAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">Last activity</p>
                  <p className="mt-0.5 font-medium">
                    {viewing.lastActivity ? timeAgo(viewing.lastActivity) : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">Enrollments</p>
                  <p className="mt-0.5 font-medium">{viewing.enrollments}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-muted-foreground">Certificates</p>
                  <p className="mt-0.5 font-medium">{viewing.certificates}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend confirm */}
      <AlertDialog open={!!suspending} onOpenChange={(o) => !o && setSuspending(null)}>
        <AlertDialogContent className="border-white/10 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {suspending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account is disabled and can no longer sign in or use the platform.
              No data is deleted and the account can be reactivated at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-400 font-semibold text-black hover:bg-amber-300"
              onClick={() => {
                if (suspending) void suspendUser({ userId: suspending._id as never, token });
                setSuspending(null);
              }}
            >
              Suspend account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="border-white/10 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to permanently delete {deleting?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The account, sign-in credentials, enrollments,
              certificates, submissions, messages, notifications and any courses
              taught by this user will be removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 font-semibold text-white hover:bg-rose-400"
              onClick={() => {
                if (deleting) void deleteUser({ userId: deleting._id as never, token });
                setDeleting(null);
              }}
            >
              <X className="mr-1 size-3.5" /> Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
