import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { playMessageSound, unlockAudio } from "@/lib/chat-sound";

export type CommunityAlert = {
  communityId: string;
  name: string;
  lastMessageAt: number;
  lastSenderId: string | null;
  lastSenderName: string;
  lastPreview: string;
};

/**
 * Real-time community notification trigger: whenever a NEW message lands in a
 * community the signed-in user belongs to (and they haven't read it yet), the
 * message chime plays and `onNewMessage` fires with the alert details — so
 * callers can show a toast/badge that jumps straight into that community.
 *
 * Autoplay policy: browsers block audio until the first user gesture, so the
 * AudioContext is unlocked on the first pointer/key event (same pattern as the
 * 1:1 chat sound). Reading a community (markCommunityRead) advances lastReadAt
 * and empties its alert row, so a room you're actively viewing never
 * self-notifies.
 */
export function useCommunityMessageAlerts(
  onNewMessage?: (alert: CommunityAlert) => void,
) {
  const { user } = useAuth();
  const alerts = useQuery(
    api.community.communityMessageAlerts,
    user?._id ? {} : "skip",
  );
  const prev = useRef<Record<string, number>>({});
  const onNewRef = useRef(onNewMessage);
  onNewRef.current = onNewMessage;

  // Browsers block audio until the first user gesture — unlock on it.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    try {
      if (!user?._id || !alerts || alerts.length === 0) return;
      let chimed = false;
      for (const a of alerts) {
        const was = prev.current[a.communityId];
        if (was !== undefined && a.lastMessageAt > was) {
          if (!chimed) {
            chimed = true;
            playMessageSound();
          }
          onNewRef.current?.(a);
        }
      }
      // Never delete entries — a community that becomes read keeps its last
      // timestamp, so the next message after reading is still detected.
      for (const a of alerts) {
        const prevVal = prev.current[a.communityId];
        if (prevVal === undefined || a.lastMessageAt > prevVal) {
          prev.current[a.communityId] = a.lastMessageAt;
        }
      }
    } catch {
      // Notification failures must never take down a page.
    }
  }, [alerts, user?._id]);

  return alerts;
}
