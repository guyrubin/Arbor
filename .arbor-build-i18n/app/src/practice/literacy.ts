/* Early-literacy content + pure tracing logic (Mission M7).

   Adds an early-reading parity track (Lingokids / Duolingo ABC style) to the
   child register: articulation → phonics (letter sounds) → sight words → simple
   reading, age-gated to the existing age signals. Plus a finger letter-tracing
   mini-game whose geometry scoring lives here as pure, unit-testable logic.

   Curated, deterministic, sandbox-safe: no API key, no new dependencies.
   Age guidance follows typical early-literacy emergence and is always framed as
   a "typical range", never a diagnostic threshold. */

/* ════════════════════════ Phonics / reading ladder ════════════════════════ */

export type ReadingStage = "phonics" | "sight-words" | "reading";

export const READING_STAGES: { stage: ReadingStage; label: string; hint: string }[] = [
  { stage: "phonics", label: "Letter sounds", hint: "Each letter has a sound — that's the key to reading." },
  { stage: "sight-words", label: "Sight words", hint: "Tiny words we learn by sight, not by sounding out." },
  { stage: "reading", label: "First reading", hint: "Blend the sounds into short, real sentences." },
];

/** One phonics letter: its sound, a key word, and a model cue for the parent. */
export interface PhonicsLetter {
  id: string;          // lowercase letter
  letter: string;      // display, uppercase
  sound: string;       // the letter SOUND, e.g. "mmm" (not the letter name)
  keyword: string;     // anchor word
  emoji: string;
  cue: string;         // how a parent models the sound
}

/* The most useful first letters (high-frequency, easy-to-hear sounds first —
   the order Jolly Phonics / Lingokids introduce them in). */
export const PHONICS_LETTERS: PhonicsLetter[] = [
  { id: "s", letter: "S", sound: "sss", keyword: "sun", emoji: "☀️", cue: "A quiet snake: sss. Don't say 'ess' — just the hiss." },
  { id: "a", letter: "A", sound: "aah", keyword: "apple", emoji: "🍎", cue: "Open your mouth: aah, like the doctor's 'say aah'." },
  { id: "t", letter: "T", sound: "t", keyword: "top", emoji: "🔝", cue: "A tiny tongue tap: t-t-t. Short and crisp." },
  { id: "p", letter: "P", sound: "p", keyword: "pig", emoji: "🐷", cue: "A little puff of air off your lips: p-p-p." },
  { id: "i", letter: "I", sound: "ih", keyword: "igloo", emoji: "🧊", cue: "Short and quick: ih, like the start of 'in'." },
  { id: "n", letter: "N", sound: "nnn", keyword: "net", emoji: "🥅", cue: "Hum with your tongue up: nnn." },
  { id: "m", letter: "M", sound: "mmm", keyword: "moon", emoji: "🌙", cue: "Lips together, yummy hum: mmm." },
  { id: "d", letter: "D", sound: "d", keyword: "dog", emoji: "🐶", cue: "Tongue taps with your voice on: d-d-d." },
  { id: "o", letter: "O", sound: "aw", keyword: "octopus", emoji: "🐙", cue: "Round lips: aw, like the start of 'on'." },
  { id: "c", letter: "C", sound: "k", keyword: "cat", emoji: "🐱", cue: "A little cough at the back: k-k-k." },
];

/** High-frequency sight words children meet first (Dolch pre-primer set). */
export interface SightWord {
  id: string;
  word: string;
  /** A short carrier sentence to use the word in context. */
  sentence: string;
}

export const SIGHT_WORDS: SightWord[] = [
  { id: "the", word: "the", sentence: "Pat the dog." },
  { id: "and", word: "and", sentence: "Mom and me." },
  { id: "is", word: "is", sentence: "It is hot." },
  { id: "a", word: "a", sentence: "I see a cat." },
  { id: "to", word: "to", sentence: "Go to bed." },
  { id: "I", word: "I", sentence: "I can hop." },
  { id: "go", word: "go", sentence: "We go up." },
  { id: "see", word: "see", sentence: "I see you." },
  { id: "we", word: "we", sentence: "We are big." },
  { id: "my", word: "my", sentence: "my red hat" },
];

/** A short decodable line for the first-reading stage, with the words to point to. */
export interface ReadingLine {
  id: string;
  text: string;
  /** What it means / a talking point for the parent. */
  tip: string;
}

export const READING_LINES: ReadingLine[] = [
  { id: "r-sat", text: "The cat sat.", tip: "Point under each word as you read it together — left to right." },
  { id: "r-pin", text: "I see a pig.", tip: "Let your child find the sight word 'a' before you read." },
  { id: "r-sun", text: "The sun is up.", tip: "Sweep your finger under the line as one smooth read." },
  { id: "r-dog", text: "My dog ran to me.", tip: "Pause at the end — ask 'what happened?' to check meaning." },
  { id: "r-top", text: "We can go to the top.", tip: "Celebrate finishing a whole sentence — that's real reading." },
];

/**
 * Which reading stage is developmentally appropriate to introduce at this age?
 * Phonics emerges ~3–4, sight words ~4–5, blended reading ~5+. We surface the
 * stages a child is ready for and never push reading before it's typical.
 */
export function readingStagesForAge(age: number): ReadingStage[] {
  if (age < 3) return ["phonics"];
  if (age < 4) return ["phonics"];
  if (age < 5) return ["phonics", "sight-words"];
  return ["phonics", "sight-words", "reading"];
}

export function isReadingStageAppropriate(stage: ReadingStage, age: number): boolean {
  return readingStagesForAge(age).includes(stage);
}

/* ════════════════════════ Letter-tracing geometry ════════════════════════ */

