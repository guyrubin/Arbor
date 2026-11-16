/** The Paper Boat through its real handlers and its real frame loop, without a
 * browser: the opening shot, the three chapters, the homecoming and the closed
 * book, by the tap-and-key path (the boat's button, the wheel's own turn and
 * hold, the dock). Dragging a page or the boat, the camera, the layout and
 * everything drawn stay a rendered check. Time is a fake clock: the game's one
 * loop is driven frame by frame. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => {
  const sound = () => vi.fn((..._args: unknown[]): boolean => true);
  const names = ['swish', 'thup', 'pops', 'tick', 'lap', 'chime', 'ring', 'spray', 'creak', 'bump', 'gust', 'rumble', 'bell', 'lamp', 'poke', 'toy', 'home', 'close', 'rain', 'stopAll', 'dispose'] as const;
  return { cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en',
    play: { tap: sound(), pick: sound(), place: sound(), back: sound(), chapter: sound(), setPiece: sound(), ambience: sound(), note: sound(), breath: sound(), stop: vi.fn(), dispose: vi.fn() },
    audio: Object.fromEntries(names.map(name => [name, vi.fn()])) as Record<(typeof names)[number], ReturnType<typeof vi.fn>> };
});
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const same = (old: Slot | undefined, deps: readonly unknown[] | undefined) => !!deps && !!old?.deps && old.deps.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]));
  const effect = (run: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = h.cursor++, old = h.slots[index];
    if (same(old, deps)) return;
    const slot: Slot = h.slots[index] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { slot.cleanup?.(); slot.cleanup = run() || undefined; });
  };
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useRef(initial: any) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useId() { return 'pb'; },
    useCallback(fn: unknown) { h.cursor++; return fn; },
    useEffect: effect, useLayoutEffect: effect,
  };
});
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock('../../../../../../lib/native', () => ({ selectionHaptic: async () => {} }));
vi.mock('../../../../game/GameShell', () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock('../../../../audio/kidAudio', () => ({ kidSfx: vi.fn(), kidHush: vi.fn(), kidAudioAllowed: () => false, kidAudioContext: () => null, onKidHush: () => () => {} }));
vi.mock('./paperBoatAudio', () => ({ createBoatAudio: () => h.audio }));
vi.mock('../play/playSound', async original => ({ ...(await original<typeof import('../play/playSound')>()), createPlaySound: () => h.play }));
import PaperBoat from './PaperBoat';
import { HudButton, HudCoach, HudQuest, PlayOpening, PlaySetPiece, PlayStage } from '../play';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { PAPER_BOAT_COPY } from './paperBoatCopy';
import { PaperWheel } from './PaperBoatWheel';
import { SpreadHalf } from './PaperBoatScenes';
import { HARBOUR_LAMPS, QUAY_LANE, angleForLane, type Dir, type Lane } from './paperBoatRules';

type Props = { children?: unknown; onClick?: (event?: unknown) => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
/** Every element the game renders: the HUD (a stage's children) and the world it hands the stage. */
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.world), ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = PaperBoat(); h.effects.forEach(fn => fn()); return nodes(tree); }
/** What React does when the game closes: every effect cleans up. */
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
/** Lets the game's loop run for a while, a frame at a time, then draws it. */
function run(seconds: number) { for (let t = 0; t < seconds; t += 0.05) vi.advanceTimersByTime(50); return render(); }
const of = (tree: Node[], type: unknown) => tree.find(n => n.type === type);
const root = (tree: Node[]) => tree.find(n => n.props['data-adventure'] === 'paper-boat')!;
const dock = (tree: Node[], name: string) => tree.find(n => n.type === HudButton && n.props.data?.['data-pb-turn'] === name);
const coachLine = (tree: Node[]) => of(tree, HudCoach)!.props.line as string;
/** Runs until the book's root says so (or gives up). */
function until(attr: string, value: unknown, seconds = 40) {
  let tree = render();
  for (let t = 0; t < seconds && String(root(tree).props[attr]) !== String(value); t += 0.5) tree = run(0.5);
  expect(String(root(tree).props[attr]), `${attr} becomes ${String(value)}`).toBe(String(value));
  return tree;
}
function turnPage(spread: number) {
  const tree = render(), next = dock(tree, 'next');
  expect(next, 'the page can be turned').toBeTruthy(); expect(next!.props.tone).toBe('go');
  next!.props.onClick!();
  const after = until('data-spread', spread, 6);
  return until('data-settled', true, 6) && after && render();
}

