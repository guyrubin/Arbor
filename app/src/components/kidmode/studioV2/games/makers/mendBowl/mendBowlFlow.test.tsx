/** Mend the Bowl through its real event handlers, without a browser: the
 * tap-and-keyboard path from the opening shot, through the three chapters
 * and the set-piece, to the saved bowl. Dragging, tracing with a finger,
 * layout and motion remain a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => {
  const sound = () => vi.fn((..._args: number[]): boolean => true);
  return { cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', sfx: vi.fn(),
    play: { tap: sound(), pick: sound(), place: sound(), back: sound(), chapter: sound(), setPiece: sound(), ambience: vi.fn((_kind: string): boolean => true), note: vi.fn((): boolean => true), breath: vi.fn((): boolean => true), stop: vi.fn(), dispose: vi.fn() },
    sounds: { press: sound(), dish: sound(), ring: sound(), lift: sound(), slip: sound(), turn: sound(), place: sound(), whole: sound(), trace: sound(), pour: sound(), seal: sound(), sing: sound(), glint: sound(), toy: vi.fn((_kind: string, _turn?: number): boolean => true), stop: vi.fn(), dispose: vi.fn() } };
});
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const same = (old: Slot | undefined, deps: readonly unknown[]) => !!old?.deps && old.deps.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]));
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useRef(initial: any) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useId() { return 'mb'; },
    useMemo(make: () => any, deps: readonly unknown[]) { const index = h.cursor++, old = h.slots[index]; if (same(old, deps)) return old!.value; const value = make(); h.slots[index] = { value, deps }; return value; },
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
vi.mock('../../../../audio/kidAudio', () => ({ kidSfx: h.sfx, kidAudioAllowed: () => false, kidAudioContext: () => null, onKidHush: () => () => {} }));
vi.mock('./mendBowlAudio', () => ({ createBowlSounds: () => h.sounds }));
vi.mock('../play/playSound', async original => ({ ...(await original<typeof import('../play/playSound')>()), createPlaySound: () => h.play }));
import MendBowl from './MendBowl';
import { HudButton, HudCoach, HudQuest, HudToast, PlayOpening, PlaySetPiece, PlayStage } from '../play';
import { MendedLayer } from './MendGold';
import { TableGround } from './MendScene';
import { TABLE_LAYOUTS } from './mendBowlPlay';
import { GameFinish } from '../../../../game/GameShell';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import { BOWL_GLAZES, BOWL_SEAM_COUNTS, validBowl, type BowlCreation, type BowlPattern } from './mendBowlRules';
import { BOWL_PATTERNS } from './mendBowlPatterns';

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
/** Every element the game renders: the HUD (a stage's children) and the world it hands the stage. */
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.world), ...nodes(node.props.children)]; }
function render() { h.cursor = 0; h.effects = []; const tree = MendBowl(); h.effects.forEach(fn => fn()); return nodes(tree); }
/** What React does when the game closes: every effect cleans up. */
function unmount() { for (const slot of h.slots) { const cleanup = slot?.cleanup; if (slot) slot.cleanup = undefined; cleanup?.(); } }
const section = (tree: Node[]) => tree.find(n => n.props['data-adventure'] === 'mend-bowl');
const phase = () => section(render())?.props['data-phase'] as string | undefined;
const pattern = () => section(render())!.props['data-pattern'] as BowlPattern;
const withData = (tree: Node[], key: string) => tree.filter(n => n.props[key] !== undefined && typeof n.type === 'string');
const shards = (tree: Node[]) => tree.filter(n => typeof n.props.onKeyClick === 'function').sort((a, b) => a.props.index - b.props.index);
const click = (node: Node | undefined) => { expect(node, 'control is on the screen').toBeTruthy(); node!.props.onClick!(); };
const wait = (ms: number) => { vi.advanceTimersByTime(ms); };
const text = (tree: Node[], cls: string) => { const n = tree.find(x => typeof x.props.className === 'string' && x.props.className.includes(cls)); return n ? String(n.props.children) : ''; };
const of = (tree: Node[], type: unknown) => tree.find(n => n.type === type);
/** A dock button, by the data attribute the game gave it. */
const dock = (tree: Node[], key: string, value?: string) => tree.find(n => n.type === HudButton && n.props.data?.[key] !== undefined && (value === undefined || n.props.data[key] === value));
const coach = () => of(render(), HudCoach)!.props as { who: string; mood: string; line: string; onPoke: () => void };
const quest = () => of(render(), HudQuest)!.props as { current: number; steps: { key: string; label: string; done: boolean }[] };
/** The opening shot ends (its own timer, or a tap): the kit calls onDone. */
function begin() { of(render(), PlayOpening)!.props.onDone(); expect(phase()).toBe('choose'); }

