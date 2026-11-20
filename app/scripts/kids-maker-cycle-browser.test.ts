import { afterEach, describe, expect, it, vi } from 'vitest';
import { controlledCanvasCapture, hasMakerCanvasPaint, iceAgeCycleSteps, makerCycleGames, makerStage390Scope, nativeMakerScene, readCrankJointState, readMakerCanvasPaint, testCrankJointOnce, waitForBottleFinish, waitForMakerCanvasPaint, waitForNativeMakerOpening, withMakerPreviewTime } from './kids-maker-cycle-browser.mjs';

describe('B-KID-174 canonical 390px stage evidence', () => {
  it('keeps the seven named maker scenes and both EN/HE Safari phone cells', () => {
    const { gameIds, viewports } = makerStage390Scope();
    expect(gameIds).toEqual(['ice-age-friend', 'fox-trail', 'windup-race', 'tiny-builders', 'stitch-garden', 'paper-boat', 'season-dial']);
    expect(viewports.map(viewport => viewport.id)).toEqual(['safari-en', 'safari-he']);
    expect(viewports.every(viewport => viewport.w === 390 && viewport.h === 664)).toBe(true);
    expect(new Set(gameIds).size).toBe(7);
    expect(makerCycleGames(gameIds).map(game => game.id).sort()).toEqual([...gameIds].sort());
    expect(controlledCanvasCapture('windup-race')).toBe('.wr-canvas');
    expect(controlledCanvasCapture('ice-age-friend')).toBeNull();
  });
});

const allSteps = ['frost', 'hello', 'trace', 'brush', 'feed', 'part', 'scout', 'walk', 'low'];
const withoutBrush = allSteps.filter(step => step !== 'brush');
const brushSample = { at: 13812, adventure: 'ice-age-friend', iafPhase: 'play', iafStep: 'brush' };

