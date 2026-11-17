/** Hero Band through its real event handlers, without a browser. Layout, focus
 * and real audio timing remain a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', muted: false, hush: [] as (() => void)[], kept: [] as unknown[],
  run: null as any, running: false, elapsed: 0, sounding: true,
  engine: { hit: vi.fn(() => true), start: vi.fn(), stop: vi.fn(), played: vi.fn(), dispose: vi.fn(), elapsed: (): number => 0, running: (): boolean => false, audible: () => true }, say: vi.fn(), sound: vi.fn() }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useCallback(callback: any, deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (old?.deps?.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]))) return old.value;
      h.slots[index] = { value: callback, deps }; return callback;
    },
    useRef(initial: any) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (old?.deps?.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]))) return;
      const slot = h.slots[index] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
  };
});
vi.mock('../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock('../../../../../context/ArborContext', () => ({ useArborOptional: () => ({ childProfile: { id: 'child-a', age: 5 } }) }));
vi.mock('../../../../../lib/native', () => ({ selectionHaptic: async () => {} }));
vi.mock('../../../game/GameShell', () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock('../../../audio/kidAudio', () => ({ kidSfx: h.sound, kidSay: h.say, useKidReadAloudMuted: () => h.muted, onKidHush: (fn: () => void) => { h.hush.push(fn); return () => {}; } }));
vi.mock('../../../../../lib/voice', () => ({ stopVoice: vi.fn(), isActive: () => false, voiceState: () => ({ speaking: false }), subscribeVoice: () => () => {} }));
vi.mock('../../studioCreations', () => ({ useStudioCreations: () => ({ items: h.kept, loaded: true, isCurrent: () => true }) }));
vi.mock('./heroBandAudio', () => ({ createBandEngine: () => h.engine }));
import HeroBand from './HeroBand';
import { GameFinish } from '../../../game/GameShell';
import { HERO_BAND_COPY } from './heroBandCopy';
import { validDance, type MoveId } from './heroBandRules';
import { HERO_BAND_FLAG_KEY, heroBandFlagOn, resetHeroBandFlagForTests } from '../../heroBandFlag';
import { studioCopy } from '../../studioCopy';
import { STUDIO_NEXT_FLAG_KEY, resetStudioNextFlagForTests } from '../../studioNextFlag';

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
function nodes(node: unknown): ReactElement<Props>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = HeroBand(); h.effects.forEach(fn => fn()); return tree; }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
function button(tree: unknown, text: string) { const found = nodes(tree).find(n => n.type === 'button' && words(n.props.children) === text); expect(found, text).toBeDefined(); return found!; }
function pad(tree: unknown, move: number) { const found = nodes(tree).find(n => n.props.className === 'band-pad' && n.props['data-move'] === move); expect(found, `pad ${move}`).toBeDefined(); return found!; }
function steps(tree: unknown) { return nodes(tree).filter(n => n.props.className === 'band-step'); }
function heading(tree: unknown) { return words(nodes(tree).find(n => 'focusKey' in n.props)); }
const en = HERO_BAND_COPY.en;

beforeEach(() => {
  h.slots = []; h.lang = 'en'; h.muted = false; h.hush = []; h.kept = []; h.run = null; h.running = false; h.elapsed = 0; h.sounding = true;
  h.engine.hit.mockClear(); h.engine.played.mockClear(); h.engine.dispose.mockClear(); h.sound.mockClear();
  h.engine.start = vi.fn((run: any) => { h.run = run; h.running = true; return h.sounding; });
  h.engine.stop = vi.fn(() => { h.running = false; });
  h.engine.running = () => h.running; h.engine.elapsed = () => h.elapsed;
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
/** Watch the shown dance to its end, then return the moves to copy. */
function watch(): MoveId[] {
  button(render(), en.showMe).props.onClick!();
  const run = h.run; expect(run.steps).toBeGreaterThanOrEqual(2);
  const target = (run.loop() as (MoveId | null)[]).slice(0, run.steps) as MoveId[];
  for (let step = 0; step < run.steps; step++) run.onStep(step, step, false);
  h.running = false; run.onEnd();
  return target;
}

