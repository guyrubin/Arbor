/** Oops Button through its real event handlers, without a browser. Layout,
 * focus, the turned petals and real audio timing remain a rendered check. */
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
import OopsButton from './OopsButton';
import { GameFinish, GameShell } from '../../../game/GameShell';
import { AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { OOPS_BUTTON_COPY, oopsLine, type OopsButtonWords } from './oopsButtonCopy';
import { BLOOM_MS, HOLD_MS, OOPS_ROUNDS, OPEN_MS, PETALS, PETAL_ART, SETTLE_MS, WATCH_LEAD_MS, WOBBLE_MS, orderLength, watchMs } from './oopsButtonRules';

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
type Level = 'gentle' | 'explore';
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = OopsButton(); h.effects.forEach(fn => fn()); return tree; }
/** What React does when the game closes: every effect cleans up. */
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
function mount() { unmount(); h.slots = []; return render(); }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
function one(tree: unknown, what: string, test: (node: Node) => boolean): Node { const found = nodes(tree).find(test); expect(found, what).toBeDefined(); return found!; }
function button(tree: unknown, text: string) { return one(tree, text, n => n.type === 'button' && words(n.props.children) === text); }
function heading(tree: unknown) { return words(nodes(tree).find(n => 'focusKey' in n.props)); }
const classed = (name: string) => (node: Node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(name);
const stage = (tree: unknown) => one(tree, 'the game', n => n.props['data-adventure'] === 'oops');
const phase = (tree: unknown): string => stage(tree).props['data-phase'];
const shell = (tree: unknown) => one(tree, 'the shell', n => n.type === GameShell).props;
const petal = (tree: unknown, id: number) => one(tree, `petal ${id}`, n => n.props['data-petal'] === id);
const control = (tree: unknown, name: 'oops-pause' | 'oops-restart') => one(tree, name, n => n.props['data-control'] === name);
const picker = (tree: unknown) => one(tree, 'the challenge picker', n => n.type === ChallengePicker);
const openPetals = (tree: unknown): number[] => PETALS.filter(id => petal(tree, id).props['data-open'] === true);
const hinted = (tree: unknown): number[] => PETALS.filter(id => petal(tree, id).props['data-hint'] === true);
/** The numeral on a petal while the toy shows its order; 0 when it has none. */
const mark = (tree: unknown, id: number): number => Number(words(petal(tree, id).props.children));
const steps = (tree: unknown): number => one(tree, 'the steps', n => n.type === AdventureSteps).props.done;
const hero = (tree: unknown) => one(tree, 'the hero', n => 'pose' in n.props).props;
const chock = (tree: unknown): string => one(tree, 'Chock', n => n.props.friend === 'chock').props.mood;
const status = (tree: unknown) => words(one(tree, 'the status line', n => n.props.role === 'status'));
const finish = (tree: unknown) => nodes(tree).find(n => n.type === GameFinish);
const quietBeat = (tree: unknown) => phase(tree) === 'watch' || phase(tree) === 'bloom';
/** Everything that can be pressed right now, by name. */
function live(tree: unknown): string[] {
  return nodes(tree).filter(n => n.type === 'button' && n.props.disabled !== true && n.props['aria-disabled'] !== true)
    .map(n => n.props['data-petal'] !== undefined ? `petal-${n.props['data-petal']}` : n.props['data-control'] ?? 'start-button');
}

/** A replayable run of orders. */
function seededRolls(seed: number) { let state = seed >>> 0; vi.spyOn(Math, 'random').mockImplementation(() => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }); }
const TICK_MS = 100, LISTEN_MS = 200;
/** Reads the order off the numerals a showing has put on the petals so far. */
function learn(tree: unknown, order: number[]) { for (const id of PETALS) { const place = mark(tree, id); if (place > 0) order[place - 1] = id; } }
/** Watches a showing to its end, the way a child does, and returns the order the numerals gave. */
function watchOrder(): number[] {
  const order: number[] = [];
  let tree = render(); expect(phase(tree)).toBe('watch');
  for (let tick = 0; tick < 200 && phase(tree) === 'watch'; tick++) { learn(tree, order); vi.advanceTimersByTime(TICK_MS); tree = render(); }
  expect(phase(tree)).toBe('copy'); return order;
}
/** The petal to put back first: the one stuck half-way, or else the open one that opened last. */
function lastOpened(tree: unknown, order: readonly number[]): number {
  const open = openPetals(tree), half = open.find(id => petal(tree, id).props['data-half'] === true);
  return half ?? [...order].reverse().find(id => open.includes(id))!;
}
type Play = { fumble?: boolean; dither?: boolean; listen?: boolean };
/** A child at the table, one step at a time through the real handlers: watch
 * the numerals, press the petals in order, and fix a jam with pause, petals
 * back and restart. `fumble` presses one petal out of turn in every round;
 * `dither` first presses a petal that must wait when putting petals back;
 * `listen` waits for the voice before each move. */
