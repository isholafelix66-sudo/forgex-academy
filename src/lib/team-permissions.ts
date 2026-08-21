// Shared Team Permission Helper
// Provides role-based action checks for all team workspaces

export type TeamRole = "academic" | "ai-support" | "tutor-support" | "student-support" | "content";
export type PlatformRole = "admin" | "tutor" | "student";

export type ActionType =
  | "ai.create" | "ai.edit" | "ai.publish" | "ai.delete"
  | "courses.review" | "courses.approve" | "courses.revision" | "courses.escalate"
  | "support.reply" | "support.assign" | "support.escalate" | "support.resolve" | "support.internal_note"
  | "content.create" | "content.edit" | "content.publish"
  | "team.manage" | "team.view";

interface UserContext {
  role?: PlatformRole | string;
  teamRole?: TeamRole | string | null;
}

/**
 * Check if the current user can perform a specific action.
 * Admin always returns true (super override).
 */
export function canPerformAction(
  user: UserContext | null | undefined,
  action: ActionType
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true; // Super Admin bypass

  const team = user.teamRole as string | null;

  switch (action) {
    // AI Support actions
    case "ai.create":
    case "ai.edit":
    case "ai.publish":
    case "ai.delete":
      return team === "ai-support";

    // Academic actions
    case "courses.review":
    case "courses.approve":
    case "courses.revision":
    case "courses.escalate":
      return team === "academic";

    // Support actions (both tutor and student support)
    case "support.reply":
    case "support.assign":
    case "support.escalate":
    case "support.resolve":
    case "support.internal_note":
      return team === "tutor-support" || team === "student-support";

    // Content actions
    case "content.create":
    case "content.edit":
    case "content.publish":
      return team === "content";

    // Team management
    case "team.manage":
      return user.role === "admin";
    case "team.view":
      return !!team || user.role === "admin";

    default:
      return false;
  }
}

/**
 * Get the user's display label for messages/activities.
 */
export function getSenderRole(user: UserContext): string {
  if (user.role === "admin") return "admin";
  return user.teamRole || user.role || "member";
}

/**
 * Team display info for UI rendering.
 */
export const TEAM_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  academic: { name: "Academic Team", icon: "📚", color: "blue" },
  "ai-support": { name: "AI Support", icon: "🤖", color: "purple" },
  "tutor-support": { name: "Tutor Support", icon: "🎓", color: "amber" },
  "student-support": { name: "Student Support", icon: "💚", color: "lime" },
  content: { name: "Content Team", icon: "📝", color: "cyan" },
};
