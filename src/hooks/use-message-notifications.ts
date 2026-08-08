import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { playMessageSound, unlockAudio } from "@/lib/chat-sound";

/**
 * Plays the notification sound whenever a NEW INCOMING message lands in any
 * conversation (WhatsApp-style). The conversations query is reactive, so this
 * fires in real time while the app is open — whether or not the chat panel is
 * open. Messages you send yourself never trigger the sound (the query reports
 * `lastSenderId`).
 */
export function useMessageSound() {
  const { user } = useAuth();
  const conversations = useQuery(api.messages.myConversations);
  const prevLastAt = useRef<Record<string, number>>({});

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
    if (!user?._id || !conversations) return;
    const nowMap: Record<string, number> = {};
    for (const c of conversations) {
      nowMap[c.threadId] = c.lastAt;
      const was = prevLastAt.current[c.threadId];
      // A message arrived if lastAt moved forward, and it's not mine.
      if (was !== undefined && c.lastAt > was && c.lastSenderId !== user._id) {
        playMessageSound();
        break;
      }
    }
    prevLastAt.current = nowMap;
  }, [conversations, user?._id]);
}
