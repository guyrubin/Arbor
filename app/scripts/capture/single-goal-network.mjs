/** Capture-only request admission, independent of application/auth/provider code. */
import { readdirSync } from 'node:fs';
import { BASE } from './config.mjs';

export const SINGLE_GOAL_NETWORK_VERSION = 'single-goal-exact-requests-v2';
const READS = new Set(['/api/tts', '/api/entitlement', '/api/live/availability']);
const MOCK_POST_READS = new Set(['/api/todays-focus', '/api/digest']);
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const credentials = /^(authorization|proxy-authorization|cookie|x-api-key|x-auth-token)$/i;

/** Exact first automatic request emitted by the current shell builder. The
 * refusal stops that builder before it requests any later file. Source tests
 * compare this small contract with the actual authored book/name-file list. */
export function singleGoalNarrationRefusals(fixture, lang) {
  if (!['en', 'he'].includes(lang) || fixture.children.some(child => child.demo !== true || !['capture-goal-history', 'capture-goal-empty', 'capture-goal-long'].includes(child.id))) throw new Error('SINGLE_GOAL_NARRATION_FIXTURE_REQUIRED');
  return fixture.children.map(child => ({ childId: child.id,
    path: `/api/children/${child.id}/book-narration`,
    body: { bookId: 'five-smooth-stones', lang: lang === 'en' ? 'en' : child.gender === 'girl' ? 'he-f' : 'he-m', file: 'cover.mp3' } }));
}
function requestCategory(url) {
  if (!url) return 'UNKNOWN';
  const path = url.pathname;
  if (/^\/api\/children\/[^/]+\/book-narration$/.test(path)) return 'BOOK_NARRATION';
  if (/^\/api\/children(?:\/|$)/.test(path)) return 'CHILD_API';
  if (/^\/(?:auth|oauth|login|sign-in)(?:\/|$)/i.test(path) || /^\/api\/(?:auth|account)(?:\/|$)/.test(path)) return 'AUTH';
  if (path === '/sandbox/demo-family.json') return 'FIXTURE';
  return path.startsWith('/api/') ? 'OTHER_API' : 'STATIC_OR_EXTERNAL';
}
/** Only bounded enums and counters survive. No URL, body or header value. */
export function recordSingleGoalDenial(apiState, { method, reason, category = 'UNKNOWN', external = false }) {
  apiState.deniedActions++; apiState.singleGoalDeniedRequests++;
  if (method !== 'GET') apiState.singleGoalDeniedMutations++;
  if (external) apiState.deniedExternal++;
  apiState.singleGoalDeniedReasons ??= {};
  apiState.singleGoalDeniedCategories ??= {};
  apiState.singleGoalDeniedReasons[reason] = (apiState.singleGoalDeniedReasons[reason] ?? 0) + 1;
  apiState.singleGoalDeniedCategories[category] = (apiState.singleGoalDeniedCategories[category] ?? 0) + 1;
  apiState.singleGoalRequestSamples ??= [];
  if (apiState.singleGoalRequestSamples.length < 24) apiState.singleGoalRequestSamples.push({ category, reason, method: HTTP_METHODS.has(method) ? method : 'OTHER', external });
  else apiState.singleGoalSamplesOmitted = (apiState.singleGoalSamplesOmitted ?? 0) + 1;
}

/** Exact files from this already-built isolated checkout; never a URL prefix. */
export function singleGoalAssetPaths(root) {
  const files = [];
  const visit = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('SINGLE_GOAL_ASSET_SYMLINK_REFUSED');
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) visit(`${directory}/${entry.name}`, relative);
      else if (entry.isFile()) files.push(relative);
    }
  };
  visit(root);
  if (!files.includes('/index.html')) throw new Error('SINGLE_GOAL_BUILT_INDEX_REQUIRED');
  return files;
}

