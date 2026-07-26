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
export const raceWithAbort = async <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) throw newAbortError();
  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(newAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
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
 * Retry an async model call with exponential backoff + jitter on transient failures.
 * AIR-9: aborts are never retried, and once less than 40% of the deadline budget
 * remains the blind backoff is skipped entirely (fail fast toward the calm error
 * instead of burning the parent's remaining wait on sleeps).
 */
export const withModelRetry = async <T>(
  fn: () => Promise<T>,
  attempts = 3,
  budget?: ModelCallBudget,
): Promise<T> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (budget?.signal?.aborted) throw newAbortError();
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
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
