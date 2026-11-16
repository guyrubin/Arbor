/** The Paper Boat rules. Pure: no React, no timers, no randomness.
 *
 * A four-spread pop-up book. The whole book is one continuous number, the
 * book position `u` (0 … 3): an integer is a spread lying open, a fraction is
 * a page in the air between two spreads. Every pop-up layer's angle comes from
 * its spread's fold progress (0 flat … 1 fully open), and that progress comes
 * from `u`, so the scenery folds with the page by construction.
 *
 * Nothing here can be failed or counted against the child: a rock nudges the
 * boat back into its channel, a gate waits for the boat, the storm calms when
 * the wheel is held steady, the quay waits until the boat comes alongside. */

export type Dir = 'ltr' | 'rtl';
export type SpreadIndex = 0 | 1 | 2 | 3;
export const SPREADS = 4;
export const LAST_SPREAD: SpreadIndex = 3;
export type TurnIntent = 'next' | 'back';
/** Channels across the water, counted from the far bank: 0 far, 1 middle, 2 near. */
export type Lane = 0 | 1 | 2;
export const LANES: readonly Lane[] = [0, 1, 2];

/* ── the book object (book-local px; the page lies on the table) ─────────── */
/** One page: width along the spine's normal, depth from the far edge to the reader. */
export const PAGE_W = 250;
export const PAGE_D = 290;
export const SPREAD_W = PAGE_W * 2;
/** The book lies on the table seen from the front, about 42° above it. */
export const BOOK_TILT = 48;
export const BOOK_PERSPECTIVE = 1800;
/** Depth of the three channels on the pages (far → near). */
export const LANE_Y: readonly number[] = [128, 176, 224];

export const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/* ── fold geometry ────────────────────────────────────────────────────────── */
export type LayerKind = 'stand' | 'vfold' | 'stalk';
/** The tallest a hinged layer stands. Just short of upright, like real paper. */
export const STAND_MAX = 88;
export interface FoldAngles {
  /** A layer hinged on its page: degrees up from the page. */
  stand: number;
  /** A V-fold across the spine: each wing stands `rise` and leans `yaw` about the
   * spine towards the other wing; flat open it is a shallow V, closed the wings meet. */
  vfold: { rise: number; yaw: number };
  /** A layer on a stalk: the stalk stands like a hinged layer, then slides its
   * piece up by `lift` (0 … 1 of the stalk) once the page is mostly open. */
  stalk: { angle: number; lift: number };
  /** How strongly a standing layer shadows the page (0 … 1). The shadow is what sells the depth. */
  shadow: number;
}
const smooth = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
export function foldAngles(progress: number): FoldAngles {
  const p = clamp01(progress);
  const stand = p * STAND_MAX;
  return {
    stand,
    vfold: { rise: stand, yaw: 14 + 64 * (1 - p) },
    stalk: { angle: stand, lift: smooth(0.35, 1, p) },
    shadow: Math.sin((stand * Math.PI) / 180),
  };
}
/** The angle a layer kind stands at, for one progress. */
export function layerAngle(kind: LayerKind, progress: number): number {
  const fold = foldAngles(progress);
  return kind === 'vfold' ? fold.vfold.rise : kind === 'stalk' ? fold.stalk.angle : fold.stand;
}

/* ── the page turn ────────────────────────────────────────────────────────── */
/** What the book shows at position `u`. Settled: one spread, no leaf in the air.
 * Turning between spread a and a+1 by fraction f: the left page lies still with
 * a's left half, the right page shows (a+1)'s right half rising, and the leaf
 * carries a's right half on its front and (a+1)'s left half on its back. The
 * leaf turns about the spine, 0 → −180°. In Hebrew the whole book is mirrored,
 * so the same leaf is the left page turning to the right. */
