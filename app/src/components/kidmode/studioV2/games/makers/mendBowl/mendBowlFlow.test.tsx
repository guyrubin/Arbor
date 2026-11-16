/** Mend the Bowl through its real event handlers, without a browser: the
 * tap-and-keyboard path from the glaze to the saved bowl. Dragging, tracing
 * with a finger, layout and motion remain a rendered check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => {
  const sound = () => vi.fn((..._args: number[]): boolean => true);
  return { cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', sfx: vi.fn(),
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
import MendBowl from './MendBowl';
import { GameFinish } from '../../../../game/GameShell';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import { BOWL_GLAZES, BOWL_SEAM_COUNTS, validBowl, type BowlCreation, type BowlPattern } from './mendBowlRules';
import { BOWL_PATTERNS } from './mendBowlPatterns';

type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
type Node = ReactElement<Props>;
function nodes(node: unknown): Node[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
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

/** Choose a glaze and press Ready; returns once the pieces lie on the table. */
function breakBowl(glaze = 'rose') {
  click(render().find(n => n.props['data-glaze'] === glaze));
  click(render().find(n => n.props['data-mend-ready'] !== undefined));
  wait(3200);
  expect(phase()).toBe('fit');
}
/** The tap path for one piece: choose it, tap its place, and take the lit turn if it waits for one. */
function placePiece(i: number) {
  shards(render())[i].props.onKeyClick(i, { detail: 0 });
  click(render().find(n => n.props['data-place'] === i));
  for (let turns = 0; turns < 3 && !shards(render())[i].props.placed; turns++) {
    const lit = render().find(n => n.props['data-turn'] !== undefined && n.props['data-cue'] === true);
    if (lit) click(lit);
    wait(400);
  }
  expect(shards(render())[i].props.placed, `piece ${i} is home`).toBe(true);
}
function finished(): Node | undefined { return render().find(n => n.type === GameFinish); }

