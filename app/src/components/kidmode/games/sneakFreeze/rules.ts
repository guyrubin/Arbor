/**
 * Sneak & Freeze / "דג מלוח" — B-GAME-07a: the game as a PURE, deterministic
 * state machine (no React, no DOM, no timers, no Math.random).
 *
 *   step(state, dtMs, { holding }) -> next state (+ the events of that step)
 *   view(state)                    -> what the screen draws
 *
 * The run is IN DEPTH, toward the camera (ruling G2): the hero starts at the
 * back gate of the courtyard (step 0) and comes toward the watcher's stool in
 * the foreground (step `pathSteps`). Between them sit three cover objects
 * (`covers`, step indices).
 *
 * One look cycle:
 *   counting  the watcher faces the child (its back to the courtyard) and
 *             chants 2-5 beats. Holding = the hero lurches ONE step per beat
 *             (stepwise, never a glide; the first lurch of a press is
 *             immediate so a touch answers in the same frame).
 *             Track B: holding > 1.5 s in one chant turns tiptoe into a DASH
 *             (two steps a lurch); a dash skids on for a moment after release.
 *   tell      >= 450 ms, never shorter: ears twitch. Releasing here is
 *             ALWAYS safe. Nobody moves forward during the tell.
 *   looking   the watcher spins round. After the grace (400 ms track A,
 *             200 ms track B) a hero still holding (or still skidding out of
 *             a dash released inside the look) is CAUGHT. With SUNGLASSES on,
 *             the watcher cannot see: moving is safe and the hero keeps going.
 *   verdict   statue (the hero moved this cycle and stood still: the comic
 *             beat, 2 s, the pose is kept as a statue) | caught (0.9 s: the
 *             tumble where he stood, then he scoots back to the last cover
 *             REACHED in visible steps — B-GAME-07f) | still (nothing moved) |
 *             blind (sunglasses, the hero kept moving).
 *
 * "Reached" (the fairness rule that makes holding lose): a cover counts as
 * reached once the hero has been at or past it through a look without being
 * caught — a statue, or a blind look. A caught hero goes back to that cover,
 * never behind it and never behind the start. A child who never lets go is
 * caught on every look and so never banks a cover; a child who lets go at
 * every tell banks one every cycle (rules.test.ts proves the difference).
 *
 * The first sitting on a device opens with a DEMONSTRATION (B-GAME-07e,
 * phase "intro", <= 7 s, nothing to read): the cat covers its eyes and counts
 * two words while the hero tiptoes two steps by himself (the hand glyph
 * pressing); the cat calls the game's name and turns (the hand lifts, the
 * hero freezes); the cat admires the statue - then control passes to the
 * child (the hand pulses once). Any touch during it takes control at once and
 * the game simply goes on from there. The first chant of every sitting is two
 * beats long, so the child's first statue comes within five seconds.
 *
 * Reaching the watcher while it counts (or while it is blind) is a TAG. Three
 * tags end the sitting. No state carries a score, points or right/wrong; the
 * level lives here for the rules only and is never part of the view.
 */

export type Track = "A" | "B";
export type Level = 1 | 2 | 3;
export type HeroPose = "idle" | "tiptoe" | "dash" | "freeze-a" | "freeze-b" | "oops" | "cheer" | "hold-up";
export type FreezePose = "freeze-a" | "freeze-b";
export type Phase = "intro" | "ready" | "counting" | "fake" | "tell" | "looking" | "verdict" | "waiting" | "tagged" | "done";
export type Verdict = "statue" | "caught" | "still" | "blind";
export type WatcherPose = "counting" | "tell" | "looking" | "laughing" | "waiting";
export type PrizeId = "lemon" | "wool" | "bell";
export type Experience = "sunglasses" | "fake-turn" | "dash";
/** Events of one step, for sound and one-shot effects (sounds.ts maps them). */
export type SneakEventId =
  | "beat" | "step" | "tell" | "fake" | "fooled" | "look" | "sunglasses"
  | "statue" | "caught" | "still" | "blind"
  | "tag" | "prize" | "hint" | "waiting" | "done"
  | "demo-statue";