export interface BookScene {
  settled: boolean;
  /** The spread a settled book shows, or the lower spread of a turn. */
  from: SpreadIndex;
  to: SpreadIndex;
  /** 0 … 1 of the way from `from` to `to`. */
  fraction: number;
  staticLeft: SpreadIndex;
  staticRight: SpreadIndex;
  leafFront: SpreadIndex | null;
  leafBack: SpreadIndex | null;
  /** The leaf's rotation about the spine, in the book's own (unmirrored) frame. */
  leafAngle: number;
  /** Fold progress of each spread now (0 for spreads not in view). */
  progress: readonly [number, number, number, number];
}
export function clampPosition(u: number): number {
  return Math.min(LAST_SPREAD, Math.max(0, finite(u)));
}
export function bookScene(position: number): BookScene {
  const u = clampPosition(position);
  const lower = Math.min(LAST_SPREAD - 1, Math.floor(u)) as SpreadIndex;
  const fraction = u - lower;
  const progress: [number, number, number, number] = [0, 0, 0, 0];
  if (fraction <= 1e-6 || fraction >= 1 - 1e-6) {
    const at = (fraction >= 1 - 1e-6 ? lower + 1 : lower) as SpreadIndex;
    progress[at] = 1;
    return { settled: true, from: at, to: at, fraction: 0, staticLeft: at, staticRight: at, leafFront: null, leafBack: null, leafAngle: 0, progress };
  }
  const upper = (lower + 1) as SpreadIndex;
  progress[lower] = 1 - fraction; progress[upper] = fraction;
  return { settled: false, from: lower, to: upper, fraction, staticLeft: lower, staticRight: upper, leafFront: lower, leafBack: upper, leafAngle: -180 * fraction, progress };
}
/** Reading order. English opens left to right; Hebrew opens from the other
 * side: the spine order and turn direction are mirrored, the story is not. */
export interface PageOrder { mirror: boolean; nextCorner: 'right' | 'left'; backCorner: 'right' | 'left'; turnsToward: 'left' | 'right' }
export function pageOrder(dir: Dir): PageOrder {
  return dir === 'rtl'
    ? { mirror: true, nextCorner: 'left', backCorner: 'right', turnsToward: 'right' }
    : { mirror: false, nextCorner: 'right', backCorner: 'left', turnsToward: 'left' };
}
/** The leaf's rotation as the reader sees it (screen frame): English turns the
 * right page over to the left (negative), Hebrew the left page over to the right. */
export function visibleLeafAngle(fraction: number, dir: Dir): number {
  const angle = -180 * clamp01(fraction);
  return dir === 'rtl' ? -angle : angle;
}
/** A swipe across the book. Left in English is forward; right in Hebrew. */
export const SWIPE_MIN = 44;
export function swipeIntent(dx: number, dir: Dir, min = SWIPE_MIN): TurnIntent | null {
  const forward = dir === 'rtl' ? finite(dx) : -finite(dx);
  if (forward >= min) return 'next';
  if (forward <= -min) return 'back';
  return null;
}
/** A drag that is turning a page: how far it has carried the leaf (0 … 1). */
export function dragFraction(dx: number, width: number, dir: Dir, intent: TurnIntent): number {
  const forward = dir === 'rtl' ? finite(dx) : -finite(dx);
  const along = intent === 'next' ? forward : -forward;
  return clamp01(along / Math.max(1, finite(width, 1)));
}
/** Arrow keys turn pages in reading direction. */
export function keyIntent(key: string, dir: Dir): TurnIntent | null {
  if (key === 'PageDown') return 'next';
  if (key === 'PageUp') return 'back';
  if (key === 'ArrowRight') return dir === 'rtl' ? 'back' : 'next';
  if (key === 'ArrowLeft') return dir === 'rtl' ? 'next' : 'back';
  return null;
}
/** Screen position of a point of the open book (book-local x, y on the page
 * plane, `height` up off the page), relative to the book's centre, after the
 * tilt and the perspective. */
