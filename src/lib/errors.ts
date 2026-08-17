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
 *   ConvexError: …
 *
 * This maps those to plain messages while letting the app's own friendly
 * errors (upload limits, rate limits, "You must be signed in", …) pass
 * through untouched.
 */

const VALIDATION_RE = /ArgumentValidationError|Value does not match validator/i;
const STORAGE_FIELD_RE = /Path:\s*\.([A-Za-z0-9_]*[Ss]torage[A-Za-z0-9_]*)/;
const REQUEST_ID_RE = /\[Request ID: [^\]]+\]/;
const PREFIX_RE = /^(?:ConvexError|Server Error|Error)\s*:\s*/i;
const FUNCTION_NOT_FOUND_RE =
  /not a valid path|FunctionNotFound|function .*not found|does not exist|Unknown function/i;
const LEAK_RE = /convex|convex\.cloud|ArgumentValidation|Request ID|validator/i;

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
  const message = raw.trim();
  if (!message) return fallback;

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

  // "[Request ID: …] Server Error" with no other detail — generic hiccup.
  if (REQUEST_ID_RE.test(message)) {
    const stripped = message
      .replace(REQUEST_ID_RE, "")
      .replace(PREFIX_RE, "")
      .trim();
    if (!stripped || /^server error$/i.test(stripped)) {
      return "The server hiccuped — please try again in a moment.";
    }
  }

  // Strip common prefixes, then hide anything that still looks technical.
  const clean = message.replace(PREFIX_RE, "").trim();
  if (!clean) return fallback;
  if (
    clean.startsWith("{") ||
    clean.startsWith("[") ||
    LEAK_RE.test(clean)
  ) {
    return fallback;
  }
  return clean;
}
