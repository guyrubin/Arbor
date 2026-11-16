import { describe, expect, it } from 'vitest';
import { STITCH_GARDEN_COPY } from './stitchGardenCopy';
import { TEXTILE_CELLS, TEXTILE_FLOWERS, TEXTILE_MAX_MOTIFS, freeCells, plant, reopenTextile, storyLines, textileOf, unpick, validTextile, type TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, CLOTH_R, HOOP_CX, HOOP_CY, STITCH_MS, UNPICK_MS, cellCentre, motifStitches, prng, seedFor, stitchesFor } from './stitchGardenStitches';
import { ARRIVE_MS, BEAT_STITCHES, HOLD_MS, HOME_MS, PARKED_NEEDLE, PASS_MIN_MS, TIE_MS, heldPose, landsAt, needleAt, passSpan, planMs, walkTo, type NeedlePlan } from './stitchGardenMotion';
import { CHAPTERS, FLOWER_LIKES, MAT_OVER_HOOP, MIN_TOUCH, PULLS, WANTS, chapterAfter, hoopCentre, layoutStage, openCells, passEnds, planRound, ringLights, stagePoint, suits, wantAt, type Box } from './stitchGardenPlay';
import { SCALE, degree, stitchNote, threadRoot } from './stitchGardenAudio';
import { critterStitches } from './stitchGardenCritters';
import { BUD, FERN, GOBGOB_GLAD, GOBGOB_WAITING, LEAFLAB, TABLE, WAITRING } from './stitchGardenKit';
import { TEXTILE_CLOTHS, TEXTILE_THREADS } from './stitchGardenRules';

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
  it('has a poem for every cloth, eight short lines each, and linen keeps the first one', () => {
    for (const lang of ['en', 'he'] as const) {
      const w = STITCH_GARDEN_COPY[lang];
      expect(Object.keys(w.stories).sort()).toEqual([...TEXTILE_CLOTHS].sort());
      expect(w.stories.linen).toBe(w.story);
      const all = TEXTILE_CLOTHS.flatMap(cloth => [...w.stories[cloth]]);
      expect(new Set(all).size).toBe(TEXTILE_CLOTHS.length * TEXTILE_MAX_MOTIFS);
      for (const cloth of TEXTILE_CLOTHS) {
        expect(w.stories[cloth], `${lang} ${cloth}`).toHaveLength(TEXTILE_MAX_MOTIFS);
        for (const line of w.stories[cloth]) { expect(line.length, line).toBeLessThanOrEqual(32); if (lang === 'he') { expect(line).toMatch(/[א-ת]/); expect(line).not.toMatch(/[A-Za-z]/); } }
      }
    }
  });
  it('keeps the three poems on the same beats: water second, a visitor fifth, the bud open seventh', () => {
    const en = STITCH_GARDEN_COPY.en.stories;
    for (const cloth of TEXTILE_CLOTHS) {
      expect(en[cloth][1], cloth).toMatch(/water/i);
      expect(en[cloth][4], cloth).toMatch(/bee|firefly|butterfly/i);
      expect(en[cloth][6], cloth).toMatch(/opened/i);
    }
    const he = STITCH_GARDEN_COPY.he.stories;
    for (const cloth of TEXTILE_CLOTHS) { expect(he[cloth][1], cloth).toMatch(/מים|משפך/); expect(he[cloth][6], cloth).toMatch(/נפתח/); }
  });
  it('keeps every cue to eight words or fewer, in both languages', () => {
    for (const lang of ['en', 'he'] as const) {
      const w = STITCH_GARDEN_COPY[lang];
      const cues = Object.entries(w).filter(([key, value]) => key.startsWith('cue') && typeof value === 'string').map(([, value]) => (value as string).replace('{flower}', w.flowers.sunflower));
      expect(cues.length).toBeGreaterThanOrEqual(10);
      for (const cue of [...cues, w.hello, w.growsLine, ...Object.values(w.suitsLine), ...w.ayaSays, ...w.captions, ...w.chapterDone]) expect(cue.trim().split(/\s+/).length, cue).toBeLessThanOrEqual(8);
      expect(w.chapters).toHaveLength(3);
      expect(w.threads).toHaveLength(TEXTILE_THREADS);
    }
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

describe('the needle', () => {
  const plan = (mode: NeedlePlan['mode'], startCount = 0): NeedlePlan => ({ mode, stitches: mode === 'flick' ? [] : stitchesFor('sunflower', 6), from: PARKED_NEEDLE, startCount });
  const finite = (f: ReturnType<typeof needleAt>) => [f.pose.x, f.pose.y, f.pose.angle, f.pose.z, f.pose.slack].every(Number.isFinite);
  it('leaves its cushion, stitches the whole flower in 1.6 s, ties off and comes home', () => {
    const p = plan('stitch'), total = p.stitches.length;
    expect(needleAt(p, 0).pose).toEqual(PARKED_NEEDLE);
    expect(needleAt(p, 0).count).toBe(0);
    expect(landsAt(p)).toBe(ARRIVE_MS + STITCH_MS);
    expect(planMs(p)).toBe(ARRIVE_MS + STITCH_MS + TIE_MS + HOME_MS);
    let last = 0;
    for (let t = 0; t <= planMs(p) + 50; t += 7) {
      const f = needleAt(p, t);
      expect(finite(f), `t=${t}`).toBe(true);
      expect(f.count).toBeGreaterThanOrEqual(last); expect(f.count).toBeLessThanOrEqual(total);
      last = f.count;
    }
    expect(needleAt(p, landsAt(p) - 1).count).toBe(total);
    expect(needleAt(p, landsAt(p) + 1).phase).toBe('tie');
    const end = needleAt(p, planMs(p));
    expect(end.phase).toBe('done'); expect(end.pose).toBe(PARKED_NEEDLE); expect(end.count).toBe(total);
  });
  it('works on the flower it is stitching: its point stays by the newest stitch', () => {
    const p = plan('stitch'), c = cellCentre(6);
    for (let t = ARRIVE_MS; t < landsAt(p); t += 11) {
      const f = needleAt(p, t);
      expect(f.phase).toBe('atWork');
      expect(Math.abs(f.pose.x - c.x)).toBeLessThan(50); expect(Math.abs(f.pose.y - c.y)).toBeLessThan(56);
      expect(f.pose.anchor).not.toBeNull();
    }
  });
  it('dips through the cloth once a beat and pulls the thread taut between dips', () => {
    const p = plan('stitch'), per = STITCH_MS / p.stitches.length;
    let dips = 0, wasDown = false, taut = 0;
    for (let t = ARRIVE_MS; t < landsAt(p); t += 2) {
      const f = needleAt(p, t), down = f.pose.z < -0.6;
      if (down && !wasDown) dips++;
      wasDown = down;
      if (f.pose.z > 0.6) { taut++; expect(f.pose.slack).toBeLessThan(0.4); }
      expect(f.pose.z).toBeGreaterThanOrEqual(-1); expect(f.pose.z).toBeLessThanOrEqual(1);
    }
    const beats = p.stitches.length / BEAT_STITCHES;
    expect(Math.abs(dips - beats)).toBeLessThanOrEqual(1);
    expect(taut).toBeGreaterThan(0);
    expect(needleAt(p, ARRIVE_MS + per * BEAT_STITCHES * 0.5).pose.z).toBeCloseTo(-1, 1);
    // One pluck of the tune for each dip.
    const heard = new Set<number>();
    for (let t = ARRIVE_MS; t < landsAt(p); t += 3) heard.add(needleAt(p, t).beat);
    expect(Math.abs(heard.size - beats)).toBeLessThanOrEqual(1.5);
  });
  it('unpicks from where the flower had got to, down to nothing, faster than it stitched', () => {
    const total = stitchesFor('sunflower', 6).length, half = plan('unpick', Math.floor(total / 2)), whole = plan('unpick', total);
    expect(needleAt(whole, 0).count).toBe(total);
    expect(needleAt(half, 0).count).toBe(Math.floor(total / 2));
    expect(landsAt(whole)).toBe(ARRIVE_MS + UNPICK_MS);
    expect(landsAt(half)).toBeLessThan(landsAt(whole));
    let last = total;
    for (let t = 0; t <= planMs(whole); t += 9) { const f = needleAt(whole, t); expect(finite(f)).toBe(true); expect(f.count).toBeLessThanOrEqual(last); last = f.count; }
    expect(needleAt(whole, landsAt(whole)).count).toBe(0);
    expect(needleAt(whole, planMs(whole)).pose).toBe(PARKED_NEEDLE);
  });
  it('hops in its cushion when it is tapped, and lands where it was', () => {
    const p = plan('flick');
    expect(needleAt(p, planMs(p) / 2).pose.y).toBeLessThan(PARKED_NEEDLE.y - 10);
    expect(needleAt(p, planMs(p)).pose).toBe(PARKED_NEEDLE);
    expect(needleAt(p, 0).count).toBe(0);
  });
  it('rests on the table, inside the drawing, and survives a clock that jumps', () => {
    expect(PARKED_NEEDLE.x).toBeGreaterThan(0); expect(PARKED_NEEDLE.x).toBeLessThan(ART_W);
    expect(PARKED_NEEDLE.y).toBeGreaterThan(0); expect(PARKED_NEEDLE.y).toBeLessThan(ART_H);
    expect(Math.hypot(PARKED_NEEDLE.x - HOOP_CX, PARKED_NEEDLE.y - HOOP_CY)).toBeGreaterThan(CLOTH_R);
    for (const t of [-5, Number.NaN, 1e9]) expect(Number.isFinite(needleAt(plan('stitch'), t).pose.x)).toBe(true);
    expect(needleAt({ mode: 'stitch', stitches: [], from: PARKED_NEEDLE, startCount: 0 }, 100).phase).toBe('done');
  });
  it('sends the ladybird the short way round the hoop', () => {
    expect(walkTo(-90, 80)).toBe(80);
    expect(walkTo(170, -170)).toBe(190);
    expect(walkTo(-170, 170)).toBe(-190);
    expect(walkTo(720, 10) - 720).toBe(10);
  });
});

describe('sound, as numbers', () => {
  it('draws every note from one pentatonic scale, so overlapping sounds agree', () => {
    const pitchClass = (f: number) => Math.round(12 * Math.log2(f / 261.63) + 120) % 12;
    expect(new Set(SCALE.map(pitchClass))).toEqual(new Set([0, 2, 4, 7, 9]));
    for (let thread = 0; thread < TEXTILE_THREADS; thread++) for (const part of ['stem', 'leaf', 'petal', 'centre'] as const) for (let beat = 0; beat < 12; beat++) {
      const f = stitchNote(thread, beat, part);
      expect(SCALE).toContain(f);
      expect(f).toBeGreaterThanOrEqual(261); expect(f).toBeLessThanOrEqual(1760);
    }
    // The shared tap sound (E5) belongs to the same scale.
    expect([0, 2, 4, 7, 9]).toContain(pitchClass(660));
  });
  it('gives each thread its own voice, and the tune climbs from stem to centre', () => {
    expect(new Set(Array.from({ length: TEXTILE_THREADS }, (_, t) => threadRoot(t))).size).toBe(TEXTILE_THREADS);
    const mean = (part: 'stem' | 'leaf' | 'petal' | 'centre') => [0, 1, 2, 3, 4, 5].reduce((sum, b) => sum + stitchNote(2, b, part), 0) / 6;
    expect(mean('stem')).toBeLessThan(mean('leaf')); expect(mean('leaf')).toBeLessThan(mean('petal')); expect(mean('petal')).toBeLessThan(mean('centre'));
    expect(degree(-4)).toBe(SCALE[0]); expect(degree(99)).toBe(SCALE[SCALE.length - 1]);
    expect(new Set([0, 1, 2, 3].map(b => stitchNote(0, b, 'petal'))).size).toBeGreaterThan(2);
  });
});

describe('the table', () => {
  it('stitches the four visitors in thread, small enough to sit on a flower', () => {
    for (const kind of ['honeyBee', 'fireFly', 'butterFly', 'ladyBird'] as const) {
      const c = critterStitches(kind), all = [...c.body, ...c.wings, ...c.legs].flatMap(l => l.stitches);
      expect(all.length, kind).toBeGreaterThanOrEqual(12);
      expect(critterStitches(kind)).toBe(c);
      for (const l of [...c.body, ...c.wings, ...c.legs]) { expect(l.thread).toBeGreaterThanOrEqual(0); expect(l.thread).toBeLessThan(TEXTILE_THREADS); }
      for (const s of all) for (const v of [s.x1, s.y1, s.x2, s.y2]) expect(Math.abs(v), kind).toBeLessThan(16);
    }
    expect(critterStitches('fireFly').lamp).not.toBeNull();
    expect(critterStitches('honeyBee').wings.length).toBeGreaterThan(0);
    expect(critterStitches('ladyBird').legs.length).toBeGreaterThan(0);
  });
  it('takes its pictures from the kit only, each with its source, and names GobGob in every file that shows him', () => {
    expect(TABLE.src).toMatch(/^\/visuals\/studio-v2\/bop\/scene-table\.webp$/);
    expect(TABLE.ringAt).toBeGreaterThan(CLOTH_R + 20);
    expect(BUD).toHaveLength(3);
    for (const picture of BUD) { expect(picture.src).toMatch(/^\/visuals\/studio-v2\/makers\/kit-prop-planter-(bud|budding|bloom)\.webp$/); expect(picture.from).toMatch(/^kit\//); }
    expect(WAITRING.lights).toHaveLength(4);
    for (const l of WAITRING.lights) { expect(l.x + l.w).toBeLessThanOrEqual(1); expect(l.y + l.h).toBeLessThanOrEqual(1); }
    // No picture that shows a child goes without his name in its file name.
    for (const picture of [TABLE, ...BUD, WAITRING, LEAFLAB, FERN]) if (picture) expect(picture.src).not.toMatch(/face|front|side|back|bebe|gobgob|crew/);
    expect(FERN.src).toMatch(/^\/visuals\/studio-v2\/bop\/rover-planter\.webp$/);
    for (const picture of [GOBGOB_WAITING, GOBGOB_GLAD]) if (picture) { expect(picture.src).toMatch(/\/kit-gobgob-/); expect(picture.from).toMatch(/gobgob/); }
  });
});

describe('the round: three chapters, drawn from a seed', () => {
  const seeds = [1, 2, 3, 7, 11, 42, 99, 12345, 777777, 2147483646];
  it('plans the same round for the same seed, and not the same round every time', () => {
    for (const seed of seeds) expect(planRound(seed, 2)).toEqual(planRound(seed, 2));
    expect(new Set(seeds.map(seed => JSON.stringify(planRound(seed).row))).size).toBeGreaterThan(3);
    expect(new Set(seeds.map(seed => planRound(seed).firstCell)).size).toBe(2);
    // The cloth comes round in turn from one sitting to the next.
    expect(new Set([0, 1, 2].map(sitting => planRound(5, sitting).cloth)).size).toBe(3);
  });
  it('gives chapter one a middle mark, and chapter two three spots of one outer row: sun, water and shade, once each', () => {
    for (const seed of seeds) {
      const plan = planRound(seed);
      expect([5, 6]).toContain(plan.firstCell);
      expect(plan.row).toHaveLength(3);
      expect(new Set(plan.row.map(s => Math.floor(s.cell / 4))).size).toBe(1);
      expect([0, 2]).toContain(Math.floor(plan.row[0].cell / 4));
      expect([...plan.row.map(s => s.want)].sort()).toEqual([...WANTS].sort());
      expect(plan.row.map(s => s.cell)).not.toContain(plan.firstCell);
      expect(TEXTILE_FLOWERS).toContain(plan.flower);
      expect(plan.thread).toBeGreaterThanOrEqual(0); expect(plan.thread).toBeLessThan(TEXTILE_THREADS);
      expect(plan.packetTurns).toHaveLength(6);
      for (const turn of plan.packetTurns) expect(Math.abs(turn)).toBeLessThanOrEqual(7);
    }
  });
  it('opens one mark, then the row, then the whole cloth, and only ever moves on', () => {
    const plan = planRound(42);
    let motifs: TextileMotif[] = [], chapter = 0;
    expect(openCells(plan, chapter, freeCells(motifs))).toEqual([plan.firstCell]);
    motifs = plant(motifs, 'daisy', plan.firstCell, 0)!; chapter = chapterAfter(plan, chapter, motifs);
    expect(chapter).toBe(1);
    expect(openCells(plan, chapter, freeCells(motifs))).toEqual(plan.row.map(s => s.cell));
    motifs = plant(motifs, 'tulip', plan.row[0].cell, 1)!; chapter = chapterAfter(plan, chapter, motifs);
    expect(chapter).toBe(1);
    expect(openCells(plan, chapter, freeCells(motifs))).toEqual(plan.row.slice(1).map(s => s.cell));
    motifs = plant(plant(motifs, 'poppy', plan.row[1].cell, 2)!, 'bluebell', plan.row[2].cell, 3)!; chapter = chapterAfter(plan, chapter, motifs);
    expect(chapter).toBe(CHAPTERS.length - 1);
    expect(openCells(plan, chapter, freeCells(motifs))).toHaveLength(TEXTILE_CELLS - 4);
    // Unpicking never sends the child back a chapter, and the cloth stays free.
    motifs = unpick(unpick(unpick(motifs)));
    expect(chapterAfter(plan, chapter, motifs)).toBe(2);
    expect(openCells(plan, 2, freeCells(motifs))).toHaveLength(TEXTILE_CELLS - 1);
    // Four flowers by the end of chapter two leaves room for four more in the border.
    expect(TEXTILE_MAX_MOTIFS - 4).toBe(4);
  });
  it('makes a match a flourish, never a rule: every flower likes something, and each may go on every spot', () => {
    const plan = planRound(7);
    for (const flower of TEXTILE_FLOWERS) {
      expect(WANTS).toContain(FLOWER_LIKES[flower]);
      for (const spot of plan.row) { expect(plant([], flower, spot.cell, 0)).not.toBeNull(); expect(suits(plan, flower, spot.cell)).toBe(FLOWER_LIKES[flower] === spot.want); }
      expect(suits(plan, flower, plan.firstCell)).toBe(false);
    }
    for (const want of WANTS) expect(TEXTILE_FLOWERS.some(f => FLOWER_LIKES[f] === want), want).toBe(true);
    expect(wantAt(plan, plan.firstCell)).toBeNull();
    for (const lang of ['en', 'he'] as const) for (const want of WANTS) { expect(STITCH_GARDEN_COPY[lang].wantNames[want]).toBeTruthy(); expect(STITCH_GARDEN_COPY[lang].likes[want]).toBeTruthy(); expect(STITCH_GARDEN_COPY[lang].suitsLine[want]).toBeTruthy(); }
  });
});

describe('pulling the thread', () => {
  it('sews every flower in four pulls, each a fair share of the work, ending on the whole flower', () => {
    for (const flower of TEXTILE_FLOWERS) for (let cell = 0; cell < TEXTILE_CELLS; cell++) {
      const stitches = stitchesFor(flower, cell), ends = passEnds(stitches);
      expect(ends, flower).toHaveLength(PULLS);
      expect(ends[ends.length - 1]).toBe(stitches.length);
      let from = 0;
      for (const end of ends) { expect(end - from, `${flower}:${cell}`).toBeGreaterThanOrEqual(3); expect(end - from, `${flower}:${cell}`).toBeLessThanOrEqual(stitches.length * 0.42); from = end; }
    }
    expect(passEnds([])).toEqual([]);
    expect(passEnds([{ part: 'stem' }, { part: 'leaf' }])).toEqual([1, 2]);
  });
  it('ends a pull where the needlework changes when a change is near', () => {
    const stitches = stitchesFor('tulip', 5), ends = passEnds(stitches);
    const changes = stitches.map((s, i) => (i > 0 && s.part !== stitches[i - 1].part ? i : -1)).filter(i => i > 0);
    expect(ends.slice(0, -1).filter(end => changes.includes(end)).length).toBeGreaterThanOrEqual(1);
  });
  it('lights one more light of the WaitRing for each pull', () => {
    expect([0, 1, 2, 3, 4].map(done => ringLights(done, 4))).toEqual([0, 1, 2, 3, 4]);
    expect(ringLights(0, 0)).toBe(0); expect(ringLights(9, 4)).toBe(4);
  });
  it('lays only its own stitches in one pull, then lifts and holds the thread over the work', () => {
    const stitches = stitchesFor('poppy', 6), ends = passEnds(stitches);
    const plan: NeedlePlan = { mode: 'stitch', stitches, from: PARKED_NEEDLE, startCount: ends[0], first: ends[0], last: ends[1], tieOff: false };
    const span = passSpan(plan);
    expect(span).toMatchObject({ lo: ends[0], hi: ends[1] });
    expect((span.hi - span.lo) * span.per).toBeGreaterThanOrEqual(PASS_MIN_MS - 1);
    expect(needleAt(plan, 0).count).toBe(ends[0]);
    expect(needleAt(plan, ARRIVE_MS + 1).count).toBe(ends[0] + 1);
    const landed = needleAt(plan, landsAt(plan) + 1);
    expect(landed.count).toBe(ends[1]); expect(landed.phase).toBe('hold');
    const end = needleAt(plan, planMs(plan) + 1);
    expect(end.phase).toBe('done'); expect(end.count).toBe(ends[1]);
    expect(planMs(plan)).toBeCloseTo(landsAt(plan) + HOLD_MS, 5);
    // It waits where it stopped, lifted, the thread still running from its last stitch.
    expect(end.pose).toEqual(heldPose(plan));
    expect(end.pose.anchor).not.toBeNull(); expect(end.pose.z).toBeGreaterThan(0.5);
    const lastStitch = stitches[ends[1] - 1];
    expect(Math.hypot(end.pose.x - (lastStitch.knot ? lastStitch.x1 : lastStitch.x2), end.pose.y - (lastStitch.knot ? lastStitch.y1 : lastStitch.y2))).toBeLessThan(14);
    for (let t = 0; t < planMs(plan); t += 23) { const f = needleAt(plan, t); expect(f.count).toBeGreaterThanOrEqual(ends[0]); expect(f.count).toBeLessThanOrEqual(ends[1]); }
  });
  it('ties off and goes home after the last pull, and the four pulls together lay every stitch once', () => {
    const stitches = stitchesFor('daisy', 2), ends = passEnds(stitches);
    let from = PARKED_NEEDLE, count = 0;
    ends.forEach((last, i) => {
      const first = i === 0 ? 0 : ends[i - 1], tieOff = i === ends.length - 1;
      const plan: NeedlePlan = { mode: 'stitch', stitches, from, startCount: first, first, last, tieOff };
      const end = needleAt(plan, planMs(plan) + 1);
      expect(end.count).toBe(last); expect(end.count).toBeGreaterThan(count); count = end.count;
      if (tieOff) { expect(end.pose).toEqual(PARKED_NEEDLE); expect(planMs(plan)).toBeGreaterThan(landsAt(plan) + TIE_MS); }
      from = end.pose;
    });
    expect(count).toBe(stitches.length);
  });
});

describe('the table, laid out for any stage', () => {
  const stages: [number, number, string][] = [[390, 768, 'phone'], [360, 564, 'small phone'], [844, 314, 'phone on its side'], [1024, 692, 'tablet'], [820, 1104, 'tablet upright'], [1280, 724, 'desktop'], [1920, 1004, 'wide desktop']];
  const inside = (box: Box, w: number, h: number, slack = 1) => box.x >= -slack && box.y >= -slack && box.x + box.w <= w + slack && box.y + box.h <= h + slack;
  const apart = (a: Box, b: Box) => a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1;
  it('keeps the hoop and every picker on the stage, big enough for a small finger', () => {
    for (const [w, h, name] of stages) {
      const l = layoutStage(w, h, planRound(3).packetTurns);
      expect(l.tall, name).toBe(h > w * 1.08);
      const circle = { x: l.hoop.x + (HOOP_CX - CLOTH_R - 22) * l.k, y: l.hoop.y + (HOOP_CY - CLOTH_R - 22) * l.k, w: (CLOTH_R + 22) * 2 * l.k, h: (CLOTH_R + 22) * 2 * l.k };
      expect(inside(circle, w, h, 2), `${name} hoop`).toBe(true);
      expect(circle.w, `${name} hoop size`).toBeGreaterThanOrEqual(Math.min(w, h) * 0.5);
      expect(l.packets).toHaveLength(5); expect(l.spools).toHaveLength(5);
      for (const box of [...l.packets, ...l.spools, l.cloths, l.basket]) {
        expect(inside(box, w, h), `${name} picker on stage`).toBe(true);
        expect(apart(box, circle), `${name} picker clear of the hoop`).toBe(true);
      }
      for (const box of [...l.packets, l.cloths]) { expect(box.w, name).toBeGreaterThanOrEqual(MIN_TOUCH); expect(box.h, name).toBeGreaterThanOrEqual(MIN_TOUCH); }
      for (const box of l.spools) { expect(box.w, name).toBeGreaterThanOrEqual(MIN_TOUCH * 0.9); expect(box.h, name).toBeGreaterThanOrEqual(MIN_TOUCH); expect(inside(box, l.basket.x + l.basket.w, l.basket.y + l.basket.h)).toBe(true); }
      for (let i = 1; i < 5; i++) expect(l.spools[i].x, name).toBeGreaterThanOrEqual(l.spools[i - 1].x + l.spools[i - 1].w - 0.5);
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(apart(l.packets[i], l.packets[j]), `${name} packets ${i} ${j}`).toBe(true);
      for (const packet of l.packets) for (const spool of l.spools) expect(apart(packet, spool), `${name} rows`).toBe(true);
      expect(apart(l.cloths, l.basket), name).toBe(true);
      // The linen mat is centred under the hoop and a little bigger than it, so its teal edge shows all round the wood.
      expect(l.table.cx).toBeCloseTo(circle.x + circle.w / 2, 3); expect(l.table.cy).toBeCloseTo(circle.y + circle.h / 2, 3);
      expect(l.table.ring).toBeCloseTo(circle.w / 2 * MAT_OVER_HOOP, 3);
    }
  });
  it('puts the hoop above the sewing things on a tall stage and beside them on a wide one', () => {
    const tall = layoutStage(390, 768), wide = layoutStage(1280, 724);
    expect(tall.packets[0].y).toBeGreaterThan(tall.hoop.y + (HOOP_CY + CLOTH_R) * tall.k);
    expect(wide.packets[0].x).toBeGreaterThan(wide.hoop.x + (HOOP_CX + CLOTH_R) * wide.k);
    expect(hoopCentre(tall).x).toBeCloseTo(0.5, 2);
    expect(hoopCentre(wide).x).toBeLessThan(0.45);
    const p = stagePoint(wide, HOOP_CX, HOOP_CY);
    expect(p).toEqual(hoopCentre(wide)); expect(p.y).toBeGreaterThan(0.3); expect(p.y).toBeLessThan(0.7);
  });
});
