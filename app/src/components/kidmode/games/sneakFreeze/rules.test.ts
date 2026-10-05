/**
 * B-GAME-07a — the rules of Sneak & Freeze, proven without a screen.
 *
 * Every timing in rules.ts is a multiple of 10 ms, so a 10 ms step lands each
 * phase boundary exactly at the end of a step: the elapsed time read at an
 * event is the exact time of that event.
 */
import { describe, expect, it } from "vitest";
import {
  PATH_STEPS,
  TAGS_PER_SITTING,
  TIMING,
  longestStatue,
  startFor,
  startSitting,
  step,
  view,
  type Level,
  type SneakEventId,
  type SneakState,
  type Track,
} from "./rules";

const DT = 10;

type Policy = (s: SneakState) => boolean;

interface Run {
  final: SneakState;
  /** [elapsedMs at the end of the step, event] in order. */
  events: [number, SneakEventId, SneakState][];
  states: SneakState[];
}

function run(o: { seed: string; track: Track; level: Level; intro?: boolean }, policy: Policy, ms: number, keepStates = false): Run {
  let s = startSitting({ ...o, intro: o.intro ?? true });
  const events: Run["events"] = [];
  const states: SneakState[] = [];
  for (let t = 0; t < ms && s.phase !== "done"; t += DT) {
    s = step(s, DT, { holding: policy(s) });
    for (const e of s.events) events.push([s.elapsedMs, e, s]);
    if (keepStates) states.push(s);
  }
  return { final: s, events, states };
}

/** Never lets go. */
const holder: Policy = () => true;
/** Holds while the watcher counts, lets go at every tell (and every fake). */
const stopper: Policy = (s) => s.phase === "intro" || s.phase === "ready" || s.phase === "counting" || s.phase === "waiting";
const distance = (s: SneakState) => s.tags * s.pathSteps + s.pos;

describe("Sneak & Freeze rules — holding forever loses", () => {
  for (const track of ["A", "B"] as const) {
    for (const level of [1, 2, 3] as const) {
      it(`track ${track} L${level}: never letting go ends 60 s with less progress than stopping at every tell`, () => {
        for (const seed of ["s1", "s2", "s3", "s4"]) {
          const hold = run({ seed, track, level }, holder, 60000);
          const stop = run({ seed, track, level }, stopper, 60000);
          expect(distance(hold.final)).toBeLessThan(distance(stop.final));
          // The holder is caught on every look and never reaches the watcher.
          expect(hold.final.tags).toBe(0);
          expect(hold.events.some(([, e]) => e === "caught")).toBe(true);
        }
      });
    }
  }
});

