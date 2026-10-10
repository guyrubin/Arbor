import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PORTRAIT_CARE_STATES, PORTRAIT_CARE_LIMITATIONS, observePortraitCareSurface, portraitCareApiDisposition, portraitCareRequiredAssertions, validPortraitCareCell, validPortraitCareClick } from './capture/portrait-care-contract.mjs';
import { observeConfirmedFrame, waitConfirmedFrame } from './capture/confirmed-frame.mjs';
import { observeKeptPixelTarget } from './capture/kept-search-states.mjs';
import { releaseCell, releaseMatrix, captureDeadlineMs } from './capture/release-config.mjs';
import { missingReleaseInteractionEvidence, expectedReleaseInteractionStates } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const click = (control = 'portrait-care-cta', from = 'development') => ({ sampledAt: 'captured-click', trusted: true, control, hash: `#/${from}`, insideMain: true, targetConnected: true });
const cellsFor = (viewport: any) => PORTRAIT_CARE_STATES.map(spec => ({ ...spec, ...identity, group: 'portrait-care', viewport: `${viewport.w}x${viewport.h}`, lang: viewport.lang,
  reached: true, failures: [], assertions: portraitCareRequiredAssertions(spec.state).map(id => ({ id, passed: true })), shot: `shots/${spec.state}.exact.png`,
  surface: { identityReady: true, hash: `#/${spec.route}`, expectedRoute: spec.route }, screenshotSurface: { identityReady: true, hash: `#/${spec.route}` },
  renderReadiness: [{ after: { ready: true } }], screenshotAnimations: 'allow', networkEvidence: { portraitCareDeniedMutations: 0, portraitCareNarrationRefusals: 0, deniedActions: 0, deniedExternal: 0 },
  navigationClick: spec.state === 'care-back-portrait' ? click('my-child-back', 'care-team') : click(), ctaPixels: { ready: true }, primaryPixels: { ready: true },
}));
const records = () => releaseMatrix('portrait-care-only').map(spec => {
  const cell = releaseCell(spec), cells = cellsFor(cell.viewport);
  const shotNames = cells.map(item => item.shot.split('/').pop()!);
  return { capture: { ...identity, cell, completed: true, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' } },
    inventory: { ...identity, routeIds: ROUTE_IDS, contracts: SURFACE_CONTRACTS }, evidence: { ...identity, cells, completed: true }, shotNames,
    fonts: { mode: 'exact', deniedFontRequests: 0, shots: shotNames.map(shot => ({ shot, passed: true, rendered: [{ custom: true }] })) } };
});
afterEach(() => vi.unstubAllGlobals());

describe('current portrait care proof, pure offline contracts', () => {
  it('adds exactly five states in four variants without broadening the accepted 1046 release', () => {
    const matrix = releaseMatrix('portrait-care-only');
    expect(matrix.map(item => item.viewport)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    for (const item of matrix) {
      expect(item.group).toBe('portrait-care');
      expect(expectedReleaseInteractionStates(item.group, releaseCell(item).viewport)).toHaveLength(5);
      expect(captureDeadlineMs(item)).toBe(240000);
    }
    expect(releaseMatrix('parent-kid-release')).toHaveLength(24);
    expect(releaseMatrix('parent-kid-release').some(item => item.group === 'portrait-care')).toBe(false);
    expect(summarizeRelease(records(), identity, 'portrait-care-only')).toMatchObject({ completed: true, expectedShards: 4, baseCells: 0, interactionCells: 20, screenshots: 20 });
    expect(summarizeRelease(records(), identity, 'parent-kid-release').completed).toBe(false);
  });
  it('rejects omitted variants, stale source, missing exact pixels and absent rendered-font proof', () => {
    for (const mutate of [
      (rows: any[]) => rows.pop(),
      (rows: any[]) => { rows[0].capture.sourceTreeSha = 'c'.repeat(40); },
      (rows: any[]) => { rows[1].shotNames.pop(); },
      (rows: any[]) => { rows[2].fonts.shots[0].rendered = []; },
      (rows: any[]) => { rows[3].fonts.mode = 'fallback'; },
    ]) { const rows = records(); mutate(rows); expect(summarizeRelease(rows, identity, 'portrait-care-only').completed).toBe(false); }
  });
  it('requires every state-specific assertion rather than accepting generic reached + PNG', () => {
    const viewport = releaseCell(releaseMatrix('portrait-care-only')[0]).viewport;
    const options = { ...identity, viewport, group: 'portrait-care' };
    expect(missingReleaseInteractionEvidence(cellsFor(viewport), options)).toEqual([]);
    for (const spec of PORTRAIT_CARE_STATES) {
      for (const id of portraitCareRequiredAssertions(spec.state)) {
        const cells = cellsFor(viewport), cell = cells.find(item => item.state === spec.state)!;
        cell.assertions = cell.assertions.filter(item => item.id !== id);
        expect(missingReleaseInteractionEvidence(cells, options).map(item => item.state)).toContain(spec.state);
      }
    }
    expect(validPortraitCareCell(undefined)).toBe(false);
    expect(portraitCareRequiredAssertions('unknown')).toEqual([]);
  });
  it('cannot relabel direct sharing, synthetic clicks, unsettled frames, blocked primary or repaired screenshot as current care success', () => {
    const viewport = releaseCell(releaseMatrix('portrait-care-only')[0]).viewport;
    for (const mutate of [
      (cell: any) => { cell.surface.hash = '#/sharing'; },
      (cell: any) => { cell.surface.identityReady = false; },
      (cell: any) => { cell.navigationClick.trusted = false; },
      (cell: any) => { cell.navigationClick.hash = '#/sharing'; },
      (cell: any) => { cell.navigationClick.control = 'direct-route'; },
      (cell: any) => { cell.renderReadiness[0].after.ready = false; },
      (cell: any) => { delete cell.renderReadiness[0].after; },
      (cell: any) => { cell.renderReadiness = []; },
      (cell: any) => { cell.screenshotAnimations = 'disabled'; },
      (cell: any) => { cell.screenshotSurface.hash = '#/development'; },
      (cell: any) => { cell.networkEvidence.portraitCareDeniedMutations = 1; },
      (cell: any) => { cell.networkEvidence.deniedActions = 1; },
      (cell: any) => { cell.networkEvidence.deniedExternal = 1; },
      (cell: any) => { delete cell.networkEvidence.deniedActions; },
      (cell: any) => { delete cell.networkEvidence.deniedExternal; },
      (cell: any) => { cell.networkEvidence.portraitCareNarrationRefusals = -1; },
      (cell: any) => { cell.primaryPixels.ready = false; },
    ]) { const cell = cellsFor(viewport).find(item => item.state === 'care-primary')!; mutate(cell); expect(validPortraitCareCell(cell)).toBe(false); }
    for (const patch of [{ trusted: false }, { hash: '#/sharing' }, { insideMain: false }, { targetConnected: false }, { sampledAt: 'before-click' }]) {
      expect(validPortraitCareClick({ ...click(), ...patch }, 'portrait-care-cta', 'development')).toBe(false);
    }
  });
  it('permits read-only local sharing lists and denies grants, uploads, exports and arbitrary mutations', () => {
    for (const url of ['/api/shares', '/api/shares/inbound', '/api/children/demo/observations']) expect(portraitCareApiDisposition('GET', url)).toBe('read');
    for (const url of ['/api/todays-focus', '/api/digest']) expect(portraitCareApiDisposition('POST', url)).toBe('read');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) for (const url of ['/api/shares', '/api/shares/id', '/api/export', '/api/chat', '/api/consent', '/api/media', '/api/todays-focus/extra']) expect(portraitCareApiDisposition(method, url)).toBe('deny');
  });
  it('refuses only the exact current synthetic child boot narration, never broadly allowing generation', () => {
    expect(portraitCareApiDisposition('POST', '/api/children/dylan-demo/book-narration', 'dylan-demo')).toBe('synthetic-narration-refusal');
    for (const [method, pathname, childId] of [
      ['POST', '/api/children/sibling/book-narration', 'dylan-demo'],
      ['POST', '/api/children/dylan-demo/book-narration/extra', 'dylan-demo'],
      ['POST', '/api/children/dylan-demo/book-narration/', 'dylan-demo'],
      ['POST', '/api/children/dylan-demo/book-assets/book/commit', 'dylan-demo'],
      ['POST', '/api/children/dylan-demo/book-narration', undefined],
      ['POST', '/api/children/dylan-demo/book-narration', ''],
      ['DELETE', '/api/children/dylan-demo/book-narration', 'dylan-demo'],
    ]) expect(portraitCareApiDisposition(method, pathname, childId)).toBe('deny');
    const source = read('app/scripts/capture/release-interactions.mjs').split("if (group === 'portrait-care') {\n        const disposition")[1].split('      if (kidEntry)')[0];
    expect(source).toContain('portraitCareApiDisposition(request.method(), url.pathname, fixture.childId)');
    expect(source).toContain("apiState.portraitCareNarrationRefusals++; return json(409, { code: 'synthetic_capture_media_disabled' })");
    expect(source).toContain('apiState.portraitCareDeniedMutations++; apiState.deniedActions++; return route.abort()');
    expect(source).not.toMatch(/route\.continue|json\(200/);
    const cell = cellsFor(releaseCell(releaseMatrix('portrait-care-only')[0]).viewport)[0];
    cell.networkEvidence.portraitCareNarrationRefusals = 2;
    expect(validPortraitCareCell(cell)).toBe(true);
    expect(read('app/src/components/layout/KidModeButton.tsx')).toContain('void ensureBookNarration(child, narrationVoice)');
  });
  it('rejects post-assertion counter changes in the aggregate despite all initial assertions being true', () => {
    for (const counter of ['deniedActions', 'deniedExternal', 'portraitCareDeniedMutations']) {
      const rows = records();
      (rows[0].evidence.cells[0].networkEvidence as any)[counter] = 1;
      expect(rows[0].evidence.cells[0].assertions.every(item => item.passed)).toBe(true);
      expect(summarizeRelease(rows, identity, 'portrait-care-only').completed).toBe(false);
    }
  });
  it('observes current TrustedSharing identity separately from display:contents route geometry', () => {
    const box = { width: 200, height: 44, top: 100, bottom: 144 };
    const heading = { textContent: 'Invented heading', getBoundingClientRect: () => box };
    let routeName = 'care-team', primaryMove = 'open-care-roster', grantCount = 1;
    const primary = { getAttribute: () => primaryMove };
    const route = { getAttribute: () => routeName,
      querySelectorAll: (selector: string) => selector === 'h1' ? [heading] : selector === '[data-module="sharing-grant"]' ? Array(grantCount).fill({}) : ['[data-testid="share-week-card"]', '[data-testid="share-week-confirm"]'].includes(selector) ? [primary] : [],
      querySelector: (selector: string) => selector === 'h1' ? heading : primary, contains: () => false };
    const body = { isConnected: true, closest: () => null };
    const main = { scrollTop: 0, getBoundingClientRect: () => ({ top: 80, bottom: 700 }) };
    vi.stubGlobal('document', { body, activeElement: body, documentElement: { dir: 'ltr' }, querySelector: () => main, querySelectorAll: () => [route] });
    vi.stubGlobal('location', { hash: '#/care-team' }); vi.stubGlobal('localStorage', { getItem: () => 'demo' });
    expect(observePortraitCareSurface({ routeName, childId: 'demo' })).toMatchObject({ identityReady: true, headingInMain: true, focus: { location: 'document-body' } });
    primaryMove = 'grant-share'; expect(observePortraitCareSurface({ routeName, childId: 'demo' }).identityReady).toBe(false);
    primaryMove = 'open-care-roster'; grantCount = 0; expect(observePortraitCareSurface({ routeName, childId: 'demo' }).identityReady).toBe(false);
    grantCount = 1; box.height = 0; expect(observePortraitCareSurface({ routeName, childId: 'demo' }).identityReady).toBe(false);
    box.height = 44; expect(observePortraitCareSurface({ routeName, childId: 'other-child' }).identityReady).toBe(false);
    routeName = 'sharing'; primaryMove = 'grant-share'; vi.stubGlobal('location', { hash: '#/sharing' });
    expect(observePortraitCareSurface({ routeName, childId: 'demo' }).identityReady).toBe(true);
    expect(observePortraitCareSurface({ routeName: 'care-team', childId: 'demo' }).identityReady).toBe(false);
  });
  it('rejects a mounted but transparent or animating destination using the existing passive observer', () => {
    const style = { opacity: '1', transform: 'none', visibility: 'visible', display: 'block' };
    const parent = { isConnected: true, parentElement: null, getAttribute: () => null, getBoundingClientRect: () => ({ width: 300, height: 200 }), getAnimations: () => [] as any[] };
    const target = { isConnected: true, parentElement: parent, closest: () => null, getBoundingClientRect: () => ({ width: 200, height: 44 }), getAnimations: () => [] as any[] };
    const route = { ...target, querySelectorAll: () => [target], getAttribute: () => 'care-team' };
    vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === '#main [data-route]' ? [route] : [] });
    vi.stubGlobal('window', { __arborConfirmedDateClock: { snapshot: () => ({ nativeTimingPreserved: true }) } });
    vi.stubGlobal('getComputedStyle', () => style); vi.stubGlobal('location', { hash: '#/care-team' }); vi.stubGlobal('localStorage', { getItem: () => 'demo' });
    const args = { routeName: 'care-team', childId: 'demo' };
    expect(observeConfirmedFrame(args)).toMatchObject({ ready: true });
    style.opacity = '0'; expect(observeConfirmedFrame({ ...args, waitUntilReady: true })).toBe(false);
    style.opacity = '1'; parent.getAnimations = () => [{ playState: 'running', pending: true }]; expect(observeConfirmedFrame(args)).toMatchObject({ ready: false });
    parent.getAnimations = () => []; expect(observeConfirmedFrame({ ...args, outgoing: { ...route, isConnected: true } })).toMatchObject({ ready: false });
  });
  it('keeps the eight-second failed trace and sanitized diagnostics instead of retrying or repairing', async () => {
    const failure = new Error('bounded failure');
    const page = { evaluate: vi.fn().mockResolvedValue({ ready: false, ancestors: [{ opacity: 0 }] }), waitForFunction: vi.fn().mockRejectedValue(failure) };
    const cell: any = {};
    await expect(waitConfirmedFrame(page, cell, { routeName: 'care-team' }, 'care', () => ({ assets: { pending: [] } }))).rejects.toBe(failure);
    expect(page.waitForFunction).toHaveBeenCalledTimes(1);
    expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 8000 });
    expect(cell.renderReadiness[0]).toMatchObject({ before: { ready: false }, lastObserved: { ancestors: [{ opacity: 0 }] }, diagnosticsAtFailure: { assets: { pending: [] } } });
  });
  it('requires fully visible, nonzero, opaque, unoccluded primary control pixels', () => {
    const style = { opacity: '1', visibility: 'visible', display: 'block', overflowX: 'visible', overflowY: 'visible' };
    const box = { left: 20, right: 220, top: 100, bottom: 144, width: 200, height: 44 };
    const target = { isConnected: true, disabled: false, parentElement: null, contains: () => false, getBoundingClientRect: () => box };
    let hit: any = target;
    vi.stubGlobal('getComputedStyle', () => style); vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 812);
    vi.stubGlobal('document', { documentElement: { scrollWidth: 375 }, elementFromPoint: () => hit });
    expect(observeKeptPixelTarget(target).ready).toBe(true);
    hit = null; expect(observeKeptPixelTarget(target).ready).toBe(false);
    hit = target; style.opacity = '0'; expect(observeKeptPixelTarget(target).ready).toBe(false);
    style.opacity = '1'; box.height = 0; expect(observeKeptPixelTarget(target).ready).toBe(false);
  });
  it('retains real current CTA and Back selectors, source/runtime behavior, exact fonts and native animations', () => {
    const source = read('app/scripts/capture/portrait-care-states.mjs');
    expect(read('app/src/components/companion/ChildPortrait.tsx')).toContain('onClick={() => setActiveTab("care-team")}');
    const shell = read('app/src/components/layout/Shell.tsx');
    expect(shell).toContain('"care-team": TrustedSharing'); expect(shell).toContain('sharing: TrustedSharing');
    expect(shell).toContain('data-testid="secondary-place-back" onClick={() => setActiveTab(placeForTab(activeTab).tab)}');
    expect(source).toContain('await target.click()'); expect(source).toContain('trusted: event.isTrusted');
    expect(source).toContain("await load('development')"); expect(source).toContain("await load('sharing')");
    expect(source).not.toMatch(/load\('care-team'|page\.goto|\.focus\(|force:\s*true|\.style\s*=|\.style\.|\.finish\(|\.cancel\(|\.dispatchEvent\(|\.clock\.|history\.|location\.hash\s*=|setActiveTab|waitForTimeout/);
    expect(source).toContain("const careReady = await run('care-team', 'care-arrival'");
    const arrival = source.split("const careReady = await run('care-team', 'care-arrival'")[1].split("await run('care-team', 'care-primary'")[0];
    expect(arrival).not.toMatch(/scrollIntoView|pixels\(/);
    expect(source).toContain('waitConfirmedFrame'); expect(source).toContain('observeKeptPixelTarget'); expect(source).toContain('cell.failureDiagnostics');
    expect(read('app/scripts/capture/release-interactions.mjs')).toContain("animations: group === 'portrait-care' ? 'allow' : 'disabled'");
    expect(PORTRAIT_CARE_LIMITATIONS.join(' ')).toContain('does not implement route-opener focus restoration');
    const workflow = read('.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain('"codex/portrait-care-capture" ]]; then scope=portrait-care-only;');
    expect(workflow).toContain('docker create --network none'); expect(workflow).toContain('CAPTURE_FONT_MODE=exact');
  });
});
