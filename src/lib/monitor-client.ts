/**
 * Client → backend monitoring bridge.
 *
 * Forwards browser-side failures (render errors, window errors, unhandled
 * rejections) into the ForgeX monitoring backend (`clientReportError`) so
 * frontend incidents appear in the SAME groups/incidents/health sweep as
 * backend failures. Works for anonymous visitors — no auth provider required.
 *
 * Design rules:
 *  - NEVER throw and NEVER await — monitoring must not affect the UI.
 *  - Dedupe: one report per error identity per session per 10 minutes.
 *  - Batch: at most one in-flight call; reports queue and flush.
 *  - Privacy: no user content is collected — only a truncated message
 *    preview, the current route, and a coarse device hint.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

type QueuedReport = {
  message: string;
  module?: string;
  fingerprintHint?: string;
  componentStack?: string;
};

const QUEUE_FLUSH_MS = 5_000;
const DEDUPE_MS = 10 * 60_000;
const MAX_QUEUE = 20;

let queue: QueuedReport[] = [];
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastReportAt = new Map<string, number>();
let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient | null {
  if (client) return client;
  try {
    const url =
      (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim() ||
      "https://hidden-poodle-567.convex.cloud";
    if (!url) return null;
    client = new ConvexHttpClient(url);
  } catch {
    return null;
  }
  return client;
}

/** Coarse device hint — UA string reduced to a "Chrome · Windows" label. */
function deviceHint(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "Browser";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua)
      ? "Mac"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/i.test(ua)
          ? "iOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "OS";
  return `${browser} · ${os}`;
}

/** Stable identity for an error, so repeats land in ONE group. */
function fingerprintHintOf(message: string): string {
  return message
    .replace(/\b[0-9a-f]{16,}\b/gi, "<id>")
    .replace(/\b\d{3,}\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

/**
 * Record a client error. Safe to call from anywhere, including error
 * boundaries and global handlers. Fire-and-forget.
 */
export function reportClientError(input: {
  error?: unknown;
  message?: string;
  module?: string;
  componentStack?: string;
}): void {
  try {
    const msg =
      input.message ??
      (input.error instanceof Error
        ? input.error.message
        : typeof input.error === "string"
          ? input.error
          : "Unknown client error");

    // Chunk-load failures are recovery noise handled by lazyRetry — never
    // report them (they would spam groups on every deploy).
    if (
      /failed to fetch dynamically imported module|importing a module script|error loading dynamically imported module/i.test(
        msg,
      )
    ) {
      return;
    }

    const hint = fingerprintHintOf(msg);
    const now = Date.now();
    const last = lastReportAt.get(hint) ?? 0;
    if (now - last < DEDUPE_MS) return;
    lastReportAt.set(hint, now);

    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({
      message: msg.slice(0, 300),
      module: input.module?.slice(0, 40),
      fingerprintHint: hint,
      componentStack: input.componentStack?.split("\n").slice(0, 6).join("\n"),
    });

    scheduleFlush();
  } catch {
    // never throw from monitoring
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, QUEUE_FLUSH_MS);
}

async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, queue.length);
  try {
    const c = getClient();
    if (!c) return;
    await Promise.all(
      batch.map(async (item) => {
        try {
          await c.mutation(api.monitorData.clientReportError, {
            message: item.message,
            module: item.module,
            fingerprintHint: item.fingerprintHint,
            componentStack: item.componentStack,
            route:
              typeof window !== "undefined"
                ? window.location.pathname.slice(0, 120)
                : undefined,
            userAgent: deviceHint(),
            at: Date.now(),
          });
        } catch {
          // Re-queue once on transport failure (bounded by MAX_QUEUE).
          if (queue.length < MAX_QUEUE) queue.push(item);
        }
      }),
    );
  } catch {
    // ignore — next flush retries
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

// Flush buffered reports when the connection returns / tab regains focus.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
}
