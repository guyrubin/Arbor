import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyReleaseConsole, clippedOverlap, expectedReleaseInteractionStates,
  geometryStable, missingReleaseInteractionEvidence, releaseFixture,
  sanitizedReleaseLocation, syntheticReleaseReport,
} from './capture/release-interactions.mjs';

const source = readFileSync(new URL('./capture/release-interactions.mjs', import.meta.url), 'utf8');
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
    expect(expectedReleaseInteractionStates('ask-diagnostic', mobile).map((item: any) => item.state)).toEqual(['launcher-composer', 'ask-mock-answer']);
    const actualFlow = source.indexOf("await screen('shell', 'ask-mock-answer'");
    expect(actualFlow).toBeLessThan(source.indexOf("await screen('shell', 'tools-open'"));
    expect(actualFlow).toBeLessThan(source.indexOf("apiState.chat = 'report'"));
    expect(source).toContain("cell.fixture = 'actual-local-mock-server-response'");
    expect(source).toContain("cell.fixture = 'bilingual-report-presentation-fixture'");
  });

  it('unions focused groups without inventing a desktop More interaction', () => {
    const focused = expectedReleaseInteractionStates('focused', mobile);
    expect(focused).toEqual([...expectedReleaseInteractionStates('navigation', mobile), ...expectedReleaseInteractionStates('ask', mobile)]);
    expect(new Set(focused.map((item: any) => `${item.group}/${item.route}/${item.state}`)).size).toBe(focused.length);
    expect(focused.some((item: any) => item.state === 'more-records')).toBe(true);
    expect(expectedReleaseInteractionStates('focused', desktop).some((item: any) => item.state.startsWith('more-'))).toBe(false);
    expect(expectedReleaseInteractionStates('focused', desktop).some((item: any) => item.state === 'record-profile')).toBe(true);
    expect(source).toContain('_priorCells: navigation.cells');
    expect(source).toContain('cells: [..._priorCells]');
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
    expect(source).toContain('if (diagnosticRecent.length > 20) diagnosticRecent.shift()');
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
