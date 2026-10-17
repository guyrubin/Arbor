/** Share successful/in-flight module loads, but allow a failed warm-up to retry
 * when the user actually opens the surface. React.lazy keeps its own promise. */
export function cachedModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(load).catch(error => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

/** Speculation must never compete with a hidden page or a constrained link.
 * Explicitly opening a selected activity does not use this policy. */
export function speculationAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (typeof navigator === 'undefined') return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return navigator.onLine !== false && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
}

/** One speculative module at a time, yielding between modules. Cleanup cancels
 * unissued work (an import already sent to the browser cannot be aborted). */
export function scheduleModulePreload(loaders: readonly (() => Promise<unknown>)[]): () => void {
  let cancelled = false;
  let index = 0;
  let handle: number | undefined;
  let idleHandle = false;
  const host = typeof window === 'undefined' ? undefined : window as Window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const schedule = () => {
    if (!host || cancelled || index >= loaders.length || !speculationAllowed()) return;
    idleHandle = typeof host.requestIdleCallback === 'function';
    handle = idleHandle ? host.requestIdleCallback!(run, { timeout: 2000 }) : host.setTimeout(run, 300);
  };
  const run = () => {
    handle = undefined;
    if (cancelled || !speculationAllowed()) return;
    const load = loaders[index++];
    if (!load) return;
    void Promise.resolve().then(() => cancelled || !speculationAllowed() ? undefined : load())
      .catch(() => { /* The explicit open retains its normal error boundary. */ })
      .then(schedule);
  };
  schedule();
  return () => {
    cancelled = true;
    if (handle !== undefined && host) {
      if (idleHandle) host.cancelIdleCallback?.(handle);
      else host.clearTimeout(handle);
    }
  };
}
