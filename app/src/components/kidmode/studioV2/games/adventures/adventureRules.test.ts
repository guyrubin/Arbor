import { describe, expect, it } from 'vitest';
import { defaultChallenge, makeRiverMap, melodyFor, melodyMatches, riverComplete, riverHint, riverMove, shuffled } from './adventureRules';
import { FOREST_STORIES, FEELING_NAMES, ACTION_NAMES } from './forestStories';
import { studioActivityFits } from '../../studioCatalog';
import { studioCopy } from '../../studioCopy';
import { kidWorldByWorldId } from '../../../kidWorlds';
import { kidArt } from '../../../../../lib/kidThemeManifest';

describe('River Rescue solvability and legal moves', () => {
  it.each(['gentle', 'explore'] as const)('%s keeps every mission solvable in every orientation', challenge => {
    for (let round = 0; round < 3; round++) for (let variation = 0; variation < 8; variation++) {
      const map = makeRiverMap(challenge, round, variation);
      expect(riverComplete(map, map.solution)).toBe(true);
      expect(new Set(map.solution).size).toBe(map.solution.length);
      expect(map.solution.every(cell => !map.rocks.includes(cell))).toBe(true);
      let route = [map.start];
      while (!riverComplete(map, route)) {
        const next = riverHint(map, route);
        expect(next).not.toBeNull();
        expect(riverMove(map, route, next!)).toBe('ok');
        route = [...route, next!];
        expect(route.length).toBeLessThanOrEqual(map.size * map.size);
      }
    }
  });
  it('rejects jumping, row wrapping, repeats, rocks, malformed cells and missing supplies', () => {
    const map = makeRiverMap('gentle', 0, 0);
    expect(riverMove(map, [6], 5)).toBe('near');
    expect(riverMove(map, [6], 6)).toBe('used');
    expect(riverMove(map, [6], 0)).toBe('rock');
    for (const cell of [-1, 9, NaN, 3.1]) expect(riverMove(map, [6], cell)).toBe('rock');
    expect(riverMove(map, [6, 3, 4, 1], 2)).toBe('ok');
    expect(riverMove(map, [6, 7, 4, 5], 3)).toBe('near');
    expect(riverMove(map, [1], 2)).toBe('parcels');
    expect(riverComplete(map, [6, 2])).toBe(false);
    expect(riverComplete(map, [2])).toBe(false);
  });
  it('returns no fabricated hint for a dead end', () => {
    const map = makeRiverMap('gentle', 0, 0);
    expect(riverHint(map, [6, 3, 4, 7])).toBeNull();
    expect(riverHint(map, map.solution)).toBeNull();
  });
});
describe('Rhythm Garden sequence challenge', () => {
  it('uses the central age resolver only for a changeable initial challenge', () => {
    expect(defaultChallenge({ age: 4 })).toBe('gentle');
    expect(defaultChallenge({ age: 7 })).toBe('explore');
    expect(defaultChallenge(undefined)).toBe('gentle');
  });
  it('grows from two/three to four/five notes with no response deadline', () => {
    for (const challenge of ['gentle', 'explore'] as const) for (let round = 0; round < 3; round++) {
      const tune = melodyFor(challenge, round, () => .4);
      expect(tune.length).toBe((challenge === 'gentle' ? 2 : 3) + round);
      expect(tune.every(note => [0, 1, 2].includes(note))).toBe(true);
      expect(melodyMatches(tune, tune)).toBe(true);
      expect(melodyMatches(tune, tune.slice(1))).toBe(false);
      expect(melodyMatches(tune, [...tune, 0])).toBe(false);
    }
  });
  it('shuffles without mutating or losing the authored content', () => {
    const original = [1, 2, 3, 4]; expect(shuffled(original, () => .3).sort()).toEqual(original); expect(original).toEqual([1, 2, 3, 4]);
  });
});
describe('Three adventures belong to the real Studio contract', () => {
  it.each(['river-rescue', 'feelings-forest', 'rhythm-garden'] as const)('%s has eligibility, two languages, safe art and a keepsake registry entry', id => {
    expect(kidWorldByWorldId(id)?.worldId).toBe(id);
    for (const lang of ['en', 'he'] as const) {
      expect(studioActivityFits(id, { age: 5 }, lang)).toBe(true);
      expect(studioActivityFits(id, { age: 2 }, lang)).toBe(false);
      expect(studioActivityFits(id, undefined, lang)).toBe(false);
      expect(studioCopy(lang).activities[id].instruction.length).toBeGreaterThan(15);
    }
    for (const theme of ['film3d', 'storybook'] as const) expect(kidArt(theme, `world.${id}.tile`)?.hasHero).toBe(false);
  });
  it('authors six bilingual self-reported feelings and three supportive outcomes for each', () => {
    expect(FOREST_STORIES).toHaveLength(6);
    for (const story of FOREST_STORIES) for (const lang of ['en', 'he'] as const) {
      expect(story.story[lang].toLowerCase()).toContain(FEELING_NAMES[story.feeling][lang].toLowerCase());
      for (const action of ['together', 'space', 'help'] as const) {
        expect(ACTION_NAMES[action][lang].length).toBeGreaterThan(3);
        expect(story.responses[action][lang].length).toBeGreaterThan(35);
      }
    }
  });
});
