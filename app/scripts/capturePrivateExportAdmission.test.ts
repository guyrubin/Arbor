import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPrivateExportAdmissionBoundary } from './capture/private-export-admission.mjs';
import { validPrivateExportNetwork } from './capture/private-export-contract.mjs';
import { collectReleaseInteractions } from './capture/release-interactions.mjs';

// Exercise the collector's real registration path, but stop before creating a
// page. Browser, filesystem writes and public-font serving are test doubles.
const harness = vi.hoisted(() => ({ routes: [] as { matcher: any; handler: any }[] }));
vi.mock('node:os', () => ({ networkInterfaces: () => ({ lo: [{ internal: true, address: '127.0.0.1' }] }) }));
vi.mock('node:fs', async original => ({ ...await original<typeof import('node:fs')>(), existsSync: () => true, mkdirSync: vi.fn(), writeFileSync: vi.fn() }));
vi.mock('./capture/font-runtime.mjs', () => ({
  SOURCE_FONT_NOTE: 'Synthetic registration test only', captureFontContextOptions: () => ({}), captureScreenshot: vi.fn(),
  installOfflineFonts: async (context: any) => context.route((url: URL) => ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin),
    (route: any) => route.request().method() === 'GET' ? route.fulfill({ status: 200, body: 'synthetic cached font' }) : route.abort()),
}));
vi.mock('playwright', () => ({ chromium: { launch: async () => ({
  close: async () => {}, newContext: async () => ({
    route: async (matcher: any, handler: any) => { harness.routes.push({ matcher, handler }); },
    routeWebSocket: async () => {}, addInitScript: async () => {}, close: async () => {},
    newPage: async () => { throw new Error('REGISTRATION_COMPLETE_NO_BROWSER_CREATED'); },
  }),
}) } }));

const base = 'http://127.0.0.1:4805';
const child = 'capture-private-export-a';
const seed = { parent: { demo: true }, child: { id: 'seed', name: 'Invented', demo: true }, collections: { milestones: [] } };
const state = () => ({ privateExportNarrationRefusals: 0, privateExportDenied: 0, privateExportPrivateReads: 0, privateExportUnexpectedDownloads: 0,
  privateExportAuthHeaders: 0, privateExportHeaderChecks: 0, privateExportHeaderReadFailures: 0, privateExportHeaderReadsPending: 0, deniedActions: 0, deniedExternal: 0 });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const request = (allHeaders: () => any, url = `${base}/`, method = 'GET') => ({
  url: () => url, method: () => method, headers: vi.fn(() => ({})), allHeaders: vi.fn(allHeaders), postData: () => null,
});
async function boundary(allHeaders: () => any) {
  const apiState = state(); let handler: any;
  await installPrivateExportAdmissionBoundary({ route: async (_: string, handle: any) => { handler = handle; } }, apiState);
  const req = request(allHeaders);
  const route = { request: () => req, fallback: vi.fn(async () => {}), abort: vi.fn(async () => {}), fulfill: vi.fn(), fetch: vi.fn(), continue: vi.fn() };
  return { apiState, req, route, run: () => handler(route) };
}
async function registeredRoutes(group = 'private-export') {
  harness.routes.length = 0;
  for (const [name, value] of Object.entries({ ARBOR_CAPTURE_FONT_MODE: 'exact', MODEL_PROVIDER: 'mock', MEMORY_ADAPTER: 'local', REQUIRE_AUTH: 'false', LIVE_ENABLED: 'false' })) vi.stubEnv(name, value);
  await expect(collectReleaseInteractions({ output: '/capture-output', bundle: seed, viewport: { w: 1280, h: 800, lang: 'en' }, group, sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) })).rejects.toThrow('REGISTRATION_COMPLETE_NO_BROWSER_CREATED');
  return [...harness.routes];
}
function dispatch(routes: typeof harness.routes, req: ReturnType<typeof request>) {
  const url = new URL(req.url());
  const matches = routes.filter(({ matcher }) => typeof matcher === 'function' ? matcher(url)
    : matcher === '**/*' || (matcher === '**/api/**' && url.pathname.includes('/api/')) || (matcher === '**/sandbox/demo-family.json' && url.pathname.endsWith('/sandbox/demo-family.json'))).reverse();
  let next = 0;
  const response = { status: () => 200, headers: () => ({}), body: async () => Buffer.from('{}') };
  const route = { request: () => req, abort: vi.fn(async () => {}), continue: vi.fn(async () => {}), fulfill: vi.fn(async (_options: any) => {}),
    fetch: vi.fn(async () => response), fallback: vi.fn(async () => { const entry = matches[next++]; if (!entry) throw new Error('NO_DOWNSTREAM_ROUTE'); await entry.handler(route); }) };
  const first = matches[next++];
  return { route, run: () => first.handler(route) };
}