/** The demonstration's beats (view.demo). */
export type DemoStep = "count" | "tell" | "look" | "statue";
/** The hand glyph: pressing / lifted in the demo, one pulse at the hand-over,
 *  the idle hint's pulsing. */
export type HandCue = "press" | "lift" | "pulse" | "hint";

export const PRIZES: readonly PrizeId[] = ["lemon", "wool", "bell"];
export const TAGS_PER_SITTING = 3;
export const PATH_STEPS: Readonly<Record<Track, number>> = { A: 18, B: 26 };
/** Cover objects as fractions of the path (fieldLayout places the art at the
 *  same fractions). */
export const COVER_FRACTIONS: readonly number[] = [0.28, 0.52, 0.76];

export const TIMING = {
  /** B-GAME-07e: the demonstration (first sitting on a device), ms from its
   *  start: the hand presses, two count words with a step each, the call +
   *  ear flick (the hand lifts, the hero freezes), the turn, the statue line
   *  ("What a lovely statue...", 2.8 s) - then the hand-over. */
  demo: { pressAt: 300, beatAt: [500, 1400] as readonly number[], tellAt: 2300, lookAt: 2900, statueAt: 3700, endAt: 6500 },
  /** The hand glyph's one pulse when control passes to the child. */
  handoverCueMs: 1200,
  /** The first chant of a sitting: two beats (first fun within five seconds). */
  firstChantBeats: 2,
  readyMs: 900,
  /** One count word per beat (B-GAME-08a): a rendered count word is 450-800
   *  ms, so a beat is never under 900 ms (the next word cuts the last). */
  beatMs: { 1: 1100, 2: 1000, 3: 900 } as Readonly<Record<Level, number>>,
  tellMs: { 1: 900, 2: 650, 3: 550 } as Readonly<Record<Level, number>>,
  tellJitterMs: 60,
  /** The tell is never shorter than this: a stopping game, not a reflex test. */
  tellMinMs: 450,
  graceMs: { A: 400, B: 200 } as Readonly<Record<Track, number>>,
  /** How long the watcher keeps looking after the grace (B-GAME-07e: 1.1 s;
   *  the comic beat lives in the statue verdict). */
  lookMs: 1100,
  verdictMs: { statue: 2000, caught: 900, still: 900, blind: 1200 } as Readonly<Record<Verdict, number>>,
  /** B-GAME-07f: the caught moment — the tumble lands, then the scoot back to
   *  the cover in `caughtSteps` visible hops, done by `caughtBackMs`. */
  caughtTumbleMs: 380,
  caughtBackMs: 760,
  caughtSteps: 3,
  /** A fake turn = a tell that ends in a giggle instead of a look. */
  fakeLaughMs: 500,
  tagCheerMs: 900,
  tagHoldMs: 1700,
  dashAfterMs: 1500,
  dashSkidMs: 300,
  /** A beat-tick lurch needs this fraction of a beat since the last lurch
   *  (so a press just before a beat does not double-step). */
  minLurchGapFrac: 0.4,
  hintAfterMs: 8000,
  waitAfterMs: 30000,
  /** Longest single slice step() advances at once (a dropped frame or a
   *  throttled tab never skips a phase boundary or a catch check). */
  maxSliceMs: 16,
  /** dt is clamped to this per call (a backgrounded tab is paused anyway). */
  maxDtMs: 250,
} as const;

export interface StatueRecord {
  pose: FreezePose;
  /** How long this pose was held, ms (the Ending shows the longest). */
  heldMs: number;
  round: number;
  /** Where along the run the hero stood, 0..1 (the Ending's picture). */
  at: number;
}

