import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { observeSingleGoalControls, singleGoalFailureCode, SINGLE_GOAL_STEP_CODES } from './capture/single-goal-diagnostics.mjs';
import { collectSingleGoalStates } from './capture/single-goal-states.mjs';
import { SINGLE_GOAL_STATES } from './capture/single-goal-contract.mjs';
const source = readFileSync(new URL('./capture/single-goal-states.mjs', import.meta.url), 'utf8');
afterEach(() => vi.unstubAllGlobals());

describe('bounded single-goal failure evidence, without browser or socket', () => {
  it.each([
    ['strict mode violation: private words', 'LOCATOR_NOT_UNIQUE'],
    ['private button intercepts pointer events', 'POINTER_INTERCEPTED'],
    ['element is not enabled: private words', 'CONTROL_DISABLED'],
    ['element is not stable', 'CONTROL_UNSTABLE'], ['element is not visible', 'CONTROL_NOT_VISIBLE'],
    ['element was detached', 'CONTROL_DETACHED'], ['Execution context was destroyed', 'CONTEXT_RETIRED'],
    ['TypeError: private profile', 'TYPE_ERROR'], ['GOAL_SAVE_HISTORY_MISMATCH', 'GOAL_SAVE_HISTORY_MISMATCH'],
    ['SINGLE_GOAL_PICKER_MUST_BE_CLOSED', 'STATE_PRECONDITION_FAILED'],
  ])('records only the bounded failure category for %s', (message, code) => {
    expect(singleGoalFailureCode({ name: 'TimeoutError', message })).toBe(code);
    expect(singleGoalFailureCode({ name: 'TimeoutError', message: 'private' })).toBe('WAIT_TIMED_OUT');
  });
  it('labels every awaited action and keeps diagnostic reads separate from accepted settled frames', () => {
    for (const [, code] of source.matchAll(/step\('([^']+)'/g)) expect(SINGLE_GOAL_STEP_CODES).toContain(code);
    expect(source).toContain('cell.interactionFailure =');
    expect(source).toContain('cell.controlDiagnostics = await page.evaluate(observeSingleGoalControls');
    expect(source).not.toContain('close({ assertions: []');
    expect(source).not.toMatch(/cell\.frames.*controlDiagnostics|frames.*push\(.*controlDiagnostics/);
    expect(source).toContain('SINGLE_GOAL_PICKER_MUST_BE_CLOSED');
  });
  it('still schedules all 49 unique intended states when every preceding cell failed, with no unrecorded cleanup/load to abort the rest', async () => {
    const seen: { route: string; state: string }[] = [];
    const load = vi.fn(async () => { throw new Error('A failed prerequisite must remain inside its named cell.'); });
    const screen = vi.fn(async (route: string, state: string) => { seen.push({ route, state }); return false; });
    await collectSingleGoalStates({ page: {}, fixture: { children: [0, 1, 2].map(n => ({ id: `child-${n}`, activeGoals: [] })), parsed: {}, collectionNames: [] }, viewport: { lang: 'en' }, load, screen, check: vi.fn(), byId: vi.fn(), apiState: {} });
    expect(load).not.toHaveBeenCalled(); expect(seen).toHaveLength(49); expect(new Set(seen.map(row => row.state)).size).toBe(49);
    expect([...seen].sort((a, b) => a.state.localeCompare(b.state))).toEqual([...SINGLE_GOAL_STATES].sort((a, b) => a.state.localeCompare(b.state)));
  });
  it('samples hit-testing, inertness and modal/storage shape without copying private text or values', () => {
    const node: any = { tagName: 'BUTTON', isConnected: true, getAttribute: () => 'goal-save',
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 44, height: 44, right: 44, left: 0, bottom: 44, top: 0 }),
      closest: (selector: string) => selector === '[inert]' ? {} : null, matches: () => false, contains: () => false,
      innerText: 'private-never-record', textContent: 'private-never-record' };
    vi.stubGlobal('document', { visibilityState: 'visible', readyState: 'complete', activeElement: node,
      elementFromPoint: () => null, querySelector: () => null,
      querySelectorAll: (selector: string) => selector === '#target' ? Array(20).fill(node) : [] });
    vi.stubGlobal('getComputedStyle', () => ({ opacity: '1', transform: 'none', display: 'block', visibility: 'visible', pointerEvents: 'none' }));
    vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 812); vi.stubGlobal('location', { hash: '#/development' });
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'arbor.activeChildId' ? 'synthetic-child' : JSON.stringify([{ id: 'synthetic-child', name: 'private-never-record', activeGoals: [{ label: 'private-never-record' }] }]) });
    const result = observeSingleGoalControls({ childIds: ['synthetic-child'], targetSelector: '#target' });
    expect(result).toMatchObject({ targetCount: 20, storedChild: 0, storedGoalCount: 1, focusInert: true }); expect(result.targets).toHaveLength(4);
    expect(result.targets[0]).toMatchObject({ kind: 'goal-save', inert: true, pointerEvents: 'none', centerHit: false, hitKind: 'none' });
    expect(JSON.stringify(result)).not.toMatch(/private-never-record|synthetic-child/);
  });
});