/** A point in the normalized tracing space (0–1 on both axes). */
export interface TracePoint {
  x: number;
  y: number;
}

/** A traceable letter: ordered strokes, each a guide polyline of 0–1 points. */
export interface TraceLetter {
  id: string;
  letter: string;
  /** Spoken sound (reuses phonics) so the game reinforces letter→sound. */
  sound: string;
  /** Each stroke is an ordered list of guide points (start → end). */
  strokes: TracePoint[][];
}

/* Hand-authored stroke paths in a 0–1 box. Kept simple: straight-segment
   polylines that a 2–6-year-old can follow with a fat finger. Letters chosen to
   reuse the phonics anchors. */
export const TRACE_LETTERS: TraceLetter[] = [
  {
    id: "l", letter: "L", sound: "lll",
    strokes: [[{ x: 0.3, y: 0.15 }, { x: 0.3, y: 0.85 }, { x: 0.75, y: 0.85 }]],
  },
  {
    id: "t", letter: "T", sound: "t",
    strokes: [
      [{ x: 0.2, y: 0.18 }, { x: 0.8, y: 0.18 }],
      [{ x: 0.5, y: 0.18 }, { x: 0.5, y: 0.85 }],
    ],
  },
  {
    id: "i", letter: "I", sound: "ih",
    strokes: [
      [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.7 }],
      [{ x: 0.5, y: 0.82 }, { x: 0.5, y: 0.88 }],
    ],
  },
  {
    id: "a", letter: "A", sound: "aah",
    strokes: [
      [{ x: 0.2, y: 0.85 }, { x: 0.5, y: 0.15 }, { x: 0.8, y: 0.85 }],
      [{ x: 0.32, y: 0.55 }, { x: 0.68, y: 0.55 }],
    ],
  },
  {
    id: "v", letter: "V", sound: "vvv",
    strokes: [[{ x: 0.2, y: 0.18 }, { x: 0.5, y: 0.85 }, { x: 0.8, y: 0.18 }]],
  },
  {
    id: "x", letter: "X", sound: "ks",
    strokes: [
      [{ x: 0.22, y: 0.18 }, { x: 0.78, y: 0.85 }],
      [{ x: 0.78, y: 0.18 }, { x: 0.22, y: 0.85 }],
    ],
  },
];

export const dist = (a: TracePoint, b: TracePoint): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Resample a polyline into `count` evenly-spaced checkpoints along its length.
 * Pure; used to turn a few guide points into a dense set of "did the finger
 * pass near here, in order" targets. Returns the original points if degenerate.
 */
export function resamplePath(points: TracePoint[], count = 24): TracePoint[] {
  if (points.length < 2 || count < 2) return points.slice();
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = dist(points[i - 1], points[i]);
    segLengths.push(d);
    total += d;
  }
  if (total === 0) return points.slice();
  const step = total / (count - 1);
  const out: TracePoint[] = [points[0]];
  let segIdx = 0;
  let segPos = 0; // distance already consumed within the current segment
  for (let k = 1; k < count - 1; k++) {
    let target = step * k;
    // Walk forward to the segment containing `target`.
    let acc = 0;
    for (let i = 0; i < segLengths.length; i++) {
      if (acc + segLengths[i] >= target) {
        segIdx = i;
        segPos = target - acc;
        break;
      }
      acc += segLengths[i];
    }
    const a = points[segIdx];
    const b = points[segIdx + 1];
    const t = segLengths[segIdx] === 0 ? 0 : segPos / segLengths[segIdx];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push(points[points.length - 1]);
  return out;
}

export interface TraceEvaluation {
  /** Fraction (0–1) of stroke checkpoints the trace passed near, in order. */
  coverage: number;
  /** True when coverage clears the (forgiving) pass threshold. */
  passed: boolean;
  /** Index of the next checkpoint not yet reached (for live progress UI). */
  nextCheckpoint: number;
}

/**
 * Score a traced pointer path against one guide stroke. Forgiving by design —
 * this is a confidence-building motor game for small children, not handwriting
 * assessment. A checkpoint counts once any traced point comes within `tolerance`
 * of it; checkpoints must be reached *in order* so scribbling can't pass.
 *
 * Pure: deterministic, no I/O, no Date. All coordinates are normalized 0–1.
 */
export function evaluateTrace(
  guide: TracePoint[],
  traced: TracePoint[],
  tolerance = 0.16,
  passThreshold = 0.8
): TraceEvaluation {
  const checkpoints = resamplePath(guide);
  if (checkpoints.length === 0) return { coverage: 0, passed: false, nextCheckpoint: 0 };
  let next = 0;
  for (const p of traced) {
    // Advance through any consecutive checkpoints this point is near (in order).
    while (next < checkpoints.length && dist(p, checkpoints[next]) <= tolerance) {
      next++;
    }
    if (next >= checkpoints.length) break;
  }
  const coverage = next / checkpoints.length;
  return {
    coverage,
    passed: coverage >= passThreshold,
    nextCheckpoint: Math.min(next, checkpoints.length - 1),
  };
}

/** Stars (0–3) for a finished trace — pure mapping from coverage, for the win UI. */
export function traceStars(coverage: number): 0 | 1 | 2 | 3 {
  if (coverage >= 0.95) return 3;
  if (coverage >= 0.8) return 2;
  if (coverage >= 0.5) return 1;
  return 0;
}

/** Convert normalized 0–1 stroke points into an SVG path `d` string for a box of `size`. */
export function strokeToSvgPath(stroke: TracePoint[], size: number): string {
  if (stroke.length === 0) return "";
  return stroke
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * size).toFixed(1)} ${(p.y * size).toFixed(1)}`)
    .join(" ");
}
