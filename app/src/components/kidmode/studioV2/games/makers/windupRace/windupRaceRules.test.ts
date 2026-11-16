import { describe, expect, it } from 'vitest';
import { CAR_HALF, CHALK_KEEP, CLOSE_CALL, CLOSE_LEAD, MAX_CLICKS, PLAY_LENGTH, ROOM_LIGHTS, TRACKS, TRACK_SETS, addChalk, closeCallAt, dragKey, keyGain, leanAt, minimumClicks, nextTrack, pointAt, roomLight, sampleAt, simulate, slopeAt, springEnergy, tension, trackSet, wheelAngle, wind } from './windupRaceRules';

const [shelf, ramp, table, blockBridge, bookSlide, grandTour] = TRACKS;
const ALL = Array.from({ length: MAX_CLICKS + 1 }, (_, clicks) => clicks);

describe('the spring', () => {
  it('each click stores the same energy, up to twelve clicks', () => {
    expect(springEnergy(0)).toBe(0);
    for (const c of ALL.slice(1)) expect(springEnergy(c)).toBeCloseTo(springEnergy(1) * c);
    expect(springEnergy(40)).toBe(springEnergy(MAX_CLICKS));
    expect(wind(0)).toBe(1); expect(wind(11)).toBe(12); expect(wind(12)).toBe(12); expect(wind(Number.NaN)).toBe(1);
  });
  it('the key gets stiffer: a full click takes a longer swirl as the spring tightens', () => {
    for (const c of ALL.slice(1)) expect(keyGain(c)).toBeLessThan(keyGain(c - 1));
    // One finger turn on a loose spring makes one click; on a tight spring it does not.
    expect(dragKey(0, 0, 1).made).toBe(1);
    expect(dragKey(8, 0, 1).made).toBe(0);
    expect(dragKey(8, 0, 1 / keyGain(8)).made).toBe(1);
  });
  it('the ratchet holds: turning back does nothing, and the key stops at full', () => {
    expect(dragKey(3, 0.4, -2)).toEqual({ clicks: 3, turn: 0.4, made: 0 });
    expect(dragKey(11, 0, 50)).toEqual({ clicks: 12, turn: 0, made: 1 });
    expect(dragKey(12, 0, 3).made).toBe(0);
    const swirl = dragKey(0, 0, 3.5);
    expect(swirl.clicks).toBe(3); expect(swirl.turn).toBeGreaterThan(0);
  });
  it('tension words never show a number', () => {
    expect(ALL.map(tension)).toEqual(['loose', 'little', 'little', 'little', 'half', 'half', 'half', 'half', 'tight', 'tight', 'tight', 'tight', 'full']);
  });
});