const seen = { stones: '' };
function read(lang: 'en' | 'he') {
  h.lang = lang;
  const w = PAPER_BOAT_COPY[lang], dir: Dir = lang === 'he' ? 'rtl' : 'ltr';
  let tree = render();
  // the opening shot: the book is closed, the host speaks, nothing else is offered
  expect(of(tree, GameShell)!.props.fullBleed).toBe(true);
  expect(root(tree).props.dir).toBe(dir); expect(root(tree).props['data-pb-open']).toBe(false);
  expect(of(tree, PlayStage)!.props.id).toBe('paper-boat');
  expect(of(tree, PlayOpening)!.props.title).toBe(w.title); expect(coachLine(tree)).toBe(w.coach.open);
  expect(tree.filter(n => n.type === HudButton)).toHaveLength(0);
  expect(tree.some(n => n.props['data-pb-boat-button'] !== undefined)).toBe(false);
  // a tap ends it: the cover lifts and the first spread stands up
  of(tree, PlayOpening)!.props.onDone();
  tree = until('data-pb-open', true, 6);
  expect(of(tree, PlayOpening)).toBeUndefined(); expect(coachLine(tree)).toBe(w.coach.launch);
  expect(h.audio.creak).toHaveBeenCalledTimes(1);
  // the words are printed on the pages, one line on each, and Hebrew turns them back the right way round
  const pages = tree.filter(n => n.type === SpreadHalf);
  expect(pages.map(n => n.props.side).sort()).toEqual(['left', 'right']);
  for (const page of pages) {
    const printed = nodes(SpreadHalf(page.props as Parameters<typeof SpreadHalf>[0])).find(n => n.props.className === 'pb-words')!;
    expect(printed.props.children).toBe(w.spreads[0][page.props.side === 'left' ? 0 : 1]);
    expect(printed.props.lang).toBe(lang); expect(printed.props.style.transform).toBe(lang === 'he' ? 'scaleX(-1)' : undefined);
  }
  expect(of(tree, GameShell)!.props.hearIt).toBe(`${w.spreads[0][0]} ${w.spreads[0][1]}`);

  seen.stones = String(root(tree).props['data-pb-stream']);
  // chapter one: the boat's own button launches it (the key path); the wheel wakes; the stones only nudge
  const wheelAsleep = of(tree, PaperWheel)!; expect(wheelAsleep.props.enabled).toBe(false);
  expect(dock(tree, 'next')).toBeUndefined();
  tree.find(n => n.props['data-pb-boat-button'] !== undefined)!.props.onClick!({ detail: 0 });
  tree = until('data-pb-launched', true, 4);
  expect(of(tree, PaperWheel)!.props.enabled).toBe(true); expect(coachLine(tree)).toBe(w.coach.afloat);
  tree = until('data-pb-rocks', true, 40);
  expect(h.audio.bump).toHaveBeenCalled(); expect(coachLine(tree)).toBe(w.coach.streamDone);
  expect(of(tree, HudQuest)!.props.steps.map((s: { done: boolean }) => s.done)).toEqual([true, false, false, false]);
  expect(of(tree, PaperWheel)).toBeUndefined();

  // chapter two: bring the boat under each lantern; a lantern waits, and rings higher each time
  tree = turnPage(1) as Node[];
  expect(coachLine(tree)).toBe(w.coach.lanterns); expect(of(tree, HudCoach)!.props.who).toBe('pep');
  const lanes = String(root(tree).props['data-pb-course']).split(',').map(Number) as Lane[];
  expect(lanes).toHaveLength(3);
  tree = run(12); expect(root(tree).props['data-pb-lanterns']).toBe(0); expect(coachLine(tree)).toBe(w.coach.held);
  lanes.forEach((lane, i) => { of(render(), PaperWheel)!.props.onTurn(angleForLane(lane, dir)); tree = until('data-pb-lanterns', i + 1, 20); });
  expect(h.audio.ring.mock.calls.map(call => call[0])).toEqual([0, 1, 2]);
  tree = until('data-pb-turnable', true, 20);
  expect(of(tree, HudQuest)!.props.steps[1].done).toBe(true);

  // chapter three: the rain does not pass by itself; a held, steady wheel ends it
  tree = turnPage(2) as Node[];
  expect(of(tree, HudCoach)!.props.who).toBe('chock'); expect(of(tree, PaperWheel)!.props.marks).toBe('steadyBand');
  tree = run(9); expect(root(tree).props['data-pb-calm']).toBe(false); expect(h.audio.gust).toHaveBeenCalled();
  const wheel = of(tree, PaperWheel)!; wheel.props.onHold(true); wheel.props.onTurn(0);
  tree = until('data-pb-calm', true, 8); of(tree, PaperWheel)?.props.onHold(false);
  expect(coachLine(tree)).toBe(w.coach.calm);

  // the homecoming: the quay waits for the boat, then the set-piece runs by itself and only then offers the end
  tree = turnPage(3) as Node[];
  expect(of(tree, HudCoach)!.props.who).toBe('gobgob'); expect(of(tree, PlaySetPiece)!.props.active).toBe(false);
  tree = run(9); expect(root(tree).props['data-pb-docked']).toBe(false);
  of(tree, PaperWheel)!.props.onTurn(angleForLane(QUAY_LANE, dir));
  tree = until('data-pb-docked', true, 12);
  expect(of(tree, PlaySetPiece)!.props.active).toBe(true); expect(h.play.setPiece).toHaveBeenCalledTimes(1);
  expect(dock(tree, 'end')).toBeUndefined(); expect(dock(tree, 'back')).toBeUndefined(); expect(of(tree, PaperWheel)).toBeUndefined();
  tree = until('data-pb-home', true, 14);
  expect(h.audio.lamp).toHaveBeenCalledTimes(HARBOUR_LAMPS); expect(h.audio.home).toHaveBeenCalledTimes(1);
  expect(of(tree, PlaySetPiece)!.props.active).toBe(false); expect(coachLine(tree)).toBe(w.coach.end);
  expect(of(tree, HudQuest)!.props.steps.every((s: { done: boolean }) => s.done)).toBe(true);
  expect(h.play.chapter).toHaveBeenCalledTimes(4);
  // nothing on the glass is a number: the journey is places, never a score
  for (const step of of(tree, HudQuest)!.props.steps) expect(step.label).not.toMatch(/\d/);

  // the end: the book closes itself, and only then does the Studio take over
  expect(of(tree, GameFinish)).toBeUndefined();
  dock(tree, 'end')!.props.onClick!();
  tree = run(2.4);
  const finish = of(tree, GameFinish)!;
  expect(finish.props.title).toBe(w.finish); expect(finish.props.creation).toBeUndefined();
  expect(tree.some(n => n.props['data-adventure'] !== undefined)).toBe(false);
  return finish;
}

