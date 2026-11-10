/** Transient model failures worth retrying: rate limits, brief unavailability, dropped sockets. */
export const isTransientModelError = (err: any): boolean => {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (status === 429 || status === 500 || status === 503) return true;
  const msg = String(err?.message || err || "");
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE|overloaded|ECONNRESET|ETIMEDOUT|socket hang up|try again/i.test(msg);
};

/**
 * AIR-9: a per-call deadline budget threaded from the route into the provider.
 * `signal` aborts the upstream call (fetch cancellation where supported);
 * `deadlineAt`/`totalMs` let the retry loop skip blind backoff when the
 * remaining budget can no longer absorb it.
 */
export type ModelCallBudget = {
  signal?: AbortSignal;
  /** Epoch ms at which the route's budget expires. */
  deadlineAt?: number;
  /** The route's full budget in ms (used for the <40%-remaining backoff skip). */
  totalMs?: number;
};

/** True when the error is an abort (budget expiry or client disconnect) — never retryable. */
export const isAbortError = (err: any): boolean =>
  err?.name === "AbortError" || /abort/i.test(String(err?.message || ""));

export const newAbortError = (): Error => {
  const err = new Error("The model call was aborted (deadline budget exceeded or client disconnected).");
  err.name = "AbortError";
  return err;
};

/**
 * Race a promise against a budget signal so a hung upstream can never outlive
 * the route budget, even when the underlying SDK offers no cancellation hook.
 * (The upstream work may keep running; the REQUEST is freed — providers that
 * accept an AbortSignal, like fetch, get true cancellation instead.)
 */
export const raceWithAbort = async <T>(promise: Promise<T>, signal?: AbortSignal, late?: {
  resolved(value: T): void;
  rejected(error: unknown): void;
}): Promise<T> => {
  if (!signal) return promise;
  return await new Promise<T>((resolve, reject) => {
    let aborted = false;
    const onAbort = () => { aborted = true; reject(newAbortError()); };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        if (!aborted) resolve(value);
        else try { late?.resolved(value); } catch { /* accounting must not affect the request */ }
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        if (!aborted) reject(error);
        else try { late?.rejected(error); } catch { /* accounting */ }
      },
    );
    // Attach both handlers even when already aborted: the caller has issued
    // the promise, so a later rejection must still be consumed/accounted for.
    if (signal.aborted) { signal.removeEventListener("abort", onAbort); onAbort(); }
  });
};

/** Wrap an async iterable so every pull races the budget signal (hung streams end). */
export async function* abortableIterate<T>(iterable: AsyncIterable<T>, signal?: AbortSignal): AsyncIterable<T> {
  if (!signal) {
    yield* iterable;
    return;
  }
  const iterator = iterable[Symbol.asyncIterator]();
  try {
    for (;;) {
      const { done, value } = await raceWithAbort(iterator.next(), signal);
      if (done) return;
      yield value;
    }
  } finally {
    // Fire-and-forget: a generator wedged inside an await would never settle
    // its return() — awaiting it here would hang the abort path itself.
    try { Promise.resolve(iterator.return?.()).catch(() => {}); } catch { /* already closed */ }
  }
}

/**
 * B-AIOPS-01: one call's retry accounting. `retries` is how many attempts
 * failed before the one that returned (0 = first try). `failedAttempts` holds
 * provider usage from an attempt that threw — a non-200 usually has none
 * (Page A: not charged); usage on the error means the provider billed it.
 */
export type RetryAccounting = {
  retries: number;
  failedAttempts: { raw: unknown; attempt: number }[];
};

export function newRetryAccounting(): RetryAccounting {
  return { retries: 0, failedAttempts: [] };
}

export function usageFromError(err: unknown): unknown {
  if (!err || typeof err !== "object") return null;
  const e = err as { usageMetadata?: unknown; usage?: unknown; response?: { usageMetadata?: unknown } };
  const raw = e.usageMetadata ?? e.usage ?? e.response?.usageMetadata;
  return raw && typeof raw === "object" ? raw : null;
}

/**
 * Retry an async model call with exponential backoff + jitter on transient failures.
 * AIR-9: aborts are never retried, and once less than 40% of the deadline budget
 * remains the blind backoff is skipped entirely (fail fast toward the calm error
 * instead of burning the parent's remaining wait on sleeps).
 */
export const withModelRetry = async <T>(
  fn: () => Promise<T>,
  attempts = 3,
  budget?: ModelCallBudget,
  accounting?: RetryAccounting,
): Promise<T> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (accounting) accounting.retries = attempt;
    if (budget?.signal?.aborted) throw newAbortError();
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const billed = usageFromError(err);
      if (accounting && billed) accounting.failedAttempts.push({ raw: billed, attempt });
      if (attempt === attempts - 1 || !isTransientModelError(err) || isAbortError(err)) throw err;
      if (budget?.deadlineAt && budget?.totalMs) {
        const remaining = budget.deadlineAt - Date.now();
        if (remaining < budget.totalMs * 0.4) throw err;
      }
      const backoffMs = 400 * 2 ** attempt + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastErr;
};