describe('Ice Age first-cycle DOM observations', () => {
  it('keeps the brush phase actually seen after input between native-clock loop reads', () => {
    // c7 phone HE saw brush at13812, then the pause at14812. The next loop
    // read alone missed it even though the original DOM trace retained it.
    const trace = [brushSample, { at: 14812, adventure: 'ice-age-friend', iafPhase: 'play', iafStep: '' }];
    expect(new Set(iceAgeCycleSteps(withoutBrush, trace))).toEqual(new Set(allSteps));
  });

  it('still rejects every genuinely unobserved required step', () => {
    for (const missing of allSteps) {
      expect(() => iceAgeCycleSteps(allSteps.filter(step => step !== missing), []))
        .toThrow(`Played mammoth ${missing}`);
    }
  });

  it('does not credit another game or an opening-state label as brush play', () => {
    for (const invalid of [
      { ...brushSample, adventure: 'another-game' },
      { ...brushSample, iafPhase: 'opening' },
      { ...brushSample, iafStep: '' },
    ]) expect(() => iceAgeCycleSteps(withoutBrush, [invalid])).toThrow('Played mammoth brush');
  });

  it('deduplicates repeated observations and preserves a fully observed sitting', () => {
    expect(iceAgeCycleSteps(allSteps, [])).toEqual(allSteps);
    expect(iceAgeCycleSteps(withoutBrush, [brushSample, brushSample])).toHaveLength(9);
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const flowerPickup = { phase: 'playing', chapter: 'flowerCh', step: 'pickUp',
  nextAction: { label: 'Plant the flower', visible: true, enabled: true } };

describe('the single Crank joint test response', () => {
  it('presses Test once and retains the authored sequence until the real next action is ready', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const press = vi.fn(async () => undefined), samples: unknown[] = [];
    const advance = vi.fn(async (ms: number) => { now += ms; });
    const testing = { phase: 'playing', chapter: 'pistonCh', step: 'testJoint', nextAction: null };
    const result = await testCrankJointOnce(press, async () => now < 4250 ? testing : flowerPickup, advance, samples);
    expect(press).toHaveBeenCalledOnce();
    expect(result).toEqual({ waitedMs: 4250, elapsedMs: 4250, ...flowerPickup });
    expect(samples).toHaveLength(18);
    expect(samples[0]).toEqual({ waitedMs: 0, elapsedMs: 0, ...testing });
    expect(samples.at(-1)).toEqual(result);
    expect(advance).toHaveBeenCalledTimes(17);
  });

  it('accepts a completed action immediately without a redundant input or extra wait', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const press = vi.fn(), advance = vi.fn();
    expect(await testCrankJointOnce(press, async () => flowerPickup, advance, []))
      .toEqual({ waitedMs: 0, elapsedMs: 0, ...flowerPickup });
    expect(press).toHaveBeenCalledOnce();
    expect(advance).not.toHaveBeenCalled();
  });

  it('fails missing or wrong phases and missing, hidden, disabled or unnamed next actions', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    for (const state of [
      {}, { ...flowerPickup, phase: 'opening' }, { ...flowerPickup, chapter: 'pistonCh' },
      { ...flowerPickup, step: 'testJoint' }, { ...flowerPickup, step: 'bigShow' },
      { ...flowerPickup, nextAction: null }, { ...flowerPickup, nextAction: { ...flowerPickup.nextAction, visible: false } },
      { ...flowerPickup, nextAction: { ...flowerPickup.nextAction, enabled: false } },
      { ...flowerPickup, nextAction: { ...flowerPickup.nextAction, label: ' ' } },
    ]) {
      now = 0;
      const press = vi.fn(), samples: unknown[] = [], advance = vi.fn(async (ms: number) => { now += ms; });
      await expect(testCrankJointOnce(press, async () => state, advance, samples)).rejects.toThrow('within 12000ms');
      expect(press).toHaveBeenCalledOnce();
      expect(samples).toHaveLength(49);
      expect(advance).toHaveBeenCalledTimes(48);
      expect(now).toBe(12000);
    }
  });

  it('rejects an otherwise correct observation returned after the real wall deadline', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const press = vi.fn(), advance = vi.fn(), samples: unknown[] = [];
    await expect(testCrankJointOnce(press, async () => { now = 12001; return flowerPickup; }, advance, samples))
      .rejects.toThrow('within 12000ms');
    expect(press).toHaveBeenCalledOnce();
    expect(advance).not.toHaveBeenCalled();
    expect(samples).toEqual([{ waitedMs: 0, elapsedMs: 12001, ...flowerPickup }]);
  });

  it('also bounds requested waits when the observed wall clock does not advance', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const press = vi.fn(), advance = vi.fn(), samples: unknown[] = [];
    await expect(testCrankJointOnce(press, async () => ({}), advance, samples)).rejects.toThrow('within 12000ms');
    expect(press).toHaveBeenCalledOnce();
    expect(advance).toHaveBeenCalledTimes(48);
    expect(samples.at(-1)).toMatchObject({ waitedMs: 12000, elapsedMs: 0 });
  });

  it('propagates an actual failed Test input without observing or retrying it', async () => {
    const press = vi.fn(async () => { throw new Error('test input failed'); }), read = vi.fn(), advance = vi.fn();
    await expect(testCrankJointOnce(press, read, advance, [])).rejects.toThrow('test input failed');
    expect(press).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });

  it('reads the actual visible enabled next button, including its ancestor visibility', () => {
    const ancestor = { parentElement: null }, button = { textContent: ' Plant the flower ', disabled: false, parentElement: ancestor,
      getBoundingClientRect: () => ({ width: 200, height: 64 }), getAttribute: () => null };
    const attributes: Record<string, string> = { 'data-crank-phase': 'playing', 'data-crank-chapter': 'flowerCh', 'data-crank-step': 'pickUp' };
    const world = { getAttribute: (name: string) => attributes[name] };
    const root = { querySelector: (selector: string) => selector === '.ck-world' ? world : button };
    vi.stubGlobal('document', { querySelector: () => root });
    const styles = vi.fn((_node: unknown) => ({ opacity: '1', display: 'block', visibility: 'visible' }));
    vi.stubGlobal('getComputedStyle', styles);
    expect(readCrankJointState()).toEqual(flowerPickup);
    styles.mockImplementation(node => ({ opacity: '1', display: node === ancestor ? 'none' : 'block', visibility: 'visible' }));
    expect(readCrankJointState().nextAction?.visible).toBe(false);
    styles.mockImplementation(() => ({ opacity: '1', display: 'block', visibility: 'visible' }));
    button.disabled = true;
    expect(readCrankJointState().nextAction?.enabled).toBe(false);
    vi.stubGlobal('document', { querySelector: () => null });
    expect(readCrankJointState()).toEqual({ phase: null, chapter: null, step: null, nextAction: null });
  });
});

