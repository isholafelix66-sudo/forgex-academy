import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const teamRoleValidator = v.union(
  v.literal("academic"),
  v.literal("ai-support"),
  v.literal("tutor-support"),
  v.literal("student-support"),
);

/** Get the current user's team role. */
export const getMyTeamRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      teamRole: user.teamRole ?? null,
      teamRoleAssignedAt: user.teamRoleAssignedAt ?? null,
    };
  },
});

/** Admin: list all users with their team role status. */
export const adminListUsers = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") throw new Error("Admin access required");

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isSeed)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Anonymous",
        email: u.email ?? "",
        role: u.role ?? "student",
        teamRole: u.teamRole ?? null,
        teamRoleAssignedAt: u.teamRoleAssignedAt ?? null,
        emailVerified: !!u.emailVerificationTime,
        lastActivity: u.lastActivity ?? null,
      }));
  },
});

/** Admin: set or remove a user's team role. */
export const setTeamRole = mutation({
  args: {
    userId: v.id("users"),
    teamRole: v.union(
      teamRoleValidator,
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") throw new Error("Admin access required");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      teamRole: args.teamRole as any,
      teamRoleAssignedAt: args.teamRole ? Date.now() : undefined,
    });

    return { success: true };
  },
});