describe("Sneak & Freeze rules — fairness", () => {
  /** A child who lets go at a random moment of each tell, or holds on at random. */
  function chaotic(seedN: number): Policy {
    let x = seedN * 7919 + 13;
    const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    let plan = 0;
    let lastPhase = "";
    return (s) => {
      if (s.phase !== lastPhase) {
        lastPhase = s.phase;
        plan = r();
      }
      if (s.phase === "counting") return plan > 0.15;
      if (s.phase === "tell") return s.phaseMs < plan * s.phaseDur;
      if (s.phase === "looking") return plan > 0.7;
      return r() > 0.5;
    };
  }

  it("the tell is never under 450 ms, and the look never starts without one (500+ seeded phases)", () => {
    let looks = 0;
    let n = 0;
    while (looks < 500) {
      const level = ((n % 3) + 1) as Level;
      const track: Track = n % 2 ? "B" : "A";
      const { events } = run({ seed: `fair-${n}`, track, level }, chaotic(n), 120000);
      let tellAt: number | null = null;
      for (const [at, e] of events) {
        if (e === "tell") tellAt = at;
        if (e === "look") {
          expect(tellAt).not.toBeNull();
          expect(at - (tellAt as number)).toBeGreaterThanOrEqual(TIMING.tellMinMs);
          tellAt = null;
          looks += 1;
        }
      }
      n += 1;
    }
    expect(looks).toBeGreaterThanOrEqual(500);
  });

  it("a caught hero never goes behind the start or behind the last cover reached", () => {
    for (let n = 0; n < 40; n++) {
      const track: Track = n % 2 ? "B" : "A";
      const { events } = run({ seed: `cover-${n}`, track, level: ((n % 3) + 1) as Level }, chaotic(n + 100), 120000);
      let banked = 0;
      let catches = 0;
      for (const [, e, s] of events) {
        if (e === "statue" || e === "blind") {
          for (const c of s.covers) if (c <= s.pos && c > banked) banked = c;
        }
        if (e === "tag") banked = 0;
        if (e === "caught") {
          catches += 1;
          expect(s.pos).toBeGreaterThanOrEqual(0);
          expect(s.pos).toBeGreaterThanOrEqual(banked);
          expect([0, ...s.covers]).toContain(s.pos);
        }
      }
      expect(catches).toBeGreaterThan(0);
    }
  });

  it("releasing during the tell is never caught (tiptoe and dash, every level)", () => {
    for (let n = 0; n < 60; n++) {
      const track: Track = n % 2 ? "B" : "A";
      const level = ((n % 3) + 1) as Level;
      let x = n + 1;
      let releaseAt = 0;
      const policy: Policy = (s) => {
        if (s.phase === "tell") {
          if (s.phaseMs === 0 || releaseAt === 0) {
            x = (x * 48271) % 2147483647;
            releaseAt = (x % 1000) / 1000 * (s.phaseDur - DT);
          }
          return s.phaseMs < releaseAt;
        }
        releaseAt = 0;
        return s.phase === "counting" || s.phase === "fake" || s.phase === "intro" || s.phase === "ready" || s.phase === "waiting";
      };
      const { events, final } = run({ seed: `tell-${n}`, track, level }, policy, 120000);
      expect(events.filter(([, e]) => e === "caught")).toHaveLength(0);
      expect(final.tags).toBeGreaterThan(0);
    }
  });

  it("track B: a dash released inside the look skids and is caught; tiptoe released inside the grace is not", () => {
    // Dash: hold through the tell and let go 50 ms into the look.
    const late: Policy = (s) => s.phase !== "looking" || s.phaseMs < 50;
    const dash = run({ seed: "dash", track: "B", level: 1 }, (s) => (s.phase === "verdict" ? true : late(s)), 20000);
    expect(dash.final.experiences).toContain("dash");
    expect(dash.events.some(([, e]) => e === "caught")).toBe(true);
    // Track A has no dash: the same late release inside the 400 ms grace is safe.
    const tiptoe = run({ seed: "dash", track: "A", level: 1 }, (s) => (s.phase === "verdict" ? false : late(s)), 20000);
    expect(tiptoe.final.experiences).not.toContain("dash");
    expect(tiptoe.events.filter(([, e]) => e === "caught")).toHaveLength(0);
  });

  it("sunglasses make moving while looked at safe — and the hero keeps going", () => {
    const policy: Policy = (s) => (s.sunglasses ? s.phase !== "verdict" : stopper(s));
    let sunglassLooks = 0;
    for (let n = 0; n < 12; n++) {
      const { events } = run({ seed: `shades-${n}`, track: n % 2 ? "B" : "A", level: 1 }, policy, 180000);
      let inShadesLook = false;
      let posAtLook = 0;
      for (const [, e, s] of events) {
        if (e === "look") {
          inShadesLook = s.sunglasses;
          posAtLook = s.pos;
          if (inShadesLook) sunglassLooks += 1;
        }
        if (inShadesLook) expect(e).not.toBe("caught");
        if (e === "blind") {
          expect(s.pos).toBeGreaterThan(posAtLook);
          inShadesLook = false;
        }
      }
    }
    expect(sunglassLooks).toBeGreaterThan(0);
  });
});

