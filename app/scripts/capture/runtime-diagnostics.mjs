/** Pure diagnostic allowlist. Raw browser strings are never stored or exported. */
import { BASE } from './config.mjs';

/** Inspect strings transiently; only a bounded enum leaves the classifier. */
export function classifyReleaseConsole(message) {
  const minified = /\bMinified React error #(\d{1,3})(?!\d)/.exec(message);
  if (minified) return `REACT_MINIFIED_${minified[1]}`;
  if (/service worker registration blocked by playwright/i.test(message)) return 'SERVICE_WORKER_BLOCKED';
  if (/a component suspended.*uncached promise|uncached promise.*suspend/i.test(message)) return 'REACT_UNCACHED_PROMISE';
  if (/suspense exception/i.test(message)) return 'REACT_SUSPENSE_EXCEPTION';
  if (/lazy: expected|lazy element type|element type is invalid.*promise/i.test(message)) return 'REACT_LAZY_RESOLUTION';
  if (/cannot access .+ before initialization/i.test(message)) return 'MODULE_INITIALIZATION';
  if (/does not provide an export named|export .+ was not found/i.test(message)) return 'MODULE_EXPORT';
  if (/cannot read properties of|cannot set properties of|is not a function/i.test(message)) return 'TYPE_ERROR';
  if (/referenceerror|is not defined/i.test(message)) return 'REFERENCE_ERROR';
  if (/arbor tab error/i.test(message)) return 'APP_ERROR_BOUNDARY';
  if (/an error occurred in the|the above error occurred in/i.test(message)) return 'REACT_ERROR_BOUNDARY';
  if (/getSnapshot should be cached|result of getSnapshot/i.test(message)) return 'REACT_UNCACHED_SNAPSHOT';
  if (/cannot update a component.*while rendering a different/i.test(message)) return 'REACT_RENDER_PHASE_UPDATE';
  if (/multiple renderers concurrently rendering/i.test(message)) return 'REACT_MULTIPLE_RENDERERS';
  if (/useInsertionEffect must not schedule/i.test(message)) return 'REACT_INSERTION_UPDATE';
  if (/cannot be a descendant of|cannot appear as a descendant|validateDOMNesting/i.test(message)) return 'HTML_NESTING';
  if (/autofocus processing was blocked|already has a focused element/i.test(message)) return 'FOCUS_WARNING';
  if (/maximum update depth|too many re-renders/i.test(message)) return 'REACT_UPDATE_DEPTH';
  if (/invalid hook call|rendered (?:more|fewer) hooks|change in the order of hooks/i.test(message)) return 'REACT_HOOKS';
  if (/optimized dep|outdated optimize dep|504.*optimi|dependency pre-bundl/i.test(message)) return 'OPTIMIZED_DEPENDENCY';
  if (/content security policy|\bcsp\b|refused to (?:load|execute|connect)/i.test(message)) return 'CSP';
  if (/dynamically imported module|module script|loading chunk|failed to fetch.*module/i.test(message)) return 'MODULE_LOAD';
  if (/minified react error/i.test(message)) return 'REACT_MINIFIED';
  if (/networkerror|failed to fetch|err_connection|net::err/i.test(message)) return 'NETWORK';
  if (/resizeobserver loop/i.test(message)) return 'RESIZE_OBSERVER';
  return 'OTHER_ERROR';
}

export function sanitizedReleaseLocation(location) {
  try {
    const url = new URL(location?.url);
    if (url.origin !== BASE || !/^\/(?:src\/|assets\/|node_modules\/|@vite\/|@react-refresh)/.test(url.pathname) || !/^[a-zA-Z0-9_./@-]{1,200}$/.test(url.pathname)) return undefined;
    return { path: url.pathname, ...(Number.isSafeInteger(location.lineNumber) ? { line: location.lineNumber } : {}), ...(Number.isSafeInteger(location.columnNumber) ? { column: location.columnNumber } : {}) };
  } catch { return undefined; }
}

/** Exception names and local static-module frames only. Never retain the
 * exception message, stack text, function names, URL query, hash or API path. */
export function safeReleaseException(error) {
  const names = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'DOMException'];
  const errorName = names.includes(error?.name) ? error.name : 'OtherError';
  const frames = [];
  if (typeof error?.stack === 'string') for (const line of error.stack.split('\n').slice(1, 41)) {
    // V8 and Firefox module frames. Restrict after parsing to static app paths.
    const match = /(?:\(|@|\s)(https?:\/\/[^\s)]+):(\d+):(\d+)\)?$/.exec(line.trim());
    if (!match) continue;
    const source = sanitizedReleaseLocation({ url: match[1], lineNumber: Number(match[2]), columnNumber: Number(match[3]) });
    if (!source || !/^\/(?:assets|src)\//.test(source.path)) continue;
    frames.push(source);
    if (frames.length === 5) break;
  }
  return { errorName, ...(frames.length ? { frames } : {}) };
}

/** Bounded snapshots contain only enums, counts and sanitized module locations. */
export function createRuntimeDiagnostics() {
  const counts = {};
  const recent = [];
  const record = (message, location, exception) => {
    const kind = classifyReleaseConsole(message);
    counts[kind] = Math.min((counts[kind] ?? 0) + 1, 1_000_000);
    const source = sanitizedReleaseLocation(location);
    recent.push({ kind, ...(source ? { source } : {}), ...(exception ?? {}) });
    if (recent.length > 20) recent.shift();
    return kind;
  };
  return {
    record,
    recordPageError(error) { return record(error?.message, undefined, safeReleaseException(error)); },
    snapshot() { return { counts: { ...counts }, recent: recent.map(item => ({ ...item, ...(item.source ? { source: { ...item.source } } : {}), ...(item.frames ? { frames: item.frames.map(frame => ({ ...frame })) } : {}) })) }; },
  };
}

/** Local script/CSS evidence only. No request headers, bodies, URL queries or
 * browser error text are retained. The request object is only an in-memory key. */
export function createAssetDiagnostics() {
  const active = new Map();
  const recent = [];
  const counts = { started: 0, finished: 0, failed: 0, httpErrors: 0, omitted: 0 };
  const keep = entry => { recent.push(entry); if (recent.length > 120) recent.shift(); };
  return {
    request(key, url, resourceType) {
      if (!['script', 'stylesheet'].includes(resourceType)) return;
      const source = sanitizedReleaseLocation({ url });
      if (!source) return;
      counts.started++;
      if (active.size >= 120) { counts.omitted++; return; }
      active.set(key, { path: source.path, type: resourceType, startedAt: Date.now() });
    },
    response(key, status, contentType) {
      const entry = active.get(key);
      if (!entry) return;
      entry.status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
      entry.mime = /(?:java|ecma)script/i.test(contentType) ? 'javascript' : /text\/css/i.test(contentType) ? 'css' : /text\/html/i.test(contentType) ? 'html' : 'other';
      if (entry.status >= 400) counts.httpErrors++;
    },
    finish(key, failed = false) {
      const entry = active.get(key);
      if (!entry) return;
      active.delete(key);
      counts[failed ? 'failed' : 'finished']++;
      const { startedAt, ...safe } = entry;
      keep({ ...safe, state: failed ? 'failed' : 'finished', elapsedMs: Math.max(0, Date.now() - startedAt) });
    },
    snapshot() {
      return { counts: { ...counts }, pending: [...active.values()].map(({ startedAt, ...safe }) => ({ ...safe, state: 'pending', elapsedMs: Math.max(0, Date.now() - startedAt) })), recent: recent.map(item => ({ ...item })) };
    },
  };
}
