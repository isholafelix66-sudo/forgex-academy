/**
 * Admin security crypto — V8-runtime safe helpers (no node:crypto).
 *
 * Runs inside mutations where `crypto.getRandomValues` and `crypto.subtle`
 * are available. Used by the Owner/admin password gate and the OTP-protected
 * password-change flow.
 *
 * PBKDF2-SHA256 with 100k iterations — strong for a low-volume admin gate,
 * and verified with a timing-safe comparison.
 */

const PBKDF2_ITERATIONS = 100_000;
const HASH_BYTES = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = new Uint8Array(
    (saltHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    HASH_BYTES * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Produce `salt:hash` for a password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltHex = bytesToHex(salt);
  const hash = await pbkdf2(password, saltHex);
  return `${saltHex}:${hash}`;
}

/** Verify a password against `salt:hash`. Unknown formats fail safely. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, expected] = stored.split(":");
  if (!saltHex || !expected) return false;
  const actual = await pbkdf2(password, saltHex);
  return timingSafeEqualHex(actual, expected);
}

/** Cryptographically random numeric OTP (default 6 digits). */
export function generateOtp(length = 6): string {
  const digits = new Uint32Array(length);
  crypto.getRandomValues(digits);
  // Rejection-free mapping with a tiny modulo bias — acceptable for a 6-digit
  // code with a 10-minute TTL and attempt limits, but still uniform enough.
  return Array.from(digits, (d) => String(d % 10)).join("");
}

/** Cryptographically random id for tracking session/device labels. */
export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}
