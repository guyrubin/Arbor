/** Five-Friend Sun through its real event handlers, without a browser. Layout,
 * focus, the petal mask and real audio timing remain a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', muted: false, hush: [] as (() => void)[],
  tones: { play: vi.fn((_step: number): boolean => true), stop: vi.fn(), dispose: vi.fn() }, say: vi.fn(), sound: vi.fn() }));
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
vi.mock('./bopTones', () => ({ createBopTones: () => h.tones }));
import FiveFriendSun from './FiveFriendSun';
import { GameFinish, GameShell } from '../../../game/GameShell';
import { AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { FIVE_FRIEND_SUN_COPY, countAlong, countOnLine, sunLine, turnLine, type FiveFriendSunWords } from './fiveFriendSunCopy';
import { CHOCK_SEAT, FRIEND_TOTAL, HERO_SEAT, HOP_MS, JOIN_MS, PADS, PATH_END, SUN_MS, TURN_MS, WOBBLE_MS } from './fiveFriendSunRules';

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = FiveFriendSun(); h.effects.forEach(fn => fn()); return tree; }
/** What React does when the game closes: every effect cleans up. */
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
function mount() { unmount(); h.slots = []; return render(); }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
function one(tree: unknown, what: string, test: (node: Node) => boolean): Node { const found = nodes(tree).find(test); expect(found, what).toBeDefined(); return found!; }
function button(tree: unknown, text: string) { return one(tree, text, n => n.type === 'button' && words(n.props.children) === text); }
function heading(tree: unknown) { return words(nodes(tree).find(n => 'focusKey' in n.props)); }
const classed = (name: string) => (node: Node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(name);
const stage = (tree: unknown) => one(tree, 'the game', n => n.props['data-adventure'] === 'sun');
const phase = (tree: unknown): string => stage(tree).props['data-phase'];
const spinner = (tree: unknown) => one(tree, 'the spinner', classed('sun-spinner'));
const face = (tree: unknown): number => Number(spinner(tree).props['data-face']);
const pad = (tree: unknown, at: number) => one(tree, `pad ${at}`, n => n.props['data-pad'] === at);
const farPad = (tree: unknown) => nodes(tree).find(classed('sun-far__pad'));
const seat = (tree: unknown, at: number) => one(tree, `seat ${at}`, n => n.props['data-seat'] === at);
const position = (tree: unknown): number => one(tree, 'the path', classed('sun-path')).props['data-position'];
const lit = (tree: unknown): number => one(tree, 'the sun flower', classed('sun-flower')).props['data-lit'];
const status = (tree: unknown) => words(one(tree, 'the status line', n => n.props.role === 'status'));
const finish = (tree: unknown) => nodes(tree).find(n => n.type === GameFinish);
const hinted = (tree: unknown) => PADS.filter(at => pad(tree, at).props['data-hint'] === true);
/** The hero is between pads: the hop is counted by tones and by the written count. */
const hopping = (tree: unknown) => phase(tree) === 'hop' && !nodes(tree).some(n => n.props['data-fresh'] === true);

/** Taps the spinner, hears its click, and waits for the wheel to stop. */
function spinOn(tree: unknown) { spinner(tree).props.onClick!(); expect(h.sound).toHaveBeenLastCalledWith('tap'); h.sound.mock.calls.pop(); vi.advanceTimersByTime(TURN_MS); }
/** Fixes the spinner: each spin takes the next roll, and the last one repeats. */
function rolls(...values: number[]) { let turn = 0; vi.spyOn(Math, 'random').mockImplementation(() => values[Math.min(turn++, values.length - 1)]); }
/** A replayable run of spins. */
function seededRolls(seed: number) { let state = seed >>> 0; vi.spyOn(Math, 'random').mockImplementation(() => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }); }
/** One step of play through the real handlers: the tap this moment asks for, or
 * a little time while the game shows a hop or a friend. With `fumble`, every
 * turn first taps a pad that is not the landing pad. */
