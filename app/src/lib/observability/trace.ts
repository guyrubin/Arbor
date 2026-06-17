/**
 * OPS-1 (WAF migration 2026-06-17): Cloud Trace propagation.
 *
 * Parses the inbound trace headers Cloud Run / GCP load balancers attach and returns the
 * special Cloud Logging fields that link a log line to a trace:
 *
 *   { "logging.googleapis.com/trace":  "projects/<pid>/traces/<traceId>",
 *     "logging.googleapis.com/spanId": "<spanId>",
 *     "logging.googleapis.com/trace_sampled": <bool> }
 *
 * Two header formats are supported:
 *   - GCP legacy `X-Cloud-Trace-Context`:  TRACE_ID/SPAN_ID;o=TRACE_TRUE
 *     (SPAN_ID is decimal; o=1 means sampled).
 *   - W3C `traceparent`:  VERSION-TRACE_ID-PARENT_ID-FLAGS
 *     (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01).
 *
 * NO SDK, NO network — this is pure header parsing, so it adds zero runtime cost and no
 * new dependency. When `projectId` is falsy (i.e. `GCP_PROJECT_ID` is unset — local dev
 * or tests), `traceFieldsFromHeaders` returns an EMPTY object: tracing no-ops cleanly and
 * the qualified `projects/<pid>/...` resource name is never emitted half-formed.
 */
import type { TraceFields } from "./requestContext.js";

/** Minimal header bag: Node lowercases header names, values are string | string[] | undefined. */
export type HeaderBag = Record<string, string | string[] | undefined>;

const firstHeader = (headers: HeaderBag, name: string): string | undefined => {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
};

// A valid trace id is 1..32 hex chars (W3C is exactly 32; GCP legacy is also hex/uuid-ish).
const HEX = /^[0-9a-fA-F]+$/;
const isHexId = (s: string, max = 32): boolean => s.length > 0 && s.length <= max && HEX.test(s);

/** Resolve the GCP project id from an explicit arg, falling back to `GCP_PROJECT_ID`. */
export const resolveProjectId = (explicit?: string): string | undefined =>
  (explicit && explicit.trim()) || process.env.GCP_PROJECT_ID || undefined;

/** True when tracing should emit fields (i.e. a project id is configured). */
export const isTracingEnabled = (projectId?: string): boolean => !!resolveProjectId(projectId);

/** Parse `X-Cloud-Trace-Context: TRACE/SPAN;o=1`. Returns null if unparseable. */
const parseCloudTraceContext = (
  raw: string
): { traceId: string; spanId?: string; sampled?: boolean } | null => {
  // TRACE_ID is before the first "/"; SPAN_ID before ";"; o= flag after ";".
  const [tracePart, rest] = raw.split("/", 2);
  const traceId = (tracePart || "").trim();
  if (!isHexId(traceId)) return null;
  let spanId: string | undefined;
  let sampled: boolean | undefined;
  if (rest) {
    const [spanRaw, optRaw] = rest.split(";", 2);
    const span = (spanRaw || "").trim();
    // GCP span id is decimal; keep it as-is if non-empty and numeric.
    if (span && /^[0-9]+$/.test(span)) spanId = span;
    if (optRaw) {
      const m = /o=([01])/.exec(optRaw);
      if (m) sampled = m[1] === "1";
    }
  }
  return { traceId, spanId, sampled };
};

/** Parse W3C `traceparent: VERSION-TRACE-PARENT-FLAGS`. Returns null if unparseable. */
const parseTraceparent = (
  raw: string
): { traceId: string; spanId?: string; sampled?: boolean } | null => {
  const parts = raw.trim().split("-");
  if (parts.length < 4) return null;
  const [, traceId, parentId, flags] = parts;
  // W3C: trace id 32 hex (not all-zero), parent id 16 hex (not all-zero).
  if (!isHexId(traceId, 32) || /^0+$/.test(traceId)) return null;
  const spanId = isHexId(parentId, 16) && !/^0+$/.test(parentId) ? parentId : undefined;
  const sampled = /^[0-9a-fA-F]{2}$/.test(flags) ? (parseInt(flags, 16) & 0x01) === 0x01 : undefined;
  return { traceId, spanId, sampled };
};

/**
 * Build the Cloud Logging trace fields from request headers.
 *
 * @param headers  inbound request headers (case-insensitive lookup).
 * @param projectId GCP project id; if falsy, falls back to `process.env.GCP_PROJECT_ID`.
 * @returns the trace fields, or an EMPTY object when tracing is disabled or no usable
 *          header is present (so the caller can `{ ...fields, ...traceFields }` safely).
 */
export const traceFieldsFromHeaders = (
  headers: HeaderBag | undefined,
  projectId?: string
): TraceFields => {
  const pid = resolveProjectId(projectId);
  if (!pid || !headers) return {};

  const cloud = firstHeader(headers, "x-cloud-trace-context");
  const w3c = firstHeader(headers, "traceparent");

  const parsed =
    (cloud ? parseCloudTraceContext(cloud) : null) ?? (w3c ? parseTraceparent(w3c) : null);
  if (!parsed) return {};

  const fields: TraceFields = {
    "logging.googleapis.com/trace": `projects/${pid}/traces/${parsed.traceId}`,
  };
  if (parsed.spanId) fields["logging.googleapis.com/spanId"] = parsed.spanId;
  if (parsed.sampled !== undefined) fields["logging.googleapis.com/trace_sampled"] = parsed.sampled;
  return fields;
};