describe('the single Bottle polish action response', () => {
  it('retains the old finish until a later native frame publishes the actual opposite finish', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const advance = vi.fn(async (ms: number) => { now += ms; });
    const readState = vi.fn(async () => ({ act: 'colour', finish: now < 200 ? 'gloss' : 'frost' }));
    const samples: unknown[] = [];
    expect(await waitForBottleFinish(readState, advance, 'gloss', samples))
      .toEqual({ waitedMs: 200, elapsedMs: 200, finish: 'frost' });
    expect(samples).toEqual([
      { waitedMs: 0, elapsedMs: 0, act: 'colour', finish: 'gloss' },
      { waitedMs: 100, elapsedMs: 100, act: 'colour', finish: 'gloss' },
      { waitedMs: 200, elapsedMs: 200, act: 'colour', finish: 'frost' },
    ]);
    expect(advance.mock.calls).toEqual([[100], [100]]);
  });

  it('also recognizes an actual frost-to-gloss response without another input', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const advance = vi.fn();
    expect(await waitForBottleFinish(async () => ({ act: 'colour', finish: 'gloss' }), advance, 'frost', []))
      .toEqual({ waitedMs: 0, elapsedMs: 0, finish: 'gloss' });
    expect(advance).not.toHaveBeenCalled();
  });

  it('fails closed for unchanged finish, missing state, wrong phase and invalid finish', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    for (const state of [
      { act: 'colour', finish: 'gloss' }, {},
      { act: 'dress', finish: 'frost' }, { act: 'colour', finish: 'painted' },
    ]) {
      now = 0;
      const advance = vi.fn(async (ms: number) => { now += ms; }), samples: unknown[] = [];
      await expect(waitForBottleFinish(async () => state, advance, 'gloss', samples)).rejects.toThrow('within 2000ms');
      expect(samples).toHaveLength(21);
      expect(advance).toHaveBeenCalledTimes(20);
      expect(now).toBe(2000);
    }
  });

  it('keeps the real wall deadline and rejects an absent starting finish', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const advance = vi.fn(), samples: unknown[] = [];
    await expect(waitForBottleFinish(async () => { now = 2001; return { act: 'colour', finish: 'frost' }; }, advance, 'gloss', samples))
      .rejects.toThrow('within 2000ms');
    expect(samples).toEqual([{ waitedMs: 0, elapsedMs: 2001, act: 'colour', finish: 'frost' }]);
    expect(advance).not.toHaveBeenCalled();
    await expect(waitForBottleFinish(async () => ({ act: 'colour', finish: 'frost' }), advance, undefined, []))
      .rejects.toThrow('starts from an actual bottle finish');
  });
});

describe('native maker entry and replay', () => {
  it('uses only the three measured native renderers and keeps all fifteen release games', () => {
    const games = makerCycleGames();
    expect(games).toHaveLength(15);
    expect(games.filter(game => nativeMakerScene(game.id)).map(game => game.id).sort())
      .toEqual(['bottle-lab', 'crank-works', 'ice-age-friend']);
  });

  it('observes each real first phase without clicking an expiring opening button', async () => {
    const selectors = {
      'ice-age-friend': '[data-adventure="ice-age-friend"][data-iaf-phase="play"][data-iaf-step="frost"]',
      'crank-works': '.ck-world[data-crank-phase="playing"]',
      'bottle-lab': '[data-adventure="bottle-lab"][data-act="shape"]',
    };
    for (const [id, selector] of Object.entries(selectors)) {
      const waitFor = vi.fn(async () => undefined), count = vi.fn(async () => 0);
      const page = { locator: vi.fn(() => ({ waitFor, count })) };
      await waitForNativeMakerOpening(page, id);
      expect(page.locator).toHaveBeenNthCalledWith(1, selector);
      expect(waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 6000 });
      expect(page.locator).toHaveBeenCalledWith('[data-play-skip]');
      if (id === 'ice-age-friend') expect(page.locator).toHaveBeenCalledWith('.iaf-album li');
    }
  });

  it('rejects missing first phases, a surviving opening, and an old Ice Age album', async () => {
    const absent = { locator: () => ({ waitFor: async () => { throw new Error('phase absent'); }, count: async () => 0 }) };
    await expect(waitForNativeMakerOpening(absent, 'crank-works')).rejects.toThrow('phase absent');
    const overlay = { locator: () => ({ waitFor: async () => undefined, count: async () => 1 }) };
    await expect(waitForNativeMakerOpening(overlay, 'bottle-lab')).rejects.toThrow('opening has ended');
    const oldAlbum = { locator: (selector: string) => ({ waitFor: async () => undefined, count: async () => selector === '.iaf-album li' ? 1 : 0 }) };
    await expect(waitForNativeMakerOpening(oldAlbum, 'ice-age-friend')).rejects.toThrow('no prior observations');
  });

  it('keeps native Bottle time untouched through the lazy creation preview and its failure path', async () => {
    const page = { get clock() { throw new Error('A native preview cannot touch controlled time'); } };
    const inspect = vi.fn(async () => ({ shape: 'tall', tint: 'rose' }));
    expect(await withMakerPreviewTime(page, !!nativeMakerScene('bottle-lab'), inspect)).toEqual({ shape: 'tall', tint: 'rose' });
    expect(inspect).toHaveBeenCalledOnce();
    await expect(withMakerPreviewTime(page, true, async () => { throw new Error('preview absent'); })).rejects.toThrow('preview absent');
  });

  it('preserves running lazy loading and the existing pause handshake for controlled creations', async () => {
    const events: string[] = [];
    const page = { evaluate: async () => { events.push('time'); return 1234; }, clock: {
      resume: async () => { events.push('resume'); },
      setFixedTime: async () => { events.push('fixed'); },
      pauseAt: async () => { events.push('pause'); },
      setSystemTime: async () => { events.push('system'); },
    } };
    expect(await withMakerPreviewTime(page, false, async () => { events.push('inspect'); return 'bowl'; })).toBe('bowl');
    expect(events).toEqual(['resume', 'inspect', 'time', 'fixed', 'pause', 'system']);
  });
});

