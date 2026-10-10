/** Capture-only request admission, independent of application/auth/provider code. */
import { readdirSync } from 'node:fs';
import { BASE } from './config.mjs';

export const SINGLE_GOAL_NETWORK_VERSION = 'single-goal-exact-requests-v1';
const READS = new Set(['/api/tts', '/api/entitlement', '/api/live/availability']);
const MOCK_POST_READS = new Set(['/api/todays-focus', '/api/digest']);
const credentials = /^(authorization|proxy-authorization|cookie|x-api-key|x-auth-token)$/i;

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
export function singleGoalRequestDisposition({ method, rawUrl, headers = {}, body = null }, { childIds, assetPaths, fontUrls }) {
  let url;
  try { url = new URL(rawUrl); } catch { return { kind: 'deny', reason: 'INVALID_URL', external: true }; }
  const external = url.origin !== BASE;
  const deny = reason => ({ kind: 'deny', reason, external });
  if (url.username || url.password || Object.keys(headers).some(key => credentials.test(key))) return deny('CREDENTIALS_REFUSED');
  if (external) return method === 'GET' && fontUrls.includes(url.href) ? { kind: 'font' } : deny('EXTERNAL_REQUEST_REFUSED');
  // Reject alternate spellings, traversal and query aliases before dispatch.
  if (url.href !== rawUrl || /%|\\|\/\//.test(url.pathname)) return deny('PATH_ENCODING_REFUSED');
  if (url.pathname === '/sandbox/demo-family.json') return method === 'GET' && !url.search && !url.hash ? { kind: 'fixture' } : deny('FIXTURE_METHOD_OR_QUERY_REFUSED');
  if (/^\/(?:auth|oauth|login|sign-in)(?:\/|$)/i.test(url.pathname)) return deny('AUTH_PATH_REFUSED');
  if (url.pathname.startsWith('/api/')) {
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
export async function installSingleGoalNetworkGuard(context, { fixture, apiState, assetPaths, fontUrls }) {
  const scope = { childIds: fixture.children.map(child => child.id), assetPaths, fontUrls };
  apiState.singleGoalGuardVersion = SINGLE_GOAL_NETWORK_VERSION;
  await context.route('**/*', async route => {
    let method;
    let disposition;
    try {
      const request = route.request();
      method = request.method();
      // headers() omits cookie/security headers; admission needs the complete set.
      const headers = await request.allHeaders();
      if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error('INVALID_REQUEST_HEADERS');
      disposition = singleGoalRequestDisposition({ method, rawUrl: request.url(), headers, body: request.postData() }, scope);
    } catch {
      // Unreadable metadata cannot prove a safe method, origin or credentials.
      disposition = { kind: 'deny', reason: 'REQUEST_METADATA_UNAVAILABLE', external: true };
    }
    if (disposition.kind === 'deny') {
      apiState.deniedActions++;
      apiState.singleGoalDeniedRequests++;
      if (method !== 'GET') apiState.singleGoalDeniedMutations++;
      if (disposition.external) apiState.deniedExternal++;
      return route.abort();
    }
    if (disposition.kind === 'fixture') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.parsed) });
    if (disposition.kind === 'static') return route.continue();
    return route.fallback(); // exact cached font or scoped existing mock-server read
  });
  await context.routeWebSocket(() => true, socket => {
    apiState.deniedActions++; apiState.singleGoalDeniedRequests++;
    apiState.singleGoalDeniedMutations++;
    if (new URL(socket.url()).origin !== BASE) apiState.deniedExternal++;
    socket.close();
  });
}

export function singleGoalNetworkReceipt(apiState, phase, shutdown = undefined) {
  return { phase, guardVersion: apiState.singleGoalGuardVersion,
    deniedActions: apiState.deniedActions, deniedExternal: apiState.deniedExternal,
    singleGoalDeniedMutations: apiState.singleGoalDeniedMutations, singleGoalDeniedRequests: apiState.singleGoalDeniedRequests,
    ...(shutdown ? { shutdown } : {}) };
}
export function validSingleGoalNetwork(receipt, phase = 'after-cell-awaits') {
  return receipt?.phase === phase && receipt?.guardVersion === SINGLE_GOAL_NETWORK_VERSION
    && ['deniedActions', 'deniedExternal', 'singleGoalDeniedMutations', 'singleGoalDeniedRequests'].every(key => receipt[key] === 0)
    && (phase !== 'after-context-browser-close' || (receipt.shutdown?.contextClosed === true && receipt.shutdown?.browserClosed === true));
}
export function finalizeSingleGoalCell(cell, apiState, check) {
  cell.networkEvidence = singleGoalNetworkReceipt(apiState, 'after-cell-awaits');
  check(cell, 'FINAL_NETWORK_COUNTERS_ZERO', validSingleGoalNetwork(cell.networkEvidence), cell.networkEvidence);
}