export function projectBookPoint(x: number, y: number, mirror = false, height = 0, tilt = BOOK_TILT): { x: number; y: number } {
  const X = (mirror ? SPREAD_W - x : x) - SPREAD_W / 2, Y = y - PAGE_D / 2;
  const a = (tilt * Math.PI) / 180;
  const z = Y * Math.sin(a) + height * Math.cos(a), scale = BOOK_PERSPECTIVE / (BOOK_PERSPECTIVE - z);
  return { x: X * scale, y: (Y * Math.cos(a) - height * Math.sin(a)) * scale };
}
/** The point of the page under a screen position (the inverse, on the page plane). */
export function unprojectBookPoint(sx: number, sy: number, mirror = false, tilt = BOOK_TILT): { x: number; y: number } {
  const a = (tilt * Math.PI) / 180;
  const Y = (finite(sy) * BOOK_PERSPECTIVE) / (BOOK_PERSPECTIVE * Math.cos(a) + finite(sy) * Math.sin(a));
  const X = finite(sx) / (BOOK_PERSPECTIVE / (BOOK_PERSPECTIVE - Y * Math.sin(a))) + SPREAD_W / 2;
  return { x: mirror ? SPREAD_W - X : X, y: Y + PAGE_D / 2 };
}
/** The tallest piece that stands on a page, and how far back the tall ones are hinged. */
export const POP_TALLEST = 190;
/** A phone has room above the book, not beside it: there the book is seen from
 * a little higher, so its pages are deeper. Never lower than this. */
export const BOOK_TILT_MIN = 42;
/** The room the book needs at a tilt (unscaled px): its pages, its board, the
 * pieces standing up off the far edge and the shadow under the near one. */
export interface StageBox { w: number; h: number; cx: number; cy: number }
export function stageBox(tilt = BOOK_TILT): StageBox {
  const front = projectBookPoint(SPREAD_W + 10, PAGE_D + 12, false, 0, tilt);
  const top = Math.min(projectBookPoint(SPREAD_W / 2, 30, false, 180, tilt).y, projectBookPoint(SPREAD_W, 72, false, POP_TALLEST, tilt).y, projectBookPoint(0, -10, false, 0, tilt).y);
  const half = front.x + 6;
  return { w: half * 2, h: front.y + 24 - top + 8, cx: half, cy: 8 - top };
}
/** The largest book a room of `width` × `height` holds. Where the width is
 * what limits it (a tall phone), the book tips towards the reader as far as
 * the spare height allows, down to BOOK_TILT_MIN. */
export function fitBook(width: number, height: number): { scale: number; tilt: number; box: StageBox } {
  const w = Math.max(1, finite(width, 1)), h = Math.max(1, finite(height, 1));
  let tilt = BOOK_TILT, box = stageBox(tilt);
  if (w / box.w < h / box.h) for (let t = BOOK_TILT - 1; t >= BOOK_TILT_MIN; t--) {
    const lower = stageBox(t);
    if (h / lower.h < w / lower.w) break;
    tilt = t; box = lower;
  }
  return { tilt, box, scale: Math.min(w / box.w, h / box.h) };
}

/* ── a finger on the page ─────────────────────────────────────────────────── */
/** A page is paper: the point that was grabbed stays under the finger. `offset`
 * is the finger's distance from the spine (screen px), positive on the side the
 * unread pages lie on. A grab near the spine would whip the page over, so the
 * radius is never less than this share of the page. */
export const GRAB_MIN = 0.42;
export function grabRadius(offset: number, pageWidth: number, intent: TurnIntent): number {
  const page = Math.max(1, finite(pageWidth, 1)), onLeaf = intent === 'next' ? finite(offset) : -finite(offset);
  return Math.min(page, Math.max(GRAB_MIN * page, onLeaf > 0 ? onLeaf : page));
}
/** How far over the leaf is (0 lying unread … 1 lying read) when the grabbed
 * point, `radius` from the spine, is `offset` from it on the screen. */
export function leafFraction(offset: number, radius: number): number {
  const r = Math.max(1, finite(radius, 1));
  return Math.acos(Math.min(1, Math.max(-1, finite(offset) / r))) / Math.PI;
}
/** Letting go: a flick carries the page over (or back); otherwise it falls to the nearer side. */
export const FLICK = 0.9;
export function turnRelease(fraction: number, velocity: number): 0 | 1 {
  const f = clamp01(fraction), v = finite(velocity);
  if (v > FLICK && f > 0.06) return 1;
  if (v < -FLICK && f < 0.94) return 0;
  return f >= 0.5 ? 1 : 0;
}
/** Follow-through. While its page is in the air an arriving spread's pieces
 * stand only this far; when the page lands they rise the rest of the way one
 * after another, far pieces first, each with a small paper wobble. */
