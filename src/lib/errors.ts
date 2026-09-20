/**
 * Turn a raw backend error into a clean, user-facing message.
 *
 * Backend client errors are packed with internals that must never appear in
 * front of a user:
 *
 *   ArgumentValidationError: Value does not match validator.
 *   Path: .imageStorageId
 *   Value: "kb9d…"
 *   Validator: v.optional(v.id("_storage"))
 *
 *   Error: [Request ID: 3f2a…] Server Error
 *
 *   [CONVEX M(admin:setUserRole)] [Request ID: …] Server Error
 *   Uncaught Error: The Owner account is protected.
 *       at handler (../convex/admin.ts:341)
 *
 * This unwraps those envelopes (so the app's own friendly messages survive)
 * and replaces anything still looking technical with a plain fallback.
 */

const VALIDATION_RE = /ArgumentValidationError|Value does not match validator/i;
const STORAGE_FIELD_RE = /Path:\s*\.([A-Za-z0-9_]*[Ss]torage[A-Za-z0-9_]*)/;
const REQUEST_ID_RE = /\[Request ID: [^\]]+\]/;
const PREFIX_RE = /^(?:ConvexError|Server Error|Error)\s*:\s*/i;
const FUNCTION_NOT_FOUND_RE =
  /not a valid path|FunctionNotFound|function .*not found|does not exist|Unknown function/i;
const LEAK_RE = /convex|convex\.cloud|ArgumentValidation|Request ID|validator/i;

/** True when the message is wrapped in the backend's own error envelope. */
function hasBackendEnvelope(message: string): boolean {
  return (
    /\[CONVEX /.test(message) ||
    /\[Request ID:/.test(message) ||
    /\bServer Error\b/i.test(message) ||
    /\bUncaught Error\b/i.test(message)
  );
}

/**
 * Strip the markers Convex adds around a function's thrown error —
 * `[CONVEX M(path)]`, `[Request ID: …]`, `Server Error`, `Uncaught Error:`
 * and the stack trace — leaving the message the app actually threw.
 */
function unwrapBackendEnvelope(message: string): string {
  return message
    .replace(/\[CONVEX [^\]]*\]/g, " ")
    .replace(/\[Request ID: [^\]]*\]/g, " ")
    .replace(/\b(?:Server Error|Uncaught Error)\b:?/gi, " ")
    .replace(/^\s*at\s.+(?:\(.+\))?$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the error is a backend argument-validation rejection. */
export function isValidationError(err: unknown): boolean {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return VALIDATION_RE.test(raw);
}

/**
 * True when the backend rejected the call in a way worth retrying with
 * reduced arguments (unknown-field validation, missing functions, generic
 * server errors). App-authored friendly errors — rate limits, auth
 * failures, size limits, offline — return false so they surface immediately.
 */
export function isBackendRejection(err: unknown): boolean {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return false;
  return (
    VALIDATION_RE.test(raw) ||
    REQUEST_ID_RE.test(raw) ||
    /Server Error/i.test(raw) ||
    FUNCTION_NOT_FOUND_RE.test(raw)
  );
}

/**
 * Map an unknown error to a presentable message. App-authored friendly
 * messages are returned as-is; backend internals are replaced with clean
 * fallbacks. Never call this with a hardcoded value — pass the real error so
 * genuine details (size limits, permissions) survive.
 */
export function friendlyError(
  err: unknown,
  fallback = "Something went wrong — please try again.",
): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw.trim()) return fallback;

  // Unwrap the backend's envelope first so a genuine message (permissions,
  // rate limits, OTP errors) is what gets inspected — never the wrapper.
  const wrapped = hasBackendEnvelope(raw);
  const message = wrapped ? unwrapBackendEnvelope(raw) : raw.trim();
  if (!message) {
    return wrapped
      ? "The server hiccuped — please try again in a moment."
      : fallback;
  }

  // Validation rejection — most often the frontend sending a field the
  // deployed backend doesn't accept yet (e.g. an uploaded-file id).
  if (VALIDATION_RE.test(message)) {
    const storageField = message.match(STORAGE_FIELD_RE);
    if (storageField) {
      return "The uploaded file couldn't be attached — please upload it again.";
    }
    return "One of the fields you entered wasn't accepted — please check the form and try again.";
  }

  // The backend is missing a function the frontend expects (stale deploy).
  if (FUNCTION_NOT_FOUND_RE.test(message)) {
    return "This feature needs a quick backend update — please redeploy the app's backend, then try again.";
  }

  // "Server Error" with no other detail — generic hiccup.
  if (/^server error:?$/i.test(message)) {
    return "The server hiccuped — please try again in a moment.";
  }

  // Strip common prefixes, then hide anything that still looks technical.
  const clean = message.replace(PREFIX_RE, "").trim();
  if (!clean) return fallback;
  if (clean.startsWith("{") || clean.startsWith("[") || LEAK_RE.test(clean)) {
    return fallback;
  }
  return clean;
}
