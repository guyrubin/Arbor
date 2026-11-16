/** Woolly Mammoth's story through its real handlers, without a browser: from
 * the opening shot, through the three chapters, the five pictures and the
 * set-piece, to the finish. The engine (the canvas, the touch, the animal) is
 * replaced by a stand-in that the test drives the way the engine drives the
 * game: "this step is done", "this picture is taken". What the child does with
 * a finger, the painting and the motion remain a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => {
  const sound = () => vi.fn((..._args: unknown[]): boolean => true);
  return {
    cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en',
    hooks: null as any, options: null as any, throughEnd: null as null | (() => void),
    engine: { task: vi.fn(), step: vi.fn(), nudge: vi.fn(), snap: vi.fn(() => true), through: vi.fn(), greet: vi.fn(), hold: vi.fn(), photo: vi.fn(() => null), scene: vi.fn(() => 'hall'), setReduced: vi.fn(), tier: vi.fn(() => 'full'), dispose: vi.fn() },
    play: { tap: sound(), pick: sound(), place: sound(), back: sound(), chapter: sound(), setPiece: sound(), ambience: sound(), note: sound(), breath: sound(), stop: vi.fn(), dispose: vi.fn() },
    voice: { start: vi.fn(() => true), stop: vi.fn(), dispose: vi.fn() },
  };
});
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const same = (old: Slot | undefined, deps: readonly unknown[]) => !!old?.deps && old.deps.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]));
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useRef(initial: any) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useCallback(fn: unknown) { h.cursor++; return fn; },
    useMemo(make: () => any, deps: readonly unknown[]) { const index = h.cursor++, old = h.slots[index]; if (same(old, deps)) return old!.value; const value = make(); h.slots[index] = { value, deps }; return value; },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (same(old, deps)) return;
      const slot = h.slots[index] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
  };
});
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock('../../../../../../context/ArborContext', () => ({ useArborOptional: () => null }));
vi.mock('../../../../../../lib/native', () => ({ selectionHaptic: async () => {} }));
vi.mock('../../../../game/GameShell', () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock('../../../../audio/kidAudio', () => ({ useKidReadAloudMuted: () => false, kidAudioAllowed: () => false, kidAudioContext: () => null, onKidHush: () => () => {} }));
vi.mock('./mammothAudio', () => ({ createMammothSound: () => h.voice }));
vi.mock('./mammothEngine', () => ({ createMammothEngine: (_el: unknown, hooks: unknown, _sound: unknown, options: unknown) => { h.hooks = hooks; h.options = options; return h.engine; } }));
vi.mock('../play/playSound', async original => ({ ...(await original<typeof import('../play/playSound')>()), createPlaySound: () => h.play }));
vi.mock('../play/playJuice', async original => ({ ...(await original<typeof import('../play/playJuice')>()), hitPause: async () => {}, prefersReducedMotion: () => false, roundSeed: () => 4242 }));
import IceAgeFriend from './IceAgeFriend';
import { HudButton, HudCoach, HudQuest, HudToast, PlayOpening, PlaySetPiece, PlayStage } from '../play';
import { GameFinish } from '../../../../game/GameShell';
import { Print, Watchers } from './HallArt';
import { ICE_AGE_FRIEND_COPY } from './iceAgeFriendCopy';
import { DISCOVERIES, type DiscoveryId } from './iceAgeFriendRules';
import { STEPS, STEP_FACT, planRound, type StepId } from './mammothStory';

type Props = { children?: unknown; world?: unknown; onClick?: () => void; ref?: { current: unknown }; [key: string]: any };
type Node = ReactElement<Props>;
/** Every element the game renders: the HUD (a stage's children) and the world it hands the stage. */
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.world), ...nodes(node.props.children)]; }
/** What an element is to the game before the browser has one: something with a style and a way to make sparks. */
const stand = () => ({ style: { setProperty() {} }, burst() {}, trail() {}, clear() {} });
/** One render: the visit is called as React would call it, its elements are given their refs, then its effects run. */
function render(): Node[] {
  h.cursor = 0; h.effects = [];
  const outer = IceAgeFriend() as ReactElement<Record<string, unknown>>;
  const tree = nodes((outer.type as (props: unknown) => unknown)(outer.props));
  for (const node of tree) { const ref = node.props.ref; if (ref && typeof ref === 'object' && ref.current == null) ref.current = stand(); }
  h.effects.forEach(run => run());
  return tree;
}
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
const of = (tree: Node[], type: unknown) => tree.find(n => n.type === type);
const dock = (tree: Node[], key: string) => tree.find(n => n.type === HudButton && n.props.data?.[key] !== undefined);
const click = (node: Node | undefined) => { expect(node, 'control is on the screen').toBeTruthy(); node!.props.onClick!(); };
const coach = () => of(render(), HudCoach)!.props as { who: string; mood: string; line: string; onPoke: () => void };
const quest = () => of(render(), HudQuest)!.props as { current: number; label: string; steps: { key: string; label: string; done: boolean }[] };
const section = () => render().find(n => n.props['data-adventure'] === 'ice-age-friend')!.props;
const wait = (ms: number) => { vi.advanceTimersByTime(ms); };
const tasks = () => h.engine.task.mock.calls.map(call => call[0] as string);
const en = ICE_AGE_FRIEND_COPY.en;