export const ARRIVE = 0.84;
export const SETTLE_STAGGER = 0.05;
export const SETTLE_SPAN = 0.4;
export function settleRise(seconds: number, order: number): { p: number; lean: number } {
  const u = (finite(seconds, 99) - 0.05 - Math.max(0, finite(order)) * SETTLE_STAGGER) / SETTLE_SPAN;
  if (u <= 0) return { p: ARRIVE, lean: 0 };
  if (u >= 2.4) return { p: 1, lean: 0 };
  return { p: Math.min(1, ARRIVE + (1 - ARRIVE) * u * 3), lean: 9 * Math.exp(-3 * u) * Math.sin(u * 9) };
}
export const settleSeconds = (pieces: number) => 0.07 + Math.max(0, pieces) * SETTLE_STAGGER + SETTLE_SPAN * 2.4;

/* ── things that answer a poke ────────────────────────────────────────────── */
/** A decaying wobble, `seconds` after a poke (degrees or px). */
export function shake(seconds: number, amp = 8, freq = 13, decay = 3.6): number {
  const s = finite(seconds, -1);
  return s < 0 || s > 2.4 ? 0 : amp * Math.sin(s * freq) * Math.exp(-s * decay);
}
/** One hop: 0 → 1 → 0 over `span` seconds. */
export function hopArc(seconds: number, span = 0.5): number {
  const s = finite(seconds, -1);
  return s <= 0 || s >= span ? 0 : Math.sin((Math.PI * s) / span);
}
/** A piece that pops up when poked, stays a moment and folds away again: 0
 * down … 1 up, with a little overshoot on the way up. */
export const PEEK_RISE = 0.24;
export const PEEK_FALL = 0.32;
export function peek(seconds: number, hold = 1.5): number {
  const s = finite(seconds, -1);
  if (s <= 0 || s >= PEEK_RISE + hold + PEEK_FALL) return 0;
  if (s < PEEK_RISE) { const k = s / PEEK_RISE - 1; return 1 + 2.4 * k * k * k + 1.4 * k * k; }
  if (s <= PEEK_RISE + hold) return 1;
  const k = (s - PEEK_RISE - hold) / PEEK_FALL;
  return 1 - k * k;
}
/** Things that happen one after another: how many of `count` have happened
 * `ms` in, the first at `start`, then one every `every`. */
export function stepped(ms: number, start: number, every: number, count: number): number {
  const t = finite(ms, -1) - start;
  return t < 0 ? 0 : Math.min(count, 1 + Math.floor(t / Math.max(1, every)));
}

/* ── the hand that shows the first move ───────────────────────────────────── */
/** One showing takes this long; it comes back after this long with no touch. */
export const HINT_PLAY = 2.4;
export const HINT_REST = 6;
/** The hand at `k` (0 … 1) of one showing: it fades in, presses, travels, holds, lets go. */
export function hintPose(k: number): { show: number; press: number; travel: number } {
  const t = clamp01(k);
  return {
    show: Math.min(clamp01(t / 0.1), clamp01((1 - t) / 0.12)),
    press: Math.min(clamp01((t - 0.1) / 0.06), clamp01((0.88 - t) / 0.06)),
    travel: smooth(0.2, 0.66, t),
  };
}

/* ── the paper wheel ──────────────────────────────────────────────────────── */
export const WHEEL_LIMIT = 90;
/** One press of a wheel button, or one arrow key. */
export const WHEEL_STEP = 30;
/** A ratchet tick every this many degrees. */
export const WHEEL_DETENT = 15;
/** Beyond this the wheel is steering to a side channel. */
export const LANE_THRESHOLD = 20;
export function clampWheel(angle: number): number {
  return Math.min(WHEEL_LIMIT, Math.max(-WHEEL_LIMIT, finite(angle)));
}
/** The signed change from one pointer angle to the next, the short way round. */
export function angleDelta(from: number, to: number): number {
  let delta = (finite(to) - finite(from)) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}
