import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { SINGLE_GOAL_NETWORK_VERSION, singleGoalNarrationRefusals, recordSingleGoalDenial, singleGoalAssetPaths, singleGoalRequestDisposition, installSingleGoalNetworkGuard, singleGoalNetworkReceipt, validSingleGoalNetwork, finalizeSingleGoalCell } from './capture/single-goal-network.mjs';
import { deniedCaptureApiCategory, syntheticReleaseReport } from './capture/release-interactions.mjs';
import { buildBookNarration, narrationFolder } from '../src/components/kidmode/hero/buildBookNarration';
import { BASE } from './capture/config.mjs';
import { isCaptureDemoFamilyUrl } from './capture/first-run-preview-network.mjs';

const source = readFileSync(new URL('./capture/release-interactions.mjs', import.meta.url), 'utf8');
const childIds = ['capture-goal-history', 'capture-goal-empty', 'capture-goal-long'];
const fontUrls = ['https://fonts.googleapis.com/css2?family=Exact', 'https://fonts.gstatic.com/s/exact.woff2'];
const assetPaths = ['/index.html', '/assets/current.js', '/assets/current.css', '/brand/arbor-mark-128.webp'];
const fixtureChildren = childIds.map(id => ({ id, demo: true, gender: 'girl' }));
const scope = { childIds, fontUrls, assetPaths, narrationRefusals: singleGoalNarrationRefusals({ children: fixtureChildren }, 'en') };
const cleanApi = () => ({ singleGoalGuardVersion: SINGLE_GOAL_NETWORK_VERSION, deniedActions: 0, deniedExternal: 0, singleGoalDeniedMutations: 0, singleGoalDeniedRequests: 0 });
const classify = (method: string, path: string, extra = {}) => singleGoalRequestDisposition({ method, rawUrl: path.startsWith('http') ? path : BASE + path, ...extra }, scope);
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); vi.unstubAllGlobals(); });

// The installed Playwright pure glob compiler is executed without importing its
// browser/server entrypoints. The actual collector's registration bodies run
// below, with the real LIFO/fallback dispatch behavior and stub-only requests.
const playwright = readFileSync(new URL('../node_modules/playwright-core/lib/coreBundle.js', import.meta.url), 'utf8');
const globSource = playwright.slice(playwright.indexOf('function globToRegexPattern(glob) {'), playwright.indexOf('function isRegExp3(obj) {'));
const escapedSource = playwright.match(/escapedChars = [^\n]+/)![0];
const globCompiler = vm.runInNewContext(`let escapedChars; ${escapedSource}\n${globSource}; globToRegexPattern`);
async function routingHarness() {
  const routes: any[] = [], webSockets: any[] = [];
  const context = { route: async (match: any, handler: any) => { routes.unshift({ match, handler }); }, routeWebSocket: async (match: any, handler: any) => { webSockets.unshift({ match, handler }); } };
  const start = source.indexOf('    const apiState = {');
  const end = source.indexOf('    if (kidEntry) await context.addInitScript');
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const registration = source.slice(start, end);
  expect(registration.lastIndexOf('installSingleGoalNetworkGuard')).toBeGreaterThan(registration.indexOf('await installOfflineFonts(context)'));
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const fixture = { childId: childIds[0], children: fixtureChildren, parsed: { synthetic: 'current-only' } };
  const installFonts = async (ctx: any) => ctx.route((url: URL) => fontUrls.includes(url.href), (route: any) => route.fulfill({ status: 200, body: 'exact-cache-font' }));
  const execute = new AsyncFunction('context', 'BASE', 'singleGoal', 'kidEntry', 'fixture', 'kidEntryApiDisposition', 'deniedCaptureApiCategory', '_apiCache', 'syntheticReleaseReport', 'lang', 'installOfflineFonts', 'installSingleGoalNetworkGuard', 'recordSingleGoalDenial', 'singleGoalAssetPaths', 'validateFontCache', 'isCaptureDemoFamilyUrl',
    'let singleGoalApiState; const privateExport = false, firstRunPreview = false;\n' + registration + '\nreturn apiState;');
  const api = await execute(context, BASE, fixture, false, fixture, null, deniedCaptureApiCategory, new Map(), syntheticReleaseReport, 'en', installFonts, installSingleGoalNetworkGuard, recordSingleGoalDenial, () => assetPaths, () => ({ resources: new Map(fontUrls.map(url => [url, {}])) }), isCaptureDemoFamilyUrl);
  const dispatch = async (method: string, url: string, extras: any = {}) => {
    const before = { ...api }; let outcome = 'unhandled', fetchOptions: any = null, responseBody: any = null, responseStatus: number | null = null;
    const visited: string[] = []; let fetched = false;
    const headers = vi.fn(() => extras.headers ?? {});
    const allHeaders = vi.fn(async () => {
      if (extras.metadataError) throw new Error('Synthetic request metadata unavailable');
      return Object.hasOwn(extras, 'allHeaders') ? extras.allHeaders : extras.headers ?? {};
    });
    const request = { method: () => method, url: () => url, headers, allHeaders, postData: () => extras.body ?? null };
    const matches = routes.filter(item => typeof item.match === 'function' ? item.match(new URL(url)) : new RegExp(globCompiler(item.match)).test(url));
    const routeAt = (index: number): any => ({ request: () => request,
      continue: async () => { outcome = 'continue'; }, abort: async () => { outcome = 'abort'; },
      fulfill: async (value: any) => { responseBody = value.body; responseStatus = value.status; outcome = fetched ? 'fetch-then-fulfill' : 'fulfill'; },
      fetch: async (options: any) => { fetched = true; fetchOptions = options; return { status: () => extras.status ?? 200, headers: () => ({}), body: async () => Buffer.from('{}') }; },
      fallback: async () => { if (!matches[index + 1]) throw new Error('UNGUARDED_FALLBACK'); return invoke(index + 1); } });
    const invoke = async (index: number): Promise<any> => { visited.push(typeof matches[index].match === 'function' ? 'exact-font-cache' : matches[index].match); return matches[index].handler(routeAt(index)); };
    await invoke(0);
    return { outcome, fetched, fetchOptions, responseBody, responseStatus, visited, headerReads: { filtered: headers.mock.calls.length, complete: allHeaders.mock.calls.length }, delta: Object.fromEntries(['deniedActions', 'deniedExternal', 'singleGoalDeniedMutations', 'singleGoalDeniedRequests'].map(key => [key, api[key] - before[key]])) };
  };
  return { api, dispatch, routes, webSockets };
}

