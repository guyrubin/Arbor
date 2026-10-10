import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { collectPracticeStates, practiceClockScript, preparePracticePlan, restorePracticePlan } from './capture/practice-states.mjs';
import { buildDemoFamily } from '../src/demo/demoFamily';
import { demoSeedFor } from '../src/initialData';
import { selectFromRecord } from '../src/lib/today/fromRecord';
import { nextNowVisit, selectNowLead } from '../src/lib/today/dayCard';
import { nextChosenAction } from '../src/components/companion/companionChoices';
import { choosePractice, recentPracticeIds, todayDose } from '../src/lib/practice/choosePractice';
import { comparisonMonthsOf } from '../src/lib/age/forChild';
import { shelfCoverage } from '../src/lib/milestones/selectByShelf';
import { toObservations } from '../src/lib/observations';
import { PRACTICES } from '../src/content/practices';

const seededAt = '2026-10-10T22:30:00.000Z';
const now = new Date('2026-10-10T06:00:00.000Z');
const read = (name: string) => readFileSync(new URL(`./capture/${name}.mjs`, import.meta.url), 'utf8');
const storage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  const api = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal('localStorage', api);
  return { values, api };
};
afterEach(() => vi.unstubAllGlobals());

describe('isolated real practice capture fixture, no browser or provider', () => {
  it.each(['en', 'he'] as const)('%s: removes only the sandbox plan opener and lets the real selectors choose a practice', lang => {
    const family = buildDemoFamily({ now: Date.parse(seededAt), lang });
    const original = JSON.stringify(family);
    const plans = demoSeedFor(lang).plans;
    const { api, values } = storage({ 'arbor.activeChildId': family.child.id, [`arbor.actionPlans.${family.child.id}`]: JSON.stringify(plans), other: 'untouched' });
    const inputs = { now, logs: family.collections.behaviorLogs, loop: family.collections.actionLoops,
      facts: [{ id: 'demo-approved', ...family.memory.approved, createdAt: seededAt, status: 'approved' }] };
    expect(selectFromRecord({ ...inputs, plans })?.kind).toBe('plan');
    const previous = preparePracticePlan({ childId: family.child.id });
    const record = selectFromRecord({ ...inputs, plans: JSON.parse(api.getItem(previous.key)!) });
    expect(record).toBeNull();
    const chosen = nextChosenAction(family.collections.actionLoops);
    const visit = nextNowVisit(family.collections.appointments, now, {});
    expect(chosen).toBeNull(); expect(visit).toBeNull();
    expect(todayDose(family.collections.actionLoops, family.child.id, now)).toBeNull();
    const pick = choosePractice({ childId: family.child.id, milestones: family.collections.milestones,
      comparisonMonths: comparisonMonthsOf(family.child, now), practices: PRACTICES, today: now,
      coverage: shelfCoverage(toObservations(family.collections, family.child), now),
      recentPracticeIds: recentPracticeIds(family.collections.actionLoops, family.child.id, now) });
    expect(pick?.practice.id).toBeTruthy();
    expect(selectNowLead({ chosen: !!chosen, visit, record: !!record, recordPending: false, tonight: false, fallback: pick ? 'practice' : 'notice' })).toBe('practice');
    restorePracticePlan(previous);
    expect(api.getItem(previous.key)).toBe(JSON.stringify(plans));
    expect(values.size).toBe(3); expect(api.getItem('other')).toBe('untouched');
    expect(JSON.stringify(family)).toBe(original);
  });

  it('restores a missing plan key and rejects a foreign child or storage target', () => {
    const { api } = storage({ 'arbor.activeChildId': 'demo-child' });
    const previous = preparePracticePlan({ childId: 'demo-child' });
    expect(previous.previous).toBeNull(); expect(api.getItem(previous.key)).toBe('[]');
    restorePracticePlan(previous); expect(api.getItem(previous.key)).toBeNull();
    expect(() => preparePracticePlan({ childId: 'other-child' })).toThrow('SYNTHETIC_PRACTICE_CHILD_REQUIRED');
    expect(() => restorePracticePlan({ key: 'arbor.children', previous: '[]' })).toThrow('SYNTHETIC_PRACTICE_KEY_REQUIRED');
  });

  it('uses the real seed day morning only on the named practice load, with native timers and animation time', () => {
    const script = practiceClockScript({ seededAt });
    for (const search of ['?capture=release-navigation-1', '?capturePractice=0', '?capturePractice=1']) {
      const win: any = { Date, performance, setTimeout, setInterval, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
        document: { timeline: {} }, Element: { prototype: { animate: () => {} } } };
      runInNewContext(script, { URLSearchParams, location: { search }, window: win });
      if (search !== '?capturePractice=1') { expect(win.Date).toBe(Date); expect(win.__arborConfirmedDateClock).toBeUndefined(); }
      else {
        expect(win.Date.now()).toBe(now.getTime());
        expect(win.__arborConfirmedDateClock.snapshot().nativeTimingPreserved).toBe(true);
        expect(new win.Date('2020-01-02').toISOString()).toBe('2020-01-02T00:00:00.000Z');
        win.__arborConfirmedDateClock.restore(); expect(win.Date).toBe(Date);
      }
    }
    expect(() => practiceClockScript({ seededAt: 'invalid' })).toThrow('SYNTHETIC_PRACTICE_DATE_REQUIRED');
  });

  it('restores the plan and Date even if collection aborts before an outcome', async () => {
    storage({ 'arbor.activeChildId': 'demo-child', 'arbor.actionPlans.demo-child': '[{"id":"original"}]' });
    vi.stubGlobal('window', {});
    const page = { evaluate: async (fn: any, arg: any) => fn(arg) };
    await expect(collectPracticeStates({ page, fixture: { childId: 'demo-child' }, byId: () => ({}),
      screen: async (_route: string, _state: string, action: any) => action({}),
      load: async () => { throw new Error('synthetic-load-failure'); }, check: () => {}, visible: () => {} })).rejects.toThrow('synthetic-load-failure');
    expect(localStorage.getItem('arbor.actionPlans.demo-child')).toBe('[{"id":"original"}]');
  });

  it('keeps every real control and original assertion, with restoration before baseline navigation resumes', () => {
    const flow = read('practice-states'), release = read('release-interactions');
    for (const id of ['PRACTICE_VISIBLE', 'PRACTICE_ACTION_FIRST', 'PRACTICE_DETAILS_CLOSED', 'PRACTICE_OUTCOMES_VISIBLE',
      'PRACTICE_DETAILS_OPEN', 'PRACTICE_ID_UNCHANGED', 'PRACTICE_RECEIPT_VISIBLE', 'PRACTICE_UNDO_VISIBLE',
      'PRACTICE_ANSWERS_REPLACED', 'PRACTICE_OUTCOMES_RESTORED', 'PRACTICE_RECEIPT_REMOVED', 'PRACTICE_SAME_CARD']) expect(flow).toContain(id);
    expect(flow).toContain("locator('[data-answer=\"did\"]').click()");
    expect(flow).toContain("byId('practice-undo').click()");
    expect(flow).toMatch(/finally \{[^]*restoreConfirmedDate[^]*restorePracticePlan/);
    expect(flow).not.toMatch(/waitForTimeout|dispatchEvent|setContent|innerHTML|forceUpdate|__react/);
    expect(release.indexOf('await collectPracticeStates(')).toBeLessThan(release.indexOf("[['now-scroll-initial'"));
    expect(release).toContain("practiceFixture ? '&capturePractice=1' : ''");
  });
});