function player(w: OopsButtonWords, how: Play, known: readonly number[]) {
  let order = [...known], before = '';
  const fumbled = new Set<number>();
  return (tree: unknown): void => {
    const now = phase(tree), round = steps(tree);
    if (now === 'watch' && before !== 'watch') order = [];
    before = now;
    if (how.listen && !quietBeat(tree)) vi.advanceTimersByTime(LISTEN_MS);
    if (now === 'ready') button(tree, w.start).props.onClick!();
    else if (now === 'watch') { learn(tree, order); vi.advanceTimersByTime(TICK_MS); }
    else if (now === 'copy') {
      const open = openPetals(tree), next = order[open.length];
      const wrong = PETALS.find(id => id !== next && !open.includes(id));
      if (how.fumble && !fumbled.has(round) && open.length === round % 2 && wrong !== undefined) { fumbled.add(round); petal(tree, wrong).props.onClick!(); }
      else petal(tree, next).props.onClick!();
    } else if (now === 'jam') control(tree, 'oops-pause').props.onClick!();
    else if (now === 'undo') {
      const last = lastOpened(tree, order), early = openPetals(tree).find(id => id !== last);
      if (how.dither && early !== undefined && status(tree) === oopsLine(w.undoFirst, openPetals(tree).length)) petal(tree, early).props.onClick!();
      else petal(tree, last).props.onClick!();
    } else if (now === 'reset') control(tree, 'oops-restart').props.onClick!();
    else vi.advanceTimersByTime(TICK_MS);
  };
}
function playOut(w: OopsButtonWords, seen?: (tree: unknown) => void, how: Play = {}, known: readonly number[] = []) {
  const act = player(w, how, known);
  let tree = render(); seen?.(tree);
  for (let turn = 0; turn < 4000 && !finish(tree); turn++) { act(tree); tree = render(); seen?.(tree); }
  return tree;
}
function playUntil(w: OopsButtonWords, wanted: string) {
  const act = player(w, {}, []);
  let tree = render();
  for (let turn = 0; turn < 4000 && phase(tree) !== wanted; turn++) { act(tree); tree = render(); }
  expect(phase(tree)).toBe(wanted); return tree;
}
/** Presses the given petals one after another, each on a fresh render. */
function pressAll(order: readonly number[]) { for (const id of order) petal(render(), id).props.onClick!(); return render(); }
/** Every line the game can put on screen in one language. */
/** A numbered undo line with any number in its blank. */
const undoLike = (line: string) => expect.stringMatching(new RegExp(`^${line.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{0}', '\\d')}$`));
function lines(lang: 'en' | 'he'): Set<string> {
  const w = OOPS_BUTTON_COPY[lang], shared = ADVENTURE_COPY[lang], all = new Set<string>(['', shared.again, shared.home]);
  for (const value of Object.values(w).flat()) if (!value.includes('{')) all.add(value);
  for (const name of w.petals) for (const state of [w.petalOpen, w.petalClosed, w.petalStuck]) all.add(oopsLine(state, name));
  for (let total = 1; total <= PETALS.length; total++) for (let at = 1; at <= total; at++) {
    all.add(String(at)); all.add(oopsLine(w.copyNext, at, total));
    for (const line of [w.undoFirst, w.undoNext, w.undoWait]) all.add(oopsLine(line, at));
    for (const name of w.petals) all.add(oopsLine(w.watchStep, at, total, name));
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

describe.each(['en', 'he'] as const)('Oops Button (%s)', lang => {
  const w: OopsButtonWords = OOPS_BUTTON_COPY[lang], shared = ADVENTURE_COPY[lang];
  beforeEach(() => { h.lang = lang; });

  it('plays three rounds from the closed flower to the finish through the real handlers', () => {
    seededRolls(lang === 'he' ? 23 : 5);
    let tree = render();
    expect(shell(tree)).toMatchObject({ fullBleed: true, autoNarrate: false, worldId: 'puzzle', title: w.title, instruction: w.instruction, hearIt: w.ready });
    expect(stage(tree).props.dir).toBe(lang === 'he' ? 'rtl' : 'ltr'); expect(stage(tree).props.className).toBe('adventure adventure--bop adventure--oops');
    expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.ready); expect(status(tree)).toBe(w.readyNext);
    expect(one(tree, 'the scene', n => n.props.scene === 'scene-table')).toBeDefined();
    // The toy never mirrors: five real buttons round the hub, petal 0 at the top, then clockwise.
    const toy = one(tree, 'the toy', classed('oops-toy'));
    expect(toy.props).toMatchObject({ dir: 'ltr', role: 'group', 'aria-label': w.toy, 'data-bloom': false });
    expect(nodes(toy).filter(n => n.type === 'button')).toHaveLength(PETALS.length); expect(nodes(toy).some(n => n.props.name === 'oops-hub')).toBe(true);
    expect(PETALS.map(id => petal(tree, id).props['aria-label'])).toEqual(w.petals.map(name => oopsLine(w.petalClosed, name)));
    expect(PETALS.map(id => nodes(petal(tree, id)).find(n => typeof n.props.name === 'string')!.props.name)).toEqual([...PETAL_ART]);
    for (const id of PETALS) {
      expect(petal(tree, id).type).toBe('button');
      expect(petal(tree, id).props).toMatchObject({ type: 'button', disabled: true, 'aria-pressed': false, 'data-open': false, 'data-half': false, 'data-wobble': false, 'data-hint': false });
      expect(petal(tree, id).props.style['--petal']).toBe(id); expect(mark(tree, id)).toBe(0);
    }
    expect(hero(tree)).toMatchObject({ pose: 'idle', celebrate: false }); expect(chock(tree)).toBe('idle');
    expect(one(tree, 'the steps', n => n.type === AdventureSteps).props).toMatchObject({ done: 0, total: OOPS_ROUNDS });
    expect(picker(tree).props.value).toBe('gentle'); expect(picker(tree).props.words).toBe(shared);
    // Before the start there is one thing to press.
    expect(live(tree)).toEqual(['start-button']); expect(button(tree, w.start).props).toMatchObject({ type: 'button', 'aria-label': w.start });

    const blooms: number[] = [], phases = new Set<string>();
    tree = playOut(w, seen => {
      if (finish(seen)) return;
      const now = phase(seen), open = openPetals(seen);
      blooms.push(steps(seen)); phases.add(now);
      expect(status(seen), now).not.toBe(''); expect(heading(seen), now).not.toBe('');
      expect(hero(seen).pose).toBe(now === 'jam' ? 'oops' : 'idle'); expect(hero(seen).celebrate).toBe(now === 'bloom'); expect(chock(seen)).toBe(now === 'bloom' ? 'happy' : 'idle');
      // No dead ends: either the toy is busy and a timer is running, or something is there to press.
      if (now === 'ready') expect(live(seen)).toEqual(['start-button']);
      else if (quietBeat(seen)) { expect(live(seen)).toEqual([]); expect(vi.getTimerCount()).toBeGreaterThan(0); }
      else if (now === 'jam') expect(live(seen)).toEqual(['oops-pause']);
      else if (now === 'reset') expect(live(seen)).toEqual(['oops-restart']);
      else if (now === 'copy') { expect(live(seen)).toEqual(PETALS.filter(id => !open.includes(id)).map(id => `petal-${id}`)); expect(live(seen).length).toBeGreaterThan(0); }
      else { expect(now).toBe('undo'); expect(live(seen)).toEqual(open.map(id => `petal-${id}`)); expect(open.length).toBeGreaterThan(0); }
    });
    const end = finish(tree)!; expect(end).toBeDefined();
    expect(end.props).toMatchObject({ title: w.finishTitle, subtitle: w.transfer, playAgainLabel: shared.again, homeLabel: shared.home });
    expect('creation' in end.props).toBe(false); expect(typeof end.props.onPlayAgain).toBe('function');
    expect(nodes(tree).some(n => n.props['data-adventure'] === 'oops')).toBe(false);
    // One step for each bloom, never taken back. Every phase was met, the fix-it routine included.
    expect([...new Set(blooms)]).toEqual([0, 1, 2, 3]); expect(blooms).toEqual([...blooms].sort((a, b) => a - b));
    expect([...phases].sort()).toEqual(['bloom', 'copy', 'jam', 'ready', 'reset', 'undo', 'watch']);
    // Three blooms, and the toy's own jam makes the same soft sound as any jam.
    expect(h.sound.mock.calls).toEqual([['correct'], ['tryAgain'], ['correct'], ['correct']]);
    // Little adventure: 2 + 3 + 3 petals shown, round two shown twice; 9 right presses; one petal put back.
    expect(h.tones.play).toHaveBeenCalledTimes(2 + 3 + 3 + 3 + 9 + 1);
    for (const call of h.tones.play.mock.calls) expect(PETALS).toContain(call[0]);
  });

  it('finishes whatever the order, in both adventures, with one jam that is the toy’s', () => {
    for (const level of ['gentle', 'explore'] as const) for (let seed = 1; seed <= 6; seed++) {
      seededRolls(seed * 7919); h.sound.mockClear();
      picker(mount()).props.onChange(level);
      const lengths = [0, 0, 0], jams: string[] = [];
      let before = '';
      const tree = playOut(w, seen => {
        if (finish(seen)) return;
        const now = phase(seen), round = steps(seen);
        if (now === 'watch') lengths[round] = Math.max(lengths[round], ...PETALS.map(id => mark(seen, id)));
        if (now === 'jam' && before !== 'jam') jams.push(`${round}:${status(seen)}`);
        before = now;
      });
      expect(finish(tree), `${level} ${seed}`).toBeDefined();
      expect(lengths).toEqual([0, 1, 2].map(round => orderLength(level, round)));
      expect(jams).toEqual([`1:${w.jamToy}`]);
      expect(h.sound.mock.calls).toEqual([['correct'], ['tryAgain'], ['correct'], ['correct']]);
    }
  });

  it('shows the order one petal at a time, numbered, then hands over the turn', () => {
    seededRolls(11);
    button(render(), w.start).props.onClick!();
    let tree = render();
    expect(phase(tree)).toBe('watch'); expect(heading(tree)).toBe(w.watch); expect(status(tree)).toBe(w.watchNext);
    expect(nodes(tree).some(n => n.type === ChallengePicker)).toBe(false); expect(nodes(tree).some(n => n.type === 'button' && words(n.props.children) === w.start)).toBe(false);
    // Pause and restart are real, named buttons with their names written under them; neither is live yet.
    expect(control(tree, 'oops-pause').props).toMatchObject({ type: 'button', disabled: true, 'aria-label': w.pause, 'data-ready': false }); expect(words(control(tree, 'oops-pause').props.children)).toBe(w.pause);
    expect(control(tree, 'oops-restart').props).toMatchObject({ type: 'button', disabled: true, 'aria-label': w.restart, 'data-ready': false }); expect(words(control(tree, 'oops-restart').props.children)).toBe(w.restart);
    expect(nodes(control(tree, 'oops-pause')).some(n => n.props.name === 'oops-pause')).toBe(true); expect(nodes(control(tree, 'oops-restart')).some(n => n.props.name === 'oops-restart')).toBe(true);
    // The showing is carried by petals, numerals and tones: the voice button rests.
    expect(one(tree, 'the heading', n => 'focusKey' in n.props).props.muted).toBe(true);
    expect(openPetals(tree)).toEqual([]); expect(live(tree)).toEqual([]);
    // Nothing can be pressed during the showing.
    petal(tree, 0).props.onClick!(); control(tree, 'oops-pause').props.onClick!(); control(tree, 'oops-restart').props.onClick!();
    vi.advanceTimersByTime(WATCH_LEAD_MS - 1); tree = render();
    expect(phase(tree)).toBe('watch'); expect(openPetals(tree)).toEqual([]); expect(h.tones.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); tree = render();
    const [first] = openPetals(tree); expect(openPetals(tree)).toHaveLength(1);
    expect(mark(tree, first)).toBe(1); expect(h.tones.play.mock.calls).toEqual([[first]]);
    expect(status(tree)).toBe(oopsLine(w.watchStep, 1, 2, w.petals[first]));
    expect(petal(tree, first).props).toMatchObject({ disabled: true, 'data-open': true, 'aria-pressed': true, 'aria-label': oopsLine(w.petalOpen, w.petals[first]) });
    expect(nodes(petal(tree, first)).some(classed('bop-chip'))).toBe(true);
    vi.advanceTimersByTime(OPEN_MS - 1); expect(openPetals(render())).toEqual([first]);
    vi.advanceTimersByTime(1); tree = render();
    const second = openPetals(tree).find(id => id !== first)!; expect(openPetals(tree)).toHaveLength(2);
    expect(mark(tree, first)).toBe(1); expect(mark(tree, second)).toBe(2); expect(h.tones.play.mock.calls).toEqual([[first], [second]]);
    expect(status(tree)).toBe(oopsLine(w.watchStep, 2, 2, w.petals[second]));
    // A short hold, then every petal closes and the numerals go.
    vi.advanceTimersByTime(HOLD_MS - 1); expect(openPetals(render())).toHaveLength(2);
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('watch'); expect(openPetals(tree)).toEqual([]); expect(PETALS.every(id => mark(tree, id) === 0)).toBe(true);
    expect(watchMs(2)).toBe(WATCH_LEAD_MS + OPEN_MS + HOLD_MS);
    vi.advanceTimersByTime(SETTLE_MS - 1); expect(phase(render())).toBe('watch');
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('copy'); expect(heading(tree)).toBe(w.copy); expect(status(tree)).toBe(w.copyFirst); expect(shell(tree).hearIt).toBe(w.copy);
    expect(one(tree, 'the heading', n => 'focusKey' in n.props).props.muted).toBe(false);
    expect(live(tree)).toEqual(PETALS.map(id => `petal-${id}`)); expect(vi.getTimerCount()).toBe(1);

    // The child's turn: a right petal opens with its own tone.
    h.tones.play.mockClear();
    petal(tree, first).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('copy'); expect(openPetals(tree)).toEqual([first]); expect(status(tree)).toBe(oopsLine(w.copyNext, 1, 2));
    expect(petal(tree, first).props).toMatchObject({ disabled: false, 'aria-disabled': true, 'aria-pressed': true, 'data-open': true, 'data-half': false, 'aria-label': oopsLine(w.petalOpen, w.petals[first]) });
    expect(mark(tree, first)).toBe(0); expect(h.tones.play.mock.calls).toEqual([[first]]);
    // B-GAME-45: the opened petal pops a ring; a closed one does not, and no rays before the bloom.
    expect(nodes(petal(tree, first)).some(classed('oops-pop'))).toBe(true); expect(nodes(petal(tree, second)).some(classed('oops-pop'))).toBe(false); expect(nodes(tree).some(classed('oops-rays'))).toBe(false);
    // An open petal pressed again does nothing at all.
    petal(tree, first).props.onClick!(); tree = render();
    expect(openPetals(tree)).toEqual([first]); expect(phase(tree)).toBe('copy'); expect(h.sound).not.toHaveBeenCalled(); expect(h.tones.play).toHaveBeenCalledTimes(1);
    petal(tree, second).props.onClick!(); tree = render();
    // The whole order is open: the whole flower opens, the hub glows, Chock is glad.
    expect(phase(tree)).toBe('bloom'); expect(heading(tree)).toBe(w.bloom); expect(status(tree)).toBe(w.bloomNext); expect(steps(tree)).toBe(1);
    expect(openPetals(tree)).toEqual([...PETALS]); expect(one(tree, 'the toy', classed('oops-toy')).props['data-bloom']).toBe(true);
    expect(nodes(one(tree, 'the rays', classed('oops-rays')).props.children)).toHaveLength(10); expect(PETALS.every(id => nodes(petal(tree, id)).some(classed('oops-pop')))).toBe(true);
    expect(chock(tree)).toBe('happy'); expect(hero(tree).celebrate).toBe(true); expect(h.sound.mock.calls).toEqual([['correct']]); expect(live(tree)).toEqual([]);
    petal(tree, second).props.onClick!(); control(tree, 'oops-pause').props.onClick!(); control(tree, 'oops-restart').props.onClick!();
    vi.advanceTimersByTime(BLOOM_MS - 1); expect(phase(render())).toBe('bloom');
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('watch'); expect(heading(tree)).toBe(w.watch); expect(openPetals(tree)).toEqual([]); expect(chock(tree)).toBe('idle'); expect(steps(tree)).toBe(1);
    expect(watchOrder()).toHaveLength(3); expect(h.sound).toHaveBeenCalledTimes(1);
  });

  it('a petal out of turn jams the toy and never ends or blocks the game: pause, petals back last one first, restart', () => {
    seededRolls(lang === 'he' ? 31 : 13);
    picker(render()).props.onChange('explore');
    let tree = render(); expect(picker(tree).props.value).toBe('explore');
    button(tree, w.start).props.onClick!();
    const order = watchOrder(); expect(order).toHaveLength(3);
    tree = pressAll(order.slice(0, 2));
    expect(phase(tree)).toBe('copy'); expect(openPetals(tree)).toEqual([order[0], order[1]].sort());
    const spare = PETALS.filter(id => !order.includes(id)); expect(spare).toHaveLength(2);
    h.sound.mockClear(); h.tones.play.mockClear();
    petal(tree, spare[0]).props.onClick!(); tree = render();
    // The petal sticks half-way. Nothing ends, nothing is taken away, nothing is counted.
    expect(phase(tree)).toBe('jam'); expect(finish(tree)).toBeUndefined(); expect(steps(tree)).toBe(0);
    expect(heading(tree)).toBe(w.jamCue); expect(status(tree)).toBe(w.jam); expect(shell(tree).hearIt).toBe(w.jam);
    expect(petal(tree, spare[0]).props).toMatchObject({ disabled: true, 'data-open': true, 'data-half': true, 'data-wobble': true, 'aria-label': oopsLine(w.petalStuck, w.petals[spare[0]]) });
    expect(openPetals(tree)).toHaveLength(3); expect(hero(tree).pose).toBe('oops');
    // B-GAME-46: every open petal shows when it opened, so "biggest number first" is on the toy.
    expect(nodes(tree).filter(n => n.props['data-undo-number'] !== undefined).map(n => n.props['data-undo-number']).sort()).toEqual([1, 2, 3]); expect(h.sound.mock.calls).toEqual([['tryAgain']]); expect(h.tones.play).not.toHaveBeenCalled();
    // Only pause is live, and it is ringed. There is no clock on this beat.
    expect(live(tree)).toEqual(['oops-pause']);
    expect(control(tree, 'oops-pause').props).toMatchObject({ disabled: false, 'data-ready': true }); expect(control(tree, 'oops-restart').props).toMatchObject({ disabled: true, 'data-ready': false });
    petal(tree, order[2]).props.onClick!(); petal(tree, spare[0]).props.onClick!(); control(tree, 'oops-restart').props.onClick!(); vi.advanceTimersByTime(120_000); tree = render();
    expect(phase(tree)).toBe('jam'); expect(openPetals(tree)).toHaveLength(3); expect(status(tree)).toBe(w.jam);
    control(tree, 'oops-pause').props.onClick!(); tree = render();
    expect(phase(tree)).toBe('undo'); expect(heading(tree)).toBe(w.undo); expect(status(tree)).toBe(oopsLine(w.undoFirst, openPetals(tree).length)); expect(shell(tree).hearIt).toBe(w.undo);
    expect(hero(tree).pose).toBe('idle'); expect(hinted(tree)).toEqual([]);
    expect(control(tree, 'oops-pause').props.disabled).toBe(true); expect(control(tree, 'oops-restart').props.disabled).toBe(true);
    expect(live(tree)).toEqual([order[0], order[1], spare[0]].sort().map(id => `petal-${id}`));
    expect(PETALS.every(id => petal(tree, id).props.disabled === false)).toBe(true);
    // An open petal that is not the last one must wait: a clear next step, and then the right petal is ringed.
    h.sound.mockClear();
    petal(tree, order[0]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('undo'); expect(status(tree)).toBe(oopsLine(w.undoWait, openPetals(tree).length)); expect(shell(tree).hearIt).toBe(oopsLine(w.undoWait, openPetals(tree).length)); expect(heading(tree)).toBe(w.undo);
    expect(openPetals(tree)).toHaveLength(3); expect(petal(tree, order[0]).props['data-wobble']).toBe(true); expect(hinted(tree)).toEqual([spare[0]]);
    expect(h.sound.mock.calls).toEqual([['tryAgain']]);
    vi.advanceTimersByTime(WOBBLE_MS); tree = render(); expect(petal(tree, order[0]).props['data-wobble']).toBe(false); expect(phase(tree)).toBe('undo');
    // A closed petal does nothing.
    petal(tree, spare[1]).props.onClick!(); petal(tree, order[2]).props.onClick!(); tree = render();
    expect(openPetals(tree)).toHaveLength(3); expect(status(tree)).toBe(oopsLine(w.undoWait, openPetals(tree).length)); expect(h.sound).toHaveBeenCalledTimes(1);
    // The half-open petal was the last to open, so it goes back first.
    h.tones.play.mockClear();
    petal(tree, spare[0]).props.onClick!(); tree = render();
    expect(petal(tree, spare[0]).props).toMatchObject({ 'data-open': false, 'data-half': false, 'aria-pressed': false, 'aria-disabled': true, 'aria-label': oopsLine(w.petalClosed, w.petals[spare[0]]) });
    expect(phase(tree)).toBe('undo'); expect(status(tree)).toBe(oopsLine(w.undoNext, openPetals(tree).length)); expect(shell(tree).hearIt).toBe(oopsLine(w.undoNext, openPetals(tree).length)); expect(hinted(tree)).toEqual([order[1]]); expect(h.tones.play.mock.calls).toEqual([[spare[0]]]);
    petal(tree, order[0]).props.onClick!(); tree = render(); expect(status(tree)).toBe(oopsLine(w.undoWait, openPetals(tree).length)); expect(openPetals(tree)).toHaveLength(2);
    petal(tree, order[1]).props.onClick!(); tree = render(); expect(status(tree)).toBe(oopsLine(w.undoNext, openPetals(tree).length)); expect(hinted(tree)).toEqual([order[0]]); expect(openPetals(tree)).toEqual([order[0]]);
    petal(tree, order[0]).props.onClick!(); tree = render();
    // All back: only restart is live.
    expect(phase(tree)).toBe('reset'); expect(heading(tree)).toBe(w.resetCue); expect(status(tree)).toBe(w.reset); expect(shell(tree).hearIt).toBe(w.reset);
    expect(openPetals(tree)).toEqual([]); expect(hinted(tree)).toEqual([]); expect(live(tree)).toEqual(['oops-restart']);
    expect(control(tree, 'oops-restart').props).toMatchObject({ disabled: false, 'data-ready': true }); expect(control(tree, 'oops-pause').props).toMatchObject({ disabled: true, 'data-ready': false });
    control(tree, 'oops-pause').props.onClick!(); petal(tree, order[0]).props.onClick!(); vi.advanceTimersByTime(120_000); tree = render();
    expect(phase(tree)).toBe('reset'); expect(openPetals(tree)).toEqual([]);
    control(tree, 'oops-restart').props.onClick!(); tree = render();
    expect(phase(tree)).toBe('watch'); expect(heading(tree)).toBe(w.watchAgain); expect(status(tree)).toBe(w.watchNext); expect(steps(tree)).toBe(0);
    // The same order is shown again, and it still blooms.
    expect(watchOrder()).toEqual(order);
    h.sound.mockClear();
    tree = pressAll(order);
    expect(phase(tree)).toBe('bloom'); expect(steps(tree)).toBe(1); expect(h.sound.mock.calls).toEqual([['correct']]);
    expect(finish(playOut(w))).toBeDefined();
  });

  it('jams by itself once a sitting, in round two, and says it is the toy’s doing', () => {
    seededRolls(lang === 'he' ? 47 : 19);
    button(render(), w.start).props.onClick!();
    // Round one: the first right press simply opens.
    let order = watchOrder();
    petal(render(), order[0]).props.onClick!(); expect(phase(render())).toBe('copy');
    expect(phase(pressAll(order.slice(1)))).toBe('bloom'); vi.advanceTimersByTime(BLOOM_MS);
    order = watchOrder(); expect(order).toHaveLength(3);
    h.sound.mockClear(); h.tones.play.mockClear();
    let tree = render(); petal(tree, order[0]).props.onClick!(); tree = render();
    // Right petal, right tone, and then the toy sticks: the same soft jam sound as any jam, and the words say whose doing it is.
    expect(phase(tree)).toBe('jam'); expect(heading(tree)).toBe(w.jamCue); expect(status(tree)).toBe(w.jamToy); expect(shell(tree).hearIt).toBe(w.jamToy);
    expect(petal(tree, order[0]).props).toMatchObject({ 'data-open': true, 'data-half': true, 'data-wobble': true, 'aria-label': oopsLine(w.petalStuck, w.petals[order[0]]) });
    expect(openPetals(tree)).toEqual([order[0]]); expect(hero(tree).pose).toBe('oops'); expect(steps(tree)).toBe(1);
    expect(h.sound.mock.calls).toEqual([['tryAgain']]); expect(h.tones.play.mock.calls).toEqual([[order[0]]]); expect(live(tree)).toEqual(['oops-pause']);
    control(tree, 'oops-pause').props.onClick!(); tree = render();
    expect(phase(tree)).toBe('undo'); expect(status(tree)).toBe(oopsLine(w.undoFirst, openPetals(tree).length)); expect(live(tree)).toEqual([`petal-${order[0]}`]);
    petal(tree, order[0]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('reset'); expect(status(tree)).toBe(w.reset);
    control(tree, 'oops-restart').props.onClick!(); expect(heading(render())).toBe(w.watchAgain);
    expect(watchOrder()).toEqual(order);
    // The same press now simply opens the petal: the toy's jam is used up.
    tree = render(); petal(tree, order[0]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('copy'); expect(petal(tree, order[0]).props).toMatchObject({ 'data-open': true, 'data-half': false, 'data-wobble': false });
    expect(phase(pressAll(order.slice(1)))).toBe('bloom'); expect(steps(render())).toBe(2); expect(status(render())).toBe(w.bloomNext); vi.advanceTimersByTime(BLOOM_MS);
    // Round three: no jam of the toy's.
    order = watchOrder(); expect(order).toHaveLength(3);
    petal(render(), order[0]).props.onClick!(); expect(phase(render())).toBe('copy');
    tree = pressAll(order.slice(1));
    expect(phase(tree)).toBe('bloom'); expect(steps(tree)).toBe(3); expect(status(tree)).toBe(w.bloomLast);
    vi.advanceTimersByTime(BLOOM_MS - 1); expect(finish(render())).toBeUndefined();
    vi.advanceTimersByTime(1); expect(finish(render())).toBeDefined();
    // Play again: once more, in round two again.
    finish(render())!.props.onPlayAgain();
    const jams: string[] = []; let before = '';
    const end = playOut(w, seen => { if (finish(seen)) return; const now = phase(seen); if (now === 'jam' && before !== 'jam') jams.push(`${steps(seen)}:${status(seen)}`); before = now; });
    expect(finish(end)).toBeDefined(); expect(jams).toEqual([`1:${w.jamToy}`]);
  });

  it('keeps the toy’s own jam for the first right press, whatever the child pressed before', () => {
    seededRolls(lang === 'he' ? 53 : 37);
    button(render(), w.start).props.onClick!();
    expect(phase(pressAll(watchOrder()))).toBe('bloom'); vi.advanceTimersByTime(BLOOM_MS);
    const order = watchOrder();
    const wrong = PETALS.find(id => id !== order[0])!;
    // A petal out of turn first: that jam is the child's own press, said plainly and without blame.
    let tree = render(); petal(tree, wrong).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('jam'); expect(status(tree)).toBe(w.jam); expect(openPetals(tree)).toEqual([wrong]);
    control(tree, 'oops-pause').props.onClick!(); petal(render(), wrong).props.onClick!(); control(render(), 'oops-restart').props.onClick!();
    expect(watchOrder()).toEqual(order);
    // The first right press of round two still meets the toy's jam, once.
    tree = render(); petal(tree, order[0]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('jam'); expect(status(tree)).toBe(w.jamToy);
    control(tree, 'oops-pause').props.onClick!(); petal(render(), order[0]).props.onClick!(); control(render(), 'oops-restart').props.onClick!();
    expect(watchOrder()).toEqual(order);
    tree = pressAll(order);
    expect(phase(tree)).toBe('bloom'); expect(steps(tree)).toBe(2);
    expect(finish(playOut(w))).toBeDefined();
  });

  it('finishes a whole game with a petal out of turn in every round and a petal too early on the way back', () => {
    seededRolls(41);
    const blooms: number[] = [];
    const tree = playOut(w, seen => { if (!finish(seen)) blooms.push(steps(seen)); }, { fumble: true, dither: true });
    expect(finish(tree)).toBeDefined();
    expect(blooms).toEqual([...blooms].sort((a, b) => a - b)); expect(blooms.at(-1)).toBe(OOPS_ROUNDS);
    const sounds = h.sound.mock.calls.map(call => call[0]);
    expect(sounds.filter(name => name === 'correct')).toHaveLength(OOPS_ROUNDS);
    expect(sounds.filter(name => name === 'tryAgain').length).toBeGreaterThanOrEqual(4);
    expect(sounds.every(name => name === 'correct' || name === 'tryAgain')).toBe(true);
  });

  it('plays the bigger adventure: three, four, then all five petals', () => {
    seededRolls(lang === 'he' ? 61 : 43);
    picker(render()).props.onChange('explore');
    button(render(), w.start).props.onClick!();
    const orders: number[][] = [];
    for (let round = 0; round < OOPS_ROUNDS; round++) {
      let order = watchOrder();
      expect(order).toHaveLength(orderLength('explore' as Level, round)); expect(new Set(order).size).toBe(order.length);
      if (round === 1) {
        petal(render(), order[0]).props.onClick!(); expect(status(render())).toBe(w.jamToy);
        control(render(), 'oops-pause').props.onClick!(); petal(render(), order[0]).props.onClick!(); control(render(), 'oops-restart').props.onClick!();
        const again = watchOrder(); expect(again).toEqual(order); order = again;
      }
      orders.push(order);
      const tree = pressAll(order);
      expect(phase(tree)).toBe('bloom'); expect(steps(tree)).toBe(round + 1); expect(status(tree)).toBe(round + 1 < OOPS_ROUNDS ? w.bloomNext : w.bloomLast);
      vi.advanceTimersByTime(BLOOM_MS);
    }
    expect(orders.map(order => order.length)).toEqual([3, 4, 5]); expect([...orders[2]].sort()).toEqual([...PETALS]);
    expect(finish(render())).toBeDefined();
  });

  it('starts again from round one on play again, and drops a game that is cut short', () => {
    seededRolls(9);
    let tree = playOut(w);
    finish(tree)!.props.onPlayAgain(); tree = render();
    expect(finish(tree)).toBeUndefined(); expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.ready); expect(status(tree)).toBe(w.readyNext);
    expect(steps(tree)).toBe(0); expect(openPetals(tree)).toEqual([]); expect(live(tree)).toEqual(['start-button']);
    expect(nodes(tree).some(n => n.props['data-control'] !== undefined)).toBe(false);
    expect(picker(tree).props.value).toBe('gentle'); expect(h.tones.stop).toHaveBeenCalled();
    // Round one again: two petals in the little adventure.
    button(tree, w.start).props.onClick!();
    const order = watchOrder(); expect(order).toHaveLength(2);
    expect(finish(playOut(w, undefined, {}, order))).toBeDefined();
    // A new start in the middle of a showing: nothing of the old game arrives afterwards.
    finish(render())!.props.onPlayAgain(); tree = render();
    const restart = picker(tree).props.onChange as (level: Level) => void;
    button(tree, w.start).props.onClick!(); vi.advanceTimersByTime(WATCH_LEAD_MS); expect(openPetals(render())).toHaveLength(1);
    restart('explore'); h.sound.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(30_000); tree = render();
    expect(phase(tree)).toBe('ready'); expect(openPetals(tree)).toEqual([]); expect(steps(tree)).toBe(0); expect(status(tree)).toBe(w.readyNext);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled(); expect(picker(tree).props.value).toBe('explore');
    // And in the middle of a jam: the next game starts clean, with three petals in the bigger adventure.
    button(tree, w.start).props.onClick!();
    const bigger = watchOrder(); expect(bigger).toHaveLength(3);
    petal(render(), PETALS.find(id => id !== bigger[0])!).props.onClick!(); expect(phase(render())).toBe('jam');
    restart('gentle'); tree = render();
    expect(phase(tree)).toBe('ready'); expect(openPetals(tree)).toEqual([]); expect(PETALS.every(id => petal(tree, id).props['data-half'] === false)).toBe(true); expect(hero(tree).pose).toBe('idle');
    expect(finish(playOut(w))).toBeDefined();
  });

  it('plays the whole game with sound off: petals, numerals and words carry it', () => {
    h.muted = true; h.tones.play.mockReturnValue(false); seededRolls(17);
    const quiet: boolean[] = [], numerals = new Set<number>(), said = new Set<string>();
    const tree = playOut(w, seen => {
      if (finish(seen)) return;
      quiet.push(nodes(seen).some(n => n.props.className === 'adventure-quiet' && words(n) === w.quiet));
      if (phase(seen) === 'watch') for (const id of PETALS) if (mark(seen, id) > 0) numerals.add(mark(seen, id));
      said.add(status(seen));
      expect(one(seen, 'the heading', n => 'focusKey' in n.props).props.muted).toBe(true);
    }, { fumble: true, dither: true, listen: true });
    expect(finish(tree)).toBeDefined(); expect(h.say).not.toHaveBeenCalled();
    expect(quiet.length).toBeGreaterThan(20); expect(quiet.every(Boolean)).toBe(true);
    // The order was on the petals as numerals, and every step was written out.
    expect([...numerals].sort()).toEqual([1, 2, 3]); expect(said.has('')).toBe(false);
    expect([...said]).toEqual(expect.arrayContaining([w.readyNext, w.watchNext, w.copyFirst, w.jam, w.jamToy, undoLike(w.undoFirst), undoLike(w.undoWait), undoLike(w.undoNext), w.reset, w.bloomNext, w.bloomLast]));
  });

  it('speaks only lines from the copy when sound is on, and never while the toy shows its order', () => {
    seededRolls(17);
    let tree = render();
    expect(nodes(tree).some(n => n.props.className === 'adventure-quiet')).toBe(false); expect(h.say).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]);
    const allowed = lines(lang);
    let saidBefore: number | null = null, beats = 0;
    tree = playOut(w, seen => {
      // Nothing was said during the stretch of time that followed a showing or a bloom.
      if (saidBefore !== null) { expect(h.say.mock.calls.length).toBe(saidBefore); beats++; }
      saidBefore = !finish(seen) && quietBeat(seen) ? h.say.mock.calls.length : null;
    }, { fumble: true, dither: true, listen: true });
    expect(finish(tree)).toBeDefined(); expect(beats).toBeGreaterThan(20);
    const spoken = h.say.mock.calls.map(call => call[1] as string);
    expect(spoken).toEqual(expect.arrayContaining([w.ready, w.copy, w.jam, w.jamToy, w.undo, undoLike(w.undoWait), undoLike(w.undoNext), w.reset]));
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
        expect(node.props['aria-label'], 'every control has a name from the copy').toBeTruthy();
      }
    }, { fumble: true, dither: true });
    expect(finish(tree)).toBeDefined(); expect(all.length).toBeGreaterThan(500);
    const unique = [...new Set(all)];
    for (const text of unique) { expect(allowed.has(text), text).toBe(true); expect(text).not.toMatch(/[{}]/); }
    for (const text of unique) { expect(text, text).not.toMatch(lang === 'he' ? /[A-Za-z]/ : /[א-ת]/); expect(unseen(text), text).toBe(false); }
    // The lines a child meets on the way are all there.
    expect(unique).toEqual(expect.arrayContaining([w.title, w.instruction, w.ready, w.readyNext, w.start, w.watch, w.watchAgain, w.watchNext, w.copy, w.copyFirst, w.bloom, w.bloomNext, w.bloomLast,
      w.jamCue, w.jam, w.jamToy, w.undo, undoLike(w.undoFirst), undoLike(w.undoNext), undoLike(w.undoWait), w.resetCue, w.reset, w.pause, w.restart, w.toy, w.finishTitle, w.transfer, shared.again, shared.home, '1', '2', '3']));
    expect(unique.some(text => w.petals.some(name => text === oopsLine(w.petalStuck, name)))).toBe(true);
    expect(unique.some(text => w.petals.some(name => text === oopsLine(w.watchStep, 1, 2, name)))).toBe(true);
    expect(unique).toContain(oopsLine(w.copyNext, 1, 3));
  });

  it('leaves no timer running when the game closes', () => {
    seededRolls(7);
    render(); expect(vi.getTimerCount()).toBe(1);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(1);
    // Closed while the toy is showing its order.
    button(mount(), w.start).props.onClick!();
    expect(phase(render())).toBe('watch'); expect(vi.getTimerCount()).toBeGreaterThanOrEqual(4);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(2);
    h.sound.mockClear(); h.say.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.say).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
    // Closed while the flower glows.
    mount(); playUntil(w, 'bloom'); expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount(); expect(vi.getTimerCount()).toBe(0);
    // Closed while putting petals back, with a wobble still under way.
    button(mount(), w.start).props.onClick!();
    const order = watchOrder();
    petal(render(), order[0]).props.onClick!(); petal(render(), PETALS.find(id => !order.includes(id))!).props.onClick!(); expect(phase(render())).toBe('jam');
    control(render(), 'oops-pause').props.onClick!(); petal(render(), order[0]).props.onClick!();
    const tree = render(); expect(status(tree)).toBe(oopsLine(w.undoWait, openPetals(tree).length)); expect(petal(tree, order[0]).props['data-wobble']).toBe(true); expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount(); expect(vi.getTimerCount()).toBe(0);
    h.sound.mockClear(); h.say.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.say).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
  });
});

