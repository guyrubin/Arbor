import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { KID_ENTRY_STATES, KID_ENTRY_LIMITATIONS, KID_ENTRY_REQUIRED_ASSERTIONS, kidEntryRequiredAssertions, kidEntryFixture, kidEntryApiDisposition, validKidEntryCell, observeKidEntry, kidEntryHomeFacts, compareKidEntryProfiles } from './capture/kid-entry-contract.mjs';
import { initializeSyntheticOnline } from './capture/small-state.mjs';
import { releaseMatrix, releaseCell } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { serializeKidModeState } from '../src/lib/kidModeGate';
import { kidModeOpenFor } from '../src/lib/age/playGate';
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const source = () => read('./capture/kid-entry-states.mjs');
const seed = { parent: { demo: true }, child: { id: 'demo', name: 'Demo child', demo: true, age: 3, birthDate: '2000-01-01', ageMonths: 200, ageMonthsAsOf: '2000-01-01', preterm: { gestationalWeeks: 30 }, photoUrl: 'data:image/png;base64,AAAA', avatar: { source: 'descriptor' } }, collections: { milestones: [{ id: 'example' }], keepsakes: [] } };
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const viewport = releaseCell(releaseMatrix('kid-entry-diagnostic')[0]).viewport;
const cellFor = (state: string) => ({ state, route: 'shell', group: 'kid-entry', ...identity, lang: viewport.lang, viewport: `${viewport.w}x${viewport.h}`, reached: true, shot: `shots/${state}.png`, failures: [], frames: [{ ready: true }], networkEvidence: { kidEntryDeniedMutations: 0 }, assertions: kidEntryRequiredAssertions(state).map(id => ({ id, passed: true })) });
afterEach(() => { vi.unstubAllGlobals(); });
// observeKidEntry's polling form legitimately returns false. Non-polling
// observations must narrow that union explicitly before reading frame facts.
const observation = (args: Parameters<typeof observeKidEntry>[0]) => {
  const result = observeKidEntry(args);
  if (result === false) throw new Error('EXPECTED_OBSERVATION_OBJECT');
  return result;
};

