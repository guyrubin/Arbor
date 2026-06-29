/**
 * OPS-1 (WAF migration 2026-06-17): standalone per-request observability context.
 *
 * This is a self-contained sibling to the in-flight `app/src/server/requestContext.ts`.
 * It carries the request id, authenticated uid, AND the Cloud Trace fields through the
 * async call chain via AsyncLocalStorage, so:
 *
 *   - the request-completion log line,
 *   - the `ai.usage` line emitted deep inside an AI provider (which never sees `req`),
 *   - and any error line,
 *
 * all share ONE trace id and therefore correlate in a single Cloud Trace / Cloud Logging
 * view. The adversarial fix for OPS-1 requires that the trace id reaches the `ai.usage`
 * and error lines, not just the request line — putting the trace fields in the context
 * (rather than only on the request line) is what makes that propagation hold.
 *
 * Pure Node (`async_hooks`), no Express type dependency, so it is importable from both
 * server middleware and AI provider code without coupling either to the other.
 */
import { AsyncLocalStorage } from "async_hooks";

/**
 * The Cloud Logging structured-log fields that link a line to a trace. Keys are the
 * exact special keys Cloud Logging recognises; values are already fully-qualified.
 */
export type TraceFields = {
  "logging.googleapis.com/trace"?: string;
  "logging.googleapis.com/spanId"?: string;
  "logging.googleapis.com/trace_sampled"?: boolean;
};

export type RequestContext = {
  /** Opaque per-request id, echoed to the client as `X-Request-Id`. */
  requestId: string;
  /** Authenticated Firebase uid (opaque), or null pre-auth / unauthenticated. */
  uid: string | null;
  /** Cloud Trace correlation fields; empty object when tracing is disabled. */
  trace: TraceFields;
};

const storage = new AsyncLocalStorage<RequestContext>();

/** The active request context, if any (undefined outside a request, e.g. startup). */
export const currentRequestContext = (): RequestContext | undefined => storage.getStore();

/** Run `fn` inside a fresh request context. */
export const runWithRequestContext = <T>(ctx: RequestContext, fn: () => T): T =>
  storage.run(ctx, fn);

/**
 * Mutate the active context's uid in place (call AFTER auth resolves). No-op if there is
 * no active context. Returns true if a context was present and updated.
 */
export const bindUid = (uid: string | null): boolean => {
  const ctx = storage.getStore();
  if (!ctx) return false;
  ctx.uid = uid;
  return true;
};

/** Convenience: build a context object with an empty trace by default. */
export const makeRequestContext = (
  requestId: string,
  uid: string | null = null,
  trace: TraceFields = {}
): RequestContext => ({ requestId, uid, trace });
