/**
 * ForgeX AI Support Assistant — data layer.
 *
 * Queries/mutations for sessions, tickets, knowledge base admin, analytics
 * and team-side ticket management. The LLM-backed actions live in
 * aiSupport.ts ("use node") and call these via `internal.aiSupportData.*`.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const WELCOME_MESSAGE =
  "Hi! 👋 I'm the ForgeX Support Assistant. Tell me what you're experiencing, and I'll do my best to help you resolve it. If I can't solve the problem, you can request help from our support team.";

export const KB_CATEGORIES = [
  "student-support",
  "tutor-support",
  "course-management",
  "platform-features",
  "technical",
  "account",
  "community",
  "ai-hub",
  "general",
] as const;

export const TEAM_LABELS: Record<string, string> = {
  "student-support": "Student Support Team",
  "tutor-support": "Tutor Support Team",
  technical: "Technical / Admin Support",
  academic: "Academic Team",
  "ai-support": "AI Support Team",
  admin: "General Support (Admin)",
};

// ---------------------------------------------------------------------------
// AI voice audio files (stored by aiVoice.speakText actions)
// ---------------------------------------------------------------------------

/** Resolve a stored TTS audio chunk to a playable https URL. */
export const getAudioUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null; // signed-in only
    return ctx.storage.getUrl(args.storageId);
  },
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const getMyActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db
      .query("aiSupportSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!session || session.status !== "active") return null;
    return session;
  },
});

/** The user's most recent session regardless of status, with live ticket
 *  context so the UI can offer "continue previous conversation?" and show
 *  team replies in realtime. */
export const getMyLatestSession = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db
      .query("aiSupportSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!session) return null;

    const ticket = session.ticketId ? await ctx.db.get(session.ticketId) : null;
    let hasUnseenTeamReply = false;
    let lastTeamReplyAt: number | null = null;
    let lastMessagePreview: string | undefined;
    if (ticket) {
      const msgs = await ctx.db
        .query("aiSupportTicketMessages")
        .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
        .order("desc")
        .take(50);
      for (const m of msgs) {
        if (m.senderType === "team" && !m.isInternalNote && lastTeamReplyAt === null) {
          lastTeamReplyAt = m.createdAt;
        }
        if (!lastMessagePreview && !m.isInternalNote && m.senderType !== "system") {
          lastMessagePreview = m.body.slice(0, 140);
        }
      }
      hasUnseenTeamReply =
        lastTeamReplyAt !== null &&
        lastTeamReplyAt > (ticket.userLastSeenAt ?? 0) &&
        ticket.status !== "closed";
    } else if (session.messages.length > 1) {
      const last = session.messages[session.messages.length - 1];
      lastMessagePreview = last.body.slice(0, 140);
    }

    return {
      _id: session._id,
      status: session.status,
      messages: session.messages,
      suggestedCategory: session.suggestedCategory,
      summary: session.summary,
      rating: session.rating,
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
      ticket: ticket
        ? {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            status: ticket.status,
            assignedTeam: ticket.assignedTeam,
            teamLabel: TEAM_LABELS[ticket.assignedTeam] ?? ticket.assignedTeam,
            subject: ticket.subject,
            hasUnseenTeamReply,
            lastTeamReplyAt,
            lastMessagePreview,
          }
        : null,
    };
  },
});

export const startSession = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in to use support.");
    const user = await ctx.db.get(userId);
    const now = Date.now();
    return ctx.db.insert("aiSupportSessions", {
      userId,
      userRole: (user?.role as string) ?? "student",
      status: "active",
      messages: [{ role: "ai" as const, body: WELCOME_MESSAGE, at: now }],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const internalListEnabledKb = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("aiKnowledgeBase")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      title: r.title,
      category: r.category,
      keywords: r.keywords ?? [],
      content: r.content,
    }));
  },
});

export const internalGetSession = internalQuery({
  args: { sessionId: v.id("aiSupportSessions") },
  handler: async (ctx, args) => ctx.db.get(args.sessionId),
});