/** Dragging around the wheel's centre: the wheel follows the finger, within its stops. */
export function wheelDrag(current: number, fromPointer: number, toPointer: number): number {
  return clampWheel(current + angleDelta(fromPointer, toPointer));
}
/** Pointer angle about the centre, in degrees clockwise from straight up. */
export function pointerAngle(dx: number, dy: number): number {
  return (Math.atan2(finite(dx), -finite(dy)) * 180) / Math.PI;
}
/** How many ratchet detents a turn crossed (for the wooden tick). */
export function wheelDetents(from: number, to: number): number {
  return Math.abs(Math.floor(clampWheel(to) / WHEEL_DETENT) - Math.floor(clampWheel(from) / WHEEL_DETENT));
}
/** Which channel the wheel steers to. The heading turns the way the wheel
 * turns, as seen on the screen: clockwise swings the bow clockwise. The boat
 * sails rightward in English, so clockwise brings it nearer; in the mirrored
 * Hebrew book it sails leftward, so clockwise carries it to the far bank. */
export function laneForAngle(angle: number, dir: Dir): Lane {
  const side = dir === 'rtl' ? -clampWheel(angle) : clampWheel(angle);
  return side > LANE_THRESHOLD ? 2 : side < -LANE_THRESHOLD ? 0 : 1;
}
/** The wheel angle that steers to a channel (what the buttons and keys aim for). */
export function angleForLane(lane: Lane, dir: Dir): number {
  const side = lane === 2 ? 2 * WHEEL_STEP : lane === 0 ? -2 * WHEEL_STEP : 0;
  return dir === 'rtl' ? -side : side;
}
/** The boat card's yaw (book frame, degrees) while it moves across channels:
 * the bow swings towards where it is going. Positive turns the bow away from the reader. */
export function boatYaw(pos: number, target: number): number {
  return Math.max(-28, Math.min(28, (finite(pos) - finite(target)) * 26));
}
/** How fast the boat crosses channels (channels per second). */
export const LANE_RATE = 2.2;
function easeLane(pos: number, target: number, dt: number): number {
  const diff = target - pos, step = LANE_RATE * dt;
  return Math.abs(diff) <= step ? target : pos + Math.sign(diff) * step;
}
const steps = (dt: number) => Math.min(0.1, Math.max(0, finite(dt)));

/* ── spread 1: the stream ─────────────────────────────────────────────────── */
/** Where the boat waits on the bank and where it floats once launched (spread x, page y). */
export const BOAT_BANK: Readonly<{ x: number; y: number }> = { x: 122, y: 268 };
export const BOAT_STREAM: Readonly<{ x: number; y: number }> = { x: 296, y: 262 };
/** A drag of the boat at least this far towards the water launches it; a
 * shorter one lets it drift back to the bank. A tap launches it too. */
export const LAUNCH_DRAG = 26;
export function launchFromDrag(dx: number, dy: number): boolean {
  return Math.hypot(finite(dx), finite(dy)) >= LAUNCH_DRAG && finite(dy) > -LAUNCH_DRAG / 2;
}

/* ── spread 2: the wheel and the river ────────────────────────────────────── */
export type RiverKind = 'reedGate' | 'rock' | 'pad';
export interface RiverItem { id: string; at: number; lane: Lane; kind: RiverKind }
/** Where the boat sits on the spread (x); the river flows past it. */
export const RIVER_BOAT_X = 150;
export const RIVER_SPEED = 62;
/** A gate stops the river this far before the boat until the boat lines up with it. */
export const GATE_HOLD = 34;
/** Three reed arches: near, far, then the middle. A rock waits in the lane of the
 * arch just passed, a little before the next one, so a boat that lingers is
 * nudged the right way; a lily pad only floats by. */
