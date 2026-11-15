import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO_NEXT_FLAG_KEY, STUDIO_NEXT_HOSTS, resetStudioNextFlagForTests, studioNextCover, studioNextFlagOn } from './studioNextFlag';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'public');
let store: Map<string, string>;
function open(search: string) { vi.stubGlobal('location', { search }); resetStudioNextFlagForTests(); }
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  open('');
});
afterEach(() => { vi.unstubAllGlobals(); resetStudioNextFlagForTests(); });

describe('next Studio games switch', () => {
  it('is off on a device that never opted in, and shows no cover', () => {
    expect(studioNextFlagOn()).toBe(false);
    for (const host of STUDIO_NEXT_HOSTS) expect(studioNextCover(host)).toBeNull();
    expect(store.size).toBe(0);
  });
  it('opts a device in with ?studioNext=1 and keeps it in after the query is gone', () => {
    open('?studioNext=1'); expect(studioNextFlagOn()).toBe(true); expect(store.get(STUDIO_NEXT_FLAG_KEY)).toBe('1');
    open(''); expect(studioNextFlagOn()).toBe(true);
  });
  it('opts a device out again with ?studioNext=0', () => {
    store.set(STUDIO_NEXT_FLAG_KEY, '1'); open(''); expect(studioNextFlagOn()).toBe(true);
    open('?studioNext=0'); expect(studioNextFlagOn()).toBe(false); expect(store.has(STUDIO_NEXT_FLAG_KEY)).toBe(false);
  });
  it('reads the answer once per page, so a tile and its game always agree', () => {
    store.set(STUDIO_NEXT_FLAG_KEY, '1'); open(''); expect(studioNextFlagOn()).toBe(true);
    store.delete(STUDIO_NEXT_FLAG_KEY); expect(studioNextFlagOn()).toBe(true);
  });
  it('stays off when storage is missing or refuses', () => {
    vi.stubGlobal('localStorage', undefined); resetStudioNextFlagForTests(); expect(studioNextFlagOn()).toBe(false);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} });
    resetStudioNextFlagForTests(); expect(studioNextFlagOn()).toBe(false);
  });
  it('ignores any other value of the query or of the stored key', () => {
    open('?studioNext=yes'); expect(studioNextFlagOn()).toBe(false); expect(store.size).toBe(0);
    store.set(STUDIO_NEXT_FLAG_KEY, 'true'); open(''); expect(studioNextFlagOn()).toBe(false);
  });
  it('gives each of the four host tiles its own cover, and only those', () => {
    store.set(STUDIO_NEXT_FLAG_KEY, '1'); open('');
    expect([...STUDIO_NEXT_HOSTS].sort()).toEqual(['memory', 'pattern', 'puzzle', 'river-rescue']);
    const covers = STUDIO_NEXT_HOSTS.map(host => studioNextCover(host)!);
    expect(new Set(covers.map(cover => cover.src)).size).toBe(4);
    for (const cover of covers) {
      expect(cover.srcSet).toBe(`${cover.src480} 480w, ${cover.src} 1024w`);
      for (const file of [cover.src, cover.src480]) expect(existsSync(path.join(PUBLIC, file)), `${file} is not shipped`).toBe(true);
    }
    for (const other of ['rhythm-garden', 'feelings-forest', 'calm-builder', 'sneak', 'toString', '__proto__', '']) expect(studioNextCover(other)).toBeNull();
  });
});