/** No side effects. A request must match one complete path, method and scope. */
export function singleGoalRequestDisposition({ method, rawUrl, headers = {}, body = null }, { childIds, assetPaths, fontUrls, narrationRefusals = [] }) {
  let url;
  try { url = new URL(rawUrl); } catch { return { kind: 'deny', reason: 'INVALID_URL', category: 'UNKNOWN', external: true }; }
  const external = url.origin !== BASE;
  const deny = reason => ({ kind: 'deny', reason, category: requestCategory(url), external });
  if (url.username || url.password || Object.keys(headers).some(key => credentials.test(key))) return deny('CREDENTIALS_REFUSED');
  if (external) return method === 'GET' && fontUrls.includes(url.href) ? { kind: 'font' } : deny('EXTERNAL_REQUEST_REFUSED');
  // Reject alternate spellings, traversal and query aliases before dispatch.
  if (url.href !== rawUrl || /%|\\|\/\//.test(url.pathname)) return deny('PATH_ENCODING_REFUSED');
  if (url.pathname === '/sandbox/demo-family.json') return method === 'GET' && !url.search && !url.hash ? { kind: 'fixture' } : deny('FIXTURE_METHOD_OR_QUERY_REFUSED');
  if (/^\/(?:auth|oauth|login|sign-in)(?:\/|$)/i.test(url.pathname)) return deny('AUTH_PATH_REFUSED');
  if (url.pathname.startsWith('/api/')) {
    const narration = narrationRefusals.find(item => childIds.includes(item.childId) && item.path === url.pathname);
    if (narration && method === 'POST' && !url.search && !url.hash) {
      let parsed; try { parsed = JSON.parse(body); } catch { return deny('NARRATION_BODY_REFUSED'); }
      if (!parsed || Array.isArray(parsed) || Object.keys(parsed).sort().join(',') !== 'bookId,file,lang'
        || Object.entries(narration.body).some(([key, value]) => parsed[key] !== value)) return deny('NARRATION_BODY_REFUSED');
      return { kind: 'synthetic-narration-refusal', category: 'BOOK_NARRATION' };
    }
    if (method === 'GET' && READS.has(url.pathname) && !url.search) return { kind: 'api-read' };
    if (method === 'GET' && childIds.some(id => ['/api/memory/', '/api/consent/'].some(prefix => url.pathname === prefix + id)) && !url.search) return { kind: 'api-read' };
    if (method === 'GET' && url.pathname === '/api/shares' && [...url.searchParams.keys()].length === 1 && url.searchParams.has('childId') && childIds.includes(url.searchParams.get('childId'))) return { kind: 'api-read' };
    if (method === 'POST' && MOCK_POST_READS.has(url.pathname) && !url.search) {
      let parsed;
      try { parsed = JSON.parse(body); } catch { return deny('MOCK_READ_BODY_REFUSED'); }
      if (parsed?.childProfile?.demo !== true || !childIds.includes(parsed?.childProfile?.id)
        || (parsed.childId !== undefined && parsed.childId !== parsed.childProfile.id)) return deny('MOCK_READ_CHILD_REFUSED');
      return { kind: 'api-read' };
    }
    return deny('API_SCOPE_REFUSED');
  }
  if (method !== 'GET') return deny('NON_READ_REQUEST_REFUSED');
  if (url.pathname === '/' && [...url.searchParams.keys()].length === 1 && /^release-single-goal-\d+$/.test(url.searchParams.get('capture') ?? '')) return { kind: 'static' };
  if (!url.search && assetPaths.includes(url.pathname)) return { kind: 'static' };
  return deny('STATIC_SCOPE_REFUSED');
}

/** Installed LAST, therefore Playwright executes it FIRST, before fixture,
 * API/cache, generic same-origin and exact-font handlers. The only fallback
 * paths have already passed exact admission. The fixture never uses a glob. */
export async function installSingleGoalNetworkGuard(context, { fixture, apiState, assetPaths, fontUrls, lang }) {
  const scope = { childIds: fixture.children.map(child => child.id), assetPaths, fontUrls, narrationRefusals: singleGoalNarrationRefusals(fixture, lang) };
  Object.assign(apiState, { singleGoalNarrationRefusals: 0, singleGoalDeniedReasons: {}, singleGoalDeniedCategories: {}, singleGoalRequestSamples: [], singleGoalSamplesOmitted: 0 });
  apiState.singleGoalGuardVersion = SINGLE_GOAL_NETWORK_VERSION;
  await context.route('**/*', async route => {
    let method;
    let disposition;
    try {
      const request = route.request();
      method = request.method();
      // headers() omits cookie/security headers; admission needs the complete set.
      const headers = await request.allHeaders();
      if (!headers || typeof headers !== 'object' || Array.isArray(headers) || Object.values(headers).some(value => typeof value !== 'string')) throw new Error('INVALID_REQUEST_HEADERS');
      disposition = singleGoalRequestDisposition({ method, rawUrl: request.url(), headers, body: request.postData() }, scope);
    } catch {
      // Unreadable metadata cannot prove a safe method, origin or credentials.
      disposition = { kind: 'deny', reason: 'REQUEST_METADATA_UNAVAILABLE', category: 'UNKNOWN', external: true };
    }
    if (disposition.kind === 'deny') {
      recordSingleGoalDenial(apiState, { ...disposition, method });
      return route.abort();
    }
    if (disposition.kind === 'synthetic-narration-refusal') {
      apiState.singleGoalNarrationRefusals++;
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'synthetic_capture_media_disabled' }) });
    }
    if (disposition.kind === 'fixture') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.parsed) });
    if (disposition.kind === 'static') return route.continue();
    return route.fallback(); // exact cached font or scoped existing mock-server read
  });
  await context.routeWebSocket(() => true, socket => {
    recordSingleGoalDenial(apiState, { method: 'WEBSOCKET', category: 'WEBSOCKET', reason: 'WEBSOCKET_REFUSED', external: new URL(socket.url()).origin !== BASE });
    socket.close();
  });
}

