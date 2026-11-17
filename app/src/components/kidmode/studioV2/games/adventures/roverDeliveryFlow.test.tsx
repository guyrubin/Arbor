/** Rover Delivery through its real event handlers, without a browser. Layout,
 * the glide of the rover, the art and real audio timing remain a rendered check. */
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
import RoverDelivery from './RoverDelivery';
import { GameFinish, GameShell } from '../../../game/GameShell';
import { StudioPlayHero } from '../../StudioPlayHero';
import { AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import type { Challenge } from './adventureRules';
import { ROVER_DELIVERY_COPY, roverLine, type RoverDeliveryWords } from './roverDeliveryCopy';
import { ARRIVED_MS, HEADINGS, HINT_AFTER, OOPS_MS, PRESS_MS, RETURN_MS, ROVER_ROUNDS, STEP_MS, fixSigns, initialSigns, levelFor, roverTone, runRover, turnsOf, type Heading, type RoverEnd, type RoverLevel, type RoverRun } from './roverDeliveryRules';

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
/** Sees every frame a test renders, when a test wants to check all of them. */
let watch: ((tree: unknown) => void) | null = null;
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = RoverDelivery(); h.effects.forEach(fn => fn()); watch?.(tree); return tree; }
/** What React does when the game closes: every effect cleans up. */
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
function mount() { unmount(); h.slots = []; return render(); }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
function one(tree: unknown, what: string, test: (node: Node) => boolean): Node { const found = nodes(tree).find(test); expect(found, what).toBeDefined(); return found!; }
function button(tree: unknown, text: string) { return one(tree, text, n => n.type === 'button' && words(n.props.children) === text); }
function heading(tree: unknown) { return words(nodes(tree).find(n => 'focusKey' in n.props)); }
const classed = (name: string) => (node: Node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(name);
const stage = (tree: unknown) => one(tree, 'the game', n => n.props['data-adventure'] === 'rover');
const phase = (tree: unknown): string => stage(tree).props['data-phase'];
const shell = (tree: unknown) => one(tree, 'the shell', n => n.type === GameShell);
const picker = (tree: unknown) => one(tree, 'the challenge picker', n => n.type === ChallengePicker);
const prompt = (tree: unknown) => one(tree, 'the heading', n => 'focusKey' in n.props);
const board = (tree: unknown) => one(tree, 'the floor', classed('rover-board'));
const cells = (tree: unknown): number[] => nodes(tree).filter(classed('rover-cell')).map(n => n.props['data-cell']);
const buttons = (tree: unknown) => nodes(tree).filter(n => n.type === 'button');
const sign = (tree: unknown, index: number) => one(tree, `sign ${index}`, n => n.type === 'button' && n.props['data-sign'] === index);
const bloom = (tree: unknown) => nodes(tree).find(classed('rover-bloom'));
const rover = (tree: unknown) => one(tree, 'the rover', classed('rover-car'));
const at = (tree: unknown): number => rover(tree).props['data-at'];
const pep = (tree: unknown) => one(tree, 'Pep', n => n.props.friend === 'pep');
const hero = (tree: unknown) => one(tree, 'the hero', n => n.type === StudioPlayHero);
const done = (tree: unknown): number => one(tree, 'the steps', n => n.type === AdventureSteps).props.done;
const status = (tree: unknown) => words(one(tree, 'the status line', n => n.props.role === 'status'));
const finish = (tree: unknown) => nodes(tree).find(n => n.type === GameFinish);
const startButton = (tree: unknown, w: RoverDeliveryWords) => button(tree, w.start);
/** The way each sign of the floor points on screen. */
const pointing = (tree: unknown, level: RoverLevel): Heading[] => level.signs.map((_, index) => sign(tree, index).props['data-heading']);
const isFolded = (tree: unknown): boolean => bloom(tree)?.props['data-folded'] === true;
/** The cells shown as driven over, in reading order of the floor. */
const trail = (tree: unknown): number[] => nodes(tree).filter(n => n.props['data-trail'] === true).map(n => n.props['data-cell']);
const hints = (tree: unknown) => nodes(tree).filter(n => n.props['data-hint'] === true);
const ordered = (path: readonly number[]) => [...new Set(path)].sort((a, b) => a - b);
const reason = (w: RoverDeliveryWords, end: RoverEnd): string => end === 'goal' ? '' : w.ends[end];

/** Taps one sign until it points the wanted way: each tap is a quarter turn clockwise. */
function point(index: number, wanted: Heading) {
  for (let taps = 0; taps < 4 && sign(render(), index).props['data-heading'] !== wanted; taps++) sign(render(), index).props.onClick!();
  return render();
}
/** Sets the whole plan of a floor through the real taps. */
function plan(dirs: readonly Heading[], folded: boolean) {
  dirs.forEach((wanted, index) => point(index, wanted));
  const flower = bloom(render());
  if (flower && isFolded(render()) !== folded) flower.props.onClick!();
  return render();
}
/** Presses Start and lets the run play out, for as long as the rules say it takes:
 * a rover parked away from its start rolls back first. */
function send(level: RoverLevel, w: RoverDeliveryWords): { tree: ReturnType<typeof render>; run: RoverRun } {
  let tree = render();
  const run = runRover(level, pointing(tree, level), isFolded(tree)), lead = at(tree) === level.start ? 0 : RETURN_MS;
  startButton(tree, w).props.onClick!(); tree = render();
  expect(phase(tree)).toBe('drive');
  vi.advanceTimersByTime(lead + STEP_MS * run.path.length);
  return { tree: render(), run };
}
/** Puts the floor on screen right, sends the rover and waits for the next floor. */
function solve(level: RoverLevel, w: RoverDeliveryWords) {
  plan(fixSigns(level), true);
  const sent = send(level, w);
  expect(sent.run.end).toBe('goal'); expect(phase(sent.tree)).toBe('arrived');
  vi.advanceTimersByTime(ARRIVED_MS);
  return render();
}
/** A whole adventure the short way, from its first floor. */
function playOut(challenge: Challenge, w: RoverDeliveryWords) {
  let tree = render();
  for (let round = 0; round < ROVER_ROUNDS; round++) tree = solve(levelFor(challenge, round), w);
  return tree;
}
/** A whole adventure the long way round: a flower is folded and opened once to
 * see what it does, every floor is sent as it stands, sent again, and then put
 * right one tap at a time on whatever the game points out. With `listen`, a
 * moment passes after every change, as for a child who hears each line out. */
function wander(challenge: Challenge, w: RoverDeliveryWords, listen = false) {
  const pause = () => { let tree = render(); if (listen) { vi.advanceTimersByTime(250); tree = render(); } return tree; };
  let tree = pause();
  for (let round = 0; round < ROVER_ROUNDS; round++) {
    const level = levelFor(challenge, round);
    for (let taps = 0; taps < 2 && bloom(tree); taps++) { bloom(tree)!.props.onClick!(); tree = pause(); }
    let parks = 0;
    for (let turn = 0; turn < 12; turn++) {
      const sent = send(level, w); tree = sent.tree;
      if (sent.run.end === 'goal') break;
      parks++; tree = pause();
      const marked = hints(tree);
      expect(marked, `${challenge} ${round + 1}`).toHaveLength(parks >= HINT_AFTER ? 1 : 0);
      if (marked.length) { marked[0].props.onClick!(); tree = pause(); }
    }
    expect(phase(tree), `${challenge} ${round + 1}`).toBe('arrived');
    vi.advanceTimersByTime(ARRIVED_MS); tree = pause();
  }
  return tree;
}
/** Every line the game can put on screen in one language. */
function lines(lang: 'en' | 'he'): Set<string> {
  const w: RoverDeliveryWords = ROVER_DELIVERY_COPY[lang], shared = ADVENTURE_COPY[lang], all = new Set<string>(['', shared.again, shared.home]);
  for (const value of Object.values(w)) if (typeof value === 'string' && !value.includes('{')) all.add(value);
  for (const value of Object.values(w.ends)) all.add(value);
  for (const name of Object.values(w.directions)) {
    for (const line of [w.sign, w.signNow, w.rover]) all.add(roverLine(line, name));
    all.add(`${roverLine(w.sign, name)} ${w.hintHere}`);
  }
  all.add(`${w.bloomOpen} ${w.hintHere}`);
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
  h.slots = []; h.lang = 'en'; h.muted = false; h.hush = []; watch = null;
  h.tones.play.mockClear(); h.tones.play.mockReturnValue(true); h.tones.stop.mockClear(); h.tones.dispose.mockClear(); h.say.mockClear(); h.sound.mockClear();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  watch = null; unmount();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe.each(['en', 'he'] as const)('Rover Delivery (%s)', lang => {
  const w: RoverDeliveryWords = ROVER_DELIVERY_COPY[lang], shared = ADVENTURE_COPY[lang];
  beforeEach(() => { h.lang = lang; });

  it('plays three floors from the first plan to the delivery through the real handlers', () => {
    let tree = render();
    expect(shell(tree).props).toMatchObject({ fullBleed: true, autoNarrate: false, worldId: 'river-rescue', title: w.title, instruction: w.instruction, hearIt: w.plan });
    expect(stage(tree).props.dir).toBe(lang === 'he' ? 'rtl' : 'ltr'); expect(stage(tree).props.className).toBe('adventure adventure--bop adventure--rover');
    expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.plan); expect(status(tree)).toBe('');
    expect(one(tree, 'the steps', n => n.type === AdventureSteps).props).toMatchObject({ done: 0, total: ROVER_ROUNDS });
    expect(one(tree, 'the scene', n => n.props.scene === 'scene-floor')).toBeDefined();
    // The floor is a map: it keeps its own left and right in both languages.
    expect(board(tree).props).toMatchObject({ dir: 'ltr', role: 'group', 'aria-label': w.board }); expect(board(tree).props.style['--rover-n']).toBe(3);
    expect(one(tree, 'the stage', classed('rover-stage')).props['data-size']).toBe(3); expect(cells(tree)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // One sign, a real button named by the way it points; the rover on its mat; Pep on the rug.
    expect(buttons(tree)).toHaveLength(2);
    expect(sign(tree, 0).props).toMatchObject({ type: 'button', disabled: false, 'aria-disabled': false, 'data-cell': 0, 'data-heading': 'n', 'data-hint': false, 'aria-label': roverLine(w.sign, w.directions.n) });
    expect(nodes(sign(tree, 0)).some(n => n.props.name === 'rover-sign')).toBe(true);
    expect(rover(tree).props).toMatchObject({ 'data-at': 6, 'data-heading': 'n', 'data-parked': false, role: 'img', 'aria-label': roverLine(w.rover, w.directions.n), style: { '--rover-col': 0, '--rover-row': 2, '--rover-turn': 0 } });
    expect(one(tree, 'the start mat', classed('rover-start')).props).toMatchObject({ 'data-cell': 6, role: 'img', 'aria-label': w.startMat });
    expect(one(tree, 'the rug', classed('rover-goal')).props).toMatchObject({ 'data-cell': 2, role: 'img', 'aria-label': w.goal });
    expect(one(tree, 'Pep on the rug', classed('rover-pep')).props).toMatchObject({ 'aria-hidden': 'true', style: { '--rover-col': 2, '--rover-row': 0 } });
    expect(pep(tree).props.mood).toBe('idle'); expect(nodes(tree).some(n => n.props.name === 'pep-happy')).toBe(true);
    // The hero stands beside one start button, off the floor.
    expect(hero(tree).props).toMatchObject({ pose: 'idle', kick: 0, celebrate: false }); expect(nodes(board(tree)).some(n => n.type === StudioPlayHero)).toBe(false);
    expect(startButton(tree, w).props).toMatchObject({ type: 'button', disabled: false, 'aria-disabled': false, 'aria-label': w.start });

    for (let round = 0; round < ROVER_ROUNDS; round++) {
      const level = levelFor('gentle', round);
      expect(pointing(tree, level)).toEqual(initialSigns(level)); expect(at(tree)).toBe(level.start); expect(done(tree)).toBe(round); expect(trail(tree)).toEqual([]);
      expect(nodes(tree).some(classed('rover-swirl'))).toBe(false);
      plan(fixSigns(level), true);
      // B-GAME-45: every sign the child turned answers with a swirl.
      const turned = pointing(render(), level).filter((heading, sign) => heading !== initialSigns(level)[sign]).length;
      expect(nodes(render()).filter(classed('rover-swirl'))).toHaveLength(turned);
      const sent = send(level, w); tree = sent.tree;
      expect(sent.run.end).toBe('goal'); expect(phase(tree)).toBe('arrived'); expect(heading(tree)).toBe(w.arrived); expect(status(tree)).toBe(''); expect(shell(tree).props.hearIt).toBe(w.arrived);
      expect(at(tree)).toBe(level.goal); expect(done(tree)).toBe(round + 1); expect(trail(tree)).toEqual(ordered(sent.run.path));
      // Pep's welcome is a wag and a hop, never a word; the hero joins in.
      expect(pep(tree).props.mood).toBe('happy'); expect(hero(tree).props.celebrate).toBe(true);
      expect(one(tree, 'the rug', classed('rover-goal')).props['data-arrived']).toBe(true); expect(nodes(tree).some(classed('rover-puff'))).toBe(false);
      expect(buttons(tree).every(n => n.props.disabled === true && n.props['aria-disabled'] === true)).toBe(true);
      vi.advanceTimersByTime(ARRIVED_MS - 1); tree = render(); expect(finish(tree)).toBeUndefined(); expect(phase(tree)).toBe('arrived');
      vi.advanceTimersByTime(1); tree = render();
      if (round < ROVER_ROUNDS - 1) {
        expect(phase(tree)).toBe('plan'); expect(heading(tree)).toBe(w.plan); expect(status(tree)).toBe(''); expect(pep(tree).props.mood).toBe('idle');
        expect(nodes(tree).some(n => n.type === ChallengePicker)).toBe(false); expect(buttons(tree).every(n => n.props.disabled === false)).toBe(true);
      }
    }
    const end = finish(tree)!; expect(end).toBeDefined();
    expect(end.props).toMatchObject({ title: w.finishTitle, subtitle: w.transfer, playAgainLabel: shared.again, homeLabel: shared.home });
    expect('creation' in end.props).toBe(false); expect(typeof end.props.onPlayAgain).toBe('function');
    expect(nodes(tree).some(n => n.props['data-adventure'] === 'rover')).toBe(false); expect(shell(tree).props.hearIt).toBe(w.finishTitle);
    expect(h.sound.mock.calls.filter(call => call[0] === 'correct')).toHaveLength(ROVER_ROUNDS); expect(h.sound).not.toHaveBeenCalledWith('tryAgain');
    // One soft tone for every cell driven on the three finished routes.
    expect(h.tones.play).toHaveBeenCalledTimes(4 + 2 + 6);
  });

  it('never finishes a floor on the first press of Start: the rover parks, and nothing is lost', () => {
    for (const challenge of ['gentle', 'explore'] as const) {
      picker(mount()).props.onChange(challenge);
      let tree = render();
      for (let round = 0; round < ROVER_ROUNDS; round++) {
        const level = levelFor(challenge, round), name = `${challenge} ${round + 1}`;
        h.sound.mockClear();
        const sent = send(level, w); tree = sent.tree;
        expect(sent.run.end, name).not.toBe('goal'); expect(finish(tree), name).toBeUndefined();
        expect(phase(tree), name).toBe('parked'); expect(heading(tree)).toBe(w.parked); expect(status(tree), name).toBe(reason(w, sent.run.end)); expect(status(tree)).not.toBe('');
        expect(rover(tree).props).toMatchObject({ 'data-at': sent.run.at, 'data-parked': true }); expect(done(tree)).toBe(round);
        // The plan is exactly as it was, and the way the rover took stays on the floor.
        expect(pointing(tree, level)).toEqual(initialSigns(level)); expect(isFolded(tree)).toBe(false); expect(trail(tree)).toEqual(ordered(sent.run.path));
        expect(h.sound.mock.calls.map(call => call[0])).toEqual(['tap', 'tryAgain']);
        expect(hero(tree).props.pose).toBe('oops'); vi.advanceTimersByTime(OOPS_MS); expect(hero(render()).props.pose).toBe('idle');
        // No clock on a parked rover: it waits, and every control still works.
        vi.advanceTimersByTime(60_000); tree = render();
        expect(phase(tree)).toBe('parked'); expect(at(tree)).toBe(sent.run.at); expect(buttons(tree).every(n => n.props.disabled === false)).toBe(true);
        tree = solve(level, w);
        if (round < ROVER_ROUNDS - 1) expect(done(tree), name).toBe(round + 1);
      }
      expect(finish(tree), challenge).toBeDefined();
    }
  });

  it('a turn the wrong way changes only that sign, and never blocks the right one', () => {
    const level = levelFor('gentle', 0);
    let tree = render();
    // Past the answer and round again: each tap is a quarter turn clockwise, told in words.
    (['e', 's', 'w', 'n', 'e', 's'] as const).forEach((facing, taps) => {
      sign(tree, 0).props.onClick!(); tree = render();
      expect(sign(tree, 0).props).toMatchObject({ 'data-heading': facing, 'aria-label': roverLine(w.sign, w.directions[facing]), 'data-hint': false, disabled: false });
      expect(nodes(sign(tree, 0)).find(classed('rover-spin'))!.props.style['--rover-turn']).toBe(taps + 1);
      expect(status(tree)).toBe(roverLine(w.signNow, w.directions[facing])); expect(shell(tree).props.hearIt).toBe(roverLine(w.signNow, w.directions[facing]));
      expect(phase(tree)).toBe('plan'); expect(heading(tree)).toBe(w.plan); expect(at(tree)).toBe(level.start); expect(done(tree)).toBe(0); expect(finish(tree)).toBeUndefined();
    });
    expect(nodes(tree).some(n => n.type === ChallengePicker)).toBe(false);
    expect(h.sound.mock.calls.map(call => call[0])).toEqual(['tap', 'tap', 'tap', 'tap', 'tap', 'tap']); expect(h.tones.play).not.toHaveBeenCalled();
    // Sent the wrong way, the rover drives back and parks on its own mat: nothing is finished.
    let sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ path: [6, 3, 0, 3, 6], end: 'edge', at: 6 });
    expect(phase(tree)).toBe('parked'); expect(status(tree)).toBe(w.ends.edge); expect(rover(tree).props).toMatchObject({ 'data-at': 6, 'data-heading': 's' });
    expect(done(tree)).toBe(0); expect(finish(tree)).toBeUndefined(); expect(hints(tree)).toEqual([]);
    vi.advanceTimersByTime(60_000); tree = render(); expect(phase(tree)).toBe('parked'); expect(status(tree)).toBe(w.ends.edge);
    // Another wrong way: the same rover waits on its mat again, facing its first way.
    sign(tree, 0).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('plan'); expect(heading(tree)).toBe(w.replan); expect(status(tree)).toBe(roverLine(w.signNow, w.directions.w));
    expect(rover(tree).props).toMatchObject({ 'data-at': 6, 'data-heading': 'n', 'data-parked': false });
    sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ path: [6, 3, 0], end: 'edge', at: 0 });
    // The rover turned a quarter back to face that way, not three quarters on.
    expect(rover(tree).props).toMatchObject({ 'data-at': 0, 'data-heading': 'w', 'data-parked': true }); expect(rover(tree).props.style['--rover-turn']).toBe(3);
    expect(sign(tree, 0).props['data-hint']).toBe(true);
    // The right way still works after any number of other tries.
    sign(tree, 0).props.onClick!(); tree = render(); expect(pointing(tree, level)).toEqual(['n']); expect(sign(tree, 0).props['data-hint']).toBe(true);
    tree = point(0, 'e'); expect(pointing(tree, level)).toEqual(['e']); expect(sign(tree, 0).props['data-hint']).toBe(false);
    sent = send(level, w);
    expect(sent.run.end).toBe('goal'); expect(phase(sent.tree)).toBe('arrived'); expect(done(sent.tree)).toBe(1);
    expect(h.sound.mock.calls.map(call => call[0]).filter(sound => sound !== 'tap')).toEqual(['tryAgain', 'tryAgain', 'correct']);
  });

  it('parks, names what happened, and after two parked runs points out the one sign to change', () => {
    const level = levelFor('gentle', 0);
    let sent = send(level, w), tree = sent.tree;
    expect(sent.run).toMatchObject({ path: [6, 3, 0], end: 'edge', at: 0 });
    expect(phase(tree)).toBe('parked'); expect(heading(tree)).toBe(w.parked); expect(status(tree)).toBe(w.ends.edge); expect(shell(tree).props.hearIt).toBe(w.ends.edge);
    expect(at(tree)).toBe(0); expect(trail(tree)).toEqual([0, 3, 6]); expect(hero(tree).props).toMatchObject({ pose: 'oops', kick: 1, celebrate: false });
    // One parked run: nothing is pointed out yet.
    expect(hints(tree)).toEqual([]); expect(sign(tree, 0).props['aria-label']).toBe(roverLine(w.sign, w.directions.n));
    // The same rover goes again: it rolls back to its mat first, then drives.
    startButton(tree, w).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('drive'); expect(at(tree)).toBe(6); expect(status(tree)).toBe(''); expect(trail(tree)).toEqual([6]); expect(hero(tree).props).toMatchObject({ pose: 'hold-up', kick: 2 });
    vi.advanceTimersByTime(RETURN_MS + STEP_MS - 1); expect(at(render())).toBe(6);
    vi.advanceTimersByTime(1); expect(at(render())).toBe(3);
    vi.advanceTimersByTime(STEP_MS * 2 - 1); tree = render(); expect(phase(tree)).toBe('drive'); expect(at(tree)).toBe(0);
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('parked'); expect(status(tree)).toBe(w.ends.edge);
    // Two parked runs: one sign is pointed out, in the picture and in its name.
    expect(hints(tree)).toHaveLength(1); expect(sign(tree, 0).props['data-hint']).toBe(true);
    expect(sign(tree, 0).props['aria-label']).toBe(`${roverLine(w.sign, w.directions.n)} ${w.hintHere}`);
    expect(h.sound.mock.calls.map(call => call[0])).toEqual(['tap', 'tryAgain', 'tap', 'tryAgain']);
    // One change: the rover waits on its mat again, and the words say what the sign shows now.
    sign(tree, 0).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('plan'); expect(at(tree)).toBe(6); expect(heading(tree)).toBe(w.replan); expect(status(tree)).toBe(roverLine(w.signNow, w.directions.e));
    expect(hints(tree)).toEqual([]); expect(sign(tree, 0).props['aria-label']).toBe(roverLine(w.sign, w.directions.e));
    // The way the last run took stays on the floor until the next start.
    expect(trail(tree)).toEqual([0, 3, 6]);
    sent = send(level, w); tree = sent.tree;
    expect(sent.run.end).toBe('goal'); expect(phase(tree)).toBe('arrived'); expect(done(tree)).toBe(1); expect(hints(tree)).toEqual([]);
    // The next floor starts fresh: no parked runs carried over, the first prompt again.
    vi.advanceTimersByTime(ARRIVED_MS); tree = render();
    expect(phase(tree)).toBe('plan'); expect(heading(tree)).toBe(w.plan); expect(hints(tree)).toEqual([]);
    const next = levelFor('gentle', 1);
    tree = send(next, w).tree; expect(status(tree)).toBe(w.ends.edge); expect(hints(tree)).toEqual([]);
    // One tap here meets the planter; the words name it, and the same sign is pointed out.
    tree = point(0, 'e'); tree = send(next, w).tree;
    expect(status(tree)).toBe(w.ends.planter); expect(at(tree)).toBe(4); expect(sign(tree, 0).props['data-hint']).toBe(true);
    tree = point(0, 's'); expect(send(next, w).run.end).toBe('goal');
  });

  it('drives one cell every 420 ms with a soft tone, and locks the plan while it runs', () => {
    const level = levelFor('gentle', 0);
    let tree = point(0, 'e'); h.sound.mockClear();
    startButton(tree, w).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('drive'); expect(heading(tree)).toBe(w.drive); expect(status(tree)).toBe(''); expect(shell(tree).props.hearIt).toBe(w.drive);
    expect(prompt(tree).props.muted).toBe(true); expect(hero(tree).props).toMatchObject({ pose: 'hold-up', kick: 1 });
    expect(buttons(tree)).toHaveLength(2); expect(buttons(tree).every(n => n.props.disabled === true && n.props['aria-disabled'] === true)).toBe(true);
    // Taps on a locked floor do nothing, and a second press does not start a second run.
    sign(tree, 0).props.onClick!(); startButton(tree, w).props.onClick!(); tree = render();
    expect(pointing(tree, level)).toEqual(['e']); expect(h.sound.mock.calls).toEqual([['tap']]); expect(hero(tree).props.kick).toBe(1);
    const run = runRover(level, ['e'], false);
    expect(run.path).toEqual([6, 3, 0, 1, 2]); expect(STEP_MS).toBe(420);
    for (let move = 1; move < run.path.length; move++) {
      vi.advanceTimersByTime(STEP_MS - 1); expect(at(render())).toBe(run.path[move - 1]);
      vi.advanceTimersByTime(1); tree = render();
      expect(phase(tree)).toBe('drive'); expect(at(tree)).toBe(run.path[move]); expect(rover(tree).props['data-heading']).toBe(run.headings[move]);
      expect(rover(tree).props.style).toMatchObject({ '--rover-col': run.path[move] % 3, '--rover-row': Math.floor(run.path[move] / 3), '--rover-turn': turnsOf(run.headings[move]) });
      expect(rover(tree).props['aria-label']).toBe(roverLine(w.rover, w.directions[run.headings[move]]));
      expect(trail(tree)).toEqual(ordered(run.path.slice(0, move + 1)));
      expect(h.tones.play.mock.calls).toEqual(Array.from({ length: move }, (_, index) => [roverTone(index)]));
      expect(hero(tree).props.pose).toBe(STEP_MS * move < PRESS_MS ? 'hold-up' : 'idle');
    }
    // On the rug the rover rests for one more beat, then Pep's welcome.
    vi.advanceTimersByTime(STEP_MS - 1); expect(phase(render())).toBe('drive');
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('arrived'); expect(h.sound.mock.calls).toEqual([['tap'], ['correct']]); expect(h.tones.play.mock.calls).toEqual([[0], [1], [2], [3]]);
    // Still locked while Pep and the rover are together.
    sign(tree, 0).props.onClick!(); startButton(tree, w).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('arrived'); expect(pointing(tree, level)).toEqual(['e']); expect(h.sound).toHaveBeenCalledTimes(2);
  });

  it('plays the bigger adventure: a wall of planters, a circle, and a flower to fold', () => {
    expect(picker(render()).props.value).toBe('gentle'); expect(picker(render()).props.words).toBe(shared);
    picker(render()).props.onChange('explore');
    let tree = render();
    expect(picker(tree).props.value).toBe('explore'); expect(phase(tree)).toBe('ready');
    expect(board(tree).props.style['--rover-n']).toBe(4); expect(cells(tree)).toHaveLength(16); expect(one(tree, 'the stage', classed('rover-stage')).props['data-size']).toBe(4);
    // Floor 1: two signs, one of them already right.
    let level = levelFor('explore', 0);
    expect(pointing(tree, level)).toEqual(['n', 'n']); expect(buttons(tree)).toHaveLength(3); expect(bloom(tree)).toBeUndefined();
    expect(rover(tree).props).toMatchObject({ 'data-at': 12, 'data-heading': 'e', style: { '--rover-col': 0, '--rover-row': 3, '--rover-turn': 1 } });
    tree = solve(level, w); expect(done(tree)).toBe(1); expect(phase(tree)).toBe('plan');
    // Floor 2: straight on meets the wall of planters.
    level = levelFor('explore', 1);
    expect(nodes(tree).filter(classed('rover-planter')).map(n => [n.props['data-cell'], n.props.role, n.props['aria-label']])).toEqual([[6, 'img', w.planter], [10, 'img', w.planter]]);
    let sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ path: [4, 5], end: 'planter', at: 5 }); expect(status(tree)).toBe(w.ends.planter); expect(at(tree)).toBe(5); expect(hints(tree)).toEqual([]);
    // The rover is parked on the first sign; a change to the plan brings it home, so the sign shows.
    tree = point(0, 's'); expect(at(tree)).toBe(4); expect(status(tree)).toBe(roverLine(w.signNow, w.directions.s));
    sent = send(level, w); tree = sent.tree;
    // One turn is not enough: two signs now send the rover round and round, and the game says so and stops it.
    expect(sent.run).toMatchObject({ path: [4, 5, 9, 13, 9, 5], end: 'loop', at: 5 }); expect(phase(tree)).toBe('parked'); expect(status(tree)).toBe(w.ends.loop);
    expect(hints(tree)).toHaveLength(1); expect(sign(tree, 1).props).toMatchObject({ 'data-hint': true, 'aria-label': `${roverLine(w.sign, w.directions.n)} ${w.hintHere}` });
    tree = point(1, 'e'); sent = send(level, w);
    expect(sent.run.end).toBe('goal'); vi.advanceTimersByTime(ARRIVED_MS); tree = render(); expect(done(tree)).toBe(2);
    // Floor 3: three signs and a soft flower on the only way.
    level = levelFor('explore', 2);
    expect(buttons(tree)).toHaveLength(5);
    expect(bloom(tree)!.props).toMatchObject({ type: 'button', 'data-cell': 11, 'data-folded': false, 'aria-pressed': false, 'aria-label': w.bloomOpen, disabled: false, 'data-hint': false });
    expect(nodes(bloom(tree)).some(n => n.props.name === 'rover-bloom-open')).toBe(true);
    sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ end: 'edge', at: 3 }); expect(status(tree)).toBe(w.ends.edge);
    tree = point(1, 's'); sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ end: 'bloom', at: 7 }); expect(status(tree)).toBe(w.ends.bloom); expect(at(tree)).toBe(7);
    // The second parked run here: the flower itself is pointed out.
    expect(hints(tree)).toHaveLength(1); expect(bloom(tree)!.props).toMatchObject({ 'data-hint': true, 'aria-label': `${w.bloomOpen} ${w.hintHere}` });
    bloom(tree)!.props.onClick!(); tree = render();
    expect(bloom(tree)!.props).toMatchObject({ 'data-folded': true, 'aria-pressed': true, 'aria-label': w.bloomFolded, 'data-hint': false });
    expect(nodes(bloom(tree)).some(n => n.props.name === 'rover-bloom-folded')).toBe(true);
    expect(status(tree)).toBe(w.bloomNowFolded); expect(at(tree)).toBe(12); expect(phase(tree)).toBe('plan'); expect(heading(tree)).toBe(w.replan);
    // Opening it again is allowed, and the words say so.
    bloom(tree)!.props.onClick!(); tree = render();
    expect(status(tree)).toBe(w.bloomNowOpen); expect(bloom(tree)!.props).toMatchObject({ 'data-folded': false, 'aria-pressed': false });
    bloom(tree)!.props.onClick!(); tree = render(); expect(isFolded(tree)).toBe(true);
    sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ end: 'edge', at: 15 }); expect(status(tree)).toBe(w.ends.edge); expect(trail(tree)).toContain(11);
    expect(hints(tree)).toHaveLength(1); expect(sign(tree, 2).props['data-hint']).toBe(true);
    tree = point(2, 'w'); sent = send(level, w); tree = sent.tree;
    expect(sent.run).toMatchObject({ end: 'goal', at: 14 }); expect(phase(tree)).toBe('arrived'); expect(done(tree)).toBe(3); expect(rover(tree).props['data-heading']).toBe('w');
    vi.advanceTimersByTime(ARRIVED_MS); expect(finish(render())).toBeDefined();
    const sounds = h.sound.mock.calls.map(call => call[0]);
    expect(sounds.filter(sound => sound === 'correct')).toHaveLength(3); expect(sounds.filter(sound => sound === 'tryAgain')).toHaveLength(5);
  });

  it('finishes both adventures by changing only what the game points out', () => {
    for (const challenge of ['gentle', 'explore'] as const) {
      h.sound.mockClear(); picker(mount()).props.onChange(challenge);
      expect(finish(wander(challenge, w)), challenge).toBeDefined();
      const sounds = h.sound.mock.calls.map(call => call[0]);
      expect(sounds.filter(sound => sound === 'correct')).toHaveLength(ROVER_ROUNDS);
      expect(sounds.filter(sound => sound === 'tryAgain').length).toBeGreaterThanOrEqual(2 * ROVER_ROUNDS);
      expect(sounds.every(sound => sound === 'tap' || sound === 'correct' || sound === 'tryAgain')).toBe(true);
    }
  });

  it('starts again from the first floor on play again, and drops a run that is cut short', () => {
    const first = levelFor('gentle', 0);
    let tree = playOut('gentle', w);
    finish(tree)!.props.onPlayAgain(); tree = render();
    expect(finish(tree)).toBeUndefined(); expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.plan); expect(status(tree)).toBe(''); expect(done(tree)).toBe(0);
    expect(pointing(tree, first)).toEqual(initialSigns(first)); expect(at(tree)).toBe(first.start); expect(trail(tree)).toEqual([]); expect(hints(tree)).toEqual([]);
    expect(picker(tree).props.value).toBe('gentle'); expect(hero(tree).props).toMatchObject({ pose: 'idle', kick: 0, celebrate: false }); expect(h.tones.stop).toHaveBeenCalled();
    expect(finish(playOut('gentle', w))).toBeDefined();
    // The bigger adventure plays again as the bigger adventure, from its first floor.
    finish(render())!.props.onPlayAgain(); picker(render()).props.onChange('explore');
    tree = playOut('explore', w); finish(tree)!.props.onPlayAgain(); tree = render();
    expect(picker(tree).props.value).toBe('explore'); expect(board(tree).props.style['--rover-n']).toBe(4); expect(done(tree)).toBe(0);
    expect(pointing(tree, levelFor('explore', 0))).toEqual(['n', 'n']); expect(at(tree)).toBe(12); expect(bloom(tree)).toBeUndefined();
    // A new start in the middle of a run: nothing of the old run lands afterwards.
    const restart = picker(tree).props.onChange as (level: Challenge) => void;
    startButton(tree, w).props.onClick!(); tree = render(); expect(phase(tree)).toBe('drive');
    vi.advanceTimersByTime(STEP_MS); expect(at(render())).toBe(13);
    restart('gentle'); h.sound.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(30_000); tree = render();
    expect(phase(tree)).toBe('ready'); expect(at(tree)).toBe(6); expect(status(tree)).toBe(''); expect(done(tree)).toBe(0); expect(trail(tree)).toEqual([]);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
    // A new start after parked runs forgets them: no hint, the first prompt again.
    send(first, w); tree = send(first, w).tree; expect(hints(tree)).toHaveLength(1); expect(at(tree)).toBe(0);
    restart('gentle'); tree = render();
    expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.plan); expect(hints(tree)).toEqual([]); expect(at(tree)).toBe(6); expect(pointing(tree, first)).toEqual(['n']);
    expect(send(first, w).tree).toBeDefined(); expect(hints(render())).toEqual([]);
  });

  it('plays the whole game with sound off: the floor and the words carry it', () => {
    h.muted = true; h.tones.play.mockReturnValue(false);
    const told = new Set<string>(); let frames = 0;
    watch = seen => {
      if (finish(seen)) return;
      frames++; expect(prompt(seen).props.muted).toBe(true); expect(heading(seen)).not.toBe('');
      // Every parked run is named in text, with the one kind of thing to change.
      if (phase(seen) === 'parked') { expect(status(seen)).not.toBe(''); told.add(status(seen)); }
    };
    for (const challenge of ['gentle', 'explore'] as const) {
      picker(mount()).props.onChange(challenge);
      expect(finish(wander(challenge, w, true)), challenge).toBeDefined();
    }
    expect(h.say).not.toHaveBeenCalled(); expect(frames).toBeGreaterThan(60);
    expect([...told].sort()).toEqual([...Object.values(w.ends)].sort());
  });

  it('speaks only lines from the copy when sound is on, and stays quiet while the rover drives', () => {
    const level = levelFor('gentle', 0);
    let tree = render();
    expect(h.say).not.toHaveBeenCalled(); expect(prompt(tree).props.muted).toBe(false);
    vi.advanceTimersByTime(200); expect(h.say.mock.calls).toEqual([['child-a', w.plan, lang]]);
    // A whole run passes without a word, and the hear-it button is off for that beat.
    startButton(tree, w).props.onClick!(); tree = render();
    expect(prompt(tree).props.muted).toBe(true); prompt(tree).props.onHear();
    vi.advanceTimersByTime(STEP_MS * 3 - 1); render(); expect(h.say).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); tree = render(); expect(phase(tree)).toBe('parked'); expect(h.say).toHaveBeenCalledTimes(1);
    // Parked: the voice names what happened and the kind of thing to change.
    vi.advanceTimersByTime(200); expect(h.say.mock.calls.at(-1)).toEqual(['child-a', w.ends.edge, lang]);
    sign(tree, 0).props.onClick!(); tree = render(); vi.advanceTimersByTime(200);
    expect(h.say.mock.calls.at(-1)).toEqual(['child-a', roverLine(w.signNow, w.directions.e), lang]); expect(h.say).toHaveBeenCalledTimes(3);
    prompt(tree).props.onHear(); expect(h.say).toHaveBeenCalledTimes(4); expect(h.say.mock.calls.at(-1)).toEqual(['child-a', roverLine(w.signNow, w.directions.e), lang]);
    // Pep's welcome is a short beat carried by the picture: no line is cut off by the next floor.
    const sent = send(level, w);
    expect(phase(sent.tree)).toBe('arrived'); expect(prompt(sent.tree).props.muted).toBe(true); prompt(sent.tree).props.onHear();
    vi.advanceTimersByTime(ARRIVED_MS - 1); render(); expect(h.say).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(1); tree = render(); vi.advanceTimersByTime(200);
    expect(h.say).toHaveBeenCalledTimes(5); expect(h.say.mock.calls.at(-1)).toEqual(['child-a', w.plan, lang]);

    // Both adventures the long way round, listening to every line.
    const allowed = lines(lang);
    let quietFrom: number | null = null, quietBeats = 0;
    watch = seen => {
      // Nothing was said during the stretch of time that followed a driving or arriving frame.
      if (quietFrom !== null) { expect(h.say.mock.calls.length).toBe(quietFrom); quietBeats++; }
      quietFrom = !finish(seen) && (phase(seen) === 'drive' || phase(seen) === 'arrived') ? h.say.mock.calls.length : null;
    };
    for (const challenge of ['gentle', 'explore'] as const) {
      picker(mount()).props.onChange(challenge);
      expect(finish(wander(challenge, w, true)), challenge).toBeDefined();
    }
    watch = null; expect(quietBeats).toBeGreaterThan(20);
    const spoken = h.say.mock.calls.map(call => call[1] as string);
    expect(spoken).toEqual(expect.arrayContaining([w.plan, ...Object.values(w.ends), w.bloomNowFolded, w.bloomNowOpen]));
    expect(spoken).not.toContain(w.drive); expect(spoken).not.toContain(w.arrived);
    for (const call of h.say.mock.calls) { expect(call[0]).toBe('child-a'); expect(call[2]).toBe(lang); expect(allowed.has(call[1]), call[1]).toBe(true); }
    // A hush stops the voice; the game goes on.
    mount(); h.hush.forEach(fn => fn());
    expect(finish(playOut('gentle', w))).toBeDefined();
  });

  it('renders only words from the copy, in this language', () => {
    const allowed = lines(lang), all: string[] = [];
    watch = seen => {
      all.push(...shown(seen));
      for (const node of buttons(seen)) { expect(node.props.type).toBe('button'); expect(node.props['aria-label'], 'every control has a name').toBeTruthy(); }
      // The child's hero is on stage in every frame of play.
      if (!finish(seen)) expect(nodes(seen).filter(n => n.type === StudioPlayHero)).toHaveLength(1);
    };
    for (const challenge of ['gentle', 'explore'] as const) {
      picker(mount()).props.onChange(challenge);
      expect(finish(wander(challenge, w)), challenge).toBeDefined();
    }
    watch = null; expect(all.length).toBeGreaterThan(500);
    const unique = [...new Set(all)];
    for (const text of unique) { expect(allowed.has(text), text).toBe(true); expect(text).not.toMatch(/[{}]/); }
    for (const text of unique) { expect(text, text).not.toMatch(lang === 'he' ? /[A-Za-z]/ : /[א-ת]/); expect(unseen(text), text).toBe(false); }
    // The lines a child meets on the way are all there.
    expect(unique).toEqual(expect.arrayContaining([w.title, w.instruction, w.plan, w.start, w.drive, w.parked, w.replan, w.arrived, ...Object.values(w.ends),
      w.bloomOpen, w.bloomFolded, w.bloomNowFolded, w.bloomNowOpen, `${w.bloomOpen} ${w.hintHere}`, w.goal, w.planter, w.startMat, w.board, w.finishTitle, w.transfer, shared.again, shared.home]));
    for (const name of Object.values(w.directions)) { expect(unique).toContain(roverLine(w.sign, name)); expect(unique).toContain(roverLine(w.rover, name)); }
    expect(unique.filter(text => text.endsWith(` ${w.hintHere}`)).length).toBeGreaterThanOrEqual(3);
  });

  it('leaves no timer running when the game closes', () => {
    const level = levelFor('gentle', 0);
    render(); expect(vi.getTimerCount()).toBe(1);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(1);
    // Closed in the middle of a run.
    let tree = mount(); startButton(tree, w).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('drive'); expect(vi.getTimerCount()).toBeGreaterThanOrEqual(3);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(2);
    h.sound.mockClear(); h.say.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.say).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
    // Closed while the rover is parked, and while Pep and the rover are together.
    mount(); expect(phase(send(level, w).tree)).toBe('parked'); expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount(); expect(vi.getTimerCount()).toBe(0);
    mount(); point(0, 'e'); expect(phase(send(level, w).tree)).toBe('arrived'); expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(4);
    h.sound.mockClear(); h.say.mockClear();
    vi.advanceTimersByTime(60_000); expect(h.sound).not.toHaveBeenCalled(); expect(h.say).not.toHaveBeenCalled();
  });
});

