/** Capture-only dependency diagnostics. No app/provider imports or writes.
 * Browser functions are self-contained for Playwright/CDP serialization. */
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

/** Observe only the root that owns Arbor's existing #root container. React's
 * host pointer can refer to an alternate: find the matched boundary in CURRENT
 * root before describing stages. No function names, props or state are exported. */
export function observeReactStage() {
  const app = document.getElementById('root');
  const host = document.querySelector('.companion-conversation .companion-loading') ?? document.querySelector('.companion-conversation');
  if (!app || !host || !app.contains(host)) return { appRootVerified: false };
  const key = Object.keys(host).find(name => name.startsWith('__reactFiber$'));
  let fiber = key ? host[key] : null;
  let attachedRoot = null, boundary = null;
  for (let depth = 0; fiber && depth < 60; depth++, fiber = fiber.return) {
    if (boundary === null && fiber.tag === 13) boundary = fiber;
    if (fiber.tag === 3) { attachedRoot = fiber; break; }
  }
  const root = attachedRoot?.stateNode;
  if (!root || root.containerInfo !== app || root.current?.tag !== 3) return { appRootVerified: false };
  const mask = value => Number.isInteger(value) && value >= 0 && value <= 0x7fffffff ? value : null;
  const traverse = (start, visit, limit = 2000) => {
    const todo = start ? [start] : [], seen = new Set();
    while (todo.length && seen.size < limit) {
      const current = todo.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current); visit(current);
      if (current.sibling) todo.push(current.sibling);
      if (current.child) todo.push(current.child);
    }
    return { visited: seen.size, truncated: todo.length > 0 };
  };
  let currentBoundary = null;
  const search = traverse(root.current.child, item => {
    if (boundary && (item === boundary || item === boundary.alternate)) currentBoundary = item;
  });
  const subtree = start => {
    const result = { visited: 0, truncated: false, functions: 0, hosts: 0, suspense: 0, offscreen: 0, resources: 0, incomplete: 0, captured: 0, shouldCapture: 0, lazy: { uninitialized: 0, pending: 0, resolved: 0, rejected: 0, unknown: 0 } };
    const seenLazy = new Set();
    Object.assign(result, traverse(start, item => {
      if ([0, 1, 11, 14, 15].includes(item.tag)) result.functions++;
      if (item.tag === 5) result.hosts++;
      if (item.tag === 13) result.suspense++;
      if (item.tag === 22) result.offscreen++;
      if (item.tag === 26) result.resources++;
      if ((item.flags & 32768) !== 0) result.incomplete++;
      if ((item.flags & 128) !== 0) result.captured++;
      if ((item.flags & 65536) !== 0) result.shouldCapture++;
      const payload = item.elementType?.$$typeof === Symbol.for('react.lazy') ? item.elementType._payload : null;
      if (payload && !seenLazy.has(payload)) {
        seenLazy.add(payload);
        result.lazy[({ '-1': 'uninitialized', 0: 'pending', 1: 'resolved', 2: 'rejected' })[payload._status] ?? 'unknown']++;
      }
    }, 500));
    return result;
  };
  const current = currentBoundary;
  return {
    appRootVerified: true,
    attachedBranchCurrent: attachedRoot === root.current,
    boundaryFoundInCurrent: !!current,
    rootSearch: search,
    root: { pendingLanes: mask(root.pendingLanes), suspendedLanes: mask(root.suspendedLanes), pingedLanes: mask(root.pingedLanes), expiredLanes: mask(root.expiredLanes), callbackPriority: mask(root.callbackPriority), callbackPresent: root.callbackNode != null, cancelPendingCommit: typeof root.cancelPendingCommit === 'function' },
    ...(current ? { boundary: { fallbackActive: current.memoizedState !== null, lanes: mask(current.lanes), childLanes: mask(current.childLanes), flags: mask(current.flags), subtreeFlags: mask(current.subtreeFlags), retryQueueCount: current.updateQueue instanceof Set ? Math.min(current.updateQueue.size, 500) : null, current: subtree(current.child), alternate: subtree(current.alternate?.child) } } : {}),
  };
}

/** CDP-only selector. A WeakSet handle stays in the isolated page/inspector and
 * is never returned as capture evidence. Do not read props or promise values. */
