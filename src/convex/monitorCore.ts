/**
 * ForgeX monitoring core — PURE functions only (no Convex imports).
 *
 * This is the brain of the platform monitoring / observability system:
 *   - severity classification (CRITICAL / HIGH / MEDIUM / LOW)
 *   - privacy redaction (secrets, tokens, emails, long private content)
 *   - error fingerprinting (grouping repeats into ONE incident)
 *   - correlation IDs (FX-YYYYMMDD-XXXXX)
 *   - incident detection thresholds
 *   - service registry for the System Health dashboard
 *
 * Keeping it pure means every rule is unit-testable and the Convex layer
 * (monitor.ts) stays a thin persistence wrapper.
 *
 * PRIVACY CONTRACT (enforced here, in one place):
 *   - passwords / tokens / API keys / authorization headers are redacted
 *   - message bodies and AI conversations are NEVER stored — only metadata
 *   - user content is truncated to short previews; IDs are kept instead
 */

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** Modules whose failure hits the platform's core promise. */
const CORE_MODULES = new Set([
  "auth",
  "database",
  "admin-security",
  "email",
  "storage",
  "system",
]);

/** Modules that are major features but not platform-wide. */
const MAJOR_MODULES = new Set([
  "assignments",
  "ai-chat",
  "ai-quizgen",
  "ai-voice",
  "enrollment",
  "uploads",
  "payments",
  "certificates",
]);

/** Error text that always escalates to CRITICAL regardless of module. */
const CRITICAL_PATTERNS: RegExp[] = [
  /database/i,
  /internal server error/i,
  /out of memory/i,
  /data loss/i,
  /security/i,
  /unauthorized admin/i,
  /owner account/i,
  /session hijack/i,
  /brute.?force/i,
];

/**
 * Classify an error into a severity. `explicit` (caller's own assessment)
 * wins when it is at least as severe as the automatic classification —
 * callers may escalate but never silently downgrade below the automatic floor
 * for core modules.
 */
export function classifySeverity(opts: {
  module: string;
  message?: string;
  explicit?: Severity;
  status?: number;
}): Severity {
  const { module, message = "", explicit, status } = opts;
  const auto = autoSeverity(module, message, status);
  if (!explicit) return auto;
  return SEVERITY_RANK[explicit] >= SEVERITY_RANK[auto] ? explicit : auto;
}

function autoSeverity(module: string, message: string, status?: number): Severity {
  if (CRITICAL_PATTERNS.some((re) => re.test(message))) return "critical";
  if (CORE_MODULES.has(module)) {
    // Auth failures (wrong password etc.) are high, not critical; but a
    // database/system-level failure in a core module is critical.
    if (/rate limit|too many|invalid|incorrect|not found|expired/i.test(message)) {
      return "high";
    }
    return "critical";
  }
  if (MAJOR_MODULES.has(module)) return "high";
  if (status && status >= 500) return "high";
  if (module.startsWith("admin")) return "high";
  return "medium";
}

// ---------------------------------------------------------------------------
// Privacy redaction
// ---------------------------------------------------------------------------

/** Keys whose values must NEVER be persisted, in any casing/spacing. */
const SENSITIVE_KEY_RE =
  /pass(word)?|secret|token|api[-_ ]?key|authorization|auth[-_ ]?header|cookie|session[-_ ]?id|otp|credential|private[-_ ]?key|bearer/i;

/** Long random-looking values (jwt-ish / api-key-ish) → redact. */
const LOOKS_LIKE_SECRET_RE =
  /^(ey[A-Za-z0-9_-]{10,}\.[-A-Za-z0-9_+/=.]{10,}|sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|fb_email_[A-Za-z0-9]+|fx-internal-[A-Za-z0-9-]+)$/;

/** Short content preview cap — monitoring stores metadata, not content. */
export const PREVIEW_MAX = 160;

/**
 * Redact sensitive data from an arbitrary value before persisting it.
 * - strings that look like secrets are replaced with `[redacted]`
 * - objects have sensitive keys stripped and content truncated
 * - arrays are capped (never store bulk user content in logs)
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (LOOKS_LIKE_SECRET_RE.test(value.trim())) return "[redacted]";
    // Mask embedded secrets of the shapes above inside longer strings.
    return value
      .replace(/(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|fb_email_[A-Za-z0-9]{6,})/g, "[redacted]")
      .slice(0, PREVIEW_MAX * 2);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 3) return "[deep]";
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return "[unserializable]";
}

/** Short, safe preview of user-facing text (errors, subjects — not bodies). */
export function preview(text: string | undefined | null, max = PREVIEW_MAX): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

