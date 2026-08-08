/**
 * Opens the global floating chat focused on a specific user — used by
 * “Message tutor” / “Message student” buttons anywhere in the app. The
 * FloatingChat widget listens for this event (it's mounted once, globally).
 */
export const OPEN_CHAT_EVENT = "forgex:open-chat";

export function openChatWith(userId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_CHAT_EVENT, { detail: { userId } }),
  );
}