/** The engine reports a step done, the way it does: the picture first, where the step ends in one. */
function engineFinishes(step: StepId) {
  const fact = STEP_FACT[step];
  if (fact) h.hooks.onShot(fact);
  h.hooks.onStep(step);
}
function begin() { of(render(), PlayOpening)!.props.onDone(); }
/** Plays from the opening up to (not including) the given step, keeping every print on the way. */
function playUntil(target: StepId | 'setPiece') {
  begin();
  for (const step of STEPS) {
    if (step === target) return;
    engineFinishes(step);
    if (STEP_FACT[step]) click(dock(render(), 'data-iaf-keep'));
    if (step === 'trace') { click(dock(render(), 'data-iaf-through')); h.throughEnd?.(); }
    wait(3000);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  h.slots = []; h.lang = 'en'; h.hooks = null; h.throughEnd = null;
  for (const fn of Object.values(h.engine)) fn.mockClear();
  for (const fn of Object.values(h.play)) fn.mockClear();
  h.engine.through.mockImplementation((onEnd: () => void) => { h.throughEnd = onEnd; });
});
afterEach(() => { unmount(); vi.useRealTimers(); });

describe('Woolly Mammoth: the opening', () => {
  it('is one full-bleed stage, the root of the activity, with the world left-to-right', () => {
    const tree = render(), stage = of(tree, PlayStage)!;
    expect(section()['data-iaf-phase']).toBe('opening');
    expect(stage.props.id).toBe('ice-age-friend');
    const world = tree.find(n => n.props.className === 'iaf-world')!;
    expect(world.props.dir).toBe('ltr'); expect(world.props.tabIndex).toBe(0); expect(world.props['aria-label']).toBe(en.stage);
  });
  it('the host says one line under the title, and nothing is asked of the child yet', () => {
    const tree = render(), opening = of(tree, PlayOpening)!;
    expect(opening.props.title).toBe(en.title); expect(opening.props.place).toBe(en.place);
    expect(coach()).toMatchObject({ who: 'bebe', line: en.say.opening });
    expect(tasks()).toEqual([]);
    expect(tree.filter(n => n.type === HudButton)).toEqual([]);
  });
  it('builds the visit once, from this visit’s plan, facing the way the language reads', () => {
    render(); render();
    expect(h.options.round).toEqual(planRound(4242, null));
    expect(h.options.faceRight).toBe(false);
  });
  it('when the shot ends the first step begins: the frost', () => {
    begin();
    expect(section()['data-iaf-phase']).toBe('play'); expect(section()['data-iaf-step']).toBe('frost');
    expect(of(render(), PlayOpening)).toBeUndefined();
    expect(tasks()).toEqual(['frost']);
    expect(coach().line).toBe(en.say.frost);
    expect(quest().steps.map(s => s.key)).toEqual(['frost', 'hello', 'trace']); expect(quest().current).toBe(0);
  });
});