describe('actual single-goal routing precedence, without browser or network', () => {
  it('only the exact local GET fixture is fulfilled, ahead of every wildcard handler', async () => {
    const h = await routingHarness();
    expect(await h.dispatch('GET', BASE + '/sandbox/demo-family.json')).toMatchObject({ outcome: 'fulfill', fetched: false, visited: ['**/*'], responseBody: JSON.stringify({ synthetic: 'current-only' }), delta: { deniedActions: 0, deniedExternal: 0 } });
    for (const [method, url] of [
      ['POST', BASE + '/sandbox/demo-family.json'], ['GET', 'https://foreign.invalid/private/sandbox/demo-family.json'],
      ['POST', BASE + '/api/private/sandbox/demo-family.json'], ['GET', BASE + '/private/sandbox/demo-family.json'],
      ['GET', BASE + '/sandbox/demo-family.json?childId=foreign'], ['GET', BASE + '/sandbox/%64emo-family.json'],
      ['GET', BASE + '//sandbox/demo-family.json'], ['GET', BASE + '/sandbox/demo-family.json/extra'],
      ['GET', BASE + '/private/../sandbox/demo-family.json'], ['GET', BASE + '/private/%2e%2e/sandbox/demo-family.json'], ['GET', BASE + '/sandbox/demo-family.json#private'],
    ]) expect(await h.dispatch(method, url)).toMatchObject({ outcome: 'abort', fetched: false, visited: ['**/*'], delta: { deniedActions: 1, singleGoalDeniedRequests: 1 } });
  });
  it('denies auth, credentials, foreign-child paths and non-API writes before fetching or continuing', async () => {
    const h = await routingHarness();
    for (const [method, url, extras] of [
      ['POST', '/auth/sign-in', {}], ['GET', '/api/auth/session', {}], ['GET', '/api/children/foreign-child/profile', {}],
      ['GET', '/api/memory/foreign-child', {}], ['GET', '/api/consent/foreign-child', {}], ['GET', '/api/shares?childId=foreign-child', {}],
      ['GET', '/api/shares?childId=capture-goal-history&childId=foreign-child', {}], ['GET', '/api/tts?token=private', {}],
      ['GET', '/api/account', {}], ['POST', '/index.html', {}], ['DELETE', '/assets/current.js', {}],
      ['GET', '/assets/current.js', { headers: { Authorization: 'synthetic-forbidden-token' } }],
      ['GET', '/api/tts', { headers: { authorization: 'synthetic-forbidden-token' } }],
      ['GET', '/sandbox/demo-family.json', { headers: { Cookie: 'synthetic-forbidden-cookie' } }],
      ['POST', '/api/todays-focus', { body: JSON.stringify({ childProfile: { id: 'foreign-child', demo: true } }) }],
      ['POST', '/api/digest', { body: JSON.stringify({ childProfile: { id: childIds[0], demo: false } }) }],
    ] as [string, string, any][]) expect(await h.dispatch(method, BASE + url, extras)).toMatchObject({ outcome: 'abort', fetched: false, visited: ['**/*'], delta: { deniedActions: 1, singleGoalDeniedRequests: 1 } });
  });
  it('awaits complete headers and denies cookies omitted by the filtered headers API', async () => {
    const h = await routingHarness();
    for (const url of [BASE + '/sandbox/demo-family.json', BASE + '/assets/current.js', BASE + '/api/tts', fontUrls[1]]) {
      expect(await h.dispatch('GET', url, { headers: {}, allHeaders: { Cookie: 'synthetic-forbidden-cookie' } })).toMatchObject({
        outcome: 'abort', fetched: false, visited: ['**/*'], headerReads: { filtered: 0, complete: 1 },
        delta: { deniedActions: 1, singleGoalDeniedRequests: 1, deniedExternal: url.startsWith(BASE) ? 0 : 1 },
      });
    }
  });
  it('fails closed when complete request metadata rejects or is unavailable', async () => {
    const h = await routingHarness();
    for (const extras of [{ metadataError: true }, { allHeaders: null }, { allHeaders: undefined }, { allHeaders: [] }]) {
      expect(await h.dispatch('GET', BASE + '/sandbox/demo-family.json', extras)).toMatchObject({
        outcome: 'abort', fetched: false, visited: ['**/*'], headerReads: { filtered: 0, complete: 1 },
        delta: { deniedActions: 1, singleGoalDeniedRequests: 1, deniedExternal: 1 },
      });
    }
  });
  it('admits only actual scoped mock reads, current static assets and exact cached font URLs', async () => {
    const h = await routingHarness();
    for (const path of ['/api/tts', '/api/entitlement', ...childIds.map(id => '/api/memory/' + id), ...childIds.map(id => '/api/shares?childId=' + id)]) {
      expect(await h.dispatch('GET', BASE + path)).toMatchObject({ outcome: 'fetch-then-fulfill', fetched: true, fetchOptions: { maxRedirects: 0 }, delta: { deniedActions: 0, deniedExternal: 0 } });
    }
    for (const id of childIds) expect(await h.dispatch('GET', BASE + '/api/consent/' + id)).toMatchObject({ outcome: 'fulfill', fetched: false, delta: { deniedActions: 0 } });
    for (const path of ['/api/todays-focus', '/api/digest']) expect(await h.dispatch('POST', BASE + path, { body: JSON.stringify({ childProfile: { id: childIds[1], demo: true } }) })).toMatchObject({ outcome: 'fetch-then-fulfill', fetchOptions: { maxRedirects: 0 }, delta: { deniedActions: 0, singleGoalDeniedMutations: 0 } });
    for (const path of ['/?capture=release-single-goal-1234', ...assetPaths]) expect(await h.dispatch('GET', BASE + path)).toMatchObject({ outcome: 'continue', fetched: false, visited: ['**/*'], delta: { deniedActions: 0 } });
    for (const url of fontUrls) expect(await h.dispatch('GET', url)).toMatchObject({ outcome: 'fulfill', fetched: false, responseBody: 'exact-cache-font', visited: ['**/*', 'exact-font-cache'], delta: { deniedActions: 0, deniedExternal: 0 } });
    expect(await h.dispatch('GET', fontUrls[1] + '?private=1')).toMatchObject({ outcome: 'abort', fetched: false, delta: { deniedActions: 1, deniedExternal: 1 } });
  });
  it('counts only the exact automatic first narration request as a local refusal after complete metadata checks', async () => {
    const h = await routingHarness();
    for (const row of scope.narrationRefusals) {
      const result = await h.dispatch('POST', BASE + row.path, { body: JSON.stringify(row.body) });
      expect(result).toMatchObject({ outcome: 'fulfill', fetched: false, visited: ['**/*'], responseStatus: 409,
        responseBody: JSON.stringify({ code: 'synthetic_capture_media_disabled' }), headerReads: { filtered: 0, complete: 1 },
        delta: { deniedActions: 0, singleGoalDeniedRequests: 0, singleGoalDeniedMutations: 0 } });
    }
    expect(singleGoalNetworkReceipt(h.api, 'after-cell-awaits')).toMatchObject({ singleGoalNarrationRefusals: 3, deniedReasons: {}, deniedCategories: {} });
    const row = scope.narrationRefusals[0];
    for (const [method, url, extras] of [
      ['GET', BASE + row.path, { body: JSON.stringify(row.body) }],
      ['POST', BASE + row.path + '/extra', { body: JSON.stringify(row.body) }],
      ['POST', BASE + row.path + '?childId=foreign', { body: JSON.stringify(row.body) }],
      ['POST', BASE + row.path + '#private', { body: JSON.stringify(row.body) }],
      ['POST', BASE + row.path.replace('capture-goal-history', 'sibling-real'), { body: JSON.stringify(row.body) }],
      ['POST', 'https://foreign.invalid' + row.path, { body: JSON.stringify(row.body) }],
      ['POST', BASE + row.path.replace('book-narration', 'book-assets'), { body: JSON.stringify(row.body) }],
      ...['PUT', 'PATCH', 'DELETE'].map(method => [method, BASE + row.path, { body: JSON.stringify(row.body) }]),
      ...[null, 'not json', '{}', '[]', JSON.stringify({ ...row.body, childId: childIds[0] }),
        JSON.stringify({ ...row.body, file: 'p9.mp3' }), JSON.stringify({ ...row.body, lang: 'he-f' }),
        JSON.stringify({ ...row.body, bookId: 'another-book' })].map(body => ['POST', BASE + row.path, { body }]),
      ['POST', BASE + row.path, { body: JSON.stringify(row.body), allHeaders: { Cookie: 'private-never-record' } }],
      ['POST', BASE + row.path, { body: JSON.stringify(row.body), headers: { authorization: 'private-never-record' } }],
      ['POST', BASE + row.path, { body: JSON.stringify(row.body), metadataError: true }],
      ['POST', BASE + row.path, { body: JSON.stringify(row.body), allHeaders: { other: null } }],
    ] as [string, string, any][]) expect(await h.dispatch(method, url, extras)).toMatchObject({ outcome: 'abort', fetched: false, visited: ['**/*'], delta: { deniedActions: 1, singleGoalDeniedRequests: 1 } });
    expect(h.api.singleGoalNarrationRefusals).toBe(3);
    const receipt = singleGoalNetworkReceipt(h.api, 'after-cell-awaits');
    expect(receipt.deniedCategories.BOOK_NARRATION).toBeGreaterThan(0);
    expect(receipt.deniedReasons.CREDENTIALS_REFUSED).toBe(2);
    expect(JSON.stringify(receipt)).not.toMatch(/private-never-record|sibling-real|another-book|childId|https?:/);
    expect(receipt.deniedSamples.length).toBeLessThanOrEqual(24);
  });
  it.each(['en', 'he'] as const)('%s refusal matches the first request made by the actual source builder and stops it without success', async lang => {
    for (const gender of ['girl', 'boy'] as const) {
      const child = { id: childIds[0], gender, demo: true };
      const [row] = singleGoalNarrationRefusals({ children: [child] }, lang);
      const render = vi.fn(async () => ({ ok: false as const, status: 409, code: 'synthetic_capture_media_disabled' }));
      const keepLocalDoc = vi.fn(), sleep = vi.fn();
      expect(await buildBookNarration({ childId: child.id, folder: narrationFolder(lang, gender) }, { render, keepLocalDoc, sleep })).toMatchObject({ status: 'not-started', rendered: 0, stoppedBy: 'synthetic_capture_media_disabled' });
      expect(render).toHaveBeenCalledExactlyOnceWith(row.body);
      expect(keepLocalDoc).not.toHaveBeenCalled(); expect(sleep).not.toHaveBeenCalled();
    }
    expect(() => singleGoalNarrationRefusals({ children: [{ id: 'foreign', demo: true }] }, lang)).toThrow();
    expect(() => singleGoalNarrationRefusals({ children: [{ id: childIds[0], demo: false }] }, lang)).toThrow();
  });
  it('caps passive denial samples while preserving every fixed-category count', async () => {
    const h = await routingHarness();
    for (let n = 0; n < 27; n++) await h.dispatch('POST', BASE + '/api/children/private-' + n + '/book-narration', { body: 'private-body' });
    const receipt = singleGoalNetworkReceipt(h.api, 'after-cell-awaits');
    expect(receipt).toMatchObject({ singleGoalDeniedRequests: 27, deniedCategories: { BOOK_NARRATION: 27 }, deniedReasons: { API_SCOPE_REFUSED: 27 }, deniedSamplesOmitted: 3 });
    expect(receipt.deniedSamples).toHaveLength(24); expect(JSON.stringify(receipt)).not.toMatch(/private-/);
    expect(validSingleGoalNetwork(receipt)).toBe(false);
  });
  it('refuses redirects from mock reads and records WebSocket attempts', async () => {
    const h = await routingHarness();
    expect(await h.dispatch('GET', BASE + '/api/tts', { status: 302 })).toMatchObject({ outcome: 'abort', fetched: true, fetchOptions: { maxRedirects: 0 }, delta: { deniedActions: 1, singleGoalDeniedRequests: 1 } });
    const close = vi.fn(); h.webSockets[0].handler({ url: () => 'wss://foreign.invalid/channel', close });
    expect(close).toHaveBeenCalledOnce(); expect(h.api).toMatchObject({ deniedActions: 2, deniedExternal: 1, singleGoalDeniedRequests: 2, singleGoalDeniedMutations: 1 });
  });
  it('derives only existing built files and refuses symlink inventories', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'single-goal-assets-')); roots.push(root); mkdirSync(path.join(root, 'assets')); writeFileSync(path.join(root, 'index.html'), 'synthetic'); writeFileSync(path.join(root, 'assets/current.js'), 'synthetic');
    expect(singleGoalAssetPaths(root).sort()).toEqual(['/assets/current.js', '/index.html']);
    symlinkSync(path.join(root, 'index.html'), path.join(root, 'assets/link.js'));
    expect(() => singleGoalAssetPaths(root)).toThrow('SINGLE_GOAL_ASSET_SYMLINK_REFUSED');
    expect(classify('GET', '/auth/sign-in').kind).toBe('deny');
  });
});