describe('Hero Band', () => {
  it('shows a dance, lets the child dance it back, and forgives a wrong move by showing the moves', () => {
    let tree = render();
    expect(heading(tree)).toBe(en.ready); expect(pad(tree, 0).props.disabled).toBe(true); expect(nodes(tree).filter(n => n.props.className === 'band-pad')).toHaveLength(4);
    const target = watch(); tree = render();
    expect(heading(tree)).toBe(en.yourTurn); expect(pad(tree, 0).props.disabled).toBe(false);
    expect(steps(tree).every(step => step.props['data-move'] === 'none')).toBe(true);
    const wrong = ([0, 1, 2, 3] as const).find(move => move !== target[0])!;
    pad(tree, wrong).props.onClick!(); tree = render();
    expect(words(nodes(tree).find(n => n.props.role === 'status'))).toBe(en.retry);
    expect(steps(tree).map(step => step.props['data-move'])).toEqual(target);
    for (const move of target) { pad(render(), move).props.onClick!(); }
    tree = render(); expect(heading(tree)).toBe(en.matched); expect(h.sound).toHaveBeenCalledWith('correct'); expect(h.engine.hit).toHaveBeenCalledTimes(1 + target.length);
    button(tree, en.next).props.onClick!(); expect(heading(render())).toBe(en.ready);
  });
  it('builds a dance by hand with the beat paused, then on the beat, and keeps it after the show', () => {
    button(render(), en.own).props.onClick!(); let tree = render();
    expect(heading(tree)).toBe(en.jamPaused); expect(button(tree, en.showTime).props.disabled).toBe(true);
    pad(tree, 2).props.onClick!(); pad(render(), 0).props.onClick!(); tree = render();
    expect(steps(tree).map(step => step.props['data-move'])).toEqual([2, 0, 'none', 'none', 'none', 'none', 'none', 'none']);
    steps(tree)[1].props.onClick!(); expect(steps(render())[1].props['data-move']).toBe('none');
    button(render(), en.startBeat).props.onClick!(); expect(h.run.steps).toBeUndefined(); expect(h.run.tempo).toBe(640);
    // A tap just before the fifth light belongs to the fifth step, and is not sounded twice.
    h.elapsed = 640 * 4 - 120; pad(render(), 3).props.onClick!();
    expect(h.engine.played).toHaveBeenCalledWith(4); expect(steps(render())[4].props['data-move']).toBe(3);
    h.run.onStep(4, 4, true); expect(steps(render())[4].props['data-now']).toBe(true);
    button(render(), en.showTime).props.onClick!(); expect(h.run.steps).toBe(16); expect(nodes(render()).some(n => n.props.className === 'band-pad')).toBe(false);
    h.running = false; h.run.onEnd(); tree = render();
    const finish = nodes(tree).find(n => n.type === GameFinish)!; expect(finish).toBeDefined();
    expect(finish.props.creation).toEqual({ kind: 'dance', moves: [2, null, null, null, 3, null, null, null], tempo: 640 });
    expect(validDance(finish.props.creation.moves, finish.props.creation.tempo)).toBe(true);
  });
  it('stays playable with sound off or unavailable, and stops on hush', () => {
    h.sounding = false; h.engine.hit.mockReturnValue(false);
    button(render(), en.own).props.onClick!(); button(render(), en.startBeat).props.onClick!();
    let tree = render(); expect(nodes(tree).some(n => words(n) === en.unavailable)).toBe(true);
    h.hush.forEach(fn => fn()); tree = render(); expect(h.engine.stop).toHaveBeenCalled(); button(tree, en.startBeat);
    h.muted = true; tree = render(); expect(nodes(tree).some(n => n.props.className === 'adventure-quiet' && words(n) === en.quiet)).toBe(true);
    h.engine.hit.mockReturnValue(true);
  });
  it('reopens a kept dance and gives older children six moves', () => {
    h.kept = [{ creation: { kind: 'dance', moves: [5, null, 1, null, null, null, null, 4], tempo: 400 } }];
    button(render(), en.open).props.onClick!(); const tree = render();
    expect(steps(tree).map(step => step.props['data-move'])).toEqual([5, 'none', 1, 'none', 'none', 'none', 'none', 4]);
    expect(nodes(tree).find(n => n.props.className === 'adventure-challenge band-tempo')).toBeDefined();
  });
  it('carries every word in Hebrew, gender-free of Latin leftovers', () => {
    const he = HERO_BAND_COPY.he;
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort()); expect(he.moves).toHaveLength(en.moves.length);
    for (const value of Object.values(he).flat()) expect(value).not.toMatch(/[A-Za-z]/);
    h.lang = 'he'; expect(heading(render())).toBe(he.ready);
  });
  it('leaves the Sound Orbit tile alone until a device opts in', () => {
    // A device that opted out of the next games (on by default since 16 Nov): Hero Band's own switch still works there.
    const store = new Map<string, string>([[STUDIO_NEXT_FLAG_KEY, '0']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.stubGlobal('location', { search: '' });
    resetStudioNextFlagForTests(); resetHeroBandFlagForTests(); expect(heroBandFlagOn()).toBe(false); expect(studioCopy('en').activities['rhythm-garden'].title).toBe('Sound Orbit');
    vi.stubGlobal('location', { search: '?heroBand=1' }); resetHeroBandFlagForTests();
    expect(heroBandFlagOn()).toBe(true); expect(store.get(HERO_BAND_FLAG_KEY)).toBe('1');
    expect(studioCopy('en').activities['rhythm-garden'].title).toBe('Hero Band'); expect(studioCopy('he').activities['rhythm-garden'].title).toBe(HERO_BAND_COPY.he.title);
    expect(studioCopy('en').activities.memory.title).toBe('Mind Vault');
    vi.stubGlobal('location', { search: '?heroBand=0' }); resetHeroBandFlagForTests(); expect(heroBandFlagOn()).toBe(false);
    vi.unstubAllGlobals(); resetStudioNextFlagForTests(); resetHeroBandFlagForTests();
  });
});
