/** Wobbly Delivery through its real event handlers, without a browser. Layout,
 * focus, the hop animation and real audio timing remain a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', muted: false, hush: [] as (() => void)[],
  tones: { play: vi.fn((_step: number): boolean => true), stop: vi.fn(), dispose: vi.fn() }, say: vi.fn(), sound: vi.fn(),
  // The voice files: off unless a test turns them on, so the shared voice speaks as before.
  files: false, played: [] as [string, string][], voiceListeners: [] as ((state: { speaking: boolean }) => void)[],
  unlock: vi.fn(), stopFiles: vi.fn(), disposeFiles: vi.fn(), clipMs: (id: string) => 1000 + 37 * id.length }));
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
vi.mock('../../../../../lib/voice', () => ({ stopVoice: vi.fn(), isActive: () => false, voiceState: () => ({ speaking: false }),
  subscribeVoice: (fn: (state: { speaking: boolean }) => void) => { h.voiceListeners.push(fn); return () => {}; } }));
vi.mock('./bopTones', () => ({ createBopTones: () => h.tones }));
// The real voice player over a bank that records what it would play.
vi.mock('./wobblyDeliveryVoice', async original => {
  const actual = await original<typeof import('./wobblyDeliveryVoice')>();
  return { ...actual, createWobblyVoice: (lang: 'en' | 'he') => actual.createWobblyVoice(lang, {
    load: async () => h.files, unlock: h.unlock, stopVoice: h.stopFiles, dispose: h.disposeFiles,
    has: () => h.files, durationMs: (id: string) => (h.files ? h.clipMs(id) : 0),
    play: (id: string, opts?: { mode?: 'cut' | 'queue' }) => { h.played.push([id, opts?.mode ?? '']); return true; },
  }) };
});
import WobblyDelivery from './WobblyDelivery';
import { GameFinish, GameShell } from '../../../game/GameShell';
import { StudioPlayHero } from '../../StudioPlayHero';
import { AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import type { Challenge } from './adventureRules';
import { BopFriend, BopSprite } from './BopArt';
import { WOBBLY_DELIVERY_COPY, requestLine, type WobblyDeliveryWords } from './wobblyDeliveryCopy';
import { ASK_CARD_MS, ASK_HOLD_MS, BLOOM_MS, CARRY_MS, CARRY_STEP_MS, DELIVERY_FRIENDS, DELIVERY_ITEMS, DELIVERY_ROUNDS, DELIVERY_TILES, OOPS_MS, THANKS_MS, askMs, requestFor, requestLength, shelfFor, type DeliveryItem } from './wobblyDeliveryRules';
import { VOICE_DELAY_MS, VOICE_HOLD_MS, requestClips, voicePlan } from './wobblyDeliveryVoice';

type Words = WobblyDeliveryWords;
type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = WobblyDelivery(); h.effects.forEach(fn => fn()); return tree; }
/** What React does when the game closes: every effect cleans up. */
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
function mount() { unmount(); h.slots = []; return render(); }
function words(node: unknown): string { if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
function one(tree: unknown, what: string, test: (node: Node) => boolean): Node { const found = nodes(tree).find(test); expect(found, what).toBeDefined(); return found!; }
function button(tree: unknown, text: string) { return one(tree, text, n => n.type === 'button' && words(n.props.children) === text); }
const classed = (name: string) => (node: Node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(name);
const headingNode = (tree: unknown) => one(tree, 'the heading', n => 'focusKey' in n.props);
const heading = (tree: unknown) => words(headingNode(tree));
const finish = (tree: unknown) => nodes(tree).find(n => n.type === GameFinish);
const shell = (tree: unknown) => one(tree, 'the shell', n => n.type === GameShell);
const game = (tree: unknown) => one(tree, 'the game', n => n.props['data-adventure'] === 'delivery');
const phase = (tree: unknown): string => finish(tree) ? 'done' : game(tree).props['data-phase'];
const status = (tree: unknown) => words(one(tree, 'the status line', n => n.props.role === 'status'));
/** The first picture inside a box, by its sprite name. */
const picture = (box: Node): string | null => nodes(box).find(n => n.type === BopSprite)?.props.name ?? null;
const shelfItems = (tree: unknown) => nodes(tree).filter(classed('delivery-item'));
const onShelf = (tree: unknown): DeliveryItem[] => shelfItems(tree).map(n => n.props['data-item']);
const shelfItem = (tree: unknown, item: DeliveryItem) => one(tree, item, n => n.props['data-item'] === item);
const cards = (tree: unknown) => nodes(tree).filter(classed('delivery-card'));
/** What each request card shows: its thing, or null while it is face down or still to come. */
const pictures = (tree: unknown) => cards(tree).map(card => picture(card) as DeliveryItem | null);
const numerals = (tree: unknown) => cards(tree).map(card => words(card.props.children));
const rug = (tree: unknown) => one(tree, 'the rug', classed('delivery-landed'));
const landed = (tree: unknown): DeliveryItem[] => nodes(rug(tree)).filter(n => n.type === BopSprite).map(n => n.props.name);
const carried = (tree: unknown) => { const box = nodes(tree).find(classed('delivery-carried')); return box ? picture(box) : null; };
const hero = (tree: unknown) => one(tree, 'the hero', n => n.type === StudioPlayHero);
const heroStop = (tree: unknown): number => one(tree, 'the place of the hero', classed('delivery-hero')).props['data-stop'];
const friend = (tree: unknown) => one(tree, 'the friend', n => n.type === BopFriend);
const tiles = (tree: unknown) => nodes(tree).filter(classed('delivery-tile'));
const flower = (tree: unknown) => one(tree, 'the flower', classed('delivery-flower'));
const askAgain = (tree: unknown) => one(tree, 'ask again', classed('delivery-ask'));
const picker = (tree: unknown) => one(tree, 'the challenge picker', n => n.type === ChallengePicker);
const steps = (tree: unknown) => one(tree, 'the steps', n => n.type === AdventureSteps).props;
const quietLine = (tree: unknown, w: Words) => nodes(tree).some(n => n.props.className === 'adventure-quiet' && words(n) === w.quiet);
const sounds = () => h.sound.mock.calls.map(call => call[0] as string);

/** A replayable chance source: the same seed gives the same requests. */
function chance(seed: number): () => number { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }
function seeded(seed: number) { vi.spyOn(Math, 'random').mockImplementation(chance(seed)); }
/** Watches a friend ask, card by card, until the cards turn over; returns what they showed. */
function watch(): DeliveryItem[] {
  let tree = render(); expect(phase(tree)).toBe('ask');
  const count = cards(tree).length, reveal = ASK_CARD_MS * (count - 1);
  vi.advanceTimersByTime(reveal); tree = render();
  const request = pictures(tree); expect(request.every(name => name !== null)).toBe(true);
  vi.advanceTimersByTime(askMs(count, h.muted) - reveal); expect(phase(render())).toBe('fetch');
  return request as DeliveryItem[];
}
/** Taps a thing on the shelf and lets the hero carry it all the way to the rug. */
function carry(item: DeliveryItem) { shelfItem(render(), item).props.onClick!(); render(); vi.advanceTimersByTime(CARRY_MS); return render(); }

type Play = { fumble?: boolean; ask?: boolean };
type Mind = { request: DeliveryItem[]; asked: boolean };
/** One step of play through the real handlers, as a child would: watch the
 * cards, remember them, bring the next thing, or wait while the game shows
 * something. `fumble` taps another thing before every right one; `ask` asks
 * again once in every round. A child who does not remember asks again. */
function act(tree: unknown, w: Words, mind: Mind, how: Play): void {
  const now = phase(tree);
  if (now === 'ready') { button(tree, w.start).props.onClick!(); return; }
  if (now === 'ask') { const up = pictures(tree); if (up.every(name => name !== null)) mind.request = up as DeliveryItem[]; }
  if (now === 'thanks') { mind.request = []; mind.asked = false; }
  if (now !== 'fetch') { vi.advanceTimersToNextTimer(); return; }
  const next = mind.request[landed(tree).length];
  if (!next || (how.ask && !mind.asked)) { mind.asked = true; askAgain(tree).props.onClick!(); return; }
  const other = onShelf(tree).find(item => item !== next)!;
  shelfItem(tree, how.fumble && status(tree) !== w.notYet ? other : next).props.onClick!();
}
function playOut(w: Words, seen?: (tree: unknown) => void, how: Play = {}) {
  const mind: Mind = { request: [], asked: false };
  let tree = render(); seen?.(tree);
  for (let turn = 0; turn < 600 && !finish(tree); turn++) { act(tree, w, mind, how); tree = render(); seen?.(tree); }
  return tree;
}
function playUntil(w: Words, wanted: string) {
  const mind: Mind = { request: [], asked: false };
  let tree = render();
  for (let turn = 0; turn < 600 && phase(tree) !== wanted; turn++) { act(tree, w, mind, {}); tree = render(); }
  expect(phase(tree)).toBe(wanted); return tree;
}

function leaves(value: unknown): string[] { return typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(leaves) : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : []; }
/** Every order of `length` different things. */
function orders(length: number, from: readonly DeliveryItem[] = DELIVERY_ITEMS): DeliveryItem[][] {
  return length === 0 ? [[]] : from.flatMap(item => orders(length - 1, from.filter(other => other !== item)).map(rest => [item, ...rest]));
}
const ORDERS = [0, 1, 2, 3, 4].flatMap(length => orders(length));
/** Every line the game can put on screen in one language. */
function lines(lang: 'en' | 'he'): Set<string> {
  const w: Words = WOBBLY_DELIVERY_COPY[lang], shared = ADVENTURE_COPY[lang], all = new Set<string>(['', shared.again, shared.home, ...leaves(w)]);
  for (let at = 1; at <= 4; at++) {
    all.add(String(at)); all.add(`${w.card} ${at}: ${w.faceDown}`);
    for (const item of DELIVERY_ITEMS) all.add(`${w.card} ${at}: ${w.items[item]}`);
  }
  for (const item of DELIVERY_ITEMS) all.add(`${w.items[item]}. ${w.onRug}`);
  DELIVERY_FRIENDS.forEach((_, round) => {
    for (const order of ORDERS) {
      if (order.length >= 2) all.add(requestLine(w, round, order));
      all.add(`${w.rug[round]}: ${order.length ? order.map(item => w.items[item]).join(w.listJoin) : w.rugEmpty}`);
    }
  });
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
  h.files = false; h.played = []; h.voiceListeners = []; h.unlock.mockClear(); h.stopFiles.mockClear(); h.disposeFiles.mockClear();
  h.tones.play.mockClear(); h.tones.play.mockReturnValue(true); h.tones.stop.mockClear(); h.tones.dispose.mockClear(); h.say.mockClear(); h.sound.mockClear();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  unmount();
  if (vi.isMockFunction(Math.random)) vi.mocked(Math.random).mockRestore();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe.each(['en', 'he'] as const)('Wobbly Delivery (%s)', lang => {
  const w: Words = WOBBLY_DELIVERY_COPY[lang], shared = ADVENTURE_COPY[lang];
  beforeEach(() => { h.lang = lang; });

  it('brings three friends what they asked for, in order, through the real handlers', () => {
    const seed = lang === 'he' ? 23 : 5, dice = chance(seed);
    const planned = DELIVERY_FRIENDS.map((_, round) => requestFor('gentle', round, dice));
    seeded(seed);
    let tree = render();
    expect(shell(tree).props).toMatchObject({ fullBleed: true, autoNarrate: false, worldId: 'memory', title: w.title, instruction: w.instruction, hearIt: w.ready });
    expect(game(tree).props).toMatchObject({ className: 'adventure adventure--bop adventure--delivery', dir: lang === 'he' ? 'rtl' : 'ltr' });
    expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.ready); expect(status(tree)).toBe('');
    expect(one(tree, 'the scene', n => n.props.scene === 'scene-delivery')).toBeDefined();
    // The small shelf: four real buttons with names, none of them live before a friend has asked.
    expect(one(tree, 'the shelf', classed('delivery-shelf')).props).toMatchObject({ role: 'group', 'aria-label': w.shelf });
    expect(onShelf(tree)).toEqual(['item-can', 'item-journal', 'item-band', 'item-lamp']); expect(one(tree, 'the stage', classed('delivery-stage')).props['data-shelf']).toBe(4);
    expect(shelfItems(tree).every(n => n.type === 'button' && n.props.type === 'button' && n.props.disabled === true && n.props['aria-disabled'] === true)).toBe(true);
    expect(shelfItems(tree).map(n => n.props['aria-label'])).toEqual(onShelf(tree).map(item => w.items[item])); expect(shelfItems(tree).map(picture)).toEqual(onShelf(tree));
    expect(tiles(tree).map(picture)).toEqual([...DELIVERY_TILES]); expect(tiles(tree).every(n => n.props['data-lit'] === false && n.props['aria-hidden'] === 'true')).toBe(true);
    expect(flower(tree).props['data-open']).toBe(false); expect(nodes(flower(tree)).filter(n => n.type === BopSprite).map(n => n.props.name)).toEqual(['flower-folded', 'flower-open']);
    expect(friend(tree).props).toMatchObject({ friend: 'aya', mood: 'idle' }); expect(hero(tree).props).toMatchObject({ pose: 'idle', celebrate: false }); expect(heroStop(tree)).toBe(0);
    expect(cards(tree)).toHaveLength(0); expect(landed(tree)).toEqual([]); expect(carried(tree)).toBeNull();
    expect(rug(tree).props).toMatchObject({ role: 'img', 'aria-label': `${w.rug[0]}: ${w.rugEmpty}` });
    expect(steps(tree)).toMatchObject({ done: 0, total: DELIVERY_ROUNDS }); expect(picker(tree).props.value).toBe('gentle');
    expect(button(tree, w.start).props).toMatchObject({ type: 'button', 'aria-label': w.start }); expect(nodes(tree).some(classed('delivery-ask'))).toBe(false);
    vi.advanceTimersByTime(180); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]);

    button(tree, w.start).props.onClick!();
    const friends: string[] = [], requests: DeliveryItem[][] = [];
    for (let round = 0; round < DELIVERY_ROUNDS; round++) {
      const count = requestLength('gentle', round);
      tree = render();
      expect(phase(tree)).toBe('ask'); expect(nodes(tree).some(n => n.type === ChallengePicker)).toBe(false); friends.push(friend(tree).props.friend);
      expect(friend(tree).props.mood).toBe('idle'); expect(heroStop(tree)).toBe(0); expect(landed(tree)).toEqual([]); expect(onShelf(tree)).toEqual(shelfFor('gentle', round));
      expect(one(tree, 'the cards', classed('delivery-cards')).props).toMatchObject({ role: 'group', 'aria-label': w.cards });
      // The cards come one at a time, in the order to bring them; each keeps its numeral.
      for (let up = 1; up <= count; up++) {
        tree = render();
        expect(numerals(tree)).toEqual(Array.from({ length: count }, (_, at) => String(at + 1)));
        expect(pictures(tree).map(name => name !== null)).toEqual(Array.from({ length: count }, (_, at) => at < up));
        expect(cards(tree).map(card => card.props['data-waiting'] === true)).toEqual(Array.from({ length: count }, (_, at) => at >= up));
        if (up < count) vi.advanceTimersByTime(ASK_CARD_MS);
      }
      const request = pictures(tree) as DeliveryItem[]; requests.push(request);
      expect(request).toEqual(planned[round]);
      // The request is written in the heading and said aloud, in the same words.
      expect(heading(tree)).toBe(requestLine(w, round, request)); expect(shell(tree).props.hearIt).toBe(requestLine(w, round, request));
      expect(h.say).toHaveBeenLastCalledWith('child-a', requestLine(w, round, request), lang);
      expect(cards(tree).map(card => card.props['aria-label'])).toEqual(request.map((item, at) => `${w.card} ${at + 1}: ${w.items[item]}`));
      // The shelf waits while the friend is asking.
      expect(shelfItems(tree).every(n => n.props.disabled === true)).toBe(true); expect(askAgain(tree).props.disabled).toBe(true);
      shelfItem(tree, request[0]).props.onClick!(); expect(phase(render())).toBe('ask');
      vi.advanceTimersByTime(ASK_CARD_MS + ASK_HOLD_MS - 1); expect(phase(render())).toBe('ask');
      vi.advanceTimersByTime(1); tree = render();
      expect(phase(tree)).toBe('fetch'); expect(heading(tree)).toBe(w.fetchFirst[round]); expect(status(tree)).toBe('');
      // Face down, a card keeps its place and its numeral, and says so to a screen reader.
      expect(pictures(tree)).toEqual(request.map(() => null)); expect(numerals(tree)).toEqual(request.map((_, at) => String(at + 1)));
      expect(cards(tree).map(card => card.props['aria-label'])).toEqual(request.map((_, at) => `${w.card} ${at + 1}: ${w.faceDown}`));
      expect(cards(tree).map(card => card.props['data-next'])).toEqual(request.map((_, at) => at === 0));
      expect(shelfItems(tree).every(n => n.props.disabled === false && n.props['aria-disabled'] === false)).toBe(true);
      expect(askAgain(tree).props).toMatchObject({ type: 'button', disabled: false, 'aria-disabled': false, 'aria-label': w.askAgain, 'data-hint': false });
      request.forEach((item, at) => {
        h.tones.play.mockClear();
        shelfItem(render(), item).props.onClick!(); tree = render();
        // The hero lifts the thing, and the shelf keeps its print.
        expect(phase(tree)).toBe('carry'); expect(hero(tree).props.pose).toBe('hold-up'); expect(carried(tree)).toBe(item); expect(heroStop(tree)).toBe(0);
        expect(shelfItem(tree, item).props['data-away']).toBe(true); expect(headingNode(tree).props.muted).toBe(true);
        // Input is locked for the carry, without the buttons losing their place.
        expect(shelfItems(tree).every(n => n.props.disabled === false && n.props['aria-disabled'] === true)).toBe(true);
        expect(askAgain(tree).props).toMatchObject({ disabled: false, 'aria-disabled': true });
        shelfItems(tree).forEach(n => n.props.onClick!()); askAgain(tree).props.onClick!();
        // One hop a tile and one rising tone a tile, then the rug.
        for (let stop = 1; stop <= DELIVERY_TILES.length + 1; stop++) {
          vi.advanceTimersByTime(CARRY_STEP_MS); tree = render();
          expect(phase(tree)).toBe('carry'); expect(heroStop(tree)).toBe(stop); expect(carried(tree)).toBe(item);
          expect(tiles(tree).map(n => n.props['data-lit'])).toEqual(DELIVERY_TILES.map((_, tile) => tile + 1 === stop));
        }
        expect(h.tones.play.mock.calls).toEqual([[at], [at + 1], [at + 2]]); expect(landed(tree)).toEqual(request.slice(0, at));
        vi.advanceTimersByTime(CARRY_MS - CARRY_STEP_MS * (DELIVERY_TILES.length + 1)); tree = render();
        // It lands in the next free place on the rug, in the order it was brought.
        expect(landed(tree)).toEqual(request.slice(0, at + 1)); expect(carried(tree)).toBeNull();
        expect(rug(tree).props['aria-label']).toBe(`${w.rug[round]}: ${request.slice(0, at + 1).map(name => w.items[name]).join(w.listJoin)}`);
        expect(shelfItem(tree, item).props).toMatchObject({ 'data-away': true, 'aria-label': `${w.items[item]}. ${w.onRug}` });
        if (at === count - 1) return;
        expect(phase(tree)).toBe('fetch'); expect(heroStop(tree)).toBe(0); expect(hero(tree).props.pose).toBe('idle');
        expect(heading(tree)).toBe(count - at - 1 === 1 ? w.fetchLast : w.fetchNext);
        expect(pictures(tree)).toEqual(request.map((name, card) => card <= at ? name : null));
        expect(cards(tree).map(card => [card.props['data-done'], card.props['data-next']])).toEqual(request.map((_, card) => [card <= at, card === at + 1]));
      });
      // Everything asked for is here: the friend is happy, and the cards show what came.
      expect(phase(tree)).toBe('thanks'); expect(heading(tree)).toBe(w.thanks[round]); expect(friend(tree).props).toMatchObject({ friend: DELIVERY_FRIENDS[round], mood: 'happy' });
      expect(hero(tree).props.celebrate).toBe(true); expect(pictures(tree)).toEqual(request); expect(steps(tree).done).toBe(round + 1);
      expect(sounds().at(-1)).toBe('correct'); expect(shelfItems(tree).every(n => n.props.disabled === true)).toBe(true);
      vi.advanceTimersByTime(THANKS_MS - 1); expect(phase(render())).toBe('thanks');
      vi.advanceTimersByTime(1);
    }
    tree = render();
    expect(friends).toEqual([...DELIVERY_FRIENDS]); expect(requests.map(request => request.length)).toEqual([2, 2, 3]);
    expect(requests[1]).not.toEqual(requests[0]); expect(requests[2].slice(0, 2)).not.toEqual(requests[1]);
    // The folded flower opens once every friend has what they need.
    expect(phase(tree)).toBe('bloom'); expect(heading(tree)).toBe(w.bloom); expect(flower(tree).props['data-open']).toBe(true);
    expect(friend(tree).props).toMatchObject({ friend: 'chock', mood: 'happy' }); expect(steps(tree).done).toBe(DELIVERY_ROUNDS);
    vi.advanceTimersByTime(BLOOM_MS - 1); expect(finish(render())).toBeUndefined();
    vi.advanceTimersByTime(1); tree = render();
    const end = finish(tree)!; expect(end).toBeDefined();
    expect(end.props).toMatchObject({ title: w.finishTitle, subtitle: w.transfer, playAgainLabel: shared.again, homeLabel: shared.home });
    expect('creation' in end.props).toBe(false); expect(typeof end.props.onPlayAgain).toBe('function');
    expect(nodes(tree).some(n => n.props['data-adventure'] === 'delivery')).toBe(false); expect(shell(tree).props.hearIt).toBe(w.finishTitle);
    expect(vi.getTimerCount()).toBe(0);
    expect(sounds().filter(name => name === 'correct')).toHaveLength(DELIVERY_ROUNDS); expect(sounds().every(name => name === 'tap' || name === 'correct')).toBe(true);
    // Each request was said once.
    requests.forEach((request, round) => expect(h.say.mock.calls.filter(call => call[1] === requestLine(w, round, request))).toHaveLength(1));
  });

  it('finishes whatever the friends ask for, in both adventures', () => {
    for (const level of ['gentle', 'explore'] as const) for (let seed = 1; seed <= 5; seed++) {
      seeded(seed * 7919); h.sound.mockClear();
      picker(mount()).props.onChange(level);
      const brought: number[] = [];
      const tree = playOut(w, seen => {
        if (phase(seen) !== 'thanks') return;
        const things = landed(seen); brought.push(things.length);
        expect(new Set(things).size).toBe(things.length); expect(things.every(item => onShelf(seen).includes(item))).toBe(true);
      }, { fumble: seed % 2 === 0 });
      expect(finish(tree), `${level} ${seed}`).toBeDefined();
      expect(brought).toEqual(DELIVERY_FRIENDS.map((_, round) => requestLength(level, round)));
      expect(sounds().filter(name => name === 'correct')).toHaveLength(DELIVERY_ROUNDS);
    }
  });

  it('a tap on another thing changes nothing, says so kindly, and never blocks the right one', () => {
    seeded(11);
    button(render(), w.start).props.onClick!();
    const request = watch(); let tree = render();
    const spare = shelfFor('gentle', 0).filter(item => !request.includes(item));
    h.sound.mockClear(); h.say.mockClear();
    shelfItem(tree, spare[0]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('fetch'); expect(landed(tree)).toEqual([]); expect(steps(tree).done).toBe(0); expect(finish(tree)).toBeUndefined();
    expect(status(tree)).toBe(w.notYet); expect(heading(tree)).toBe(w.fetchFirst[0]); expect(shell(tree).props.hearIt).toBe(w.notYet);
    expect(shelfItem(tree, spare[0]).props['data-wobble']).toBe(true); expect(shelfItem(tree, request[0]).props['data-wobble']).toBe(false);
    expect(hero(tree).props.pose).toBe('oops'); expect(heroStop(tree)).toBe(0); expect(sounds()).toEqual(['tryAgain']); expect(h.tones.play).not.toHaveBeenCalled();
    // Nothing locks and nothing is taken away: the shelf stays live, and Ask again is pointed out.
    expect(shelfItems(tree).every(n => n.props.disabled === false && n.props['aria-disabled'] === false)).toBe(true);
    expect(askAgain(tree).props).toMatchObject({ disabled: false, 'aria-disabled': false, 'data-hint': true });
    expect(pictures(tree)).toEqual([null, null]);
    vi.advanceTimersByTime(180); expect(h.say.mock.calls).toEqual([['child-a', w.notYet, lang]]);
    vi.advanceTimersByTime(OOPS_MS - 180 - 1); expect(hero(render()).props.pose).toBe('oops');
    vi.advanceTimersByTime(1); tree = render();
    expect(hero(tree).props.pose).toBe('idle'); expect(shelfItem(tree, spare[0]).props['data-wobble']).toBe(false); expect(status(tree)).toBe(w.notYet); expect(phase(tree)).toBe('fetch');
    // The right thing still works.
    tree = carry(request[0]);
    expect(landed(tree)).toEqual([request[0]]); expect(status(tree)).toBe(''); expect(askAgain(tree).props['data-hint']).toBe(false);
    // A thing that is already on the rug: the same kind answer, and nothing moves.
    h.sound.mockClear();
    shelfItem(tree, request[0]).props.onClick!(); tree = render();
    expect(landed(tree)).toEqual([request[0]]); expect(status(tree)).toBe(w.notYet); expect(shelfItem(tree, request[0]).props['data-wobble']).toBe(true);
    expect(hero(tree).props.pose).toBe('oops'); expect(sounds()).toEqual(['tryAgain']); expect(pictures(tree)).toEqual([request[0], null]);
    // No waiting: the next thing can be carried while the hero is still shrugging.
    shelfItem(tree, request[1]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('carry'); expect(hero(tree).props.pose).toBe('hold-up'); expect(status(tree)).toBe(''); expect(shelfItem(tree, request[0]).props['data-wobble']).toBe(false);
    vi.advanceTimersByTime(CARRY_MS); tree = render(); expect(phase(tree)).toBe('thanks'); expect(steps(tree).done).toBe(1);
    vi.advanceTimersByTime(THANKS_MS);
    // Any number of other taps, and any wait: the round neither ends nor locks.
    const second = watch(); h.sound.mockClear();
    for (let tap = 0; tap < 12; tap++) for (const item of shelfFor('gentle', 1)) {
      if (item === second[0]) continue;
      shelfItem(render(), item).props.onClick!(); vi.advanceTimersByTime(tap % 2 ? 50 : OOPS_MS);
    }
    vi.advanceTimersByTime(120_000); tree = render();
    expect(phase(tree)).toBe('fetch'); expect(landed(tree)).toEqual([]); expect(steps(tree).done).toBe(1); expect(finish(tree)).toBeUndefined(); expect(status(tree)).toBe(w.notYet);
    expect(shelfItems(tree).every(n => n.props.disabled === false && n.props['aria-disabled'] === false)).toBe(true);
    expect(sounds()).toHaveLength(12 * 3); expect(sounds().every(name => name === 'tryAgain')).toBe(true);
    for (const item of second) tree = carry(item);
    expect(phase(tree)).toBe('thanks'); expect(steps(tree).done).toBe(2); expect(landed(tree)).toEqual(second);
  });

  it('finishes a whole game with another thing tapped before every right one', () => {
    seeded(41);
    const tree = playOut(w, undefined, { fumble: true });
    expect(finish(tree)).toBeDefined();
    expect(sounds().filter(name => name === 'correct')).toHaveLength(DELIVERY_ROUNDS);
    expect(sounds().filter(name => name === 'tryAgain')).toHaveLength(2 + 2 + 3);
    expect(sounds().every(name => name === 'tap' || name === 'correct' || name === 'tryAgain')).toBe(true);
  });

  it('asks again as often as it likes: the cards come back, the request is said again, nothing is lost', () => {
    seeded(3);
    button(render(), w.start).props.onClick!();
    const request = watch(); let tree = render();
    expect(pictures(tree)).toEqual([null, null]);
    h.say.mockClear(); h.sound.mockClear();
    askAgain(tree).props.onClick!(); tree = render();
    // All the cards at once this time, and the same words in the heading.
    expect(phase(tree)).toBe('ask'); expect(pictures(tree)).toEqual(request); expect(heading(tree)).toBe(requestLine(w, 0, request)); expect(status(tree)).toBe('');
    expect(shelfItems(tree).every(n => n.props.disabled === true)).toBe(true); expect(askAgain(tree).props.disabled).toBe(true); expect(sounds()).toEqual(['tap']);
    vi.advanceTimersByTime(180); expect(h.say.mock.calls).toEqual([['child-a', requestLine(w, 0, request), lang]]);
    vi.advanceTimersByTime(askMs(2, false) - 180 - 1); expect(phase(render())).toBe('ask');
    vi.advanceTimersByTime(1); tree = render();
    expect(phase(tree)).toBe('fetch'); expect(status(tree)).toBe(w.goodAsking); expect(pictures(tree)).toEqual([null, null]); expect(landed(tree)).toEqual([]); expect(steps(tree).done).toBe(0);
    expect(askAgain(tree).props).toMatchObject({ disabled: false, 'data-hint': false });
    vi.advanceTimersByTime(180); expect(h.say).toHaveBeenLastCalledWith('child-a', w.goodAsking, lang);
    // Again after a delivery: what is on the rug stays there.
    tree = carry(request[0]); expect(landed(tree)).toEqual([request[0]]); expect(status(tree)).toBe('');
    askAgain(tree).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('ask'); expect(pictures(tree)).toEqual(request); expect(landed(tree)).toEqual([request[0]]); expect(cards(tree).map(card => card.props['data-done'])).toEqual([true, false]);
    vi.advanceTimersByTime(askMs(2, false)); tree = render();
    expect(phase(tree)).toBe('fetch'); expect(status(tree)).toBe(w.goodAsking); expect(pictures(tree)).toEqual([request[0], null]); expect(sounds()).not.toContain('tryAgain');
    // Two taps on other things in one round: the cards stay face up, and nothing more is said about it.
    const spare = shelfFor('gentle', 0).filter(item => !request.includes(item));
    shelfItem(tree, spare[0]).props.onClick!(); tree = render(); expect(pictures(tree)).toEqual([request[0], null]);
    shelfItem(tree, spare[1]).props.onClick!(); tree = render();
    expect(pictures(tree)).toEqual(request); expect(cards(tree).map(card => card.props['data-up'])).toEqual([true, true]); expect(status(tree)).toBe(w.notYet); expect(phase(tree)).toBe('fetch');
    expect(cards(tree).map(card => card.props['aria-label'])).toEqual(request.map((item, at) => `${w.card} ${at + 1}: ${w.items[item]}`));
    vi.advanceTimersByTime(60_000); expect(pictures(render())).toEqual(request);
    // Asking is still there, and the cards are still up afterwards.
    askAgain(render()).props.onClick!(); vi.advanceTimersByTime(askMs(2, false)); tree = render();
    expect(phase(tree)).toBe('fetch'); expect(pictures(tree)).toEqual(request);
    tree = carry(request[1]); expect(phase(tree)).toBe('thanks'); expect(landed(tree)).toEqual(request);
    vi.advanceTimersByTime(THANKS_MS);
    // The next friend's cards turn over again.
    const second = watch(); tree = render();
    expect(friend(tree).props.friend).toBe('pep'); expect(pictures(tree)).toEqual(second.map(() => null));
  });

  it('starts over from the first friend on play again, and drops a game that is cut short', () => {
    seeded(9);
    let tree = playOut(w);
    finish(tree)!.props.onPlayAgain(); tree = render();
    expect(finish(tree)).toBeUndefined(); expect(phase(tree)).toBe('ready'); expect(heading(tree)).toBe(w.ready); expect(status(tree)).toBe('');
    expect(friend(tree).props).toMatchObject({ friend: 'aya', mood: 'idle' }); expect(steps(tree).done).toBe(0); expect(landed(tree)).toEqual([]); expect(cards(tree)).toHaveLength(0);
    expect(flower(tree).props['data-open']).toBe(false); expect(heroStop(tree)).toBe(0); expect(hero(tree).props).toMatchObject({ pose: 'idle', celebrate: false });
    expect(onShelf(tree)).toEqual(shelfFor('gentle', 0)); expect(picker(tree).props.value).toBe('gentle'); expect(h.tones.stop).toHaveBeenCalled();
    expect(finish(playOut(w))).toBeDefined();
    // A new start in the middle of a carry, with a wobble under way: nothing of the old game lands afterwards.
    finish(render())!.props.onPlayAgain(); tree = render();
    const restart = picker(tree).props.onChange as (level: Challenge) => void;
    button(tree, w.start).props.onClick!();
    const request = watch(), spare = shelfFor('gentle', 0).find(item => !request.includes(item))!;
    shelfItem(render(), spare).props.onClick!(); shelfItem(render(), request[0]).props.onClick!(); expect(phase(render())).toBe('carry');
    vi.advanceTimersByTime(CARRY_STEP_MS * 2);
    restart('gentle'); h.sound.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(30_000); tree = render();
    expect(phase(tree)).toBe('ready'); expect(landed(tree)).toEqual([]); expect(steps(tree).done).toBe(0); expect(heroStop(tree)).toBe(0); expect(carried(tree)).toBeNull(); expect(status(tree)).toBe('');
    expect(h.sound).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
  });

  it('plays the bigger adventure: six things on the shelf and longer requests', () => {
    seeded(7);
    const choice = picker(render()); expect(choice.props.value).toBe('gentle'); expect(choice.props.words).toBe(shared);
    choice.props.onChange('explore');
    let tree = render();
    expect(picker(tree).props.value).toBe('explore'); expect(phase(tree)).toBe('ready');
    expect(onShelf(tree)).toEqual([...DELIVERY_ITEMS]); expect(one(tree, 'the stage', classed('delivery-stage')).props['data-shelf']).toBe(6);
    const brought = new Map<string, DeliveryItem[]>();
    tree = playOut(w, seen => {
      if (finish(seen)) return;
      expect(onShelf(seen)).toEqual([...DELIVERY_ITEMS]);
      // The picker is only there before the first friend asks.
      expect(nodes(seen).some(n => n.type === ChallengePicker)).toBe(phase(seen) === 'ready');
      if (phase(seen) === 'thanks') brought.set(friend(seen).props.friend, landed(seen));
    });
    expect(finish(tree)).toBeDefined();
    expect(DELIVERY_FRIENDS.map(name => brought.get(name)?.length)).toEqual([3, 3, 4]);
    for (const things of brought.values()) expect(new Set(things).size).toBe(things.length);
    // Three tones a carry; the fourth thing of the last request reaches the top of the scale.
    const tones = h.tones.play.mock.calls.map(call => call[0]);
    expect(tones).toHaveLength(3 * (3 + 3 + 4)); expect(Math.min(...tones)).toBe(0); expect(Math.max(...tones)).toBe(5); expect(tones.slice(-3)).toEqual([3, 4, 5]);
  });

  it('plays the whole game with sound off: the cards carry the request, and stay up half as long again', () => {
    h.muted = true; h.tones.play.mockReturnValue(false); seeded(17);
    let tree = render();
    expect(quietLine(tree, w)).toBe(true); expect(headingNode(tree).props.muted).toBe(true); expect(vi.getTimerCount()).toBe(0);
    button(tree, w.start).props.onClick!(); vi.advanceTimersByTime(ASK_CARD_MS); tree = render();
    const request = pictures(tree) as DeliveryItem[];
    // The whole request is on the cards: a picture, a numeral in text and a name each, in order, and written above.
    expect(numerals(tree)).toEqual(['1', '2']); expect(nodes(tree).filter(classed('bop-chip'))).toHaveLength(2);
    expect(cards(tree).map(card => card.props['aria-label'])).toEqual(request.map((item, at) => `${w.card} ${at + 1}: ${w.items[item]}`));
    expect(heading(tree)).toBe(requestLine(w, 0, request));
    // Still up when a game with sound would have turned them over.
    expect(askMs(2, true)).toBe(askMs(2, false) * 1.5);
    vi.advanceTimersByTime(askMs(2, false) - ASK_CARD_MS); tree = render(); expect(phase(tree)).toBe('ask'); expect(pictures(tree)).toEqual(request);
    vi.advanceTimersByTime(askMs(2, true) - askMs(2, false) - 1); expect(phase(render())).toBe('ask');
    vi.advanceTimersByTime(1); tree = render(); expect(phase(tree)).toBe('fetch'); expect(pictures(tree)).toEqual([null, null]);
    // Asking again shows them for the longer time too.
    askAgain(tree).props.onClick!(); vi.advanceTimersByTime(askMs(2, false)); tree = render(); expect(phase(tree)).toBe('ask'); expect(pictures(tree)).toEqual(request);
    vi.advanceTimersByTime(askMs(2, true) - askMs(2, false)); tree = render(); expect(phase(tree)).toBe('fetch'); expect(status(tree)).toBe(w.goodAsking);
    const quiet: boolean[] = [];
    tree = playOut(w, seen => {
      if (finish(seen)) return;
      quiet.push(quietLine(seen, w)); expect(headingNode(seen).props.muted).toBe(true);
    }, { fumble: true });
    expect(finish(tree)).toBeDefined(); expect(h.say).not.toHaveBeenCalled();
    expect(quiet.length).toBeGreaterThan(30); expect(quiet.every(Boolean)).toBe(true);
    expect(sounds().filter(name => name === 'correct')).toHaveLength(DELIVERY_ROUNDS);
  });

  it('speaks only lines from the copy when sound is on, and keeps quiet while the hero carries', () => {
    seeded(17);
    let tree = render();
    expect(quietLine(tree, w)).toBe(false); expect(nodes(tree).some(n => n.props.className === 'adventure-quiet')).toBe(false);
    expect(headingNode(tree).props.muted).toBe(false); expect(h.say).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]);
    // The hear-it button says the line on screen again.
    headingNode(tree).props.onHear(); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang], ['child-a', w.ready, lang]]);
    const allowed = lines(lang);
    let saidBefore: number | null = null, quietBeats = 0;
    tree = playOut(w, seen => {
      // Nothing was said in the time that followed a carry, a happy friend or the opening flower.
      if (saidBefore !== null) { expect(h.say.mock.calls.length).toBe(saidBefore); quietBeats++; }
      saidBefore = ['carry', 'thanks', 'bloom'].includes(phase(seen)) ? h.say.mock.calls.length : null;
    }, { ask: true });
    expect(finish(tree)).toBeDefined(); expect(quietBeats).toBeGreaterThan(20);
    expect(h.say.mock.calls.length).toBeGreaterThanOrEqual(2 + 2 * DELIVERY_ROUNDS);
    for (const call of h.say.mock.calls) { expect(call[0]).toBe('child-a'); expect(call[2]).toBe(lang); expect(allowed.has(call[1]), call[1]).toBe(true); }
    // A hush stops the voice; the game goes on.
    seeded(3); tree = mount(); h.hush.forEach(fn => fn());
    expect(finish(playOut(w))).toBeDefined();
  });

  it('renders only words from the copy, in this language', () => {
    seeded(29);
    const allowed = lines(lang), all: string[] = [];
    const tree = playOut(w, seen => {
      all.push(...shown(seen));
      for (const node of nodes(seen).filter(n => n.type === 'button')) {
        expect(node.props.type).toBe('button');
        expect(node.props['aria-label'], 'every control has a name').toBeTruthy();
      }
      for (const node of nodes(seen).filter(n => n.props.role === 'img' || n.props.role === 'group')) expect(node.props['aria-label'], 'every picture and group has a name').toBeTruthy();
    }, { fumble: true, ask: true });
    expect(finish(tree)).toBeDefined(); expect(all.length).toBeGreaterThan(500);
    const unique = [...new Set(all)];
    for (const text of unique) { expect(allowed.has(text), text).toBe(true); expect(text, text).not.toMatch(lang === 'he' ? /[A-Za-z]/ : /[א-ת]/); expect(unseen(text), text).toBe(false); }
    // The lines a child meets on the way are all there.
    expect(unique).toEqual(expect.arrayContaining([w.title, w.instruction, w.ready, w.start, w.shelf, w.cards, w.askAgain, w.notYet, w.goodAsking, w.fetchNext, w.fetchLast, w.bloom,
      w.finishTitle, w.transfer, shared.again, shared.home, ...w.fetchFirst, ...w.thanks, ...w.rug.map(name => `${name}: ${w.rugEmpty}`), '1', '2', '3']));
    expect(unique.filter(text => w.asks.some(start => text.startsWith(start)))).toHaveLength(DELIVERY_ROUNDS);
  });

  it('leaves no timer running when the game closes', () => {
    seeded(2);
    render(); expect(vi.getTimerCount()).toBe(1);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(1);
    // Closed while the cards are still turning up.
    button(mount(), w.start).props.onClick!(); let tree = render();
    expect(phase(tree)).toBe('ask'); expect(vi.getTimerCount()).toBe(3);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(2);
    // Closed with a wobble under way.
    button(mount(), w.start).props.onClick!();
    let request = watch(), spare = shelfFor('gentle', 0).find(item => !request.includes(item))!;
    shelfItem(render(), spare).props.onClick!(); tree = render();
    expect(hero(tree).props.pose).toBe('oops'); expect(vi.getTimerCount()).toBe(2);
    unmount(); expect(vi.getTimerCount()).toBe(0);
    // Closed in the middle of a carry.
    button(mount(), w.start).props.onClick!();
    request = watch(); spare = shelfFor('gentle', 0).find(item => !request.includes(item))!;
    shelfItem(render(), spare).props.onClick!(); shelfItem(render(), request[0]).props.onClick!(); tree = render();
    expect(phase(tree)).toBe('carry'); expect(vi.getTimerCount()).toBe(DELIVERY_TILES.length + 2);
    vi.advanceTimersByTime(CARRY_STEP_MS);
    unmount(); expect(vi.getTimerCount()).toBe(0); expect(h.tones.dispose).toHaveBeenCalledTimes(4);
    h.sound.mockClear(); h.say.mockClear(); h.tones.play.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(h.sound).not.toHaveBeenCalled(); expect(h.say).not.toHaveBeenCalled(); expect(h.tones.play).not.toHaveBeenCalled();
    // Closed while a friend is happy, and while the flower opens.
    for (const wanted of ['thanks', 'bloom']) {
      mount(); playUntil(w, wanted); expect(vi.getTimerCount()).toBe(1);
      unmount(); expect(vi.getTimerCount()).toBe(0);
    }
  });

  it('speaks from the files once they are there: each card turns up as its thing is named, and stays up past the last word', () => {
    h.files = true;
    const seed = 11, planned = requestFor('gentle', 0, chance(seed)); seeded(seed);
    let tree = render();
    // The files are still on their way when the game opens: the first line comes from the shared voice.
    vi.advanceTimersByTime(180); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]); expect(h.played).toEqual([]);
    button(tree, w.start).props.onClick!(); tree = render();
    expect(h.unlock).toHaveBeenCalledTimes(1); expect(phase(tree)).toBe('ask'); expect(pictures(tree)).toEqual([planned[0], null]);
    const ids = requestClips(0, planned), plan = voicePlan(ids, h.clipMs)!;
    vi.advanceTimersByTime(VOICE_DELAY_MS - 1); expect(h.played).toEqual([]);
    vi.advanceTimersByTime(1); expect(h.played).toEqual([[ids[0], 'cut']]);
    // The second card waits for its own words, not for the fixed beat.
    vi.advanceTimersByTime(plan.starts[1] - 1); expect(pictures(render())).toEqual([planned[0], null]);
    vi.advanceTimersByTime(1); expect(pictures(render())).toEqual(planned); expect(h.played).toEqual([[ids[0], 'cut'], [ids[1], 'queue']]);
    // Face down only after the last word and a breath, even when that is later than the beat.
    const up = VOICE_DELAY_MS + plan.endMs + VOICE_HOLD_MS; expect(up).toBeGreaterThan(askMs(2, false));
    vi.advanceTimersByTime(up - VOICE_DELAY_MS - plan.starts[1] - 1); expect(phase(render())).toBe('ask');
    vi.advanceTimersByTime(1); tree = render(); expect(phase(tree)).toBe('fetch'); expect(pictures(tree)).toEqual([null, null]);
    vi.advanceTimersByTime(VOICE_DELAY_MS); expect(h.played.at(-1)).toEqual([`fetch-first-${DELIVERY_FRIENDS[0]}`, 'cut']);
    // Another thing: "not that one yet", from the files too; the heading's hear-it says it again at once.
    const spare = shelfFor('gentle', 0).find(item => !planned.includes(item))!;
    shelfItem(tree, spare).props.onClick!(); tree = render(); expect(status(tree)).toBe(w.notYet);
    vi.advanceTimersByTime(VOICE_DELAY_MS); expect(h.played.at(-1)).toEqual(['not-yet', 'cut']);
    const before = h.played.length; h.stopFiles.mockClear();
    headingNode(tree).props.onHear(); vi.advanceTimersByTime(0);
    expect(h.stopFiles).toHaveBeenCalled(); expect(h.played.slice(before)).toEqual([['not-yet', 'cut']]);
    // The shared voice said nothing after the opening line.
    expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]);
    // The whole game plays through on the files (this child taps at once, so the short prompts never start).
    tree = playOut(w, undefined, { ask: true, fumble: true });
    expect(finish(tree)).toBeDefined(); expect(h.say.mock.calls).toEqual([['child-a', w.ready, lang]]);
    for (const name of DELIVERY_FRIENDS) expect(h.played.some(([id, mode]) => id.startsWith(`${name}-item-`) && mode === 'cut'), name).toBe(true);
    expect(h.played.every(([id]) => /^(?:line-ready|fetch-(?:next|last|first-\w+)|not-yet|good-asking|\w+-item-[\w]+|then-item-\w+|last-item-\w+)$/.test(id))).toBe(true);
  });

  it('asks again from the files: the request, then "good asking"', () => {
    h.files = true; seeded(4);
    let tree = playUntil(w, 'fetch'); h.played = [];
    askAgain(tree).props.onClick!(); tree = render();
    const request = pictures(tree) as DeliveryItem[], ids = requestClips(0, request), plan = voicePlan(ids, h.clipMs)!;
    vi.advanceTimersByTime(VOICE_DELAY_MS + plan.endMs); expect(h.played).toEqual(ids.map((id, at) => [id, at === 0 ? 'cut' : 'queue']));
    vi.advanceTimersByTime(VOICE_HOLD_MS); tree = render(); expect(phase(tree)).toBe('fetch'); expect(status(tree)).toBe(w.goodAsking);
    vi.advanceTimersByTime(VOICE_DELAY_MS); expect(h.played.at(-1)).toEqual(['good-asking', 'cut']);
    expect(h.say).not.toHaveBeenCalledWith('child-a', requestLine(w, 0, request), lang);
  });

  it('keeps the files quiet with sound off, on the quiet timing', () => {
    h.files = true; h.muted = true; seeded(17);
    const tree = render(); button(tree, w.start).props.onClick!(); render();
    vi.advanceTimersByTime(askMs(2, true) - 1); expect(phase(render())).toBe('ask');
    vi.advanceTimersByTime(1); expect(phase(render())).toBe('fetch');
    expect(finish(playOut(w, undefined, { fumble: true, ask: true }))).toBeDefined();
    expect(h.played).toEqual([]); expect(h.say).not.toHaveBeenCalled();
  });

  it('stops the files when the game closes, plays again, or the Kid Mode bar speaks', () => {
    h.files = true; seeded(6);
    button(render(), w.start).props.onClick!(); render();
    vi.advanceTimersByTime(VOICE_DELAY_MS); expect(h.played).toHaveLength(1);
    // The bar's hear-it uses the shared voice: a line from files stops for it.
    h.stopFiles.mockClear(); h.voiceListeners.forEach(fn => fn({ speaking: false })); expect(h.stopFiles).not.toHaveBeenCalled();
    h.voiceListeners.forEach(fn => fn({ speaking: true })); expect(h.stopFiles).toHaveBeenCalled();
    // Leaving mid-request: the voice stops, nothing more is said, and the player is let go.
    unmount(); expect(h.disposeFiles).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000); expect(h.played).toHaveLength(1);
    // A new start mid-request: the rest of the old request is never heard, only the new opening line.
    const tree = mount(), restart = picker(tree).props.onChange as (level: Challenge) => void;
    button(tree, w.start).props.onClick!(); render();
    vi.advanceTimersByTime(VOICE_DELAY_MS); expect(h.played).toHaveLength(2);
    h.stopFiles.mockClear(); restart('gentle'); expect(h.stopFiles).toHaveBeenCalled(); render();
    vi.advanceTimersByTime(60_000); expect(h.played.slice(2)).toEqual([['line-ready', 'cut']]);
  });
});