function act(tree: unknown, w: FiveFriendSunWords, fumble: boolean): void {
  const now = phase(tree);
  if (now === 'ready') button(tree, w.start).props.onClick!();
  else if (now === 'spin') spinOn(tree);
  else if (now === 'count') {
    const from = position(tree), target = from + face(tree);
    if (fumble && status(tree) !== countOnLine(w, from, face(tree))) pad(tree, target === PATH_END ? 1 : PATH_END).props.onClick!();
    else pad(tree, target).props.onClick!();
  } else if (now === 'make-room') farPad(tree)!.props.onClick!();
  else vi.advanceTimersByTime(HOP_MS);
}
function playOut(w: FiveFriendSunWords, seen?: (tree: unknown) => void, fumble = false) {
  let tree = render(); seen?.(tree);
  for (let turn = 0; turn < 500 && !finish(tree); turn++) { act(tree, w, fumble); tree = render(); seen?.(tree); }
  return tree;
}
function playUntil(w: FiveFriendSunWords, wanted: string) {
  let tree = render();
  for (let turn = 0; turn < 500 && phase(tree) !== wanted; turn++) { act(tree, w, false); tree = render(); }
  expect(phase(tree)).toBe(wanted); return tree;
}
/** Every line the game can put on screen in one language. */
function lines(lang: 'en' | 'he'): Set<string> {
  const w = FIVE_FRIEND_SUN_COPY[lang], shared = ADVENTURE_COPY[lang], all = new Set<string>(['', shared.again, shared.home]);
  for (const value of Object.values(w).flat()) if (!value.includes('{')) all.add(value);
  for (let at = 0; at <= PATH_END; at++) {
    if (at) { all.add(String(at)); all.add(sunLine(w.pad, at)); all.add(sunLine(w.padHero, at)); }
    if (at <= FRIEND_TOTAL) all.add(sunLine(w.friendsHere, at));
    for (let spin = 0; spin <= 3; spin++) {
      all.add(turnLine(w, at, spin));
      if (!spin) continue;
      all.add(sunLine(w.spinnerShows, spin)); all.add(countOnLine(w, at, spin));
      for (let hops = 1; hops <= spin; hops++) all.add(countAlong(w, at, hops, spin));
    }
  }
  return all;
}
const WORD_PROPS = ['aria-label', 'title', 'instruction', 'hearIt', 'subtitle', 'playAgainLabel', 'homeLabel', 'alt'] as const;
/** Controls, direction marks and the non-breaking hyphen, by code point, so this file holds none of them. */
const UNSEEN: readonly (readonly [number, number])[] = [[0x00, 0x1f], [0x7f, 0x7f], [0x2011, 0x2011], [0x200b, 0x200f], [0x202a, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]];
function unseen(text: string): boolean { return [...text].some(char => { const code = char.codePointAt(0) ?? 0; return UNSEEN.some(([from, to]) => code >= from && code <= to); }); }
function texts(child: unknown): string[] { return typeof child === 'string' || typeof child === 'number' ? [String(child)] : Array.isArray(child) ? child.flatMap(texts) : []; }
/** Every string a render hands to the screen or to a screen reader. */
function shown(tree: unknown): string[] {
  return nodes(tree).flatMap(node => [...texts(node.props.children), ...WORD_PROPS.map(key => node.props[key]).filter((value): value is string => typeof value === 'string')]);
}

