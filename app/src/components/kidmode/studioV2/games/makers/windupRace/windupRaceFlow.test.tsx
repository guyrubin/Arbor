/** Wind-up Racer through its real handlers and its real frame loop, without a
 * browser: the opening, winding by button and by key, the launch, leaning
 * into headwinds, every chapter to its flower, the set-piece and the finish.
 * The picture itself (the canvas) and dragging the key are a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => {
  const voice = () => vi.fn((..._args: unknown[]): boolean => true);
  const racer: Record<string, ReturnType<typeof voice>> = {};
  return { cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', frame: null as null | ((time: number) => void), keys: {} as Record<string, (event: any) => void>,
    play: { tap: voice(), pick: voice(), place: voice(), back: voice(), chapter: voice(), setPiece: voice(), ambience: voice(), note: voice(), breath: voice(), stop: vi.fn(), dispose: vi.fn() },
    racer: new Proxy(racer, { get: (target, name: string) => (target[name] ??= voice()) }) };
});
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const same = (old: Slot | undefined, deps: readonly unknown[]) => !!old?.deps && old.deps.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]));
  const memo = (make: () => any, deps: readonly unknown[]) => { const index = h.cursor++, old = h.slots[index]; if (same(old, deps)) return old!.value; const value = make(); h.slots[index] = { value, deps }; return value; };
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useRef(initial: any) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useMemo: memo, useCallback(fn: unknown, deps: readonly unknown[]) { return memo(() => fn, deps); },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (same(old, deps)) return;
      const slot = h.slots[index] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
  };
});
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock('../../../../../../lib/native', () => ({ selectionHaptic: async () => {} }));
vi.mock('../../../../game/GameShell', () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock('../../../../audio/kidAudio', () => ({ kidSfx: vi.fn(), kidAudioAllowed: () => false, kidAudioContext: () => null, onKidHush: () => () => {} }));
vi.mock('./windupRaceAudio', () => ({ createRacerSound: () => h.racer }));
vi.mock('../play/playSound', async original => ({ ...(await original<typeof import('../play/playSound')>()), createPlaySound: () => h.play }));
import { WindupRound } from './WindupRace';
import { HudButton, HudCoach, HudQuest, PlayOpening, PlaySetPiece } from '../play';
import { GameFinish } from '../../../../game/GameShell';
import { WINDUP_RACE_COPY } from './windupRaceCopy';
import { CHAPTERS, MAX_CLICKS } from './windupRaceRules';

type Props = { children?: unknown; onClick?: () => void; [key: string]: any };
type Node = ReactElement<Props>;
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.world), ...nodes(node.props.children)]; }
const again = vi.fn();
/** One render. The canvas the game draws on is a stand-in with no context: the loop runs, nothing is painted. */
function render() {
  h.cursor = 0; h.effects = [];
  const tree = nodes(WindupRound({ onAgain: again }));
  const canvas = tree.find(n => n.type === 'canvas');
  if (canvas && !canvas.props.ref.current) canvas.props.ref.current = { offsetWidth: 390, offsetHeight: 700, width: 0, height: 0, parentElement: null, getContext: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 700 }), setPointerCapture() {}, releasePointerCapture() {} };
  h.effects.forEach(fn => fn());
  return tree;
}
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
let clock = 0, framed = false;
/** Run the game's own frame loop for a while. */
function frames(count: number) { for (let i = 0; i < count; i++) { clock += 1000 / 30; vi.advanceTimersByTime(1000 / 30); h.frame?.(clock); } }
const section = (tree: Node[]) => tree.find(n => n.props['data-adventure'] === 'windup-race')!;
const at = (tree: Node[], key: string) => section(tree).props[key] as string | number | undefined;
const button = (tree: Node[], key: string) => tree.find(n => n.type === HudButton && n.props.data?.[key] !== undefined);
const coach = (tree: Node[]) => tree.find(n => n.type === HudCoach)!.props as { line: string; mood: string; who: string };
const done = (tree: Node[]) => (tree.find(n => n.type === HudQuest)!.props.steps as { done: boolean }[]).filter(step => step.done).length;
const press = (node: Node | undefined) => { expect(node, 'control is on the screen').toBeTruthy(); node!.props.onClick!(); };
const finger = { pointerId: 1, currentTarget: { setPointerCapture() {}, releasePointerCapture() {} }, preventDefault() {} };