describe('Woolly Mammoth: chapter one, through the glass', () => {
  it('the eye: the host gasps, the camera leans in, and then it lets go', () => {
    begin();
    h.hooks.onEye();
    expect(coach()).toMatchObject({ mood: 'wow', line: en.say.eye });
    expect(of(render(), PlayStage)!.props.camera.zoom).toBeGreaterThan(1.1);
    wait(2200);
    expect(of(render(), PlayStage)!.props.camera.zoom).toBe(1);
    wait(2000);
    expect(coach().line).toBe(en.say.frost);
  });
  it('a step done fills its pip, rings a note higher than the last, and the next step follows by itself', () => {
    begin();
    engineFinishes('frost');
    expect(quest().steps[0].done).toBe(true); expect(section()['data-iaf-step']).toBe('');
    expect(h.play.place).toHaveBeenLastCalledWith(0);
    wait(1000);
    expect(tasks()).toEqual(['frost', 'hello']); expect(coach()).toMatchObject({ who: 'gobgob', line: en.say.hello });
    engineFinishes('hello');
    expect(h.play.place).toHaveBeenLastCalledWith(1);
    expect(coach()).toMatchObject({ mood: 'happy', line: en.say.helloDone });
    wait(1600);
    expect(tasks()).toEqual(['frost', 'hello', 'trace']); expect(coach().line).toBe(en.say.trace);
  });
  it('the measured tusk becomes a print: the step waits until the child keeps it', () => {
    playUntil('trace');
    engineFinishes('trace');
    let tree = render();
    const print = of(tree, Print)!;
    expect(print.props).toMatchObject({ id: 'tusks', title: en.facts.tusks.title, text: en.facts.tusks.text, tool: en.tools.tusks });
    expect(h.engine.hold).toHaveBeenLastCalledWith(true);
    // The pip is not filled, and nothing else is offered, until the print is kept.
    expect(quest().steps[2].done).toBe(false);
    expect(tree.filter(n => n.type === HudButton).map(n => n.props.label)).toEqual([en.dock.keep]);
    click(dock(tree, 'data-iaf-keep'));
    tree = render();
    expect(of(tree, Print)).toBeUndefined(); expect(h.engine.hold).toHaveBeenLastCalledWith(false);
    expect(quest().steps.every(s => s.done)).toBe(true);
    expect(h.play.chapter).toHaveBeenCalledTimes(1);
  });
  it('the chapter ends on one action: through the glass', () => {
    playUntil('trace');
    engineFinishes('trace'); click(dock(render(), 'data-iaf-keep'));
    const buttons = render().filter(n => n.type === HudButton);
    expect(buttons.map(n => n.props.label)).toEqual([en.dock.through]); expect(buttons[0].props.tone).toBe('go');
    expect(coach().line).toBe(en.say.through);
    click(buttons[0]);
    expect(h.engine.through).toHaveBeenCalledTimes(1);
    expect(dock(render(), 'data-iaf-through')).toBeUndefined();
    expect(of(render(), PlayStage)!.props.camera.zoom).toBeGreaterThan(1.3);
    // Half way through the breath the hall is behind us; when it clears, chapter two begins.
    h.hooks.onCue('throughHalf');
    expect(of(render(), PlayStage)!.props.camera.zoom).toBe(1);
    expect(render().find(n => n.props.className === 'iaf-world')!.props['data-outside']).toBe(true);
    h.throughEnd!();
    expect(tasks().at(-1)).toBe('brush');
    expect(quest().steps.map(s => s.key)).toEqual(['brush', 'feed', 'part']);
  });
});

