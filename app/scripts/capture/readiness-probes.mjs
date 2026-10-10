/** Capture-only dependency diagnostics. No app/provider imports or writes.
 * Both browser functions are self-contained for Playwright serialization. */
export function installStylesheetObservation() {
  const events = [];
  const counts = { load: 0, error: 0, omitted: 0 };
  const observe = event => {
    const link = event.target;
    if (link?.tagName !== 'LINK' || link.rel !== 'stylesheet') return;
    let url;
    try { url = new URL(link.href); } catch { return; }
    if (url.origin !== location.origin || !/^\/assets\/[a-zA-Z0-9_.-]{1,150}\.css$/.test(url.pathname)) return;
    counts[event.type] = Math.min(counts[event.type] + 1, 1_000_000);
    if (events.length === 100) { counts.omitted++; return; }
    events.push({ path: url.pathname, event: event.type });
  };
  document.addEventListener('load', observe, { capture: true, passive: true });
  document.addEventListener('error', observe, { capture: true, passive: true });
  // This private capture namespace holds only safe paths, enum events and counts.
  window.__arborStylesheetObservation = () => ({ counts: { ...counts }, events: events.map(item => ({ ...item })) });
}

/** Read the EXACT lazy payload retained by the visible fallback's Suspense
 * boundary. Never export fiber props/state, thenables, values, error messages,
 * or stacks. Only an explicit post-failure call observes promise settlement.
 * The optional importer parameter is a node-test seam; browser calls omit it. */
export async function observeAskDependency({ probeModulePath = null } = {}, importExisting = path => import(path)) {
  const fallback = document.querySelector('.companion-conversation .companion-loading');
  const key = fallback && Object.keys(fallback).find(name => name.startsWith('__reactFiber$'));
  let fiber = key ? fallback[key] : null;
  let boundary = null;
  for (let depth = 0; fiber && depth < 30; depth++, fiber = fiber.return) {
    if (fiber.tag === 13) { boundary = fiber; break; }
  }
  // The production boundary's direct child is <CoachTab>. Support a bounded
  // fragment/array wrapper without scanning or exposing the surrounding app.
  const payloads = [];
  const seen = new Set();
  const inspect = (child, depth = 0) => {
    if (!child || depth > 3 || payloads.length >= 8) return;
    if (Array.isArray(child)) { child.slice(0, 8).forEach(item => inspect(item, depth + 1)); return; }
    const type = child.type;
    if (type?.$$typeof === Symbol.for('react.lazy') && type._payload && !seen.has(type._payload)) {
      seen.add(type._payload); payloads.push(type._payload);
    } else if (type === Symbol.for('react.fragment')) inspect(child.props?.children, depth + 1);
  };
  inspect(boundary?.memoizedProps?.children);
  const status = payload => ({ '-1': 'uninitialized', 0: 'pending', 1: 'resolved', 2: 'rejected' })[payload._status] ?? 'unknown';
  const snapshot = () => ({
    boundaryFound: !!boundary,
    lazyCount: payloads.length,
    lazy: payloads.map(payload => ({ status: status(payload), thenable: payload._status === 0 && typeof payload._result?.then === 'function' })),
    cssEvents: window.__arborStylesheetObservation?.() ?? { unavailable: true },
  });
  const before = snapshot();
  if (probeModulePath === null) return before;

  // Only a specific, already observed successful modulepreload can be probed.
  // Never guess a chunk, accept a URL/query/hash, or bypass the Vite loader on
  // the first attempt. The caller must have retained the failed original cell.
  const validPath = typeof probeModulePath === 'string' && /^\/assets\/CoachTab-[a-zA-Z0-9_-]{1,100}\.js$/.test(probeModulePath);
  const observed = validPath && [...document.querySelectorAll('link[rel="modulepreload"]')].some(link => {
    try { const url = new URL(link.href); return url.origin === location.origin && url.pathname === probeModulePath && !url.search && !url.hash; } catch { return false; }
  });
  if (!observed) return { before, probe: { module: 'not-observed-local-coach-module' } };

  const errorName = error => ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'DOMException'].includes(error?.name) ? error.name : 'OtherError';
  const observe = (thenable, module = false) => new Promise(resolve => {
    let settled = false;
    const finish = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
    const timer = setTimeout(() => finish({ state: 'pending-at-probe-deadline' }), 2000);
    Promise.resolve(thenable).then(value => finish({ state: 'fulfilled', ...(module ? { defaultType: typeof value?.default } : {}) }), error => finish({ state: 'rejected', errorName: errorName(error) }));
  });
  const pending = payloads.filter(payload => payload._status === 0 && typeof payload._result?.then === 'function');
  // Passive subscriptions to the actual thrown thenables; no calls to _init,
  // no payload mutation, no React retry, dispatch, synthetic event or CSS edit.
  const actualWait = pending.map(payload => observe(payload._result));
  let moduleWait;
  try { moduleWait = importExisting(probeModulePath); }
  catch (error) { moduleWait = Promise.reject(error); }
  const [module, ...lazyWaits] = await Promise.all([observe(moduleWait, true), ...actualWait]);
  return { before, probe: { modulePath: probeModulePath, deadlineMs: 2000, module, lazyWaits }, after: snapshot() };
}