export function singleGoalNetworkReceipt(apiState, phase, shutdown = undefined) {
  return { phase, guardVersion: apiState.singleGoalGuardVersion,
    singleGoalNarrationRefusals: apiState.singleGoalNarrationRefusals ?? 0,
    deniedReasons: { ...apiState.singleGoalDeniedReasons }, deniedCategories: { ...apiState.singleGoalDeniedCategories },
    deniedSamples: (apiState.singleGoalRequestSamples ?? []).map(item => ({ ...item })), deniedSamplesOmitted: apiState.singleGoalSamplesOmitted ?? 0,
    deniedActions: apiState.deniedActions, deniedExternal: apiState.deniedExternal,
    singleGoalDeniedMutations: apiState.singleGoalDeniedMutations, singleGoalDeniedRequests: apiState.singleGoalDeniedRequests,
    ...(shutdown ? { shutdown } : {}) };
}
export function validSingleGoalNetwork(receipt, phase = 'after-cell-awaits') {
  return receipt?.phase === phase && receipt?.guardVersion === SINGLE_GOAL_NETWORK_VERSION
    && Number.isSafeInteger(receipt.singleGoalNarrationRefusals) && receipt.singleGoalNarrationRefusals >= 0
    && receipt.deniedReasons && Object.keys(receipt.deniedReasons).length === 0 && receipt.deniedCategories && Object.keys(receipt.deniedCategories).length === 0
    && Array.isArray(receipt.deniedSamples) && receipt.deniedSamples.length === 0 && receipt.deniedSamplesOmitted === 0
    && ['deniedActions', 'deniedExternal', 'singleGoalDeniedMutations', 'singleGoalDeniedRequests'].every(key => receipt[key] === 0)
    && (phase !== 'after-context-browser-close' || (receipt.shutdown?.contextClosed === true && receipt.shutdown?.browserClosed === true));
}
export function finalizeSingleGoalCell(cell, apiState, check) {
  cell.networkEvidence = singleGoalNetworkReceipt(apiState, 'after-cell-awaits');
  check(cell, 'FINAL_NETWORK_COUNTERS_ZERO', validSingleGoalNetwork(cell.networkEvidence), cell.networkEvidence);
}