afterEach(() => vi.unstubAllEnvs());

describe('complete private-export request-header admission without a browser', () => {
  it.each(['authorization', 'AuThOrIzAtIoN', 'proxy-authorization', 'Cookie', 'cookie2', 'x-api-key', 'x-goog-api-key', 'x-firebase-appcheck', 'x-auth-token', 'x-access-token', 'x-id-token', 'x-csrf-token', 'x-xsrf-token'])('rejects %s even when headers() omits it and never retains its value', async name => {
    const test = await boundary(async () => ({ [name]: 'invented-sensitive-header-marker' }));
    await test.run();
    expect(test.req.headers).not.toHaveBeenCalled(); expect(test.req.allHeaders).toHaveBeenCalledOnce();
    expect(test.route.abort).toHaveBeenCalledOnce(); expect(test.route.fallback).not.toHaveBeenCalled();
    expect(test.apiState).toMatchObject({ privateExportAuthHeaders: 1, privateExportHeaderChecks: 1, privateExportHeaderReadFailures: 0, privateExportHeaderReadsPending: 0, privateExportDenied: 1, deniedActions: 1 });
    expect(validPrivateExportNetwork(test.apiState)).toBe(false);
    expect(JSON.stringify(test.apiState)).not.toContain('invented-sensitive-header-marker');
  });
  it('rejects even an empty credential header', async () => {
    const test = await boundary(async () => ({ cookie: '' })); await test.run();
    expect(test.apiState.privateExportAuthHeaders).toBe(1); expect(test.route.fallback).not.toHaveBeenCalled();
  });
  it.each([{}, { accept: 'application/json', 'sec-fetch-site': 'same-origin' }, Object.assign(Object.create(null), { accept: '*/*' })])('allows valid credential-free metadata only through unchanged fallback', async headers => {
    const test = await boundary(async () => headers); await test.run();
    expect(test.route.fallback).toHaveBeenCalledExactlyOnceWith(); expect(test.route.abort).not.toHaveBeenCalled();
    expect(test.route.continue).not.toHaveBeenCalled(); expect(test.route.fetch).not.toHaveBeenCalled(); expect(test.route.fulfill).not.toHaveBeenCalled();
    expect(validPrivateExportNetwork(test.apiState)).toBe(true);
  });
  it.each(['safe', 'credential', 'rejected'])('keeps deferred %s metadata fail-closed without fallback or success while pending', async outcome => {
    let resolve!: (value: any) => void; let reject!: (error: Error) => void;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    const test = await boundary(() => pending);
    expect(validPrivateExportNetwork(test.apiState)).toBe(false);
    const work = test.run(); await flush();
    expect(test.apiState.privateExportHeaderReadsPending).toBe(1); expect(test.apiState.privateExportHeaderChecks).toBe(0);
    expect(validPrivateExportNetwork(test.apiState)).toBe(false);
    expect(test.route.abort).not.toHaveBeenCalled(); expect(test.route.fallback).not.toHaveBeenCalled();
    if (outcome === 'rejected') reject(new Error('invented-sensitive-error-marker'));
    else resolve(outcome === 'safe' ? { accept: '*/*' } : { Cookie: 'invented-sensitive-header-marker' });
    await work;
    expect(test.apiState.privateExportHeaderReadsPending).toBe(0);
    expect(validPrivateExportNetwork(test.apiState)).toBe(outcome === 'safe');
    expect(test.route.fallback).toHaveBeenCalledTimes(outcome === 'safe' ? 1 : 0);
    expect(test.route.abort).toHaveBeenCalledTimes(outcome === 'safe' ? 0 : 1);
    expect(JSON.stringify(test.apiState)).not.toContain('invented-sensitive');
  });
  it.each([undefined, null, [], 'headers', 3, new Map(), { accept: 3 }, { accept: undefined }, { 'bad name': 'value' },
    { [Symbol('invalid')]: 'value' }, Object.create({ cookie: 'inherited' }), Object.defineProperty({}, 'cookie', { value: 'hidden' }),
    Object.defineProperty({}, 'cookie', { enumerable: true, get: () => { throw new Error('invented-sensitive-error-marker'); } }),
  ])('rejects malformed metadata without retaining values or errors (%#)', async metadata => {
    const test = await boundary(async () => metadata); await test.run();
    expect(test.apiState).toMatchObject({ privateExportHeaderChecks: 0, privateExportHeaderReadFailures: 1, privateExportHeaderReadsPending: 0, privateExportDenied: 1, deniedActions: 1 });
    expect(test.route.abort).toHaveBeenCalledOnce(); expect(test.route.fallback).not.toHaveBeenCalled();
    expect(validPrivateExportNetwork(test.apiState)).toBe(false); expect(JSON.stringify(test.apiState)).not.toContain('invented-sensitive');
  });
  it.each(['sync', 'async', 'missing'])('rejects %s metadata-reader failure before fallback', async mode => {
    const test = await boundary(() => { if (mode === 'sync') throw new Error('invented-sensitive-error-marker'); return Promise.reject(new Error('invented-sensitive-error-marker')); });
    if (mode === 'missing') (test.req as any).allHeaders = undefined;
    await test.run(); expect(test.apiState.privateExportHeaderReadFailures).toBe(1);
    expect(test.route.abort).toHaveBeenCalledOnce(); expect(test.route.fallback).not.toHaveBeenCalled(); expect(validPrivateExportNetwork(test.apiState)).toBe(false);
    expect(JSON.stringify(test.apiState)).not.toContain('invented-sensitive');
  });
});