beforeEach(() => {
  h.slots = []; h.lang = 'en'; h.frame = null; h.keys = {}; clock = 0; framed = false; again.mockClear(); vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => { h.frame = fn; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { h.frame = null; });
  vi.stubGlobal('document', { visibilityState: 'visible', body: null, addEventListener() {}, removeEventListener() {}, createElement: () => { throw new Error('no page'); } });
  vi.stubGlobal('window', { devicePixelRatio: 1, addEventListener: (name: string, fn: (event: any) => void) => { h.keys[name] = fn; }, removeEventListener: (name: string) => { delete h.keys[name]; }, setTimeout, clearTimeout });
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Wind to the top with the dock's button and let go; lean into every headwind; return when Rover is at rest. */
function oneGo(lang: 'en' | 'he' = 'en') {
  let tree = render();
  for (let i = 0; i < MAX_CLICKS; i++) { press(button(tree, 'data-wr-wind')); tree = render(); }
  expect(at(tree, 'data-clicks')).toBe(MAX_CLICKS);
  expect(coach(tree).line).toBe(WINDUP_RACE_COPY[lang].full);
  press(button(tree, 'data-wr-go')); tree = render();
  expect(at(tree, 'data-phase')).toBe('crouching');
  let leaning = false, guard = 0;
  for (;;) {
    frames(3); tree = render();
    if (tree.find(n => n.type === PlaySetPiece)?.props.active) framed = true;
    const phase = at(tree, 'data-phase');
    if (phase !== 'crouching' && phase !== 'running') return tree;
    const lean = tree.find(n => n.props['data-wr-lean'] !== undefined), head = at(tree, 'data-gust') === 'head';
    if (lean && head !== leaning) { (head ? lean.props.onPointerDown : lean.props.onPointerUp)(finger); leaning = head; }
    expect(guard++, 'the run comes to rest').toBeLessThan(600);
  }
}

describe('Wind-up Racer, start to finish', () => {
  it('opens on a title, then Pep asks for the key; nothing can be let go before it is wound', () => {
    let tree = render();
    expect(at(tree, 'data-phase')).toBe('openShot');
    const opening = tree.find(n => n.type === PlayOpening)!;
    expect(opening.props).toMatchObject({ title: WINDUP_RACE_COPY.en.title, place: WINDUP_RACE_COPY.en.place });
    expect(coach(tree)).toMatchObject({ who: 'pep', line: WINDUP_RACE_COPY.en.hello });
    opening.props.onDone(); tree = render();
    expect(at(tree, 'data-phase')).toBe('winding'); expect(at(tree, 'data-chapter')).toBe(CHAPTERS[0]);
    expect(coach(tree).line).toBe(WINDUP_RACE_COPY.en.wind);
    // One primary action at a time: no Go until there is something to let go.
    expect(button(tree, 'data-wr-go')).toBeUndefined(); expect(button(tree, 'data-wr-wind')!.props).toMatchObject({ cue: true, tone: 'paper' });
    const key = tree.find(n => n.props['data-wr-key'] !== undefined)!;
    expect(key.type).toBe('button'); expect(key.props['aria-label']).toBe('The wind-up key. The spring is loose.');
    // Enter with a loose spring: Pep says so, nothing runs.
    h.keys.keydown({ key: 'Enter', target: null, preventDefault() {} }); tree = render();
    expect(at(tree, 'data-phase')).toBe('winding'); expect(coach(tree).line).toBe(WINDUP_RACE_COPY.en.noWind); expect(h.play.back).toHaveBeenCalled();
    // Space winds, the key's own button winds, each click ticks one step higher.
    h.keys.keydown({ key: ' ', code: 'Space', target: null, preventDefault() {} }); tree = render();
    tree.find(n => n.props['data-wr-key'] !== undefined)!.props.onKeyDown({ key: 'Enter', preventDefault() {} }); tree = render();
    expect(at(tree, 'data-clicks')).toBe(2); expect(h.racer.tick.mock.calls.map(call => call[0])).toEqual([1, 2]);
    expect(tree.find(n => n.props['data-wr-key'] !== undefined)!.props['aria-label']).toBe('The wind-up key. The spring is wound a little.');
    expect(button(tree, 'data-wr-go')!.props.tone).toBe('go');
    expect(tree.filter(n => n.type === HudButton && n.props.tone === 'go')).toHaveLength(1);
  });

  it('a short wind ends at a named place and the next wind starts from there; nobody is sent back', () => {
    let tree = render(); tree.find(n => n.type === PlayOpening)!.props.onDone(); tree = render();
    for (let i = 0; i < 3; i++) { press(button(tree, 'data-wr-wind')); tree = render(); }
    press(button(tree, 'data-wr-go')); tree = render();
    expect(h.racer.crouch).toHaveBeenCalledTimes(1);
    for (let guard = 0; guard < 300 && at(tree, 'data-phase') !== 'resting'; guard++) { frames(3); tree = render(); }
    expect(at(tree, 'data-phase')).toBe('resting'); expect(h.racer.sproing).toHaveBeenCalledTimes(1); expect(h.racer.whirr).toHaveBeenCalled();
    const places = Object.values(WINDUP_RACE_COPY.en.places);
    expect(places.some(place => coach(tree).line === WINDUP_RACE_COPY.en.stopped.replace('{0}', place))).toBe(true);
    expect(coach(tree).line).not.toMatch(/\d/);
    for (let guard = 0; guard < 200 && at(tree, 'data-phase') !== 'winding'; guard++) { frames(3); tree = render(); }
    expect(at(tree, 'data-phase')).toBe('winding'); expect(at(tree, 'data-chapter')).toBe(CHAPTERS[0]); expect(at(tree, 'data-clicks')).toBe(0); expect(done(tree)).toBe(0);
    // A full wind from there reaches the flower: the chapter's pip is done.
    tree = oneGo();
    expect(at(tree, 'data-phase')).toBe('flourish'); expect(done(tree)).toBe(1); expect(h.play.chapter).toHaveBeenCalledTimes(1); expect(h.racer.bell).toHaveBeenCalledTimes(1);
    expect(h.play.place.mock.calls.length).toBeGreaterThan(3);
  });

  it.each(['en', 'he'] as const)('%s: three chapters that grow, the set-piece, then the finish is handed to the Studio once', lang => {
    h.lang = lang; const w = WINDUP_RACE_COPY[lang];
    let tree = render(); tree.find(n => n.type === PlayOpening)!.props.onDone(); tree = render();
    const seen: string[] = []; let goes = 0, leaned = false;
    for (let guard = 0; guard < 4000; guard++) {
      if (tree.some(n => n.type === GameFinish)) break;
      const phase = at(tree, 'data-phase'), chapter = String(at(tree, 'data-chapter'));
      if (!seen.includes(chapter)) seen.push(chapter);
      if (phase === 'winding') {
        expect(Object.values(w).flatMap(v => (typeof v === 'string' ? [v] : Object.values(v as object) as string[]))).toContain(coach(tree).line);
        // The set-piece asks for the whole spring: Go only appears when it is wound all the way.
        if (chapter === 'sunArches') {
          press(button(tree, 'data-wr-wind')); tree = render(); expect(button(tree, 'data-wr-go')).toBeUndefined(); expect(coach(tree).line).toBe(w.allTheWay);
          h.keys.keydown({ key: 'Enter', target: null, preventDefault() {} }); tree = render(); expect(at(tree, 'data-phase')).toBe('winding');
        }
        if (chapter === 'longCourse' && button(tree, 'data-wr-line')) { press(button(tree, 'data-wr-line')); tree = render(); expect(at(tree, 'data-line')).toBe('high'); }
        tree = oneGo(lang); goes++;
        if (h.racer.rustle.mock.calls.length) leaned = true;
      } else { frames(4); tree = render(); }
      expect(goes, 'every course can be finished').toBeLessThan(14);
    }
    expect(seen).toEqual([...CHAPTERS]);
    // The set-piece run was framed as one (bars in, the HUD out of the way), with its caption.
    expect(framed).toBe(true); expect(leaned).toBe(true);
    expect(h.play.chapter).toHaveBeenCalledTimes(4); expect(h.play.setPiece).toHaveBeenCalled(); expect(h.racer.fanfare).toHaveBeenCalledTimes(1);
    expect(h.racer.knock).toHaveBeenCalled(); expect(h.play.ambience).toHaveBeenCalled();
    const finish = tree.filter(n => n.type === GameFinish);
    expect(finish).toHaveLength(1); expect(finish[0].props).toMatchObject({ title: w.finish, subtitle: w.transfer }); expect(finish[0].props.creation).toBeUndefined();
    expect(section(tree).props.dir).toBe(lang === 'he' ? 'rtl' : 'ltr');
    finish[0].props.onPlayAgain(); expect(again).toHaveBeenCalledTimes(1);
  });

  it('leaving stops the loop, the timers and both sound sets', () => {
    let tree = render(); tree.find(n => n.type === PlayOpening)!.props.onDone(); tree = render();
    press(button(tree, 'data-wr-wind')); frames(5);
    expect(h.frame).not.toBeNull(); expect(Object.keys(h.keys).sort()).toEqual(['keydown', 'keyup']);
    unmount();
    expect(h.frame).toBeNull(); expect(h.keys).toEqual({}); expect(h.racer.dispose).toHaveBeenCalled(); expect(h.play.dispose).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
