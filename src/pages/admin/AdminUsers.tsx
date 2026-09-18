import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import {
  BadgeCheck,
  Ban,
  Crown,
  Eye,
  FlaskConical,
  GraduationCap,
  KeyRound,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  { key: "owner", label: "Owner" },
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
  /** Pending role change — resolved with the admin password in a dialog. */
  const [roleChange, setRoleChange] = useState<{
    user: UserRow;
    nextRole: "owner" | "admin" | "tutor" | "student";
  } | null>(null);
  const [rolePassword, setRolePassword] = useState("");
  const [roleBusy, setRoleBusy] = useState(false);
  const [signingOut, setSigningOut] = useState<UserRow | null>(null);
  const token = getAdminToken() ?? "";

  const users = useQuery(
    api.admin.usersList,
    token ? { search: search || undefined, role, status, token } : "skip",
  );
  const setUserRole = useMutation(api.admin.setUserRole);
  const promoteToOwner = useMutation(api.admin.promoteToOwner);
  const setUserVerified = useMutation(api.admin.setUserVerified);
  const setTutorHomepageFeature = useMutation(api.admin.setTutorHomepageFeature);
  const suspendUser = useMutation(api.admin.suspendUser);
  const reactivateUser = useMutation(api.admin.reactivateUser);
  const deleteUser = useMutation(api.admin.deleteUser);
  const forceSignOutUser = useMutation(api.admin.forceSignOutUser);

  /** Confirm a role change with the admin password (Owner uses promoteToOwner). */
  const confirmRoleChange = async () => {
    if (!roleChange) return;
    setRoleBusy(true);
    try {
      if (roleChange.nextRole === "owner") {
        await promoteToOwner({
          userId: roleChange.user._id as never,
          token,
          accessPassword: rolePassword,
        });
      } else {
        await setUserRole({
          userId: roleChange.user._id as never,
          role: roleChange.nextRole,
          token,
          accessPassword: rolePassword,
        });
      }
      setRoleChange(null);
      setRolePassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the role.");
    } finally {
      setRoleBusy(false);
    }
  };

  /** Remote sign-out — deletes every auth session for the account. */
  const confirmSignOut = async () => {
    if (!signingOut) return;
    setRoleBusy(true);
    try {
      const res = await forceSignOutUser({ userId: signingOut._id as never, token });
      toast.success(
        `Signed out ${res.revoked} session${res.revoked === 1 ? "" : "s"} for ${signingOut.name}.`,
      );
      setSigningOut(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out the account.");
    } finally {
      setRoleBusy(false);
    }
  };

  const duplicates = useQuery(
    api.admin.duplicateAccounts,
    token ? { token } : "skip",
  );
  const mergeAccounts = useMutation(api.admin.mergeDuplicateAccounts);
  const [merging, setMerging] = useState<string | null>(null);

  const mergeGroup = async (email: string, keeperId: string, dupId: string) => {
    setMerging(email);
    try {
      await mergeAccounts({
        keeperId: keeperId as never,
        duplicateId: dupId as never,
        token,
      });
    } finally {
      setMerging(null);
    }
  };

  // Tutor account integrity — one tutor account = one tutor role. Tutors that
  // still carry student-side records (from the old flow) can have them
  // detached without touching their tutor identity.
  const tutorIntegrity = useQuery(
    api.admin.tutorAccountIntegrity,
    token ? { token } : "skip",
  );
  const clearStudentRecords = useMutation(api.admin.clearTutorStudentRecords);
  const [clearingTutor, setClearingTutor] = useState<
    (FunctionReturnType<typeof api.admin.tutorAccountIntegrity>[number]) | null
  >(null);
  const [clearing, setClearing] = useState<string | null>(null);

  const doClear = async (row: NonNullable<typeof clearingTutor>) => {
    setClearing(row.tutor._id);
    try {
      await clearStudentRecords({ tutorId: row.tutor._id as never, token });
    } finally {
      setClearing(null);
      setClearingTutor(null);
    }
  };

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
                  {u.role === "owner" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold text-black">
                      <Crown className="size-3" /> Owner
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                      {u.role}
                    </span>
                  )}
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
                  onChange={(e) => {
                    const nextRole = e.target.value as "owner" | "admin" | "tutor" | "student";
                    if (nextRole === u.role) return;
                    setRoleChange({ user: u, nextRole });
                    e.target.value = u.role;
                  }}
                  className={cn(
                    "h-9 rounded-lg border border-white/10 bg-black/20 px-2.5 text-xs outline-none",
                    (u.role === "admin" || u.role === "owner") && "text-lime-300",
                  )}
                >
                  <option value="student">Student</option>
                  <option value="tutor">Tutor</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
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
                {u.role === "tutor" && u.verified && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1.5 border-white/15",
                      u.featuredOnHomepage && "border-lime-400/40 text-lime-300",
                    )}
                    onClick={() =>
                      void setTutorHomepageFeature({
                        userId: u._id as never,
                        featuredOnHomepage: !u.featuredOnHomepage,
                        token,
                      })
                    }
                  >
                    {u.featuredOnHomepage ? "★ Homepage" : "Homepage"}
                  </Button>
                )}
                {u.role === "owner" ? null : u.suspended ? (
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
                {u.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-rose-300"
                    onClick={() => setSigningOut(u)}
                    title="Sign this account out of all devices"
                  >
                    <LogOut className="size-3.5" /> Sign out
                  </Button>
                )}
                {u.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-rose-300"
                    onClick={() => setDeleting(u)}
                    title="Permanently delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate accounts — one email should map to one account */}
      {duplicates !== undefined && duplicates.length > 0 && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold text-amber-200">
            <Users className="size-4 text-amber-300" />
            Duplicate accounts ({duplicates.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These emails belong to more than one account (e.g. a student account
            created before a tutor application). Merging keeps the best account
            — all enrollments, certificates, messages and courses move to it,
            and the duplicate is deleted. A tutor will never have a separate
            student portal again.
          </p>
          <div className="mt-4 space-y-3">
            {duplicates.map((g) => (
              <div
                key={g.email}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-sm font-semibold">{g.email}</p>
                <div className="mt-2 space-y-1.5">
                  {g.accounts.map((a, i) => (
                    <div
                      key={a._id}
                      className="flex items-center gap-3 rounded-lg border border-white/8 bg-black/30 px-3 py-2"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <Avatar name={a.name} image={null} className="size-7" />
                      <p className="min-w-0 flex-1 truncate text-sm">
                        {a.name}{" "}
                        <span className="capitalize text-muted-foreground">
                          · {a.role}
                          {a.verified ? " ✓" : ""}
                        </span>
                        {i === 0 && (
                          <span className="ml-1.5 rounded-full bg-lime-400/12 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                            Primary
                          </span>
                        )}
                      </p>
                      {i > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={merging === g.email}
                          onClick={() =>
                            void mergeGroup(g.email, g.accounts[0]._id, a._id)
                          }
                          className="shrink-0 gap-1.5 border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
                        >
                          <RotateCcw
                            className={
                              merging === g.email
                                ? "size-3.5 animate-spin"
                                : "size-3.5"
                            }
                          />
                          {merging === g.email
                            ? "Merging…"
                            : "Merge into primary"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tutor account integrity — one tutor account, one role. No student
          profile or student records may ride along on a tutor's identity. */}
      {tutorIntegrity !== undefined && tutorIntegrity.length > 0 && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/5 p-5">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold text-rose-200">
            <GraduationCap className="size-4 text-rose-300" />
            Tutor accounts carrying student records ({tutorIntegrity.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These tutor accounts are still holding student-side records left
            over from the old registration flow. Detaching them removes only
            the student data — the tutor&rsquo;s identity, role, courses,
            communities and messages are never touched.
          </p>
          <div className="mt-4 space-y-3">
            {tutorIntegrity.map((r) => (
              <div
                key={r.tutor._id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <Avatar name={r.tutor.name} image={r.tutor.image} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {r.tutor.name}{" "}
                    {r.verified && (
                      <BadgeCheck className="ml-1 inline size-4 text-lime-300" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.enrollments} enrollments · {r.certificates} certificates
                    · {r.quizAttempts} quiz attempts · {r.submissions} submissions
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={clearing === r.tutor._id}
                  onClick={() => setClearingTutor(r)}
                  className="shrink-0 gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                >
                  <Trash2
                    className={
                      clearing === r.tutor._id ? "size-3.5 animate-pulse" : "size-3.5"
                    }
                  />
                  {clearing === r.tutor._id
                    ? "Detaching…"
                    : "Detach student records"}
                </Button>
              </div>
            ))}
          </div>
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

      {/* Detach tutor student records confirm */}
      <AlertDialog
        open={!!clearingTutor}
        onOpenChange={(o) => !o && setClearingTutor(null)}
      >
        <AlertDialogContent className="border-white/10 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Detach student records from {clearingTutor?.tutor.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes {clearingTutor?.tutor.name}&rsquo;s student-side
              records ({clearingTutor?.enrollments} enrollments,{" "}
              {clearingTutor?.certificates} certificates,{" "}
              {clearingTutor?.quizAttempts} quiz attempts,{" "}
              {clearingTutor?.submissions} submissions) so the account is
              purely a tutor account. The tutor&rsquo;s role, courses,
              communities and messages are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="gap-1.5 bg-rose-500 font-semibold text-white hover:bg-rose-400"
              onClick={() => {
                if (clearingTutor) void doClear(clearingTutor);
              }}
            >
              <GraduationCap className="size-4" /> Detach student records
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

      {/* Role change — requires the current admin access password */}
      <AlertDialog
        open={!!roleChange}
        onOpenChange={(o) => {
          if (!o) {
            setRoleChange(null);
            setRolePassword("");
          }
        }}
      >
        <AlertDialogContent className="border-white/10 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              {roleChange?.nextRole === "owner" ? (
                <>
                  <Crown className="size-4 text-lime-300" /> Make {roleChange?.user.name} the Owner?
                </>
              ) : (
                <>
                  <KeyRound className="size-4 text-lime-300" /> Change role to {roleChange?.nextRole}
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleChange?.nextRole === "owner"
                ? "The Owner is the highest role: they cannot be signed out remotely or deleted. Any previous Owner is demoted to admin. This requires your current admin password."
                : "Role changes move account powers around, so your current admin password is required."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            placeholder="Current admin password"
            className="h-10 border-white/10 bg-black/20"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              disabled={roleBusy || !rolePassword}
              onClick={(e) => {
                e.preventDefault();
                void confirmRoleChange();
              }}
            >
              <ShieldCheck className="size-4" />
              {roleChange?.nextRole === "owner" ? "Promote to Owner" : "Confirm role change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remote sign-out confirm */}
      <AlertDialog open={!!signingOut} onOpenChange={(o) => !o && setSigningOut(null)}>
        <AlertDialogContent className="border-white/10 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <LogOut className="size-4 text-rose-300" /> Sign out {signingOut?.name} everywhere?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every signed-in session for this account is ended immediately —
              web and mobile. They will need to sign in again to keep using the
              platform. The Owner account cannot be signed out this way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 font-semibold text-white hover:bg-rose-400"
              onClick={() => {
                void confirmSignOut();
              }}
            >
              Sign out everywhere
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