export interface SneakState {
  seed: string;
  rng: number;
  track: Track;
  level: Level;
  pathSteps: number;
  covers: readonly number[];
  phase: Phase;
  phaseMs: number;
  phaseDur: number;
  /** Chant of the current cycle. */
  beats: number;
  beatIndex: number;
  beatMs: number;
  chantMs: number;
  fakeAt: number | null;
  /** L1's chant length: steady within a sitting, seeded per sitting. */
  steadyBeats: number;
  sunglasses: boolean;
  tellDur: number;
  /** Hero. */
  pos: number;
  /** The last cover REACHED (see the header): where a caught hero returns. */
  lastCover: number;
  holding: boolean;
  holdMs: number;
  dashing: boolean;
  skidMs: number;
  lurchedThisBeat: boolean;
  sinceLurchMs: number;
  lurchSerial: number;
  movedSinceVerdict: boolean;
  movedDuringLook: boolean;
  freezePose: FreezePose;
  freezeMs: number;
  verdict: Verdict | null;
  /** Round + sitting (counts are rules-internal, never drawn). */
  round: number;
  tags: number;
  looksThisRound: number;
  sunglassesLook: number;
  catchesThisRound: number;
  statuesThisRound: number;
  cleanRounds: number;
  prizeOrder: readonly PrizeId[];
  prizes: readonly PrizeId[];
  prizeShown: boolean;
  statues: readonly StatueRecord[];
  experiences: readonly Experience[];
  idleMs: number;
  hinted: boolean;
  /** The hand's one pulse after the demonstration hands over (ms left). */
  cueMs: number;
  /** Where a caught hero tumbled (the view scoots him back from there). */
  caughtFrom: number;
  elapsedMs: number;
  events: readonly SneakEventId[];
}

export interface SneakView {
  phase: Phase;
  /** 0 = the back gate, 1 = at the watcher's stool. */
  progress: number;
  /** Increments on every lurch (the renderer squashes on change). */
  lurch: number;
  heroPose: HeroPose;
  watcher: { pose: WatcherPose; sunglasses: boolean; beat: number };
  /** Hand glyph in the thumb zone (demo, hand-over, idle hint). */
  showHand: boolean;
  hand: HandCue | null;
  /** The demonstration's beat, or null. */
  demo: DemoStep | null;
  /** The prize held up after a tag. */
  prize: PrizeId | null;
  done: boolean;
  events: readonly SneakEventId[];
}

// ── seeded RNG (mulberry32 over a string hash) ─────────────────────────────