beforeEach(() => {
  vi.useFakeTimers();
  h.slots = []; h.lang = 'en'; h.muted = false; h.hush = [];
  h.tones.play.mockClear(); h.tones.play.mockReturnValue(true); h.tones.stop.mockClear(); h.tones.dispose.mockClear(); h.say.mockClear(); h.sound.mockClear();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  unmount();
  if (vi.isMockFunction(Math.random)) vi.mocked(Math.random).mockRestore();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe.each(['en', 'he'] as const)('Five-Friend Sun (%s)', lang => {
  const w: FiveFriendSunWords = FIVE_FRIEND_SUN_COPY[lang], shared = ADVENTURE_COPY[lang];
  beforeEach(() => { h.lang = lang; });

  it('plays from the start mat to the lit sun through the real handlers', () => {
    seededRolls(lang === 'he' ? 23 : 5);
    let tree = render();
    expect(one(tree, 'the shell', n => n.type === GameShell).props).toMatchObject({ fullBleed: true, autoNarrate: false, worldId: 'pattern', title: w.title, instruction: w.instruction, hearIt: w.ready });
    expect(stage(tree).props.dir).toBe(lang === 'he' ? 'rtl' : 'ltr'); expect(stage(tree).props.className).toBe('adventure adventure--bop adventure--sun');
    expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.ready); expect(position(tree)).toBe(0); expect(lit(tree)).toBe(0); expect(status(tree)).toBe('');
    expect(one(tree, 'the scene', n => n.props.scene === 'scene-sun')).toBeDefined();
    expect(one(tree, 'the unlit sun', n => n.props.name === 'sun-unlit')).toBeDefined(); expect(one(tree, 'the lit sun', n => n.props.name === 'sun-lit').props.className).toBe('sun-flower__lit');
    // Ten real buttons, numbered in text, laid out and back in two rows of five.
    expect(PADS.map(at => words(pad(tree, at).props.children))).toEqual(PADS.map(String));
    expect(PADS.map(at => pad(tree, at).props['aria-label'])).toEqual(PADS.map(at => sunLine(w.pad, at)));
    expect(PADS.every(at => pad(tree, at).type === 'button' && pad(tree, at).props.type === 'button' && pad(tree, at).props.disabled === true)).toBe(true);
    expect(PADS.map(at => [pad(tree, at).props.style.gridColumn, pad(tree, at).props.style.gridRow])).toEqual([[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [6, 1], [5, 1], [4, 1], [3, 1], [2, 1]]);
    expect(one(tree, 'the hero on the path', classed('sun-walker')).props.style).toMatchObject({ gridColumn: 1, gridRow: 2 });
    expect([0, 1, 2, 3, 4].map(at => seat(tree, at).props['data-here'])).toEqual([false, false, false, false, false]);
    expect(one(tree, 'the steps', n => n.type === AdventureSteps).props).toMatchObject({ done: 0, total: FRIEND_TOTAL });

    const lights: number[] = [], places: number[] = [], phases = new Set<string>();
    tree = playOut(w, seen => {
      if (finish(seen)) return;
      lights.push(lit(seen)); places.push(position(seen)); phases.add(phase(seen));
      expect(one(seen, 'the sun flower', classed('sun-flower')).props.style['--sun-lit']).toBe(lit(seen));
      expect(words(one(seen, 'the written count', classed('sun-count')))).toBe(sunLine(w.friendsHere, lit(seen)));
      expect(one(seen, 'the steps', n => n.type === AdventureSteps).props.done).toBe(lit(seen));
      expect([0, 1, 2, 3, 4].map(at => seat(seen, at).props['data-here'])).toEqual([0, 1, 2, 3, 4].map(at => at < lit(seen)));
    });
    const end = finish(tree)!; expect(end).toBeDefined();
    expect(end.props).toMatchObject({ title: w.finishTitle, subtitle: w.transfer, playAgainLabel: shared.again, homeLabel: shared.home });
    expect('creation' in end.props).toBe(false); expect(typeof end.props.onPlayAgain).toBe('function');
    expect(nodes(tree).some(n => n.props['data-adventure'] === 'sun')).toBe(false);
    // The petals light one at a time and never go out; the hero only moves forward.
    expect([...new Set(lights)]).toEqual([0, 1, 2, 3, 4, 5]); expect(lights).toEqual([...lights].sort((a, b) => a - b));
    expect(places.at(-1)).toBe(PATH_END); expect(places).toEqual([...places].sort((a, b) => a - b));
    expect([...phases].sort()).toEqual(['count', 'hop', 'make-room', 'ready', 'spin', 'sun']);
    expect(h.sound.mock.calls.filter(call => call[0] === 'correct')).toHaveLength(FRIEND_TOTAL); expect(h.sound).not.toHaveBeenCalledWith('tryAgain');
    expect(h.tones.play).toHaveBeenCalledTimes(PATH_END);
  });

  it('finishes whatever the spinner shows, in both adventures', () => {
    for (const level of ['gentle', 'explore'] as const) for (let seed = 1; seed <= 6; seed++) {
      seededRolls(seed * 7919); h.sound.mockClear();
      one(mount(), 'the challenge picker', n => n.type === ChallengePicker).props.onChange(level);
      const faces = new Set<number>();
      const tree = playOut(w, seen => { if (!finish(seen) && phase(seen) === 'count') { faces.add(face(seen)); expect(position(seen) + face(seen)).toBeLessThanOrEqual(PATH_END); } });
      expect(finish(tree), `${level} ${seed}`).toBeDefined();
      expect(Math.max(...faces)).toBeLessThanOrEqual(level === 'gentle' ? 2 : 3); expect(Math.min(...faces)).toBeGreaterThanOrEqual(1);
      expect(h.sound.mock.calls.filter(call => call[0] === 'correct')).toHaveLength(FRIEND_TOTAL);
    }
  });

  it('counts a hop along pad by pad, then seats the friend', () => {
    rolls(0.999999);
    button(render(), w.start).props.onClick!();
    let tree = render();
    expect(phase(tree)).toBe('spin'); expect(heading(tree)).toBe(w.spinFirst); expect(nodes(tree).some(n => n.type === ChallengePicker)).toBe(false);
    expect(spinner(tree).props).toMatchObject({ type: 'button', disabled: false, 'aria-label': w.spinner, 'data-face': 0, 'data-ready': true });
    expect(PADS.every(at => pad(tree, at).props.disabled === true)).toBe(true);
    spinner(tree).props.onClick!(); tree = render();
    // The wheel clicks and turns; the hop is not named and no pad works until it stops.
    expect(phase(tree)).toBe('turning'); expect(heading(tree)).toBe(w.spinFirst); expect(h.sound.mock.calls).toEqual([['tap']]);
    expect(PADS.every(at => pad(tree, at).props.disabled === true)).toBe(true); h.sound.mockClear();
    vi.advanceTimersByTime(TURN_MS - 1); expect(phase(render())).toBe('turning'); vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('count'); expect(heading(tree)).toBe(w.hopFirst[1]);
    // The spinner shows its hop three ways: pips, a numeral and its name.
    expect(spinner(tree).props).toMatchObject({ disabled: true, 'aria-label': sunLine(w.spinnerShows, 2), 'data-face': 2, 'data-ready': false });
    expect(nodes(spinner(tree)).filter(n => n.type === 'i')).toHaveLength(2); expect(words(spinner(tree).props.children)).toBe('2');
    expect(PADS.every(at => pad(tree, at).props.disabled === false)).toBe(true); expect(hinted(tree)).toEqual([]);
    pad(tree, 2).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('hop'); expect(status(tree)).toBe(countAlong(w, 0, 1, 2)); expect(position(tree)).toBe(0);
    expect(pad(tree, 1).props['data-here']).toBe(true); expect(pad(tree, 1).props['aria-label']).toBe(sunLine(w.padHero, 1));
    expect(one(tree, 'the heading', n => 'focusKey' in n.props).props.muted).toBe(true);
    // Input is locked while the hero hops.
    expect(PADS.every(at => pad(tree, at).props.disabled === true)).toBe(true); expect(spinner(tree).props.disabled).toBe(true);
    pad(tree, 3).props.onClick!(); spinner(tree).props.onClick!();; farPad(tree)!.props.onClick!();
    vi.advanceTimersByTime(HOP_MS); tree = render();
    expect(phase(tree)).toBe('hop'); expect(status(tree)).toBe(countAlong(w, 0, 2, 2)); expect(pad(tree, 2).props['data-here']).toBe(true); expect(lit(tree)).toBe(0);
    expect(one(tree, 'the hero on the path', classed('sun-walker')).props.style).toMatchObject({ gridColumn: 3, gridRow: 2, '--hop-x': -1, '--hop-y': 0 });
    expect(h.tones.play.mock.calls).toEqual([[0], [1]]); expect(h.sound).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HOP_MS); tree = render();
    expect(position(tree)).toBe(2); expect(lit(tree)).toBe(1); expect(heading(tree)).toBe(w.arrived[0]); expect(h.sound.mock.calls).toEqual([['correct']]);
    expect(seat(tree, 0).props).toMatchObject({ 'data-here': true, 'data-fresh': true }); expect(spinner(tree).props.disabled).toBe(true);
    expect(one(tree, 'the heading', n => 'focusKey' in n.props).props.muted).toBe(false);
    vi.advanceTimersByTime(JOIN_MS - 1); expect(phase(render())).toBe('hop');
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('spin'); expect(heading(tree)).toBe(sunLine(w.spinOn, 2)); expect(spinner(tree).props).toMatchObject({ disabled: false, 'data-face': 0 });
    expect(seat(tree, 0).props['data-fresh']).toBe(false); expect(lit(tree)).toBe(1);
  });

  it('a tap on another pad changes nothing, shows how to count on, and never blocks the landing pad', () => {
    rolls(0.999999);
    button(render(), w.start).props.onClick!(); spinOn(render());
    let tree = render(); expect(hinted(tree)).toEqual([]);
    pad(tree, 5).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('count'); expect(position(tree)).toBe(0); expect(lit(tree)).toBe(0); expect(face(tree)).toBe(2); expect(finish(tree)).toBeUndefined();
    expect(status(tree)).toBe(countOnLine(w, 0, 2)); expect(heading(tree)).toBe(w.hopFirst[1]); expect(h.sound.mock.calls).toEqual([['tryAgain']]);
    expect(one(tree, 'the shell', n => n.type === GameShell).props.hearIt).toBe(countOnLine(w, 0, 2));
    expect(pad(tree, 5).props['data-wobble']).toBe(true); expect(PADS.every(at => pad(tree, at).props.disabled === false)).toBe(true);
    // Little adventure: one other tap, and the landing pad is pointed out.
    expect(hinted(tree)).toEqual([2]);
    vi.advanceTimersByTime(WOBBLE_MS); tree = render(); expect(pad(tree, 5).props['data-wobble']).toBe(false); expect(phase(tree)).toBe('count');
    pad(tree, 1).props.onClick!(); tree = render();
    expect(position(tree)).toBe(0); expect(status(tree)).toBe(countOnLine(w, 0, 2)); expect(hinted(tree)).toEqual([2]);
    expect(h.sound.mock.calls).toEqual([['tryAgain'], ['tryAgain']]); expect(h.tones.play).not.toHaveBeenCalled();
    // No waiting and no limit: the landing pad works after any number of other taps.
    vi.advanceTimersByTime(60_000); tree = render(); expect(phase(tree)).toBe('count');
    pad(tree, 2).props.onClick!(); vi.advanceTimersByTime(2 * HOP_MS + JOIN_MS); tree = render();
    expect(position(tree)).toBe(2); expect(lit(tree)).toBe(1); expect(phase(tree)).toBe('spin');
    // From a pad on the path: the hero's own pad and the pads behind it do nothing either.
    spinOn(tree); tree = render();
    expect(heading(tree)).toBe(sunLine(w.hopMore, 2, 2)); expect(status(tree)).toBe(''); expect(hinted(tree)).toEqual([]);
    expect(pad(tree, 2).props['aria-label']).toBe(sunLine(w.padHero, 2)); expect(pad(tree, 3).props['aria-label']).toBe(sunLine(w.pad, 3));
    for (const behind of [2, 1]) {
      pad(tree, behind).props.onClick!(); tree = render();
      expect(position(tree)).toBe(2); expect(lit(tree)).toBe(1); expect(phase(tree)).toBe('count'); expect(status(tree)).toBe(countOnLine(w, 2, 2));
    }
    expect(hinted(tree)).toEqual([4]);
    pad(tree, 4).props.onClick!(); vi.advanceTimersByTime(2 * HOP_MS); tree = render();
    expect(position(tree)).toBe(4); expect(lit(tree)).toBe(2); expect(heading(tree)).toBe(w.arrived[1]); expect(status(tree)).toBe(countAlong(w, 2, 2, 2));
  });

  it('finishes a whole game with another pad tapped on every turn', () => {
    seededRolls(41);
    const tree = playOut(w, undefined, true);
    expect(finish(tree)).toBeDefined();
    const sounds = h.sound.mock.calls.map(call => call[0]);
    expect(sounds.filter(name => name === 'correct')).toHaveLength(FRIEND_TOTAL);
    expect(sounds.filter(name => name === 'tryAgain').length).toBeGreaterThanOrEqual(4);
    expect(sounds.every(name => name === 'correct' || name === 'tryAgain')).toBe(true);
  });

  it('plays the bigger adventure: longer hops, a later hint, and two friends from one hop', () => {
    const picker = one(render(), 'the challenge picker', n => n.type === ChallengePicker);
    expect(picker.props.value).toBe('gentle'); expect(picker.props.words).toBe(shared);
    picker.props.onChange('explore');
    let tree = render();
    expect(one(tree, 'the challenge picker', n => n.type === ChallengePicker).props.value).toBe('explore'); expect(phase(tree)).toBe('ready');
    rolls(0.999999, 0.999999, 0, 0.999999);
    button(tree, w.start).props.onClick!(); spinOn(render()); tree = render();
    expect(heading(tree)).toBe(w.hopFirst[2]); expect(face(tree)).toBe(3); expect(nodes(spinner(tree)).filter(n => n.type === 'i')).toHaveLength(3);
    // Two other taps before the landing pad is pointed out.
    pad(tree, 1).props.onClick!(); tree = render(); expect(status(tree)).toBe(countOnLine(w, 0, 3)); expect(hinted(tree)).toEqual([]);
    pad(tree, 5).props.onClick!(); tree = render(); expect(hinted(tree)).toEqual([3]); expect(position(tree)).toBe(0);
    pad(tree, 3).props.onClick!(); tree = render(); expect(status(tree)).toBe(countAlong(w, 0, 1, 3));
    vi.advanceTimersByTime(HOP_MS); expect(status(render())).toBe(countAlong(w, 0, 2, 3));
    vi.advanceTimersByTime(HOP_MS); expect(status(render())).toBe(countAlong(w, 0, 3, 3)); expect(h.tones.play.mock.calls).toEqual([[0], [1], [2]]);
    vi.advanceTimersByTime(HOP_MS); tree = render();
    expect(position(tree)).toBe(3); expect(lit(tree)).toBe(1); expect(heading(tree)).toBe(w.arrived[0]);
    vi.advanceTimersByTime(JOIN_MS); tree = render(); expect(phase(tree)).toBe('spin');
    // 3 to 6 passes two friends: they come one at a time, in order.
    spinOn(tree); tree = render(); expect(heading(tree)).toBe(sunLine(w.hopMore, 3, 3));
    pad(tree, 6).props.onClick!(); vi.advanceTimersByTime(3 * HOP_MS); tree = render();
    expect(position(tree)).toBe(6); expect(lit(tree)).toBe(2); expect(heading(tree)).toBe(w.arrived[1]);
    vi.advanceTimersByTime(JOIN_MS); tree = render(); expect(lit(tree)).toBe(3); expect(heading(tree)).toBe(w.arrived[2]); expect(phase(tree)).toBe('hop');
    vi.advanceTimersByTime(JOIN_MS); tree = render(); expect(phase(tree)).toBe('spin'); expect(lit(tree)).toBe(3);
    // 6 to 7 brings nobody; 7 to 10 needs Chock's place first, then the child's own seat.
    spinOn(tree); tree = render(); expect(face(tree)).toBe(1); expect(heading(tree)).toBe(sunLine(w.hopMore, 6, 1));
    pad(tree, 7).props.onClick!(); vi.advanceTimersByTime(HOP_MS); tree = render();
    expect(position(tree)).toBe(7); expect(phase(tree)).toBe('spin'); expect(lit(tree)).toBe(3);
    spinOn(tree); tree = render(); expect(face(tree)).toBe(3);
    pad(tree, 10).props.onClick!(); vi.advanceTimersByTime(3 * HOP_MS); tree = render();
    expect(position(tree)).toBe(PATH_END); expect(phase(tree)).toBe('make-room'); expect(heading(tree)).toBe(w.roomCue); expect(lit(tree)).toBe(3);
    farPad(tree)!.props.onClick!(); tree = render(); expect(lit(tree)).toBe(4); expect(heading(tree)).toBe(w.arrived[3]);
    vi.advanceTimersByTime(JOIN_MS); tree = render();
    expect(phase(tree)).toBe('sun'); expect(lit(tree)).toBe(FRIEND_TOTAL); expect(heading(tree)).toBe(w.sun);
    vi.advanceTimersByTime(SUN_MS); expect(finish(render())).toBeDefined();
  });

  it('waits for Chock’s far pad to be brought into the circle, then seats the child on the last pad', () => {
    rolls(0.999999);
    let tree = render();
    // Chock and the white pad wait by the wall from the start; the pad is not a control yet.
    expect(farPad(tree)!.props).toMatchObject({ type: 'button', disabled: true, 'aria-label': w.farPad, 'data-hint': false });
    expect(one(tree, 'Chock by the wall', n => n.props.friend === 'chock').props.className).toBe('sun-far__friend');
    farPad(tree)!.props.onClick!(); tree = render(); expect(phase(tree)).toBe('ready'); expect(lit(tree)).toBe(0);
    tree = playUntil(w, 'make-room');
    expect(position(tree)).toBe(8); expect(lit(tree)).toBe(3); expect(heading(tree)).toBe(w.roomCue);
    expect(seat(tree, CHOCK_SEAT).props).toMatchObject({ 'data-here': false, 'data-gap': true });
    expect(spinner(tree).props.disabled).toBe(true); expect(PADS.every(at => pad(tree, at).props.disabled === true)).toBe(true);
    // Nothing else moves the game on, and there is no clock on this beat.
    spinner(tree).props.onClick!(); pad(tree, 9).props.onClick!(); vi.advanceTimersByTime(120_000); tree = render();
    expect(phase(tree)).toBe('make-room'); expect(lit(tree)).toBe(3); expect(position(tree)).toBe(8);
    const far = farPad(tree)!; expect(far.props).toMatchObject({ disabled: false, 'data-hint': true, 'aria-label': w.farPad });
    h.sound.mockClear(); far.props.onClick!(); tree = render();
    expect(lit(tree)).toBe(4); expect(heading(tree)).toBe(w.arrived[3]); expect(h.sound.mock.calls).toEqual([['correct']]);
    expect(farPad(tree)).toBeUndefined(); expect(nodes(tree).some(n => n.props.friend === 'chock' && n.props.className === 'sun-far__friend')).toBe(false);
    expect(seat(tree, CHOCK_SEAT).props).toMatchObject({ 'data-here': true, 'data-fresh': true, 'data-gap': false }); expect(spinner(tree).props.disabled).toBe(true);
    far.props.onClick!(); expect(lit(render())).toBe(4); expect(h.sound).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(JOIN_MS); tree = render();
    expect(phase(tree)).toBe('spin'); expect(spinner(tree).props.disabled).toBe(false); expect(heading(tree)).toBe(sunLine(w.spinOn, 8));
    spinOn(tree); tree = render(); expect(heading(tree)).toBe(sunLine(w.hopMore, 8, 2));
    pad(tree, 10).props.onClick!(); vi.advanceTimersByTime(2 * HOP_MS); tree = render();
    expect(phase(tree)).toBe('sun'); expect(position(tree)).toBe(PATH_END); expect(lit(tree)).toBe(FRIEND_TOTAL); expect(heading(tree)).toBe(w.sun);
    // The hero has stepped off the path onto the navy pad.
    expect(nodes(tree).some(classed('sun-walker'))).toBe(false); expect(seat(tree, HERO_SEAT).props['data-here']).toBe(true);
    expect(nodes(seat(tree, HERO_SEAT)).some(n => n.props.name === 'pad-navy')).toBe(true); expect(nodes(seat(tree, HERO_SEAT)).some(n => n.props.pose === 'cheer')).toBe(true);
    vi.advanceTimersByTime(SUN_MS - 1); expect(finish(render())).toBeUndefined();
    vi.advanceTimersByTime(1); expect(finish(render())).toBeDefined();
  });

  it('starts over from the start mat on play again, and drops a game that is cut short', () => {
    seededRolls(9);
    let tree = playOut(w);
    finish(tree)!.props.onPlayAgain(); tree = render();
    expect(finish(tree)).toBeUndefined(); expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.ready);
    expect(position(tree)).toBe(0); expect(lit(tree)).toBe(0); expect(status(tree)).toBe(''); expect(farPad(tree)).toBeDefined();
    expect(one(tree, 'the steps', n => n.type === AdventureSteps).props.done).toBe(0); expect(one(tree, 'the hero on the path', classed('sun-walker')).props.style).toMatchObject({ gridColumn: 1, gridRow: 2 });
    expect(one(tree, 'the challenge picker', n => n.type === ChallengePicker).props.value).toBe('gentle'); expect(h.tones.stop).toHaveBeenCalled();
    expect(finish(playOut(w))).toBeDefined();
    // A new start in the middle of a hop: nothing of the old game lands afterwards.
    finish(render())!.props.onPlayAgain(); tree = render();
    const restart = one(tree, 'the challenge picker', n => n.type === ChallengePicker).props.onChange as (level: 'gentle' | 'explore') => void;
    rolls(0.999999); button(tree, w.start).props.onClick!(); spinOn(render()); tree = render();
    pad(tree, 5).props.onClick!(); pad(render(), 2).props.onClick!(); expect(phase(render())).toBe('hop');
    restart('gentle'); h.sound.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(30_000); tree = render();
    expect(phase(tree)).toBe('ready'); expect(position(tree)).toBe(0); expect(lit(tree)).toBe(0); expect(status(tree)).toBe('');
    expect(h.sound).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
  });

  it('plays the whole game with sound off: the board and the words carry it', () => {
    h.muted = true; h.tones.play.mockReturnValue(false); seededRolls(17);
    const quiet: boolean[] = [], counted = new Set<string>();
    const tree = playOut(w, seen => {
      if (finish(seen)) return;
      quiet.push(nodes(seen).some(n => n.props.className === 'adventure-quiet' && words(n) === w.quiet));
      if (hopping(seen)) counted.add(status(seen));
      expect(one(seen, 'the heading', n => 'focusKey' in n.props).props.muted).toBe(true);
    }, true);
    expect(finish(tree)).toBeDefined(); expect(h.say).not.toHaveBeenCalled();
    expect(quiet.length).toBeGreaterThan(20); expect(quiet.every(Boolean)).toBe(true);
    expect(counted.size).toBeGreaterThan(4); expect(counted.has('')).toBe(false);
  });

  it('speaks only lines from the copy when sound is on, and never while a hop is counted', () => {
    seededRolls(17);
    let tree = render();
    expect(nodes(tree).some(n => n.props.className === 'adventure-quiet')).toBe(false); expect(h.say).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]);
    const allowed = lines(lang);
    let saidBeforeHop: number | null = null, hops = 0;
    tree = playOut(w, seen => {
      // Nothing was said during the stretch of time that followed a hopping frame.
      if (saidBeforeHop !== null) { expect(h.say.mock.calls.length).toBe(saidBeforeHop); hops++; }
      saidBeforeHop = !finish(seen) && hopping(seen) ? h.say.mock.calls.length : null;
    });
    expect(finish(tree)).toBeDefined(); expect(hops).toBeGreaterThan(4);
    const spoken = h.say.mock.calls.map(call => call[1] as string);
    expect(spoken).toEqual(expect.arrayContaining([...w.arrived, w.sun]));
    for (const call of h.say.mock.calls) { expect(call[0]).toBe('child-a'); expect(call[2]).toBe(lang); expect(allowed.has(call[1]), call[1]).toBe(true); }
    // A hush stops the voice; the game goes on.
    seededRolls(3); tree = mount(); h.hush.forEach(fn => fn());
    expect(finish(playOut(w))).toBeDefined();
  });

  it('renders only words from the copy, in this language', () => {
    seededRolls(29);
    const allowed = lines(lang), all: string[] = [];
    const tree = playOut(w, seen => {
      all.push(...shown(seen));
      for (const node of nodes(seen).filter(n => n.type === 'button')) {
        expect(node.props.type).toBe('button');
        expect(node.props['aria-label'] || words(node.props.children), 'every control has a name').toBeTruthy();
      }
    }, true);
    expect(finish(tree)).toBeDefined(); expect(all.length).toBeGreaterThan(500);
    const unique = [...new Set(all)];
    for (const text of unique) { expect(allowed.has(text), text).toBe(true); expect(text).not.toMatch(/[{}]/); }
    for (const text of unique) { expect(text, text).not.toMatch(lang === 'he' ? /[A-Za-z]/ : /[א-ת]/); expect(unseen(text), text).toBe(false); }
    // The lines a child meets on the way are all there.
    expect(unique).toEqual(expect.arrayContaining([w.ready, w.start, w.spinFirst, w.spinner, w.path, w.mat, w.farPad, w.roomCue, w.sun, w.finishTitle, w.transfer, w.title, w.instruction, shared.again, shared.home, ...w.arrived]));
    expect(unique.some(text => text === countOnLine(w, 0, 1) || text === countOnLine(w, 0, 2))).toBe(true);
  });

  it('leaves no timer running when the game closes', () => {
    rolls(0.999999);
    render(); expect(vi.getTimerCount()).toBe(1);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(1);
    // Closed in the middle of a hop, with a wobble still under way.
    button(mount(), w.start).props.onClick!(); spinOn(render());
    let tree = render(); pad(tree, 5).props.onClick!(); tree = render(); pad(tree, 2).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('hop'); expect(vi.getTimerCount()).toBeGreaterThanOrEqual(3);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(2);
    h.sound.mockClear(); h.say.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.say).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
    // Closed while a friend is arriving, and while the sun is lit.
    for (const wanted of ['make-room', 'sun']) {
      mount(); playUntil(w, wanted); expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount(); expect(vi.getTimerCount()).toBe(0);
    }
  });
});