describe('Oops Button words', () => {
  const en = OOPS_BUTTON_COPY.en, he = OOPS_BUTTON_COPY.he;
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
    expect(en.petals).toHaveLength(PETALS.length); expect(new Set(en.petals).size).toBe(PETALS.length); expect(new Set(he.petals).size).toBe(PETALS.length);
  });
  it('keeps the tile words, the jam words and the closing words of the brief', () => {
    expect(en.title).toBe('Oops Button'); expect(en.description).toBe('Pause. Put back. Try again.');
    expect(en.instruction).toBe('Copy the flower. If it gets stuck, press Oops, put the petals back and start again.');
    expect(en.jam).toBe('Oops. The flower got stuck. Press Oops.'); expect(en.jamToy).toBe('Oops. The flower got stuck by itself. That happens. Press Oops.'); expect(en.pause).toBe('Oops!');
    expect(en.undo).toBe('Put the petals back. Biggest number first.'); expect(oopsLine(en.undoWait, 3)).toBe('Not yet. Press number 3.'); expect(en.reset).toBe('All back. Press Start again.');
    expect(en.finishTitle).toBe('It bloomed!'); expect(en.transfer).toBe('Away from the screen: when a block tower wobbles, say oops, stop, take the top block off first, then build again.');
    expect(en.description.length).toBeLessThanOrEqual(32); expect(he.description.length).toBeLessThanOrEqual(32);
  });
  it('never keeps count of a slip: no word of tallies, prizes or blame', () => {
    for (const value of Object.values(en).flat()) expect(value, value).not.toMatch(/\b(scores?|points?|rewards?|wins?|won|lose|lost|coins?|streaks?|stars?|prizes?|levels?|mistakes?|fail(ed|s)?|fault)\b/i);
    // The same for the Hebrew: no points, prizes, wins, losses, stars or mistakes.
    for (const value of Object.values(he).flat()) expect(value, value).not.toMatch(/נקוד|ניקוד|פרס|ניצח|מנצח|הפסד|מפסיד|כוכב|מטבע|טעות|טעית|נכשל|אשמ/);
  });
  it('fills the blanks of a line', () => {
    expect(oopsLine(en.watchStep, 2, 3, en.petals[1])).toBe('2 of 3: Blue petal.'); expect(oopsLine(en.copyNext, 1, 3)).toBe('1 of 3 open. Press the next petal.');
    expect(oopsLine(en.petalOpen, en.petals[0])).toBe('Orange petal, open'); expect(oopsLine(en.petalClosed, en.petals[4])).toBe('Purple petal, closed'); expect(oopsLine(en.petalStuck, en.petals[3])).toBe('Pink petal, stuck halfway');
    expect(oopsLine(he.watchStep, 2, 3, he.petals[1])).toBe('2 מתוך 3: עלה כחול.'); expect(oopsLine(he.copyNext, 1, 3)).toBe('1 מתוך 3 פתוחים. לוחצים על הבא בתור.');
    expect(oopsLine('{0}{1}{2}', 'a')).toBe('a'); expect(oopsLine(en.ready)).toBe(en.ready);
  });
});
