/* Content + pure helpers for the three Hero Arcade worlds added in Wave D:
 * Pattern Power (logic), Beat Keeper (rhythm/regulation), Hero Pose (body
 * imitation). Data-driven and side-effect-free so the engine stays unit-testable
 * — components only render and log PracticeEvents. */

export interface PatternPuzzle {
  id: string;
  /** The visible run, ending just before the missing slot. */
  shown: string[];
  /** The glyph that correctly continues the pattern. */
  answer: string;
  /** Choices presented (includes the answer), shuffled at render time. */
  options: string[];
}

export const PATTERN_PUZZLES: PatternPuzzle[] = [
  // Alternating pairs — the original IDs remain stable for saved/replayed rounds.
  { id: "p1", shown: ["🔴", "🔵", "🔴", "🔵"], answer: "🔴", options: ["🔴", "🔵", "🟡"] },
  { id: "p5", shown: ["🌙", "⭐", "🌙", "⭐"], answer: "🌙", options: ["🌙", "⭐", "☀️"] },
  { id: "p7", shown: ["🍎", "🍐", "🍎", "🍐"], answer: "🍎", options: ["🍎", "🍐", "🍓"] },
  { id: "p8", shown: ["🟣", "🟠", "🟣", "🟠"], answer: "🟣", options: ["🟣", "🟠", "🟢"] },
  { id: "p9", shown: ["🐟", "🐚", "🐟", "🐚"], answer: "🐟", options: ["🐟", "🐚", "🦀"] },
  { id: "p10", shown: ["⬆️", "➡️", "⬆️", "➡️"], answer: "⬆️", options: ["⬆️", "➡️", "⬇️"] },

  // Grouped repetitions.
  { id: "p2", shown: ["⭐", "⭐", "⬛", "⭐", "⭐"], answer: "⬛", options: ["⬛", "⭐", "🔺"] },
  { id: "p4", shown: ["🔺", "🔺", "🔵", "🔺", "🔺"], answer: "🔵", options: ["🔺", "🔵", "⭐"] },
  { id: "p11", shown: ["🍀", "🍀", "🌼", "🍀", "🍀"], answer: "🌼", options: ["🌼", "🍀", "🌻"] },
  { id: "p12", shown: ["🟦", "🟦", "🟨", "🟦", "🟦"], answer: "🟨", options: ["🟨", "🟦", "🟥"] },
  { id: "p13", shown: ["🐸", "🐸", "🪵", "🐸", "🐸"], answer: "🪵", options: ["🪵", "🐸", "🐌"] },
  { id: "p14", shown: ["☁️", "☁️", "🌈", "☁️", "☁️"], answer: "🌈", options: ["🌈", "☁️", "☀️"] },

  // Three-item sequences.
  { id: "p3", shown: ["🟢", "🟡", "🔴", "🟢", "🟡"], answer: "🔴", options: ["🔴", "🟢", "🟡"] },
  { id: "p6", shown: ["🟥", "🟦", "🟩", "🟥", "🟦"], answer: "🟩", options: ["🟩", "🟥", "🟦"] },
  { id: "p15", shown: ["🍓", "🍌", "🍇", "🍓", "🍌"], answer: "🍇", options: ["🍇", "🍓", "🍌"] },
  { id: "p16", shown: ["🚲", "🛴", "🚌", "🚲", "🛴"], answer: "🚌", options: ["🚌", "🚲", "🛴"] },
  { id: "p17", shown: ["🟨", "🟦", "🟪", "🟨", "🟦"], answer: "🟪", options: ["🟪", "🟨", "🟦"] },
  { id: "p18", shown: ["🌱", "🌿", "🌳", "🌱", "🌿"], answer: "🌳", options: ["🌳", "🌱", "🌿"] },
];

/**
 * KID-01: the ONE way a component may read a pattern puzzle by round index.
 * The 6th answer advances `idx` to PATTERN_PUZZLES.length; a bare
 * `PATTERN_PUZZLES[idx]` then dereferences `undefined` BEFORE any done-check
 * can run and white-screens the world at its moment of celebration. Here the
 * index is clamped, so `puzzle` is always a real puzzle and `done` carries the
 * completion signal separately. Pure — the guard in
 * components/practice/patternPower.test.ts plays every round through it.
 */
/**
 * KID-08: the SAME six puzzles in the SAME order, every session, forever —
 * a child who plays twice has already memorised the answers, and the game
 * stops being a game. The order is now seeded from the LOCAL day key, so it is
 * stable for the whole day (a mid-session re-render never reshuffles the board
 * under the child) and different tomorrow. Pure: the caller passes the day.
 *
 * A seeded Fisher-Yates with a small LCG — no crypto, no dependency, and
 * deterministic for a given (day, puzzles) pair, which is what the guard tests.
 */