const painted = { mounted: true, width: 375, height: 736, box: { width: 375, height: 736 }, visible: true, opacity: 1, nontransparent: 4096, uniqueColours: 2919 };
const erased = { ...painted, nontransparent: 0, uniqueColours: 1 };

describe('real canvas paint evidence', () => {
  it('rejects the exact observed post-capture erasure and other invisible or flat bitmaps', () => {
    expect(hasMakerCanvasPaint(painted)).toBe(true);
    for (const invalid of [
      erased, { ...painted, mounted: false }, { ...painted, width: 0 },
      { ...painted, box: { width: 375, height: 0 } }, { ...painted, visible: false },
      { ...painted, opacity: 0.5 }, { ...painted, uniqueColours: 1 },
    ]) expect(hasMakerCanvasPaint(invalid)).toBe(false);
  });

  it('retains initial blank observations and waits only for real paint, with a finite deadline', async () => {
    const evidence: unknown[] = [];
    const page = {
      evaluate: vi.fn().mockResolvedValueOnce(erased).mockResolvedValueOnce(erased).mockResolvedValue(painted),
      waitForTimeout: vi.fn(async () => undefined),
    };
    expect(await waitForMakerCanvasPaint(page, '.ck-canvas', evidence)).toBe(100);
    expect(evidence).toEqual([{ waitedMs: 0, ...erased }, { waitedMs: 50, ...erased }, { waitedMs: 100, ...painted }]);
    expect(page.waitForTimeout.mock.calls).toEqual([[50], [50]]);
    const never = { evaluate: vi.fn(async () => erased), waitForTimeout: vi.fn(async () => undefined) };
    const failedEvidence: unknown[] = [];
    await expect(waitForMakerCanvasPaint(never, '[data-bl-canvas]', failedEvidence)).rejects.toThrow('4000ms of real waiting');
    expect(never.evaluate).toHaveBeenCalledTimes(81);
    expect(never.waitForTimeout).toHaveBeenCalledTimes(80);
    expect(failedEvidence).toHaveLength(81);
  });

  it('reads a detached copy without requesting or mutating the game renderer context', () => {
    const pixels = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < 4096; i++) { pixels[i * 4] = i % 256; pixels[i * 4 + 1] = Math.floor(i / 256); pixels[i * 4 + 2] = 100; pixels[i * 4 + 3] = 255; }
    const source = { tagName: 'CANVAS', className: 'ck-canvas', width: 375, height: 736, parentElement: null,
      getContext: vi.fn(() => { throw new Error('The game context must not be requested'); }),
      getBoundingClientRect: () => ({ x: 0, y: 76, width: 375, height: 736 }) };
    const ctx = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) };
    const copy = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
    vi.stubGlobal('document', { querySelector: vi.fn(() => source), createElement: vi.fn(() => copy) });
    vi.stubGlobal('getComputedStyle', () => ({ opacity: '1', visibility: 'visible', display: 'block' }));
    const actual = readMakerCanvasPaint('.ck-canvas');
    expect(actual).toMatchObject({ width: 375, height: 736, samplePixels: 4096, nontransparent: 4096, uniqueColours: 4096, opacity: 1, visible: true });
    expect(hasMakerCanvasPaint(actual)).toBe(true);
    expect(source.getContext).not.toHaveBeenCalled();
    expect(copy.getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 64, 64);
    pixels.fill(0);
    expect(hasMakerCanvasPaint(readMakerCanvasPaint('.ck-canvas'))).toBe(false);
  });
});
