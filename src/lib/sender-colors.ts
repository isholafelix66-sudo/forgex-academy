/**
 * Deterministic per-sender accent colors for chat bubbles.
 *
 * Each sender's user id hashes to a fixed palette entry, so every person's
 * messages are visually distinct (and stay the same color across reloads)
 * without ever matching the current user's lime brand bubble. The palette is
 * deliberately green-free — lime is reserved for the signed-in user.
 *
 * Class strings are literal so Tailwind's JIT can see them.
 */

const BUBBLE_COLORS = [
  "border-sky-400/30 bg-sky-400/12 text-sky-50",
  "border-violet-400/30 bg-violet-400/12 text-violet-50",
  "border-amber-400/30 bg-amber-400/12 text-amber-50",
  "border-rose-400/30 bg-rose-400/12 text-rose-50",
  "border-cyan-400/30 bg-cyan-400/12 text-cyan-50",
  "border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-50",
  "border-orange-400/30 bg-orange-400/12 text-orange-50",
  "border-teal-400/30 bg-teal-400/12 text-teal-50",
  "border-indigo-400/30 bg-indigo-400/12 text-indigo-50",
  "border-pink-400/30 bg-pink-400/12 text-pink-50",
];

const NAME_COLORS = [
  "text-sky-300",
  "text-violet-300",
  "text-amber-300",
  "text-rose-300",
  "text-cyan-300",
  "text-fuchsia-300",
  "text-orange-300",
  "text-teal-300",
  "text-indigo-300",
  "text-pink-300",
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Bubble background/border/text classes for a sender's messages. */
export function senderBubbleClass(
  key: string | null | undefined,
): string {
  if (!key) return BUBBLE_COLORS[0];
  return BUBBLE_COLORS[hashKey(key) % BUBBLE_COLORS.length];
}

/** Sender-name text color matching their bubble accent. */
export function senderNameClass(key: string | null | undefined): string {
  if (!key) return NAME_COLORS[0];
  return NAME_COLORS[hashKey(key) % NAME_COLORS.length];
}
