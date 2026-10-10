import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { geometryStable } from './capture/release-interactions.mjs';
import { observeTogetherGeometry, togetherLayoutGeometry, togetherScrollStable } from './capture/together-geometry.mjs';

const source = readFileSync(new URL('./capture/release-interactions.mjs', import.meta.url), 'utf8');
const observationSource = readFileSync(new URL('./capture/together-geometry.mjs', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/components/layout/Shell.tsx', import.meta.url), 'utf8');
const scroll = { main: 0, mainLeft: 0, windowX: 0, windowY: 0 };
const sample = (y = 728.046875, translation = 0) => ({
  geometry: { x: 16, y: y + translation, width: 343, height: 289.6875 },
  scrollOffsets: { ...scroll },
  entrance: { shellBoundary: true, is2D: true, matrix: [1, 0, 0, 1, 0, translation], opacity: translation ? 0.4 : 1 },
});

describe('Together entry geometry observations', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('atomically reads the actual target, shell boundary, transform and all scroll owners', () => {
    const main = { scrollTop: 64, scrollLeft: -12 };
    const entrance = { parentElement: main as object, getAnimations: vi.fn(() => [{ playState: 'running', currentTime: 40 }]) };
    const surface = { parentElement: entrance };
    const target = {
      closest: vi.fn(() => surface),
      getBoundingClientRect: vi.fn(() => ({ x: 16, y: 734, width: 343, height: 289 })),
    };
    const querySelector = vi.fn(() => main);
    const getStyle = vi.fn((element: object) => element === surface ? { display: 'contents' } : { transform: 'matrix(1, 0, 0, 1, 0, 6)', opacity: '0.4' });
    const matrices: string[] = [];
    vi.stubGlobal('document', { querySelector });
    vi.stubGlobal('window', { scrollX: 5, scrollY: 18 });
    vi.stubGlobal('getComputedStyle', getStyle);
    vi.stubGlobal('DOMMatrixReadOnly', class {
      is2D = true; a = 1; b = 0; c = 0; d = 1; e = 0; f = 6;
      constructor(value: string) { matrices.push(value); }
    });
    expect(observeTogetherGeometry(target)).toEqual({
      geometry: { x: 16, y: 734, width: 343, height: 289 },
      scrollOffsets: { main: 64, mainLeft: -12, windowX: 5, windowY: 18 },
      entrance: {
        shellBoundary: true, transform: 'matrix(1, 0, 0, 1, 0, 6)', is2D: true,
        matrix: [1, 0, 0, 1, 0, 6], opacity: 0.4,
        animations: [{ playState: 'running', currentTime: 40 }],
      },
    });
    expect(target.getBoundingClientRect).toHaveBeenCalledOnce();
    expect(target.closest).toHaveBeenCalledWith('[data-route="practice"]');
    expect(querySelector).toHaveBeenCalledWith('#main');
    expect(getStyle.mock.calls.map(([element]) => element)).toEqual([entrance, surface]);
    expect(matrices).toEqual(['matrix(1, 0, 0, 1, 0, 6)']);
    entrance.parentElement = {};
    expect(observeTogetherGeometry(target).entrance.shellBoundary).toBe(false);
  });

  it.each([0, 4.1793212890625, 6.5970458984375, 10])('separates the documented %s px entrance from layout without discarding its raw rectangle', (translation) => {
    const initial = sample(728.046875, translation), after = sample();
    const raw = structuredClone(initial);
    expect(geometryStable(togetherLayoutGeometry(initial, true), togetherLayoutGeometry(after))).toBe(true);
    expect(togetherScrollStable(initial.scrollOffsets, after.scrollOffsets)).toBe(true);
    expect(initial).toEqual(raw);
    if (translation > 2) expect(geometryStable(initial.geometry, after.geometry)).toBe(false);
  });

  it.each(['x', 'y', 'width', 'height'])('still rejects a real three-pixel %s displacement under an entrance translation', (field) => {
    const initial = sample(728.046875, 6.5970458984375), after = sample();
    after.geometry[field as keyof typeof after.geometry] += 3;
    expect(geometryStable(togetherLayoutGeometry(initial, true), togetherLayoutGeometry(after))).toBe(false);
  });

  it.each(['main', 'mainLeft', 'windowX', 'windowY'])('rejects a focus-induced change in %s even when layout compensates for it', (owner) => {
    const initial = sample(728.046875, 6), after = sample();
    after.scrollOffsets[owner as keyof typeof scroll] = 1;
    expect(geometryStable(togetherLayoutGeometry(initial, true), togetherLayoutGeometry(after))).toBe(true);
    expect(togetherScrollStable(initial.scrollOffsets, after.scrollOffsets)).toBe(false);
  });

  it('does not normalize any translation still running in the final sample', () => {
    expect(togetherLayoutGeometry(sample(728.046875, 1))).toBeNull();
    const faded = sample(); faded.entrance.opacity = 0.9;
    expect(togetherLayoutGeometry(faded)).toBeNull();
  });

  it.each([
    { shellBoundary: false }, { is2D: false }, { matrix: [1, 0, 0, 1, 0, 11] },
    { matrix: [1, 0, 0, 1, 0, -1] }, { matrix: [1, 0, 0, 1, 1, 6] },
    { matrix: [1.1, 0, 0, 1, 0, 6] }, { matrix: [1, 0.1, 0, 1, 0, 6] },
    { matrix: [1, 0, 0.1, 1, 0, 6] }, { matrix: [1, 0, 0, 0.9, 0, 6] },
    { matrix: [1, 0, 0, 1, 0, NaN] }, { matrix: [1, 0, 0, 1, 0] },
    { opacity: NaN }, { opacity: -0.1 }, { opacity: 1.1 },
  ])('rejects undocumented or incomplete entrance geometry %j', (change) => {
    const value = sample(); Object.assign(value.entrance, change);
    expect(togetherLayoutGeometry(value, true)).toBeNull();
  });

  it('rejects missing, unmeasurable or non-finite geometry and scroll owners', () => {
    for (const value of [null, {}, { ...sample(), entrance: null }, { ...sample(), geometry: { ...sample().geometry, height: 0 } }, { ...sample(), geometry: { ...sample().geometry, y: NaN } }]) expect(togetherLayoutGeometry(value, true)).toBeNull();
    for (const value of [null, {}, { ...scroll, main: NaN }, { ...scroll, windowY: null }]) expect(togetherScrollStable(scroll, value)).toBe(false);
  });

  it('observes the real declared shell boundary and changes no DOM, motion or scroll state', () => {
    expect(shell).toContain('initial={{ opacity: 0, y: 10 }}');
    expect(shell).toContain('animate={{ opacity: 1, y: 0 }}');
    expect(shell).toContain('transition={{ duration: 0.22, ease: "easeOut" }}');
    expect(shell).toContain('style={{ display: "contents" }}');
    expect(observationSource).toContain("target.closest('[data-route=\"practice\"]')");
    expect(observationSource).toContain("entrance.parentElement === main && getComputedStyle(surface).display === 'contents'");
    expect(observationSource).toContain('new DOMMatrixReadOnly(style.transform)');
    expect(observationSource).not.toMatch(/\.style\.[a-zA-Z]+\s*=|scrollTo\(|scrollIntoView\(|\.focus\(|\.finish\(|\.cancel\(|requestAnimationFrame|setTimeout/);
  });

  it('preserves first-ready sampling and raw evidence while comparing the dock with its settled pre-open viewport', () => {
    const first = source.slice(source.indexOf("const together = await screen('practice', 'together-first-ready'"), source.indexOf("await screen('practice', 'together-settled'"));
    expect(first).toContain('cell.geometryObservation = firstGeometry; cell.geometry = firstGeometry.geometry');
    expect(first).not.toMatch(/waitForTimeout|waitForFunction|scrollIntoView|\.focus\(/);
    expect(source).toContain('geometryStable(beforeLayout, afterLayout)');
    expect(source).toContain('togetherScrollStable(firstGeometry.scrollOffsets, after.scrollOffsets)');
    const open = source.slice(source.indexOf("const dock = await screen('practice', 'together-dock-open'"), source.indexOf("await screen('practice', 'together-dock-settled'"));
    expect(open.indexOf('preDockGeometry = await togetherGeometry()')).toBeLessThan(open.indexOf('await openConversation()'));
    const close = source.slice(source.indexOf("await screen('practice', 'together-dock-closed'"), source.indexOf("await screen('practice', 'together-return-card'"));
    expect(close).toContain('geometryStable(preDockGeometry.geometry, after.geometry)');
    expect(close).toContain('togetherScrollStable(preDockGeometry.scrollOffsets, after.scrollOffsets)');
    expect(close).not.toContain('firstGeometry');
  });
});