export const RIVER_COURSE: readonly RiverItem[] = [
  { id: 'pad-a', at: 180, lane: 0, kind: 'pad' },
  { id: 'gate-1', at: 300, lane: 2, kind: 'reedGate' },
  { id: 'pad-b', at: 470, lane: 1, kind: 'pad' },
  { id: 'rock-1', at: 590, lane: 2, kind: 'rock' },
  { id: 'gate-2', at: 720, lane: 0, kind: 'reedGate' },
  { id: 'pad-c', at: 850, lane: 2, kind: 'pad' },
  { id: 'rock-2', at: 970, lane: 0, kind: 'rock' },
  { id: 'gate-3', at: 1100, lane: 1, kind: 'reedGate' },
  { id: 'pad-d', at: 1200, lane: 0, kind: 'pad' },
];
export const RIVER_GATES = RIVER_COURSE.filter(item => item.kind === 'reedGate');
export const RIVER_END = 1240;
/** Play again is another river: the same three arches in a new order. Every
 * course needs the wheel turned both ways, and each stone still waits in the
 * lane of the arch just passed, nudging towards the next one. */
const course = (lanes: readonly [Lane, Lane, Lane], pads: readonly [Lane, Lane, Lane, Lane]): readonly RiverItem[] => [
  { id: 'pad-a', at: 180, lane: pads[0], kind: 'pad' },
  { id: 'gate-1', at: 300, lane: lanes[0], kind: 'reedGate' },
  { id: 'pad-b', at: 470, lane: pads[1], kind: 'pad' },
  { id: 'rock-1', at: 590, lane: lanes[0], kind: 'rock' },
  { id: 'gate-2', at: 720, lane: lanes[1], kind: 'reedGate' },
  { id: 'pad-c', at: 850, lane: pads[2], kind: 'pad' },
  { id: 'rock-2', at: 970, lane: lanes[1], kind: 'rock' },
  { id: 'gate-3', at: 1100, lane: lanes[2], kind: 'reedGate' },
  { id: 'pad-d', at: 1200, lane: pads[3], kind: 'pad' },
];
export const RIVER_COURSES: readonly (readonly RiverItem[])[] = [RIVER_COURSE, course([0, 2, 1], [2, 1, 0, 2]), course([0, 1, 2], [2, 0, 0, 1]), course([2, 1, 0], [0, 0, 2, 2])];
export const riverCourse = (index: number): readonly RiverItem[] => RIVER_COURSES[((Math.trunc(finite(index)) % RIVER_COURSES.length) + RIVER_COURSES.length) % RIVER_COURSES.length];
export const riverGates = (index: number): readonly RiverItem[] => riverCourse(index).filter(item => item.kind === 'reedGate');
export interface RiverState {
  /** How far the river has flowed past the boat. */
  d: number;
  /** The boat's channel position (0 far … 2 near), continuous while it moves. */
  pos: number;
  /** Reed arches passed so far (0 … 3). */
  gates: number;
  /** While the river is short of this distance a rock's nudge steers the boat. */
  bumpUntil: number;
  bumpLane: Lane | null;
  /** How many times a rock has nudged the boat (a key for the soft spin; never shown). */
  nudges: number;
  /** Which of RIVER_COURSES this river runs. */
  course: number;
}
export type RiverEvent = 'reedGate' | 'bump' | 'held';
export function createRiver(course = 0): RiverState {
  return { d: 0, pos: 1, gates: 0, bumpUntil: -1, bumpLane: null, nudges: 0, course: ((Math.trunc(finite(course)) % RIVER_COURSES.length) + RIVER_COURSES.length) % RIVER_COURSES.length };
}
export const riverDone = (river: RiverState) => river.gates >= RIVER_GATES.length;
/** Where a river item is on the spread now. */
export function riverItemX(item: RiverItem, d: number): number {
  return RIVER_BOAT_X + item.at - finite(d);
}
/** Items rise as they slide in from the page edge and fold flat as they leave. */
export const ITEM_EDGE = 44;
export function edgeProgress(x: number): number {
  return clamp01(Math.min((SPREAD_W - x) / ITEM_EDGE, x / ITEM_EDGE));
}
const aligned = (pos: number, lane: Lane) => Math.abs(pos - lane) < 0.2;
export function riverStep(river: RiverState, dt: number, target: Lane): { river: RiverState; events: RiverEvent[] } {
  const span = steps(dt), events: RiverEvent[] = [];
  let { d, pos, gates, bumpUntil, bumpLane, nudges } = river;
  const items = riverCourse(river.course), arches = riverGates(river.course);
  const steering = bumpLane !== null && d < bumpUntil ? bumpLane : target;
  if (!(d < bumpUntil)) bumpLane = null;
  pos = easeLane(pos, steering, span);
  const gate = arches[gates];
  let next = Math.min(RIVER_END, d + RIVER_SPEED * span);
  if (gate && !aligned(pos, gate.lane) && next > gate.at - GATE_HOLD) {
    next = Math.max(d, gate.at - GATE_HOLD);
    if (next >= gate.at - GATE_HOLD - 1e-6) events.push('held');
  }
  for (const item of items) {
    if (item.kind !== 'rock' || !(item.at > d && item.at <= next)) continue;
    if (Math.round(pos) !== item.lane) continue;
    // A stone always sends the boat on towards the next arch.
    const toward = gate ? Math.sign(gate.lane - item.lane) : 0;
    bumpLane = (toward !== 0 ? item.lane + toward : item.lane === 1 ? (pos >= 1 ? 2 : 0) : 1) as Lane;
    bumpUntil = item.at + 60; nudges += 1;
    pos += (bumpLane - pos) * 0.3;
    events.push('bump');
  }
  if (gate && next >= gate.at && aligned(pos, gate.lane)) { gates += 1; events.push('reedGate'); }
  d = next;
  return { river: { ...river, d, pos, gates, bumpUntil, bumpLane, nudges }, events };
}

