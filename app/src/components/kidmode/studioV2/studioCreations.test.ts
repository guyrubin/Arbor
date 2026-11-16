import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ uid: 'owner-a', loaded: true, error: false, current: true, rows: [] as unknown[], upsert: vi.fn() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock('../../../hooks/useChildCollection', () => ({ useChildCollection: () => ({ items: h.rows, loaded: h.loaded, error: h.error, isCurrent: () => h.current, upsert: h.upsert }) }));
import { BOWL_SEAM_COUNTS } from './games/makers/mendBowl/mendBowlRules';
import { creationForScope, useStudioCreations, validStudioCreation, type StudioCreation } from './studioCreations';
const melody: StudioCreation = { kind: 'melody', notes: [0, 2, 1], tempo: 760 };
const dance: StudioCreation = { kind: 'dance', moves: [0, null, 3, null, 5, null, null, 1], tempo: 500 };
const bowl: StudioCreation = { kind: 'bowl', glaze: 'indigo', pattern: 1, seams: Array.from({ length: BOWL_SEAM_COUNTS[1] }, (_, i) => BOWL_SEAM_COUNTS[1] - 1 - i) };
const textile: StudioCreation = { kind: 'textile', cloth: 'sage', motifs: [{ flower: 'tulip', cell: 11, thread: 4 }, { flower: 'daisy', cell: 0, thread: 0 }] };
const bottle: StudioCreation = { kind: 'bottle', shape: 'tall', tint: 'rose', finish: 'frost', stickers: [{ art: 'moon', slot: 11 }, { art: 'star', slot: 2 }] };
const corner: StudioCreation = { kind: 'corner', layout: ['plant', null, 'books', null, null, null], light: 'night', scene: 'garden' };
beforeEach(() => { h.uid = 'owner-a'; h.loaded = true; h.error = false; h.current = true; h.rows = []; h.upsert.mockReset(); });
describe('bounded private creations', () => {
  it('validates actual toy choices and rejects malformed or unbounded payloads', () => {
    expect(validStudioCreation(melody)).toBe(true); expect(validStudioCreation(corner)).toBe(true); expect(validStudioCreation(dance)).toBe(true);
    for (const bad of [{ ...dance, moves: Array(8).fill(null) }, { ...dance, moves: [0, 1] }, { ...dance, moves: [9, null, null, null, null, null, null, null] }, { ...dance, tempo: 760 }, { ...dance, moves: 'spin' }]) expect(validStudioCreation(bad)).toBe(false);
    for (const bad of [null, {}, { ...melody, notes: [] }, { ...melody, notes: Array(9).fill(0) }, { ...melody, notes: [99] }, { ...melody, tempo: 0 }, { ...corner, layout: Array(6).fill('plant') }, { ...corner, scene: 'photo' }]) expect(validStudioCreation(bad)).toBe(false);
  });
  it('does not expose another owner or child, even from a local fallback', () => {
    const row = { id: 'melody', ownerId: 'owner-a', childId: 'child-a', creation: melody };
    expect(creationForScope(row, 'owner-a', 'child-a')).toBe(true);
    expect(creationForScope(row, 'owner-b', 'child-a')).toBe(false);
    expect(creationForScope(row, 'owner-a', 'child-b')).toBe(false);
    h.rows = [row]; expect(useStudioCreations('child-a').items).toHaveLength(1); h.uid = 'owner-b'; expect(useStudioCreations('child-a').items).toEqual([]);
  });
  it('saves only the creation contract under the active owner and strips unrelated fields', async () => {
    await useStudioCreations('child-a').save({ ...melody, privatePhoto: 'must-not-persist' } as StudioCreation);
    expect(h.upsert).toHaveBeenCalledWith({ id: 'melody', ownerId: 'owner-a', childId: 'child-a', creation: melody }, { requireAcknowledgement: true });
  });
  it('keeps a dance as its eight bounded steps and nothing else', async () => {
    await useStudioCreations('child-a').save({ ...dance, recording: 'must-not-persist' } as StudioCreation);
    expect(h.upsert).toHaveBeenCalledWith({ id: 'dance', ownerId: 'owner-a', childId: 'child-a', creation: dance }, { requireAcknowledgement: true });
  });
  it('refuses a write before hydration, after scope retirement, or on a fallback error', async () => {
    h.loaded = false; await expect(useStudioCreations('child-a').save(melody)).rejects.toThrow();
    h.loaded = true; h.current = false; await expect(useStudioCreations('child-a').save(melody)).rejects.toThrow();
    h.current = true; h.error = true; await expect(useStudioCreations('child-a').save(melody)).rejects.toThrow();
    expect(h.upsert).not.toHaveBeenCalled();
  });
  it('does not acknowledge a rejected storage write', async () => {
    h.upsert.mockRejectedValue(new Error('quota')); await expect(useStudioCreations('child-a').save(corner)).rejects.toThrow('quota');
  });
  it('keeps a queued or unconfirmed remote save retryable, with the same bounded document identity', async () => {
    h.upsert.mockRejectedValueOnce(new Error('The write was not confirmed; please retry'));
    await expect(useStudioCreations('child-a').save(corner)).rejects.toThrow('not confirmed');
    h.upsert.mockResolvedValueOnce(undefined);
    await expect(useStudioCreations('child-a').save(corner)).resolves.toBeUndefined();
    expect(h.upsert).toHaveBeenCalledTimes(2);
    const [first, second] = h.upsert.mock.calls;
    expect(first[0]).toEqual(second[0]);
    expect(first[1]).toEqual({ requireAcknowledgement: true });
    expect(second[1]).toEqual({ requireAcknowledgement: true });
  });
  it('validates a mended bowl: a glaze, one of three patterns, and a full permutation of that pattern\'s seams', () => {
    expect(validStudioCreation(bowl)).toBe(true);
    for (const pattern of [0, 1, 2] as const) expect(validStudioCreation({ kind: 'bowl', glaze: 'cream', pattern, seams: Array.from({ length: BOWL_SEAM_COUNTS[pattern] }, (_, i) => i) })).toBe(true);
    const n = BOWL_SEAM_COUNTS[1];
    for (const bad of [{ ...bowl, glaze: 'gold' }, { ...bowl, pattern: 3 }, { ...bowl, seams: [] }, { ...bowl, seams: Array(n).fill(0) }, { ...bowl, seams: Array.from({ length: n - 1 }, (_, i) => i) }, { ...bowl, seams: [...Array.from({ length: n - 1 }, (_, i) => i), n] }, { ...bowl, seams: [...Array.from({ length: n - 1 }, (_, i) => i), 0.5] }, { ...bowl, seams: 'gold' }]) expect(validStudioCreation(bad), JSON.stringify(bad)).toBe(false);
  });
  it('validates a stitched cloth: 1 to 8 flowers on distinct cells of the 4x3 grid, five threads', () => {
    expect(validStudioCreation(textile)).toBe(true);
    const eight = Array.from({ length: 8 }, (_, cell) => ({ flower: 'poppy', cell, thread: cell % 5 }));
    expect(validStudioCreation({ kind: 'textile', cloth: 'linen', motifs: eight })).toBe(true);
    const motif = { flower: 'daisy', cell: 3, thread: 2 };
    for (const bad of [{ ...textile, cloth: 'silk' }, { ...textile, motifs: [] }, { ...textile, motifs: [...eight, { ...motif, cell: 9 }] }, { ...textile, motifs: [motif, motif] }, { ...textile, motifs: [{ ...motif, cell: 12 }] }, { ...textile, motifs: [{ ...motif, cell: -1 }] }, { ...textile, motifs: [{ ...motif, thread: 5 }] }, { ...textile, motifs: [{ ...motif, thread: 1.5 }] }, { ...textile, motifs: [{ ...motif, flower: 'rose' }] }, { ...textile, motifs: [null] }]) expect(validStudioCreation(bad), JSON.stringify(bad)).toBe(false);
  });
  it('keeps a bowl and a cloth as their bounded choices only, one document per kind', async () => {
    await useStudioCreations('child-a').save({ ...bowl, photo: 'must-not-persist' } as StudioCreation);
    expect(h.upsert).toHaveBeenLastCalledWith({ id: 'bowl', ownerId: 'owner-a', childId: 'child-a', creation: bowl }, { requireAcknowledgement: true });
    const tagged = { ...textile, motifs: (textile as { motifs: object[] }).motifs.map(m => ({ ...m, note: 'must-not-persist' })) } as unknown as StudioCreation;
    await useStudioCreations('child-a').save(tagged);
    expect(h.upsert).toHaveBeenLastCalledWith({ id: 'textile', ownerId: 'owner-a', childId: 'child-a', creation: textile }, { requireAcknowledgement: true });
    expect(creationForScope({ id: 'bowl', ownerId: 'owner-a', childId: 'child-a', creation: bowl }, 'owner-a', 'child-a')).toBe(true);
    expect(creationForScope({ id: 'textile', ownerId: 'owner-a', childId: 'child-a', creation: bowl }, 'owner-a', 'child-a')).toBe(false);
  });
  it('validates a bottle: shape, tint, finish and 0 to 6 stickers on distinct slots of twelve', () => {
    expect(validStudioCreation(bottle)).toBe(true);
    expect(validStudioCreation({ ...bottle, stickers: [] })).toBe(true);
    const six = Array.from({ length: 6 }, (_, slot) => ({ art: 'leaf', slot: slot * 2 }));
    expect(validStudioCreation({ ...bottle, stickers: six })).toBe(true);
    const s = { art: 'sun', slot: 4 };
    for (const bad of [{ ...bottle, shape: 'square' }, { ...bottle, tint: 'black' }, { ...bottle, finish: 'matte' }, { ...bottle, stickers: [...six, { ...s, slot: 1 }] }, { ...bottle, stickers: [s, s] }, { ...bottle, stickers: [{ ...s, slot: 12 }] }, { ...bottle, stickers: [{ ...s, slot: 1.5 }] }, { ...bottle, stickers: [{ ...s, art: 'photo' }] }, { ...bottle, stickers: 'star' }, { ...bottle, stickers: [null] }]) expect(validStudioCreation(bad), JSON.stringify(bad)).toBe(false);
  });
  it('keeps a bottle as its bounded choices only, under its own kind', async () => {
    const tagged = { ...bottle, label: 'must-not-persist', stickers: (bottle as { stickers: object[] }).stickers.map(x => ({ ...x, note: 'must-not-persist' })) } as unknown as StudioCreation;
    await useStudioCreations('child-a').save(tagged);
    expect(h.upsert).toHaveBeenLastCalledWith({ id: 'bottle', ownerId: 'owner-a', childId: 'child-a', creation: bottle }, { requireAcknowledgement: true });
  });
});