describe('Wobbly Delivery words', () => {
  const en = WOBBLY_DELIVERY_COPY.en, he = WOBBLY_DELIVERY_COPY.he;
  /** The outline of the copy: the same keys, lists and things in both languages. */
  function shape(value: unknown): unknown {
    if (typeof value === 'string') return 'words';
    if (Array.isArray(value)) return value.map(shape);
    return value && typeof value === 'object' ? Object.keys(value).sort().map(key => [key, shape((value as Record<string, unknown>)[key])]) : value;
  }
  it('carries every line in both languages', () => {
    expect(shape(he)).toEqual(shape(en));
    expect(Object.keys(en.items).sort()).toEqual([...DELIVERY_ITEMS].sort()); expect(Object.keys(en.things).sort()).toEqual([...DELIVERY_ITEMS].sort());
    for (const list of [en.asks, en.fetchFirst, en.thanks, en.rug]) expect(list).toHaveLength(DELIVERY_ROUNDS);
    for (const value of [...leaves(en), ...leaves(he)]) { expect(value.length).toBeGreaterThan(0); expect(unseen(value), value).toBe(false); }
    for (const value of leaves(he)) expect(value, value).not.toMatch(/[A-Za-z]/);
    for (const value of leaves(en)) expect(value, value).not.toMatch(/[א-ת]/);
    expect(leaves(en)).toHaveLength(leaves(he).length); expect(new Set(Object.values(en.items)).size).toBe(DELIVERY_ITEMS.length); expect(new Set(Object.values(he.items)).size).toBe(DELIVERY_ITEMS.length);
  });
  it('keeps the tile words and the closing words of the brief', () => {
    expect(en.title).toBe('Wobbly Delivery'); expect(en.description).toBe('Listen. Remember. Deliver.');
    expect(en.instruction).toBe('Listen to what a friend needs, then bring each thing in order.');
    expect(en.finishTitle).toBe('Delivered!'); expect(en.transfer).toBe('Try it for real: ask a grown-up for two things to bring, and carry them in order.');
    expect(en.notYet).toBe('Not that one yet. You can ask again.'); expect(en.askAgain).toBe('Ask again'); expect(en.goodAsking).toBe('Good asking.');
    expect(en.description.length).toBeLessThanOrEqual(32); expect(he.description.length).toBeLessThanOrEqual(32);
  });
  it('writes a request as one sentence, in the order to bring it', () => {
    expect(requestLine(en, 0, ['item-can', 'item-lamp'])).toBe('Aya needs the watering can, then the lamp.');
    expect(requestLine(en, 1, ['item-band', 'item-cushion', 'item-disc'])).toBe('Pep needs the flower band, then the cushion, then the blue disc.');
    expect(requestLine(en, 2, ['item-journal', 'item-disc', 'item-can', 'item-lamp'])).toBe('Chock needs the journal, then the blue disc, then the watering can, then the lamp.');
    expect(requestLine(he, 0, ['item-can', 'item-lamp'])).toBe('מביאים לאיה את המשפך, ואחר כך את המנורה.');
    expect(requestLine(he, 2, ['item-journal', 'item-disc', 'item-cushion'])).toBe('מביאים לצ׳וק את היומן, ואחר כך את העיגול הכחול, ואחר כך את הכרית.');
  });
  it('keeps to a game with nothing to earn and nothing to lose', () => {
    for (const value of leaves(en)) expect(value, value).not.toMatch(/\b(scores?|stars?|points?|streaks?|timers?|wins?|winner|loses?|lost|prizes?|coins?|gems?|levels?|training|improves?|measures?|tests?|wrong|fail(ed|s)?)\b/i);
    for (const value of leaves(he)) expect(value, value).not.toMatch(/נקוד|ניקוד|כוכב|פרס|מטבע|ניצח|הפסד|אימון|מבחן|טעות|נכשל/);
  });
});