export function puzzleOrderForDay(dayKey: string, puzzles: PatternPuzzle[] = PATTERN_PUZZLES): PatternPuzzle[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < dayKey.length; i++) {
    h ^= dayKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const out = [...puzzles];
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * KID-07: how many rounds one sitting is. The world used to hand the child a
 * "Play again" that restarted puzzle 1 of the same six — an endless loop with
 * no ending, which is the shape of a pressure mechanic even when nothing is
 * counted. Six rounds IS the set; after that the world says so and stops.
 */
export const PATTERN_ROUNDS_PER_DAY = 6;

/** A short, repeatable six-round session drawn from the larger authored bank. */
export function selectPatternSession(dayKey: string, puzzles: PatternPuzzle[] = PATTERN_PUZZLES): PatternPuzzle[] {
  return puzzleOrderForDay(dayKey, puzzles).slice(0, Math.min(PATTERN_ROUNDS_PER_DAY, puzzles.length));
}

export function patternRound(idx: number, puzzles: PatternPuzzle[] = PATTERN_PUZZLES): { done: boolean; puzzle: PatternPuzzle } {
  const last = Math.max(0, puzzles.length - 1);
  const clamped = Math.min(Math.max(0, Math.floor(idx)), last);
  return { done: idx >= puzzles.length, puzzle: puzzles[clamped] };
}

export interface PoseCard {
  id: string;
  name: string;
  nameHe: string;
  emoji: string;
  cue: string;
  cueHe: string;
  /** An equally valid seated or lower-movement invitation. */
  adaptedCue: string;
  adaptedCueHe: string;
}

export const POSE_CARDS: PoseCard[] = [
  { id: "star", name: "Star shape", nameHe: "צורת כוכב", emoji: "🌟", cue: "Arms and legs out wide like a star!", cueHe: "ידיים ורגליים רחבות כמו כוכב!", adaptedCue: "From a chair, stretch your arms wide like a star.", adaptedCueHe: "מהכיסא, מתחו את הידיים רחב כמו כוכב." },
  { id: "strong", name: "Strong arms", nameHe: "ידיים חזקות", emoji: "💪", cue: "Make a strong-arm shape, then let your shoulders soften.", cueHe: "עשו צורת ידיים חזקות, ואז רככו את הכתפיים.", adaptedCue: "Press your hands together, then relax them.", adaptedCueHe: "לחצו כפות ידיים זו לזו, ואז הרפו." },
  { id: "flamingo", name: "Flamingo", nameHe: "פלמינגו", emoji: "🦩", cue: "Balance on one foot — wobbling is welcome!", cueHe: "התאזנו על רגל אחת — גם להתנדנד זה מצוין!", adaptedCue: "Sit tall and lift one foot for a moment, then switch.", adaptedCueHe: "שבו זקוף והרימו רגל אחת לרגע, ואז החליפו." },
  { id: "fly", name: "Hero fly", nameHe: "מעוף גיבור", emoji: "🦸", cue: "Reach one hand forward and imagine a gentle glide.", cueHe: "שלחו יד אחת קדימה ודמיינו גלישה עדינה.", adaptedCue: "From your seat, reach one hand forward and glide it through the air.", adaptedCueHe: "מהכיסא, שלחו יד קדימה והחליקו אותה באוויר." },
  { id: "tree", name: "Tall tree", nameHe: "עץ גבוה", emoji: "🌳", cue: "Stand tall, arms up like branches in a breeze.", cueHe: "עמדו גבוה, ידיים למעלה כמו ענפים ברוח.", adaptedCue: "Sit tall and sway your branch-arms gently.", adaptedCueHe: "שבו זקוף והניעו בעדינות את ידיי-הענפים." },
  { id: "seed", name: "Tiny seed", nameHe: "זרע קטן", emoji: "🌱", cue: "Make yourself small, then slowly grow tall.", cueHe: "התכנסו קטן ואז גדלו לאט לגובה.", adaptedCue: "Curl your arms close, then open them slowly like a growing seed.", adaptedCueHe: "קרבו ידיים לגוף ואז פתחו אותן לאט כמו זרע שגדל." },
  { id: "rainbow-reach", name: "Rainbow reach", nameHe: "מתיחת קשת", emoji: "🌈", cue: "Reach up and make a soft rainbow curve to each side.", cueHe: "הושיטו יד למעלה וצרו קשת רכה לכל צד.", adaptedCue: "Draw a rainbow in the air with one hand, then the other.", adaptedCueHe: "ציירו קשת באוויר ביד אחת, ואז בשנייה." },
  { id: "sleepy-cat", name: "Sleepy cat stretch", nameHe: "מתיחת חתול ישנוני", emoji: "🐈", cue: "Stretch your arms forward, then tuck them in for a cozy cat curl.", cueHe: "מתחו ידיים קדימה ואז קרבו אותן להתכרבלות של חתול.", adaptedCue: "Reach both hands forward and bring them back for a cat hug.", adaptedCueHe: "שלחו שתי ידיים קדימה והחזירו אותן לחיבוק חתולי." },
  { id: "penguin", name: "Penguin waddle", nameHe: "הליכת פינגווין", emoji: "🐧", cue: "Keep your arms by your sides and take two small penguin steps.", cueHe: "הצמידו ידיים לצדדים ועשו שני צעדי פינגווין קטנים.", adaptedCue: "Keep your arms by your sides and tip your shoulders side to side.", adaptedCueHe: "השאירו ידיים לצדדים והטו כתפיים מצד לצד." },
  { id: "river-balance", name: "River balance", nameHe: "איזון נהר", emoji: "🏞️", cue: "Hold your arms out and sway slowly like a bridge over a river.", cueHe: "החזיקו ידיים לצדדים והתנדנדו לאט כמו גשר מעל נהר.", adaptedCue: "Sit tall with arms out and sway slowly from side to side.", adaptedCueHe: "שבו זקוף עם ידיים לצדדים והתנדנדו לאט מצד לצד." },
  { id: "butterfly", name: "Butterfly wings", nameHe: "כנפי פרפר", emoji: "🦋", cue: "Lift and lower your arms like quiet butterfly wings.", cueHe: "הרימו והורידו ידיים כמו כנפי פרפר שקטות.", adaptedCue: "Let your hands flutter gently in your lap or in the air.", adaptedCueHe: "הניעו בעדינות את הידיים בחיק או באוויר." },
  { id: "balloon", name: "Balloon float", nameHe: "בלון מרחף", emoji: "🎈", cue: "Reach for an imaginary balloon and let it float down slowly.", cueHe: "הושיטו יד לבלון דמיוני ותנו לו לרחף לאט למטה.", adaptedCue: "Lift one hand like a balloon, then float it slowly down.", adaptedCueHe: "הרימו יד אחת כמו בלון ואז הורידו אותה לאט." },
];

export const POSE_ROUNDS_PER_SESSION = 6;

/** Stable six-card pose session; a new seed can invite variety without extending the sitting. */
export function selectPoseSession(seed = "pose-session", cards: PoseCard[] = POSE_CARDS): PoseCard[] {
  const keyedCards = cards.map((card) => ({ card, key: `${seed}:${card.id}` }));
  let h = 0x811c9dc5;
  for (const { key } of keyedCards) {
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  const ordered = [...cards];
  for (let i = ordered.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered.slice(0, Math.min(POSE_ROUNDS_PER_SESSION, cards.length));
}

export interface BeatRound {
  beats: number;
  intervalMs: number;
}

export interface BeatSet {
  id: string;
  label: { en: string; he: string };
  rounds: BeatRound[];
}

/** Tempo ramps up across rounds; gentle enough for a 5–8 year old. */
export const BEAT_ROUNDS: BeatRound[] = [
  { beats: 6, intervalMs: 900 },
  { beats: 8, intervalMs: 760 },
  { beats: 8, intervalMs: 640 },
];

/** Three gentle three-round sound journeys. The default remains gentle rain. */
export const BEAT_SETS: BeatSet[] = [
  { id: "gentle-rain", label: { en: "Gentle rain", he: "גשם עדין" }, rounds: BEAT_ROUNDS },
  { id: "walking-parade", label: { en: "Walking parade", he: "מצעד הליכה" }, rounds: [
    { beats: 6, intervalMs: 800 }, { beats: 8, intervalMs: 800 }, { beats: 8, intervalMs: 800 },
  ] },
  { id: "star-signals", label: { en: "Star signals", he: "אותות כוכבים" }, rounds: [
    { beats: 4, intervalMs: 1200 }, { beats: 5, intervalMs: 1100 }, { beats: 6, intervalMs: 1000 },
  ] },
];

/** Score a set of taps against the beat times they were aiming for, 0–100.
 * Each tap earns up to 100 by closeness to its nearest expected beat, within
 * `tolMs`; missing or extra taps simply don't earn. Pure + deterministic. */
export function scoreBeatTaps(expected: number[], taps: number[], tolMs = 320): number {
  if (expected.length === 0) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const t of taps) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < expected.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(t - expected[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDist <= tolMs) {
      used.add(bestIdx);
      total += Math.round((1 - bestDist / tolMs) * 100);
    }
  }
  return Math.round(total / expected.length);
}

/** Map a 0–100 accuracy score to a 1–3 star rating (kind, never zero stars). */
export function gradeStars(score: number): number {
  if (score >= 80) return 3;
  if (score >= 50) return 2;
  return 1;
}