describe('bounded Kids entry capture contract, no browser or provider', () => {
  it('adds 18-state diagnostic and 72-state release without changing current Parent858', () => {
    expect(releaseMatrix('kid-entry-diagnostic')).toEqual([{ viewport: 'desktop-en', group: 'kid-entry', shard: 0 }]);
    expect(releaseMatrix('kid-entry-only')).toHaveLength(4);
    expect(releaseMatrix('kid-entry-release')).toEqual([...releaseMatrix('kid-entry-only'), ...releaseMatrix('confirmed-actions-release')]);
    expect(releaseMatrix('confirmed-actions-release')).toHaveLength(16);
    expect(releaseMatrix('confirmed-actions-release').reduce((sum: number, spec: any) => sum + (spec.group === 'base' ? 43 : expectedReleaseInteractionStates(spec.group, releaseCell(spec).viewport).length), 0)).toBe(858);
    expect(KID_ENTRY_STATES).toHaveLength(18); expect(new Set(KID_ENTRY_STATES.map(row => row.state)).size).toBe(18);
    expect(releaseMatrix('kid-entry-release')).toHaveLength(20);
  });
  it('requires every named fact and real destination frames in addition to screenshot and identity', () => {
    expect(Object.keys(KID_ENTRY_REQUIRED_ASSERTIONS).sort()).toEqual(KID_ENTRY_STATES.map(row => row.state).sort());
    const cells = KID_ENTRY_STATES.map(({ state }) => cellFor(state)); const args = { group: 'kid-entry', viewport, ...identity };
    expect(missingReleaseInteractionEvidence(cells, args)).toEqual([]);
    for (const original of cells) {
      expect(validKidEntryCell(original)).toBe(true);
      for (const assertion of original.assertions) {
        const incomplete = { ...original, assertions: original.assertions.filter(item => item.id !== assertion.id) };
        expect(validKidEntryCell(incomplete)).toBe(false);
        expect(missingReleaseInteractionEvidence([incomplete, ...cells.filter(item => item.state !== original.state)], args)).toHaveLength(1);
      }
      for (const patch of [{ frames: [] }, { frames: [{ ready: false }] }, { networkEvidence: {} }, { networkEvidence: { kidEntryDeniedMutations: 1 } }]) expect(validKidEntryCell({ ...original, ...patch })).toBe(false);
    }
    expect(validKidEntryCell({ state: 'made-up' })).toBe(false);
  });
  for (const lang of ['en', 'he']) it(`uses invented 4y/3y/2y no-hero profiles (${lang})`, () => {
    const before = JSON.stringify(seed); const fixture = kidEntryFixture(seed, lang); expect(JSON.stringify(seed)).toBe(before);
    expect(fixture.childIds).toEqual(['capture-kid-entry-a', 'capture-kid-entry-b', 'capture-kid-entry-under-three']);
    expect([fixture.child, fixture.sibling, fixture.younger].map(child => kidModeOpenFor(child))).toEqual([true, true, false]);
    expect([fixture.child, fixture.sibling, fixture.younger].every(child => child.demo === true && !child.avatar && !child.photoUrl && !child.birthDate && !child.ageMonths && !child.preterm)).toBe(true);
    expect(fixture.parsed.collections).toEqual({ milestones: [], keepsakes: [] });
    expect(fixture.parsed.siblings.every(sibling => Object.values(sibling.collections).every((rows: any) => rows.length === 0))).toBe(true);
  });
  it('refuses absent demo flags or malformed seed', () => {
    for (const input of [{ ...seed, parent: {} }, { ...seed, child: { ...seed.child, demo: false } }, { ...seed, collections: {} }]) expect(() => kidEntryFixture(input, 'en')).toThrow('SYNTHETIC_KID_ENTRY_FIXTURE_REQUIRED');
    expect(() => kidEntryFixture(seed, 'fr')).toThrow();
  });
  it('keeps other locale bodies unchanged', () => {
    const bundle = { ...seed, locales: { en: structuredClone(seed), he: structuredClone(seed) } }; const fixture = kidEntryFixture(bundle, 'he');
    expect(fixture.parsed.locales.he.child.id).toBe(fixture.childId); expect(fixture.parsed.locales.en).toEqual(bundle.locales.en);
  });
  it('refuses exact automatic synthetic narration and denies generation/mutation', () => {
    const ids = kidEntryFixture(seed, 'en').childIds;
    for (const id of ids) expect(kidEntryApiDisposition('POST', `/api/children/${id}/book-narration`, ids)).toBe('synthetic-narration-refusal');
    for (const path of ['/api/children/other/book-narration', `/api/children/${ids[0]}/book-narration/more`, '/api/generate-avatar', '/api/generate-scene', '/api/chat', '/api/consent', '/api/shares']) expect(kidEntryApiDisposition('POST', path, ids)).toBe('deny');
    for (const method of ['PUT', 'DELETE', 'PATCH']) expect(kidEntryApiDisposition(method, '/api/todays-focus', ids)).toBe('deny');
    expect(kidEntryApiDisposition('GET', '/api/tts', ids)).toBe('read'); expect(kidEntryApiDisposition('POST', '/api/todays-focus', ids)).toBe('read');
  });
  it('preserves real lock through reload only in additive entry fixture', () => {
    const values = new Map(); const storage = { setItem: (key: string, value: string) => values.set(key, value), getItem: (key: string) => values.get(key) ?? null };
    const boot = (preserveKidMode?: boolean) => { vi.stubGlobal('window', {}); vi.stubGlobal('navigator', { onLine: false }); vi.stubGlobal('localStorage', storage); initializeSyntheticOnline({ lang: 'he', preserveKidMode }); };
    boot(true); expect(JSON.parse(values.get('arbor.kidmode.active'))).toEqual({ open: false });
    const lock = JSON.stringify({ open: true, view: 'home', worldId: null }); values.set('arbor.kidmode.active', lock);
    boot(true); expect(values.get('arbor.kidmode.active')).toBe(lock); boot(); expect(JSON.parse(values.get('arbor.kidmode.active'))).toEqual({ open: false });
  });
  it('declares untested flows and does not force clicks, app callbacks or resets', () => {
    expect(KID_ENTRY_LIMITATIONS.filter(row => row.status === 'offline-hook-evidence-only').map(row => row.state)).toEqual(['pending-step-child-change', 'deferred-hero-save']);
    expect(KID_ENTRY_LIMITATIONS.find(row => row.state === 'parent-gate').status).toBe('synthetic-no-pin-only');
    expect(source()).not.toMatch(/force:\s*true|dispatchEvent|__react|\.setItem\(|\.removeItem\(|generate-avatar|resetHeroStepMemory/);
    expect(source()).toContain('page.mouse.down()'); expect(source()).toContain('page.reload({ waitUntil:'); expect(source()).toContain('no pending-modal switch');
  });
  it('retains network-none/exact ephemeral font isolation with bounded diagnostic branch', () => {
    const workflow = read('../../.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain('"codex/kid-entry-safety-diagnostic" ]]; then scope=kid-entry-diagnostic;');
    expect(workflow).toContain('"codex/kid-entry-safety-release" ]]; then scope=kid-entry-release;');
    expect(workflow).toContain('docker create --network none'); expect(workflow).toContain('CAPTURE_FONT_MODE=exact'); expect(workflow).toContain('font files/images never go to artifacts or registries');
  });
  it('observer requires actual destination body/child/visibility and captures focus facts', () => {
    const node: any = { textContent: 'Rendered body', parentElement: null, getBoundingClientRect: () => ({ width: 200, height: 100 }), closest: () => null, contains: (target: any) => target === node, isConnected: true, tagName: 'BUTTON' };
    vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === '#target' ? [node] : [], querySelector: () => null, activeElement: node, documentElement: { scrollWidth: 375 } });
    vi.stubGlobal('getComputedStyle', () => ({ opacity: '1', transform: 'none', display: 'block', visibility: 'visible' }));
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'arbor.activeChildId' ? 'child-a' : '{"open":false}' }); vi.stubGlobal('sessionStorage', { getItem: () => '[]' }); vi.stubGlobal('location', { hash: '#/overview' }); vi.stubGlobal('innerWidth', 375);
    expect(observation({ selector: '#target', childId: 'child-a' })).toMatchObject({ ready: true, focus: { insideTarget: true, connected: true } });
    expect(observeKidEntry({ selector: '#target', childId: 'child-b', waitUntilReady: true })).toBe(false);
    node.textContent = ''; expect(observation({ selector: '#target', childId: 'child-a' }).ready).toBe(false);
  });
  it('measures the visible Now heading inside a zero-box display:contents route without losing route/outgoing identity', () => {
    let headings: any[] = [];
    const styles = new Map();
    const route: any = { isConnected: true, parentElement: null, textContent: 'container text', querySelectorAll: () => headings,
      getBoundingClientRect: () => ({ width: 0, height: 0 }), closest: () => null, contains: (el: any) => headings.includes(el) };
    const heading: any = { isConnected: true, parentElement: route, textContent: 'Today with Noa', tagName: 'H1',
      getBoundingClientRect: () => ({ width: 250, height: 36 }), closest: () => null, contains: () => false };
    headings = [heading];
    const normal = { opacity: '1', transform: 'none', display: 'block', visibility: 'visible' };
    styles.set(route, { ...normal, display: 'contents' }); styles.set(heading, normal);
    vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === '#route' ? [route] : [], querySelector: () => null, activeElement: heading, documentElement: { scrollWidth: 375 } });
    vi.stubGlobal('getComputedStyle', (el: any) => styles.get(el));
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'arbor.activeChildId' ? 'child-a' : '{"open":false}' });
    vi.stubGlobal('sessionStorage', { getItem: () => '[]' }); vi.stubGlobal('location', { hash: '#/overview' }); vi.stubGlobal('innerWidth', 375);
    const args = { selector: '#route', contentSelector: 'h1', childId: 'child-a', outgoing: { isConnected: false } };
    expect(observeKidEntry(args)).toMatchObject({ ready: true, count: 1, contentCount: 1, rootBounds: { width: 0, height: 0 }, contentBounds: { width: 250, height: 36 }, outgoingRetired: true, text: 'Today with Noa' });
    // The original observer's selector-only path is explicitly red for this
    // source-realistic zero-box wrapper; the corrected descendant path passes.
    expect(observation({ ...args, contentSelector: null }).ready).toBe(false);
    expect(observation({ ...args, outgoing: { isConnected: true } }).ready).toBe(false);
    expect(observation({ ...args, childId: 'child-b' }).ready).toBe(false);
    headings = []; expect(observation(args).ready).toBe(false);
    headings = [heading, heading]; expect(observation(args).ready).toBe(false);
    headings = [heading]; styles.set(heading, { ...normal, visibility: 'hidden' }); expect(observation(args).ready).toBe(false);
    styles.set(heading, normal); heading.textContent = ''; expect(observation(args).ready).toBe(false);
  });
  it('waits for the real Kid home header and its nested view animation instead of passing on the outer dialog', () => {
    const normal = { opacity: '1', transform: 'none', display: 'block', visibility: 'visible' };
    const styles = new Map();
    const make = (parent: any, text: string) => ({ isConnected: true, tagName: 'DIV', parentElement: parent, textContent: text,
      getBoundingClientRect: () => ({ width: 350, height: 80 }), closest: () => null, contains: () => false });
    const overlay: any = make(null, 'Outer dialog'); const view = make(overlay, 'Home view'); const header = make(view, 'Hi Noa!');
    overlay.querySelectorAll = () => [header];
    styles.set(overlay, normal); styles.set(header, normal); styles.set(view, { ...normal, opacity: '0', transform: 'matrix(1, 0, 0, 1, 0, 8)' });
    vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === '#kid' ? [overlay] : [], querySelector: () => null, activeElement: header, documentElement: { scrollWidth: 375 } });
    vi.stubGlobal('getComputedStyle', (el: any) => styles.get(el));
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'arbor.activeChildId' ? 'child-a' : '{"open":true,"view":"home","worldId":null}' });
    vi.stubGlobal('sessionStorage', { getItem: () => '[]' }); vi.stubGlobal('location', { hash: '#/overview' }); vi.stubGlobal('innerWidth', 375);
    const args = { selector: '#kid', contentSelector: '[data-kid-view="home"] > div > header', childId: 'child-a' };
    expect(observation({ ...args, contentSelector: null }).ready).toBe(true);
    expect(observation(args).ready).toBe(false);
    styles.set(view, normal); expect(observeKidEntry(args)).toMatchObject({ ready: true, text: 'Hi Noa!', contentCount: 1 });
    header.isConnected = false; expect(observation(args).ready).toBe(false);
    expect(source()).toContain("selector === parentSelector ? 'h1'");
    expect(source()).toContain("'ACTUAL_HOME_GREETING_NAMES_CURRENT_CHILD'");
    for (const state of ['sibling-hero-first', 'sibling-parent-return', 'under-three-child-switch', 'child-aba-return']) expect(kidEntryRequiredAssertions(state)).toContain('ACTUAL_VISIBLE_CHILD_IDENTITY');
  });
  it('matches the actual mode serializer but never accepts a named world or a missing parent shield', () => {
    const state = JSON.parse(serializeKidModeState({ open: true, view: 'home', worldId: null }));
    expect(Object.hasOwn(state, 'worldId')).toBe(false);
    const frame = { state, overlayCount: 1, mainInert: true, hash: '#/overview' };
    expect(Object.values(kidEntryHomeFacts(frame)).every(Boolean)).toBe(true);
    expect(Object.values(kidEntryHomeFacts({ ...frame, state: { ...state, worldId: null } })).every(Boolean)).toBe(true);
    for (const worldId of ['sneak', '', false, 0]) expect(kidEntryHomeFacts({ ...frame, state: { ...state, worldId } }).noWorld).toBe(false);
    expect(kidEntryHomeFacts({ ...frame, mainInert: false }).parentInert).toBe(false);
    expect(kidEntryHomeFacts({ ...frame, state: { open: false, view: 'home' } }).open).toBe(false);
    expect(source()).toContain("phase: 'first-ready-home-body'");
    expect(source()).toContain("phase: 'after-real-tab'");
    expect(source()).not.toContain('waitForTimeout');
  });
  it('accounts for only observed visit transitions on selected synthetic identities while preserving every other field', () => {
    expect(source()).toContain('profileFieldsIntact &&=');
    expect(source()).toContain('profileVisitsIntact &&=');
    type VisitProfileFixture = { id: string; name: string; age: number; avatar?: { source: string }; lastVisitAt?: string; lastVisitPreviousAt?: string };
    type VisitedProfileFixture = VisitProfileFixture & { lastVisitAt: string };
    const base: [VisitProfileFixture, VisitProfileFixture] = [{ id: 'a', name: 'Noa', age: 4, avatar: { source: 'descriptor' } }, { id: 'b', name: 'Mira', age: 3 }];
    const start = Date.parse('2026-10-10T06:00:00.000Z');
    const compare = (previous: unknown, current: unknown, extra = {}) => compareKidEntryProfiles({ previous, current, allowedChildIds: ['a', 'b'], visitedChildIds: ['a'], earliestStampMs: start, observedAtMs: start + 3_600_000, ...extra });
    const first: [VisitedProfileFixture, VisitProfileFixture] = [{ ...base[0], lastVisitAt: '2026-10-10T06:00:10.000Z' }, base[1]];
    expect(compare(base, first)).toMatchObject({ passed: true, fieldsUnchanged: true, changes: [{ childId: 'a', fields: ['lastVisitAt'], expectedTransition: 'first-visit', visitTransitionValid: true }] });
    const bump: [VisitedProfileFixture, VisitProfileFixture] = [{ ...first[0], lastVisitAt: '2026-10-10T06:01:10.000Z' }, base[1]];
    expect(compare(first, bump)).toMatchObject({ passed: true, changes: [{ expectedTransition: 'bump-visit' }] });
    const rotate: [VisitedProfileFixture & { lastVisitPreviousAt: string }, VisitProfileFixture] = [{ ...bump[0], lastVisitAt: '2026-10-10T06:31:10.000Z', lastVisitPreviousAt: bump[0].lastVisitAt }, base[1]];
    expect(compare(bump, rotate)).toMatchObject({ passed: true, changes: [{ expectedTransition: 'rotate-visit' }] });
    for (const [field, value] of [['name', 'Other'], ['age', 2], ['photoUrl', 'not-a-generated-hero'], ['avatar', { source: 'photo' }], ['extra', true]]) {
      const result = compare(first, [{ ...first[0], [String(field)]: value }, base[1]]);
      expect(result.passed).toBe(false); expect(result.fieldsUnchanged).toBe(false);
      expect(result.changes[0].fields).toEqual([field]);
      expect(JSON.stringify(result)).not.toContain('not-a-generated-hero');
    }
    expect(compare(base, [base[0], { ...base[1], lastVisitAt: first[0].lastVisitAt }]).passed).toBe(false);
    expect(compare(base, [base[0], { ...base[1], lastVisitAt: first[0].lastVisitAt }], { visitedChildIds: ['a', 'b'] }).passed).toBe(true);
    expect(compare(first, [{ ...first[0], lastVisitAt: '2026-10-10T06:00:11.000Z' }, base[1]]).passed).toBe(false);
    expect(compare(bump, [{ ...rotate[0], lastVisitPreviousAt: '2026-10-09T00:00:00.000Z' }, base[1]]).passed).toBe(false);
    expect(compare(base, [{ ...base[0], lastVisitAt: '2026-10-10T07:00:01.000Z' }, base[1]]).passed).toBe(false);
    expect(compare(first, base).passed).toBe(false);
    expect(compare(base, [base[1], base[0]]).passed).toBe(false);
    expect(compare(base, [...base, { id: 'unexpected' }]).passed).toBe(false);
    expect(compare(base, [{ age: 4, name: 'Noa', id: 'a', avatar: base[0].avatar }, base[1]]).passed).toBe(true);
  });
  it('retains both reviewed kid-entry and practice harness seams without cross-applying their fixtures', () => {
    const collector = read('./capture/release-interactions.mjs');
    expect(collector).toContain("const practiceCapture = group === 'navigation'");
    expect(collector).toContain("const kidEntry = group === 'kid-entry' ? kidEntryFixture");
    expect(collector).toContain('kidEntry?.parsed ?? confirmed?.parsed ?? record?.parsed ?? bundle');
    expect(collector).toContain('if (practiceCapture) await context.addInitScript({ content: practiceClockScript(fixture.parsed) })');
    expect(collector).toContain('if (kidEntry) await context.addInitScript(initializeSyntheticOnline, { lang, preserveKidMode: true })');
    expect(collector).toContain('await collectKidEntryStates('); expect(collector).toContain('await collectPracticeStates(');
  });
});
