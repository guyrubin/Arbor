import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyReleaseConsole, deniedCaptureApiCategory, clippedOverlap, expectedReleaseInteractionStates,
  geometryStable, missingReleaseInteractionEvidence, observedEarlyBackClick, observedScrolledNavigationClick, releaseFixture,
  sanitizedReleaseLocation, syntheticReleaseReport,
} from './capture/release-interactions.mjs';

const source = readFileSync(new URL('./capture/release-interactions.mjs', import.meta.url), 'utf8');
const askBranchMarker = "const toggle = () => composer().locator('.companion-tools-toggle');";
function actualAskPrecedesFixtures(input: string): boolean {
  // A separate report-close-only branch intentionally uses its own fixture.
  // The cold-entry invariant belongs to the actual Ask/full branch below it.
  const start = input.indexOf(askBranchMarker);
  if (start < 0) return false;
  const branch = input.slice(start);
  const actualFlow = branch.indexOf("await screen('shell', 'ask-mock-answer'");
  return actualFlow >= 0 && [
    "await screen('shell', 'tools-open'", "await collectReportStates(",
    "await screen('coach', 'direct-composer'",
  ].every(marker => branch.indexOf(marker) > actualFlow);
}
const sourceSha = 'a'.repeat(40);
const sourceTreeSha = 'b'.repeat(40);
const mobile = { w: 375, h: 812, lang: 'en' };
const desktop = { w: 1280, h: 800, lang: 'he' };
const options = (group = 'focused', viewport = mobile) => ({ group, viewport, sourceSha, sourceTreeSha });
const complete = (group = 'focused', viewport = mobile) => expectedReleaseInteractionStates(group, viewport).map(({ route, state, group: part }: any) => ({
  route, state, group: part, viewport: `${viewport.w}x${viewport.h}`, lang: viewport.lang,
  sourceSha, sourceTreeSha, reached: true, shot: `shots/${state}.png`,
  assertions: [{ id: 'ACTUALLY_OBSERVED', passed: true }], failures: [],
}));

