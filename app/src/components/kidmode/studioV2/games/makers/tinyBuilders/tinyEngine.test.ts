/** Tiny Structures played through its engine, without a browser: the tap and
 * keyboard path from the opening shot, through the three chapters and the
 * pull-back, to the end. The canvas is a stand-in that draws nothing; frames
 * and timers are stepped by hand. Dragging by finger, layout and what the
 * picture looks like remain a rendered check. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../../audio/kidAudio', () => ({ kidSfx: () => {}, kidAudioAllowed: () => false, kidAudioContext: () => null, onKidHush: () => () => {} }));
import { createTinyEngine, type Layout, type Phase, type TinyEngine, type TinyHooks } from './tinyEngine';
import { LAND_QUEST, PIECES, type BuildMode, type LandStep, type Placed } from './tinyBuildersRules';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';

const gradient = { addColorStop() {} };
function fakeCanvas(width: number, height: number): HTMLCanvasElement {
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, { get: (target, key: string) => (key in target ? target[key] : () => gradient), set: (target, key: string, value) => { target[key] = value; return true; } });
  return { clientWidth: width, clientHeight: height, width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
}
interface Seen { phases: Phase[]; placed: Placed; selected: string | null; found: number; landed: readonly LandStep[]; says: string[]; toasts: string[]; captions: number[]; canRecord: boolean; layout: Layout | null; shakes: number }
function play(mode: BuildMode, size: readonly [number, number] = [390, 760]) {
  const seen: Seen = { phases: [], placed: [], selected: null, found: 0, landed: [], says: [], toasts: [], captions: [], canRecord: false, layout: null, shakes: 0 };
  const hooks: TinyHooks = {
    phase: p => seen.phases.push(p), placed: p => { seen.placed = p; }, selected: id => { seen.selected = id; }, found: n => { seen.found = n; }, landed: d => { seen.landed = d; },
    say: (_who, _mood, key, piece) => seen.says.push(piece ? `${key}:${piece}` : key), toast: key => { if (key) seen.toasts.push(key); }, caption: i => seen.captions.push(i),
    canRecord: on => { seen.canRecord = on; }, layout: l => { seen.layout = l; }, shake: () => { seen.shakes += 1; }, haptic: () => {}, camera: () => {}, burst: () => {}, spot: () => {},
  };
  const engine = createTinyEngine(fakeCanvas(size[0], size[1]), { mode, seed: 20261116, round: 0, hooks });
  return { engine, seen };
}
let frames: ((now: number) => void)[] = [], now = 0;
function run(ms: number) {
  for (let t = 0; t < ms; t += 32) { vi.advanceTimersByTime(32); now += 32; const due = frames; frames = []; for (const frame of due) frame(now); }
}
const last = (seen: Seen) => seen.phases[seen.phases.length - 1];
function buildByTaps(engine: TinyEngine, seen: Seen, mode: BuildMode) {
  engine.begin();
  run(2500);
  for (const piece of PIECES[mode]) {
    engine.tapPart(piece.id); expect(seen.selected).toBe(piece.id); expect(seen.placed).not.toContain(piece.id);
    engine.tapPart(piece.id); run(700);
    expect(seen.placed, piece.id).toContain(piece.id); expect(seen.selected).toBeNull();
  }
  run(800);
}

beforeEach(() => {
  vi.useFakeTimers(); frames = []; now = 0;
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('Image', class { complete = false; naturalWidth = 0; decoding = ''; src = ''; });
  vi.stubGlobal('requestAnimationFrame', (frame: (now: number) => void) => { frames.push(frame); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Tiny Structures: the whole game by taps and keys', () => {
  it.each(['assisted', 'full'] as const)('%s: build, spin, dive, record four things, land legs first, pull back, done', (mode) => {
    const { engine, seen } = play(mode);
    run(1000); expect(seen.phases).toEqual([]);
    buildByTaps(engine, seen, mode);
    expect(last(seen)).toBe('spin'); expect(seen.says).toContain('standing');
    for (let i = 0; i < 8 && last(seen) === 'spin'; i++) { engine.keyTurn(45); run(900); }
    expect(last(seen)).toBe('built');
    engine.toLens(); run(2600);
    expect(last(seen)).toBe('dive');
    for (let n = 1; n <= 4; n++) {
      engine.record(); expect(seen.found).toBe(n - 1); // nothing to record until the dive gets there
      for (let i = 0; i < 12 && !seen.canRecord; i++) { engine.dive(1); run(900); }
      expect(seen.canRecord, `thing ${n}`).toBe(true);
      engine.record(); expect(seen.found).toBe(n); run(1300);
    }
    expect(last(seen)).toBe('found'); expect(seen.toasts).toContain('closer');
    engine.toLand(); run(2200);
    expect(last(seen)).toBe('land');
    // Lowered as it is, it meets the cell wrongly and drifts off; each try rights it a little, until the legs hold.
    for (let i = 0; i < 80 && !seen.landed.includes('legs'); i++) { engine.lower(); run(700); }
    expect(seen.landed).toContain('legs');
    if (mode === 'full') expect(seen.says.some(key => key === 'sideOff' || key === 'headOff')).toBe(true);
    run(2600); expect(seen.landed).toContain('pad');
    for (let i = 0; i < 4 && !seen.landed.includes('squeeze'); i++) { engine.squeeze(); run(300); }
    expect(seen.landed).toContain('squeeze');
    run(5200); expect(seen.landed).toEqual(LAND_QUEST);
    run(2400); expect(last(seen)).toBe('setPiece');
    run(13500);
    expect(seen.phases).toEqual(['build', 'spin', 'built', 'toLens', 'dive', 'found', 'land', 'setPiece', 'done']);
    expect(seen.captions).toEqual([0, 1, 2, 3, 4]);
    // Every line it asked the coach to say is written.
    for (const key of seen.says) { const [name, piece] = key.split(':'); expect(piece ? TINY_BUILDERS_COPY.he[name as 'picked'][piece as 'head'] : (TINY_BUILDERS_COPY.he.say as Record<string, string>)[name], key).toBeTruthy(); }
    engine.dispose();
  }, 120_000);
  it('a part carried by a finger: let go far from the stand it drifts back; let go at the stand the magnet takes it', () => {
    for (const size of [[390, 760], [1180, 700]] as const) {
      const { engine, seen } = play('assisted', size);
      engine.begin(); run(2500);
      const box = seen.layout!.parts.head, model = seen.layout!.model, from = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
      expect(box.w).toBeGreaterThanOrEqual(56); expect(box.h).toBeGreaterThanOrEqual(56);
      engine.grab('head', { id: 1, ...from }); engine.move({ id: 1, x: from.x + 30, y: from.y + 20 }); run(300);
      engine.up({ id: 1, x: from.x + 30, y: from.y + 20 }); run(900);
      expect(seen.placed).toEqual([]); expect(seen.says).toContain('closer');
      engine.grab('head', { id: 1, ...from });
      const to = { x: model.x + model.w / 2, y: model.y + model.h * 0.3 };
      for (let i = 1; i <= 10; i++) { engine.move({ id: 1, x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10 }); run(40); }
      engine.up({ id: 1, ...to }); run(700);
      expect(seen.placed, String(size)).toEqual(['head']); expect(seen.says).toContain('clicked:head');
      // A placed part has no button any more; the others keep theirs.
      expect(Object.keys(seen.layout!.parts).sort()).toEqual(['baseplate', 'fibres', 'tailCollar']);
      engine.dispose();
    }
  }, 60_000);
  it('nothing is out of turn: no spinning, diving or landing before its chapter, and the game never ends by itself', () => {
    const { engine, seen } = play('assisted');
    engine.begin(); run(600);
    engine.keyTurn(360); engine.toLens(); engine.dive(1); engine.record(); engine.toLand(); engine.lower(); engine.squeeze(); engine.secret();
    run(4000);
    expect(seen.phases).toEqual(['build']); expect(seen.found).toBe(0); expect(seen.landed).toEqual([]);
    run(20_000);
    expect(seen.phases).toEqual(['build']); expect(seen.placed).toEqual([]);
    engine.dispose();
  }, 60_000);
  it('a drag across the model spins it; a pinch and a wheel dive; the secret answers once', () => {
    const { engine, seen } = play('assisted');
    buildByTaps(engine, seen, 'assisted');
    engine.down({ id: 2, x: 40, y: 300 });
    for (let x = 40; x <= 350; x += 10) { engine.move({ id: 2, x, y: 300 }); run(32); }
    engine.up({ id: 2, x: 350, y: 300 }); run(1500);
    expect(last(seen)).toBe('built');
    engine.toLens(); run(2600);
    engine.wheel(-900); run(200);
    engine.down({ id: 3, x: 150, y: 300 }); engine.down({ id: 4, x: 240, y: 300 });
    engine.move({ id: 4, x: 520, y: 300 }); run(100); engine.up({ id: 3, x: 150, y: 300 }); engine.up({ id: 4, x: 520, y: 300 }); run(600);
    expect(seen.canRecord).toBe(true);
    engine.secret(); engine.secret();
    expect(seen.says.filter(key => key === 'secretBear' || key === 'secretWheel')).toHaveLength(1);
    engine.dispose();
  }, 60_000);
});