// ---------------------------------------------------------------------------
// Fingerprinting — one incident per underlying problem
// ---------------------------------------------------------------------------

/**
 * Normalize a message so variable parts (ids, numbers, emails, request ids)
 * do not split one underlying problem into thousands of incidents.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/\b[0-9a-f]{16,}\b/gi, "<id>") // hex ids / tokens
    .replace(/\b\d{3,}\b/g, "<num>") // big numbers (timestamps, counts)
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi, "<email>")
    .replace(/\b[jk][a-z0-9]{18,}\b/gi, "<id>") // convex-style ids
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

/** Stable fingerprint for grouping: module + action + normalized message. */
export function fingerprintOf(opts: {
  module: string;
  action?: string;
  message?: string;
  kind?: "error" | "security";
}): string {
  const parts = [
    opts.kind === "security" ? "sec" : "err",
    opts.module,
    opts.action ?? "-",
    normalizeMessage(opts.message ?? ""),
  ];
  return parts.join("|");
}

// ---------------------------------------------------------------------------
// Correlation IDs
// ---------------------------------------------------------------------------

/** FX-20260921-8A92F style request/correlation id. */
export function newRequestId(now = Date.now()): string {
  const d = new Date(now);
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `FX-${ymd}-${rand}`;
}

// ---------------------------------------------------------------------------
// Service registry — what the System Health dashboard shows
// ---------------------------------------------------------------------------

export type ServiceId =
  | "web"
  | "database"
  | "auth"
  | "storage"
  | "uploads"
  | "ai-chat"
  | "ai-quizgen"
  | "ai-voice"
  | "email"
  | "assignments"
  | "enrollment"
  | "registration"
  | "admin"
  | "background-jobs";

export interface ServiceDef {
  id: ServiceId;
  label: string;
  /** Where its status is derived from. */
  source:
    | "db-heartbeat" // can we query the database at all
    | "auth-events" // auth event counters
    | "provider-health" // providerHealth / externalApiLogs rows
    | "feature-counters" // monitorEvents counters for the feature
    | "email-queue"; // emailLogs queue state
  /** Providers (externalApiLogs / providerHealth rows) mapped to this service. */
  providers?: string[];
}

/**
 * The registry of services that ACTUALLY exist in ForgeX Academy. A service
 * is only shown "operational" when its status can be determined from real
 * signals; with no data yet it reads "unknown", never "operational".
 */
export const SERVICE_REGISTRY: ServiceDef[] = [
  { id: "database", label: "Database", source: "db-heartbeat" },
  { id: "auth", label: "Authentication", source: "auth-events" },
  { id: "web", label: "Web application", source: "feature-counters" },
  { id: "registration", label: "User registration", source: "auth-events" },
  { id: "enrollment", label: "Course enrollment", source: "feature-counters" },
  { id: "assignments", label: "Assignment submission", source: "feature-counters" },
  { id: "uploads", label: "File uploads / storage", source: "feature-counters" },
  { id: "storage", label: "File storage", source: "provider-health", providers: ["cloudinary"] },
  { id: "ai-chat", label: "AI chat", source: "provider-health", providers: ["gemini", "groq", "openai", "novita", "openrouter", "cerebras", "together", "deepseek", "mistral", "sambanova", "platform"] },
  { id: "ai-quizgen", label: "AI quiz generation", source: "provider-health", providers: ["gemini", "groq", "openai", "novita", "platform"] },
  { id: "ai-voice", label: "Voice messaging", source: "provider-health", providers: ["groq-stt", "openai-tts"] },
  { id: "email", label: "Email services", source: "email-queue" },
  { id: "admin", label: "Admin dashboard", source: "auth-events" },
  { id: "background-jobs", label: "Background jobs", source: "feature-counters" },
];

// ---------------------------------------------------------------------------
// Health computation from real counters
// ---------------------------------------------------------------------------

export type HealthStatus = "operational" | "degraded" | "down" | "unknown";

export interface ServiceCounters {
  /** Successful operations in the evaluation window (0 = none observed). */
  ok: number;
  /** Failed operations in the window. */
  fail: number;
  /** Mean latency ms where measurable. */
  latencyMs?: number;
  /** Most recent observed activity of any kind. */
  lastActivityAt?: number;
  /** Whether we have ANY signal for this service. */
  hasSignal: boolean;
}

/**
 * Derive a status from real counters. Deliberately conservative: no signal →
 * "unknown" (never "operational"); ≥20% failures → "degraded"; all-failure
 * with a meaningful sample → "down".
 */