describe('The Paper Boat, read from cover to cover', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    vi.stubGlobal('requestAnimationFrame', (frame: (time: number) => void) => setTimeout(() => frame(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    h.slots = []; h.cursor = 0;
    for (const fn of [...Object.values(h.audio), ...Object.values(h.play)]) fn.mockClear();
    vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  });
  afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('in English: opening, three chapters, the homecoming, the closed book', () => {
    read('en');
    // a clean exit: every sound is let go
    unmount();
    expect(h.audio.dispose).toHaveBeenCalledTimes(1); expect(h.play.dispose).toHaveBeenCalledTimes(1);
  });
  it('in Hebrew: the same story, the book mirrored and the wheel steering the mirrored way', () => {
    read('he');
  });
  it('play again is another reading: the book is closed again and the river is new', () => {
    const finish = read('en');
    const first = h.audio.ring.mock.calls.length, stones = seen.stones;
    finish.props.onPlayAgain();
    let tree = render();
    expect(root(tree).props['data-pb-open']).toBe(false); expect(of(tree, PlayOpening)).toBeTruthy();
    expect(root(tree).props['data-pb-launched']).toBe(false); expect(root(tree).props['data-pb-lanterns']).toBe(0);
    of(tree, PlayOpening)!.props.onDone();
    tree = until('data-pb-open', true, 6);
    expect(of(tree, HudQuest)!.props.steps.some((s: { done: boolean }) => s.done)).toBe(false);
    expect(h.audio.ring.mock.calls.length).toBe(first);
    expect(String(root(tree).props['data-pb-stream'])).not.toBe(stones);
  });
});
