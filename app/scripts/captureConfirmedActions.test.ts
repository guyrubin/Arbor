import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIRMED_ACTIONS_NOW, CONFIRMED_ACTIONS_EXPIRED, CONFIRMED_ACTION_STATES, CONFIRMED_ACTION_LIMITATIONS,
  confirmedActionsFixture, confirmedActionVariant, installConfirmedStorageFault, restoreConfirmedStorageFault, validConfirmedActionFrame } from './capture/confirmed-actions-contract.mjs';
import { releaseMatrix, RELEASE_MATRIX, releaseCell, captureDeadlineMs } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { RECORD_STATES } from './capture/record-contract.mjs';
import { CDC_MILESTONES } from '../src/lib/milestoneData';
import { selectFromRecord, fromRecordEntry } from '../src/lib/today/fromRecord';
import { nextNowVisit, visitForConsult } from '../src/lib/today/dayCard';
import { keptThings } from '../src/lib/kept/keptThings';
import { CHILD_SUBCOLLECTIONS } from '../src/lib/childData';
import { FAMILY_RITUALS } from '../src/lib/familyRituals';
import { ritualOfTheMoment } from '../src/lib/familyRitualsCadence';
import { translate } from '../src/lib/i18n';
import { resolveRouteId } from '../src/lib/routes';
import { observeConfirmedFrame } from './capture/confirmed-frame.mjs';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const body = () => ({ child: { id: 'synthetic-capture-child', name: 'Capture Child', demo: true, age: 4, birthDate: '2022-01-01' }, collections: { milestones: [{ ...CDC_MILESTONES[0], checked: false }], actionLoops: [] } });
const bundle = () => ({ parent: { demo: true }, ...body(), version: 'capture', seededAt: '2026-10-10', locales: { en: body(), he: body() } });
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
afterEach(() => { if ((globalThis as any).window?.__arborConfirmedStorageFault) restoreConfirmedStorageFault(); vi.unstubAllGlobals(); });

