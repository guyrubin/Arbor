import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO_NEXT_FLAG_KEY, STUDIO_NEXT_HOSTS, resetStudioNextFlagForTests, studioNextFlagOn } from './studioNextFlag';
import { studioNextCover } from '../../../lib/kidThemeManifest';
import { resetHeroBandFlagForTests } from './heroBandFlag';
import { studioCopy } from './studioCopy';
import { HERO_BAND_COPY } from './games/adventures/heroBandCopy';
import { WOBBLY_DELIVERY_COPY } from './games/adventures/wobblyDeliveryCopy';
import { FIVE_FRIEND_SUN_COPY } from './games/adventures/fiveFriendSunCopy';
import { OOPS_BUTTON_COPY } from './games/adventures/oopsButtonCopy';
import { ROVER_DELIVERY_COPY } from './games/adventures/roverDeliveryCopy';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', '..', '..', '..', 'public');
/** Host tile -> the game it opens while the switch is on. */
const GAMES = { memory: ['WobblyDelivery', WOBBLY_DELIVERY_COPY], pattern: ['FiveFriendSun', FIVE_FRIEND_SUN_COPY], puzzle: ['OopsButton', OOPS_BUTTON_COPY], 'river-rescue': ['RoverDelivery', ROVER_DELIVERY_COPY], 'rhythm-garden': ['HeroBand', HERO_BAND_COPY] } as const;
type Tile = keyof typeof GAMES;
const TILES = Object.keys(GAMES) as Tile[];
let store: Map<string, string>;
function open(search: string) { vi.stubGlobal('location', { search }); resetStudioNextFlagForTests(); resetHeroBandFlagForTests(); }
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  open('');
});
afterEach(() => { vi.unstubAllGlobals(); resetStudioNextFlagForTests(); resetHeroBandFlagForTests(); });

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
  it('gives each of the five game tiles its own cover, and only those', () => {
    store.set(STUDIO_NEXT_FLAG_KEY, '1'); open('');
    expect([...STUDIO_NEXT_HOSTS].sort()).toEqual(['memory', 'pattern', 'puzzle', 'river-rescue']);
    const covers = [...STUDIO_NEXT_HOSTS, 'rhythm-garden'].map(host => studioNextCover(host)!);
    expect(new Set(covers.map(cover => cover.src)).size).toBe(5);
    for (const cover of covers) {
      expect(cover.srcSet).toBe(`${cover.src480} 480w, ${cover.src} 1024w`);
      for (const file of [cover.src, cover.src480]) expect(existsSync(path.join(PUBLIC, file)), `${file} is not shipped`).toBe(true);
    }
    for (const other of ['feelings-forest', 'calm-builder', 'sneak', 'toString', '__proto__', '']) expect(studioNextCover(other)).toBeNull();
  });
  it("Hero Band's own switch shows its cover (v30 pavilion) and no other", () => {
    open('?heroBand=1');
    expect(studioNextFlagOn()).toBe(false);
    expect(studioNextCover('rhythm-garden')?.src).toBe('/visuals/studio-v2/bop/card-band.webp');
    for (const host of STUDIO_NEXT_HOSTS) expect(studioNextCover(host)).toBeNull();
  });
  it('names five tiles after the games they open, in both languages, and only while on', () => {
    const off = { en: studioCopy('en'), he: studioCopy('he') };
    expect(TILES.map(id => off.en.activities[id].title)).toEqual(['Memory Match', 'Sequence Quest', 'Puzzle Planet', 'Canal Quest', 'Sound Orbit']);
    open('?studioNext=1');
    for (const lang of ['en', 'he'] as const) {
      const on = studioCopy(lang);
      for (const id of TILES) {
        const { title, description, instruction } = GAMES[id][1][lang];
        expect(on.activities[id]).toEqual({ title, description, instruction });
        for (const line of [title, description, instruction]) expect(line.trim().length).toBeGreaterThan(3);
        expect(title).not.toBe(off[lang].activities[id].title);
      }
      for (const id of Object.keys(off[lang].activities) as (keyof typeof off.en.activities)[]) if (!TILES.includes(id as Tile)) expect(on.activities[id]).toBe(off[lang].activities[id]);
      expect(on.worlds).toBe(off[lang].worlds);
    }
    expect(new Set(TILES.map(id => GAMES[id][1].he.title)).size).toBe(5);
    for (const id of TILES) expect(GAMES[id][1].he.title).not.toBe(GAMES[id][1].en.title);
    open('?studioNext=0');
    expect(studioCopy('en')).toBe(off.en); expect(studioCopy('he')).toBe(off.he);
  });
  it('opens each new game from its host tile through the one loader table, keeping the accepted game for everyone else', () => {
    const loaders = readFileSync(path.join(HERE, '..', 'kidPrefetch.ts'), 'utf8');
    for (const id of TILES) {
      const line = loaders.split('\n').find(row => row.trimStart().startsWith(`${id}:`) || row.trimStart().startsWith(`'${id}':`)) ?? '';
      expect(line, `${id} loader`).toContain(`studioNextFlagOn() ? await import('./studioV2/games/adventures/${GAMES[id][0]}')`);
      expect(line.match(/await import\(/g), `${id} keeps both games`).toHaveLength(2);
      expect(existsSync(path.join(HERE, 'games', 'adventures', `${GAMES[id][0]}.tsx`)), `${GAMES[id][0]}.tsx`).toBe(true);
    }
    expect(loaders.match(/studioNextFlagOn\(\)/g)).toHaveLength(TILES.length);
  });
});