export function deriveHealth(c: ServiceCounters): HealthStatus {
  if (!c.hasSignal) return "unknown";
  const total = c.ok + c.fail;
  if (total === 0) return "unknown";
  if (c.ok === 0) return total >= 3 ? "down" : "degraded";
  const failRate = c.fail / total;
  if (failRate >= 0.5 && c.fail >= 3) return "down";
  if (failRate >= 0.1) return "degraded";
  return "operational";
}

// ---------------------------------------------------------------------------
// Incident auto-detection thresholds
// ---------------------------------------------------------------------------

export interface IncidentRule {
  /** Fingerprint prefix (module|action) this rule watches; "" matches all. */
  module: string;
  /** Occurrences within the window that trigger an incident. */
  occurrences: number;
  /** Window in ms. */
  windowMs: number;
  /** Minimum severity for the rule to apply. */
  minSeverity: Severity;
  /** Title template; {module} and {action} are substituted. */
  title: string;
}

/**
 * Threshold table for automatic incidents. Reviewed against the real
 * feature modules of the platform. The generic rules below catch anything
 * not matched by a module-specific rule.
 */
export const INCIDENT_RULES: IncidentRule[] = [
  { module: "database", occurrences: 2, windowMs: 5 * 60_000, minSeverity: "critical", title: "Incident: Database failures ({action})" },
  { module: "auth", occurrences: 10, windowMs: 5 * 60_000, minSeverity: "high", title: "Incident: Authentication failures ({action})" },
  { module: "assignments", occurrences: 5, windowMs: 5 * 60_000, minSeverity: "high", title: "Incident: Repeated assignment submission failure" },
  { module: "ai-chat", occurrences: 8, windowMs: 5 * 60_000, minSeverity: "high", title: "Incident: AI service repeatedly failing" },
  { module: "ai-voice", occurrences: 5, windowMs: 10 * 60_000, minSeverity: "high", title: "Incident: Voice messaging failures" },
  { module: "uploads", occurrences: 5, windowMs: 10 * 60_000, minSeverity: "high", title: "Incident: File upload failures" },
  { module: "enrollment", occurrences: 5, windowMs: 10 * 60_000, minSeverity: "high", title: "Incident: Course enrollment failures" },
  { module: "email", occurrences: 10, windowMs: 15 * 60_000, minSeverity: "medium", title: "Incident: Email delivery failing" },
  { module: "admin-security", occurrences: 3, windowMs: 5 * 60_000, minSeverity: "high", title: "Incident: Admin security events" },
  { module: "storage", occurrences: 5, windowMs: 10 * 60_000, minSeverity: "high", title: "Incident: Storage failures" },
  { module: "background-jobs", occurrences: 8, windowMs: 15 * 60_000, minSeverity: "medium", title: "Incident: Background jobs failing" },
  // Generic fallback for any other module.
  { module: "*", occurrences: 10, windowMs: 10 * 60_000, minSeverity: "medium", title: "Incident: Repeated {module} errors" },
];

/** The rule that fires for a given fingerprint (module-specific beats generic). */
export function ruleFor(module: string, severity: Severity): IncidentRule | null {
  const applicable = INCIDENT_RULES.filter(
    (r) => (r.module === "*" || r.module === module) && SEVERITY_RANK[severity] >= SEVERITY_RANK[r.minSeverity],
  );
  // Prefer the specific rule when both a specific and generic rule apply.
  const specific = applicable.find((r) => r.module !== "*");
  return specific ?? applicable[0] ?? null;
}

/** Should an open incident with these counts already exist (dedupe)? */
export function incidentIsFresh(lastSeenAt: number, now: number): boolean {
  // An incident that has not been seen for 30 minutes is considered over;
  // a new occurrence after that opens a new incident.
  return now - lastSeenAt < 30 * 60_000;
}

// ---------------------------------------------------------------------------
// Security incident thresholds (lower than error rules — attacks escalate fast)
// ---------------------------------------------------------------------------

export interface SecurityRule {
  kind: SecurityKind;
  occurrences: number;
  windowMs: number;
  minSeverity: Severity;
  title: string;
}