describe('Five-Friend Sun words', () => {
  const en = FIVE_FRIEND_SUN_COPY.en, he = FIVE_FRIEND_SUN_COPY.he;
  it('carries every line in both languages, with the same blanks to fill', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const english = en[key], hebrew = he[key];
      expect(Array.isArray(hebrew), key).toBe(Array.isArray(english));
      expect([hebrew].flat(), key).toHaveLength([english].flat().length);
      expect((String(hebrew).match(/\{\d\}/g) ?? []).sort(), key).toEqual((String(english).match(/\{\d\}/g) ?? []).sort());
    }
    for (const value of [...Object.values(en).flat(), ...Object.values(he).flat()]) {
      expect(value.length).toBeGreaterThan(0);
      expect(unseen(value), value).toBe(false);
    }
    for (const value of Object.values(he).flat()) expect(value, value).not.toMatch(/[A-Za-z]/);
    for (const value of Object.values(en).flat()) expect(value, value).not.toMatch(/[א-ת]/);
  });
  it('counts from one to ten in both languages, Hebrew in the feminine counting forms', () => {
    expect(en.numbers).toEqual(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
    expect(he.numbers).toEqual(['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר']);
    expect(en.arrived).toHaveLength(CHOCK_SEAT + 1); expect(en.hopFirst).toHaveLength(3);
  });
  it('keeps the tile words and the closing words of the brief', () => {
    expect(en.title).toBe('Five-Friend Sun'); expect(en.description).toBe('Count on. Make room.');
    expect(en.instruction).toBe('Hop along the number path and bring every friend into the circle.');
    expect(en.finishTitle).toBe('Everyone is here!'); expect(en.transfer).toBe('Away from the screen: count your steps from the door to your bed.');
    expect(en.description.length).toBeLessThanOrEqual(32); expect(he.description.length).toBeLessThanOrEqual(32);
  });
  it('writes the lines of a turn', () => {
    expect(turnLine(en, 0, 0)).toBe('Tap the spinner.'); expect(turnLine(en, 3, 0)).toBe('You are on 3. Tap the spinner.');
    expect(turnLine(en, 0, 1)).toBe('Hop 1 pad.'); expect(turnLine(en, 0, 2)).toBe('Hop 2 pads.'); expect(turnLine(en, 0, 3)).toBe('Hop 3 pads.');
    expect(turnLine(en, 3, 2)).toBe('You are on 3. Hop 2 more.');
    expect(countOnLine(en, 3, 2)).toBe('Count on from 3: four, five.'); expect(countOnLine(en, 0, 3)).toBe('Count from the start: one, two, three.'); expect(countOnLine(en, 9, 1)).toBe('Count on from 9: ten.');
    expect(countAlong(en, 3, 1, 2)).toBe('four…'); expect(countAlong(en, 3, 2, 2)).toBe('four… five.'); expect(countAlong(en, 7, 3, 3)).toBe('eight… nine… ten.');
    expect(sunLine(en.friendsHere, 3)).toBe('3 of 5 friends here.'); expect(sunLine(en.pad, 7)).toBe('Pad 7'); expect(sunLine(en.spinnerShows, 2)).toBe('The spinner shows 2.');
    expect(en.roomCue).toBe('Chock’s pad is far away. Bring it into the circle.');
    expect(turnLine(he, 3, 2)).toBe('עומדים על 3. קופצים עוד 2.'); expect(countOnLine(he, 3, 2)).toBe('ממשיכים לספור מ־3: ארבע, חמש.');
    expect(countAlong(he, 3, 2, 2)).toBe('ארבע… חמש.'); expect(sunLine(he.friendsHere, 3)).toBe('3 מתוך 5 חברים כאן.');
    expect(sunLine('{0}{1}{2}', 'a')).toBe('a');
  });
});