describe('release interaction contracts, without browser or sockets', () => {
  it('imports pure helpers without launching a browser or executing app code', () => {
    const guard = source.indexOf('assertLoopbackOnly(networkInterfaces())');
    const browserImport = source.indexOf("await import('playwright')");
    expect(guard).toBeGreaterThan(source.indexOf('export async function collectReleaseInteractions'));
    expect(browserImport).toBeGreaterThan(guard);
    expect(source.slice(0, source.indexOf('export async function collectReleaseInteractions'))).not.toMatch(/import.*(?:playwright|src\/)/);
  });

  it('limits the narrow diagnostic to actual composer and mock readiness', () => {
    expect(expectedReleaseInteractionStates('ask-diagnostic', mobile).map((item: any) => item.state)).toEqual(['launcher-composer', 'ask-mock-answer', 'direct-composer', 'direct-mock-answer']);
    expect(actualAskPrecedesFixtures(source)).toBe(true);
    expect(source).toContain("DIRECT_ENTRY_WITHOUT_LAUNCHER_CLICK");
    expect(source).toContain("apiState.mockRequests > before.requests");
    expect(source).toContain("apiState.mockResponses > before.responses");
    expect(source).toContain("cell.fixture = 'actual-local-mock-server-response'");
    expect(source).toContain("cell.fixture = 'bilingual-report-presentation-fixture'");
  });

  it('rejects a report fixture before cold Ask readiness inside the actual Ask branch', () => {
    expect(actualAskPrecedesFixtures(source.replace(askBranchMarker, `${askBranchMarker}\n await collectReportStates(injected);`))).toBe(false);
    expect(actualAskPrecedesFixtures(source.replace("await screen('shell', 'ask-mock-answer'", "await screen('shell', 'removed-readiness'"))).toBe(false);
    expect(actualAskPrecedesFixtures(source.replace(askBranchMarker, ''))).toBe(false);
  });

  it('unions focused groups without inventing a desktop More interaction', () => {
    const focused = expectedReleaseInteractionStates('focused', mobile);
    expect(focused).toEqual([...expectedReleaseInteractionStates('navigation', mobile), ...expectedReleaseInteractionStates('ask', mobile)]);
    expect(new Set(focused.map((item: any) => `${item.group}/${item.route}/${item.state}`)).size).toBe(focused.length);
    expect(new Set(focused.map((item: any) => `${item.group}/${item.state}`)).size).toBe(focused.length);
    expect(focused.some((item: any) => item.state === 'more-records')).toBe(true);
    expect(expectedReleaseInteractionStates('focused', desktop).some((item: any) => item.state.startsWith('more-'))).toBe(false);
    expect(expectedReleaseInteractionStates('focused', desktop).some((item: any) => item.state === 'record-profile')).toBe(true);
    expect(source).toContain('_priorCells: navigation.cells');
    expect(source).toContain('cells: [..._priorCells]');
  });

  it('preserves interrupted flows, bottom reachability and useful activity context', () => {
    const states = expectedReleaseInteractionStates('navigation', mobile).map(item => item.state);
    for (const state of ['now-bottom-reachable', 'together-bottom-reachable', 'together-early-back', 'together-how-to-begin', 'now-scroll-initial', 'now-scroll-middle', 'scroll-route-reset', 'keep-close-focus']) expect(states).toContain(state);
    for (const assertion of ['STORY_CONTENT_MOUNTED', 'EXACT_RETURN_CARD_FOCUSED', 'EARLY_BACK_WINDOW_OBSERVED', 'EARLY_BACK_EXACT_CARD_FOCUS', 'FINAL_ACTION_VISIBLE_ABOVE_DOCK', 'FINAL_ACTION_NOT_OCCLUDED', 'CONCRETE_ACTIVITY_DETAIL', 'EXACT_SAY_THIS_PRESERVED', 'TWO_DENSITY_TABS', 'NO_DUPLICATE_SHELL_NAV', 'MAIN_ENDS_ABOVE_LAUNCHER_RAIL', 'RAIL_ENDS_ABOVE_MOBILE_NAV', 'MEASURED_NAV_HEIGHT_RESERVED', 'WINDOW_NOT_USED_AS_SCROLLPORT', 'MAIN_RESET_ON_ROUTE_CHANGE', 'KEEP_CLOSE_RETURNS_TO_VISIBLE_SUMMARY', 'DOCK_CLOSE_FOCUS_RETURNS_TO_LAUNCHER']) expect(source).toContain(assertion);
    expect(source).toContain("page.locator('[data-density-toggle]')");
    expect(source).toContain('dependent(profileReached)');
    expect(source).toContain('dependent(memoryReached)');
    expect(source).toContain("dialog.getByRole('heading').first()");
    for (const route of ['milestones', 'daily-play']) for (const state of ['scroll-initial', 'scroll-middle', 'scroll-last-action']) expect(expectedReleaseInteractionStates('navigation', mobile).some(item => item.route === route && item.state === `${route}-${state}`)).toBe(true);
    expect(source).toContain("document.querySelector('#main')");
    expect(source).toContain("screenshotScope: 'main-scrollport-frame'");
    expect(source).not.toContain('window.scrollTo(0, 240)');

  });

  it('rejects unknown groups and non-matrix viewports', () => {
    expect(() => expectedReleaseInteractionStates('all', mobile)).toThrow('RELEASE_GROUP_INVALID');
    for (const viewport of [{ ...mobile, w: 1280 }, { ...mobile, lang: 'fr' }, { ...mobile, w: -1 }]) expect(() => expectedReleaseInteractionStates('ask', viewport)).toThrow('RELEASE_VIEWPORT_INVALID');
  });

  it('requires every state, source identity, assertion and successful screenshot', () => {
    const cells = complete();
    expect(missingReleaseInteractionEvidence(cells, options())).toEqual([]);
    expect(missingReleaseInteractionEvidence([], options())).toHaveLength(cells.length);
    for (const change of [
      { reached: false }, { shot: null }, { assertions: [] }, { assertions: [{ id: 'FAILED', passed: false }] },
      { failures: ['FAILED'] }, { sourceSha: 'c'.repeat(40) }, { sourceTreeSha: 'd'.repeat(40) },
      { group: 'ask-diagnostic' }, { viewport: '1280x800' }, { lang: 'he' },
    ]) expect(missingReleaseInteractionEvidence([{ ...cells[0], ...change }, ...cells.slice(1)], options())).toHaveLength(1);
    expect(missingReleaseInteractionEvidence([{ ...cells[0], reached: false, failureShot: 'shots/diagnostic.png' }, ...cells.slice(1)], options())).toHaveLength(1);
  });

  it('checks geometry non-vacuously and clips overlap to the visible scrollport', () => {
    const rect = { x: 10, y: 10, width: 200, height: 50 };
    expect(geometryStable(rect, { ...rect, x: 12 })).toBe(true);
    expect(geometryStable(rect, { ...rect, width: 203 })).toBe(false);
    expect(geometryStable(null, null)).toBe(false);
    expect(geometryStable(rect, { ...rect, y: NaN })).toBe(false);
    const nav = { x: 10, y: 40, width: 200, height: 44 };
    expect(clippedOverlap(rect, nav, { x: 0, y: 0, width: 375, height: 812 })).toBe(4000);
    expect(clippedOverlap(rect, nav, { x: 0, y: 70, width: 375, height: 742 })).toBe(0);
    expect(clippedOverlap(null, nav, rect)).toBeNull();
  });

  it('rejects pre-click observations that used to falsely pass interrupted and reset flows', () => {
    const during = { sampledAt: 'captured-click', trusted: true, outgoingVisible: true, destinationVisible: false };
    expect(observedEarlyBackClick(during)).toBe(true);
    // The old pre-await sample was true, but the real click happened after settle.
    expect(during.outgoingVisible && !during.destinationVisible).toBe(true);
    expect(observedEarlyBackClick({ ...during, outgoingVisible: false, destinationVisible: true })).toBe(false);
    expect(observedEarlyBackClick({ ...during, sampledAt: 'before-click' })).toBe(false);
    expect(observedEarlyBackClick({ ...during, trusted: false })).toBe(false);
    const scrolled = { sampledAt: 'captured-click', trusted: true, outsideMain: true, mainScrollTop: 320 };
    expect(observedScrolledNavigationClick(scrolled)).toBe(true);
    // Before Playwright scrolled Back into view was positive; click time was zero.
    expect(scrolled.mainScrollTop > 0 && 0 === 0).toBe(true);
    expect(observedScrolledNavigationClick({ ...scrolled, mainScrollTop: 0 })).toBe(false);
    expect(observedScrolledNavigationClick({ ...scrolled, outsideMain: false })).toBe(false);
    expect(observedScrolledNavigationClick({ ...scrolled, sampledAt: 'before-click' })).toBe(false);
    expect(observedScrolledNavigationClick(null)).toBe(false);
    expect(source).toContain("document.addEventListener('click', state.listener, { capture: true, passive: true })");
    expect(source).toContain('event.isTrusted');
    expect(source).toContain('cell.transitionAtBack = await clickWithEvidence(back)');
    expect(source).toContain('cell.navigationAtClick = await clickWithEvidence(childDoor)');
    const reset = source.slice(source.indexOf("await screen('development', 'scroll-route-reset'"), source.indexOf('const invitation ='));
    expect(reset).not.toContain("byId('secondary-place-back').click()");
    expect(reset).toContain("page.locator('.arbor-app > nav')");
    expect(reset).toContain("byId('app-sidebar').locator('nav')");
  });

  it('requires explicitly demo-marked data and derives a real unchecked watch ID', () => {
    const bundle = { parent: { demo: true }, child: { demo: true, id: 'demo-child' }, collections: { milestones: [{ id: 'seen', checked: true }, { id: 'watch-me', checked: false }] } };
    expect(releaseFixture(JSON.stringify(bundle), 'en').watch.milestoneId).toBe('watch-me');
    expect(releaseFixture({ ...bundle, locales: { he: { ...bundle, child: { demo: true, id: 'demo-he' } } } }, 'he').childId).toBe('demo-he');
    expect(() => releaseFixture({ ...bundle, parent: {} }, 'en')).toThrow('SYNTHETIC_FIXTURE_REQUIRED');
    expect(() => releaseFixture({ ...bundle, child: { id: 'real' } }, 'en')).toThrow('SYNTHETIC_FIXTURE_REQUIRED');
    expect(() => releaseFixture({ ...bundle, child: { demo: true, id: '../escape' } }, 'en')).toThrow('SYNTHETIC_FIXTURE_REQUIRED');
    expect(releaseFixture({ ...bundle, collections: { milestones: [{ id: 'seen', checked: true }] } }, 'en').watch).toBeNull();
  });

  it('uses bounded bilingual renderer fixtures with no attachments, URLs or private memory', () => {
    const en = syntheticReleaseReport('en'); const he = syntheticReleaseReport('he');
    expect(en.contract.text).not.toBe(he.contract.text);
    expect(he.contract.text).toMatch(/[א-ת]/);
    for (const report of [en, he]) {
      expect(report.contract.todayPlan).toHaveLength(2);
      expect(report.contract.nonDiagnosticHypotheses).toHaveLength(1);
      expect(report.contract.memoryProposals).toEqual([]);
      expect(report.contract.approvedMemoryFactsUsed).toBe(0);
      expect(report.contract.document.suggestedMemory).toEqual([]);
      expect(JSON.stringify(report)).not.toMatch(/https?:|data:|attachments|apiKey|accessToken/);
      expect(JSON.stringify(report).length).toBeLessThan(5000);
    }
  });

  it('classifies runtime errors without retaining their content or external locations', () => {
    for (const [message, kind] of [
      ['Maximum update depth exceeded SECRET', 'REACT_UPDATE_DEPTH'], ['Rendered more hooks than during the previous render', 'REACT_HOOKS'],
      ['Outdated Optimize Dep', 'OPTIMIZED_DEPENDENCY'], ['Refused to execute script because of Content Security Policy', 'CSP'],
      ['Failed to fetch dynamically imported module', 'MODULE_LOAD'], ['Minified React error #418', 'REACT_MINIFIED_418'],
      ['Minified React error #185; https://react.dev/errors/185?args[]=SECRET', 'REACT_MINIFIED_185'],
      ['Minified React error #1859 SECRET', 'REACT_MINIFIED'],
      ['The private draft SECRET', 'OTHER_ERROR'],
    ]) expect(classifyReleaseConsole(message)).toBe(kind);
    expect(sanitizedReleaseLocation({ url: 'http://127.0.0.1:4805/assets/index-abcd.js?token=SECRET', lineNumber: 10, columnNumber: 20 })).toEqual({ path: '/assets/index-abcd.js', line: 10, column: 20 });
    expect(sanitizedReleaseLocation({ url: 'https://example.com/assets/private.js?token=SECRET' })).toBeUndefined();
    expect(sanitizedReleaseLocation({ url: 'http://127.0.0.1:4805/api/chat?prompt=SECRET' })).toBeUndefined();
    expect(sanitizedReleaseLocation({ url: 'http://127.0.0.1:4805/src/private%20name.tsx' })).toBeUndefined();
    expect(source).toContain('const diagnostics = createRuntimeDiagnostics()');
    expect(source).toContain('cell.runtimeDiagnostics = diagnostics.snapshot()');
  });


  it('permits only the TTS capability read while preserving synthesis/media/export denial', () => {
    expect(deniedCaptureApiCategory('GET', '/api/tts')).toBeNull();
    for (const method of ['POST', 'PUT', 'DELETE']) expect(deniedCaptureApiCategory(method, '/api/tts')).toBe('TTS');
    expect(deniedCaptureApiCategory('GET', '/api/tts/private')).toBe('TTS');
    for (const [endpoint, category] of [['/api/voice', 'VOICE'], ['/api/live/token', 'LIVE'], ['/api/vision', 'VISION'], ['/api/shares', 'SHARING'], ['/api/export', 'EXPORT'], ['/api/billing/checkout', 'BILLING'], ['/api/consent', 'CONSENT']]) expect(deniedCaptureApiCategory('POST', endpoint)).toBe(category);
    expect(source).toContain("if (request.method() === 'GET' && url.pathname === '/api/tts') apiState.ttsCapabilityReads++");
    expect(source).toContain('cell.assetDiagnostics = assets.snapshot()');
    expect(source).toContain("'SUSPENSE_NO_PENDING_LOCAL_ASSETS'");
    expect(source).toContain('sheetReady: link.sheet !== null');
    expect(source).not.toContain('textContent:');
  });

  it('permits only the exact local owner-grant list read and counts no query or payload', () => {
    expect(deniedCaptureApiCategory('GET', '/api/shares')).toBeNull();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) expect(deniedCaptureApiCategory(method, '/api/shares')).toBe('SHARING');
    for (const path of ['/api/share', '/api/share/', '/api/shares/', '/api/shares/private', '/api/share/private']) {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE']) expect(deniedCaptureApiCategory(method, path)).toBe('SHARING');
    }
    const counter = "if (request.method() === 'GET' && url.pathname === '/api/shares') apiState.shareListReads++";
    expect(source).toContain('shareListReads: 0');
    expect(source).toContain(counter);
    expect(source.indexOf("if (url.origin !== BASE)")).toBeLessThan(source.indexOf(counter));
    expect(source.indexOf('const denied = deniedCaptureApiCategory')).toBeLessThan(source.indexOf(counter));
    expect(source.match(/apiState\.shareListReads[^;]*;/g)).toEqual(['apiState.shareListReads++;']);
  });

  it('caches only successful synthetic reads, sharing them across the focused groups', () => {
    expect(source).toContain('_apiCache = new Map()');
    expect(source).toContain("_reportGroup: 'focused', _apiCache");
    expect(source).toContain("request.method() === 'GET' || (request.method() === 'POST' && ['/api/todays-focus', '/api/digest'].includes(url.pathname))");
    expect(source).toContain('if (response.status() === 200) _apiCache.set(key, entry)');
    expect(source).toContain('if (response.status() === 429) apiState.localRateLimits++');
    expect(source.indexOf("url.pathname === '/api/chat'")).toBeLessThan(source.indexOf('const cacheable'));
    expect(source.indexOf("url.pathname === '/api/consent'")).toBeLessThan(source.indexOf('const cacheable'));
  });

  it('keeps isolation, exact fonts, honest partial evidence and forbidden controls', () => {
    for (const required of ["permissions: []", "serviceWorkers: 'block'", 'installOfflineFonts(context)', 'captureFontContextOptions()', 'captureScreenshot(page,', 'context.addInitScript(initializeSyntheticOnline, { lang })', "process.env.ARBOR_CAPTURE_FONT_MODE !== 'exact'", "process.env.MODEL_PROVIDER !== 'mock'"]) expect(source).toContain(required);
    expect(source).not.toMatch(/setInputFiles|grantPermissions|addStyleTag|setContent|innerHTML\s*=|getUserMedia|page\.screenshot\(/);
    expect(source).not.toMatch(/(?:companion-live-button|photoRef|documentRef).*\.click\(/);
    expect(source.indexOf('doc.cells.push(cell); save()')).toBeLessThan(source.indexOf('await action(cell)'));
    expect(source).toContain('cell.reached = cell.failures.length === 0');
    expect(source).toContain('doc.completed = doc.missingEvidence.length === 0');
    expect(source).toContain("return json(503, { error: 'Synthetic capture grant failure' })");
  });
});