/* ── spread 3: the storm ──────────────────────────────────────────────────── */
/** Steady = the wheel within this many degrees of straight ahead (bow into the waves). */
export const STORM_BAND = 12;
/** Seconds of steadiness (cumulative) that calm the storm. */
export const STORM_NEED = 3;
/** Steadiness fades this much slower than it gathers while the wheel is off. */
export const STORM_DECAY = 0.35;
export const FIRST_GUST = 0.9;
export const GUST_EVERY = 3.4;
export const GUST_PUSH = 30;
export interface StormState { steady: number; calmed: boolean; elapsed: number; nextGust: number; gustSign: 1 | -1 }
export function createStorm(firstGust: 1 | -1 = 1): StormState {
  return { steady: 0, calmed: false, elapsed: 0, nextGust: FIRST_GUST, gustSign: firstGust };
}
/** 0 stormy … 1 calm. */
export function stormCalm(storm: StormState): number {
  return storm.calmed ? 1 : clamp01(storm.steady / STORM_NEED);
}
export const steadyAngle = (angle: number) => Math.abs(clampWheel(angle)) <= STORM_BAND;
/** One step of weather. `held`: a finger is on the wheel, so a gust cannot turn it.
 * `push` is how far the gust swings an unheld wheel (0: no gust or the wheel held). */
export function stormStep(storm: StormState, dt: number, angle: number, held: boolean): { storm: StormState; push: number; gust: boolean } {
  const span = steps(dt);
  let { steady, calmed, elapsed, nextGust, gustSign } = storm;
  elapsed += span;
  if (!calmed) {
    steady = steadyAngle(angle) ? steady + span : Math.max(0, steady - span * STORM_DECAY);
    if (steady >= STORM_NEED) { steady = STORM_NEED; calmed = true; }
  }
  let push = 0, gust = false;
  if (!calmed && elapsed >= nextGust) {
    gust = true; nextGust += GUST_EVERY;
    const calm = clamp01(steady / STORM_NEED);
    if (!held) {
      const a = clampWheel(angle), sign = a > 2 ? 1 : a < -2 ? -1 : gustSign;
      push = sign * GUST_PUSH * (1 - 0.5 * calm);
      gustSign = gustSign === 1 ? -1 : 1;
    }
  }
  return { storm: { steady, calmed, elapsed, nextGust, gustSign }, push, gust };
}

