import { useCallback, useRef, useState } from "react";
import { track as defaultTrack } from "../lib/analytics";
import { PaywallError } from "../lib/api";

/**
 * M4 — operational hardening for the generative features. Every "press a button,
 * call the model, wait" flow needs the same three things so it can never
 * dead-end: a real loading flag, a friendly error string (not a stuck/blank
 * state), and start/success/error analytics so we can see where generation
 * fails in the wild. This hook factors that out of every call site.
 *
 * Event names are derived from `name`: `<name>_started`, `<name>_succeeded`,
 * `<name>_failed`. The `_failed` event carries a coarse `reason` — one value of
 * the FAILURE_REASONS enum (B-MEAS-05), never the error text — so dashboards
 * can group failures without leaking provider prose or PII.
 */

export type TrackFn = (event: string, props?: Record<string, unknown>) => void;

/**
 * B-MEAS-05 — the closed set a `_failed` event's `reason` may take. Raw
 * provider text ("Your prepayment credits are depleted…") stays in the server
 * logs; analytics gets the category only.
 */
export const FAILURE_REASONS = [
  "provider_credit",
  "rate_limited",
  "quota_exhausted",
  "timeout",
  "offline",
  "aborted",
  "server_error",
  "other",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

/** Coarse failure category for analytics — an enum value, never free text. */
export function failureReason(err: unknown): FailureReason {
  const e = (err && typeof err === "object" ? err : {}) as { name?: unknown; status?: unknown; message?: unknown };
  const msg = (err instanceof Error ? err.message : typeof err === "string" ? err : typeof e.message === "string" ? e.message : "").toLowerCase();
  const status = typeof e.status === "number" ? e.status : undefined;
  const name = typeof e.name === "string" ? e.name : "";
  if (name === "AbortError" || /\baborted?\b|\bcancell?ed\b/.test(msg)) return "aborted";
  // The provider's billing state (a depleted prepaid balance) — often a 429.
  if (/prepayment|prepaid|credits?\b.*(depleted|exhausted|insufficient)|insufficient (funds|credit)|billing/.test(msg)) return "provider_credit";
  // The app's own free-tier meter (PaywallError, HTTP 402) and provider quotas.
  if (err instanceof PaywallError || /quota|resource[_ ]exhausted|daily limit/.test(msg)) return "quota_exhausted";
  if (status === 429 || /rate.?limit|too many requests/.test(msg)) return "rate_limited";
  if (status === 504 || status === 408 || /time(d)?[ -]?out|deadline/.test(msg)) return "timeout";
  if (/failed to fetch|network ?error|networkerror|load failed|offline|err_internet_disconnected/.test(msg)) return "offline";
  if (typeof status === "number" && status >= 500) return "server_error";
  return "other";
}

/**
 * Pure instrumentation wrapper, extracted so it is testable without React. Runs
 * `fn`, emitting started → (succeeded | failed) around it via the supplied
 * `track`. Re-throws so the caller's catch/finally still runs. Analytics is
 * best-effort: a throwing `track` never masks the real result or error.
 */
export async function runInstrumented<T>(
  name: string,
  fn: () => Promise<T>,
  track: TrackFn = defaultTrack,
  startProps: Record<string, unknown> = {},
): Promise<T> {
  const safeTrack: TrackFn = (event, props) => {
    try {
      track(event, props);
    } catch {
      /* analytics must never break the action */
    }
  };
  safeTrack(`${name}_started`, startProps);
  try {
    const result = await fn();
    safeTrack(`${name}_succeeded`, startProps);
    return result;
  } catch (err) {
    safeTrack(`${name}_failed`, { ...startProps, reason: failureReason(err) });
    throw err;
  }
}

export type AsyncActionState = {
  /** True while the async action is in flight. Drives the loading UI. */
  loading: boolean;
  /** Friendly, already-localized error message, or null. Drives the retry UI. */
  error: string | null;
};

export type UseAsyncAction<Args extends unknown[], T> = AsyncActionState & {
  /**
   * Run the instrumented action. Resolves to the result on success, or
   * `undefined` if it failed (the error is captured in `error` instead of
   * throwing, so call sites stay declarative). Concurrent invocations are
   * ignored while one is in flight.
   */
  run: (...args: Args) => Promise<T | undefined>;
  /** Clear the current error (e.g. when the user dismisses or retries). */
  clearError: () => void;
};

/**
 * React wrapper around {@link runInstrumented}. Owns the loading + error state
 * and the analytics, so a call site reduces to: render `loading`, render
 * `error` with a retry, and call `run()`.
 */
export function useAsyncAction<Args extends unknown[], T>(
  name: string,
  fn: (...args: Args) => Promise<T>,
  options: {
    /** Friendly fallback when the thrown error has no usable message. */
    fallbackError: string;
    /** Map an error to a friendly message (e.g. localized, paywall-aware). */
    toMessage?: (err: unknown) => string;
    /** Stable analytics props attached to every start/success/error event. */
    startProps?: Record<string, unknown>;
    track?: TrackFn;
    /**
     * Called on a {@link PaywallError} (HTTP 402) instead of setting the inline
     * `error`. Wire this to `openPaywall(...)` so a metered/Plus-gated 402 is a
     * conversion moment, not a dead-end error string. When omitted, a
     * PaywallError falls through to the normal error path.
     */
    onPaywall?: (err: PaywallError) => void;
  },
): UseAsyncAction<Args, T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Keep the latest `fn`/`options` in refs so `run` can stay referentially
  // stable (deps `[name]`) without going stale. Call sites whose `fn` closes
  // over changing state (e.g. the active child's profile / hero avatar) MUST
  // see the current closure — otherwise generation writes the wrong child's
  // content into the per-child longitudinal record. Reading through refs fixes
  // that while preserving the stable `run` identity.
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optsRef = useRef(options);
  optsRef.current = options;

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      if (inFlight.current) return undefined; // dedupe double-taps
      const opts = optsRef.current;
      inFlight.current = true;
      setLoading(true);
      setError(null);
      try {
        return await runInstrumented(
          name,
          () => fnRef.current(...args),
          opts.track,
          opts.startProps,
        );
      } catch (err) {
        // A 402 is a conversion moment, not an error: route it to the paywall
        // and leave the inline error clear so no raw server string leaks through.
        if (err instanceof PaywallError && opts.onPaywall) {
          opts.onPaywall(err);
          return undefined;
        }
        const message = opts.toMessage
          ? opts.toMessage(err)
          : err instanceof Error && err.message
            ? err.message
            : opts.fallbackError;
        setError(message || opts.fallbackError);
        return undefined;
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    // `fn`/`options` are read through refs above, so `run` stays stable on
    // `[name]` without ever closing over a stale `fn`.
    [name],
  );

  return { loading, error, run, clearError };
}