export const SECURITY_INCIDENT_RULES: SecurityRule[] = [
  { kind: "admin-gate-failure", occurrences: 5, windowMs: 15 * 60_000, minSeverity: "high", title: "Incident: Repeated admin gate failures (possible attack)" },
  { kind: "failed-login", occurrences: 20, windowMs: 15 * 60_000, minSeverity: "high", title: "Incident: Failed login spike" },
  { kind: "authz-failure", occurrences: 10, windowMs: 15 * 60_000, minSeverity: "high", title: "Incident: Repeated authorization failures" },
  { kind: "rate-limit", occurrences: 15, windowMs: 15 * 60_000, minSeverity: "medium", title: "Incident: Rate limit violations spike" },
  { kind: "suspicious", occurrences: 10, windowMs: 15 * 60_000, minSeverity: "medium", title: "Incident: Suspicious activity detected" },
];

export function securityRuleFor(kind: SecurityKind): SecurityRule | null {
  return SECURITY_INCIDENT_RULES.find((r) => r.kind === kind) ?? null;
}

// ---------------------------------------------------------------------------
// Alert rules — defaults live here (pure) so backend sweep + admin UI share
// the exact same table. Missing monitorAlertRules row = these defaults.
// ---------------------------------------------------------------------------

export interface AlertRuleDef {
  key: string;
  label: string;
  minSeverity: Severity;
  cooldownMinutes: number;
  description: string;
}

export const DEFAULT_ALERT_RULES: AlertRuleDef[] = [
  { key: "incident:database", label: "Database incidents", minSeverity: "critical", cooldownMinutes: 30, description: "Fires when a database incident is auto-detected." },
  { key: "incident:auth", label: "Authentication incidents", minSeverity: "high", cooldownMinutes: 30, description: "Fires when authentication failures cross the incident threshold." },
  { key: "incident:assignments", label: "Assignment submission incidents", minSeverity: "high", cooldownMinutes: 60, description: "Fires on repeated assignment submission failures." },
  { key: "incident:ai-chat", label: "AI service incidents", minSeverity: "high", cooldownMinutes: 60, description: "Fires when the AI services repeatedly fail." },
  { key: "incident:ai-voice", label: "Voice messaging incidents", minSeverity: "high", cooldownMinutes: 60, description: "Fires on voice transcription/synthesis failure spikes." },
  { key: "incident:uploads", label: "File upload incidents", minSeverity: "high", cooldownMinutes: 60, description: "Fires on upload failure spikes." },
  { key: "incident:enrollment", label: "Enrollment incidents", minSeverity: "high", cooldownMinutes: 60, description: "Fires on course enrollment failure spikes." },
  { key: "incident:email", label: "Email delivery incidents", minSeverity: "medium", cooldownMinutes: 60, description: "Fires when email delivery is failing." },
  { key: "incident:*", label: "All other incidents", minSeverity: "high", cooldownMinutes: 60, description: "Any other auto-detected incident." },
  { key: "security:admin-gate-failure", label: "Admin gate attack", minSeverity: "high", cooldownMinutes: 30, description: "Repeated failed attempts on the admin access gate." },
  { key: "security:failed-login", label: "Failed login spike", minSeverity: "high", cooldownMinutes: 30, description: "Unusual volume of failed sign-ins." },
  { key: "security:authz-failure", label: "Authorization failures", minSeverity: "high", cooldownMinutes: 30, description: "Repeated attempts to reach protected resources." },
  { key: "security:rate-limit", label: "Rate limit violations", minSeverity: "medium", cooldownMinutes: 60, description: "Spikes in rate-limit rejections." },
  { key: "security:suspicious", label: "Suspicious activity", minSeverity: "medium", cooldownMinutes: 60, description: "Other security-relevant anomalies." },
];

/** Resolve the alert rule for an incident module or security kind. */
export function alertRuleKeyFor(opts: { kind?: "error" | "security"; module: string; securityKind?: SecurityKind }): string {
  if (opts.kind === "security" && opts.securityKind) return `security:${opts.securityKind}`;
  return `incident:${opts.module}`;
}

// ---------------------------------------------------------------------------
// Security event classification
// ---------------------------------------------------------------------------

export type SecurityKind =
  | "failed-login"
  | "admin-gate-failure"
  | "rate-limit"
  | "authz-failure"
  | "suspicious";

/** Map an event to a security kind (used for the Security page grouping). */
export function securityKind(action: string): SecurityKind {
  const a = action.toLowerCase();
  if (a.includes("admin-password") || a.includes("admin-gate")) return "admin-gate-failure";
  if (a.includes("login") || a.includes("signin") || a.includes("sign-in")) return "failed-login";
  if (a.includes("rate") || a.includes("limit") || a.includes("spam")) return "rate-limit";
  if (a.includes("unauthorized") || a.includes("forbidden") || a.includes("denied") || a.includes("admin-access")) return "authz-failure";
  return "suspicious";
}
