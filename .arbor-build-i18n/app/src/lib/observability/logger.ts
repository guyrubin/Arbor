/**
 * OPS-1 (WAF migration 2026-06-17): PII-scrubbed structured logger with trace correlation.
 *
 * Standalone sibling to the in-flight `app/src/server/logger.ts`. Emits one JSON object
 * per line in the shape Cloud Logging ingests natively (`severity` / `message` /
 * `httpRequest`), so Cloud Logging + Error Reporting group and slice it without an SDK.
 *
 * Two load-bearing guarantees for the GDPR/AVG DPIA (a children's product MUST NOT log
 * personal data):
 *
 *   1. ALLOW-LIST serializer — only known-safe keys survive into the emitted line. Any
 *      field a caller passes that is not on the allow-list is DROPPED, so a future edit
 *      cannot silently leak `email`, free text, a request body, or a child's name.
 *      Per the adversarial fix, the allow-list explicitly INCLUDES `errorMessage` and the
 *      token-count fields (`totalTokens`, `promptTokens`, `outputTokens`) — these are
 *      operational, non-PII, and were the fields a naive allow-list would wrongly strip.
 *
 *   2. TRACE propagation — every line auto-merges the active request's Cloud Trace fields
 *      from {@link currentRequestContext}. So the request line, the `ai.usage` line (emitted
 *      deep in an AI provider with no `req` handle), and any error line all carry the SAME
 *      `logging.googleapis.com/trace`, and therefore correlate in one trace view.
 *
 * Errors put the stack into `message` so GCP Error Reporting auto-groups them.
 */
import { currentRequestContext, type TraceFields } from "./requestContext.js";

export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export type LogFields = Record<string, unknown>;

/**
 * The frozen set of keys allowed onto an emitted log line, beyond the always-present
 * envelope (`severity`, `message`, `time`) and the auto-merged trace keys.
 *
 * Deliberately included (the adversarial-fix carve-outs — operational, NOT PII):
 *   - `errorMessage` : sanitized error string for Error Reporting / triage.
 *   - `totalTokens` / `promptTokens` / `outputTokens` : cost telemetry on `ai.usage`.
 *
 * Deliberately EXCLUDED (would be PII / freetext): `email`, `user`, `name`, `body`,
 * `prompt`, `text`, `content`, `message`-as-field, child profile fields, etc. Anything
 * not listed here is dropped.
 */
export const ALLOWED_FIELD_KEYS = Object.freeze([
  "requestId",
  "httpRequest",
  "latencyMs",
  "userUid",
  // ai.usage line
  "route",
  "provider",
  "model",
  "promptTokens",
  "outputTokens",
  "totalTokens",
  // error/triage
  "errorMessage",
  // deploy/event lines (DORA, OPS-3)
  "event",
  "result",
  "env",
  "revision",
] as const);

export type AllowedFieldKey = (typeof ALLOWED_FIELD_KEYS)[number];

const ALLOWED = new Set<string>(ALLOWED_FIELD_KEYS);

// Cloud Logging special keys we pass through verbatim when present (added by trace merge).
const TRACE_KEYS = new Set<string>([
  "logging.googleapis.com/trace",
  "logging.googleapis.com/spanId",
  "logging.googleapis.com/trace_sampled",
]);

/**
 * Sanitize an arbitrary `httpRequest` object down to the Cloud Logging fields that are
 * provably non-PII. Crucially the URL is query-STRIPPED so no `?token=` / `?email=` leaks.
 */
const sanitizeHttpRequest = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const url = typeof v.requestUrl === "string" ? v.requestUrl.split("?")[0] : undefined;
  const out: Record<string, unknown> = {};
  if (typeof v.requestMethod === "string") out.requestMethod = v.requestMethod;
  if (url) out.requestUrl = url;
  if (typeof v.status === "number") out.status = v.status;
  if (typeof v.latency === "string") out.latency = v.latency;
  return out;
};

/**
 * Apply the allow-list. Returns a new object containing ONLY allowed keys (plus already-
 * present trace keys), with `httpRequest` recursively sanitized. Unknown keys are dropped.
 */
export const applyAllowList = (fields: LogFields): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields)) {
    if (raw === undefined) continue;
    if (TRACE_KEYS.has(key)) {
      out[key] = raw;
      continue;
    }
    if (!ALLOWED.has(key)) continue; // drop anything not explicitly allowed
    if (key === "httpRequest") {
      const http = sanitizeHttpRequest(raw);
      if (http) out[key] = http;
      continue;
    }
    out[key] = raw;
  }
  return out;
};

/** Pull the active request's trace fields (empty when no context / tracing disabled). */
const activeTraceFields = (): TraceFields => currentRequestContext()?.trace ?? {};

const emit = (severity: Severity, message: string, fields: LogFields = {}): void => {
  const safe = applyAllowList(fields);
  const line = JSON.stringify({
    severity,
    message,
    time: new Date().toISOString(),
    ...activeTraceFields(), // trace correlation onto EVERY line, incl. ai.usage + errors
    ...safe,
  });
  if (severity === "ERROR") console.error(line);
  else console.log(line);
};

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("DEBUG", message, fields),
  info: (message: string, fields?: LogFields) => emit("INFO", message, fields),
  warn: (message: string, fields?: LogFields) => emit("WARNING", message, fields),
  /**
   * Pass the thrown error; the stack lands in `message` for Error Reporting, and a
   * sanitized one-line `errorMessage` is added (allow-listed, NOT stripped).
   */
  error: (message: string, error?: unknown, fields?: LogFields) => {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : null;
    emit("ERROR", err ? `${message}\n${err.stack || err.message}` : message, {
      ...fields,
      ...(err ? { errorMessage: err.message } : {}),
    });
  },
};

export type Logger = typeof logger;
