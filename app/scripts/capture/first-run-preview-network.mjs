/** Capture-only, highest-priority boundary. No server/auth behavior is replaced. */
import { BASE } from './config.mjs';
import { firstRunPreviewApiDisposition } from './first-run-preview-contract.mjs';

/** The public fixture must never alias a foreign origin or private API suffix. */
export function isCaptureDemoFamilyUrl(url) {
  return url.origin === BASE && url.pathname === '/sandbox/demo-family.json';
}

export async function installFirstRunPreviewBoundary(context, apiState) {
  // Register after API, fixture and exact-font routes: Playwright executes the
  // newest matching handler first. Use fallback for safe reads, never continue,
  // so the existing fixture/font/external-denial contracts remain authoritative.
  await context.route(url => url.origin === BASE, route => {
    const request = route.request();
    const url = new URL(request.url());
    if (firstRunPreviewApiDisposition(request.method(), url.pathname) === 'deny') {
      apiState.firstRunDeniedWrites++;
      apiState.deniedActions++;
      return route.abort();
    }
    return route.fallback();
  });
}