describe('Woolly Mammoth: chapters two and three', () => {
  it('the offered grass: the patient friend says to hold still, and the trunk’s picture is the reward', () => {
    playUntil('feed');
    expect(coach()).toMatchObject({ who: 'gobgob', line: en.say.feed });
    h.hooks.onCue('waiting');
    expect(coach().line).toBe(en.say.waiting);
    engineFinishes('feed');
    expect(of(render(), Print)!.props.id).toBe('trunk');
  });
  it('the ProofLens: the shutter is offered only when there is a picture to take', () => {
    playUntil('part');
    expect(dock(render(), 'data-iaf-snap')).toBeUndefined();
    h.hooks.onCue('lensReady');
    const snap = dock(render(), 'data-iaf-snap')!;
    expect(snap.props).toMatchObject({ label: en.dock.snap, tone: 'go', cue: true });
    expect(coach().line).toBe(en.say.lensReady);
    click(snap);
    expect(h.engine.snap).toHaveBeenCalledTimes(1);
    engineFinishes('part');
    expect(dock(render(), 'data-iaf-snap')).toBeUndefined();
    expect(of(render(), Print)!.props.id).toBe('coats');
  });
  it('chapter two ends on trust, and chapter three starts by itself', () => {
    playUntil('part');
    engineFinishes('part'); click(dock(render(), 'data-iaf-keep'));
    expect(coach().line).toBe(en.say.careDone); expect(h.play.chapter).toHaveBeenCalledTimes(2);
    wait(2500);
    expect(tasks().at(-1)).toBe('scout'); expect(coach()).toMatchObject({ who: 'pep', line: en.say.scout });
  });
  it('walking and lowering the view each have a quiet button beside the touch', () => {
    playUntil('walk');
    const walk = dock(render(), 'data-iaf-walk')!;
    expect(walk.props.tone).toBe('paper');
    click(walk); click(walk);
    expect(h.engine.step).toHaveBeenCalledTimes(2);
    h.hooks.onCue('calf');
    expect(coach()).toMatchObject({ mood: 'wow', line: en.say.calf });
    engineFinishes('walk'); wait(1600);
    expect(dock(render(), 'data-iaf-walk')).toBeUndefined();
    click(dock(render(), 'data-iaf-lower'));
    expect(h.engine.step).toHaveBeenCalledTimes(3);
  });
  it('the keyboard reaches every step: Enter does the next bit, the arrows steer', () => {
    begin();
    const world = render().find(n => n.props.className === 'iaf-world')!, press = (key: string) => { const event = { key, target: world, currentTarget: world, preventDefault: vi.fn() }; world.props.onKeyDown(event); return event.preventDefault; };
    expect(press('Enter')).toHaveBeenCalled(); expect(press(' ')).toHaveBeenCalled();
    expect(h.engine.step).toHaveBeenCalledTimes(2);
    press('ArrowLeft'); press('ArrowDown');
    expect(h.engine.nudge.mock.calls).toEqual([[-1, 0], [0, 1]]);
    expect(press('a')).not.toHaveBeenCalled();
  });
  it('the album keeps the pictures in the story’s order, and never as a count', () => {
    playUntil('scout');
    const album = render().find(n => n.props.className === 'iaf-album')!;
    expect(album.props['aria-label']).toBe(en.album);
    expect(nodes(album.props.children).filter(n => n.type === 'li').map(n => n.props['aria-label'])).toEqual([en.facts.tusks.title, en.facts.trunk.title, en.facts.coats.title]);
    // Nothing the HUD says is a number.
    const said = [coach().line, ...quest().steps.map(s => s.label), quest().label];
    for (const words of said) expect(words).not.toMatch(/\d/);
  });
  it('the secret: a tickle behind the small ear is told once, and never blocks the story', () => {
    playUntil('brush');
    expect(of(render(), HudToast)!.props.show).toBe(false);
    h.hooks.onSecret();
    expect(of(render(), HudToast)!.props).toMatchObject({ show: true, children: en.secretNote });
    expect(coach().line).toBe(en.say.secret);
    wait(7000);
    expect(of(render(), HudToast)!.props.show).toBe(false);
    expect(section()['data-iaf-step']).toBe('brush');
  });
});