describe("Sneak & Freeze rules — variety, adaptation, the sitting", () => {
  function chants(seed: string): number[] {
    const out: number[] = [];
    let s = startSitting({ seed, track: "B", level: 2 });
    for (let t = 0; t < 90000 && s.phase !== "done"; t += DT) {
      const before = s.phase;
      s = step(s, DT, { holding: stopper(s) });
      if (s.phase === "counting" && before !== "counting" && before !== "fake") out.push(s.beats);
    }
    return out;
  }

  it("two different seeds give different chant sequences; the same seed is reproducible", () => {
    const a = chants("sitting-a");
    const b = chants("sitting-b");
    expect(a.length).toBeGreaterThan(4);
    expect(a).not.toEqual(b);
    expect(chants("sitting-a")).toEqual(a);
    const r1 = run({ seed: "same", track: "A", level: 1 }, stopper, 60000).final;
    const r2 = run({ seed: "same", track: "A", level: 1 }, stopper, 60000).final;
    expect(JSON.stringify(r2)).toBe(JSON.stringify(r1));
  });

  it("seeds vary prize order, L1 chant length and the first freeze pose across sittings", () => {
    const sittings = Array.from({ length: 20 }, (_, i) => startSitting({ seed: `v-${i}`, track: "A", level: 1 }));
    expect(new Set(sittings.map((s) => s.prizeOrder.join(","))).size).toBeGreaterThan(1);
    expect(new Set(sittings.map((s) => s.steadyBeats)).size).toBe(2);
    expect(new Set(sittings.map((s) => s.freezePose)).size).toBe(2);
  });

  it("level adaptation: three catches in a round -> one level down; two clean rounds -> one level up", () => {
    // Down: caught on the first three looks, then plays well to the tag.
    let looks = 0;
    let lastPhase = "";
    const sloppy: Policy = (s) => {
      if (s.phase === "looking" && lastPhase !== "looking") looks += 1;
      lastPhase = s.phase;
      return looks <= 3 && s.tags === 0 ? s.phase !== "verdict" : stopper(s);
    };
    let s = startSitting({ seed: "down", track: "B", level: 2 });
    for (let t = 0; t < 180000 && s.tags < 1; t += DT) s = step(s, DT, { holding: sloppy(s) });
    expect(s.tags).toBe(1);
    for (let t = 0; t < 5000 && s.phase === "tagged"; t += DT) s = step(s, DT, { holding: false });
    expect(s.level).toBe(1);

    // Up: two clean rounds (no catch, two or more statues each).
    let u = startSitting({ seed: "up", track: "A", level: 1 });
    for (let t = 0; t < 300000 && u.tags < 2; t += DT) u = step(u, DT, { holding: stopper(u) });
    for (let t = 0; t < 5000 && u.phase === "tagged"; t += DT) u = step(u, DT, { holding: false });
    expect(u.level).toBe(2);
  });

  it("a sitting ends after exactly three tags, with three prizes", () => {
    const { final, events } = run({ seed: "whole", track: "A", level: 1 }, stopper, 600000);
    expect(final.phase).toBe("done");
    expect(final.tags).toBe(TAGS_PER_SITTING);
    expect(events.filter(([, e]) => e === "tag")).toHaveLength(3);
    expect(events.filter(([, e]) => e === "prize")).toHaveLength(3);
    expect(new Set(final.prizes).size).toBe(3);
    expect(view(final).done).toBe(true);
    // Nothing moves after the end.
    const after = step(step(final, 100, { holding: true }), 100, { holding: false });
    expect(after.tags).toBe(3);
    expect(after.phase).toBe("done");
    expect(longestStatue(final)).not.toBeNull();
  });

  it("starts by age: 3-4 -> L1 track A, 5-7 -> L2 track B", () => {
    expect(startFor(3)).toEqual({ track: "A", level: 1 });
    expect(startFor(4)).toEqual({ track: "A", level: 1 });
    expect(startFor(5)).toEqual({ track: "B", level: 2 });
    expect(startFor(7)).toEqual({ track: "B", level: 2 });
    expect(startFor(null)).toEqual({ track: "A", level: 1 });
    expect(PATH_STEPS.B).toBeGreaterThan(PATH_STEPS.A);
  });
});

describe("Sneak & Freeze rules — response, idle, no score", () => {
  it("a touch moves the hero in the same step (stepwise, one lurch)", () => {
    let s = startSitting({ seed: "touch", track: "A", level: 1, intro: true });
    s = step(s, 16, { holding: false });
    expect(view(s).progress).toBe(0);
    s = step(s, 16, { holding: true });
    expect(s.pos).toBe(1);
    expect(view(s).lurch).toBe(1);
    expect(view(s).heroPose).toBe("tiptoe");
    // Holding does not glide: no extra step before the next beat.
    s = step(s, 300, { holding: true });
    expect(s.pos).toBe(1);
  });

  it("no press: a hint at 8 s, the chant waits at 30 s — no penalty, no timeout", () => {
    const { events, final } = run({ seed: "idle", track: "A", level: 1 }, () => false, 40000);
    const hint = events.find(([, e]) => e === "hint");
    const wait = events.find(([, e]) => e === "waiting");
    expect(hint?.[0]).toBeGreaterThanOrEqual(TIMING.hintAfterMs);
    expect(wait?.[0]).toBeGreaterThanOrEqual(TIMING.waitAfterMs);
    expect(final.phase).toBe("waiting");
    // Only the demonstration's two steps: the child never moved.
    expect(final.pos).toBe(TIMING.demo.beatAt.length);
    expect(events.some(([, e]) => e === "caught")).toBe(false);
    expect(view(final).showHand).toBe(true);
    expect(view(final).hand).toBe("hint");
    const back = step(final, DT, { holding: true });
    expect(back.phase).toBe("counting");
    expect(back.pos).toBe(final.pos + 1);
  });

  it("no state or view ever exposes a score, points, stars, right/wrong or a level", () => {
    const banned = /score|point|star|correct|streak|percent|grade/i;
    const scan = (o: unknown, path: string) => {
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        expect(banned.test(k), `${path}.${k}`).toBe(false);
        scan(v, `${path}.${k}`);
      }
    };
    const { states } = run({ seed: "keys", track: "B", level: 3 }, stopper, 60000, true);
    for (const s of states.filter((_, i) => i % 50 === 0)) {
      scan(s, "state");
      const v = view(s);
      scan(v, "view");
      expect(Object.keys(v)).not.toContain("level");
      expect(Object.keys(v)).not.toContain("tags");
    }
  });
});

