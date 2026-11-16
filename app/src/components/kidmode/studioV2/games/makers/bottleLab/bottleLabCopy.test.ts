import { describe, expect, it } from 'vitest';
import { BOTTLE_LAB_COPY } from './bottleLabCopy';
import { BOTTLE_FINISHES, BOTTLE_SHAPES, BOTTLE_STICKERS, BOTTLE_TINTS } from './bottleLabRules';
import { CHAPTERS } from './glassworks';
import type { SayId } from './glassScene';

const shape = (value: unknown): unknown => Array.isArray(value) ? value.map(shape) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, shape((value as Record<string, unknown>)[k])])) : typeof value;
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const SAYS: readonly SayId[] = ['pulled', 'tall', 'round', 'flask', 'tinted', 'frosted', 'polished', 'stuck', 'full', 'peeled', 'turned', 'rang', 'aya', 'arch', 'secret', 'behind', 'light'];

describe('Bottle Lab words', () => {
  const { en, he } = BOTTLE_LAB_COPY;
  it('English and Hebrew say the same things: one shape, no empty string', () => {
    expect(shape(he)).toEqual(shape(en));
    for (const s of [...strings(en), ...strings(he)]) expect(s.trim().length).toBeGreaterThan(0);
  });
  it('Hebrew is Hebrew: no Latin letters anywhere', () => {
    for (const s of strings(he)) expect(s, s).not.toMatch(/[A-Za-z]/);
  });
  it('every line Aya says on the glass is eight words or fewer, in both languages', () => {
    for (const copy of [en, he]) for (const line of Object.values(copy.line)) expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(8);
  });
  it('every chapter has its name, its one action and its closing word; every thing in the scene has a name', () => {
    for (const copy of [en, he]) {
      for (const c of CHAPTERS) { expect(copy.quest[c]).toBeTruthy(); expect(copy.go[c]).toBeTruthy(); expect(copy.done[c]).toBeTruthy(); }
      expect(copy.go.finale).toBeTruthy();
      for (const s of BOTTLE_SHAPES) expect(copy.shapes[s]).toBeTruthy();
      for (const t of BOTTLE_TINTS) expect(copy.tints[t]).toBeTruthy();
      for (const f of BOTTLE_FINISHES) expect(copy.finishes[f]).toBeTruthy();
      for (const a of BOTTLE_STICKERS) expect(copy.stickers[a]).toBeTruthy();
      expect(copy.rows).toHaveLength(3); expect(copy.reach.arch).toHaveLength(3);
      for (const say of SAYS) expect(copy.line[say], say).toBeTruthy();
    }
  });
  it('the fill-in places are the same in both languages', () => {
    const holes = (s: string) => (s.match(/\{\d\}/g) ?? []).sort().join();
    for (const key of ['disc', 'rub', 'stickOn', 'peel'] as const) { expect(holes(he.reach[key])).toBe(holes(en.reach[key])); expect(holes(en.reach[key])).not.toBe(''); }
  });
  it('nothing grades the child or sells anything', () => {
    for (const s of strings(en)) expect(s.toLowerCase(), s).not.toMatch(/\b(wrong|score|points|win|lose|fail|buy|price|shop|best|perfect)\b/);
  });
});
