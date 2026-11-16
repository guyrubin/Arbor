import { describe, expect, it } from 'vitest';
import { STITCH_GARDEN_COPY } from './stitchGardenCopy';
import { TEXTILE_CELLS, TEXTILE_FLOWERS, TEXTILE_MAX_MOTIFS, freeCells, plant, reopenTextile, storyLines, textileOf, unpick, validTextile, type TextileMotif } from './stitchGardenRules';
import { CLOTH_R, HOOP_CX, HOOP_CY, STITCH_MS, cellCentre, motifStitches, prng, seedFor, stitchesFor } from './stitchGardenStitches';

const fill = (n: number) => { let m: TextileMotif[] = []; for (let i = 0; i < n; i++) m = plant(m, TEXTILE_FLOWERS[i % 5], i, i % 5)!; return m; };

describe('plant and unpick', () => {
  it('plants the chosen flower, on the chosen cell, in the chosen thread, without touching the old list', () => {
    const before: TextileMotif[] = [];
    const after = plant(before, 'poppy', 7, 3);
    expect(after).toEqual([{ flower: 'poppy', cell: 7, thread: 3 }]);
    expect(before).toEqual([]);
  });
  it('rejects a used cell, a ninth flower and anything outside the toy', () => {
    const one = plant([], 'daisy', 2, 0)!;
    expect(plant(one, 'tulip', 2, 1)).toBeNull();
    expect(plant(fill(TEXTILE_MAX_MOTIFS), 'tulip', 11, 1)).toBeNull();
    expect(plant([], 'rose' as never, 0, 0)).toBeNull();
    expect(plant([], 'daisy', 12, 0)).toBeNull();
    expect(plant([], 'daisy', -1, 0)).toBeNull();
    expect(plant([], 'daisy', 1.5, 0)).toBeNull();
    expect(plant([], 'daisy', 0, 5)).toBeNull();
  });
  it('unpick removes exactly the last flower stitched, and an empty hoop stays empty', () => {
    const three = plant(plant(plant([], 'daisy', 0, 0)!, 'tulip', 5, 1)!, 'sunflower', 9, 2)!;
    expect(unpick(three)).toEqual(three.slice(0, 2));
    expect(unpick(unpick(unpick(three)))).toEqual([]);
    expect(unpick([])).toEqual([]);
  });
  it('lists the free cells, and none once the hoop holds eight', () => {
    expect(freeCells([])).toHaveLength(TEXTILE_CELLS);
    expect(freeCells(plant([], 'daisy', 4, 0)!)).not.toContain(4);
    expect(freeCells(fill(TEXTILE_MAX_MOTIFS))).toEqual([]);
  });
});

describe('the hem story', () => {
  it('has eight authored lines in each language, one per flower, the last naming the whole garden', () => {
    for (const lang of ['en', 'he'] as const) {
      const story = STITCH_GARDEN_COPY[lang].story;
      expect(story).toHaveLength(TEXTILE_MAX_MOTIFS);
      expect(new Set(story).size).toBe(story.length);
      for (const line of story) expect(line.length).toBeLessThanOrEqual(32);
    }
    expect(STITCH_GARDEN_COPY.en.story[7]).toBe('Now the whole garden is awake.');
    for (const line of STITCH_GARDEN_COPY.he.story) { expect(line).toMatch(/[א-ת]/); expect(line).not.toMatch(/[A-Za-z]/); }
  });
  it('shows one line per flower, and unpicking takes the newest line away', () => {
    const story = STITCH_GARDEN_COPY.en.story;
    const three = fill(3);
    expect(storyLines(story, three.length)).toEqual(story.slice(0, 3));
    expect(storyLines(story, unpick(three).length)).toEqual(story.slice(0, 2));
    expect(storyLines(story, 0)).toEqual([]);
    expect(storyLines(story, 20)).toHaveLength(8);
  });
});

describe('the kept textile', () => {
  it('is the cloth and the flowers in stitching order, valid for the store', () => {
    const motifs = fill(4);
    const made = textileOf('indigo', motifs)!;
    expect(made).toEqual({ kind: 'textile', cloth: 'indigo', motifs });
    expect(validTextile(made)).toBe(true);
    expect(textileOf('sage', [])).toBeNull();
  });
  it('validTextile keeps the wired contract', () => {
    expect(validTextile({ kind: 'textile', cloth: 'sage', motifs: [{ flower: 'poppy', cell: 5, thread: 2 }] })).toBe(true);
    expect(validTextile({ kind: 'textile', cloth: 'silk', motifs: [{ flower: 'poppy', cell: 5, thread: 2 }] })).toBe(false);
    expect(validTextile({ kind: 'textile', cloth: 'sage', motifs: [] })).toBe(false);
    expect(validTextile({ kind: 'textile', cloth: 'sage', motifs: [{ flower: 'poppy', cell: 5, thread: 2 }, { flower: 'daisy', cell: 5, thread: 1 }] })).toBe(false);
    expect(validTextile({ kind: 'textile', cloth: 'sage', motifs: fill(8).concat({ flower: 'daisy', cell: 11, thread: 0 }) })).toBe(false);
  });
  it('reopens a kept cloth as a clean copy that re-renders stitch for stitch', () => {
    const kept = { kind: 'textile', cloth: 'linen', motifs: [{ flower: 'tulip', cell: 3, thread: 1, extra: 'x' }] };
    const open = reopenTextile(kept)!;
    expect(open).toEqual({ kind: 'textile', cloth: 'linen', motifs: [{ flower: 'tulip', cell: 3, thread: 1 }] });
    expect(open.motifs[0]).not.toBe(kept.motifs[0]);
    expect(open.motifs.map(m => stitchesFor(m.flower, m.cell))).toEqual(kept.motifs.map(m => stitchesFor(m.flower as 'tulip', m.cell)));
    expect(reopenTextile({ kind: 'bowl' })).toBeNull();
  });
});

