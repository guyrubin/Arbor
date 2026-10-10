/** Capture-only admission. No header values or metadata errors enter evidence. */
const credentialHeaders = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'cookie2',
  'x-api-key', 'x-goog-api-key', 'x-firebase-appcheck',
  'x-auth-token', 'x-access-token', 'x-id-token', 'x-csrf-token', 'x-xsrf-token',
]);

async function headerDisposition(request) {
  try {
    // headers() deliberately omits security/cookie headers in Playwright.
    const headers = await request.allHeaders();
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(headers))) return 'unreadable';
    const names = Reflect.ownKeys(headers);
    if (!names.every(name => {
      if (typeof name !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(headers, name);
      return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string';
    })) return 'unreadable';
    // Presence is enough, including an empty credential header. Never retain values.
    return names.some(name => credentialHeaders.has(name.toLowerCase())) ? 'credential' : 'safe';
  } catch { return 'unreadable'; }
}

/** Register LAST: Playwright executes matching context routes in reverse order.
 * Safe requests fall through to the existing exact API/demo/font/static guards;
 * this boundary never admits, fulfills, fetches or changes any request itself.
 */
export async function installPrivateExportAdmissionBoundary(context, apiState) {
  await context.route('**/*', async route => {
    apiState.privateExportHeaderReadsPending++;
    const disposition = await headerDisposition(route.request());
    apiState.privateExportHeaderReadsPending--;
    if (disposition === 'unreadable') apiState.privateExportHeaderReadFailures++;
    else apiState.privateExportHeaderChecks++;
    if (disposition !== 'safe') {
      if (disposition === 'credential') apiState.privateExportAuthHeaders++;
      apiState.privateExportDenied++;
      apiState.deniedActions++;
      return route.abort();
    }
    return route.fallback();
  });
}
