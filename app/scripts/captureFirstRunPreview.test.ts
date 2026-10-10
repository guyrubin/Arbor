import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIRST_RUN_PREVIEW_BOUNDARY, FIRST_RUN_PREVIEW_LIMITATIONS, FIRST_RUN_PREVIEW_STATES, firstRunPreviewApiDisposition, firstRunPreviewProfileFacts, firstRunPreviewPrimaryShot, firstRunPreviewRequiredAssertions, firstRunPreviewText, validFirstRunPreviewCell, validFirstRunNetworkEvidence } from './capture/first-run-preview-contract.mjs';
import { observeFirstRunPreview } from './capture/first-run-preview-states.mjs';
import { installFirstRunPreviewBoundary, isCaptureDemoFamilyUrl, firstRunRequestDiagnostic, firstRunNetworkSnapshot } from './capture/first-run-preview-network.mjs';
import { releaseCell, releaseEnvironment, releaseMatrix, RELEASE_VIEWPORTS } from './capture/release-config.mjs';
import { deniedCaptureApiCategory, expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';
import { firstRunCard, initialFirstRunState } from '../src/lib/onboardingFirstRun';
import { ONBOARDING_NOTICE_REVIEWS } from '../src/content/onboardingNoticeRelease';
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
function cellFor(state: string, viewport = RELEASE_VIEWPORTS[0]) {
  return { route: 'onboarding-dev-preview', state, group: 'first-run-preview', lang: viewport.lang, viewport: `${viewport.w}x${viewport.h}`, ...identity,
    fixture: 'existing-dev-onboarding-preview', firstRunPreview: FIRST_RUN_PREVIEW_BOUNDARY, reached: true, shot: firstRunPreviewPrimaryShot({ state, viewport: `${viewport.w}x${viewport.h}`, lang: viewport.lang }),
    assertions: firstRunPreviewRequiredAssertions(state).map((id: string) => ({ id, passed: true })), failures: [], frames: [{ ready: true }], networkEvidence: { firstRunDeniedWrites: 0, firstRunNarrationRefusals: 0, firstRunRequestDiagnostics: { counts: {}, recent: [] }, mockRequests: 0, deniedExternal: 0, deniedActions: 0 } };
}
function records() {
  return releaseMatrix('first-run-preview-only').map((spec: any) => {
    const cell = releaseCell(spec), cells = FIRST_RUN_PREVIEW_STATES.map(({ state }: any) => cellFor(state, cell.viewport));
    return { capture: { ...identity, cell, completed: true, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' }, clientMode: 'existing-dev-onboarding-preview', serverMode: 'existing-local-vite-handler' },
      inventory: { ...identity, routeIds: ROUTE_IDS, contracts: SURFACE_CONTRACTS }, evidence: { ...identity, completed: true, firstRunPreview: FIRST_RUN_PREVIEW_BOUNDARY, cells },
      shotNames: cells.map((row: any) => row.shot.split('/').pop()), fonts: { mode: 'exact', deniedFontRequests: 0, shots: cells.map((row: any) => ({ shot: row.shot.split('/').pop(), passed: true, rendered: [{ custom: true }] })) } };
  });
}
afterEach(() => vi.unstubAllGlobals());
describe('bounded existing first-run DEV preview evidence', () => {
  it('adds exactly four preview shards and 104 cells without changing the 24-shard parent release', () => {
    expect(releaseMatrix('first-run-preview-only')).toHaveLength(4);
    expect(FIRST_RUN_PREVIEW_STATES).toHaveLength(26);
    expect(new Set(FIRST_RUN_PREVIEW_STATES.map((row: any) => row.state)).size).toBe(26);
    expect(releaseMatrix('parent-kid-release')).toHaveLength(24);
    expect(releaseMatrix('parent-kid-release').some((row: any) => row.group === 'first-run-preview')).toBe(false);
    for (const viewport of RELEASE_VIEWPORTS) expect(expectedReleaseInteractionStates('first-run-preview', viewport)).toHaveLength(26);
  });
  it('keeps other runners in production with unchanged mock/network/credential isolation', () => {
    for (const group of ['base', 'record', 'kid-entry', 'kept-search', 'focused', undefined]) expect(releaseEnvironment(identity.sourceSha, group).NODE_ENV).toBe('production');
    const preview = releaseEnvironment(identity.sourceSha, 'first-run-preview');
    expect(preview).toMatchObject({ NODE_ENV: 'development', MODEL_PROVIDER: 'mock', MEMORY_ADAPTER: 'local', VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_PROJECT_ID: '', DISABLE_HMR: 'true', LIVE_ENABLED: 'false' });
    const { NODE_ENV: ignored, ...rest } = preview;
    const { NODE_ENV: prod, ...ordinary } = releaseEnvironment(identity.sourceSha);
    expect(rest).toEqual(ordinary);
  });
  it('requires every named assertion, ready frame and explicit non-auth boundary', () => {
    const viewport = RELEASE_VIEWPORTS[0], cells = FIRST_RUN_PREVIEW_STATES.map(({ state }: any) => cellFor(state));
    expect(missingReleaseInteractionEvidence(cells, { group: 'first-run-preview', viewport, ...identity })).toEqual([]);
    for (const original of cells) {
      for (const assertion of original.assertions) {
        const amended = { ...original, assertions: original.assertions.filter((row: any) => row.id !== assertion.id) };
        expect(validFirstRunPreviewCell(amended)).toBe(false);
        expect(missingReleaseInteractionEvidence([amended, ...cells.filter((row: any) => row !== original)], { group: 'first-run-preview', viewport, ...identity })).toHaveLength(1);
      }
      for (const patch of [{ firstRunPreview: undefined }, { firstRunPreview: { ...FIRST_RUN_PREVIEW_BOUNDARY, productionGateVerified: true } }, { firstRunPreview: { ...FIRST_RUN_PREVIEW_BOUNDARY, remoteAcknowledgementVerified: true } }, { fixture: 'fake-auth' }, { frames: [] }, { frames: [{ ready: false }] }, { networkEvidence: { firstRunDeniedWrites: 1, mockRequests: 0 } }, { networkEvidence: { firstRunDeniedWrites: 0, mockRequests: 1, deniedExternal: 0 } }, { networkEvidence: { firstRunDeniedWrites: 0, mockRequests: 0, deniedExternal: 1 } }]) expect(validFirstRunPreviewCell({ ...original, ...patch })).toBe(false);
    }
    expect(validFirstRunPreviewCell({ state: 'made-up' })).toBe(false);
  });
  it('requires source identity, DEV boundary, exact fonts and PNGs in the aggregate', () => {
    expect(summarizeRelease(records(), identity, 'first-run-preview-only')).toMatchObject({ completed: true, expectedShards: 4, interactionCells: 104, baseCells: 0, screenshots: 104 });
    for (const change of [
      (r: any[]) => { r[0].capture.clientMode = 'vite-production-build'; },
      (r: any[]) => { r[0].capture.serverMode = 'unknown'; },
      (r: any[]) => { r[0].evidence.firstRunPreview = { ...FIRST_RUN_PREVIEW_BOUNDARY, remoteAcknowledgementVerified: true }; },
      (r: any[]) => { r[0].shotNames.pop(); },
      (r: any[]) => { r[0].fonts.shots[0].rendered[0].custom = false; },
      (r: any[]) => { r[0].capture.sourceTreeSha = 'c'.repeat(40); },
      (r: any[]) => { r[0].evidence.cells[0].assertions.pop(); },
      (r: any[]) => { r.pop(); },
      (r: any[]) => { r[0].evidence.cells.push(r[0].evidence.cells[0]); },
    ]) { const input = records(); change(input); expect(summarizeRelease(input, identity, 'first-run-preview-only').completed).toBe(false); }
    expect(summarizeRelease(records(), identity, 'parent-kid-release').completed).toBe(false);
    expect(summarizeRelease(records(), identity, 'first-run-preview-only').note).toContain('remain BLOCKED');
  });
  it('refuses every remote mutation/model endpoint before generic collector routes', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) for (const pathname of ['/api/chat', '/api/todays-focus', '/api/onboarding/family-child', '/api/consent', '/api/shares', '/api/erase', '/api/generate-avatar']) expect(firstRunPreviewApiDisposition(method, pathname)).toBe('deny');
    for (const path of ['/api/chat', '/api/live/session', '/api/voice/start', '/api/vision', '/api/onboarding/family-child']) expect(firstRunPreviewApiDisposition('GET', path)).toBe('deny');
    for (const path of ['/api/live/availability', '/api/tts', '/api/shares', '/api/entitlement']) expect(firstRunPreviewApiDisposition('GET', path)).toBe('read');
    const source = read('./capture/release-interactions.mjs');
    expect(source.indexOf('if (firstRunPreview && firstRunPreviewApiDisposition')).toBeLessThan(source.indexOf("if (url.pathname === '/api/chat'"));
    expect(source).toContain("if (firstRunPreview && process.env.NODE_ENV !== 'development')");
  });

  it('requires 104 distinct canonical primary PNGs even if aliased or unlabelled files have passing font records', () => {
    const rebuildFiles = (record: any) => {
      record.shotNames = [...new Set(record.evidence.cells.map((cell: any) => cell.shot.split('/').pop()))];
      record.fonts.shots = record.shotNames.map((shot: string) => ({ shot, passed: true, rendered: [{ custom: true }] }));
    };
    expect(summarizeRelease(records(), identity, 'first-run-preview-only')).toMatchObject({ completed: true, primaryScreenshots: 104, expectedPrimaryScreenshots: 104 });
    const aliased = records();
    for (const record of aliased) { for (const cell of record.evidence.cells) cell.shot = record.evidence.cells[0].shot; rebuildFiles(record); }
    expect(summarizeRelease(aliased, identity, 'first-run-preview-only')).toMatchObject({ completed: false, screenshots: 4 });
    for (const rename of [
      (path: string) => path.replace('first-run-preview', 'screen'),
      (path: string) => path.replace('.dev-only.', '.'),
      (path: string) => path.replace('.en.', '.he.'),
      (path: string) => path.replace('375x812', '1280x800'),
      (_path: string) => 'shots/screen-0.png',
    ]) {
      const input = records(); input[0].evidence.cells[0].shot = rename(input[0].evidence.cells[0].shot); rebuildFiles(input[0]);
      expect(summarizeRelease(input, identity, 'first-run-preview-only').completed).toBe(false);
    }
    const crossState = records(); crossState[0].evidence.cells[0].shot = crossState[0].evidence.cells[1].shot; rebuildFiles(crossState[0]);
    expect(summarizeRelease(crossState, identity, 'first-run-preview-only').completed).toBe(false);
    expect(firstRunPreviewPrimaryShot({ state: 'made-up', viewport: '375x812', lang: 'en' })).toBeNull();
  });
  it('rejects duplicate or missing primary font proofs and never lets diagnostic images substitute', () => {
    for (const mutate of [
      (record: any) => record.fonts.shots.push(record.fonts.shots[0]),
      (record: any) => record.fonts.shots.shift(),
      (record: any) => { record.evidence.cells[0].supplementalShots = [{ shot: record.evidence.cells[0].shot }]; },
      (record: any) => { record.evidence.cells[0].fullShot = record.evidence.cells[1].shot; },
    ]) { const input = records(); mutate(input[0]); expect(summarizeRelease(input, identity, 'first-run-preview-only').completed).toBe(false); }
    const withDiagnostic = records();
    withDiagnostic[0].shotNames.push('diagnostic.dev-only.png');
    expect(summarizeRelease(withDiagnostic, identity, 'first-run-preview-only')).toMatchObject({ completed: true, primaryScreenshots: 104, screenshots: 105 });
    withDiagnostic[0].shotNames.shift();
    expect(summarizeRelease(withDiagnostic, identity, 'first-run-preview-only').completed).toBe(false);
  });
  it('runs the actual highest-priority route guard before catchall, API, demo and font handlers', async () => {
    const source = read('./capture/release-interactions.mjs');
    const handlers: { pattern: any; handler: any }[] = [];
    const apiState = { firstRunDeniedWrites: 0, firstRunNarrationRefusals: 0, deniedActions: 0, deniedExternal: 0 };
    const base = 'http://127.0.0.1:4805';
    const extract = (pattern: string, end: string, values: Record<string, unknown>) => {
      const start = pattern === '**/sandbox/demo-family.json' ? 'await context.route(privateExport ? url => isExactPrivateExportFixtureUrl(url, BASE) : isCaptureDemoFamilyUrl, ' : `await context.route('${pattern}', `, from = source.indexOf(start), to = source.indexOf(end, from + start.length);
      expect(from).toBeGreaterThan(-1); expect(to).toBeGreaterThan(from);
      return new Function(...Object.keys(values), `return (${source.slice(from + start.length, to)});`)(...Object.values(values));
    };
    const context = { route: async (pattern: any, handler: any) => { handlers.push({ pattern, handler }); } };
    await context.route('**/*', extract('**/*', ");\n    await context.routeWebSocket", { apiState, BASE: base, privateExport: null }));
    await context.route('**/api/**', extract('**/api/**', ");\n    await context.route(privateExport ? url => isExactPrivateExportFixtureUrl(url, BASE) : isCaptureDemoFamilyUrl", { apiState, BASE: base, privateExport: null, copilot: null, firstRunPreview: true, firstRunPreviewApiDisposition, singleGoal: null, kidEntry: null, deniedCaptureApiCategory, _apiCache: new Map(), fixture: { childId: 'synthetic' } }));
    await context.route(isCaptureDemoFamilyUrl, extract('**/sandbox/demo-family.json', ");\n    await installOfflineFonts", { apiState, privateExport: null, fixture: { parsed: {} } }));
    const fontUrl = 'https://fonts.gstatic.com/exact-cached.woff2';
    await context.route((url: URL) => url.href === fontUrl, (route: any) => route.fulfill({ status: 200 }));
    await installFirstRunPreviewBoundary(context, apiState);
    const request = async (url: string, method: string) => {
      const effects: string[] = [];
      const matches = ({ pattern }: any) => typeof pattern === 'function' ? pattern(new URL(url)) : pattern === '**/*' || (pattern === '**/api/**' ? new URL(url).pathname.startsWith('/api/') : new URL(url).pathname === '/sandbox/demo-family.json');
      const selected = handlers.filter(matches).reverse();
      const call = async (index: number): Promise<any> => selected[index].handler({ request: () => ({ url: () => url, method: () => method, allHeaders: async () => ({}), postData: () => null }),
        fetch: async () => { effects.push('fetch'); return { status: () => 403, headers: () => ({}), body: async () => 'private-read-refused' }; },
        fallback: () => call(index + 1), abort: () => effects.push('abort'), continue: () => effects.push('continue'), fulfill: ({ status }: any) => effects.push(`fulfill:${status}`) });
      await call(0); return effects;
    };
    for (const path of ['/webhooks/billing/revenuecat', '/sandbox/demo-family.json', '/api/onboarding/family-child', '/unanticipated-write']) {
      const before = apiState.firstRunDeniedWrites;
      expect(await request(base + path, 'POST')).toEqual(['abort']);
      expect(apiState.firstRunDeniedWrites).toBe(before + 1); expect(apiState.deniedActions).toBe(before + 1);
    }
    expect(await request(base + '/api/chat', 'GET')).toEqual(['abort']);
    expect(await request(base + '/sandbox/demo-family.json', 'GET')).toEqual(['fulfill:200']);
    expect(await request(base + '/', 'GET')).toEqual(['continue']);
    expect(await request(base + '/api/live/availability', 'GET')).toEqual(['fulfill:200']);
    expect(await request(fontUrl, 'GET')).toEqual(['fulfill:200']);
    expect(await request('https://foreign.invalid/sandbox/demo-family.json', 'GET')).toEqual(['abort']);
    expect(await request(base + '/api/children/synthetic/book-assets/sandbox/demo-family.json', 'GET')).toEqual(['fetch', 'fulfill:403']);
    expect(await request(base + '/sandbox/demo-family.json', 'HEAD')).toEqual(['continue']);
    const guard = source.indexOf('if (firstRunPreview) await installFirstRunPreviewBoundary(context, apiState, firstRunScope)');
    expect(guard).toBeGreaterThan(source.indexOf('await installOfflineFonts(context)'));
    expect(source.slice(guard)).not.toContain('await context.route(');
  });
  it('denies non-API and demo POST even at their own handlers while preserving other capture groups', async () => {
    const source = read('./capture/release-interactions.mjs');
    for (const preview of [true, false]) for (const [pattern, end, path, ordinaryEffect] of [
      ['**/*', ");\n    await context.routeWebSocket", '/webhooks/billing/revenuecat', 'continue'],
      ['**/sandbox/demo-family.json', ");\n    await installOfflineFonts", '/sandbox/demo-family.json', 'abort'],
    ]) {
      const apiState: any = { deniedActions: 0, deniedExternal: 0, ...(preview ? { firstRunDeniedWrites: 0 } : {}) };
      const start = pattern === '**/sandbox/demo-family.json' ? 'await context.route(privateExport ? url => isExactPrivateExportFixtureUrl(url, BASE) : isCaptureDemoFamilyUrl, ' : `await context.route('${pattern}', `, from = source.indexOf(start), to = source.indexOf(end, from + start.length);
      const handler = new Function('apiState', 'BASE', 'fixture', 'privateExport', `return (${source.slice(from + start.length, to)});`)(apiState, 'http://127.0.0.1:4805', { parsed: {} }, null);
      const effects: string[] = [];
      await handler({ request: () => ({ method: () => 'POST', url: () => 'http://127.0.0.1:4805' + path }), abort: () => effects.push('abort'), continue: () => effects.push('continue'), fallback: () => effects.push('fallback'), fulfill: ({ status }: any) => effects.push(`fulfill:${status}`) });
      expect(effects).toEqual([preview ? 'abort' : ordinaryEffect]);
      expect(apiState.deniedActions).toBe(preview || ordinaryEffect === 'abort' ? 1 : 0);
      if (preview) expect(apiState.firstRunDeniedWrites).toBe(1);
    }
  });

  it('limits the demo fixture to the exact public local path', () => {
    expect(isCaptureDemoFamilyUrl(new URL('http://127.0.0.1:4805/sandbox/demo-family.json'))).toBe(true);
    for (const url of ['https://foreign.invalid/sandbox/demo-family.json', 'http://127.0.0.1:4805/api/children/a/book-assets/sandbox/demo-family.json', 'http://127.0.0.1:4805/sandbox/demo-family.json/private', 'http://127.0.0.1:4806/sandbox/demo-family.json']) expect(isCaptureDemoFamilyUrl(new URL(url))).toBe(false);
  });


  it('requires exact refusal counter accounting and a fresh final network snapshot', () => {
    const evidence: any = { firstRunDeniedWrites: 0, deniedActions: 0, deniedExternal: 0, mockRequests: 0, firstRunNarrationRefusals: 0, firstRunRequestDiagnostics: { counts: {}, recent: [] } };
    expect(validFirstRunNetworkEvidence(evidence)).toBe(true);
    for (const patch of [{ firstRunNarrationRefusals: undefined }, { firstRunNarrationRefusals: -1 }, { firstRunNarrationRefusals: 0.5 }, { firstRunNarrationRefusals: 1 }, { firstRunRequestDiagnostics: undefined }]) expect(validFirstRunNetworkEvidence({ ...evidence, ...patch })).toBe(false);
    const before = { ...evidence, ...firstRunNetworkSnapshot(evidence) };
    evidence.firstRunDeniedWrites++; evidence.deniedActions++;
    const after = { ...evidence, ...firstRunNetworkSnapshot(evidence) };
    expect(validFirstRunNetworkEvidence(before)).toBe(true); expect(validFirstRunNetworkEvidence(after)).toBe(false);
    const source = read('./capture/release-interactions.mjs');
    expect(source.indexOf("check(cell, 'FIRST_RUN_FINAL_NETWORK_GUARD'")).toBeGreaterThan(source.indexOf('cell.runtimeDiagnostics = diagnostics.snapshot()'));
    expect(source.indexOf("check(cell, 'FIRST_RUN_FINAL_NETWORK_GUARD'")).toBeLessThan(source.indexOf('cell.reached = cell.failures.length'));
    expect(firstRunPreviewRequiredAssertions('browser-forward-now')).toContain('FIRST_RUN_FINAL_NETWORK_GUARD');
  });
  it('never exports raw paths, child IDs, query text or arbitrary methods in bounded diagnostics', () => {
    const secret = 'do-not-retain-this-child';
    expect(firstRunRequestDiagnostic('POST', `/api/children/${secret}/book-narration`)).toEqual({ method: 'POST', category: 'OTHER_CHILD_BOOK_NARRATION' });
    expect(firstRunRequestDiagnostic(secret, `/unknown/${secret}`)).toEqual({ method: 'OTHER', category: 'OTHER_PATH' });
    expect(JSON.stringify(firstRunRequestDiagnostic('POST', `/api/private/${secret}`))).not.toContain(secret);
  });

  it('matches the source neutral card in both locales while the clinical manifest remains closed', () => {
    expect(ONBOARDING_NOTICE_REVIEWS).toEqual([]);
    for (const lang of ['en', 'he'] as const) {
      const text = firstRunPreviewText(lang), state = { ...initialFirstRunState(), name: text.name, birthMonth: '2022-10', worry: { step: 3 as const, choice: 'moving' as const, words: '', quote: '', hardMomentId: '' } };
      expect(firstRunCard(state, lang, new Date('2026-10-10T12:00:00Z')).notice).toBe(text.neutral);
    }
    expect(() => firstRunPreviewText('fr')).toThrow();
  });
  it('keeps unrelated seeded profiles exact and does not mistake an absent baseline for an empty account', () => {
    const baseline = [{ id: 'demo-a', name: 'Synthetic' }], child = { id: 'created-by-ui', name: 'Preview Child' };
    expect(firstRunPreviewProfileFacts(baseline, baseline)).toMatchObject({ baselineUnchanged: true, newCount: 0, sameChild: false });
    expect(firstRunPreviewProfileFacts(baseline, [...baseline, child], child.id)).toMatchObject({ baselineUnchanged: true, newCount: 1, sameChild: true });
    expect(firstRunPreviewProfileFacts([], [child], child.id).baselineUnchanged).toBe(false);
    expect(firstRunPreviewProfileFacts(baseline, [{ id: 'demo-a', name: 'Changed' }, child], child.id).baselineUnchanged).toBe(false);
    expect(firstRunPreviewProfileFacts(baseline, [...baseline, child, { ...child, id: 'duplicate' }], child.id).sameChild).toBe(false);
  });
  it('declares blocked gates and uses only real controls, reload and browser history', () => {
    const source = read('./capture/first-run-preview-states.mjs');
    expect(FIRST_RUN_PREVIEW_LIMITATIONS.filter((row: any) => row.status === 'blocked').map((row: any) => row.state)).toEqual(['production-first-run-entry', 'empty-account-first-create', 'server-create-acknowledgement', 'profile-gate-automatic-destination']);
    expect(source).not.toMatch(/force:\s*true|dispatchEvent|__react|\.setItem\(|\.removeItem\(|addStyleTag|waitForTimeout|setContent|setExtraHTTPHeaders/);
    for (const operation of ['page.keyboard.press', 'await primary().click()', 'await back().click()', 'page.reload', 'page.goBack', 'page.goForward']) expect(source).toContain(operation);
    expect(source).toContain('await page.goto(nowUrl');
    expect(read('../src/App.tsx')).toContain('import.meta.env.DEV && new URLSearchParams(window.location.search).has("onboarding")');
    expect(read('../src/lib/onboardingGate.ts')).toContain('return useFirestore && !loading');
  });
  it('reuses the existing CI isolation, image and runner, with DEV-only image labels', () => {
    const workflow = read('../../.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain('"codex/first-run-capture" ]]; then scope=first-run-preview-only;');
    expect(workflow).toContain('docker create --network none'); expect(workflow).toContain('CAPTURE_FONT_MODE=exact');
    const runner = read('./capture/run-release.mjs');
    expect(runner).toContain("if (cell.group !== 'first-run-preview') {");
    expect(runner).toContain('assertLoopbackOnly(networkInterfaces())');
    expect(runner).toContain("spawn(process.execPath, ['--import', 'tsx', 'server.ts']");
    expect(read('./capture/release-interactions.mjs')).toContain('firstRunPreviewPrimaryShot({ state, viewport: viewportId, lang })');
  });
  it('rejects invisible, clipped or transparent titles instead of passing mounted DOM', () => {
    const normal = { display: 'block', visibility: 'visible', opacity: '1', direction: 'ltr' };
    const rect = { x: 10, y: 10, left: 10, right: 310, top: 10, bottom: 55, width: 300, height: 45 };
    const title: any = { isConnected: true, parentElement: null, textContent: 'About your child', getBoundingClientRect: () => rect };
    const root: any = { isConnected: true, querySelector: (s: string) => s === 'h1' ? title : null, querySelectorAll: () => [], contains: () => false };
    vi.stubGlobal('document', { querySelector: (s: string) => s === '.first-run' || s === 'main' ? root : null, activeElement: null, documentElement: { scrollWidth: 375 } });
    vi.stubGlobal('getComputedStyle', () => normal); vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 812); vi.stubGlobal('location', { hash: '#/overview', search: '?onboarding=1' });
    expect(observeFirstRunPreview({ selector: '.first-run', lang: 'en' })).toMatchObject({ ready: true, directionMatches: true, previewQuery: true });
    normal.opacity = '0'; expect(observeFirstRunPreview({ selector: '.first-run', lang: 'en' })).toMatchObject({ ready: false });
    normal.opacity = '1'; rect.top = -1; expect(observeFirstRunPreview({ selector: '.first-run', lang: 'en' })).toMatchObject({ ready: false });
    rect.top = 10; title.textContent = ''; expect(observeFirstRunPreview({ selector: '.first-run', lang: 'en' })).toMatchObject({ ready: false });
  });
});
