import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { SINGLE_GOAL_STATES, SINGLE_GOAL_ROUTES, SINGLE_GOAL_SURFACES, SINGLE_GOAL_LIMITATIONS, singleGoalFixture, initializeSingleGoalWatch, singleGoalRequiredAssertions, singleGoalShot, validSingleGoalCell, compareGoalSave, observeSingleGoalFrame } from './capture/single-goal-contract.mjs';
import { SINGLE_GOAL_NETWORK_VERSION, singleGoalNetworkReceipt } from './capture/single-goal-network.mjs';
import { probeSingleGoalKeyboard } from './capture/single-goal-keyboard.mjs';
import { releaseMatrix, RELEASE_MATRIX, releaseCell, captureDeadlineMs } from './capture/release-config.mjs';
import { missingReleaseInteractionEvidence, expectedReleaseInteractionStates } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { focusGoal, selectFocusGoal, goalLabel, GOAL_TILES } from '../src/practice/goalBuilder';
import { translate } from '../src/lib/i18n';
import { hydrateDemoFamily } from '../src/lib/demoFamilyHydrate';
import { CHILD_SUBCOLLECTIONS } from '../src/lib/childData';
import { CDC_MILESTONES } from '../src/lib/milestoneData';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const body = () => ({ child: { id: 'demo-original', name: 'Invented child', age: 4, demo: true, photoUrl: 'synthetic-old-image', avatar: { source: 'synthetic' }, strengths: [], interests: [] }, collections: { milestones: [{ ...CDC_MILESTONES[0], checked: false }], behaviorLogs: [], actionPlans: [], keepsakes: [] } });
const bundle = () => ({ ...body(), parent: { demo: true }, version: 'synthetic-capture', seededAt: '2026-10-10', locales: { en: body(), he: body() } });
const cleanApi = () => ({ singleGoalGuardVersion: SINGLE_GOAL_NETWORK_VERSION, deniedActions: 0, deniedExternal: 0, singleGoalDeniedMutations: 0, singleGoalDeniedRequests: 0 });
const viewport = releaseCell(releaseMatrix('single-goal-only')[0]).viewport;
function cellFor(row: any, size = viewport) {
  const cell = { ...row, group: 'single-goal', ...identity, viewport: `${size.w}x${size.h}`, lang: size.lang, reached: true,
    fixture: 'synthetic-single-goal-actual-controls-local-only', assertions: singleGoalRequiredAssertions(row.state).map((id: string) => ({ id, passed: true })), failures: [],
    frames: [{ ready: true }], networkEvidence: singleGoalNetworkReceipt(cleanApi(), 'after-cell-awaits'), shot: '' };
  cell.shot = singleGoalShot(cell); return cell;
}
function recordFor(spec: any) {
  const cell = releaseCell(spec); const cells = SINGLE_GOAL_STATES.map((row: any) => cellFor(row, cell.viewport));
  return { capture: { ...identity, cell, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' }, completed: true },
    inventory: { ...identity, routeIds: ROUTE_IDS, contracts: SURFACE_CONTRACTS.map(({ route, hub }) => ({ route, hub })) },
    evidence: { ...identity, completed: true, cells, singleGoalFinalNetwork: singleGoalNetworkReceipt(cleanApi(), 'after-context-browser-close', { contextClosed: true, browserClosed: true }) }, fonts: { mode: 'exact', deniedFontRequests: 0, shots: cells.map((item: any) => ({ shot: item.shot.split('/').pop(), passed: true, rendered: [{ custom: true }] })) },
    shotNames: cells.map((item: any) => item.shot.split('/').pop()) };
}
afterEach(() => vi.unstubAllGlobals());

describe('bounded single-goal capture, without a browser or socket', () => {
  it('adds four isolated exact-source cells and preserves all prior release scopes', () => {
    const matrix = releaseMatrix('single-goal-only');
    expect(matrix.map((cell: any) => cell.viewport)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    expect(RELEASE_MATRIX).toHaveLength(8); expect(releaseMatrix('parent-kid-release')).toHaveLength(24);
    expect(SINGLE_GOAL_ROUTES).toEqual(['profile', 'development', 'daily-play', 'plans']);
    expect(SINGLE_GOAL_STATES).toHaveLength(49);
    expect(new Set(SINGLE_GOAL_STATES.map((row: any) => row.state)).size).toBe(49);
    for (const spec of matrix) { const cell = releaseCell(spec); expect(cell.group).toBe('single-goal'); expect(captureDeadlineMs(cell)).toBe(600000); expect(expectedReleaseInteractionStates(cell.group, cell.viewport)).toHaveLength(49); }
    for (const [route, contract] of Object.entries(SINGLE_GOAL_SURFACES) as [string, any][]) {
      const actual = SURFACE_CONTRACTS.find(row => row.route === route)!;
      expect(contract).toEqual({ primary: actual.primaryMove, budget: actual.moduleBudget });
    }
  });
  for (const lang of ['en', 'he'] as const) it(`${lang}: explicit synthetic fixtures retain every history/unknown field and use the current bootstrap`, async () => {
    const seed = bundle(), before = JSON.stringify(seed), fixture = singleGoalFixture(seed, lang);
    expect(JSON.stringify(seed)).toBe(before); expect(fixture.parsed.locales[lang === 'en' ? 'he' : 'en']).toEqual(seed.locales[lang === 'en' ? 'he' : 'en']);
    expect(fixture.children.map((child: any) => child.id)).toEqual(['capture-goal-history', 'capture-goal-empty', 'capture-goal-long']);
    expect(fixture.children.every((child: any) => child.demo && !child.avatar && !child.photoUrl && !child.birthDate)).toBe(true);
    expect(fixture.collectionNames.every((name: string) => CHILD_SUBCOLLECTIONS.includes(name as any))).toBe(true);
    expect(fixture.children.map((child: any) => child.activeGoals.length)).toEqual([3, 0, 2]);
    expect(focusGoal(fixture.children[0].activeGoals)?.goalId).toBe('early-talking');
    expect(focusGoal(fixture.children[1].activeGoals)).toBeNull();
    for (const goal of fixture.children[2].activeGoals) expect(goalLabel(goal, (key, vars) => translate(lang, key, vars))).toBe(goal.label);
    expect(fixture.children[2].activeGoals.every((goal: any) => goal.label.length > 90)).toBe(true);
    const values = new Map<string, string>([['arbor.uiLang', lang]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => fixture.parsed })) as any;
    expect(await hydrateDemoFamily({ storage, fetchImpl })).toBe('seeded');
    expect(JSON.parse(values.get('arbor.children')!)).toEqual(fixture.children);
    expect(values.get('arbor.activeChildId')).toBe(fixture.childId);
    expect(JSON.parse(values.get(`arbor.behaviorLogs.${fixture.childId}`)!)[0].id).toBe('capture-goal-note');
    expect(await hydrateDemoFamily({ storage, fetchImpl })).toBe('current');
    expect(fetchImpl.mock.calls.every((args: any) => args[0] === '/sandbox/demo-family.json')).toBe(true);
  });
  it('refuses missing synthetic approval markers, language or milestone source', () => {
    for (const seed of [{ ...bundle(), parent: {} }, { ...body(), parent: { demo: true }, child: { demo: false } }, { ...body(), parent: { demo: true }, collections: { milestones: [] } }]) expect(() => singleGoalFixture(seed, 'en')).toThrow('SYNTHETIC_SINGLE_GOAL_FIXTURE_REQUIRED');
    expect(() => singleGoalFixture(bundle(), 'fr')).toThrow();
  });
  it('watch preload happens only once and cannot undo a real clear on reload', () => {
    const values = new Map<string, string>(), session = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => session.get(key), setItem: (key: string, value: string) => session.set(key, value) });
    const fixture = singleGoalFixture(bundle(), 'he'); initializeSingleGoalWatch(fixture);
    const key = `arbor.screen.watch.${fixture.childId}`; expect(values.get(key)).toBe(JSON.stringify(fixture.watch));
    values.delete(key); initializeSingleGoalWatch(fixture); expect(values.has(key)).toBe(false);
  });
  it('checks actual merge output for new and Earlier choices with no truncation or unknown-field loss', () => {
    const fixture = singleGoalFixture(bundle(), 'en'); let goals = fixture.children[0].activeGoals;
    const tile = GOAL_TILES.find(tile => tile.id === 'big-feelings')!;
    const newGoal = { goalId: tile.id, label: tile.label, domainId: tile.domainId };
    const newGoals = selectFocusGoal(goals, newGoal, '2026-10-10T10:00:00.000Z');
    expect(compareGoalSave(goals, newGoals, tile.id, newGoal)).toBe(true);
    const transition = newGoals.find(goal => goal.goalId === 'transitions')!;
    const earlier = selectFocusGoal(newGoals, transition, '2026-10-10T10:00:00.000Z');
    expect(compareGoalSave(newGoals, earlier, transition.goalId)).toBe(true);
    expect(compareGoalSave(newGoals, earlier.slice(1), transition.goalId)).toBe(false);
    expect(compareGoalSave(newGoals, [...earlier.slice(0, -1), { ...earlier.at(-1), label: 'Changed' }], transition.goalId)).toBe(false);
    expect(compareGoalSave(newGoals, [...earlier.slice(0, -1), { ...earlier.at(-1), addedAt: 'broken' }], transition.goalId)).toBe(false);
    expect(compareGoalSave(newGoals, [...earlier.slice(0, -1), { ...earlier.at(-1), addedAt: transition.addedAt }], transition.goalId)).toBe(false);
    expect(compareGoalSave([], selectFocusGoal([], newGoal, '2026-10-10T10:00:00.000Z'), tile.id, newGoal)).toBe(true);
    goals = fixture.children[2].activeGoals;
    expect(compareGoalSave(goals, selectFocusGoal(goals, goals[0], '2026-10-10T10:00:00.000Z'), goals[0].goalId)).toBe(true);
  });
  it('requires every named assertion, real frame and unique state-named PNG', () => {
    const cells = SINGLE_GOAL_STATES.map((row: any) => cellFor(row)); const args = { group: 'single-goal', viewport, ...identity };
    expect(missingReleaseInteractionEvidence(cells, args)).toEqual([]);
    for (const cell of cells) {
      expect(validSingleGoalCell(cell)).toBe(true);
      for (const fact of cell.assertions) expect(validSingleGoalCell({ ...cell, assertions: cell.assertions.filter((item: any) => item.id !== fact.id) })).toBe(false);
      for (const patch of [{ frames: [] }, { frames: [{ ready: false }] }, { fixture: 'unlabelled' }, { networkEvidence: {} }, { networkEvidence: { singleGoalDeniedMutations: 1 } }, { shot: cells.find((item: any) => item.state !== cell.state)!.shot }]) expect(validSingleGoalCell({ ...cell, ...patch })).toBe(false);
    }
    for (const patch of [{ reached: false }, { failures: ['actual-failure'] }, { sourceSha: 'c'.repeat(40) }, { sourceTreeSha: 'd'.repeat(40) }]) expect(missingReleaseInteractionEvidence([{ ...cells[0], ...patch }, ...cells.slice(1)], args)).toHaveLength(1);
  });
  it('aggregates four complete isolated records but never claims broader release coverage', () => {
    const records = releaseMatrix('single-goal-only').map(recordFor);
    const result = summarizeRelease(records, identity, 'single-goal-only');
    expect(result).toMatchObject({ completed: true, expectedShards: 4, expectedBaseCells: 0, baseCells: 0, interactionCells: 196, screenshots: 196 });
    expect(summarizeRelease(records, identity, 'parent-kid-release').completed).toBe(false);
    expect(summarizeRelease(records.slice(1), identity, 'single-goal-only').completed).toBe(false);
  });
  it.each(['png', 'font', 'reused', 'duplicate', 'assertion', 'network', 'tree', 'last-action', 'last-external', 'last-missing', 'late-action', 'late-external', 'late-missing', 'late-shutdown'])('fails closed when %s evidence is missing or wrong', kind => {
    const records = releaseMatrix('single-goal-only').map(recordFor), first = records[0];
    if (kind === 'png') first.shotNames.shift();
    if (kind === 'font') first.fonts.shots[0].rendered[0].custom = false;
    if (kind === 'reused') first.evidence.cells[0].shot = first.evidence.cells[1].shot;
    if (kind === 'duplicate') first.evidence.cells.push(first.evidence.cells[0]);
    if (kind === 'assertion') first.evidence.cells[0].assertions.shift();
    if (kind === 'network') first.capture.runtimeNetwork = 'bridge';
    if (kind === 'tree') first.capture.sourceTreeSha = 'c'.repeat(40);
    if (kind === 'last-action') records.at(-1)!.evidence.cells.at(-1)!.networkEvidence.deniedActions = 1;
    if (kind === 'last-external') records.at(-1)!.evidence.cells.at(-1)!.networkEvidence.deniedExternal = 1;
    if (kind === 'last-missing') delete (records.at(-1)!.evidence.cells.at(-1)!.networkEvidence as any).deniedExternal;
    if (kind === 'late-action') records.at(-1)!.evidence.singleGoalFinalNetwork.deniedActions = 1;
    if (kind === 'late-external') records.at(-1)!.evidence.singleGoalFinalNetwork.deniedExternal = 1;
    if (kind === 'late-missing') delete (records.at(-1)!.evidence as any).singleGoalFinalNetwork;
    if (kind === 'late-shutdown') records.at(-1)!.evidence.singleGoalFinalNetwork.shutdown!.contextClosed = false;
    expect(summarizeRelease(records, identity, 'single-goal-only').completed).toBe(false);
  });
  it('preserves runtime isolation, transient fonts and bounded dedicated CI branch', () => {
    const source = read('./capture/release-interactions.mjs'), workflow = read('../../.github/workflows/arbor-parent-release-capture.yml');
    expect(source).toContain('releaseFixture(singleGoal?.parsed ?? keptSearch?.parsed');
    expect(source).toContain('singleGoalBoundaries = SINGLE_GOAL_LIMITATIONS');
    expect(source).toContain('await context.addInitScript(initializeSingleGoalWatch');
    expect(source).toContain("assertLoopbackOnly(networkInterfaces())"); expect(source).toContain("await installOfflineFonts(context)");
    expect(workflow).toContain('"codex/single-goal-capture" ]]; then scope=single-goal-only;');
    expect(workflow).toContain('docker create --network none'); expect(workflow).toContain('CAPTURE_FONT_MODE=exact'); expect(workflow).toContain('font files/images never go to artifacts or registries');
    expect(workflow).not.toMatch(/workflow_dispatch|--network host|secrets\.|docker push|firebase deploy/);
    const collector = read('./capture/single-goal-states.mjs');
    expect(collector).not.toMatch(/force:\s*true|dispatchEvent|__react|\.setItem\(|\.removeItem\(|route\.fulfill|waitForTimeout|setTimeout|page\.clock|\.setContent\(/);
    for (const text of ['page.goBack(', 'page.goForward(', 'page.reload(', 'probeSingleGoalKeyboard', 'compareGoalSave', 'portrait-watch-undo', 'goal-earlier-']) expect(collector).toContain(text);
  });
  it('makes the remote and full-row acceptance limits explicit without fake successful transitions', () => {
    expect(SINGLE_GOAL_LIMITATIONS.filter((row: any) => row.status === 'offline-source-test-only').map((row: any) => row.state)).toEqual(['remote-pending-failure-retry', 'owner-session-races']);
    expect(SINGLE_GOAL_LIMITATIONS.find((row: any) => row.state === 'full-row').status).toBe('hold-unchanged');
    expect(SINGLE_GOAL_STATES.some((row: any) => /remote|pending|retry|owner|acknowledged/.test(row.state))).toBe(false);
  });
});

function keyboardHarness(skipSummary = false) {
  const nodes: any[] = ['close', 'choice-one', 'choice-two', null].map((id, index) => ({ tagName: id ? 'BUTTON' : 'SUMMARY', index, getAttribute: () => id }));
  const doc = { activeElement: nodes[0] }; vi.stubGlobal('document', doc);
  const actual = skipSummary ? nodes.slice(0, -1) : nodes;
  const controls = { count: async () => nodes.length, first: () => ({ focus: async () => { doc.activeElement = nodes[0]; } }), evaluateAll: async (fn: any) => fn(nodes) };
  const page = { keyboard: { press: vi.fn(async (key: string) => { const n = actual.indexOf(doc.activeElement); doc.activeElement = actual[(n + (key === 'Tab' ? 1 : actual.length - 1)) % actual.length]; }) } };
  return { page, dialog: { locator: () => controls } };
}
describe('non-vacuous keyboard and passive rendered-frame probes', () => {
  it('accepts real forward/reverse order including native Earlier summary', async () => {
    expect(await probeSingleGoalKeyboard(keyboardHarness())).toMatchObject({ passed: true, forward: [0, 1, 2, 3, 0], reverse: [0, 3, 2, 1, 0] });
  });
  it('rejects a trap that omits Earlier rather than directly focusing it to manufacture success', async () => {
    expect(await probeSingleGoalKeyboard(keyboardHarness(true))).toMatchObject({ passed: false, forward: [0, 1, 2, 0], reverse: [0, 2, 1, 0] });
    expect(read('./capture/single-goal-keyboard.mjs')).not.toContain('last.focus');
  });
  it('waits for concrete body, exact child, expected text and outgoing retirement', () => {
    const style = { opacity: '1', transform: 'none', display: 'block', visibility: 'visible' };
    const target: any = { innerText: 'Current choice', isConnected: true, parentElement: null, scrollWidth: 200, clientWidth: 200, getBoundingClientRect: () => ({ width: 200, height: 44 }), closest: () => null };
    const root = { querySelectorAll: () => [] };
    vi.stubGlobal('document', { querySelector: (selector: string) => selector.includes('[data-route=') ? root : selector === '#main' ? { innerText: 'Current main', clientWidth: 375, scrollWidth: 375 } : null,
      querySelectorAll: (selector: string) => selector === '#line' ? [target] : [], documentElement: { scrollWidth: 375, dir: 'ltr' }, activeElement: target });
    vi.stubGlobal('getComputedStyle', () => style); vi.stubGlobal('location', { hash: '#/development' }); vi.stubGlobal('innerWidth', 375); vi.stubGlobal('localStorage', { getItem: () => 'child-a' });
    const args = { route: 'development', childId: 'child-a', selector: '#line', expectedText: 'Current choice', outgoing: { isConnected: false } };
    expect(observeSingleGoalFrame(args)).toMatchObject({ ready: true, matches: 1, targetText: 'Current choice' });
    for (const patch of [{ childId: 'other' }, { expectedText: 'Different' }, { outgoing: { isConnected: true } }, { route: 'profile' }]) expect(observeSingleGoalFrame({ ...args, ...patch, waitUntilReady: true })).toBe(false);
    style.opacity = '0'; expect(observeSingleGoalFrame(args)).toMatchObject({ ready: false }); style.opacity = '1';
    style.transform = 'matrix(1, 0, 0, 1, 0, 8)'; expect(observeSingleGoalFrame(args)).toMatchObject({ ready: false }); style.transform = 'none';
    target.isConnected = false; expect(observeSingleGoalFrame(args)).toMatchObject({ ready: false });
  });
});