describe('additive confirmed Parent action capture, no browser or sockets', () => {
  it('adds exactly four bounded shards and keeps the existing 662-state release contract unchanged', () => {
    expect(RELEASE_MATRIX).toHaveLength(8);
    expect(RECORD_STATES).toHaveLength(49);
    expect(releaseMatrix('record-release')).toHaveLength(12);
    const isolated = releaseMatrix('confirmed-actions-only');
    expect(isolated.map((spec: any) => spec.viewport)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    expect(new Set(CONFIRMED_ACTION_STATES.map((state: any) => `${state.route}:${state.state}`)).size).toBe(49);
    for (const spec of isolated) {
      const cell = releaseCell(spec);
      expect(cell.group).toBe('confirmed-actions'); expect(captureDeadlineMs(cell)).toBe(600_000);
      expect(expectedReleaseInteractionStates(cell.group, cell.viewport)).toHaveLength(49);
      expect(missingReleaseInteractionEvidence([], { group: cell.group, viewport: cell.viewport, ...identity })).toHaveLength(49);
    }
    expect(releaseMatrix('confirmed-actions-release')).toEqual([...isolated, ...releaseMatrix('record-release')]);
    const workflow = read('.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain('"codex/parent-confirmed-action-loops" ]]; then scope=confirmed-actions-only;');
    expect(workflow).toContain('docker create --network none');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).not.toMatch(/workflow_dispatch|--network host|secrets\.|id-token:|firebase deploy|docker push/);
  });

  it('does not accept reached flags without complete exact-source screenshot and action assertions', () => {
    const viewport = releaseCell(releaseMatrix('confirmed-actions-only')[0]).viewport;
    const cells = expectedReleaseInteractionStates('confirmed-actions', viewport).map((item: any) => ({ ...item, ...identity, lang: viewport.lang, viewport: `${viewport.w}x${viewport.h}`, reached: true, shot: `shots/${item.state}.png`, assertions: [{ id: 'REAL_ACTION', passed: true }], failures: [] }));
    const args = { group: 'confirmed-actions', viewport, ...identity };
    expect(missingReleaseInteractionEvidence(cells, args)).toEqual([]);
    for (const patch of [{ reached: false }, { shot: null }, { assertions: [] }, { assertions: [{ id: 'REAL_ACTION', passed: false }] }, { failures: ['WRONG_DESTINATION'] }, { sourceTreeSha: 'c'.repeat(40) }]) {
      expect(missingReleaseInteractionEvidence([{ ...cells[0], ...patch }, ...cells.slice(1)], args)).toHaveLength(1);
    }
    for (const state of ['consult-restored-draft', 'milestone-editor-stale-final-send', 'routine-local-failure', 'ritual-failed-child-retirement']) expect(missingReleaseInteractionEvidence(cells.filter((cell: any) => cell.state !== state), args)[0].state).toBe(state);
  });

  for (const lang of ['en', 'he']) {
    it(`${lang}: real selectors distinguish parent note, tried step, requested/elapsed appointment and exact target`, () => {
      const original = bundle(), before = JSON.stringify(original), fixture = confirmedActionsFixture(original, lang);
      expect(JSON.stringify(original)).toBe(before);
      expect(Object.keys(fixture.collections).every(key => CHILD_SUBCOLLECTIONS.includes(key as any))).toBe(true);
      for (const source of ['parent', 'step']) {
        const data = confirmedActionVariant(fixture, `record-${source}`);
        const opener = selectFromRecord({ now: new Date(CONFIRMED_ACTIONS_NOW), plans: data.actionPlans, loop: data.actionLoops, logs: data.behaviorLogs, facts: [] });
        expect(opener).toMatchObject({ kind: 'plan', key: `plan:${fixture.plan.id}`, quote: fixture.words[source], quoteSource: source });
      }
      const selected = nextNowVisit(fixture.appointments as any, new Date(CONFIRMED_ACTIONS_NOW), {});
      expect(selected?.id).toBe(fixture.visit.id);
      expect(visitForConsult(fixture.appointments as any, Date.parse(CONFIRMED_ACTIONS_NOW), fixture.visit.id)?.id).toBe(fixture.visit.id);
      expect(visitForConsult(fixture.appointments as any, Date.parse(CONFIRMED_ACTIONS_EXPIRED), fixture.visit.id)).toBeNull();
      expect(visitForConsult(fixture.appointments as any, Date.parse(CONFIRMED_ACTIONS_NOW), 'capture-missing-visit')).toBeNull();
      expect(visitForConsult([], Date.parse(CONFIRMED_ACTIONS_NOW), fixture.visit.id)).toBeNull();
      expect(confirmedActionVariant(fixture, 'chosen').actionLoops).toEqual([fixture.chosen]);
      expect(() => confirmedActionVariant(fixture, 'live')).toThrow('CONFIRMED_ACTION_VARIANT_INVALID');
    });

    it(`${lang}: retains real catalogue citations and all five negative controls across every variant`, () => {
      const fixture = confirmedActionsFixture(bundle(), lang);
      for (const variant of ['base', 'record-parent', 'record-step', 'visit', 'chosen', 'sayback', 'routines']) {
        const data = confirmedActionVariant(fixture, variant);
        expect(data.milestones[0].source).toEqual(CDC_MILESTONES[0].source);
        expect(data.keepsakes.find((row: any) => row.id === 'capture-record-ai')).toMatchObject({ source: 'ai_proposed_parent_confirmed', note: fixture.text.forbidden[1] });
        const stored = JSON.stringify(data);
        for (const text of fixture.text.forbidden) expect(stored).toContain(text);
        const kept = keptThings(data, { id: fixture.childId });
        expect(kept.find(row => row.kind === 'first')).toMatchObject({ text: fixture.text.first, keepsakeId: 'capture-record-first', attribution: 'parent' });
        for (const text of fixture.text.forbidden) expect(kept.some(row => row.text === text)).toBe(false);
      }
    });

    it(`${lang}: say-back fixture creates the parent's act without a child outcome or reflection`, () => {
      const fixture = confirmedActionsFixture(bundle(), lang), data = confirmedActionVariant(fixture, 'sayback');
      const row = data.keepsakes.find((value: any) => value.id === 'capture-confirmed-sayback');
      const opener = selectFromRecord({ now: new Date(CONFIRMED_ACTIONS_NOW), plans: [], loop: [], logs: [], facts: [], said: { quotes: [row], languages: ['Hebrew (Native)', 'English (Transition)'], months: 48 } });
      expect(opener).toMatchObject({ kind: 'said', key: 'said:capture-confirmed-sayback', sayBackMode: 'cross', sayBackIn: 'Hebrew' });
      for (const answer of ['yes', 'not_today'] as const) {
        const saved = fromRecordEntry(opener!, answer, fixture.childId, new Date(CONFIRMED_ACTIONS_NOW));
        expect(saved).toMatchObject({ id: `record.${fixture.childId}.2026-10-10`, source: 'from-record', sayBack: answer });
        expect(saved.reflection).toBeUndefined(); expect(saved.outcome).toBeUndefined();
      }
      expect(translate(lang as 'en' | 'he', 'elev.closeloop.routines.savedLocal')).toContain(lang === 'en' ? 'saved on this device' : 'נשמרה במכשיר הזה');
      expect(translate(lang as 'en' | 'he', 'elev.learnCare.ritual.started')).toBe(lang === 'en' ? 'On today’s list' : 'ברשימה של היום');
    });
  }

  it('fails closed before accepting a non-synthetic bundle or unsupported language', () => {
    const unsafe = bundle(); unsafe.parent.demo = false;
    expect(() => confirmedActionsFixture(unsafe, 'en')).toThrow();
    expect(() => confirmedActionsFixture(bundle(), 'fr')).toThrow();
    const unsafeChild = bundle(); unsafeChild.locales.en.child.demo = false;
    expect(() => confirmedActionsFixture(unsafeChild, 'en')).toThrow();
  });

  it('pins actual due and library ritual identities without importing a new runtime source', () => {
    expect(ritualOfTheMoment(Date.parse(CONFIRMED_ACTIONS_NOW), {})?.ritual.id).toBe('truth-practice-weekly');
    expect(FAMILY_RITUALS.find(ritual => ritual.id === 'family-story-canon')?.steps[0]).toBeTruthy();
    const family = read('app/scripts/capture/confirmed-family-states.mjs');
    expect(family).toContain("page.locator('[data-receipt-row]').filter({ has: receipt(id) })");
    expect(family).toContain('await receiptOpen(turnId).click()');
    expect(family).not.toContain("receipt(turnId).locator('a");
    expect(family).toContain("'RECEIPT_OPEN_ARRIVES_AT_ACTUAL_SAVED_NEXT_STEP'");
    expect(family).toContain('settled-local-failure-then-actual-child-switch');
    expect(family).not.toMatch(/\.dispatchEvent\(|\.evaluate\([^]*?onClick/);
  });

  it('encodes actual teacher PDF portal retirement and requires a new review after recovery', () => {
    const portal = read('app/scripts/capture/confirmed-consult-portal-state.mjs');
    const schoolBrief = read('app/src/components/sections/SchoolBrief.tsx');
    expect(schoolBrief).toContain('data-testid="school-brief-review-open"');
    expect(schoolBrief).toContain('data-testid="school-brief-review-approve"');
    expect(CONFIRMED_ACTION_STATES.filter(item => item.state === 'consult-teacher-review-retirement')).toHaveLength(1);
    for (const evidence of ['school-brief-review-open', 'school-brief-review-approve', 'OLD_APPROVAL_ELEMENT_CANNOT_BE_CLICKED', 'ELIGIBILITY_RECOVERY_DOES_NOT_REVIVE_OLD_REVIEW', 'RECOVERY_REQUIRES_FRESH_REVIEW_ELEMENT', 'SAME_TEACHER_DRAFT_SURVIVES_RECOVERY', 'NO_EXPORT_DOWNLOAD_OR_PRINT_POPUP']) expect(portal).toContain(evidence);
    expect(portal).toContain('previousApproval.click({ timeout: 500 })');
    expect(portal).toContain('popup.close()');
    expect(portal).not.toContain('school-brief-ai-draft');
    expect(portal).not.toMatch(/dispatchEvent|onApprove|window\.open\s*=/);
    expect(portal).toContain("page.off('download', onDownload); page.off('popup', onPopup)");
  });

  it('installs and restores only an armed exact synthetic storage key after hydration', () => {
    class FakeStorage {
      values = new Map<string, string>();
      getItem(key: string) { return this.values.get(key) ?? null; }
      setItem(key: string, value: string) { this.values.set(key, String(value)); }
    }
    const local = new FakeStorage(), other = new FakeStorage(), win = {};
    vi.stubGlobal('window', win); vi.stubGlobal('Storage', FakeStorage); vi.stubGlobal('localStorage', local);
    local.setItem('arbor.activeChildId', 'synthetic-child');
    const original = Object.getOwnPropertyDescriptor(FakeStorage.prototype, 'setItem');
    for (const kind of ['actionLoops', 'routines']) {
      const key = `arbor.${kind}.synthetic-child`; local.setItem(key, 'original');
      installConfirmedStorageFault({ childId: 'synthetic-child', kind });
      expect(() => local.setItem(key, 'optimistic')).toThrow('Synthetic capture quota failure');
      expect(local.getItem(key)).toBe('original');
      expect(() => local.setItem(`arbor.${kind}.sibling`, 'allowed')).not.toThrow();
      expect(() => other.setItem(key, 'other-storage-instance')).not.toThrow();
      expect(() => installConfirmedStorageFault({ childId: 'synthetic-child', kind })).toThrow('CONFIRMED_STORAGE_FAULT_ALREADY_ARMED');
      expect(restoreConfirmedStorageFault()).toEqual({ key, rejected: 1, unchanged: true });
      expect(Object.getOwnPropertyDescriptor(FakeStorage.prototype, 'setItem')).toEqual(original);
      local.setItem(key, 'retry'); expect(local.getItem(key)).toBe('retry');
      expect(restoreConfirmedStorageFault()).toBeNull();
    }
    expect(() => installConfirmedStorageFault({ childId: 'other', kind: 'actionLoops' })).toThrow('CONFIRMED_STORAGE_FAULT_CHILD_MISMATCH');
    expect(() => installConfirmedStorageFault({ childId: 'synthetic-child', kind: 'appointments' })).toThrow('CONFIRMED_STORAGE_FAULT_SCOPE_INVALID');
    expect(() => installConfirmedStorageFault({ childId: '../user', kind: 'actionLoops' })).toThrow('CONFIRMED_STORAGE_FAULT_SCOPE_INVALID');
    expect(Object.getOwnPropertyDescriptor(FakeStorage.prototype, 'setItem')).toEqual(original);
  });

  it('targets the actual Plans routine collection and keeps the retired alias unchanged', () => {
    expect(resolveRouteId('routines')).toBe('plans');
    expect(CONFIRMED_ACTION_STATES.filter(item => item.state.startsWith('routine-'))).toHaveLength(9);
    expect(CONFIRMED_ACTION_STATES.filter(item => item.state.startsWith('routine-')).every(item => item.route === 'plans')).toBe(true);
    for (const lang of ['en', 'he']) {
      const fixture = confirmedActionsFixture(bundle(), lang);
      const records = confirmedActionVariant(fixture, 'routines').routines;
      expect(records).toEqual(fixture.routineRows);
      expect(records.map((row: any) => row.id)).toEqual(['capture-morning', 'capture-goodbye']);
      expect(records.flatMap((row: any) => row.steps).every((step: any) => step.text && !step.done)).toBe(true);
    }
    const flow = read('app/scripts/capture/confirmed-routine-states.mjs');
    expect(flow).toContain("byId('plans-routines-row')");
    expect(flow).toContain("fault(cell, 'routines'");
    expect(flow).toContain('FAILED_LOCAL_WRITE_LEAVES_FINAL_STEP_UNCOMPLETED');
    expect(flow).toContain('routine-card-isolation');
    const live = read('app/src/components/plans/RoutinesCard.tsx');
    for (const id of ['routines-card', 'routine-row-', 'routine-step-', 'routine-reset-', 'routine-receipt-', 'routine-failed-', 'routine-retry-']) expect(live).toContain(id);
    expect(live).toContain('aria-pressed={s.done}');
    expect(flow).not.toMatch(/routines-board|routines.done|routine-tile|load\('routines'|reset\('base', 'routines'/);
  });

  it('observes actual route ownership, rendered content and settled animations without mutating them', () => {
    const style = { opacity: '1', transform: 'none', visibility: 'visible', display: 'block' };
    const target = { isConnected: true, parentElement: null, closest: () => null,
      getBoundingClientRect: () => ({ width: 100, height: 44 }), getAnimations: () => [] as any[] };
    const route = { ...target, querySelectorAll: () => [target], getAttribute: () => 'plans' };
    vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === '#main [data-route]' ? [route] : [] });
    vi.stubGlobal('getComputedStyle', () => style);
    vi.stubGlobal('location', { hash: '#/plans' });
    vi.stubGlobal('localStorage', { getItem: () => 'child-a' });
    const args = { routeName: 'plans', childId: 'child-a' };
    expect(observeConfirmedFrame(args)).toMatchObject({ ready: true });
    style.transform = 'matrix(0.9766, 0, 0, 0.9766, 0, 5)';
    expect(observeConfirmedFrame({ ...args, waitUntilReady: true })).toBe(false);
    style.transform = 'none'; style.opacity = '0';
    expect(observeConfirmedFrame(args)).toMatchObject({ ready: false });
    style.opacity = '1'; target.getAnimations = () => [{ playState: 'running' }];
    expect(observeConfirmedFrame(args)).toMatchObject({ ready: false });
    target.getAnimations = () => [];
    expect(observeConfirmedFrame({ ...args, outgoing: { ...route, isConnected: true } })).toMatchObject({ ready: false });
    expect(observeConfirmedFrame({ ...args, childId: 'child-b' })).toMatchObject({ ready: false });
    route.querySelectorAll = () => [];
    expect(observeConfirmedFrame(args)).toMatchObject({ ready: false });
    const observer = read('app/scripts/capture/confirmed-frame.mjs');
    expect(observer).toContain('trace.lastObserved');
    expect(observer).toContain('timeout: 8_000');
    expect(observer).toContain('outgoingMotionParent');
    expect(observer).toContain('tabSkeletonCandidates');
    expect(observer).toContain('diagnosticsAtFailure');
    const shell = read('app/src/components/layout/Shell.tsx');
    expect(shell).toContain('<Suspense fallback={<TabSkeleton />}>');
    expect(shell).toContain('mode="wait"');
    expect(shell).toContain('key={`${activeTab}@${childProfile.id}`}');
    expect(observer).not.toMatch(/\.finish\(|\.cancel\(|dispatchEvent|forceUpdate|\.style\.[a-zA-Z]+\s*=/);
  });

  it('preserves original rapid navigation and a real interrupted child round trip', () => {
    const flow = read('app/scripts/capture/confirmed-actions-states.mjs');
    expect(flow).toContain("reset('visit', 'overview', { settleRoute: false })");
    expect(flow).toContain('fresh-Now-load-visible-visit-then-Prepare-without-added-settlement');
    const interrupted = flow.slice(flow.indexOf('await select(fixture.siblingId'), flow.indexOf('await select(fixture.childId'));
    expect(interrupted).toContain('afterSiblingSelection');
    expect(interrupted).not.toContain('waitFrame');
    expect(flow).toContain("'rapid-child-final-body'");
    const milestones = read('app/scripts/capture/confirmed-milestone-states.mjs');
    expect(milestones).toContain('fixture.siblingName, { settleBefore: false }');
    const family = read('app/scripts/capture/confirmed-family-states.mjs');
    expect(family).toContain('await rapidChildRoundTrip(cell)');
    const savedReturn = family.slice(family.indexOf("'ritual-saved-child-return'"));
    expect(savedReturn.indexOf('await checkReceipt(cell, turnId)')).toBeLessThan(savedReturn.indexOf('await rapidChildRoundTrip(cell)'));
    expect(savedReturn.indexOf('await rapidChildRoundTrip(cell)')).toBeLessThan(savedReturn.indexOf('await childSwitch(cell,'));
    expect(family).toContain('RAPID_CHILD_RETURN_RETIRES_FEEDBACK_AND_PRESERVES_ONE_LOCAL_ROW');
  });

  it('rejects tiny, occluded, off-scrollport and overflowing action frames', () => {
    const good = { visible: true, hit: true, inMain: true, enabled: true, width: 60, height: 44, pageWidth: 375, viewportWidth: 375 };
    expect(validConfirmedActionFrame(good)).toBe(true);
    for (const patch of [{ visible: false }, { hit: false }, { inMain: false }, { enabled: false }, { height: 43 }, { width: 43 }, { pageWidth: 377 }, { width: NaN }, { width: Infinity }, { height: Infinity }, { viewportWidth: Infinity }]) expect(validConfirmedActionFrame({ ...good, ...patch })).toBe(false);
  });

  it('keeps UI actions real, labels unproved remote transitions, and makes restoration unconditional', () => {
    const flows = ['confirmed-frame', 'confirmed-actions-states', 'confirmed-milestone-states', 'confirmed-routine-states', 'confirmed-family-states', 'confirmed-consult-portal-state'].map(name => read(`app/scripts/capture/${name}.mjs`)).join('\n');
    expect(flows).not.toMatch(/__react|_react|\.useState|hasPendingWrites|fromCache|setConfirmed|forceUpdate|dispatchEvent|\bel\.click\(|\bnode\.click\(/);
    for (const action of ['.click()', '.fill(', '.goBack()', '.goForward()', '.setFixedTime(']) expect(flows).toContain(action);
    expect(flows).toContain('finally { await page.evaluate(restoreConfirmedStorageFault).catch(() => null); }');
    expect(flows).toContain('!outgoing.isConnected');
    expect(flows).toContain('EXACT_DOM_EDITOR_IDENTITY_AND_TYPED_DRAFT_SURVIVE');
    expect(flows).toContain('RETAINED_EDITOR_CANNOT_BYPASS_FINAL_FRESHNESS_GUARD');
    expect(flows).toContain('ACTUAL_EDITOR_FIELDS_SEEDED_BEFORE_INTERACTION');
    expect(flows).toContain('sheets.length === 1 && actualNote === note && actualDate === date');
    expect(flows).toContain('RELOAD_RESTORES_CHECKLIST_WITHOUT_REPLAYING_RECEIPT');
    expect(CONFIRMED_ACTION_LIMITATIONS.some(item => item.state === 'remote-acknowledgement-and-metadata' && item.status === 'not-exercised')).toBe(true);
    expect(CONFIRMED_ACTION_LIMITATIONS.some(item => item.state === 'consult-draft-eligibility' && item.status === 'synthetic-clock-only')).toBe(true);
    const existing = read('app/scripts/capture/record-states.mjs');
    expect(existing).toContain("note.locator('[data-testid=\"ms-keepsake-edit\"]').click()");
    expect(existing).not.toContain("note.getByRole('button').click()");
    const integration = read('app/scripts/capture/release-interactions.mjs');
    expect(integration).toContain('if (record || confirmed) await context.addInitScript(installRecordShareSink)');
    expect(integration).toContain('doc.confirmedActionBoundaries = CONFIRMED_ACTION_LIMITATIONS');
  });
});