describe('the run', () => {
  it.each(TRACKS.map(track => [track.id, track] as const))('%s: more wind always goes further (nose reach strictly increases)', (_id, track) => {
    const reach = ALL.map(c => simulate(track, c).reach);
    for (let c = 1; c < reach.length; c++) expect(reach[c], `${c} clicks`).toBeGreaterThan(reach[c - 1]);
    // And measurably: every click before the flag adds a visible stretch of table.
    const first = minimumClicks(track)!;
    for (let c = 1; c < first; c++) expect(reach[c] - reach[c - 1], `${c} clicks`).toBeGreaterThan(40);
  });
  it('is deterministic: the same wind ends in the same place', () => {
    for (const track of TRACKS) for (const c of [3, 7, 12]) expect(simulate(track, c)).toEqual(simulate(track, c));
  });
  it('each track asks for its own amount of wind: about 4, 7 and 10 clicks', () => {
    expect(minimumClicks(shelf)).toBe(4);
    expect(minimumClicks(ramp)).toBe(7);
    expect(minimumClicks(table)).toBe(10);
  });
  it('the second set asks for 5, 8 and 11 clicks, and every track can be finished with the key full', () => {
    expect(minimumClicks(blockBridge)).toBe(5);
    expect(minimumClicks(bookSlide)).toBe(8);
    expect(minimumClicks(grandTour)).toBe(11);
    for (const track of TRACKS) expect(minimumClicks(track), track.id).toBeLessThanOrEqual(MAX_CLICKS - 1);
  });
  it('every track is well formed: start, flag and cushion in order on the rolling line', () => {
    expect(new Set(TRACKS.map(track => track.id)).size).toBe(TRACKS.length);
    for (const track of TRACKS) {
      expect(track.start).toBeGreaterThanOrEqual(CAR_HALF);
      expect(track.flag).toBeGreaterThan(track.start + 400);
      expect(track.cushion).toBeGreaterThan(track.flag + 100);
      expect(track.points[track.points.length - 1][0]).toBeGreaterThan(track.cushion + 80);
      for (let i = 1; i < track.points.length; i++) expect(track.points[i][0]).toBeGreaterThanOrEqual(track.points[i - 1][0]);
      // The car waits on level ground, and nothing stands where it waits.
      expect(slopeAt(track, track.start)).toBe(0);
      for (const at of [...track.dominoes, ...(track.ball === null ? [] : [track.ball]), ...track.bumps.map(bump => bump.at)]) expect(at).toBeGreaterThan(track.start + CAR_HALF + 60);
    }
  });
  it('finish means the nose passed the flag', () => {
    for (const track of TRACKS) for (const c of ALL) {
      const run = simulate(track, c);
      expect(run.finished).toBe(run.reach >= track.flag);
      expect(run.events.some(event => event.kind === 'flag')).toBe(run.finished);
    }
  });
  it('no wind, no go', () => {
    const run = simulate(shelf, 0);
    expect(run.stop).toBe(shelf.start); expect(run.finished).toBe(false);
  });
  it('too little wind on the ramp: the car climbs, then rolls gently back down', () => {
    const run = simulate(ramp, 3);
    expect(run.reach).toBeGreaterThan(300); // well up the leaning book
    expect(run.stop).toBeLessThan(run.reach - CAR_HALF);
    expect(run.events.map(event => event.kind)).toContain('turnback');
    expect(run.finished).toBe(false);
    // It ends on the table, behind the start block at worst.
    expect(run.stop).toBeGreaterThanOrEqual(CAR_HALF);
  });
  it('overshoot is caught by the cushion: the car never passes it', () => {
    for (const track of TRACKS) {
      const run = simulate(track, MAX_CLICKS);
      expect(run.finished).toBe(true);
      expect(run.reach).toBeLessThan(track.cushion + 60);
      expect(run.samples.every(sample => sample.s + CAR_HALF < track.cushion + 60)).toBe(true);
    }
  });
  it('the long table: the pencil, the dominoes and the tunnel each take something, and none stops the run', () => {
    const run = simulate(table, 10);
    expect(run.events.map(event => event.kind).filter(kind => ['bump', 'dominoes', 'tunnel', 'flag'].includes(kind))).toEqual(['bump', 'dominoes', 'tunnel', 'flag']);
    expect(run.dominoesAt).not.toBeNull();
    // Without the obstacles the same wind goes further.
    const bare = { ...table, bumps: [], dominoes: [], dominoKeep: 1, tunnel: null };
    expect(simulate(bare, 10).reach).toBeGreaterThan(run.reach);
  });
  it('the wool ball is nudged on ahead and costs a little speed', () => {
    const run = simulate(ramp, 8);
    expect(run.events.map(event => event.kind)).toContain('ball');
    const last = run.samples[run.samples.length - 1];
    expect(last.ball!).toBeGreaterThan(ramp.ball!);
    const bare = { ...ramp, ball: null };
    expect(simulate(bare, 6).reach).toBeGreaterThan(simulate(ramp, 6).reach);
  });
  it('block bridge: the dominoes stand on the plank and fall when the car climbs to them', () => {
    expect(pointAt(blockBridge, blockBridge.dominoes[0]).y).toBeCloseTo(26);
    expect(simulate(blockBridge, 2).dominoesAt).toBeNull();
    expect(simulate(blockBridge, 5).dominoesAt).not.toBeNull();
  });
  it('book slide: the ruler down adds speed, and too little wind rolls back off the far book', () => {
    const run = simulate(bookSlide, 3);
    const top = run.samples.find(sample => sample.s >= 240)!, bottom = run.samples.find(sample => sample.s >= 480)!;
    expect(bottom.v).toBeGreaterThan(top.v);
    const back = simulate(bookSlide, 5);
    expect(back.events.map(event => event.kind)).toContain('turnback');
    expect(back.stop).toBeGreaterThan(490); // it settles in the dip, never back up the ruler
    expect(back.finished).toBe(false);
  });
  it('the grand table: pencil, dominoes, tunnel and wool ball in that order, then the flag', () => {
    const kinds = simulate(grandTour, 11).events.map(event => event.kind);
    expect(kinds.filter(kind => kind !== 'stop' && kind !== 'cushion')).toEqual(['bump', 'dominoes', 'tunnel', 'ball', 'flag']);
  });
  it('the spring unwinds as the car goes and is empty at rest', () => {
    const run = simulate(shelf, 6);
    expect(run.samples[0].turns).toBe(6);
    for (let i = 1; i < run.samples.length; i++) expect(run.samples[i].turns).toBeLessThanOrEqual(run.samples[i - 1].turns);
    expect(run.samples[run.samples.length - 1].turns).toBe(0);
    expect(run.events[run.events.length - 1].kind).toBe('stop');
  });
});