/** Choose a glaze and press Ready; returns once the pieces lie on the table. */
function breakBowl(glaze = 'rose') {
  if (phase() === 'open') begin();
  click(render().find(n => n.props['data-glaze'] === glaze));
  click(dock(render(), 'data-mend-ready'));
  wait(3200);
  expect(phase()).toBe('fit');
}
/** The tap path for one piece: choose it, tap its place, and take the lit turn if it waits for one. */
function placePiece(i: number) {
  shards(render())[i].props.onKeyClick(i, { detail: 0 });
  click(render().find(n => n.props['data-place'] === i));
  for (let turns = 0; turns < 3 && !shards(render())[i].props.placed; turns++) {
    const lit = render().find(n => n.type === HudButton && n.props.data?.['data-turn'] !== undefined && n.props.cue === true);
    if (lit) click(lit);
    wait(400);
  }
  expect(shards(render())[i].props.placed, `piece ${i} is home`).toBe(true);
}
function finished(): Node | undefined { return render().find(n => n.type === GameFinish); }

beforeEach(() => { vi.useFakeTimers(); h.cursor = 0; h.slots = []; h.effects = []; h.lang = 'en'; vi.spyOn(Math, 'random').mockReturnValue(0.4); vi.clearAllMocks(); vi.spyOn(Math, 'random').mockReturnValue(0.4); });
afterEach(() => { unmount(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('mend-bowl: one sitting by tap and keyboard', () => {
  it('opens on the opening shot: the title on the picture, the host with one line, and a tap begins', () => {
    const tree = render();
    expect(phase()).toBe('open');
    const opening = of(tree, PlayOpening)!;
    expect(opening.props.title).toBe(MEND_BOWL_COPY.en.title); expect(opening.props.place).toBe(MEND_BOWL_COPY.en.where);
    expect(coach().who).toBe('chock'); expect(coach().line).toBe(MEND_BOWL_COPY.en.welcome);
    // The one stage is the whole view, and the camera starts close on the bowl.
    const stage = of(tree, PlayStage)!;
    expect(stage.props.id).toBe('mend-bowl'); expect(stage.props.camera.zoom).toBeGreaterThan(1.2);
    // Nothing can be broken or glazed while the title is up.
    expect(dock(tree, 'data-mend-ready')).toBeUndefined(); expect(withData(tree, 'data-glaze')).toHaveLength(0);
    opening.props.onDone(); opening.props.onDone();
    expect(phase()).toBe('choose'); expect(of(render(), PlayOpening)).toBeUndefined();
    expect(of(render(), PlayStage)!.props.camera.zoom).toBe(1);
  });
  it('chapter one is the table itself: four dishes of glaze, one on the bowl, and one primary action', () => {
    begin();
    const tree = render();
    const glazes = withData(tree, 'data-glaze');
    expect(glazes.map(n => n.props['data-glaze'])).toEqual([...BOWL_GLAZES]);
    expect(glazes.filter(n => n.props['aria-pressed'] === true)).toHaveLength(1);
    for (const g of glazes) expect(g.props['aria-label']).toBe(MEND_BOWL_COPY.en.glazeNames[g.props['data-glaze'] as 'rose']);
    expect(text(tree, 'mb-status')).toBe(MEND_BOWL_COPY.en.chooseNext);
    expect(coach().line).toBe(MEND_BOWL_COPY.en.choose);
    // At most one primary action on screen, and it is the dock's.
    expect(tree.filter(n => n.type === HudButton && n.props.tone === 'go')).toHaveLength(1);
    expect(dock(tree, 'data-mend-ready')!.props.label).toBe(MEND_BOWL_COPY.en.ready);
    // The quest strip names three jobs; none is done, the first is in play. No numerals anywhere in it.
    expect(quest().current).toBe(0); expect(quest().steps.map(s => s.done)).toEqual([false, false, false]);
    expect(quest().steps.map(s => s.label)).toEqual([MEND_BOWL_COPY.en.questGlaze, MEND_BOWL_COPY.en.questFit, MEND_BOWL_COPY.en.questGold]);
    for (const s of quest().steps) expect(s.label).not.toMatch(/\d/);
  });
  it('a glaze dish recolours the bowl and plays its own note; the bowl itself only rings; the bare linen answers too', () => {
    begin();
    click(render().find(n => n.props['data-glaze'] === 'indigo'));
    expect(render().find(n => n.props['data-glaze'] === 'indigo')!.props['aria-pressed']).toBe(true);
    expect(h.sounds.dish).toHaveBeenCalledWith(BOWL_GLAZES.indexOf('indigo'));
    expect(coach().mood).toBe('happy');
    // A fingertip on the bowl is a toy: it never starts the break. (An unmeasured stage maps every point to the bowl's centre.)
    const stage = render().find(n => n.props.role === 'group')!;
    stage.props.onPointerDown({ pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}, currentTarget: { setPointerCapture() {} } });
    stage.props.onPointerUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(h.sounds.ring).toHaveBeenCalledOnce(); expect(phase()).toBe('choose');
  });
  it('Lift it up: the bowl is lifted, slips once, softly, and the pieces of one authored break lie on the table', () => {
    begin();
    click(dock(render(), 'data-mend-ready'));
    expect(phase()).toBe('slip'); expect(h.sounds.lift).toHaveBeenCalledOnce(); expect(h.sounds.slip).not.toHaveBeenCalled();
    // The camera pushes in as it is lifted.
    expect(of(render(), PlayStage)!.props.camera.zoom).toBeGreaterThan(1);
    const shakes = of(render(), PlayStage)!.props.shake as number;
    wait(1200); expect(phase()).toBe('break'); expect(h.sounds.slip).toHaveBeenCalledOnce();
    // The landing is the big moment: one shake, the host startled, and the first job is done.
    expect(of(render(), PlayStage)!.props.shake).toBe(shakes + 1); expect(coach().mood).toBe('wow');
    expect(quest().steps.map(s => s.done)).toEqual([true, false, false]); expect(quest().current).toBe(1);
    expect(text(render(), 'mb-status')).toBe(MEND_BOWL_COPY.en.brokeNext); expect(coach().line).toBe(MEND_BOWL_COPY.en.broke);
    wait(2000); expect(phase()).toBe('fit');
    const pieces = shards(render());
    expect(pieces).toHaveLength(BOWL_PATTERNS[pattern()].pieces.length);
    expect(pieces.every(p => p.props.placed === false && p.props.interactive === true)).toBe(true);
    // A second press of anything cannot break it again.
    expect(dock(render(), 'data-mend-ready')).toBeUndefined();
  });
  it('a piece sent to another piece’s place drifts back with the soft return: no words of blame, nothing counted', () => {
    breakBowl();
    const lay = shards(render())[0].props.pose;
    shards(render())[0].props.onKeyClick(0, { detail: 0 });
    click(render().find(n => n.props['data-place'] === 1));
    expect(shards(render())[0].props.pose).not.toEqual(lay);
    wait(1200);
    const piece = shards(render())[0];
    expect(piece.props.placed).toBe(false); expect(piece.props.wobble).toBe(1);
    // It lies exactly where it lay before.
    expect(piece.props.pose).toEqual(lay);
    // The miss has its own gentle sound, and it is not the sound of a piece going home.
    expect(h.play.back).toHaveBeenCalledOnce(); expect(h.play.place).not.toHaveBeenCalled();
    for (const words of [text(render(), 'mb-status'), coach().line]) expect(words).not.toMatch(/wrong|no\b|oops|try again|miss/i);
    expect(quest().steps.map(s => s.done)).toEqual([true, false, false]);
  });
  it('every piece goes home by tap; a turned piece waits at its place and one lit turn finishes it', () => {
    breakBowl();
    const n = BOWL_PATTERNS[pattern()].pieces.length;
    for (let i = n - 1; i >= 0; i--) placePiece(i);
    // One rising step per piece, then the chapter's flourish: the bowl is whole.
    expect(h.play.place.mock.calls.map(c => c[0])).toEqual(Array.from({ length: n }, (_, k) => k + 1));
    expect(h.sounds.turn).toHaveBeenCalled();
    wait(500); expect(h.play.chapter).toHaveBeenCalledOnce(); expect(of(render(), HudToast)!.props.show).toBe(true); expect(of(render(), HudToast)!.props.children).toBe(MEND_BOWL_COPY.en.wholeToast);
    expect(coach().line).toBe(MEND_BOWL_COPY.en.whole);
    wait(1200); expect(phase()).toBe('gold');
    expect(quest().steps.map(s => s.done)).toEqual([true, true, false]); expect(quest().current).toBe(2);
    expect(text(render(), 'mb-status')).toBe(MEND_BOWL_COPY.en.goldFirst);
    // Bebe's roller, Bebe's line; and the camera comes in for the fine work.
    expect(coach().who).toBe('bebe'); expect(coach().line).toBe(MEND_BOWL_COPY.en.gold);
    expect(render().filter(x => x.type === HudButton)).toHaveLength(0);
  });
  it('a turn button is never dead: with nothing chosen it picks up the most turned loose piece', () => {
    breakBowl();
    const before = shards(render()).map(p => p.props.pose.r as number);
    click(dock(render(), 'data-turn', 'right'));
    const after = shards(render());
    expect(after.filter(p => p.props.selected)).toHaveLength(1);
    expect(after.filter((p, i) => p.props.pose.r !== before[i])).toHaveLength(1);
    // Left is on the left and right is on the right, whatever the reading direction.
    expect(render().filter(x => x.type === HudButton).map(x => x.props.data['data-turn'])).toEqual(['left', 'right']);
  });
  it('gold goes on crack by crack in the child’s own order; then the set-piece; and that order is the saved bowl', () => {
    breakBowl('cream');
    const k = pattern(), n = BOWL_PATTERNS[k].pieces.length, seams = BOWL_SEAM_COUNTS[k];
    for (let i = 0; i < n; i++) placePiece(i);
    wait(1700); expect(phase()).toBe('gold');
    const order = Array.from({ length: seams }, (_, i) => (i * 2 + 1) % seams).filter((v, i, list) => list.indexOf(v) === i);
    for (let s = 0; s < seams; s++) if (!order.includes(s)) order.push(s);
    order.forEach((s, done) => {
      click(render().find(x => x.props['data-seam'] === s));
      // Tapping the same crack again while it runs changes nothing.
      render().find(x => x.props['data-seam'] === s)!.props.onClick!();
      expect(h.sounds.pour).toHaveBeenCalledTimes(done + 1);
      wait(1100);
      expect(h.sounds.seal).toHaveBeenCalledTimes(done + 1);
      if (done < seams - 1) { expect(phase()).toBe('gold'); expect(finished()).toBeUndefined(); }
    });
    expect(h.sounds.sing).toHaveBeenCalledOnce(); expect(h.play.chapter).toHaveBeenCalledTimes(2);
    wait(1000); expect(phase()).toBe('finale'); expect(finished()).toBeUndefined();
    // The set-piece: the frame widens, the lamp is lit, the light runs along every seam in the child's order…
    expect(h.play.setPiece).toHaveBeenCalledOnce();
    expect(of(render(), PlaySetPiece)!.props.active).toBe(true); expect(of(render(), PlaySetPiece)!.props.caption).toBe(MEND_BOWL_COPY.en.lit);
    expect(quest().steps.map(q => q.done)).toEqual([true, true, true]);
    expect(of(render(), MendedLayer)!.props.lamp).toBe(true); expect(of(render(), MendedLayer)!.props.tea).toBe('none');
    wait(700 + seams * 240);
    expect(h.sounds.glint).toHaveBeenCalledTimes(seams); expect(of(render(), MendedLayer)!.props.lit).toBe(seams);
    // (the camera, which pulled back as the bars came in, is pushing in on the bowl)
    expect(of(render(), PlayStage)!.props.camera.zoom).toBeGreaterThan(1.05);
    // …then the tea is poured and stands in the bowl, and only then is the Studio told.
    wait(600); expect(of(render(), MendedLayer)!.props.tea).toBe('pour'); expect(of(render(), PlaySetPiece)!.props.caption).toBe(MEND_BOWL_COPY.en.tea);
    wait(2700); expect(of(render(), MendedLayer)!.props.tea).toBe('full'); expect(of(render(), PlaySetPiece)!.props.caption).toBe(MEND_BOWL_COPY.en.admire);
    expect(h.sfx).toHaveBeenCalledWith('correct', expect.any(Number));
    expect(phase()).toBe('finale'); expect(finished()).toBeUndefined();
    // No petal in the tea: nobody woke the bloom this time.
    expect(of(render(), MendedLayer)!.props.petal).toBe(false);
    wait(3000);
    const end = finished(); expect(end).toBeTruthy();
    const creation = end!.props.creation as BowlCreation;
    expect(validBowl(creation)).toBe(true);
    expect(creation).toEqual({ kind: 'bowl', glaze: 'cream', pattern: k, seams: order });
    expect(end!.props.title).toBe(MEND_BOWL_COPY.en.finish);
  });
  it('the secret: whoever wakes the knit bloom finds one of its petals afloat in the tea', () => {
    begin();
    click(render().find(n => n.props['data-toy'] === 'bloom'));
    expect(h.sounds.toy).toHaveBeenCalledWith('bloomOpen', 0);
    breakBowl();
    const k = pattern();
    for (let i = 0; i < BOWL_PATTERNS[k].pieces.length; i++) placePiece(i);
    wait(1700);
    for (let s = 0; s < BOWL_SEAM_COUNTS[k]; s++) { click(render().find(x => x.props['data-seam'] === s)); wait(1100); }
    wait(1000 + 700 + BOWL_SEAM_COUNTS[k] * 240 + 600 + 2700);
    expect(of(render(), MendedLayer)!.props.petal).toBe(true);
    expect(of(render(), HudToast)!.props.children).toBe(MEND_BOWL_COPY.en.secret);
  });
  it('the things on the table and the host all answer a touch, and none of them moves the game on', () => {
    begin();
    for (const toy of ['lamp', 'fern', 'bloom']) click(render().find(n => n.props['data-toy'] === toy));
    expect(h.sounds.toy).toHaveBeenCalledTimes(3);
    expect(render().find(n => n.props['data-toy'] === 'lamp')!.props['aria-pressed']).toBe(true);
    coach().onPoke(); expect(coach().mood).toBe('happy'); coach().onPoke(); coach().onPoke();
    // Every third pat he has a word.
    expect(coach().line).toBe(MEND_BOWL_COPY.en.hostPat); wait(2400); expect(coach().line).not.toBe(MEND_BOWL_COPY.en.hostPat);
    expect(phase()).toBe('choose'); expect(quest().current).toBe(0);
  });
  it('Play again starts clean on a different break, the next glaze, another table, another light and another pot of tea', () => {
    breakBowl('cream');
    const first = pattern(), n = BOWL_PATTERNS[first].pieces.length;
    const table = of(render(), TableGround)!.props.spots, grade = of(render(), PlayStage)!.props.grade;
    for (let i = 0; i < n; i++) placePiece(i);
    wait(1700);
    for (let s = 0; s < BOWL_SEAM_COUNTS[first]; s++) { click(render().find(x => x.props['data-seam'] === s)); wait(1100); }
    const brew = of(render(), MendedLayer)!.props.teaDeep;
    wait(12000);
    finished()!.props.onPlayAgain();
    expect(phase()).toBe('choose');
    const chosen = withData(render(), 'data-glaze').find(g => g.props['aria-pressed'] === true)!.props['data-glaze'];
    expect(BOWL_GLAZES).toContain(chosen);
    expect(TABLE_LAYOUTS).toContain(of(render(), TableGround)!.props.spots); expect(of(render(), TableGround)!.props.spots).not.toBe(table);
    expect(of(render(), PlayStage)!.props.grade).not.toBe(grade);
    click(dock(render(), 'data-mend-ready')); wait(3200);
    expect(phase()).toBe('fit'); expect(pattern()).not.toBe(first);
    expect(shards(render()).every(p => p.props.placed === false)).toBe(true);
    for (let i = 0; i < BOWL_PATTERNS[pattern()].pieces.length; i++) placePiece(i);
    wait(1700); expect(of(render(), MendedLayer)!.props.teaDeep).not.toBe(brew);
  });
  it('speaks Hebrew natively, mirrors only the HUD, and leaves nothing running when it closes', () => {
    h.lang = 'he';
    const tree = render();
    expect(section(tree)!.props.dir).toBe('rtl');
    // The scene keeps its own left and right: only the words and the controls mirror.
    expect(tree.find(n => n.props.role === 'group')!.props.dir).toBe('ltr');
    expect(text(tree, 'mb-status')).toBe(MEND_BOWL_COPY.he.chooseNext);
    expect(of(tree, PlayOpening)!.props.title).toBe(MEND_BOWL_COPY.he.title); expect(coach().line).toBe(MEND_BOWL_COPY.he.welcome);
    begin();
    expect(quest().steps.map(s => s.label)).toEqual([MEND_BOWL_COPY.he.questGlaze, MEND_BOWL_COPY.he.questFit, MEND_BOWL_COPY.he.questGold]);
    click(dock(render(), 'data-mend-ready')); wait(3200);
    // Turn left stays on the left in a right-to-left HUD: the pair is handed over reversed.
    expect(render().filter(x => x.type === HudButton).map(x => x.props.data['data-turn'])).toEqual(['right', 'left']);
    unmount();
    expect(h.sounds.dispose).toHaveBeenCalledOnce(); expect(h.play.dispose).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