describe('Woolly Mammoth: the night’s show and the end', () => {
  it('after the fifth picture the set-piece begins: the frame widens and the engine starts the show', () => {
    playUntil('low');
    engineFinishes('low'); click(dock(render(), 'data-iaf-keep'));
    expect(h.play.chapter).toHaveBeenCalledTimes(3);
    wait(1000);
    expect(section()['data-iaf-phase']).toBe('setPiece');
    expect(tasks().at(-1)).toBe('finale'); expect(h.play.setPiece).toHaveBeenCalledTimes(1);
    const tree = render();
    expect(of(tree, PlaySetPiece)!.props).toMatchObject({ active: true, caption: en.captions.call });
    expect(of(tree, Watchers)).toBeTruthy();
    // Until the pictures are up, there is nothing to press.
    expect(dock(tree, 'data-iaf-night')).toBeUndefined();
  });
  it('the captions follow the show, each picture rings a note higher, and one quiet action ends it', () => {
    playUntil('setPiece'); wait(1000);
    h.hooks.onCue('call'); expect(of(render(), PlaySetPiece)!.props.caption).toBe(en.captions.call);
    h.hooks.onCue('answer', 0); expect(of(render(), PlaySetPiece)!.props.caption).toBe(en.captions.answer);
    h.hooks.onCue('aurora'); expect(of(render(), PlaySetPiece)!.props.caption).toBe(en.captions.aurora);
    h.play.place.mockClear();
    DISCOVERIES.forEach((_id: DiscoveryId, index: number) => h.hooks.onCue('star', index));
    expect(h.play.place.mock.calls.map(call => call[0])).toEqual([0, 1, 2, 3, 4]);
    expect(of(render(), PlaySetPiece)!.props.caption).toBe(en.captions.pictures);
    h.hooks.onCue('finaleReady');
    const night = dock(render(), 'data-iaf-night')!;
    expect(night.props).toMatchObject({ label: en.dock.night, tone: 'go' });
    expect(of(render(), GameFinish)).toBeUndefined();
    click(night);
    const finish = of(render(), GameFinish)!;
    expect(finish.props).toMatchObject({ title: en.finish, subtitle: en.transfer });
    expect(finish.props.creation).toBeUndefined();
    expect(of(render(), PlayStage)).toBeUndefined();
  });
  it('leaving at any moment stops everything: the engine, both voices and every timer', () => {
    playUntil('feed');
    h.hooks.onCue('waiting');
    unmount();
    expect(h.engine.dispose).toHaveBeenCalledTimes(1); expect(h.voice.dispose).toHaveBeenCalled(); expect(h.play.dispose).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Woolly Mammoth in Hebrew', () => {
  it('says every line in Hebrew, faces the other way, and keeps the scene itself left-to-right', () => {
    h.lang = 'he';
    const he = ICE_AGE_FRIEND_COPY.he;
    expect(section().dir).toBe('rtl');
    expect(render().find(n => n.props.className === 'iaf-world')!.props.dir).toBe('ltr');
    expect(h.options.faceRight).toBe(true);
    expect(of(render(), PlayOpening)!.props).toMatchObject({ title: he.title, place: he.place });
    begin();
    expect(coach().line).toBe(he.say.frost);
    expect(quest().steps.map(s => s.label)).toEqual([he.steps.frost, he.steps.hello, he.steps.trace]);
    h.hooks.onShot('tusks'); h.hooks.onStep('trace');
    expect(of(render(), Print)!.props).toMatchObject({ title: he.facts.tusks.title, text: he.facts.tusks.text, tool: he.tools.tusks, rtl: true });
    expect(dock(render(), 'data-iaf-keep')!.props.label).toBe(he.dock.keep);
  });
  it('has every word in both languages', () => {
    const shape = (value: unknown): unknown => (typeof value === 'string' ? 'text' : Object.fromEntries(Object.entries(value as object).map(([key, inner]) => [key, shape(inner)])));
    expect(shape(ICE_AGE_FRIEND_COPY.he)).toEqual(shape(en));
    const flat = (value: unknown): string[] => (typeof value === 'string' ? [value] : Object.values(value as object).flatMap(flat));
    for (const words of flat(ICE_AGE_FRIEND_COPY.he)) { expect(words.trim().length).toBeGreaterThan(0); expect(words).not.toMatch(/[A-Za-z]/); }
    // No coach line asks a small child to read much.
    for (const line of Object.values(en.say)) expect(line.split(/\s+/).length).toBeLessThanOrEqual(8);
  });
});