export function selectCurrentCoachRetryCache() {
  if (location.origin !== 'http://127.0.0.1:4805' || window.__arborCaptureFixture?.connectivity !== 'synthetic-online') return 'not-isolated-fixture';
  const app = document.getElementById('root');
  const host = document.querySelector('.companion-conversation .companion-loading');
  if (!app || !host || !app.contains(host)) return 'not-current-coach-boundary';
  const key = Object.keys(host).find(name => name.startsWith('__reactFiber$'));
  let fiber = key ? host[key] : null;
  let attachedRoot = null, boundary = null;
  for (let depth = 0; fiber && depth < 60; depth++, fiber = fiber.return) {
    if (boundary === null && fiber.tag === 13) boundary = fiber;
    if (fiber.tag === 3) { attachedRoot = fiber; break; }
  }
  const root = attachedRoot?.stateNode;
  if (!boundary || !root || root.containerInfo !== app || root.current?.tag !== 3) return 'not-current-coach-boundary';
  const todo = root.current.child ? [root.current.child] : [], seen = new Set();
  let currentBoundary = null;
  while (todo.length && seen.size < 2000) {
    const current = todo.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (current === boundary || current === boundary.alternate) { currentBoundary = current; break; }
    if (current.sibling) todo.push(current.sibling);
    if (current.child) todo.push(current.child);
  }
  if (!currentBoundary) return 'not-current-coach-boundary';
  if (currentBoundary.memoizedState === null) return 'boundary-not-suspended';
  const cache = currentBoundary.stateNode;
  if (cache == null) return 'retry-cache-absent';
  return cache instanceof WeakSet ? cache : 'unsupported-retry-cache';
}

/** Inspect at most eight held wakeables, without awaiting/subscribing/retrying.
 * CDP necessarily returns internal descriptors; discard them immediately after
 * extracting the closed Promise-state enum. No protocol response, descriptor,
 * entry value, PromiseResult, description, props or error reaches evidence. */
export async function observeCurrentRetryCache(page, { retainedFailure = false } = {}) {
  const result = { presence: 'not-requested', examined: 0, truncated: false, states: { pending: 0, fulfilled: 0, rejected: 0, unknown: 0 } };
  if (retainedFailure !== true) return result;
  let session;
  const objectGroup = 'arbor-capture-current-retry-cache';
  try {
    session = await page.context().newCDPSession(page);
    const selected = await session.send('Runtime.evaluate', {
      expression: `(${selectCurrentCoachRetryCache.toString()})()`, objectGroup,
      returnByValue: false, awaitPromise: false, generatePreview: false, silent: true, timeout: 1000,
    });
    if (selected.exceptionDetails) throw new Error('RETRY_CACHE_PROTOCOL_UNAVAILABLE');
    const absence = ['not-isolated-fixture', 'not-current-coach-boundary', 'boundary-not-suspended', 'retry-cache-absent', 'unsupported-retry-cache'];
    if (selected.result?.type === 'string' && absence.includes(selected.result.value)) { result.presence = selected.result.value; return result; }
    if (selected.result?.subtype !== 'weakset' || !selected.result.objectId) { result.presence = 'unsupported-retry-cache'; return result; }
    result.presence = 'weakset-present';
    const properties = async objectId => {
      const response = await session.send('Runtime.getProperties', { objectId, ownProperties: true, generatePreview: false });
      if (response.exceptionDetails) throw new Error('RETRY_CACHE_PROTOCOL_UNAVAILABLE');
      return response;
    };
    const cacheProperties = await properties(selected.result.objectId);
    const entries = cacheProperties.internalProperties?.find(item => item.name === '[[Entries]]')?.value;
    if (entries?.subtype !== 'array' || !entries.objectId) { result.presence = 'entries-unavailable'; return result; }
    // Inspector's internal entry array has no Array prototype. Slice via the
    // intrinsic, before enumerating any entries; never enumerate the whole set.
    const sampled = await session.send('Runtime.callFunctionOn', {
      objectId: entries.objectId, objectGroup,
      functionDeclaration: 'function () { return { values: Array.prototype.slice.call(this, 0, 8).map(entry => entry.value), truncated: this.length > 8 }; }',
      returnByValue: false, awaitPromise: false, generatePreview: false, silent: true,
    });
    if (sampled.exceptionDetails || !sampled.result?.objectId) throw new Error('RETRY_CACHE_PROTOCOL_UNAVAILABLE');
    const sampleProperties = await properties(sampled.result.objectId);
    result.truncated = sampleProperties.result?.find(item => item.name === 'truncated')?.value?.value === true;
    const values = sampleProperties.result?.find(item => item.name === 'values')?.value;
    if (values?.subtype !== 'array' || !values.objectId) throw new Error('RETRY_CACHE_PROTOCOL_UNAVAILABLE');
    const sampleEntries = await properties(values.objectId);
    for (const item of (sampleEntries.result ?? []).filter(item => /^[0-7]$/.test(item.name)).slice(0, 8)) {
      result.examined++;
      let state = 'unknown';
      if (item.value?.subtype === 'promise' && item.value.objectId) {
        const promiseProperties = await properties(item.value.objectId);
        const promiseState = promiseProperties.internalProperties?.find(property => property.name === '[[PromiseState]]')?.value;
        if (promiseState?.type === 'string' && ['pending', 'fulfilled', 'rejected'].includes(promiseState.value)) state = promiseState.value;
      }
      result.states[state]++;
    }
    return result;
  } catch { result.presence = 'protocol-unavailable'; return result; }
  finally {
    if (session) {
      try { await session.send('Runtime.releaseObjectGroup', { objectGroup }); } catch { /* No raw protocol errors. */ }
      try { await session.detach(); } catch { /* No raw protocol errors. */ }
    }
  }
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
