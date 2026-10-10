/** Capture-only, highest-priority boundary. No server/auth behavior is replaced. */
import { BASE } from './config.mjs';
import { firstRunPreviewApiDisposition } from './first-run-preview-contract.mjs';

/** The public fixture must never alias a foreign origin or private API suffix. */
export function isCaptureDemoFamilyUrl(url) {
  return url.origin === BASE && url.pathname === '/sandbox/demo-family.json';
}

/** Native collector scope, populated only after observing the real local form save. */
export function createFirstRunPreviewScope() {
  let childId = null;
  return Object.freeze({
    recordCreatedChild(id) {
      if (typeof id !== 'string' || !/^child-\d{10,17}$/.test(id) || (childId !== null && childId !== id)) return false;
      childId = id;
      return true;
    },
    createdChildId: () => childId,
  });
}

/** Only bounded enums leave the request boundary. Never retain raw paths/IDs,
 * URL queries, request objects, payloads, headers or error strings. */
export function firstRunRequestDiagnostic(method, pathname, childId = null) {
  const safeMethod = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method) ? method : 'OTHER';
  const category = childId && pathname === `/api/children/${encodeURIComponent(childId)}/book-narration` ? 'CREATED_CHILD_BOOK_NARRATION'
    : /^\/api\/children\/[^/]+\/book-narration$/.test(pathname) ? 'OTHER_CHILD_BOOK_NARRATION'
      : pathname === '/api/onboarding/family-child' ? 'ONBOARDING_OWNERSHIP'
        : pathname === '/api/chat' ? 'CHAT'
          : pathname === '/api/todays-focus' ? 'TODAYS_FOCUS'
            : pathname === '/api/digest' ? 'DIGEST'
              : pathname === '/sandbox/demo-family.json' ? 'DEMO_BUNDLE'
                : pathname.startsWith('/webhooks/billing/') ? 'BILLING_WEBHOOK'
                  : pathname.startsWith('/api/') ? 'OTHER_API' : 'OTHER_PATH';
  return { method: safeMethod, category };
}
export function recordFirstRunRequest(apiState, diagnostic, disposition) {
  const stats = apiState.firstRunRequestDiagnostics ??= { counts: {}, recent: [] };
  const key = `${diagnostic.method}:${diagnostic.category}:${disposition}`;
  stats.counts[key] = Math.min((stats.counts[key] ?? 0) + 1, 1_000_000);
  stats.recent.push({ ...diagnostic, disposition });
  if (stats.recent.length > 8) stats.recent.shift();
}
export function firstRunNetworkSnapshot(apiState) {
  const stats = apiState.firstRunRequestDiagnostics ?? { counts: {}, recent: [] };
  return { firstRunDeniedWrites: apiState.firstRunDeniedWrites, firstRunNarrationRefusals: apiState.firstRunNarrationRefusals,
    firstRunRequestDiagnostics: { counts: { ...stats.counts }, recent: stats.recent.map(row => ({ ...row })) } };
}

export async function installFirstRunPreviewBoundary(context, apiState, scope = createFirstRunPreviewScope()) {
  // Last registration runs first. Safe reads fall back to existing handlers.
  await context.route(url => url.origin === BASE, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const childId = scope.createdChildId();
    const diagnostic = firstRunRequestDiagnostic(request.method(), url.pathname, childId);
    // headers() omits security/cookie metadata in Playwright. Inspect complete
    // header names before any fixture/refusal/read; retain neither names nor values.
    let anonymous = false;
    try {
      const headers = await request.allHeaders();
      anonymous = !!headers && typeof headers === 'object' && !Array.isArray(headers)
        && !Object.keys(headers).some(name => /^(?:authorization|proxy-authorization|cookie|x-api-key|x-auth-token|x-goog-api-key|x-firebase-appcheck)$/i.test(name))
        && !url.username && !url.password;
    } catch { /* Missing or unreadable complete metadata is denied, never guessed. */ }
    if (!anonymous) {
      apiState.firstRunDeniedWrites++;
      apiState.deniedActions++;
      recordFirstRunRequest(apiState, diagnostic, 'denied-auth-or-metadata');
      return route.abort();
    }
    // Exact runtime-observed endpoint for the child this UI actually created.
    // This local refusal never reaches a provider, succeeds, caches media or
    // certifies remote creation. Unrecorded/other children remain denied.
    if (request.method() === 'POST' && childId && !url.search && !url.hash
      && url.pathname === `/api/children/${encodeURIComponent(childId)}/book-narration`) {
      apiState.firstRunNarrationRefusals++;
      recordFirstRunRequest(apiState, diagnostic, 'synthetic-409-refusal');
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'synthetic_capture_media_disabled' }) });
    }
    if (firstRunPreviewApiDisposition(request.method(), url.pathname) === 'deny') {
      apiState.firstRunDeniedWrites++;
      apiState.deniedActions++;
      recordFirstRunRequest(apiState, diagnostic, 'denied');
      return route.abort();
    }
    return route.fallback();
  });
}
