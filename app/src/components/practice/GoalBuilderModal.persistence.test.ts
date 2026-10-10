import { describe, expect, it } from "vitest";
import { readFileSync } from 'node:fs';
import ts from "typescript";
import { harness } from "../../context/ProfileContext.testSupport";
import * as goalsModule from "../../practice/goalBuilder";
import type { ActiveGoal } from "../../practice/goalBuilder";


const goal = (id: string, date = '2026-09-01T00:00:00Z'): ActiveGoal => {
  const tile = goalsModule.goalTileById(id)!;
  return { goalId: id, label: tile.label, domainId: tile.domainId, addedAt: date };
};
const child = (activeGoals: ActiveGoal[]) => ({ id: 'A-child', name: 'A child', age: 4, languages: ['English'], schoolContext: '', strengths: [], challenges: [], onboardingComplete: true, activeGoals });
const deferred = () => {
  let resolve!: () => void, reject!: (e: Error) => void;
  const promise = new Promise<void>((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
};
type Node = { type: any; props: Record<string, any> };
function picker(provider: ReturnType<typeof harness>) {
  let cursor = 0, dirty = true, closed = false, closeCount = 0;
  const slots: any[] = [], effects: (() => void)[] = [];
  const changed = (a?: any[], b?: any[]) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));
  const react = {
    createElement(type: any, props: any, ...children: any[]) { return { type, props: { ...props, children } }; },
    useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, (next: any) => { const value = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial: any) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn: () => any) { return fn(); },
    useEffect(fn: () => any, deps: any[]) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const imports: Record<string, any> = {
    react: { __esModule: true, default: react, ...react },
    'motion/react': { motion: new Proxy({}, { get: (_, tag) => String(tag) }), AnimatePresence: 'AnimatePresence' },
    'react-dom': { createPortal: (node: any) => node },
    '../ui/Icon': { Icon: 'Icon' },
    '../../hooks/useDialog': { useDialog: ({ onClose }: any) => ({ ref: { current: null }, requestClose: onClose, onBackdropClick: onClose }) },
    '../../practice/goalBuilder': goalsModule,
    '../../playbank/select': { domainForBehaviorType: () => null },
    '../../context/LanguageContext': { useLanguage: () => ({ t: (key: string) => key, uiLang: 'en' }) },
    '../../context/ProfileContext': { useProfile: () => provider.value },
    './GoalFocusLine': { goalGlyph: () => 'edit_note' },
  };
  const code = ts.transpileModule(readFileSync(new URL('./GoalBuilderModal.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const mod = { exports: {} as { default: (props: any) => Node } };
  new Function('require', 'module', 'exports', 'document', code)((id: string) => { if (!(id in imports)) throw Error('Unmocked boundary: ' + id); return imports[id]; }, mod, mod.exports, { body: {} });
  function render(): Node {
    for (let n = 0; n < 20; n++) {
      cursor = 0; dirty = false;
      const profile = provider.value.activeChild;
      const tree = mod.exports.default({ open: !closed, childId: profile.id, childName: profile.name, onClose: () => { closed = true; closeCount++; } });
      effects.splice(0).forEach(f => f());
      if (!dirty) return tree;
    }
    throw Error('Unsettled picker');
  }
  function nodes(node: any): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== 'object' || !node.props) return []; return [node, ...nodes(node.props.children)]; }
  const find = (id: string) => nodes(render()).find(n => n.props['data-testid'] === id);
  return {
    get closed() { return closed; }, get closeCount() { return closeCount; }, render, nodes: () => nodes(render()), find,
    click(id: string) { const n = find(id); expect(n, id).toBeDefined(); n!.props.onClick(); },
    close() { const n = nodes(render()).find(n => n.props['aria-label'] === 'aria.close'); expect(n).toBeDefined(); n!.props.onClick(); },
    dispose() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

/** Actual GoalBuilderModal + actual ProfileProvider and goal helpers. Firestore,
 * auth, hooks, storage, DOM, and dialog registration are synthetic. No network,
 * real profiles, browser, or live provider calls. This proves callbacks
 * and stored-array payloads, not rendered interaction or cross-device behavior. */
describe('B-GROWTH-40 actual picker and profile persistence boundary', () => {
  it('serial acknowledged choices preserve stored labels, domains, metadata and history', async () => {
    const seed = { ...goal('transitions'), label: 'Stored family wording', proofMetadata: 'keep' };
    const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    let persisted: ActiveGoal[] = [seed]; p.transport.update = async (_, data: any) => { persisted = data.activeGoals; };
    const first = picker(p); first.click('goal-choice-big-feelings'); first.click('goal-save'); await p.flush();
    expect(first.closed).toBe(true); first.dispose();
    const second = picker(p); second.click('goal-choice-taking-turns'); second.click('goal-save'); await p.flush();
    expect(persisted.map(g => g.goalId)).toEqual(['transitions', 'big-feelings', 'taking-turns']);
    expect(p.value.activeChild.activeGoals).toEqual(persisted); expect(persisted[0]).toEqual(seed);
  });
  it('close/reopen blocks a stale second write, then confirms the fresh acknowledged replacement', async () => {
    const seed = goal('transitions'); const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    const writes: { data: any; gate: ReturnType<typeof deferred> }[] = [];
    let persisted: ActiveGoal[] = [seed];
    p.transport.update = async (_, data: any) => { const gate = deferred(); writes.push({ data, gate }); await gate.promise; persisted = data.activeGoals; };
    const first = picker(p); first.click('goal-choice-big-feelings'); first.click('goal-save');
    expect(writes).toHaveLength(1); expect(writes[0].data.activeGoals.map((g: ActiveGoal) => g.goalId)).toEqual(['transitions', 'big-feelings']);
    expect(p.value.activeChild.activeGoals).toEqual([seed]);
    first.close(); expect(first.closed).toBe(true); first.dispose();
    const second = picker(p);
    expect(second.find('goal-save')?.props.disabled).toBe(true);
    second.click('goal-save');
    expect(writes).toHaveLength(1);
    writes[0].gate.resolve(); await p.flush();
    expect(persisted.map(g => g.goalId)).toEqual(['transitions', 'big-feelings']); expect(second.closed).toBe(false);
    expect(second.find('goal-save')).toBeUndefined();
    second.click('goal-choice-taking-turns');
    expect(second.find('goal-confirm')).toBeDefined();
    expect(writes).toHaveLength(1);
    second.click('goal-save');
    expect(writes).toHaveLength(2);
    expect(writes[1].data.activeGoals.map((g: ActiveGoal) => g.goalId)).toEqual(['transitions', 'big-feelings', 'taking-turns']);
    writes[1].gate.resolve(); await p.flush(); expect(second.closed).toBe(true);
    expect(p.value.activeChild.activeGoals).toEqual(persisted);
    expect(persisted.map(g => g.goalId)).toEqual(['transitions', 'big-feelings', 'taking-turns']);
  });
  it('a dismissed write failure remains visibly retryable after reopening the same child', async () => {
    const seed = goal('transitions'); const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    const pending = deferred(); let persisted: ActiveGoal[] = [seed];
    p.transport.update = async (_, data: any) => { await pending.promise; persisted = data.activeGoals; };
    const first = picker(p); first.click('goal-choice-big-feelings'); first.click('goal-save'); first.close(); first.dispose();
    pending.reject(Error('Synthetic unavailable write')); await p.flush();
    expect(persisted).toEqual([seed]);
    expect(p.value.activeChild.activeGoals).toEqual([seed]);
    const reopened = picker(p);
    expect(reopened.nodes().some(n => n.props.role === 'alert')).toBe(true);
    expect(reopened.find('goal-save')).toBeDefined();
    p.transport.update = async (_, data: any) => { persisted = data.activeGoals; };
    reopened.click('goal-save'); await p.flush();
    expect(reopened.closed).toBe(true);
    expect(persisted.map(g => g.goalId)).toEqual(['transitions', 'big-feelings']);
    expect(p.value.activeChild.activeGoals).toEqual(persisted);
  });
});

describe('goal write admission and owner/child lifetime', () => {
  it('rejects the old basis even before React renders a successful acknowledgement', async () => {
    const seed = goal('transitions'); const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    const chosen = goal('big-feelings'), next = goal('taking-turns');
    const basis = JSON.stringify([seed]);
    expect(await p.value.saveChildGoal('A-child', chosen, basis)).toBe('saved');
    expect(await p.value.saveChildGoal('A-child', next, basis)).toBe('changed');
    expect(p.calls.updates).toHaveLength(1);
    const fresh = p.value.getGoalSelection('A-child')!.goals;
    expect(fresh.map(g => g.goalId)).toEqual(['transitions', 'big-feelings']);
    expect(await p.value.saveChildGoal('A-child', next, JSON.stringify(fresh))).toBe('saved');
    await p.flush();
    expect(p.value.activeChild.activeGoals?.map(g => g.goalId)).toEqual(['transitions', 'big-feelings', 'taking-turns']);
  });
  it('a second already-open picker must reconfirm the acknowledged replacement', async () => {
    const seed = goal('transitions'); const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    const pending = deferred(); p.transport.update = async () => pending.promise;
    const first = picker(p), second = picker(p);
    first.click('goal-choice-big-feelings'); second.click('goal-choice-taking-turns');
    const staleSubmit = second.find('goal-save')!.props.onClick;
    first.click('goal-save'); staleSubmit();
    expect(p.calls.updates).toHaveLength(1);
    pending.resolve(); await p.flush(); expect(second.closed).toBe(false);
    second.click('goal-save'); await p.flush();
    expect(p.calls.updates).toHaveLength(1);
    expect(second.find('goal-confirm')).toBeDefined();
    second.click('goal-save'); await p.flush();
    expect(p.calls.updates).toHaveLength(2); expect(second.closed).toBe(true);
    expect(p.value.activeChild.activeGoals?.map(g => g.goalId)).toEqual(['transitions', 'big-feelings', 'taking-turns']);
  });
  it.each(['saved', 'failed'] as const)('child A→B→A retains a %s attempt without reusing old dialog callbacks', async outcome => {
    const seed = goal('transitions'); const other = { ...child([goal('early-talking')]), id: 'B-child' };
    const p = harness({ rows: [child([seed]), other] }); p.effects(); await p.flush();
    const pending = deferred(); p.transport.update = async () => pending.promise;
    const first = picker(p); first.click('goal-choice-big-feelings'); first.click('goal-save'); first.dispose();
    p.value.setActiveChild('B-child'); await p.flush();
    const second = picker(p); expect(second.find('goal-save')).toBeUndefined(); second.dispose();
    p.value.setActiveChild('A-child'); await p.flush();
    const returning = picker(p); expect(returning.find('goal-save')!.props.disabled).toBe(true);
    if (outcome === 'failed') pending.reject(Error('synthetic failure')); else pending.resolve();
    await p.flush(); expect(returning.closed).toBe(false); expect(first.closed).toBe(false);
    expect(p.value.profiles.find(row => row.id === 'B-child')?.activeGoals).toEqual(other.activeGoals);
    if (outcome === 'failed') {
      expect(returning.nodes().some(n => n.props.role === 'alert')).toBe(true);
      expect(p.value.activeChild.activeGoals).toEqual([seed]);
      returning.click('goal-cancel');
      expect(returning.find('goal-save')).toBeUndefined();
      returning.dispose(); expect(picker(p).find('goal-save')).toBeUndefined();
    } else {
      expect(returning.find('goal-save')).toBeUndefined();
      expect(p.value.activeChild.activeGoals?.map(g => g.goalId)).toEqual(['transitions', 'big-feelings']);
    }
  });
  it.each(['saved', 'failed'] as const)('owner A→B→A retires an obsolete %s attempt and cannot erase the new session', async outcome => {
    const seed = goal('transitions'); const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    const pending = deferred(); p.transport.update = async () => pending.promise;
    const first = picker(p); first.click('goal-choice-big-feelings'); const staleSubmit = first.find('goal-save')!.props.onClick; staleSubmit();
    first.dispose(); const oldSession = p.value.goalSession;
    p.setOwner('B'); await p.flush(); p.setOwner('A'); await p.flush();
    expect(p.value.goalSession).not.toBe(oldSession);
    const returning = picker(p); expect(returning.find('goal-save')).toBeUndefined();
    staleSubmit(); expect(p.calls.updates).toHaveLength(1);
    const freshPending = deferred(); p.transport.update = async () => freshPending.promise;
    returning.click('goal-choice-taking-turns'); returning.click('goal-save');
    expect(p.calls.updates).toHaveLength(2);
    expect(p.value.getGoalSelection('A-child')!.attempt).toMatchObject({ status: 'pending', goal: { goalId: 'taking-turns' } });
    if (outcome === 'failed') pending.reject(Error('obsolete failure')); else pending.resolve();
    await p.flush(); expect(returning.closed).toBe(false); expect(first.closed).toBe(false);
    expect(returning.find('goal-save')!.props.disabled).toBe(true);
    expect(p.value.getGoalSelection('A-child')!.attempt).toMatchObject({ status: 'pending', goal: { goalId: 'taking-turns' } });
    expect(p.value.activeChild.activeGoals).toEqual([seed]);
    freshPending.resolve(); await p.flush();
    expect(returning.closed).toBe(true); expect(p.calls.updates).toHaveLength(2);
    expect(p.value.activeChild.activeGoals?.map(g => g.goalId)).toEqual(['transitions', 'taking-turns']);
  });
  it('an auth A→B→the identical A object bounce before render cannot revive old work', async () => {
    const seed = goal('transitions'); const p = harness({ rows: [child([seed])] }); p.effects(); await p.flush();
    const oldOwner = p.actualUser; const pending = deferred(); p.transport.update = async () => pending.promise;
    const save = p.value.saveChildGoal, basis = JSON.stringify([seed]);
    const issued = save('A-child', goal('big-feelings'), basis);
    p.setActualUser({ uid: 'B' }); p.setActualUser(oldOwner);
    pending.reject(Error('obsolete failure'));
    expect(await issued).toBe('obsolete');
    expect(await save('A-child', goal('taking-turns'), basis)).toBe('obsolete');
    await p.flush(); expect(p.value.getGoalSelection('A-child')).toBeUndefined();
    p.value.retryProfiles(); await p.flush();
    expect(p.value.getGoalSelection('A-child')!.attempt).toBeUndefined();
    expect(p.value.activeChild.activeGoals).toEqual([seed]);
  });
  it('Earlier retries preserve the selected record and every unknown field', async () => {
    const old = { ...goal('transitions'), label: 'Our family wording', domainId: 'family-connection' as ActiveGoal['domainId'], custom: { keep: ['all'] } };
    const recent = goal('big-feelings', '2026-10-01T00:00:00Z');
    const p = harness({ rows: [child([old, recent])] }); p.effects(); await p.flush();
    p.transport.update = async () => { throw Error('offline'); };
    const first = picker(p); first.click('goal-earlier-transitions'); first.click('goal-save'); first.close(); first.dispose(); await p.flush();
    expect(p.value.activeChild.activeGoals).toEqual([old, recent]);
    let persisted: ActiveGoal[] = [];
    p.transport.update = async (_, data: any) => { persisted = data.activeGoals; };
    const returning = picker(p); expect(returning.nodes().some(n => n.props.role === 'alert')).toBe(true);
    returning.click('goal-save'); await p.flush();
    expect(persisted).toHaveLength(2); expect(persisted[0]).toEqual(recent);
    expect(persisted[1]).toEqual({ ...old, addedAt: persisted[1].addedAt });
    expect(goalsModule.focusGoal(persisted)?.goalId).toBe('transitions');
  });
});