export const internalAppendMessages = internalMutation({
  args: {
    sessionId: v.id("aiSupportSessions"),
    userMessage: v.string(),
    aiReply: v.string(),
    suggestedCategory: v.string(),
    usedKbIds: v.array(v.id("aiKnowledgeBase")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    await ctx.db.patch(args.sessionId, {
      messages: [
        ...session.messages,
        { role: "user" as const, body: args.userMessage, at: now },
        { role: "ai" as const, body: args.aiReply, at: now + 1 },
      ],
      suggestedCategory: args.suggestedCategory,
      updatedAt: now,
    });
    for (const kbId of args.usedKbIds) {
      const entry = await ctx.db.get(kbId);
      if (entry && entry.timesUsed !== undefined) {
        await ctx.db.patch(kbId, { timesUsed: entry.timesUsed + 1 });
      }
    }
  },
});

export const resolveSession = mutation({
  args: {
    sessionId: v.id("aiSupportSessions"),
    rating: v.optional(v.union(v.literal("helpful"), v.literal("not_helpful"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    if (session.userId !== userId) throw new Error("Not your session.");
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: "resolved",
      resolvedAt: now,
      updatedAt: now,
      ...(args.rating ? { rating: args.rating } : {}),
    });
    // Feedback on article quality when the user rates the resolution.
    if (args.rating === "not_helpful" && session.suggestedCategory) {
      void session.suggestedCategory; // available for future gap analysis
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Escalation internals (called by the escalateToHuman action)
// ---------------------------------------------------------------------------

export const internalTicketBySession = internalQuery({
  args: { sessionId: v.id("aiSupportSessions") },
  handler: async (ctx, args) =>
    ctx.db.query("aiSupportTickets").withIndex("by_session", (q) => q.eq("sessionId", args.sessionId)).first(),
});

export const internalCreateEscalatedTicket = internalMutation({
  args: {
    sessionId: v.id("aiSupportSessions"),
    userId: v.id("users"),
    userRole: v.string(),
    category: v.string(),
    assignedTeam: v.string(),
    subject: v.string(),
    aiSummary: v.string(),
    additionalDetails: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const count = (await ctx.db.query("aiSupportTickets").collect()).length;
    const ticketNumber = `FX-${1001 + count}`;

    const ticketId = await ctx.db.insert("aiSupportTickets", {
      ticketNumber,
      sessionId: args.sessionId,
      userId: args.userId,
      userRole: args.userRole,
      category: args.category,
      assignedTeam: args.assignedTeam,
      subject: args.subject,
      aiSummary: args.aiSummary,
      additionalDetails: args.additionalDetails,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.sessionId, {
      status: "escalated",
      ticketId,
      summary: args.aiSummary,
      updatedAt: now,
    });

    await ctx.db.insert("aiSupportTicketMessages", {
      ticketId,
      senderType: "system",
      body: `Ticket ${ticketNumber} created from AI Support Assistant. Assigned to ${
        TEAM_LABELS[args.assignedTeam] ?? args.assignedTeam
      }. Full AI conversation attached.`,
      isInternalNote: false,
      createdAt: now,
    });

    const staff = await ctx.db
      .query("users")
      .filter((q) =>
        q.or(q.eq(q.field("teamRole"), args.assignedTeam), q.eq(q.field("role"), "admin")),
      )
      .collect();
    for (const member of staff) {
      await ctx.db.insert("notifications", {
        userId: member._id,
        title: `New AI-escalated ticket ${ticketNumber}`,
        body: args.subject.slice(0, 140),
        type: "ai_support_ticket",
        link: "/admin/ai-support",
        read: false,
        createdAt: now,
      });
    }

    return { ticketId, ticketNumber };
  },
});

// ---------------------------------------------------------------------------
// User-side ticket views & replies
// ---------------------------------------------------------------------------

/** Owner marks a ticket thread as read so unseen-reply badges clear. */
export const markTicketSeen = mutation({
  args: { ticketId: v.id("aiSupportTickets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.userId !== userId) throw new Error("No access.");
    await ctx.db.patch(args.ticketId, { userLastSeenAt: Date.now() });
    return true;
  },
});

export const myTickets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const tickets = await ctx.db
      .query("aiSupportTickets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(25);
    // Attach live unseen-team-reply flags (internal notes never count).
    return Promise.all(
      tickets.map(async (t) => {
        const msgs = await ctx.db
          .query("aiSupportTicketMessages")
          .withIndex("by_ticket", (q) => q.eq("ticketId", t._id))
          .order("desc")
          .take(30);
        let lastTeamReplyAt: number | null = null;
        for (const m of msgs) {
          if (m.senderType === "team" && !m.isInternalNote) {
            lastTeamReplyAt = m.createdAt;
            break;
          }
        }
        const hasUnseenTeamReply =
          lastTeamReplyAt !== null &&
          lastTeamReplyAt > (t.userLastSeenAt ?? 0) &&
          t.status !== "closed";
        return { ...t, hasUnseenTeamReply };
      }),
    );
  },
});

export const getTicketThread = query({
  args: { ticketId: v.id("aiSupportTickets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    const user = await ctx.db.get(userId);
    const isAdmin = user?.role === "admin";
    const isSameTeam = !!user && user.teamRole === ticket.assignedTeam;
    if (ticket.userId !== userId && !isAdmin && !isSameTeam) throw new Error("No access to this ticket.");

    const messages = await ctx.db
      .query("aiSupportTicketMessages")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect();

    const visible = messages.filter((m) => {
      if (!m.isInternalNote) return true;
      return isAdmin || isSameTeam; // internal notes hidden from reporter
    });

    const names = new Map<string, string>();
    for (const m of visible) {
      if (m.senderId && !names.has(m.senderId)) {
        const u = await ctx.db.get(m.senderId);
        names.set(m.senderId, u ? ((u.name as string) ?? "Staff") : "Staff");
      }
    }

    const aiSession = ticket.sessionId ? await ctx.db.get(ticket.sessionId) : null;

    return {
      ticket,
      messages: visible.map((m) => ({ ...m, senderName: m.senderId ? names.get(m.senderId) : undefined })),
      aiConversation: aiSession?.messages ?? [],
    };
  },
});

export const replyToMyTicket = mutation({
  args: { ticketId: v.id("aiSupportTickets"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (ticket.userId !== userId) throw new Error("No access.");
    if (!args.body.trim()) throw new Error("Message cannot be empty.");

    const now = Date.now();
    await ctx.db.insert("aiSupportTicketMessages", {
      ticketId: args.ticketId,
      senderId: userId,
      senderType: "user",
      body: args.body.trim(),
      isInternalNote: false,
      createdAt: now,
    });
    await ctx.db.patch(args.ticketId, {
      status: ticket.status === "resolved" || ticket.status === "closed" ? "open" : "waiting_for_user",
      updatedAt: now,
    });

    const staff = await ctx.db
      .query("users")
      .filter((q) => q.or(q.eq(q.field("teamRole"), ticket.assignedTeam), q.eq(q.field("role"), "admin")))
      .collect();
    for (const s of staff) {
      await ctx.db.insert("notifications", {
        userId: s._id,
        title: `User replied on ${ticket.ticketNumber}`,
        body: args.body.slice(0, 140),
        type: "ai_support_ticket",
        read: false,
        createdAt: now,
      });
    }
    return true;
  },
});

// ---------------------------------------------------------------------------
// Team-side management (support teams + admins)
// ---------------------------------------------------------------------------

async function requireTeamAccess(ctx: any, allowedTeams: string[]) {
  const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
  if (userId === null) throw new Error("Not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Account not found.");
  const isAdmin = user.role === "admin";
  const isTeamMember = allowedTeams.includes((user.teamRole as string) ?? "");
  if (!isAdmin && !isTeamMember) throw new Error("No access to this queue.");
  return { userId, user, isAdmin };
}

const QUEUE_TEAMS = ["student-support", "tutor-support", "academic", "ai-support"];

export const listTeamTickets = query({
  args: {},
  handler: async (ctx) => {
    const { user, isAdmin } = await requireTeamAccess(ctx, QUEUE_TEAMS);
    if (isAdmin) {
      return ctx.db.query("aiSupportTickets").order("desc").take(200);
    }
    return ctx.db
      .query("aiSupportTickets")
      .withIndex("by_team_status", (q) => q.eq("assignedTeam", (user.teamRole as string) ?? ""))
      .order("desc")
      .take(200);
  },
});

export const updateTicketStatus = mutation({
  args: {
    ticketId: v.id("aiSupportTickets"),
    status: v.union(
      v.literal("open"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("waiting_for_user"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, args) => {
    const { user, isAdmin } = await requireTeamAccess(ctx, QUEUE_TEAMS);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (!isAdmin && user.teamRole !== ticket.assignedTeam) throw new Error("No access to this ticket.");
    const now = Date.now();
    await ctx.db.patch(args.ticketId, {
      status: args.status,
      resolvedAt: args.status === "resolved" ? now : ticket.resolvedAt,
      updatedAt: now,
    });
    await ctx.db.insert("aiSupportTicketMessages", {
      ticketId: args.ticketId,
      senderType: "system",
      body: `Status changed to ${args.status.replace(/_/g, " ")}.`,
      isInternalNote: false,
      createdAt: now,
    });
    await ctx.db.insert("notifications", {
      userId: ticket.userId,
      title: `Ticket ${ticket.ticketNumber} update`,
      body: `Status: ${args.status.replace(/_/g, " ")}`,
      type: "ai_support_ticket",
      read: false,
      createdAt: now,
    });
    return true;
  },
});

export const claimTicket = mutation({
  args: { ticketId: v.id("aiSupportTickets") },
  handler: async (ctx, args) => {
    const { userId, user, isAdmin } = await requireTeamAccess(ctx, QUEUE_TEAMS);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (!isAdmin && user.teamRole !== ticket.assignedTeam) throw new Error("No access to this ticket.");
    const now = Date.now();
    await ctx.db.patch(args.ticketId, { assignedTo: userId, status: "in_progress", updatedAt: now });
    await ctx.db.insert("aiSupportTicketMessages", {
      ticketId: args.ticketId,
      senderType: "system",
      body: `${user.name ?? "A staff member"} claimed this ticket.`,
      isInternalNote: false,
      createdAt: now,
    });
    return true;
  },
});

export const teamReplyToTicket = mutation({
  args: { ticketId: v.id("aiSupportTickets"), body: v.string(), isInternalNote: v.boolean() },
  handler: async (ctx, args) => {
    const { userId, user, isAdmin } = await requireTeamAccess(ctx, QUEUE_TEAMS);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (!isAdmin && user.teamRole !== ticket.assignedTeam) throw new Error("No access to this ticket.");
    if (!args.body.trim()) throw new Error("Message cannot be empty.");
    const now = Date.now();
    await ctx.db.insert("aiSupportTicketMessages", {
      ticketId: args.ticketId,
      senderId: userId,
      senderType: "team",
      body: args.body.trim(),
      isInternalNote: args.isInternalNote,
      createdAt: now,
    });
    await ctx.db.patch(args.ticketId, {
      status: args.isInternalNote ? ticket.status : "waiting_for_user",
      updatedAt: now,
    });
    if (!args.isInternalNote) {
      await ctx.db.insert("notifications", {
        userId: ticket.userId,
        title: `Support replied on ${ticket.ticketNumber}`,
        body: args.body.slice(0, 140),
        type: "ai_support_ticket",
        link: "/dashboard/support",
        read: false,
        createdAt: now,
      });
    }
    return true;
  },
});

export const reassignTicket = mutation({
  args: { ticketId: v.id("aiSupportTickets"), newTeam: v.string() },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, QUEUE_TEAMS);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    const now = Date.now();
    await ctx.db.patch(args.ticketId, {
      assignedTeam: args.newTeam,
      status: "open",
      assignedTo: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("aiSupportTicketMessages", {
      ticketId: args.ticketId,
      senderType: "system",
      body: `Ticket reassigned to ${TEAM_LABELS[args.newTeam] ?? args.newTeam}.`,
      isInternalNote: false,
      createdAt: now,
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Knowledge Base admin (admins + AI Support team)
// ---------------------------------------------------------------------------

async function requireKbEditor(ctx: any) {
  const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
  if (userId === null) throw new Error("Not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Account not found.");
  if (user.role !== "admin" && user.teamRole !== "ai-support") {
    throw new Error("Only admins and AI Support members can manage the knowledge base.");
  }
  return userId;
}

export const listKnowledgeAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireKbEditor(ctx);
    return ctx.db.query("aiKnowledgeBase").order("desc").take(500);
  },
});

export const saveKnowledgeEntry = mutation({
  args: {
    id: v.optional(v.id("aiKnowledgeBase")),
    title: v.string(),
    category: v.string(),
    keywords: v.array(v.string()),
    content: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireKbEditor(ctx);
    if (!args.title.trim() || !args.content.trim()) throw new Error("Title and content are required.");
    const now = Date.now();
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title.trim(),
        category: args.category,
        keywords: args.keywords,
        content: args.content.trim(),
        enabled: args.enabled,
        updatedAt: now,
      });
      return args.id;
    }
    return ctx.db.insert("aiKnowledgeBase", {
      title: args.title.trim(),
      category: args.category,
      keywords: args.keywords,
      content: args.content.trim(),
      enabled: args.enabled,
      createdBy: userId,
      timesUsed: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteKnowledgeEntry = mutation({
  args: { id: v.id("aiKnowledgeBase") },
  handler: async (ctx, args) => {
    await requireKbEditor(ctx);
    await ctx.db.delete(args.id);
    return true;
  },
});

/** One-click starter pack so the assistant is useful immediately. Only fills
 *  gaps — never duplicates or overwrites existing entries. */
const DEFAULT_KB = [
  {
    title: "I cannot access my enrolled course",
    category: "student-support",
    keywords: ["course", "access", "enrolled", "enrollment", "locked"],
    content:
      "Let's get you back into your course:\n\n1. Confirm you're signed in with the same email used at enrollment.\n2. Open Dashboard → My Courses and check the course appears under 'Enrolled'.\n3. Refresh the page (Ctrl/Cmd + R), then reopen the course.\n4. If it shows 'Enroll' instead of 'Continue', your enrollment didn't complete — try enrolling again.\n\nIf none of these work, request human support and we'll fix your enrollment directly.",
  },
  {
    title: "How do I reset my password?",
    category: "account",
    keywords: ["password", "reset", "forgot", "login", "sign in"],
    content:
      "To reset your password:\n\n1. Go to the Sign in page and tap 'Forgot password?'.\n2. Enter the email linked to your ForgeX account.\n3. Check your inbox (and spam folder) for the reset link.\n4. Choose a new password and sign in again.\n\nThe reset link expires after a short while — request a new one if needed.",
  },
  {
    title: "Videos are not playing or keep buffering",
    category: "technical",
    keywords: ["video", "playing", "buffering", "loading", "player"],
    content:
      "Try these steps for video problems:\n\n1. Refresh the page and give the video ~10 seconds to load.\n2. Pause other downloads/streams that may consume bandwidth.\n3. Try a different browser (Chrome or Safari) and disable VPN if active.\n4. On mobile, switch from cellular data to Wi-Fi (or vice versa).\n5. Lower the playback quality in the player settings if available.\n\nIf a specific video always fails, report it — we'll check it on our side.",
  },
  {
    title: "My quiz answers were not saved / quiz won't submit",
    category: "student-support",
    keywords: ["quiz", "submit", "answers", "saved", "assessment"],
    content:
      "If your quiz didn't save:\n\n1. Don't close the tab immediately after submitting — wait for the confirmation.\n2. Check your internet connection stayed stable during submission.\n3. Reopen the quiz: if attempts remain, resubmit.\n4. If it says 'already completed' but shows no score, request human support with the course name and quiz title and we'll verify your attempt.",
  },
  {
    title: "How do I upload my course as a tutor?",
    category: "tutor-support",
    keywords: ["upload", "course", "create", "tutor", "lesson", "video upload"],
    content:
      "Publishing a course as a tutor:\n\n1. Go to Tutor Dashboard → Courses → Create Course.\n2. Fill the course details, then add modules and lessons.\n3. Upload lesson videos (MP4 recommended) or paste video links.\n4. Add quizzes and assignments where relevant.\n5. Submit for review — the Academic Team reviews quality before it goes live.\n\nYou'll get a notification when the review completes.",
  },
  {
    title: "How do certificates work?",
    category: "platform-features",
    keywords: ["certificate", "verify", "completion", "download"],
    content:
      "About certificates:\n\n1. Complete all lessons and pass the required quizzes of a course.\n2. Your certificate generates automatically in Dashboard → Certificates.\n3. Each certificate has a unique ID and QR code anyone can verify at forgexacademy.com/verify.\n4. Download or share it directly from the dashboard.\n\nMissing a certificate after completing everything? Request human support with the course name.",
  },
];

export const seedDefaultKnowledge = mutation({
  args: {},
  handler: async (ctx) => {
    await requireKbEditor(ctx);
    const existing = await ctx.db.query("aiKnowledgeBase").collect();
    const titles = new Set(existing.map((e) => e.title));
    const now = Date.now();
    let added = 0;
    for (const entry of DEFAULT_KB) {
      if (titles.has(entry.title)) continue;
      await ctx.db.insert("aiKnowledgeBase", {
        ...entry,
        enabled: true,
        timesUsed: 0,
        helpfulCount: 0,
        notHelpfulCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      added += 1;
    }
    return added;
  },
});

// ---------------------------------------------------------------------------
// Analytics (admins + AI Support team)
// ---------------------------------------------------------------------------

export const aiSupportAnalytics = query({
  args: {},
  handler: async (ctx) => {
    await requireKbEditor(ctx);
    const sessions = await ctx.db.query("aiSupportSessions").collect();
    const tickets = await ctx.db.query("aiSupportTickets").collect();
    const kb = await ctx.db.query("aiKnowledgeBase").collect();

    const resolvedByAi = sessions.filter((s) => s.status === "resolved").length;
    const escalated = sessions.filter((s) => s.status === "escalated").length;
    const total = sessions.length;

    const categoryCounts = new Map<string, number>();
    for (const t of tickets) {
      categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
    }
    const commonProblems = [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const resolvedDurations = sessions
      .filter((s) => s.resolvedAt)
      .map((s) => (s.resolvedAt! - s.createdAt) / 1000);
    const avgResolutionSeconds = resolvedDurations.length
      ? Math.round(resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length)
      : 0;

    const ticketDurations = tickets
      .filter((t) => t.resolvedAt)
      .map((t) => (t.resolvedAt! - t.createdAt) / 1000);
    const avgTicketResolutionSeconds = ticketDurations.length
      ? Math.round(ticketDurations.reduce((a, b) => a + b, 0) / ticketDurations.length)
      : 0;

    const gaps = sessions
      .filter((s) => s.status === "escalated")
      .slice(-30)
      .map((s) => ({
        sessionId: s._id,
        question: s.messages.find((m) => m.role === "user")?.body?.slice(0, 160) ?? "(no message)",
        at: s.createdAt,
      }))
      .reverse();

    const ratings = sessions.filter((s) => s.rating);
    const helpful = ratings.filter((s) => s.rating === "helpful").length;

    return {
      totalConversations: total,
      resolvedByAi,
      escalatedToHumans: escalated,
      resolutionRate: total ? Math.round((resolvedByAi / total) * 100) : 0,
      commonProblems,
      avgResolutionSeconds,
      avgTicketResolutionSeconds,
      knowledgeGaps: gaps,
      kbSize: kb.length,
      kbEnabled: kb.filter((k) => k.enabled).length,
      topUsedArticles: [...kb]
        .sort((a, b) => (b.timesUsed ?? 0) - (a.timesUsed ?? 0))
        .slice(0, 5)
        .map((k) => ({ title: k.title, timesUsed: k.timesUsed ?? 0 })),
      satisfaction: ratings.length ? Math.round((helpful / ratings.length) * 100) : null,
    };
  },
});