describe('post-shot and terminal network evidence', () => {
  it('resamples the live counters after pending screenshot/readiness work', async () => {
    const api = cleanApi(); const cell: any = { assertions: [], failures: [] };
    const before = singleGoalNetworkReceipt(api, 'after-cell-awaits'); expect(validSingleGoalNetwork(before)).toBe(true);
    await Promise.resolve().then(() => { api.deniedActions++; api.deniedExternal++; });
    const check = (cell: any, id: string, passed: boolean, observed: any) => { cell.assertions.push({ id, passed, observed }); if (!passed) cell.failures.push(id); };
    finalizeSingleGoalCell(cell, api, check);
    expect(cell.networkEvidence).toMatchObject({ deniedActions: 1, deniedExternal: 1, phase: 'after-cell-awaits' });
    expect(cell.failures).toEqual(['FINAL_NETWORK_COUNTERS_ZERO']);
    const screen = source.slice(source.indexOf('    const screen = async'), source.indexOf("    if (group === 'single-goal')"));
    expect(screen.indexOf('finalizeSingleGoalCell(cell, apiState, check)')).toBeGreaterThan(screen.indexOf('cell.readiness = await readinessSnapshot()'));
    expect(screen.indexOf('finalizeSingleGoalCell(cell, apiState, check)')).toBeGreaterThan(screen.indexOf('await captureScreenshot'));
    expect(screen.indexOf('finalizeSingleGoalCell(cell, apiState, check)')).toBeLessThan(screen.indexOf('cell.reached ='));
  });
  it('requires every zero counter and successful closed context/browser final phase', () => {
    const api = cleanApi(); const positive = singleGoalNetworkReceipt(api, 'after-context-browser-close', { contextClosed: true, browserClosed: true });
    expect(validSingleGoalNetwork(positive, 'after-context-browser-close')).toBe(true);
    for (const key of ['deniedActions', 'deniedExternal', 'singleGoalDeniedMutations', 'singleGoalDeniedRequests']) {
      expect(validSingleGoalNetwork({ ...positive, [key]: 1 }, 'after-context-browser-close')).toBe(false);
      const missing: any = { ...positive }; delete missing[key]; expect(validSingleGoalNetwork(missing, 'after-context-browser-close')).toBe(false);
    }
    expect(validSingleGoalNetwork({ ...positive, shutdown: { contextClosed: false, browserClosed: true } }, 'after-context-browser-close')).toBe(false);
    const final = source.slice(source.lastIndexOf('  } finally {'));
    expect(final.indexOf('doc.singleGoalFinalNetwork =')).toBeGreaterThan(final.indexOf('await browser.close()'));
    expect(final.indexOf('doc.singleGoalFinalNetwork =')).toBeGreaterThan(final.indexOf('await context.close()'));
    expect(final.indexOf('doc.completed =')).toBeGreaterThan(final.indexOf('doc.singleGoalFinalNetwork ='));
    expect(final).toContain("validSingleGoalNetwork(doc.singleGoalFinalNetwork, 'after-context-browser-close')");
  });
});