describe("Sneak & Freeze rules — sound beats (B-GAME-08a)", () => {
  it("every chant beat leaves room for one count word (>= 900 ms at every level; L1 the slowest)", () => {
    for (const level of [1, 2, 3] as const) expect(TIMING.beatMs[level]).toBeGreaterThanOrEqual(900);
    expect(TIMING.beatMs[1]).toBeGreaterThanOrEqual(1050);
  });

  it("beat k of a chant is emitted with beatIndex k-1 (beat k plays n k), at most 5", () => {
    const { events } = run({ seed: "count", track: "B", level: 2 }, stopper, 60000);
    const beats = events.filter(([, e]) => e === "beat").map(([, , s]) => s.beatIndex);
    expect(beats.length).toBeGreaterThan(5);
    expect(Math.max(...beats)).toBeLessThanOrEqual(4);
    expect(beats[0]).toBe(0);
  });

  it("a fake turn ends in ONE 'fooled' after its tell, never a look", () => {
    let seen = 0;
    for (let n = 0; n < 30 && seen < 3; n++) {
      const { events } = run({ seed: `fool-${n}`, track: "B", level: 3 }, stopper, 90000);
      for (let i = 0; i < events.length; i++) {
        if (events[i][1] !== "fake") continue;
        seen++;
        const fakeAt = events[i][0];
        const tellDur = events[i][2].tellDur;
        const next = events.slice(i + 1).find(([, e]) => e === "fooled" || e === "look" || e === "tell");
        expect(next?.[1]).toBe("fooled");
        expect(next![0] - fakeAt).toBeGreaterThanOrEqual(tellDur - 10);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("Sneak & Freeze rules — B-GAME-07e the demonstration and first fun", () => {
  it("the hero demonstrates in <= 7 s: two count words with a step each (the hand pressing), the call, the turn, the statue line, the hand lifting — then a hand-over with ONE pulse", () => {
    const seen: [number, SneakEventId][] = [];
    const hands: [number, string | null][] = [];
    let s = startSitting({ seed: "demo", track: "A", level: 1, intro: true });
    expect(view(s).demo).toBe("count");
    for (let t = 0; t < 9000; t += DT) {
      s = step(s, DT, { holding: false });
      for (const e of s.events) seen.push([s.elapsedMs, e]);
      const h = view(s).hand;
      if (!hands.length || hands[hands.length - 1][1] !== h) hands.push([s.elapsedMs, h]);
    }
    const D = TIMING.demo;
    expect(D.endAt).toBeLessThanOrEqual(7000);
    const demoEvents = seen.filter(([at]) => at <= D.endAt).map(([, e]) => e);
    expect(demoEvents.slice(0, 7)).toEqual(["beat", "step", "beat", "step", "tell", "look", "demo-statue"]);
    // The demonstration's statue is not the child's: nothing recorded, nothing banked.
    expect(s.statues).toHaveLength(0);
    expect(s.lastCover).toBe(0);
    expect(s.pos).toBe(D.beatAt.length);
    // The hand: lifted, pressing through the two steps, lifted at the call, one pulse after the hand-over, then gone.
    expect(hands.map(([, h]) => h)).toEqual(["lift", "press", "lift", "pulse", null]);
    const press = hands.find(([, h]) => h === "press")![0];
    const lift = hands.filter(([, h]) => h === "lift")[1][0];
    expect(press).toBeLessThan(D.beatAt[0]);
    expect(lift).toBeGreaterThanOrEqual(D.tellAt);
    const handover = hands.find(([, h]) => h === "pulse")![0];
    expect(handover).toBeGreaterThanOrEqual(D.endAt);
    expect(handover).toBeLessThanOrEqual(D.endAt + DT);
    expect(hands[hands.length - 1][0] - handover).toBeLessThanOrEqual(TIMING.handoverCueMs + DT);
  });

  it("any touch during the demonstration takes control at once: the chant starts and the hero lurches from where he stands", () => {
    for (const at of [100, 900, 2000, 2600, 3200, 5000]) {
      let s = startSitting({ seed: `take-${at}`, track: "A", level: 1, intro: true });
      for (let t = 0; t < at; t += DT) s = step(s, DT, { holding: false });
      const pos = s.pos;
      s = step(s, 0, { holding: true });
      expect(s.phase, `touch at ${at}`).toBe("counting");
      expect(s.pos).toBe(pos + 1);
      expect(view(s).demo).toBeNull();
      expect(view(s).hand).toBeNull();
      expect(view(s).heroPose).toBe("tiptoe");
    }
  });

  it("no demonstration from the second sitting: the first count starts within 1.5 s", () => {
    let s = startSitting({ seed: "second", track: "B", level: 2, intro: false });
    let firstBeat: number | null = null;
    for (let t = 0; t < 3000 && firstBeat === null; t += DT) {
      s = step(s, DT, { holding: false });
      if (s.events.includes("beat")) firstBeat = s.elapsedMs;
    }
    expect(view(startSitting({ seed: "second", track: "B", level: 2, intro: false })).demo).toBeNull();
    expect(firstBeat).not.toBeNull();
    expect(firstBeat!).toBeLessThanOrEqual(1500);
  });

  it("first fun in five seconds: from the hand-over (the first chant) to the first statue verdict <= 5 s on L1 and L2 (a child who holds while the cat counts)", () => {
    for (const [track, level] of [["A", 1], ["B", 2]] as const) {
      for (const intro of [true, false]) {
        for (let n = 0; n < 12; n++) {
          let s = startSitting({ seed: `fun-${track}${level}-${intro}-${n}`, track, level, intro });
          // Control = the first chant starts (the demo's hand-over, or the end of "ready").
          let control: number | null = null;
          let statueAt: number | null = null;
          for (let t = 0; t < 20000 && statueAt === null; t += DT) {
            s = step(s, DT, { holding: s.phase === "counting" });
            if (control === null && s.phase === "counting") control = s.elapsedMs;
            if (s.events.includes("statue")) statueAt = s.elapsedMs;
          }
          expect(statueAt, `${track}${level} ${intro} ${n}`).not.toBeNull();
          expect(statueAt! - control!, `${track}${level} ${intro} ${n}`).toBeLessThanOrEqual(5000);
        }
      }
    }
  });
});

describe("Sneak & Freeze rules — B-GAME-07f the caught moment and the statue beat", () => {
  it("caught: the tumble lands where he stood, then he scoots back to the cover in visible hops (never a teleport), all within ~900 ms", () => {
    let seen = 0;
    for (let n = 0; n < 20 && seen < 5; n++) {
      // Hold through every look: caught on the first look after moving.
      let s = startSitting({ seed: `scoot-${n}`, track: "A", level: 1, intro: false });
      let prev = view(s).progress;
      const shown: number[] = [];
      let caught = false;
      for (let t = 0; t < 20000; t += DT) {
        s = step(s, DT, { holding: s.phase !== "verdict" });
        const v = view(s);
        if (s.events.includes("caught") && s.caughtFrom > s.pos) { caught = true; expect(v.progress).toBeCloseTo(prev, 9); expect(v.heroPose).toBe("oops"); }
        if (caught && s.phase === "verdict") shown.push(v.progress);
        if (caught && s.phase !== "verdict") break;
        prev = v.progress;
      }
      if (!caught) continue;
      seen += 1;
      const distinct = shown.filter((x, i) => i === 0 || x !== shown[i - 1]);
      expect(distinct.length).toBe(1 + TIMING.caughtSteps);
      for (let i = 1; i < distinct.length; i++) expect(distinct[i]).toBeLessThan(distinct[i - 1]);
      expect(distinct[distinct.length - 1]).toBeCloseTo(s.pos / s.pathSteps, 9);
      expect(TIMING.verdictMs.caught).toBeLessThanOrEqual(950);
      expect(TIMING.caughtBackMs).toBeLessThan(TIMING.verdictMs.caught);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("the statue beat lasts long enough to be funny and never longer than 2.5 s", () => {
    expect(TIMING.verdictMs.statue).toBeGreaterThanOrEqual(1600);
    expect(TIMING.verdictMs.statue).toBeLessThanOrEqual(2200);
  });
});
