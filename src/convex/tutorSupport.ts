import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  checkRateLimit,
  notify,
  publicUser,
  requireAdminSession,
  requireTutor,
  requireTutorPreview,
} from "./lib";

export const supportCategoryValidator = v.union(
  v.literal("bug"),
  v.literal("feature"),
  v.literal("account"),
  v.literal("content"),
  v.literal("other"),
);

// ---------------------------------------------------------------------------
// Tutor side — report an issue / message the admin (Developer)
// ---------------------------------------------------------------------------

/** Submit a support message to the ForgeX admin team. */
export const submitSupportMessage = mutation({
  args: {
    category: supportCategoryValidator,
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const tutor = await requireTutor(ctx);
    await checkRateLimit(
      ctx,
      `tutor-support:${tutor._id}`,
      10,
      60 * 60 * 1000,
      "You've sent several messages recently — please wait a while before sending more.",
    );
    const subject = args.subject.trim().slice(0, 200);
    const body = args.body.trim().slice(0, 5000);
    if (!subject || !body) {
      throw new Error("Please add a subject and a message.");
    }
    const now = Date.now();
    const id = await ctx.db.insert("tutorSupportMessages", {
      tutorId: tutor._id,
      category: args.category,
      subject,
      body,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    // Deliver into the platform admin identity's notifications (the same
    // identity used by the admin chat) so it surfaces in the admin area.
    const admin = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "admin@forgex.academy"))
      .first();
    if (admin) {
      await notify(ctx, {
        userId: admin._id,
        title: `Tutor support: ${subject}`,
        body: `${tutor.name ?? "A tutor"} reported: ${body.slice(0, 90)}`,
        type: "support",
        link: "/admin/communication/reports",
      });
    }
    return id;
  },
});

/** The tutor's own support messages, newest first, with admin replies. */
export const mySupportMessages = query({
  args: {},
  handler: async (ctx) => {
    const tutor = await requireTutorPreview(ctx);
    if (!tutor) return [];
    const docs = await ctx.db
      .query("tutorSupportMessages")
      .withIndex("by_tutor", (q) => q.eq("tutorId", tutor._id))
      .collect();
    return docs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ---------------------------------------------------------------------------
// Admin side — review + reply (password-gated admin session)
// ---------------------------------------------------------------------------

export const adminSupportList = query({
  args: {
    token: v.string(),
    status: v.optional(
      v.union(v.literal("open"), v.literal("responded"), v.literal("resolved")),
    ),
  },
  handler: async (ctx, { token, status }) => {
    await requireAdminSession(ctx, token);
    const docs = await ctx.db.query("tutorSupportMessages").collect();
    const filtered = status
      ? docs.filter((d) => d.status === status)
      : docs;
    const hydrated = await Promise.all(
      filtered.map(async (d) => {
        const tutor = await ctx.db.get(d.tutorId);
        return { ...d, tutor: tutor ? publicUser(tutor) : null };
      }),
    );
    return hydrated.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Reply to a tutor support message and mark it responded/resolved. */
export const adminSupportRespond = mutation({
  args: {
    token: v.string(),
    id: v.id("tutorSupportMessages"),
    note: v.string(),
    status: v.union(v.literal("responded"), v.literal("resolved")),
  },
  handler: async (ctx, { token, id, note, status }) => {
    await requireAdminSession(ctx, token);
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Message not found.");
    const trimmed = note.trim().slice(0, 5000);
    if (!trimmed) throw new Error("A reply can't be empty.");
    await ctx.db.patch(id, {
      status,
      adminNote: trimmed,
      adminNoteAt: Date.now(),
      updatedAt: Date.now(),
    });
    await notify(ctx, {
      userId: doc.tutorId,
      title: `Update on “${doc.subject}”`,
      body: trimmed.slice(0, 90),
      type: "support",
      link: "/tutor/support",
    });
    return true;
  },
});

/** Open/needs-attention count for the admin nav badge. */
export const adminSupportStats = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAdminSession(ctx, token);
    const docs = await ctx.db.query("tutorSupportMessages").collect();
    return {
      open: docs.filter((d) => d.status === "open").length,
      total: docs.length,
    };
  },
});