beforeEach(() => { vi.useFakeTimers(); h.cursor = 0; h.slots = []; h.effects = []; h.lang = 'en'; vi.spyOn(Math, 'random').mockReturnValue(0.4); vi.clearAllMocks(); vi.spyOn(Math, 'random').mockReturnValue(0.4); });
afterEach(() => { unmount(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('mend-bowl: one sitting by tap and keyboard', () => {
  it('opens on the whole bowl with four glazes, one chosen, and Ready', () => {
    const tree = render();
    expect(phase()).toBe('choose');
    const glazes = withData(tree, 'data-glaze');
    expect(glazes.map(n => n.props['data-glaze'])).toEqual([...BOWL_GLAZES]);
    expect(glazes.filter(n => n.props['aria-pressed'] === true)).toHaveLength(1);
    for (const g of glazes) expect(g.props['aria-label']).toBe(MEND_BOWL_COPY.en.glazeNames[g.props['data-glaze'] as 'rose']);
    expect(text(tree, 'mb-status')).toBe(MEND_BOWL_COPY.en.chooseNext);
  });
  it('a glaze dish recolours the bowl and plays its own note; the bowl itself only rings', () => {
    click(render().find(n => n.props['data-glaze'] === 'indigo'));
    expect(render().find(n => n.props['data-glaze'] === 'indigo')!.props['aria-pressed']).toBe(true);
    expect(h.sounds.dish).toHaveBeenCalledWith(BOWL_GLAZES.indexOf('indigo'));
    // A fingertip on the bowl is a toy: it never starts the break.
    const stage = render().find(n => n.props.role === 'group')!;
    stage.props.onPointerDown({ pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}, currentTarget: { setPointerCapture() {} } });
    stage.props.onPointerUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(h.sounds.ring).toHaveBeenCalledOnce(); expect(phase()).toBe('choose');
  });
  it('Ready: the bowl is lifted, slips once, softly, and the pieces of one authored break lie on the table', () => {
    click(render().find(n => n.props['data-mend-ready'] !== undefined));
    expect(phase()).toBe('slip'); expect(h.sounds.lift).toHaveBeenCalledOnce(); expect(h.sounds.slip).not.toHaveBeenCalled();
    wait(1200); expect(phase()).toBe('break'); expect(h.sounds.slip).toHaveBeenCalledOnce();
    expect(text(render(), 'mb-status')).toBe(MEND_BOWL_COPY.en.brokeNext);
    wait(2000); expect(phase()).toBe('fit');
    const pieces = shards(render());
    expect(pieces).toHaveLength(BOWL_PATTERNS[pattern()].pieces.length);
    expect(pieces.every(p => p.props.placed === false && p.props.interactive === true)).toBe(true);
    // A second press of anything cannot break it again.
    expect(render().find(n => n.props['data-mend-ready'] !== undefined)).toBeUndefined();
  });
  it('a piece sent to another piece’s place drifts back: no sound of failure, no words of blame', () => {
    breakBowl();
    shards(render())[0].props.onKeyClick(0, { detail: 0 });
    const before = h.sounds.place.mock.calls.length;
    click(render().find(n => n.props['data-place'] === 1));
    wait(1200);
    const piece = shards(render())[0];
    expect(piece.props.placed).toBe(false); expect(piece.props.wobble).toBe(1);
    expect(piece.props.pose).toEqual(BOWL_PATTERNS[pattern()].pieces[0].start);
    expect(h.sounds.place.mock.calls.length).toBe(before);
    expect(text(render(), 'mb-status')).not.toMatch(/wrong|no\b|oops|try again/i);
  });
  it('every piece goes home by tap; a turned piece waits at its place and one lit turn finishes it', () => {
    breakBowl();
    const n = BOWL_PATTERNS[pattern()].pieces.length;
    for (let i = n - 1; i >= 0; i--) placePiece(i);
    // One rising note per piece, then the bowl is whole.
    expect(h.sounds.place.mock.calls.map(c => c[0])).toEqual(Array.from({ length: n }, (_, k) => k + 1));
    expect(h.sounds.turn).toHaveBeenCalled();
    wait(1200); expect(phase()).toBe('gold'); expect(h.sounds.whole).toHaveBeenCalledOnce();
    expect(text(render(), 'mb-status')).toBe(MEND_BOWL_COPY.en.goldFirst);
  });
  it('a turn button is never dead: with nothing chosen it picks up the most turned loose piece', () => {
    breakBowl();
    const before = shards(render()).map(p => p.props.pose.r as number);
    click(render().find(n => n.props['data-turn'] === 'right'));
    const after = shards(render());
    expect(after.filter(p => p.props.selected)).toHaveLength(1);
    expect(after.filter((p, i) => p.props.pose.r !== before[i])).toHaveLength(1);
  });
  it('gold goes on crack by crack in the child’s own order, and that order is the saved bowl', () => {
    breakBowl('cream');
    const k = pattern(), n = BOWL_PATTERNS[k].pieces.length, seams = BOWL_SEAM_COUNTS[k];
    for (let i = 0; i < n; i++) placePiece(i);
    wait(1200); expect(phase()).toBe('gold');
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
    expect(h.sounds.sing).toHaveBeenCalledOnce();
    wait(800); expect(phase()).toBe('admire'); expect(finished()).toBeUndefined();
    // The closing celebration is its own beat: between a second and a half and three seconds, then the Studio is told.
    wait(1300); expect(phase()).toBe('admire');
    wait(1500);
    const end = finished(); expect(end).toBeTruthy();
    const creation = end!.props.creation as BowlCreation;
    expect(validBowl(creation)).toBe(true);
    expect(creation).toEqual({ kind: 'bowl', glaze: 'cream', pattern: k, seams: order });
    expect(h.sounds.glint).toHaveBeenCalledTimes(seams); expect(h.sfx).toHaveBeenCalledWith('correct', expect.any(Number));
    expect(end!.props.title).toBe(MEND_BOWL_COPY.en.finish);
  });
  it('Play again starts clean on a different break and the next glaze', () => {
    breakBowl('cream');
    const first = pattern(), n = BOWL_PATTERNS[first].pieces.length;
    for (let i = 0; i < n; i++) placePiece(i);
    wait(1200);
    for (let s = 0; s < BOWL_SEAM_COUNTS[first]; s++) { click(render().find(x => x.props['data-seam'] === s)); wait(1100); }
    wait(4000);
    finished()!.props.onPlayAgain();
    expect(phase()).toBe('choose');
    const chosen = withData(render(), 'data-glaze').find(g => g.props['aria-pressed'] === true)!.props['data-glaze'];
    expect(BOWL_GLAZES).toContain(chosen);
    click(render().find(x => x.props['data-mend-ready'] !== undefined)); wait(3200);
    expect(phase()).toBe('fit'); expect(pattern()).not.toBe(first);
    expect(shards(render()).every(p => p.props.placed === false)).toBe(true);
  });
  it('speaks Hebrew natively and leaves nothing running when it closes', () => {
    h.lang = 'he';
    const tree = render();
    expect(section(tree)!.props.dir).toBe('rtl');
    // The scene keeps its own left and right: only the words and the controls mirror.
    expect(tree.find(n => n.props.role === 'group')!.props.dir).toBe('ltr');
    expect(text(tree, 'mb-status')).toBe(MEND_BOWL_COPY.he.chooseNext);
    click(render().find(n => n.props['data-mend-ready'] !== undefined));
    unmount();
    expect(h.sounds.dispose).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