/* ── spread 4: the harbour ────────────────────────────────────────────────── */
export const HARBOUR_START_X = 70;
/** The quay runs along the far side of the right page; the boat moors at the bollard. */
export const QUAY_X = 372;
export const QUAY_LANE: Lane = 0;
export const QUAY_HOLD = 56;
export const HARBOUR_SPEED = 46;
export const HARBOUR_LAMPS = 5;
export interface HarbourState { x: number; pos: number; docked: boolean; lamps: number }
export function createHarbour(): HarbourState {
  return { x: HARBOUR_START_X, pos: 1, docked: false, lamps: 0 };
}
export function harbourStep(harbour: HarbourState, dt: number, target: Lane): { harbour: HarbourState; docked: boolean; held: boolean } {
  if (harbour.docked) return { harbour, docked: false, held: false };
  const span = steps(dt);
  const pos = easeLane(harbour.pos, target, span);
  const lined = aligned(pos, QUAY_LANE);
  let x = Math.min(QUAY_X, harbour.x + HARBOUR_SPEED * span), held = false;
  if (!lined && x > QUAY_X - QUAY_HOLD) { x = Math.max(harbour.x, QUAY_X - QUAY_HOLD); held = true; }
  const docked = lined && x >= QUAY_X;
  return { harbour: { ...harbour, x, pos: docked ? QUAY_LANE : pos, docked }, docked, held };
}
/** The lamps come on one by one after the rope drops. */
export const ROPE_MS = 700;
export const LAMP_MS = 420;
export function lampsLit(msSinceDock: number): number {
  const t = finite(msSinceDock) - ROPE_MS;
  return t < 0 ? 0 : Math.min(HARBOUR_LAMPS, 1 + Math.floor(t / LAMP_MS));
}
/** "The end" appears once the last lamp is lit. */
export const END_MS = ROPE_MS + LAMP_MS * HARBOUR_LAMPS + 300;
/** The homecoming: once the last lamp is lit the whole quay answers, and only
 * then is the end tab offered. Then the book closes itself. */
export const HOME_MS = 2300;
export const CLOSE_MS = 1100;

/* ── the book's state and turn permissions ────────────────────────────────── */
export interface BookState {
  spread: SpreadIndex;
  launched: boolean;
  river: RiverState;
  storm: StormState;
  harbour: HarbourState;
  /** The wheel's angle on each spread, kept as it was left. */
  wheel: readonly [number, number, number, number];
}
/** `variant` picks the river's course and which way the first gust blows, so
 * a second reading is not the first again. */
export function createBook(variant = 0): BookState {
  const v = Math.max(0, Math.trunc(finite(variant)));
  return { spread: 0, launched: false, river: createRiver(v), storm: createStorm(v % 2 ? -1 : 1), harbour: createHarbour(), wheel: [0, 0, 0, 0] };
}
/** Each spread's small action. A spread can be turned past only once it is done. */
export function spreadDone(book: BookState, spread: SpreadIndex): boolean {
  if (spread === 0) return book.launched;
  if (spread === 1) return riverDone(book.river);
  if (spread === 2) return book.storm.calmed;
  return book.harbour.docked && book.harbour.lamps >= HARBOUR_LAMPS;
}
/** Back is always there (after the first spread); Next only once the spread's action is done. */
export function canTurn(book: BookState, intent: TurnIntent): boolean {
  if (intent === 'back') return book.spread > 0;
  return book.spread < LAST_SPREAD && spreadDone(book, book.spread);
}
/** The book can finish only from the harbour, once the boat is moored and the lamps are lit. */
export function canFinish(book: BookState): boolean {
  return book.spread === LAST_SPREAD && spreadDone(book, LAST_SPREAD);
}
export function turned(book: BookState, intent: TurnIntent): BookState {
  if (!canTurn(book, intent)) return book;
  return { ...book, spread: (book.spread + (intent === 'next' ? 1 : -1)) as SpreadIndex };
}
export function setWheel(book: BookState, spread: SpreadIndex, angle: number): BookState {
  const wheel = [...book.wheel] as [number, number, number, number];
  wheel[spread] = clampWheel(angle);
  return { ...book, wheel };
}