describe('Rover Delivery words', () => {
  const en = ROVER_DELIVERY_COPY.en, he = ROVER_DELIVERY_COPY.he;
  /** Every line of one language by its key, the grouped ones as `ends.edge`. */
  function flat(w: RoverDeliveryWords): Record<string, string> {
    const all: Record<string, string> = {};
    for (const [key, value] of Object.entries(w)) {
      if (typeof value === 'string') all[key] = value;
      else for (const [inner, line] of Object.entries(value)) all[`${key}.${inner}`] = String(line);
    }
    return all;
  }
  it('carries every line in both languages, with the same blanks to fill', () => {
    const english = flat(en), hebrew = flat(he);
    expect(Object.keys(hebrew).sort()).toEqual(Object.keys(english).sort()); expect(Object.keys(english).length).toBeGreaterThan(30);
    for (const key of Object.keys(english)) {
      expect((hebrew[key].match(/\{\d\}/g) ?? []).sort(), key).toEqual((english[key].match(/\{\d\}/g) ?? []).sort());
      for (const value of [english[key], hebrew[key]]) { expect(value.length, key).toBeGreaterThan(0); expect(unseen(value), key).toBe(false); expect(value.trim(), key).toBe(value); }
      expect(hebrew[key], key).not.toMatch(/[A-Za-z]/); expect(english[key], key).not.toMatch(/[א-ת]/);
    }
    // One name for each heading of the floor, and one line for each way a run can park.
    expect(Object.keys(en.directions)).toEqual([...HEADINGS]); expect(Object.keys(he.directions)).toEqual([...HEADINGS]);
    expect(Object.keys(en.ends).sort()).toEqual(['bloom', 'edge', 'loop', 'planter']); expect(Object.keys(he.ends).sort()).toEqual(['bloom', 'edge', 'loop', 'planter']);
    for (const w of [en, he]) { expect(new Set(Object.values(w.directions)).size).toBe(4); expect(new Set(Object.values(w.ends)).size).toBe(4); }
  });
  it('keeps the tile words and the closing words of the brief', () => {
    expect(en.title).toBe('Rover Delivery'); expect(en.description).toBe('Plan the way. Fix one thing.');
    expect(en.instruction).toBe('Turn the signs so the rover reaches Pep, then press start.');
    expect(en.finishTitle).toBe('Delivered!'); expect(en.transfer).toBe('Try it for real: when something does not work, change one thing and try again.');
    expect(en.description.length).toBeLessThanOrEqual(32); expect(he.description.length).toBeLessThanOrEqual(32);
    expect(he.title).not.toMatch(/[A-Za-z]/); expect(he.title.length).toBeGreaterThan(0);
  });
  it('writes the lines of a plan', () => {
    expect(Object.values(en.directions)).toEqual(['up', 'right', 'down', 'left']);
    expect(roverLine(en.sign, en.directions.n)).toBe('Sign pointing up. Tap to turn.'); expect(roverLine(en.sign, en.directions.w)).toBe('Sign pointing left. Tap to turn.');
    expect(roverLine(en.signNow, en.directions.e)).toBe('The sign is pointing right.'); expect(roverLine(en.rover, en.directions.s)).toBe('The rover, facing down');
    expect(roverLine(he.sign, he.directions.e)).toBe('שלט שמצביע ימינה. נוגעים כדי לסובב.'); expect(roverLine(he.signNow, he.directions.n)).toBe('השלט מצביע למעלה.');
    // Each parked line says where the rover stopped and what kind of thing to change.
    expect(en.ends.edge).toBe('The rover parked at the edge. Which sign needs a turn?'); expect(en.ends.planter).toBe('The rover parked at the planter. Which sign needs a turn?');
    expect(en.ends.bloom).toBe('The rover parked at the flower. Fold the flower down or change the way.'); expect(en.ends.loop).toBe('The rover is going in circles. Turn one sign.');
    expect(roverLine('{0}{1}{2}', 'a')).toBe('a'); expect(roverLine('no blank', 'a')).toBe('no blank'); expect(roverLine('{0} and {0}', 'a')).toBe('a and a');
  });
});
