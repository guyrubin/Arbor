/** Pure diagnostic allowlist. Raw browser strings are never stored or exported. */
import { BASE } from './config.mjs';

/** Inspect strings transiently; only a bounded enum leaves the classifier. */
export function classifyReleaseConsole(message) {
  const minified = /^Minified React error #(\d{1,3})(?:\D|$)/.exec(message);
  if (minified) return `REACT_MINIFIED_${minified[1]}`;
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

/** Bounded snapshots contain only enums, counts and sanitized module locations. */
export function createRuntimeDiagnostics() {
  const counts = {};
  const recent = [];
  return {
    record(message, location) {
      const kind = classifyReleaseConsole(message);
      counts[kind] = Math.min((counts[kind] ?? 0) + 1, 1_000_000);
      const source = sanitizedReleaseLocation(location);
      recent.push({ kind, ...(source ? { source } : {}) });
      if (recent.length > 20) recent.shift();
      return kind;
    },
    snapshot() { return { counts: { ...counts }, recent: recent.map(item => ({ ...item, ...(item.source ? { source: { ...item.source } } : {}) })) }; },
  };
}
