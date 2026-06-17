/** Transient model failures worth retrying: rate limits, brief unavailability, dropped sockets. */
export const isTransientModelError = (err: any): boolean => {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (status === 429 || status === 500 || status === 503) return true;
  const msg = String(err?.message || err || "");
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE|overloaded|ECONNRESET|ETIMEDOUT|socket hang up|try again/i.test(msg);
};

/** Retry an async model call with exponential backoff + jitter on transient failures. */
export const withModelRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts - 1 || !isTransientModelError(err)) throw err;
      const backoffMs = 400 * 2 ** attempt + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastErr;
};