/** A 32-bit hash of the seed string (FNV-1a). */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function rand(s: SneakState): number {
  const t = (s.rng + 0x6d2b79f5) >>> 0;
  s.rng = t;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

function randInt(s: SneakState, lo: number, hi: number): number {
  return lo + Math.floor(rand(s) * (hi - lo + 1));
}

// ── setup ───────────────────────────────────────────────────────────────────

/** Start track and level by age: 3-4 -> L1 track A; 5-7 -> L2 track B. */
export function startFor(ageYears: number | null | undefined): { track: Track; level: Level } {
  if (typeof ageYears === "number" && ageYears >= 5) return { track: "B", level: 2 };
  return { track: "A", level: 1 };
}

export interface SittingOptions {
  seed: string;
  track: Track;
  level: Level;
  /** First sitting on the device: the demonstration (<= 7 s, no reading). */
  intro?: boolean;
  /** Play again: the previous sitting's first prize; this one opens on another. */
  after?: PrizeId;
}

export function startSitting(o: SittingOptions): SneakState {
  const pathSteps = PATH_STEPS[o.track];
  const covers = COVER_FRACTIONS.map((f) => Math.round(f * pathSteps));
  const s: SneakState = {
    seed: o.seed,
    rng: hashSeed(o.seed),
    track: o.track,
    level: o.level,
    pathSteps,
    covers,
    phase: o.intro ? "intro" : "ready",
    phaseMs: 0,
    phaseDur: o.intro ? TIMING.demo.endAt : TIMING.readyMs,
    beats: 0,
    beatIndex: 0,
    beatMs: TIMING.beatMs[o.level],
    chantMs: 0,
    fakeAt: null,
    steadyBeats: 3,
    sunglasses: false,
    tellDur: TIMING.tellMs[o.level],
    pos: 0,
    lastCover: 0,
    holding: false,
    holdMs: 0,
    dashing: false,
    skidMs: 0,
    lurchedThisBeat: false,
    sinceLurchMs: Number.POSITIVE_INFINITY,
    lurchSerial: 0,
    movedSinceVerdict: false,
    movedDuringLook: false,
    freezePose: "freeze-a",
    freezeMs: 0,
    verdict: null,
    round: 0,
    tags: 0,
    looksThisRound: 0,
    sunglassesLook: 1,
    catchesThisRound: 0,
    statuesThisRound: 0,
    cleanRounds: 0,
    prizeOrder: PRIZES,
    prizes: [],
    prizeShown: false,
    statues: [],
    experiences: [],
    idleMs: 0,
    hinted: false,
    cueMs: 0,
    caughtFrom: 0,
    elapsedMs: 0,
    events: [],
  };
  // Per-sitting variety, drawn in a fixed order so a seed is reproducible.
  s.steadyBeats = randInt(s, 3, 4);
  const order = [...PRIZES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randInt(s, 0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (o.after && order[0] === o.after) order.push(order.shift() as PrizeId);
  s.prizeOrder = order;
  s.freezePose = rand(s) < 0.5 ? "freeze-a" : "freeze-b";
  // Round 2 always meets the sunglasses trick on its 1st or 2nd look.
  s.sunglassesLook = randInt(s, 1, 2);
  return s;
}

// ── internals (operate on a private copy inside step) ──────────────────────

function emit(s: SneakState, e: SneakEventId): void {
  s.events = [...s.events, e];
}

function meet(s: SneakState, x: Experience): void {
  if (!s.experiences.includes(x)) s.experiences = [...s.experiences, x];
}

function enter(s: SneakState, phase: Phase, dur: number): void {
  s.phase = phase;
  s.phaseMs = 0;
  s.phaseDur = dur;
}

function beginCounting(s: SneakState): void {
  const drawn = s.level === 1 ? s.steadyBeats : randInt(s, 2, 5);
  // The sitting's first chant is short: the first statue comes quickly.
  s.beats = s.round === 0 && s.looksThisRound === 0 ? TIMING.firstChantBeats : drawn;
  s.beatMs = TIMING.beatMs[s.level];
  s.beatIndex = 0;
  s.chantMs = 0;
  s.fakeAt = s.level === 3 && s.beats >= 2 && rand(s) < 0.5 ? randInt(s, 1, s.beats - 1) : null;
  const tellBase = TIMING.tellMs[s.level];
  // Jitter in 10 ms steps (every timing in this file is a multiple of 10 ms).
  const jitterSteps = TIMING.tellJitterMs / 10;
  s.tellDur = Math.max(TIMING.tellMinMs, tellBase + randInt(s, -jitterSteps, jitterSteps) * 10);
  // Sunglasses from the second round on: guaranteed once in round 2, then by chance.
  const nextLook = s.looksThisRound + 1;
  s.sunglasses = s.round >= 1 && ((s.round === 1 && nextLook === s.sunglassesLook) || rand(s) < 0.2);
  if (s.sunglasses) emit(s, "sunglasses");
  s.holdMs = 0;
  s.dashing = false;
  s.lurchedThisBeat = false;
  enter(s, "counting", s.beats * s.beatMs);
  emit(s, "beat");
  if (s.holding) lurch(s);
}

function lurch(s: SneakState): void {
  if (s.pos >= s.pathSteps) return;
  s.pos = Math.min(s.pathSteps, s.pos + (s.dashing ? 2 : 1));
  s.lurchedThisBeat = true;
  s.sinceLurchMs = 0;
  s.lurchSerial += 1;
  s.movedSinceVerdict = true;
  s.freezeMs = 0;
  if (s.phase === "looking") s.movedDuringLook = true;
  emit(s, "step");
  if (s.pos >= s.pathSteps) tag(s);
}

function tag(s: SneakState): void {
  s.tags += 1;
  const prize = s.prizeOrder[(s.tags - 1) % s.prizeOrder.length];
  s.prizes = [...s.prizes, prize];
  s.prizeShown = false;
  s.dashing = false;
  s.skidMs = 0;
  enter(s, "tagged", TIMING.tagCheerMs + TIMING.tagHoldMs);
  emit(s, "tag");
}

function bankCover(s: SneakState): void {
  let best = 0;
  for (const c of s.covers) if (c <= s.pos && c > best) best = c;
  if (best > s.lastCover) s.lastCover = best;
}

function startVerdict(s: SneakState, v: Verdict): void {
  s.verdict = v;
  if (v === "statue") {
    s.statues = [...s.statues, { pose: s.freezePose, heldMs: Math.round(s.freezeMs), round: s.round, at: s.pathSteps > 0 ? s.pos / s.pathSteps : 0 }];
    s.statuesThisRound += 1;
    if (s.sunglasses) meet(s, "sunglasses");
    bankCover(s);
  } else if (v === "blind") {
    meet(s, "sunglasses");
    bankCover(s);
  } else if (v === "caught") {
    s.catchesThisRound += 1;
    s.caughtFrom = s.pos;
    s.pos = s.lastCover;
    s.holdMs = 0;
    s.dashing = false;
    s.skidMs = 0;
    if (s.catchesThisRound >= 2) emit(s, "hint");
  }
  enter(s, "verdict", TIMING.verdictMs[v]);
  emit(s, v);
}

function endVerdict(s: SneakState): void {
  if (s.verdict === "statue" || s.verdict === "caught") {
    s.freezePose = s.freezePose === "freeze-a" ? "freeze-b" : "freeze-a";
  }
  s.verdict = null;
  s.movedSinceVerdict = false;
  s.movedDuringLook = false;
  s.freezeMs = 0;
  beginCounting(s);
}

function endRound(s: SneakState): void {
  // Invisible adaptation: the level is never drawn, named or sent anywhere.
  if (s.catchesThisRound >= 3) {
    s.level = Math.max(1, s.level - 1) as Level;
    s.cleanRounds = 0;
  } else if (s.catchesThisRound === 0 && s.statuesThisRound >= 2) {
    s.cleanRounds += 1;
    if (s.cleanRounds >= 2) {
      s.level = Math.min(3, s.level + 1) as Level;
      s.cleanRounds = 0;
    }
  } else {
    s.cleanRounds = 0;
  }
  s.round += 1;
  s.pos = 0;
  s.lastCover = 0;
  s.looksThisRound = 0;
  s.catchesThisRound = 0;
  s.statuesThisRound = 0;
  s.movedSinceVerdict = false;
  s.verdict = null;
  enter(s, "ready", TIMING.readyMs);
}

/** Time until the next boundary inside the current phase. */
function untilBoundary(s: SneakState): number {
  let until = s.phaseDur - s.phaseMs;
  if (s.phase === "counting") until = Math.min(until, (s.beatIndex + 1) * s.beatMs - s.chantMs);
  if (s.phase === "looking") {
    const grace = TIMING.graceMs[s.track];
    if (s.phaseMs < grace) until = Math.min(until, grace - s.phaseMs);
    if (s.sunglasses) until = Math.min(until, s.beatMs - (s.phaseMs % s.beatMs));
  }
  if (s.phase === "tagged" && !s.prizeShown) until = Math.min(until, TIMING.tagCheerMs - s.phaseMs);
  if (s.phase === "fake" && s.phaseMs < s.tellDur) until = Math.min(until, s.tellDur - s.phaseMs);
  if (s.phase === "intro") {
    const D = TIMING.demo;
    for (const at of [D.pressAt, ...D.beatAt, D.tellAt, D.lookAt, D.statueAt]) if (at > s.phaseMs) { until = Math.min(until, at - s.phaseMs); break; }
  }
  if (s.skidMs > 0) until = Math.min(until, s.skidMs);
  return Math.max(0, until);
}

/** The demonstration ends (its time is up, or the child touched): the game
 *  goes on from where the hero stands; the demo's steps are no statue. */
function handOver(s: SneakState): void {
  s.movedSinceVerdict = false;
  s.freezeMs = 0;
  s.idleMs = 0;
  s.cueMs = s.holding ? 0 : TIMING.handoverCueMs;
  beginCounting(s); // lurches when the child is already holding
}

function onPress(s: SneakState): void {
  s.idleMs = 0;
  s.hinted = false;
  s.cueMs = 0;
  switch (s.phase) {
    case "intro":
      handOver(s);
      break;
    case "waiting":
      beginCounting(s); // lurches: holding is already true
      break;
    case "counting":
      if (!s.lurchedThisBeat) lurch(s);
      break;
    case "looking":
      if (s.sunglasses && !s.lurchedThisBeat) lurch(s);
      break;
    default:
      break;
  }
}

function onRelease(s: SneakState): void {
  // A dash released INSIDE the look skids on: harder to stop in time.
  // Released before the look (counting, tell), a dash is always safe.
  if (s.dashing && s.phase === "looking" && !s.sunglasses) s.skidMs = TIMING.dashSkidMs;
  s.dashing = false;
  s.holdMs = 0;
}

function advance(s: SneakState, ms: number): void {
  s.phaseMs += ms;
  s.elapsedMs += ms;
  s.sinceLurchMs += ms;
  if (s.skidMs > 0) s.skidMs = Math.max(0, s.skidMs - ms);
  if (s.cueMs > 0) s.cueMs = Math.max(0, s.cueMs - ms);

  // B-GAME-07e: the demonstration, scripted on its own clock.
  if (s.phase === "intro") {
    const D = TIMING.demo;
    const was = s.phaseMs - ms;
    const crossed = (at: number) => was < at && s.phaseMs >= at;
    D.beatAt.forEach((at, i) => {
      if (!crossed(at)) return;
      s.beatIndex = i;
      emit(s, "beat");
      s.pos = Math.min(s.pathSteps - 1, s.pos + 1);
      s.lurchSerial += 1;
      emit(s, "step");
    });
    if (crossed(D.tellAt)) emit(s, "tell");
    if (crossed(D.lookAt)) emit(s, "look");
    if (crossed(D.statueAt)) emit(s, "demo-statue");
    if (s.phaseMs >= s.phaseDur) handOver(s);
    return;
  }
  if (!s.holding && s.movedSinceVerdict && s.phase !== "verdict") s.freezeMs += ms;
  if (s.phase === "verdict" && s.verdict === "statue") s.freezeMs += ms;

  // Idle prompts: a hint at 8 s, the chant pauses at 30 s. No penalty, no timeout.
  // (Counted from the hand-over: the demonstration is the cat's turn.)
  if (!s.holding && s.phase !== "tagged" && s.phase !== "done" && s.phase !== "waiting") {
    s.idleMs += ms;
    if (!s.hinted && s.idleMs >= TIMING.hintAfterMs) {
      s.hinted = true;
      emit(s, "hint");
    }
  }

  if (s.phase === "counting") {
    s.chantMs += ms;
    if (s.holding) {
      s.holdMs += ms;
      if (s.track === "B" && !s.dashing && s.holdMs > TIMING.dashAfterMs) {
        s.dashing = true;
        meet(s, "dash");
      }
    }
    if (s.idleMs >= TIMING.waitAfterMs) {
      enter(s, "waiting", Number.POSITIVE_INFINITY);
      emit(s, "waiting");
      return;
    }
    if (s.chantMs >= (s.beatIndex + 1) * s.beatMs) {
      s.beatIndex += 1;
      if (s.beatIndex >= s.beats) {
        enter(s, "tell", s.tellDur);
        emit(s, "tell");
        return;
      }
      s.lurchedThisBeat = false;
      emit(s, "beat");
      if (s.fakeAt !== null && s.beatIndex === s.fakeAt) {
        s.fakeAt = null;
        meet(s, "fake-turn");
        enter(s, "fake", s.tellDur + TIMING.fakeLaughMs);
        emit(s, "fake");
        return;
      }
      if (s.holding && s.sinceLurchMs >= s.beatMs * TIMING.minLurchGapFrac) lurch(s);
    }
    return;
  }

  if (s.phase === "looking") {
    const grace = TIMING.graceMs[s.track];
    if (s.sunglasses) {
      if (s.holding) {
        const beatNow = Math.floor(s.phaseMs / s.beatMs);
        const beatBefore = Math.floor((s.phaseMs - ms) / s.beatMs);
        if (beatNow !== beatBefore) {
          s.lurchedThisBeat = false;
          if (s.sinceLurchMs >= s.beatMs * TIMING.minLurchGapFrac) lurch(s);
          if (s.phase !== "looking") return;
        }
      }
    } else if (s.phaseMs >= grace && (s.holding || s.skidMs > 0)) {
      startVerdict(s, "caught");
      return;
    }
    if (s.phaseMs >= s.phaseDur) {
      const v: Verdict = s.sunglasses && s.movedDuringLook ? "blind" : s.movedSinceVerdict ? "statue" : "still";
      startVerdict(s, v);
    }
    return;
  }

  if (s.phase === "tagged" && !s.prizeShown && s.phaseMs >= TIMING.tagCheerMs) {
    s.prizeShown = true;
    emit(s, "prize");
  }

  // A fake turn: the tell ends in a giggle instead of a look ("fooled").
  if (s.phase === "fake" && s.phaseMs >= s.tellDur && s.phaseMs - ms < s.tellDur) emit(s, "fooled");

  if (s.phaseMs < s.phaseDur) return;

  switch (s.phase) {
    case "ready":
      beginCounting(s);
      break;
    case "fake":
      // Back to the chant where it stopped.
      s.phase = "counting";
      s.phaseDur = s.beats * s.beatMs;
      s.phaseMs = s.chantMs;
      if (s.holding && s.sinceLurchMs >= s.beatMs * TIMING.minLurchGapFrac) lurch(s);
      break;
    case "tell":
      s.looksThisRound += 1;
      s.lurchedThisBeat = false;
      enter(s, "looking", TIMING.graceMs[s.track] + TIMING.lookMs);
      emit(s, "look");
      break;
    case "verdict":
      endVerdict(s);
      break;
    case "tagged":
      if (s.tags >= TAGS_PER_SITTING) {
        enter(s, "done", Number.POSITIVE_INFINITY);
        emit(s, "done");
      } else {
        endRound(s);
      }
      break;
    default:
      break;
  }
}

/** One step of the game. Pure: `state` is never mutated. */
export function step(state: SneakState, dtMs: number, input: { holding: boolean }): SneakState {
  const s: SneakState = { ...state, events: [] };
  if (s.phase === "done") {
    s.holding = input.holding;
    return s;
  }
  const holding = Boolean(input.holding);
  if (holding !== s.holding) {
    s.holding = holding;
    if (holding) onPress(s);
    else onRelease(s);
  }
  let remaining = Math.max(0, Math.min(TIMING.maxDtMs, Number.isFinite(dtMs) ? dtMs : 0));
  let guard = 0;
  while (remaining > 0 && guard++ < 200) {
    const phaseBefore = s.phase;
    const slice = Math.min(remaining, TIMING.maxSliceMs, Math.max(0.5, untilBoundary(s)));
    advance(s, slice);
    remaining -= slice;
    // advance() mutates s; re-read the phase without the narrowing TS carried past the call
    if ((s.phase as Phase) === "done") break;
    // A phase entered with the button already held may owe its first lurch.
    if (s.phase !== phaseBefore && s.phase === "looking" && s.sunglasses && s.holding && !s.lurchedThisBeat) lurch(s);
  }
  return s;
}

// ── derived view ───────────────────────────────────────────────────────────

function demoStepOf(s: SneakState): DemoStep | null {
  if (s.phase !== "intro") return null;
  const D = TIMING.demo;
  return s.phaseMs < D.tellAt ? "count" : s.phaseMs < D.lookAt ? "tell" : s.phaseMs < D.statueAt ? "look" : "statue";
}

function heroPoseOf(s: SneakState): HeroPose {
  if (s.phase === "intro") return s.phaseMs < TIMING.demo.pressAt ? "idle" : s.phaseMs < TIMING.demo.tellAt ? "tiptoe" : s.freezePose;
  if (s.phase === "done") return "hold-up";
  if (s.phase === "tagged") return s.phaseMs < TIMING.tagCheerMs ? "cheer" : "hold-up";
  if (s.phase === "verdict") {
    if (s.verdict === "caught") return s.phaseMs < TIMING.caughtTumbleMs ? "oops" : "tiptoe";
    if (s.verdict === "statue") return s.freezePose;
    return s.movedSinceVerdict && !s.movedDuringLook ? s.freezePose : "idle";
  }
  if (s.skidMs > 0) return "dash";
  if (s.holding && s.phase !== "ready") return s.dashing ? "dash" : "tiptoe";
  if (s.movedSinceVerdict) return s.freezePose;
  return "idle";
}

function watcherPoseOf(s: SneakState): WatcherPose {
  switch (s.phase) {
    case "intro": {
      const d = demoStepOf(s);
      return d === "count" ? "counting" : d === "tell" ? "tell" : "looking";
    }
    case "tell":
      return "tell";
    case "fake":
      return s.phaseMs < s.tellDur ? "tell" : "laughing";
    case "looking":
      return "looking";
    case "verdict":
      return s.verdict === "caught" || s.verdict === "blind" ? "laughing" : "looking";
    case "tagged":
    case "done":
      return "laughing";
    case "waiting":
      return "waiting";
    default:
      return "counting";
  }
}

function handOf(s: SneakState): HandCue | null {
  if (s.phase === "intro") return s.phaseMs >= TIMING.demo.pressAt && s.phaseMs < TIMING.demo.tellAt ? "press" : "lift";
  if (s.phase === "waiting" || s.hinted) return "hint";
  if (s.cueMs > 0 && !s.holding) return "pulse";
  return null;
}

/** Where the hero is DRAWN (0..1). The rules put a caught hero back at his
 *  cover at once; the view lets him tumble where he stood, then scoot back
 *  in visible hops (B-GAME-07f), never a teleport. */
function shownProgress(s: SneakState): number {
  const at = (pos: number) => (s.pathSteps > 0 ? Math.min(1, pos / s.pathSteps) : 0);
  if (s.phase === "verdict" && s.verdict === "caught" && s.caughtFrom > s.pos) {
    const T = TIMING;
    if (s.phaseMs < T.caughtTumbleMs) return at(s.caughtFrom);
    const hop = Math.min(T.caughtSteps, 1 + Math.floor(((s.phaseMs - T.caughtTumbleMs) / (T.caughtBackMs - T.caughtTumbleMs)) * T.caughtSteps));
    return at(s.caughtFrom + ((s.pos - s.caughtFrom) * hop) / T.caughtSteps);
  }
  return at(s.pos);
}

export function view(s: SneakState): SneakView {
  const shades = s.sunglasses && (s.phase === "counting" || s.phase === "fake" || s.phase === "tell" || s.phase === "looking" || (s.phase === "verdict" && s.verdict === "blind"));
  return {
    phase: s.phase,
    progress: shownProgress(s),
    lurch: s.lurchSerial,
    heroPose: heroPoseOf(s),
    watcher: { pose: watcherPoseOf(s), sunglasses: shades, beat: s.phase === "counting" ? s.beatIndex : -1 },
    showHand: handOf(s) !== null,
    hand: handOf(s),
    demo: demoStepOf(s),
    prize: s.phase === "tagged" && s.prizeShown ? s.prizes[s.prizes.length - 1] ?? null : s.phase === "done" ? s.prizes[s.prizes.length - 1] ?? null : null,
    done: s.phase === "done",
    events: s.events,
  };
}

/** The statue held longest this sitting (the Ending's picture), or null. */
export function longestStatue(s: Pick<SneakState, "statues">): StatueRecord | null {
  let best: StatueRecord | null = null;
  for (const st of s.statues) if (!best || st.heldMs > best.heldMs) best = st;
  return best;
}