describe('real collector registration and existing admission decisions', () => {
  const targets = [
    ['privacy', `${base}/api/privacy/export/${child}`, 'GET'], ['demo', `${base}/sandbox/demo-family.json`, 'GET'],
    ['font', 'https://fonts.gstatic.com/s/synthetic.woff2', 'GET'], ['static', `${base}/assets/synthetic.js`, 'GET'],
    ['narration refusal', `${base}/api/children/${child}/book-narration`, 'POST'], ['foreign', 'https://unrelated.invalid/file', 'GET'],
  ];
  it.each(targets)('executes the awaited complete-header boundary before %s', async (_label, url, method) => {
    const routes = await registeredRoutes();
    expect(routes).toHaveLength(5); expect(routes.at(-1)?.matcher).toBe('**/*');
    const req = request(async () => ({ Cookie: 'invented-sensitive-header-marker' }), url, method);
    const test = dispatch(routes, req); await test.run();
    expect(req.allHeaders).toHaveBeenCalledOnce(); expect(req.headers).not.toHaveBeenCalled();
    expect(test.route.abort).toHaveBeenCalledOnce(); expect(test.route.fallback).not.toHaveBeenCalled();
    expect(test.route.fetch).not.toHaveBeenCalled(); expect(test.route.fulfill).not.toHaveBeenCalled(); expect(test.route.continue).not.toHaveBeenCalled();
  });
  it.each(targets)('does not reach %s while complete metadata is deferred or unreadable', async (_label, url, method) => {
    const routes = await registeredRoutes(); let resolve!: (headers: any) => void;
    const req = request(() => new Promise(yes => { resolve = yes; }), url, method);
    const test = dispatch(routes, req); const work = test.run(); await flush();
    expect(test.route.fallback).not.toHaveBeenCalled(); expect(test.route.fetch).not.toHaveBeenCalled(); expect(test.route.fulfill).not.toHaveBeenCalled(); expect(test.route.continue).not.toHaveBeenCalled();
    resolve(null); await work; expect(test.route.abort).toHaveBeenCalledOnce(); expect(test.route.fallback).not.toHaveBeenCalled();
  });
  it('retains only the exact current-child narration refusal after safe metadata', async () => {
    const routes = await registeredRoutes(); const test = dispatch(routes, request(async () => ({}), `${base}/api/children/${child}/book-narration`, 'POST'));
    await test.run(); expect(test.route.fallback).toHaveBeenCalledOnce();
    expect(test.route.fulfill).toHaveBeenCalledExactlyOnceWith({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'synthetic_capture_media_disabled' }) });
    expect(test.route.fetch).not.toHaveBeenCalled(); expect(test.route.continue).not.toHaveBeenCalled();
  });
  it.each([
    [`${base}/api/privacy/export/sibling`, 'GET'], [`${base}/api/privacy/export/${child}/other`, 'GET'], [`${base}/api/privacy/export/${child}`, 'POST'],
    [`${base}/api/children/${child}/book-assets/book/file`, 'GET'], [`${base}/api/children/${child}/book-assets/sandbox/demo-family.json`, 'GET'],
    [`${base}/api/children/sibling/book-narration`, 'POST'], [`${base}/api/children/${child}/book-narration/other`, 'POST'],
    [`${base}/api/chat`, 'POST'], [`${base}/api/consent`, 'POST'], [`${base}/assets/synthetic.js`, 'POST'],
    [`${base}/sandbox/demo-family.json`, 'HEAD'], [`${base}/sandbox/demo-family.json`, 'POST'], ['https://unrelated.invalid/sandbox/demo-family.json', 'GET'],
  ])('preserves the existing deny for %s %s with credential-free metadata', async (url, method) => {
    const test = dispatch(await registeredRoutes(), request(async () => ({}), url, method)); await test.run();
    expect(test.route.abort).toHaveBeenCalledOnce(); expect(test.route.fetch).not.toHaveBeenCalled(); expect(test.route.fulfill).not.toHaveBeenCalled(); expect(test.route.continue).not.toHaveBeenCalled();
  });
  it.each([
    [`${base}/api/privacy/export/${child}`, 'GET', 'fetch'], [`${base}/api/entitlement`, 'GET', 'fetch'],
    [`${base}/api/todays-focus`, 'POST', 'fetch'], [`${base}/api/digest`, 'POST', 'fetch'],
    [`${base}/sandbox/demo-family.json`, 'GET', 'fulfill'], ['https://fonts.gstatic.com/s/synthetic.woff2', 'GET', 'fulfill'],
    [`${base}/assets/synthetic.js`, 'GET', 'continue'], [`${base}/assets/synthetic.js`, 'HEAD', 'continue'],
  ])('preserves the existing safe %s %s path without request overrides', async (url, method, action) => {
    const test = dispatch(await registeredRoutes(), request(async () => ({ accept: '*/*' }), url, method)); await test.run();
    expect(test.route.abort).not.toHaveBeenCalled(); expect(test.route.fallback).toHaveBeenCalledExactlyOnceWith();
    expect(test.route[action as 'fetch' | 'fulfill' | 'continue']).toHaveBeenCalledOnce();
  });
  it('does not install the private-export boundary in other capture groups', async () => {
    const routes = await registeredRoutes('ask'); expect(routes).toHaveLength(4);
    const req = request(async () => ({ cookie: 'synthetic' }), `${base}/assets/synthetic.js`);
    const test = dispatch(routes, req); await test.run();
    expect(req.allHeaders).not.toHaveBeenCalled(); expect(test.route.continue).toHaveBeenCalledOnce();
  });
});