describe('playback and reset', () => {
  it('sampleAt reads the precomputed run: start, between samples, and held at the end', () => {
    const run = simulate(ramp, 7);
    expect(sampleAt(run, 0)).toEqual(run.samples[0]);
    expect(sampleAt(run, -1)).toEqual(run.samples[0]);
    const end = sampleAt(run, run.duration + 5);
    expect(end.s).toBe(run.stop); expect(end.turns).toBe(0);
    const mid = sampleAt(run, 0.5);
    expect(mid.s).toBeGreaterThan(ramp.start);
    // Reset is exact: back at time zero everything is where it began.
    expect(sampleAt(run, 0).s).toBe(ramp.start); expect(sampleAt(run, 0).turns).toBe(7);
  });
  it('track helpers: geometry, lean and wheels', () => {
    expect(pointAt(ramp, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(ramp, 250).y).toBeCloseTo(0);
    expect(leanAt(ramp, 400)).toBeGreaterThan(0.2);
    expect(leanAt(ramp, 850)).toBeLessThan(-0.2);
    expect(leanAt(shelf, 400)).toBeCloseTo(0);
    expect(wheelAngle(26)).toBeCloseTo(2);
  });
  it('a play is three tracks in order and ends after the third', () => {
    expect(PLAY_LENGTH).toBe(3);
    expect(trackSet(0).map(track => track.id)).toEqual(['shelf', 'ramp', 'table']);
    expect(nextTrack(0)).toBe(1); expect(nextTrack(1)).toBe(2); expect(nextTrack(2)).toBeNull();
  });
  it('play again is not the same again: the next play is a different set, and every set climbs', () => {
    for (const [index, ids] of TRACK_SETS.entries()) {
      expect(ids).toHaveLength(PLAY_LENGTH);
      const set = trackSet(index);
      expect(set.map(track => track.id)).toEqual(ids);
      const needs = set.map(track => minimumClicks(track)!);
      for (let i = 1; i < needs.length; i++) expect(needs[i], ids.join()).toBeGreaterThan(needs[i - 1]);
      const next = TRACK_SETS[(index + 1) % TRACK_SETS.length];
      expect(next.join()).not.toBe(ids.join());
    }
    // The second play shares no track with the first.
    expect(trackSet(1).some(track => trackSet(0).includes(track))).toBe(false);
    expect(trackSet(TRACK_SETS.length)).toEqual(trackSet(0));
    expect(trackSet(Number.NaN)).toEqual(trackSet(0)); expect(trackSet(-3)).toEqual(trackSet(0));
    // Every authored track is played in some set.
    for (const track of TRACKS) expect(TRACK_SETS.some(ids => ids.includes(track.id)), track.id).toBe(true);
  });
  it('the room light changes from play to play and never touches the run', () => {
    expect(roomLight(0)).toBe('afternoon');
    expect(ROOM_LIGHTS.map((_, i) => roomLight(i))).toEqual([...ROOM_LIGHTS]);
    expect(roomLight(ROOM_LIGHTS.length)).toBe(roomLight(0)); expect(roomLight(Number.NaN)).toBe('afternoon');
  });
  it('a close run is one that ends near the flag, either side; the playback slows from just before it', () => {
    // Seven clicks on the book slide stop a hair short of the flag.
    const near = simulate(bookSlide, 7);
    expect(near.finished).toBe(false);
    expect(bookSlide.flag - near.reach).toBeLessThan(CLOSE_CALL);
    const at = closeCallAt(bookSlide, near)!;
    expect(at).toBeGreaterThan(0); expect(at).toBeLessThan(near.duration);
    expect(sampleAt(near, at).s + CAR_HALF).toBeGreaterThanOrEqual(bookSlide.flag - CLOSE_LEAD - 1);
    // Just past it counts too; a run into the cushion, a short one and a roll-back do not.
    for (const track of TRACKS) for (const c of ALL) {
      const run = simulate(track, c), when = closeCallAt(track, run);
      const nose = run.finished ? run.stop + CAR_HALF : run.reach;
      if (when !== null) { expect(Math.abs(nose - track.flag)).toBeLessThanOrEqual(CLOSE_CALL); expect(when).toBeLessThanOrEqual(run.duration); }
      if (Math.abs(nose - track.flag) > CLOSE_CALL) expect(when).toBeNull();
    }
    expect(closeCallAt(shelf, simulate(shelf, MAX_CLICKS))).toBeNull();
    expect(closeCallAt(shelf, simulate(shelf, 1))).toBeNull();
    expect(closeCallAt(ramp, simulate(ramp, 3))).toBeNull();
  });
  it('chalk marks keep the last few reaches', () => {
    let marks: number[] = [];
    for (const r of [100, 200, 300, 400]) marks = addChalk(marks, r);
    expect(marks).toEqual([200, 300, 400]); expect(marks).toHaveLength(CHALK_KEEP);
    expect(addChalk(marks, Number.NaN)).toEqual(marks);
  });
});