describe('stitchesFor: the embroidery', () => {
  it('is deterministic: the same flower on the same cell is the same stitches', () => {
    for (const flower of TEXTILE_FLOWERS) for (const cell of [0, 6, 11]) expect(stitchesFor(flower, cell)).toEqual(stitchesFor(flower, cell));
    expect(prng(seedFor('daisy', 3))()).toBe(prng(seedFor('daisy', 3))());
  });
  it('gives each flower 35 to 60-odd stitches, timed to about 1.6 s', () => {
    for (const flower of TEXTILE_FLOWERS) for (let cell = 0; cell < TEXTILE_CELLS; cell++) {
      const n = stitchesFor(flower, cell).length;
      expect(n, `${flower}@${cell}`).toBeGreaterThanOrEqual(35);
      expect(n, `${flower}@${cell}`).toBeLessThanOrEqual(64);
    }
    expect(STITCH_MS).toBe(1600);
  });
  it('works in order: stem, then leaves, then petals, then the centre', () => {
    const rank = { stem: 0, leaf: 1, petal: 2, centre: 3 } as const;
    for (const flower of ['daisy', 'tulip', 'poppy', 'sunflower'] as const) {
      const parts = stitchesFor(flower, 5).map(s => rank[s.part]);
      // Leaves may be laid before the stem's last stitch only for the bluebell (excluded); the others go strictly in order.
      expect(parts, flower).toEqual([...parts].sort((a, b) => a - b));
    }
    const bell = stitchesFor('bluebell', 5);
    expect(bell.findIndex(s => s.part === 'petal')).toBeGreaterThan(bell.findIndex(s => s.part === 'stem'));
  });
  it('uses the right stitch for each part: french knots in the centre, satin and loops in the petals', () => {
    const daisy = stitchesFor('daisy', 0);
    expect(daisy.filter(s => s.knot).every(s => s.part === 'centre')).toBe(true);
    expect(daisy.filter(s => s.part === 'centre' && s.knot).length).toBeGreaterThanOrEqual(5);
    expect(daisy.filter(s => s.part === 'petal' && s.cx !== undefined).length).toBe(20);
    expect(stitchesFor('tulip', 0).some(s => s.knot)).toBe(false);
    expect(stitchesFor('sunflower', 0).filter(s => s.knot).length).toBe(10);
  });
  it('makes the five flowers different plants, not recoloured copies', () => {
    const shapes = TEXTILE_FLOWERS.map(flower => motifStitches(flower, 5));
    const signature = shapes.map(s => `${s.length}:${s.filter(x => x.part === 'petal').length}:${s.filter(x => x.knot).length}`);
    expect(new Set(signature).size).toBe(5);
    const heights = shapes.map(s => Math.min(...s.map(x => Math.min(x.y1, x.y2))));
    expect(new Set(heights.map(h => Math.round(h))).size).toBeGreaterThan(2);
  });
  it('varies by cell (a hand, not a stamp) but stays on its cell and inside the hoop', () => {
    expect(motifStitches('poppy', 1)).not.toEqual(motifStitches('poppy', 2));
    for (const flower of TEXTILE_FLOWERS) for (let cell = 0; cell < TEXTILE_CELLS; cell++) {
      const c = cellCentre(cell);
      for (const s of stitchesFor(flower, cell)) for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        expect(Math.hypot(x - HOOP_CX, y - HOOP_CY), `${flower}@${cell}`).toBeLessThan(CLOTH_R - 4);
        expect(Math.abs(x - c.x), `${flower}@${cell}`).toBeLessThan(46);
        expect(y - c.y).toBeGreaterThan(-52); expect(y - c.y).toBeLessThan(46);
      }
    }
  });
  it('keeps the tones each part should have: thread for petals, garden greens for stems', () => {
    for (const flower of TEXTILE_FLOWERS) {
      const st = stitchesFor(flower, 8);
      expect(st.filter(s => s.part === 'stem').every(s => ['leaf', 'leafDeep', 'moss'].includes(s.tone)), flower).toBe(true);
      expect(st.filter(s => s.part === 'petal').every(s => s.tone === 'thread' || s.tone === 'threadDeep'), flower).toBe(true);
    }
  });
  it('rejects a cell off the grid', () => {
    expect(stitchesFor('daisy', 12)).toEqual([]);
  });
});
