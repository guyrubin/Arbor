/** Exercise the actual event handlers and cleanup without a browser dependency.
 * Rendering/focus/speaker verification remains a separate acceptance check. */
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[], lang: 'en', muted: false, hush: null as null | (() => void),
  audio: { play: vi.fn(() => true), stop: vi.fn(), dispose: vi.fn() }, say: vi.fn(), sound: vi.fn() }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState(initial: any) { const slot = h.slots[h.cursor++] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
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
vi.mock('../../../game/GameShell', () => ({ GameShell: () => null, GameFinish: () => null }));
vi.mock('../../../audio/kidAudio', () => ({ kidSfx: h.sound, kidSay: h.say, useKidReadAloudMuted: () => h.muted, onKidHush: (fn: () => void) => { h.hush = fn; return () => { h.hush = null; }; } }));
vi.mock('../../../../../lib/voice', () => ({ stopVoice: vi.fn() }));
vi.mock('../../studioCreations', () => ({ useStudioCreations: () => ({ items: [], loaded: true, isCurrent: () => true }) }));
vi.mock('./gardenAudio', () => ({ createGardenAudio: () => h.audio }));
import RiverRescue from './RiverRescue';
import FeelingsForest from './FeelingsForest';
import RhythmGarden from './RhythmGarden';
import { GameFinish } from '../../../game/GameShell';
import { ADVENTURE_COPY } from './adventureCopy';
import { makeRiverMap } from './adventureRules';
import { FOREST_STORIES, FEELING_NAMES } from './forestStories';
type Props = { children?: unknown; onClick?: () => void; disabled?: boolean; [key: string]: any };
function nodes(node: unknown): ReactElement<Props>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement<Props>(node)) return []; return [node, ...nodes(node.props.children)]; }
function render(Component: () => ReactElement) { h.cursor = 0; h.effects = []; const tree = Component(); h.effects.forEach(fn => fn()); return tree; }
function words(node: unknown): string { if (typeof node === 'string') return node; if (Array.isArray(node)) return node.map(words).join(''); if (isValidElement<Props>(node)) return words(node.props.children); return ''; }
function button(tree: unknown, text: string) { const result = nodes(tree).find(n => n.type === 'button' && words(n.props.children) === text); expect(result, text).toBeDefined(); return result!; }
function clickButton(tree: unknown, text: string) { const b = button(tree, text); expect(b.props.disabled).not.toBe(true); b.props.onClick!(); }
function clickCell(tree: unknown, cell: number) { const b = nodes(tree).find(n => n.props['data-cell'] === cell)!; expect(b.props.disabled).not.toBe(true); b.props.onClick!(); }
const finished = (tree: unknown) => nodes(tree).some(n => n.type === GameFinish);
beforeEach(() => {
  h.cursor=0;h.slots=[];h.effects=[];h.lang='en';h.muted=false;h.hush=null;vi.clearAllMocks();vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { h.slots.forEach(s => s.cleanup?.()); vi.useRealTimers(); vi.restoreAllMocks();vi.unstubAllGlobals(); });
describe.each(['en','he'] as const)('real adventure flows in %s', lang => {
  it('River: cannot sail early; solves three routes, sails, then completes and replays', () => {
    h.lang=lang;const w=ADVENTURE_COPY[lang];let tree=render(RiverRescue);
    expect(button(tree,w.sail).props.disabled).toBe(true);
    clickCell(tree,0);tree=render(RiverRescue);expect(words(tree)).toContain(w.riverRock);
    for(let round=0;round<3;round++) {
      const map=makeRiverMap('gentle',round,round);
      for(const cell of map.solution.slice(1)){clickCell(tree,cell);tree=render(RiverRescue);}
      clickButton(tree,w.sail);tree=render(RiverRescue);
      expect(finished(tree)).toBe(false);
      for(let i=0;i<map.solution.length+1;i++){vi.advanceTimersByTime(400);tree=render(RiverRescue);}
      clickButton(tree,round===2?w.finish:w.next);tree=render(RiverRescue);
    }
    expect(finished(tree)).toBe(true);
    nodes(tree).find(n=>n.type===GameFinish)!.props.onPlayAgain();tree=render(RiverRescue);
    expect(finished(tree)).toBe(false);expect(button(tree,w.sail).props.disabled).toBe(true);
  });
  it('Forest: a retry does not complete; each chosen support leads to a different authored response', () => {
    h.lang=lang;const w=ADVENTURE_COPY[lang];let tree=render(FeelingsForest);
    for(let round=0;round<3;round++) {
      const story=FOREST_STORIES.find(s=>words(tree).includes(s.story[lang]))!;expect(story).toBeDefined();
      const wrong=nodes(tree).find(n=>n.type==='button'&&n.props['data-feeling']&&n.props['data-feeling']!==story.feeling)!;
      wrong.props.onClick!();tree=render(FeelingsForest);expect(words(tree)).toContain(w.forestOther);expect(finished(tree)).toBe(false);
      clickButton(tree,FEELING_NAMES[story.feeling][lang]);tree=render(FeelingsForest);
      const actions=nodes(tree).filter(n=>n.type==='button'&&n.props.children instanceof Array&&words(n.props.children).length>0);
      const action=actions[round];expect(action).toBeDefined();action.props.onClick!();tree=render(FeelingsForest);
      expect(Object.values(story.responses).some(r=>words(tree).includes(r[lang]))).toBe(true);
      clickButton(tree,round===2?w.finish:w.forestNext);tree=render(FeelingsForest);
    }
    expect(finished(tree)).toBe(true);expect(h.say).not.toHaveBeenCalled();
  });
  it('Rhythm: visual clues, gentle retry, three patterns, bounded composition, pause, and finish', () => {
    h.lang=lang;h.muted=true;const w=ADVENTURE_COPY[lang];let tree=render(RhythmGarden);
    expect(words(tree)).toContain(w.visual);
    for(let round=0;round<3;round++) {
      clickButton(tree,w.listen);tree=render(RhythmGarden);vi.advanceTimersByTime(5000);tree=render(RhythmGarden);
      const pattern=nodes(tree).find(n=>n.props.className==='rhythm-pattern')!;
      // Show pattern exposes exactly the same ordered names to assistive tech.
      clickButton(tree,w.memory);tree=render(RhythmGarden);
      const revealed=nodes(tree).find(n=>n.props.className==='rhythm-pattern')!;
      const labels=nodes(revealed).filter(n=>n.type==='span'&&n.props['aria-label']).map(n=>String(n.props['aria-label']));
      expect(labels.length).toBe(round+2);expect(pattern).toBeDefined();
      const target=labels.map(label=>w.notes.findIndex(name=>label.endsWith(name)));
      const wrong=(target[0]+1)%3;nodes(tree).find(n=>n.props['data-note']===wrong)!.props.onClick!();tree=render(RhythmGarden);expect(words(tree)).toContain(w.rhythmRetry);
      for(const note of target){nodes(tree).find(n=>n.props['data-note']===note)!.props.onClick!();tree=render(RhythmGarden);}
      clickButton(tree,w.next);tree=render(RhythmGarden);
    }
    expect(button(tree,w.finish).props.disabled).toBe(true);
    for(let i=0;i<10;i++){nodes(tree).find(n=>n.props['data-note']===i%3)!.props.onClick!();tree=render(RhythmGarden);}
    expect(words(tree)).toContain(w.fullTune);
    expect(nodes(tree).filter(n=>n.type==='span'&&String(n.props['aria-label']??'').startsWith(w.note+' '))).toHaveLength(8);
    clickButton(tree,w.rhythmPlay);tree=render(RhythmGarden);expect(vi.getTimerCount()).toBeGreaterThan(0);
    clickButton(tree,w.stop);tree=render(RhythmGarden);expect(vi.getTimerCount()).toBe(0);
    clickButton(tree,w.finish);tree=render(RhythmGarden);expect(finished(tree)).toBe(true);
  });
});
it('navigation cancels scheduled flowers and disposes the audio owner', () => {
  let tree=render(RhythmGarden);clickButton(tree,ADVENTURE_COPY.en.listen);tree=render(RhythmGarden);expect(vi.getTimerCount()).toBeGreaterThan(0);
  h.slots.forEach(s=>s.cleanup?.());expect(vi.getTimerCount()).toBe(0);expect(h.audio.dispose).toHaveBeenCalled();
});
