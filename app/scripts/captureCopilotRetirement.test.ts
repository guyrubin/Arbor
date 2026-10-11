import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { COPILOT_RETIREMENT_ASSERTIONS, COPILOT_RETIREMENT_STATES, COPILOT_RETIREMENT_LIMITATIONS, COPILOT_RETIREMENT_NOW, copilotRetirementFixture, expectedCopilotSummary, copilotRequiredAssertions, validCopilotRetirementCell, validCopilotNetwork, copilotApiDisposition, installCopilotClipboardSink, validCopilotTargetHeading } from './capture/copilot-retirement-contract.mjs';
import { releaseMatrix, releaseCell, RELEASE_MATRIX, RELEASE_VIEWPORTS } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { buildClinicianSummary } from '../src/consult/clinicianSummary';
import { assertClinicianExportCeiling } from '../src/consult/packet';
import { domainBands, soundStats, streakDays, weeklyActivity } from '../src/practice/signals';
import { watchSignals } from '../src/practice/watch';
import { hydrateMilestones } from '../src/context/milestoneHydration';
import { savedMilestoneHistory } from '../src/lib/record/savedMilestoneHistory';
import { domainLabelEn } from '../src/lib/domains/registry';
import { translate } from '../src/lib/i18n';
import { fmtDay } from '../src/lib/formatDate';
import { appointmentRoleLabel } from '../src/lib/appointmentLabel';
import { ageYearsOf } from '../src/lib/age/forChild';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const seed = { version: 'capture', seededAt: COPILOT_RETIREMENT_NOW, parent: { demo: true }, child: { id: 'seed', name: 'Invented', demo: true }, collections: { milestones: [], behaviorLogs: [], routines: [] } };
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const safeNetwork = () => ({ deniedActions: 0, deniedExternal: 0, copilotDenied: 0, privateExportAuthHeaders: 0, privateExportHeaderChecks: 1, privateExportHeaderReadsPending: 0, privateExportHeaderReadFailures: 0 });
const targetFor = (lang: 'en' | 'he') => ({ appointment: 'capture-copilot-visit', selectedSlp: true, unavailableCount: 0, secondaryLineCount: 0, heading: translate(lang, 'elev.consult.h1.visit', { profession: appointmentRoleLabel({ profession: 'slp' }, key => translate(lang, key)), date: fmtDay('2026-10-11T09:00:00.000Z', lang) }) });
const cellFor = (state: string, vp: any) => ({ targetEvidence: targetFor(vp.lang), clipboardEvidence: { before: 0, after: 1, syntheticOnly: true, actual: expectedCopilotSummary(copilotRetirementFixture(seed, vp.lang), { sibling: state === 'consult-current-child', changed: state === 'consult-source-fresh' }), expected: expectedCopilotSummary(copilotRetirementFixture(seed, vp.lang), { sibling: state === 'consult-current-child', changed: state === 'consult-source-fresh' }) }, route: state.startsWith('consult-') ? 'consult' : 'development', state, group: 'copilot-retirement', ...identity, lang: vp.lang, viewport: `${vp.w}x${vp.h}`, reached: true, failures: [], shot: `shots/${vp.id}.${state}.png`, assertions: copilotRequiredAssertions(state).map((id: string) => ({ id, passed: true })), frame: { ready: true }, controlFrame: { reachable: true, width: 44, height: 44 }, rootDirection: vp.lang === 'he' ? 'rtl' : 'ltr', networkEvidence: safeNetwork(), runtimeDiagnostics: { counts: {}, recent: [] } });
const records = () => releaseMatrix('copilot-retirement-only').map((spec: any) => {
  const cell = releaseCell(spec); const cells = COPILOT_RETIREMENT_STATES.map(({ state }: any) => cellFor(state, cell.viewport));
  const shotNames = cells.map((row: any) => row.shot.split('/').pop());
  return { capture: { ...identity, cell, completed: true, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' } }, inventory: { ...identity, routeIds: ROUTE_IDS, contracts: SURFACE_CONTRACTS }, evidence: { ...identity, completed: true, cells }, shotNames, fonts: { mode: 'exact', deniedFontRequests: 0, shots: shotNames.map((shot: string) => ({ shot, passed: true, rendered: [{ custom: true }] })) } };
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('bounded exact-source Copilot retirement evidence without browser/network', () => {
  it('adds exactly 120 cells at the established four root-direction viewports', () => {
    expect(COPILOT_RETIREMENT_STATES).toHaveLength(30);
    expect(new Set(COPILOT_RETIREMENT_STATES.map((row: any) => row.state)).size).toBe(30);
    expect(releaseMatrix('copilot-retirement-only')).toHaveLength(4);
    expect(RELEASE_VIEWPORTS.map((vp: any) => [vp.w, vp.h, vp.lang])).toEqual([[375, 812, 'en'], [375, 812, 'he'], [1280, 800, 'en'], [1280, 800, 'he']]);
    expect(RELEASE_MATRIX).toHaveLength(8); expect(releaseMatrix('parent-kid-release')).toHaveLength(24);
    for (const spec of releaseMatrix('copilot-retirement-only')) expect(expectedReleaseInteractionStates(spec.group, releaseCell(spec).viewport)).toHaveLength(30);
  });
  it.each(['en', 'he'])('prepares explicit invented collections and preserves input (%s)', lang => {
    const original = JSON.stringify(seed); const fixture = copilotRetirementFixture(seed, lang);
    expect(JSON.stringify(seed)).toBe(original);
    expect(fixture.child).toMatchObject({ id: 'capture-copilot-a', demo: true, ageMonths: 48 });
    expect(fixture.sibling).toMatchObject({ id: 'capture-copilot-b', demo: true });
    for (const name of ['speechAttempts', 'mimicSessions', 'missionRecords', 'adventureResults', 'practiceEvents', 'screenings', 'milestones', 'behaviorLogs']) expect(Array.isArray(fixture.collections[name])).toBe(true);
    expect(fixture.collections.routines).toEqual([]); expect(fixture.siblingCollections.adventureResults).toEqual([]);
    expect(fixture.parsed.siblings[0].collections.bandSnapshots[0].bands[0].reached).toBe(9);
    const localized = { ...seed, locales: { [lang]: { child: seed.child, collections: seed.collections } } };
    expect(copilotRetirementFixture(localized, lang).parsed.locales[lang].child.id).toBe('capture-copilot-a');
  });
  it('refuses non-demo or unsupported input', () => {
    expect(() => copilotRetirementFixture(seed, 'fr')).toThrow();
    for (const bad of [{ ...seed, parent: {} }, { ...seed, child: {} }, { ...seed, collections: {} }]) expect(() => copilotRetirementFixture(bad, 'en')).toThrow();
  });
  for (const lang of ['en', 'he']) for (const variant of ['base', 'sibling', 'changed', 'blocked']) it(`pins exact ${lang}/${variant} text to production derivations`, () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(COPILOT_RETIREMENT_NOW));
    const fixture = copilotRetirementFixture(seed, lang); const sibling = variant === 'sibling';
    const childProfile = sibling ? fixture.sibling : fixture.child; const cols = structuredClone(sibling ? fixture.siblingCollections : fixture.collections);
    if (variant === 'changed') cols.adventureResults.push({ id: 'capture-story-new', timestamp: '2026-10-09T09:00:00.000Z' });
    if (variant === 'blocked') cols.speechAttempts[0].sound = 'riskLevel';
    const milestones = hydrateMilestones(cols.milestones, []);
    const bands = domainBands(milestones, cols.speechAttempts, cols.missionRecords, cols.adventureResults, cols.practiceEvents);
    const stats = soundStats(cols.speechAttempts);
    const watch = watchSignals({ age: ageYearsOf(childProfile), screeningWatchLabels: cols.screenings[0]?.watchAreas.map((area: any) => ({ domain: area.domain, label: domainLabelEn('screen', area.domain) })) ?? [], logs: cols.behaviorLogs, stats, bands, missions: cols.missionRecords, adventureScenes: cols.adventureResults.length });
    const actual = buildClinicianSummary({ childProfile, milestones, bands, data: { today: '2026-10-10', stats, streak: streakDays(cols.missionRecords, '2026-10-10'), week: weeklyActivity(cols.speechAttempts, cols.mimicSessions, cols.missionRecords, cols.adventureResults, '2026-10-10', cols.practiceEvents) }, advCount: cols.adventureResults.length, watch });
    if (variant === 'blocked') expect(actual).toEqual({ previewSummary: null, clinicianSummary: null });
    else {
      const options = { sibling, changed: variant === 'changed' };
      expect(actual.clinicianSummary).toBe(expectedCopilotSummary(fixture, options));
      expect(actual.previewSummary).toBe(expectedCopilotSummary(fixture, { ...options, preview: true }));
      expect(actual.previewSummary).not.toMatch(/Streak:|\d+%|riskLevel|emerging|developing|\bstrong\b/);
      expect(() => assertClinicianExportCeiling(actual.clinicianSummary!)).not.toThrow();
    }
  });
  it('pins saved numerators, zero and dates without clamping', () => {
    const history = savedMilestoneHistory(copilotRetirementFixture(seed, 'en').collections.bandSnapshots);
    expect(history).toEqual([{ id: '2026-W40', date: '2026-10-05', counts: [{ domain: 'language', reached: 17 }, { domain: 'social', reached: 0 }] }, { id: '2026-W39', date: '2026-09-28', counts: [{ domain: 'language', reached: 3 }] }]);
    expect(JSON.stringify(history)).not.toMatch(/signal|band"|total|strong/);
  });
  it('uses only a bounded synthetic clipboard sink', async () => {
    const win: any = {}; const nav: any = {}; vi.stubGlobal('window', win); vi.stubGlobal('navigator', nav);
    installCopilotClipboardSink(); await nav.clipboard.writeText('invented');
    expect(win.__arborCopilotClipboard).toEqual({ kind: 'synthetic-copilot-clipboard-only', calls: ['invented'] });
    await expect(nav.clipboard.writeText('x'.repeat(20001))).rejects.toThrow(); expect(win.__arborCopilotClipboard.calls).toEqual(['invented']);
  });
  it('fails closed for auth/private requests, mutations and unreadable headers', () => {
    for (const [method, pathname] of [['POST', '/api/chat'], ['POST', '/api/consent'], ['DELETE', '/api/children/id'], ['GET', '/api/auth/user'], ['GET', '/api/privacy/export/id'], ['GET', '/api/children/id/book-assets/book/file']]) expect(copilotApiDisposition(method, pathname)).toBe('deny');
    expect(copilotApiDisposition('GET', '/api/entitlement')).toBe('read'); expect(copilotApiDisposition('POST', '/api/todays-focus')).toBe('read');
    expect(validCopilotNetwork(safeNetwork())).toBe(true);
    for (const field of ['deniedActions', 'deniedExternal', 'copilotDenied', 'privateExportAuthHeaders', 'privateExportHeaderReadsPending', 'privateExportHeaderReadFailures']) expect(validCopilotNetwork({ ...safeNetwork(), [field]: 1 })).toBe(false);
    expect(validCopilotNetwork({ ...safeNetwork(), privateExportHeaderChecks: 0 })).toBe(false);
  });
  it.each(COPILOT_RETIREMENT_STATES.map((row: any) => row.state))('requires unique state evidence without generic pass placeholders: %s', state => {
    const cell = cellFor(state, RELEASE_VIEWPORTS[0]); expect(validCopilotRetirementCell(cell)).toBe(true);
    expect(COPILOT_RETIREMENT_ASSERTIONS[state]).toHaveLength(2);
    for (const id of copilotRequiredAssertions(state)) {
      expect(validCopilotRetirementCell({ ...cell, assertions: cell.assertions.filter((item: any) => item.id !== id) })).toBe(false);
      expect(validCopilotRetirementCell({ ...cell, assertions: cell.assertions.map((item: any) => item.id === id ? { ...item, passed: false } : item) })).toBe(false);
    }
    expect(validCopilotRetirementCell({ ...cell, assertions: [{ id: 'GENERIC_PASS', passed: true }] })).toBe(false);
  });
  it('rejects bad geometry/direction/readiness/runtime and absent source identity', () => {
    const cell = cellFor('consult-copy', RELEASE_VIEWPORTS[0]);
    for (const patch of [{ frame: { ready: false } }, { controlFrame: { reachable: true, width: 43, height: 44 } }, { controlFrame: { reachable: false, width: 44, height: 44 } }, { rootDirection: 'rtl' }, { runtimeDiagnostics: { counts: { OTHER_ERROR: 1 }, recent: [] } }, { networkEvidence: {} }]) expect(validCopilotRetirementCell({ ...cell, ...patch })).toBe(false);
    const cells = COPILOT_RETIREMENT_STATES.map(({ state }: any) => cellFor(state, RELEASE_VIEWPORTS[0]));
    expect(missingReleaseInteractionEvidence(cells, { group: 'copilot-retirement', viewport: RELEASE_VIEWPORTS[0], ...identity })).toEqual([]);
    cells[0].sourceSha = 'c'.repeat(40); expect(missingReleaseInteractionEvidence(cells, { group: 'copilot-retirement', viewport: RELEASE_VIEWPORTS[0], ...identity })).toHaveLength(1);
  });
  it('requires all 120 distinct exact-font screenshots and exact source receipts', () => {
    expect(summarizeRelease(records(), identity, 'copilot-retirement-only')).toMatchObject({ completed: true, expectedShards: 4, baseCells: 0, interactionCells: 120, screenshots: 120 });
    for (const change of [(all: any) => all[0].evidence.cells.pop(), (all: any) => all[0].shotNames.pop(), (all: any) => all[0].fonts.shots.pop(), (all: any) => all[0].evidence.cells[1].shot = all[0].evidence.cells[0].shot, (all: any) => all[0].evidence.cells.push(all[0].evidence.cells[0]), (all: any) => all[0].evidence.cells[0].assertions.pop(), (all: any) => all[0].capture.sourceTreeSha = 'c'.repeat(40)]) {
      const all = records(); change(all); expect(summarizeRelease(all, identity, 'copilot-retirement-only').completed).toBe(false);
    }
  });
  it('requires the exact bounded clipboard receipt and never accepts the observed text as its own oracle', () => {
    const cell = cellFor('consult-copy', RELEASE_VIEWPORTS[0]);
    for (const patch of [{ clipboardEvidence: undefined }, { clipboardEvidence: { ...cell.clipboardEvidence, actual: 'wrong' } }, { clipboardEvidence: { ...cell.clipboardEvidence, actual: 'wrong', expected: 'wrong' } }, { clipboardEvidence: { ...cell.clipboardEvidence, after: 0 } }, { clipboardEvidence: { ...cell.clipboardEvidence, syntheticOnly: false } }]) expect(validCopilotRetirementCell({ ...cell, ...patch })).toBe(false);
  });
  it.each(['en', 'he'] as const)('requires the actual visit H1 and exact target, with negative controls (%s)', lang => {
    const receipt = targetFor(lang); expect(validCopilotTargetHeading(receipt, lang)).toBe(true);
    for (const patch of [{ appointment: 'other' }, { selectedSlp: false }, { unavailableCount: 1 }, { secondaryLineCount: 1 }, { heading: 'Prepare for a visit' }, { heading: receipt.heading.replace('11', '12') }, { heading: receipt.heading.replace(lang === 'he' ? 'תקשורת' : 'Speech therapist', 'Other') }]) expect(validCopilotTargetHeading({ ...receipt, ...patch }, lang)).toBe(false);
    const states = read('./capture/copilot-retirement-states.mjs'); expect(states).not.toContain("await byId('consult-visit-line').isVisible()"); expect(states).toContain("heading: await byId('consult-h1').textContent()"); expect(states).not.toContain('data-split-preset'); expect(states).toContain("getByRole('radio', { name: he ? 'קלינאי/ת תקשורת' : 'Speech therapist', exact: true })");
    const cell = cellFor('consult-target-current', RELEASE_VIEWPORTS[0]); expect(validCopilotRetirementCell({ ...cell, targetEvidence: undefined })).toBe(false);
  });
  it('labels unsupported cases and uses actual controls', () => {
    expect(COPILOT_RETIREMENT_LIMITATIONS.map((row: any) => row.state)).toEqual(expect.arrayContaining(['remote-source-loading-cache-pending-error', 'history-loading-cache-error', 'authenticated-owner-retirement', 'pre-render-held-callbacks']));
    const source = read('./capture/copilot-retirement-states.mjs');
    expect(source).not.toMatch(/force:\s*true|dispatchEvent|__react|setAuthTokenProvider|currentUser\s*=|setContent|addStyleTag|setExtraHTTPHeaders|requestSubmit/);
    for (const evidence of ["await opener().press('Enter')", 'await copy().click()', 'await page.goBack()', 'await page.goForward()', 'await page.reload(', "page.getByRole('listbox').getByRole('option')", 'same-document-localStorage-read-receipt-no-synthetic-storage-event']) expect(source).toContain(evidence);
  });
  it('wires shared offline/header/font guards and additive branch scope', () => {
    const interactions = read('./capture/release-interactions.mjs');
    expect(interactions).toContain('if (privateExport || copilot) await installPrivateExportAdmissionBoundary(context, apiState)');
    expect(interactions).toContain('await collectCopilotRetirementStates({ page, fixture: copilot');
    expect(interactions).toContain("check(cell, 'FINAL_COPILOT_NETWORK_GUARD', validCopilotNetwork(cell.networkEvidence))");
    const workflow = read('../../.github/workflows/arbor-parent-release-capture.yml');
    for (const literal of ['claude/copilot-retirement-release-2026-10-10', 'then scope=copilot-retirement-only;', 'docker create --network none', 'CAPTURE_DISPOSABLE_CI=true', 'if: always()']) expect(workflow).toContain(literal);
    expect(read('./capture/private-export-admission.mjs')).toContain('request.allHeaders()'); expect(ROUTE_IDS).toHaveLength(43); expect(SURFACE_CONTRACTS).toHaveLength(43);
  });
});
