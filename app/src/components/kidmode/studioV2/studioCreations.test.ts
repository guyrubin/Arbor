import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ uid: 'owner-a', loaded: true, error: false, current: true, rows: [] as unknown[], upsert: vi.fn() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock('../../../hooks/useChildCollection', () => ({ useChildCollection: () => ({ items: h.rows, loaded: h.loaded, error: h.error, isCurrent: () => h.current, upsert: h.upsert }) }));
import { creationForScope, useStudioCreations, validStudioCreation, type StudioCreation } from './studioCreations';
const melody: StudioCreation = { kind: 'melody', notes: [0, 2, 1], tempo: 760 };
const corner: StudioCreation = { kind: 'corner', layout: ['plant', null, 'books', null, null, null], light: 'night', scene: 'garden' };
beforeEach(() => { h.uid = 'owner-a'; h.loaded = true; h.error = false; h.current = true; h.rows = []; h.upsert.mockReset(); });
describe('bounded private creations', () => {
  it('validates actual toy choices and rejects malformed or unbounded payloads', () => {
    expect(validStudioCreation(melody)).toBe(true); expect(validStudioCreation(corner)).toBe(true);
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
    expect(h.upsert).toHaveBeenCalledWith({ id: 'melody', ownerId: 'owner-a', childId: 'child-a', creation: melody });
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
});
