/** The live mammoth: one canvas, one animation frame loop, the camera, touch,
 * the fur's springs, the wind, the animal's breath, mood and idle life, and
 * the nine things the child does in the story (wipe the frost, say hello
 * through the glass, measure the tusk, brush the snow, offer grass, part the
 * fur, find the herd, walk with it, look up from a calf's height), then the
 * night's show. The React component owns the words, the HUD and the hall's
 * pictures; this owns everything that moves sixty times a second, writing
 * straight to the canvas so React never re-renders per frame. Everything
 * stops in `dispose()` and while the tab is hidden. */
import {
  PARTS, capOffset, chooseTier, generateStrands, mixCamera, pointInPolygon, springStep, strokeWeight, windStrength,
  type Bounds, type Camera, type DiscoveryId, type StrandSet, type Tier, type Vec,
} from './iceAgeFriendRules';
import { FLIP_X, bezierAt, mammothView, strokePoint, toyAt, type MammothView, type ViewId } from './mammothShape';
import {
  IDENTITY, MIST_SECONDS, PUFF_SECONDS, REST_POSE, apply, drawFrame, makeDynamics, makeFrostLayer, makeInks, partFrames, readPalette, trunkLine, trunkPoint,
  type Affine, type AnimalInput, type Bundle, type Dynamics, type Flake, type FrostLayer, type Glass, type Inks, type LegId, type Mist, type Mote, type Palette, type Pose, type Puff, type Sheaf, type ToolMarks,
} from './mammothRender';
import {
  FEED, GESTURE_SECONDS, GHOST, SNOW_GONE, arcPoint, brushSnow, feedAt, feedPose, finaleLift, gestureAt, ghostAt, ghostKnockAt, leanFor, lidFor, meetStep, moodLift, moodStep,
  rumbleFor, seedSnow, snowLeft, type GestureId, type SnowClump,
} from './mammothPlayRules';
import {
  FROST, HERD_FAR, HINT, SET_PIECE, STEPS, STEP_FACT, auroraAt, constellation, eyeHeight, fitShot, frostLeft, herdPlace, hintPlan, hourFor, makeFrost, meltFrost, patienceStep, scoutNear, scoutStep, secretStar,
  starsRisen, traceStep, walkStep, wipeFrost, type FrostGrid, type Round, type StepId,
} from './mammothStory';
import { drawSteppeBack, drawSteppeFront, groundPoint, lightAt, makeSteppe, nearness, type Ground, type HerdState, type SkyShow, type SteppeFrame, type Tones } from './steppeRender';
import { HALL, HALL_PICTURE, type FriendId } from './mammothArt';
import type { MammothSound } from './mammothAudio';

const SEED = 20261116;
const MOTE_CAP = 110;
const PHOTO = 240;

export type Scene = 'hall' | 'steppe';
export type Task = StepId | 'idle' | 'finale';
export type Cue = 'waiting' | 'lensReady' | 'calf' | 'thump' | 'call' | 'answer' | 'aurora' | 'star' | 'finaleReady' | 'throughHalf' | 'steppe';
export type FxKind = 'sparkle' | 'dust' | 'drop' | 'glint' | 'ring' | 'petal';
export interface EngineHooks {
  /** The first touch, key or button: a gesture, so sound may start. */
  onGesture(): void;
  /** A light tap of the phone's haptics. */
  onTick(): void;
  /** The child finished a step of the story. */
  onStep(step: StepId): void;
  /** A picture was taken: it is in `photo(id)`. */
  onShot(id: DiscoveryId): void;
  /** The frost is clear over the eye: it is looking back. */
  onEye(): void;
  /** The secret: tickled behind its small ear. */
  onSecret(): void;
  /** A beat of the story the HUD answers (a line, a shake, a note). */
  onCue(cue: Cue, index?: number): void;
  /** A burst of small things at a place on the stage (fractions 0..1). */
  onFx(kind: FxKind, x: number, y: number, count?: number): void;
  /** How much daylight the hall has (0 frosted over .. 1 clear). */
  onLight(level: number): void;
}
export interface EngineElements {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The hint hand. */
  ghost: HTMLElement | null;
  /** The ring that answers a touch where it lands. */
  ripple: HTMLElement | null;
}
export interface MammothEngine {
  /** Starts a step of the story (or rests between them). */
  task(task: Task): void;
  /** One helping of the step in play, for a key, a button or a child who is only watching. */
  step(): void;
  /** The arrow keys: the finder, the gauge, a look around. */
  nudge(dx: number, dy: number): void;
  /** The ProofLens's shutter. False until there is a picture to take. */
  snap(): boolean;
  /** Through the glass and out onto the steppe. */
  through(onEnd: () => void): void;
  /** A friend on the hall's floor was tapped: the mammoth notices. */
  greet(friend: FriendId): void;
  /** The HUD is busy (a print is up): no hint hand over it. */
  hold(busy: boolean): void;
  /** Development only: start at a later step. */
  jump(step: StepId): void;
  photo(id: DiscoveryId): HTMLCanvasElement | null;
  scene(): Scene;
  setReduced(reduced: boolean): void;
  tier(): Tier;
  dispose(): void;
}

function tierOverride(): Tier | null {
  try {
    const value = new URLSearchParams(globalThis.location?.search ?? '').get('mammothTier');
    return value === 'full' || value === 'light' ? value : null;
  } catch { return null; }
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const ease = (t: number) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The camera's shots on the steppe, as boxes of the side view (facing left); mirrored for the other way. */
const SHOTS = {
  whole: [30, 96, 940, 664], front: [30, 120, 690, 672], back: [286, 110, 900, 610],
  feedTall: [-150, 150, 560, 716], feedWide: [-230, 80, 940, 716], part: [468, 296, 742, 512],
  scoutTall: [-1080, -240, 520, 716], scoutWide: [-1500, -200, 1000, 716], walkTall: [-60, 30, 800, 700], walkWide: [-230, 30, 1130, 700],
  low: [150, -60, 760, 672], finaleTall: [-60, -560, 1000, 690], finaleWide: [-420, -380, 1380, 690],
} as const satisfies Record<string, readonly [number, number, number, number]>;
type ShotId = keyof typeof SHOTS;
/** The tufts the child can pluck, on the snow in front of the mammoth (side view, world units; y below the feet is nearer to us). */
const TUFT_SPOTS: readonly Vec[] = [[168, 664], [20, 676], [-112, 660]];

export function createMammothEngine(el: EngineElements, hooks: EngineHooks, sound: MammothSound | null, options: { reduced: boolean; round: Round; faceRight?: boolean; rtl?: boolean; random?: () => number }): MammothEngine {
  const ctx = el.canvas.getContext('2d', { alpha: true });
  const scratchCanvas = document.createElement('canvas');
  const random = options.random ?? Math.random;
  const round = options.round, steppe = makeSteppe(round);
  let reduced = options.reduced;
  let disposed = false;
  let palette: Palette | null = null, inks: Inks | null = null;
  const viewId: ViewId = options.faceRight ? 'turned' : 'side';
  const view: MammothView = mammothView(viewId);
  const face = view.mirror ? 1 : -1;                 // the way it looks along x
  const flip = (x: number) => (view.mirror ? FLIP_X - x : x);
  const forced = tierOverride();
  let tier: Tier = forced ?? 'full';
  const sets = new Map<string, StrandSet>();
  const strandsFor = (id: ViewId, t: Tier): StrandSet => {
    const key = `${id}:${t}`;
    let set = sets.get(key);
    if (!set) { const v = mammothView(id); set = generateStrands(v.regions, t, SEED, { mirror: v.mirror, bounds: v.furBounds }); sets.set(key, set); }
    return set;
  };
  const rangeOf = (set: StrandSet, part: typeof PARTS[number]): [number, number] => { const found = set.parts.find(p => p.part === part); return found ? [found.start, found.end] : [0, 0]; };
  const buildGrid = (set: StrandSet): Map<number, number[]> => {
    const map = new Map<number, number[]>(), trunk = set.parts.find(p => p.part === 'trunk');
    for (let i = 0; i < set.count; i++) {
      if (trunk && i >= trunk.start && i < trunk.end) continue;
      const key = (Math.floor(set.rx[i] / 32) + 500) * 4096 + (Math.floor(set.ry[i] / 32) + 500);
      const list = map.get(key); if (list) list.push(i); else map.set(key, [i]);
    }
    return map;
  };
  let strands: StrandSet = strandsFor(viewId, tier);
  let dyn: Dynamics = makeDynamics(strands.count);
  let grid = buildGrid(strands);
  let trunkRange: [number, number] = rangeOf(strands, 'trunk');
  // The calf: the same animal drawn small, with the lighter coat. It runs in facing its mother, then turns about to stand beside her.
  const towardId: ViewId = viewId === 'side' ? 'turned' : 'side';
  const calfViews = { toward: mammothView(towardId), beside: view };
  let calfCoats: Record<'toward' | 'beside', { strands: StrandSet; dyn: Dynamics }> | null = null;

  /* ── layout ── */
  let width = 1, height = 1, dpr = 1, baseScale = 1, tall = false;
  let scene: Scene = 'hall';
  let camera: Camera = { x: 500, y: 400, zoom: 1 };
  let glide: { from: Camera; to: Camera; start: number; ms: number } | null = null;
  let place: Affine = IDENTITY;                      // the mammoth's place in the world (it steps sideways in the hall)
  let hallShift = 0, hallShiftGoal = 0, tuskShift = 0;
  /** The part of the glass that matters: round the eye, about as wide as the middle pane (a fraction of the frosted box). Clearing it is clearing the frost. */
  let face0 = 0.3;
  let panes: Vec[][] = [];
  const glass: Glass = { panes: null, box: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, bloom: 0, frost: null };
  let time = 0, last = 0, frame = 0;
  const samples: number[] = [];
  let sampling = !forced;
  let pose: Pose = { ...REST_POSE, step: { ...REST_POSE.step } };
  let calfPose: Pose = { ...REST_POSE, step: { ...REST_POSE.step } };

  /* ── the story so far ── */
  let task: Task = 'idle', taskSince = 0;
  let busy = false;
  let lastInput = 0;
  const ghostShown: Partial<Record<Task, number>> = {}, learned: Partial<Record<Task, boolean>> = {};
  let ghostRun: { start: number; at: Vec } | null = null;
  // frost
  let frost: FrostGrid = makeFrost(), frostLayer: FrostLayer | null = null, melting = false, eyeSeen = false, frostGone = false, lastLight = -1, wipeSound = 0;
  // hello
  let trust = 0, helloAt = -1;
  // trace
  let traced = 0, traceDone = -1, traceNote = 0;
  // through
  let passing: { start: number; onEnd: () => void; swapped: boolean } | null = null;
  // care
  let snow: SnowClump[] = seedSnow(view.snow.length, round.cover, random), snowCleared = false, brushDone = -1;
  const tufts: { at: Vec; grown: number; shaken: number }[] = TUFT_SPOTS.map(([x, y]) => ({ at: [flip(x), y] as Vec, grown: 1, shaken: -9 }));
  let carry: { tuft: number; at: Vec; goal: Vec | null; held: boolean; lastMove: number } | null = null, ring = 0, waitingSaid = false;
  let feeding: { start: number; from: Vec; crunched: number; shot: boolean } | null = null, fed = false;
  let lens: { at: Vec; r: number } | null = null, lensReady = 0, lensLatched = false, lensCheck = 0;
  // walk
  let finder: { x: number; y: number; goal: number | null } | null = null, lock = 0, herdFound = false, herdShow = 0, pingAt = 0;
  let herdStart = 0, walked = 0, walking = 0, walkPhase = 0, scroll = 0, lastFoot = 0, walkDone = false;
  let calf: { start: number; arrived: boolean } | null = null;
  let low = 0, lowHeld = -1, lowDone = false;
  // the night's show
  let finale: { start: number; called: boolean; answered: number; aurora: boolean; stars: number; ready: boolean } | null = null;
  let streak: { x: number; y: number; start: number } | null = null;
  let secret = false;
  let hour = hourFor('frost'), hourGoal = hour;
  // the animal's own life
  let gesture: { id: GestureId; start: number } | null = null;
  let mood = 0, strokeHeat = 0, lean: Vec = [0, 0], squeeze = 0, wide = 0;
  let reach: { lift: number; swing: number; until: number } | null = null, reachLift = 0, reachSwing = 0;
  const stomps: { leg: LegId; start: number }[] = [];
  let gust = 0, stepping = -1, rumbleUntil = 0;
  let nextBlink = 2.5, blinkAt = -1, nextFlick = 5, flickAt = -1, nextSwish = 3, swishAt = -1, lastBreath = 0;
  const puffs: Puff[] = [], motes: Mote[] = [], mists: Mist[] = [];
  let flakes: Flake[] = Array.from({ length: round.flakes }, () => ({ x: Math.random(), y: Math.random(), r: 0.9 + Math.random() * Math.random() * 2.6, speed: 0.025 + Math.random() * 0.05, drift: Math.random() * Math.PI * 2 }));
  let lastAudio = 0, lastTick = 0, flash = 0, frameMs = 16;
  const photos = new Map<DiscoveryId, HTMLCanvasElement>();
  const standIns: DiscoveryId[] = [];
  const shots: { id: DiscoveryId; at: number; centre: () => Vec; size: () => number; then?: () => void }[] = [];

  const S = () => baseScale * camera.zoom;
  const toWorld = (sx: number, sy: number): Vec => [camera.x + (sx - width / 2) / S(), camera.y + (sy - height / 2) / S()];
  const toScreen = (w: Vec): Vec => [(w[0] - camera.x) * S() + width / 2, (w[1] - camera.y) * S() + height / 2];
  const toAnimal = (w: Vec): Vec => [(w[0] - place[4]) / place[0], (w[1] - place[5]) / place[3]];
  const fromAnimal = (a: Vec): Vec => apply(place, a);
  const fraction = (w: Vec): Vec => { const [x, y] = toScreen(w); return [x / width, y / height]; };
  const fx = (kind: FxKind, w: Vec, count?: number) => { const [x, y] = fraction(w); hooks.onFx(kind, x, y, count); };
  // A phone on its side has its HUD in the corners: the middle of the picture is free from top to bottom.
  const safe = () => ({ top: height < 480 ? 30 : 96, bottom: height < 480 ? 22 : 100, side: 12 });
  const shotBox = (id: ShotId): Bounds => { const [x0, y0, x1, y1] = SHOTS[id]; return view.mirror ? { minX: FLIP_X - x1, minY: y0, maxX: FLIP_X - x0, maxY: y1 } : { minX: x0, minY: y0, maxX: x1, maxY: y1 }; };
  const shot = (id: ShotId, room = safe()): Camera => { const fit = fitShot(shotBox(id), { w: width, h: height }, room); return { x: fit.x, y: fit.y, zoom: fit.zoom / baseScale }; };
  /** The night's show keeps the snow at the foot of the frame free for the caption, the crew and the way out: the giant stands above them. */
  const finaleRoom = () => ({ top: Math.max(30, height * 0.1), bottom: height < 480 ? Math.max(64, height * 0.24) : Math.max(150, height * (tall ? 0.3 : 0.27)), side: 12 });
  const shotFor = (t: Task): Camera => {
    switch (t) {
      case 'brush': return shot(tall ? 'back' : 'whole');
      case 'feed': return shot(tall ? 'feedTall' : 'feedWide');
      case 'part': return shot('part');
      case 'scout': return shot(tall ? 'scoutTall' : 'scoutWide');
      case 'walk': return shot(tall ? 'walkTall' : 'walkWide');
      case 'low': return shot(tall ? 'walkTall' : 'walkWide');
      case 'finale': return shot(tall ? 'finaleTall' : 'finaleWide', finaleRoom());
      default: return shot(tall ? 'front' : 'whole');
    }
  };
  const glideTo = (to: Camera, ms = 900) => {
    if (reduced) { glide = null; camera = { ...to }; return; }
    glide = { from: { ...camera }, to: { ...to }, start: performance.now(), ms };
  };

  /* ── size: where the hall's picture sits, and how big the giant is behind its glass ── */
  const hallCamera = (): { cam: Camera; scale: number; k: number; offX: number; offY: number } => {
    const P = HALL.pane, W = HALL_PICTURE.width, H = HALL_PICTURE.height;
    const cover = Math.max(width / W, height / H), paneW = (P.x1 - P.x0), paneH = (P.y1 - P.y0), trio = HALL.trio.x1 - HALL.trio.x0;
    // Tall: the middle pane nearly fills the width. Wide: the three panes of the bay take most of it.
    const k = Math.max(cover, tall ? Math.min((0.86 * width) / paneW, (0.6 * height) / paneH) : Math.min((0.76 * width) / trio, (0.7 * height) / paneH));
    const imgW = W * k, imgH = H * k;
    const offX = clamp(width / 2 - ((P.x0 + P.x1) / 2) * k, width - imgW, 0), offY = clamp(height * (tall ? 0.445 : 0.475) - ((P.y0 + P.y1) / 2) * k, height - imgH, 0);
    // The giant stands so near that it is taller than the pane: its eye a third of the way down it.
    const scale = (paneH * k) / 392, eyeX = offX + ((P.x0 + P.x1) / 2 + face * 0.11 * paneW) * k, eyeY = offY + (P.y0 + 0.33 * paneH) * k;
    return { cam: { x: view.eye[0] - (eyeX - width / 2) / scale, y: view.eye[1] - (eyeY - height / 2) / scale, zoom: 1 }, scale, k, offX, offY };
  };
  const resize = () => {
    width = Math.max(1, el.stage.clientWidth); height = Math.max(1, el.stage.clientHeight);
    tall = height > width * 1.05;
    dpr = Math.min(tier === 'light' ? 1.5 : 2, globalThis.devicePixelRatio || 1);
    el.canvas.width = Math.round(width * dpr); el.canvas.height = Math.round(height * dpr);
    scratchCanvas.width = el.canvas.width; scratchCanvas.height = el.canvas.height;
    const hall = hallCamera(), style = el.stage.style;
    style.setProperty('--iaf-img-x', `${hall.offX.toFixed(1)}px`); style.setProperty('--iaf-img-y', `${hall.offY.toFixed(1)}px`);
    style.setProperty('--iaf-img-w', `${(HALL_PICTURE.width * hall.k).toFixed(1)}px`); style.setProperty('--iaf-img-h', `${(HALL_PICTURE.height * hall.k).toFixed(1)}px`);
    style.setProperty('--iaf-tall', `${((view.furBounds.maxY - view.furBounds.minY) * hall.scale).toFixed(1)}px`);
    style.setProperty('--iaf-sill', `${(hall.offY + HALL.pane.y1 * hall.k).toFixed(1)}px`);
    if (scene === 'hall') {
      baseScale = hall.scale; camera = hall.cam; glide = null;
      // The wall of glass, in the world.
      panes = HALL.panes.map(pane => pane.map(([fx0, fy0]) => toWorld(hall.offX + fx0 * HALL_PICTURE.width * hall.k, hall.offY + fy0 * HALL_PICTURE.height * hall.k)));
      const path = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pane of panes) {
        pane.forEach(([x, y], i) => { if (i) path.lineTo(x, y); else path.moveTo(x, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
        path.closePath();
      }
      // Only what the stage shows needs frost.
      const [vx0, vy0] = toWorld(0, 0), [vx1, vy1] = toWorld(width, height);
      const edge = 24 / S();
      glass.panes = path; glass.box = { minX: Math.max(minX - edge, vx0), minY: Math.max(minY - edge, vy0), maxX: Math.min(maxX + edge, vx1), maxY: Math.min(maxY + edge * 2, vy1) };
      // For the tusk to be measured it must stand clear in the middle pane.
      const P = HALL.pane, mid = toWorld(hall.offX + ((P.x0 + P.x1) / 2) * hall.k, 0)[0], t = tuskBox();
      tuskShift = mid - (t.minX + t.maxX) / 2;
      face0 = (0.55 * ((P.x1 - P.x0) * hall.k / S())) / Math.max(1, glass.box.maxX - glass.box.minX);
      if (palette && !frostGone) buildFrost();
    } else {
      const whole = fitShot(shotBox('whole'), { w: width, h: height }, safe());
      baseScale = whole.zoom; glide = null; camera = lowCamera();
    }
  };
  const tuskBox = (): Bounds => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of view.tusks.near) for (let i = 0; i <= 10; i++) { const [x, y] = bezierAt(b, i / 10); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    return { minX, minY, maxX, maxY };
  };
  /** The camera for the step in play; the ViewCheck lowers it toward the calf's view. */
  const lowCamera = (): Camera => (task === 'low' ? mixCamera(shotFor('walk'), shot('low'), low) : shotFor(task));
  const buildFrost = () => {
    if (!palette) return;
    const b = glass.box, w = (b.maxX - b.minX) * S(), h = (b.maxY - b.minY) * S(), k = Math.min(1, 900 / Math.max(w, h, 1)) * Math.min(1.5, dpr);
    frostLayer = makeFrostLayer(w * k, h * k, round.frost, palette);
    if (!frostLayer) return;
    // After a turn of the phone, the patches already wiped are wiped again from what the game remembers.
    for (let row = 0; row < frost.rows; row++) for (let col = 0; col < frost.cols; col++) {
      const left = frost.cells[row * frost.cols + col];
      if (left < 0.5) frostLayer.wipe((col + 0.5) / frost.cols, (row + 0.5) / frost.rows, 1.4 / frost.cols);
    }
    frostLayer.settle(); glass.frost = frostLayer.canvas;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(el.stage);
  resize();
  el.stage.dataset.scene = scene;

  /* ── fur: stroking and springs ── */
  const wake = (i: number) => { if (!dyn.active[i]) { dyn.active[i] = 1; dyn.live.push(i); } };
  /** Stroke at a point of the animal's own space. */
  const strokeAt = (ax: number, ay: number, dx: number, dy: number, pat: boolean, power = 1, reachR = 0) => {
    const R = reachR || clamp(34 / (S() * place[0]), 9, 70);
    const visit = (i: number, x: number, y: number) => {
      const d = Math.hypot(x - ax, y - ay), k = strokeWeight(d, R);
      if (!k) return;
      let ox: number, oy: number;
      // A pat parts the hair outward from the hand; long hair is thrown further than short.
      if (pat) { const m = d || 1, push = Math.max(7, strands.len[i] * 0.5) * k * power; ox = dyn.ox[i] + ((x - ax) / m) * push; oy = dyn.oy[i] + ((y - ay) / m) * push - 2 * k; }
      else { ox = dyn.ox[i] + dx * k * 1.9 * power; oy = dyn.oy[i] + dy * k * 1.9 * power; }
      [ox, oy] = capOffset(ox, oy, strands.len[i]);
      dyn.ox[i] = ox; dyn.oy[i] = oy; dyn.vx[i] = 0; dyn.vy[i] = 0; wake(i);
    };
    const c0x = Math.floor((ax - R) / 32), c1x = Math.floor((ax + R) / 32), c0y = Math.floor((ay - R) / 32), c1y = Math.floor((ay + R) / 32);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const list = grid.get((cx + 500) * 4096 + (cy + 500));
      if (list) for (const i of list) visit(i, strands.rx[i], strands.ry[i]);
    }
    for (let i = trunkRange[0]; i < trunkRange[1]; i++) visit(i, dyn.wx[i], dyn.wy[i]);
  };
  /** A shiver through the whole coat: every hair is thrown a little and springs back. */
  const shakeCoat = (amount: number) => {
    for (let i = 0; i < strands.count; i++) {
      const len = strands.len[i], a = strands.phase[i];
      dyn.ox[i] = Math.cos(a * 3) * len * 0.32 * amount; dyn.oy[i] = -Math.abs(Math.sin(a * 2)) * len * 0.2 * amount;
      dyn.vx[i] = Math.sin(a) * 60 * amount; dyn.vy[i] = 0; wake(i);
    }
  };
  const inLens = (i: number) => !!lens && Math.hypot(strands.rx[i] - lens.at[0], strands.ry[i] - lens.at[1]) < lens.r;
  const stepSprings = (dt: number) => {
    if (!dyn.live.length) return;
    const keep: number[] = [];
    for (const i of dyn.live) {
      // Once the picture is there to take, the parted hair stays parted until the shutter.
      if (lensLatched && inLens(i)) { keep.push(i); continue; }
      const [ox, vx] = springStep(dyn.ox[i], dyn.vx[i], dt), [oy, vy] = springStep(dyn.oy[i], dyn.vy[i], dt);
      if (Math.abs(ox) + Math.abs(oy) < 0.04 && Math.abs(vx) + Math.abs(vy) < 0.04) { dyn.ox[i] = 0; dyn.oy[i] = 0; dyn.vx[i] = 0; dyn.vy[i] = 0; dyn.active[i] = 0; continue; }
      dyn.ox[i] = ox; dyn.vx[i] = vx; dyn.oy[i] = oy; dyn.vy[i] = vy; keep.push(i);
    }
    dyn.live = keep;
  };
  /** How much of the long hair under the lens is parted (0..1). */
  const partedShare = (): number => {
    if (!lens) return 0;
    let all = 0, parted = 0;
    const R = lens.r, c0x = Math.floor((lens.at[0] - R) / 32), c1x = Math.floor((lens.at[0] + R) / 32), c0y = Math.floor((lens.at[1] - R) / 32), c1y = Math.floor((lens.at[1] + R) / 32);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const list = grid.get((cx + 500) * 4096 + (cy + 500)); if (!list) continue;
      for (const i of list) {
        if (!strands.cls[i] || !inLens(i)) continue;
        all++; if (Math.hypot(dyn.ox[i], dyn.oy[i]) > strands.len[i] * 0.3) parted++;
      }
    }
    return all ? parted / all : 0;
  };

  /* ── small things in the air ── */
  const tick = () => { const now = performance.now(); if (now - lastTick > 110) { lastTick = now; hooks.onTick(); } };
  /** Every touch is answered at the place touched, at once: a ring that opens and fades. */
  const ripple = (w: Vec) => {
    const node = el.ripple; if (!node || typeof node.animate !== 'function') return;
    const [x, y] = toScreen(w), at = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    for (const running of node.getAnimations?.() ?? []) running.cancel();
    node.animate(reduced ? [{ transform: `${at} scale(1)`, opacity: 0.9 }, { transform: `${at} scale(1)`, opacity: 0 }] : [{ transform: `${at} scale(.45)`, opacity: 1 }, { transform: `${at} scale(1.5)`, opacity: 0 }], { duration: 400, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  };
  const mist = (w: Vec, r = 44) => { mists.push({ x: w[0], y: w[1], r: r / S(), born: time }); if (mists.length > 12) mists.shift(); };
  /** Loose snow thrown from a world point; it falls to the snow at the animal's feet and melts away. */
  const scatter = (w: Vec, count: number, spread: number, up: number) => {
    if (reduced) return;
    const floor = fromAnimal([0, view.groundY])[1] + 6;
    for (let i = 0; i < count && motes.length < MOTE_CAP; i++) {
      const a = random() * Math.PI * 2, v = (0.3 + random() * 0.7) * spread;
      motes.push({ x: w[0] + Math.cos(a) * 6, y: w[1] + Math.sin(a) * 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - up * (0.5 + random() * 0.5), r: (1.4 + random() * 2.6) * place[0], born: time, life: 1.3 + random() * 1.1, floor: floor + random() * 16 });
    }
  };
  const stepMotes = (dt: number) => {
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      if (time - m.born >= m.life) { motes.splice(i, 1); continue; }
      if (m.y >= m.floor) { m.vx *= 0.8; continue; }
      m.vy += 520 * dt; m.x += m.vx * dt; m.y = Math.min(m.floor, m.y + m.vy * dt);
    }
  };
  const play = (id: GestureId) => { gesture = { id, start: time }; };
  const footWorld = (leg: LegId): Vec => { const f = view.feet[leg]; return fromAnimal([(f.x0 + f.x1) / 2, f.y]); };
  /** A heavy foot comes down: the floor answers. */
  const stomp = (leg: LegId, loud = true) => {
    stomps.push({ leg, start: time });
    if (loud) { sound?.thump(); hooks.onCue('thump'); }
    if (scene === 'steppe') { scatter(footWorld(leg), 7, 120, 70); fx('dust', footWorld(leg), 5); }
  };

  /* ── the trunk reaches for a point ── */
  const reachScratch = trunkLine(view, REST_POSE);
  const reachFor = (target: Vec, seconds: number) => {
    const a = toAnimal(target);
    let best = Infinity, lift = 0, swing = 0;
    const trial: Pose = { ...REST_POSE, step: REST_POSE.step };
    for (let l = 0; l <= 1.001; l += 0.125) for (let s = -0.7; s <= 0.701; s += 0.175) {
      trial.lift = l; trial.swing = s;
      const [x, y] = trunkPoint(trunkLine(view, trial, reachScratch), 1, 0, view.mirror);
      const d = Math.hypot(x - a[0], y - a[1]);
      if (d < best) { best = d; lift = l; swing = s; }
    }
    reach = { lift, swing, until: time + seconds };
  };
  const tipAnimal = (): Vec => {
    const frames = partFrames(view, pose), line = trunkLine(view, pose);
    const [x, y] = trunkPoint(line, 1, 0, view.mirror);
    return apply(frames.head, [x, y]);
  };
  const tipWorld = (): Vec => fromAnimal(tipAnimal());
  const eyeWorld = (): Vec => fromAnimal(apply(partFrames(view, pose).head, view.eye));
  const breathe = (big = 1) => { const tip = tipWorld(); puffs.push({ x: tip[0], y: tip[1] - 6, born: time, big }); if (scene === 'hall') mist([tip[0] + face * 20, tip[1] - 10], 46 * big); };

  /* ── pictures ── */
  /** The ProofLens records the actual view: the picture is cut from what the stage shows at that moment. */
  const takeShot = (id: DiscoveryId, centre: Vec, size: number, quiet = false) => {
    let target = photos.get(id);
    if (!target) { target = document.createElement('canvas'); target.width = PHOTO; target.height = PHOTO; photos.set(id, target); }
    const g = target.getContext('2d'); if (!g || !palette) return;
    const [sx, sy] = centre, side = clamp(size, 60, Math.min(width, height));
    const x0 = clamp(sx - side / 2, 0, width - side), y0 = clamp(sy - side / 2, 0, height - side);
    g.setTransform(1, 0, 0, 1, 0, 0);
    try { g.drawImage(el.canvas, x0 * dpr, y0 * dpr, side * dpr, side * dpr, 0, 0, PHOTO, PHOTO); } catch { /* nothing to copy yet */ }
    if (!quiet) { flash = 1; sound?.shutter(); hooks.onTick(); }
  };
  const queueShot = (id: DiscoveryId, delay: number, centre: () => Vec, size: () => number, then?: () => void) => { shots.push({ id, at: time + (reduced ? 0.05 : delay), centre, size, then }); };

  /* ── chapter one: the frost, the hello, the tusk ── */
  const glassUV = (w: Vec): Vec => { const b = glass.box; return [(w[0] - b.minX) / (b.maxX - b.minX), (w[1] - b.minY) / (b.maxY - b.minY)]; };
  const glassAspect = () => { const b = glass.box; return (b.maxX - b.minX) / Math.max(1, b.maxY - b.minY); };
  const insidePanes = (w: Vec) => panes.some(pane => pointInPolygon(w[0], w[1], pane));
  const wipe = (w: Vec, big: number, quiet = false) => {
    // A hand's width of glass at a time: a little more on a big screen. A helping (a key, the hint) clears a good part of the face.
    const [u, v] = glassUV(w), r = Math.max(clamp(Math.max(40, width * 0.042) * big / S(), 10, 400) / (glass.box.maxX - glass.box.minX), big > 2 ? face0 * 0.62 : 0);
    const shed = wipeFrost(frost, u, v, r, glassAspect());
    frostLayer?.wipe(u, v, r * 1.12);
    if (shed > 0.02 && !quiet) {
      if (time - wipeSound > 0.09) { wipeSound = time; sound?.rustle(0.55); if (random() < 0.3) sound?.glass(); tick(); }
      if (random() < 0.35 && Math.hypot(w[0] - eyeWorld()[0], w[1] - eyeWorld()[1]) > 60) fx('glint', w, 1);
      if (random() < 0.12) fx('drop', [w[0], w[1] + 14 / S()], 1);
    }
    return shed;
  };
  const seeEye = () => {
    if (eyeSeen) return;
    eyeSeen = true; el.stage.dataset.eye = 'seen'; blinkAt = time; wide = 1; flickAt = time; rumbleUntil = time + 1.8; sound?.snort();
    breathe(1.5); hooks.onEye(); hooks.onTick();
  };
  const stepFrost = (dt: number) => {
    if (frostGone) return;
    const [u, v] = glassUV(eyeWorld());
    if (!eyeSeen && frostLeft(frost, { u, v, r: 0.07, aspect: glassAspect() }) < FROST.eyeAt) seeEye();
    const left = frostLeft(frost, { u, v: v + 0.06, r: face0, aspect: glassAspect() });
    if (!melting && left < FROST.meltAt) { melting = true; seeEye(); sound?.chime(); }
    if (melting) {
      const after = meltFrost(frost, dt); frostLayer?.melt(Math.min(1, dt / 0.6));
      if (after <= 0.001) {
        frostGone = true; glass.frost = null; frostLayer = null;
        fx('sparkle', [(glass.box.minX + glass.box.maxX) / 2, (glass.box.minY + glass.box.maxY) / 2], 14);
        if (task === 'frost') finish('frost');
      }
    }
    frostLayer?.settle();
    const light = 1 - left;
    if (Math.abs(light - lastLight) > 0.02) { lastLight = light; hooks.onLight(light); }
  };
  const knockGlass = (w: Vec, counts: boolean) => {
    ripple(w); mist(w, 34); sound?.glass(); tick();
    reachFor(w, 1.6); flickAt = time;
    if (counts && task === 'hello') { learned.hello = true; trust = meetStep(trust, true, 0); greetIfFriends(w); }
  };
  const greetIfFriends = (w: Vec) => {
    if (trust < 1 || helloAt >= 0) return;
    // The trunk's tip comes to the hand on the glass, and one warm breath blooms there.
    helloAt = time; reachFor(w, 2.4); mood = moodLift(mood, 0.3); sound?.snort(); sound?.hello(false);
    mist(w, 70); fx('ring', w); fx('sparkle', w, 8); hooks.onTick();
  };
  /** The nearest point of the near tusk to a point of the animal's space: how far along it (0 root .. 1 tip) and how far off. */
  const onTusk = (a: Vec): { along: number; distance: number; at: Vec } => {
    let best = Infinity, along = 0, at: Vec = [0, 0];
    const chain = view.tusks.near, n = chain.length;
    chain.forEach((b, j) => { for (let i = 0; i <= 20; i++) { const p = bezierAt(b, i / 20), d = Math.hypot(p[0] - a[0], p[1] - a[1]); if (d < best) { best = d; along = (j + i / 20) / n; at = p; } } });
    return { along, distance: best, at };
  };
  const tuskPoint = (k: number): Vec => { const chain = view.tusks.near, f = clamp(k, 0, 0.9999) * chain.length, j = Math.floor(f); return bezierAt(chain[j], f - j); };
  const trace = (a: Vec, reachK = 1) => {
    if (traceDone >= 0) return;
    const hit = onTusk(a), before = traced;
    traced = traceStep(traced, hit.along, hit.distance, 46 * reachK + 26 / S());
    if (traced > before) {
      learned.trace = true;
      const note = Math.floor(traced * 8);
      if (note > traceNote) { traceNote = note; sound?.found(Math.min(4, Math.floor(note / 2))); tick(); fx('sparkle', fromAnimal(hit.at), 3); }
      if (traced >= 0.985) finishTrace();
    }
  };
  const finishTrace = () => {
    traced = 1; traceDone = time; play('tusks'); sound?.knock(); hooks.onTick();
    for (let i = 0; i <= 6; i++) fx('glint', fromAnimal(tuskPoint(i / 6)), 2);
    const box = tuskBox();
    queueShot('tusks', 0.9, () => toScreen(fromAnimal([(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2])), () => Math.max(box.maxX - box.minX, box.maxY - box.minY) * S() * 1.3, () => finish('trace'));
  };

  /* ── chapter two: the snow, the grass, the two coats ── */
  /** Brushes the snow off the back near a point of the animal's space. */
  const brush = (a: Vec, strength: number) => {
    if (snowCleared) return;
    const frames = partFrames(view, pose);
    for (const clump of snow) {
      if (clump.amount <= 0) continue;
      const spot = view.snow[clump.spot], at = apply(spot.part === 'head' ? frames.head : frames.body, spot.at);
      const d = Math.hypot(at[0] - a[0], at[1] - a[1]), reachR = spot.r * 1.9 + 22 / (S() * place[0]);
      if (d > reachR) continue;
      const result = brushSnow(clump.amount, strength * (1 - d / reachR));
      if (result.shed < 0.02) continue;
      clump.amount = result.amount; learned.brush = true;
      scatter(fromAnimal([spot.at[0], spot.at[1] - 4]), Math.ceil(result.shed * 9), 90, 50);
      if (result.amount <= SNOW_GONE) { sound?.chime(); tick(); fx('sparkle', fromAnimal(spot.at), 4); }
    }
    if (!snowCleared && snowLeft(snow) <= 0) {
      snowCleared = true; brushDone = time; sound?.found(1); shakeCoat(0.6); play('hump'); mood = moodLift(mood, 0.25); hooks.onTick();
      fx('sparkle', fromAnimal(view.hotspots.hump), 12);
    }
  };
  const offerSpot = (): Vec => { const tip = fromAnimal(apply(partFrames(view, REST_POSE).head, (() => { const [x, y] = trunkPoint(trunkLine(view, REST_POSE, reachScratch), 1, 0, view.mirror); return [x, y] as Vec; })())); return [tip[0] + face * 96, tip[1] - 92]; };
  const inReach = (w: Vec) => { const base = fromAnimal(view.trunkBase); return Math.hypot(w[0] - base[0], w[1] - base[1]) < 330 && (w[0] - base[0]) * face > -70; };
  const grab = (index: number, at: Vec, held: boolean) => {
    const tuft = tufts[index];
    tuft.grown = 0; tuft.shaken = time; carry = { tuft: index, at, goal: null, held, lastMove: time }; ring = 0; learned.feed = true;
    sound?.rustle(0.9); hooks.onTick(); fx('petal', tuft.at, 4);
  };
  const dropBack = () => {
    if (!carry) return;
    tufts[carry.tuft].grown = 1; tufts[carry.tuft].shaken = time; carry = null; ring = 0; sound?.rustle(0.4);
  };
  const stepFeed = (dt: number) => {
    for (const tuft of tufts) tuft.grown = Math.min(1, tuft.grown + (carry || feeding ? 0 : dt / 5));
    if (!carry || feeding) return;
    if (carry.goal) {
      const dx = carry.goal[0] - carry.at[0], dy = carry.goal[1] - carry.at[1], d = Math.hypot(dx, dy), go = Math.min(d, 900 * dt);
      if (d < 1) carry.goal = null; else { carry.at = [carry.at[0] + (dx / d) * go, carry.at[1] + (dy / d) * go]; carry.lastMove = time; }
    }
    const near = inReach(carry.at), still = near && time - carry.lastMove > 0.16;
    if (near) reachFor([carry.at[0], carry.at[1] + 18], 0.5);
    ring = near ? patienceStep(ring, still, dt) : 0;
    if (near && still && !waitingSaid) { waitingSaid = true; hooks.onCue('waiting'); }
    if (ring >= 1) {
      // It takes the grass with the two tips of its trunk.
      feeding = { start: time, from: carry.at, crunched: 0, shot: false };
      carry = null; ring = 0; fed = true; sound?.found(2); hooks.onTick(); mood = moodLift(mood, 0.2);
      queueShot('trunk', FEED.fly + 0.14, () => { const [x, y] = toScreen(tipWorld()); return [x, y - 26 * S()]; }, () => 150 * S());
    }
  };
  /** How much of the long hair under the lens must be parted before the two coats can be told apart. */
  const PARTED = 0.26;
  const stepLens = () => {
    if (task !== 'part' || !lens || time - lensCheck < 0.12) return;
    lensCheck = time;
    const share = partedShare();
    lensReady = lensLatched ? 1 : clamp(share / PARTED, 0, 1);
    if (!lensLatched && share >= PARTED) { lensLatched = true; lensReady = 1; sound?.chime(); hooks.onCue('lensReady'); hooks.onTick(); }
  };

  /* ── chapter three: the herd, the walk, the calf's view ── */
  const ground = (): Ground => ({ width, height, feetY: toScreen(fromAnimal([0, view.groundY]))[1], horizonY: toScreen([0, view.groundY - eyeHeight(scene === 'hall' ? 0 : low)])[1], unit: S(), originX: toScreen([0, 0])[0], scroll });
  const centreX = (view.furBounds.minX + view.furBounds.maxX) / 2;
  const herdEnd = () => face * 620;
  const herdNow = () => herdPlace(walked, herdStart, herdEnd());
  const herdScreen = (): Vec => { const g = ground(), h = herdNow(); return groundPoint(g, centreX + h.offset - g.scroll, h.depth); };
  const beginScout = () => {
    // The herd stands far out on the side the mammoth faces; the finder starts in the middle.
    const g = ground(), u = face < 0 ? 1 - round.herdU : round.herdU, k = nearness(HERD_FAR);
    herdStart = (u * width - width / 2) / (g.unit * k) - (g.originX - width / 2) / g.unit - centreX;
    finder = { x: width / 2, y: g.horizonY - Math.min(width, height) * 0.04, goal: null }; lock = 0;
  };
  const finderRadius = () => clamp(Math.min(width, height) * 0.15, 50, 96);
  const stepScout = (dt: number) => {
    if (task !== 'scout' || !finder || herdFound) return;
    if (finder.goal !== null) { const d = finder.goal - finder.x; if (Math.abs(d) < 2) finder.goal = null; else finder.x += Math.sign(d) * Math.min(Math.abs(d), width * 1.4 * dt); }
    finder.y = ground().horizonY - finderRadius() * 0.42;
    const hu = herdScreen()[0] / width, fu = finder.x / width;
    // The lock only closes on a finder someone has moved there, once the camera has settled on the wide view.
    lock = glide || !learned.scout ? 0 : scoutStep(lock, fu, hu, dt);
    // The nearer the finder, the quicker the ping.
    const nearK = scoutNear(fu, hu), gap = 1.1 - 0.9 * nearK;
    if (time - pingAt > gap && learned.scout) { pingAt = time; sound?.found(Math.round(nearK * 4)); }
    if (lock >= 1) {
      herdFound = true; herdShow = 1; finder.x = hu * width; sound?.hello(true); hooks.onTick();
      fx('ring', toWorld(finder.x, finder.y)); fx('sparkle', toWorld(finder.x, finder.y), 8);
      const at = { x: finder.x, y: finder.y }, r = finderRadius();
      queueShot('herd', 0.5, () => [at.x, at.y + r * 0.3], () => r * 1.25, () => { finder = null; finish('scout'); });
    }
  };
  const stepWalk = (dt: number) => {
    if (task !== 'walk' || walkDone) { walking = Math.max(0, walking - dt); return; }
    const going = holding() || walking > 0;
    walking = Math.max(0, walking - dt);
    if (going) {
      const before = walked;
      walked = walkStep(walked, true, dt); learned.walk = true;
      scroll += -face * 420 * (walked - before) * 6.5;
      // A giant's walk is slow: a footfall about twice a second, and the ground feels every other one.
      walkPhase += dt * 0.95;
      const beat = Math.floor(walkPhase * 2);
      if (beat !== lastFoot) { lastFoot = beat; const leg: LegId = beat % 2 ? 'legFront' : 'legHind'; sound?.thump(); if (beat % 2) hooks.onCue('thump'); scatter(footWorld(leg), 6, 110, 60); fx('dust', footWorld(leg), 4); tick(); }
      hourGoal = hourFor('walk', walked);
      if (walked >= 1) { walkDone = true; calf = { start: time, arrived: false }; hooks.onCue('calf'); sound?.trumpet(true, 0.1); ensureCalf(); }
    }
  };
  const ensureCalf = () => {
    if (calfCoats) return;
    const coat = (id: ViewId) => { const strands = strandsFor(id, 'light'); return { strands, dyn: makeDynamics(strands.count) }; };
    calfCoats = { toward: coat(towardId), beside: coat(viewId) };
  };
  const CALF = { scale: 0.4, seconds: 3.1, run: 0.7 };
  /** Where the calf is: it runs out from the herd to its mother's trunk, turns about, and tucks in beside her front legs, facing the way she faces. */
  const calfPlace = (): { place: Affine; k: number; facing: 'toward' | 'beside'; turn: number } | null => {
    if (!calf) return null;
    const k = reduced ? 1 : clamp((time - calf.start) / CALF.seconds, 0, 1), sx = CALF.scale * 0.96, sy = CALF.scale * 1.06;
    const nose = (v: MammothView) => (v.mirror ? v.furBounds.maxX - 20 : v.furBounds.minX + 20), middle = (v: MammothView) => (v.furBounds.minX + v.furBounds.maxX) / 2;
    // Each resting place as the world x of the calf's middle: nose to the trunk while it faces her, nose under her chin once it stands beside her.
    const meet = flip(236) - sx * nose(calfViews.toward) + sx * middle(calfViews.toward), tucked = flip(322) - sx * nose(calfViews.beside) + sx * middle(calfViews.beside);
    const run = ease(Math.min(1, k / CALF.run)), m = clamp((k - CALF.run) / (1 - CALF.run), 0, 1), facing = m < 0.5 ? 'toward' : 'beside';
    const x = lerp(meet, tucked, ease(m)) + face * 1500 * (1 - run), hop = k < CALF.run ? Math.abs(Math.sin(k * Math.PI * 9)) * 20 * (1 - run * 0.5) : 0;
    const v = calfViews[facing];
    return { place: [sx, 0, 0, sy, x - sx * middle(v), view.groundY + 12 + 14 * ease(m) - sy * v.groundY - hop], k, facing, turn: m <= 0 || m >= 1 ? 1 : Math.max(0.08, Math.abs(Math.cos(Math.PI * m))) };
  };
  const stepLow = (dt: number) => {
    if (task !== 'low' || lowDone) return;
    if (low >= 0.97) {
      if (lowHeld < 0) { lowHeld = time; sound?.chime(); }
      if (time - lowHeld > 0.4) {
        lowDone = true; low = 1; hooks.onTick();
        queueShot('hump', 0.1, () => toScreen(fromAnimal([view.hotspots.hump[0] - face * 60, 330])), () => 470 * S(), () => finish('low'));
      }
    } else lowHeld = -1;
    void dt;
  };

  /* ── the night's show ── */
  const skyShow = (): SkyShow | null => {
    if (!finale) return null;
    const t = time - finale.start, g = ground(), top = Math.max(height * 0.085, 30) + height * 0.04, bottom = Math.max(top + height * 0.16, g.horizonY - height * 0.16);
    const x0 = width * 0.12, x1 = width * 0.88, risen = starsRisen(t), from = toScreen(fromAnimal(view.hotspots.hump));
    const hang = (p: Vec, k: number): Vec => { const to: Vec = [lerp(x0, x1, p[0]), lerp(top, bottom, p[1])], e = ease(k); return [lerp(from[0], to[0], e), lerp(from[1] - 20, to[1], e) - Math.sin(Math.PI * e) * height * 0.05]; };
    const ids: DiscoveryId[] = ['tusks', 'trunk', 'coats', 'herd', 'hump'];
    const pictures: SkyShow['pictures'][number][] = constellation(round.starShape).map((p, i) => ({ at: hang(p, clamp(risen - i, 0, 1)), risen: clamp(risen - i, 0, 1), image: photos.get(ids[i]) ?? null }));
    if (secret) pictures.push({ at: hang(secretStar(round.starShape), clamp(risen - 5, 0, 1)), risen: clamp(risen - 5, 0, 1), image: null, small: true });
    return { aurora: auroraAt(t), pictures, streak: streak ? { x: streak.x, y: streak.y, k: (time - streak.start) / 0.9 } : null };
  };
  const stepFinale = () => {
    if (!finale) return;
    const t = time - finale.start;
    if (!finale.called && t > SET_PIECE.call) { finale.called = true; sound?.trumpet(); rumbleUntil = time + 2.4; gust = 1; shakeCoat(0.8); breathe(2); hooks.onCue('call'); hooks.onTick(); }
    while (finale.answered < SET_PIECE.answers.length && t > SET_PIECE.answers[finale.answered]) {
      sound?.trumpet(true); hooks.onCue('answer', finale.answered);
      const [hx, hy] = herdScreen(); hooks.onFx('ring', clamp((hx + (finale.answered - 1) * width * 0.08) / width, 0.04, 0.96), (hy - 30) / height);
      finale.answered++;
    }
    if (!finale.aurora && t > SET_PIECE.auroraCue) { finale.aurora = true; hooks.onCue('aurora'); }
    const risen = Math.floor(starsRisen(t, secret ? 6 : 5) + 0.02);
    while (finale.stars < risen) { hooks.onCue('star', finale.stars); finale.stars++; }
    if (!finale.ready && t > SET_PIECE.hold) { finale.ready = true; hooks.onCue('finaleReady'); }
    if (streak && time - streak.start > 0.9) streak = null;
  };

  /* ── a step is done; the next begins ── */
  const finish = (step: StepId) => { if (task !== step) return; task = 'idle'; taskSince = time; ghostRun = null; showGhost(null, 0, 0); hooks.onStep(step); };
  const begin = (next: Task) => {
    task = next; taskSince = time; lastInput = time; ghostRun = null; carry = null; ring = 0;
    el.stage.dataset.task = next;
    hourGoal = next === 'finale' ? 3 : next === 'idle' ? hourGoal : hourFor(next, next === 'walk' ? walked : 0);
    if (scene === 'steppe') {
      if (next === 'part') { lens = { at: view.hotspots.coats, r: 84 }; lensReady = 0; lensLatched = false; }
      else lens = null;
      if (next !== 'idle') glideTo(next === 'low' ? lowCamera() : shotFor(next), next === 'part' ? 1100 : 1300);
      if (next === 'scout') { const settle = shotFor('scout'), keep = camera; camera = settle; beginScout(); camera = keep; }
      if (next === 'finale') { finale = { start: time, called: false, answered: 0, aurora: false, stars: 0, ready: false }; herdShow = 1; ensureCalf(); if (!calf) calf = { start: time - CALF.seconds - 1, arrived: true }; walked = 1; }
    } else if (next === 'trace') { hallShiftGoal = tuskShift; stepping = 0; }
  };

  /* ── pointers ── */
  type Mode = 'wipe' | 'glass' | 'trace' | 'stroke' | 'air' | 'tuft' | 'finder' | 'walk' | 'gauge';
  const pointers = new Map<number, { x: number; y: number; mode: Mode; moved: number; t: number; fresh: boolean }>();
  const holding = () => { for (const p of pointers.values()) if (p.mode === 'walk') return true; return false; };
  const local = (e: PointerEvent): Vec => { const r = el.stage.getBoundingClientRect(); return [(e.clientX - r.left) * (width / (r.width || 1)), (e.clientY - r.top) * (height / (r.height || 1))]; };
  const isControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button, [data-iaf-print]');
  const noted = () => { lastInput = time; ghostRun = null; hooks.onGesture(); };
  const tuftAt = (x: number, y: number): number => { let best = -1, near = 62; tufts.forEach((tuft, i) => { if (tuft.grown < 0.6) return; const [tx, ty] = toScreen(tuft.at), d = Math.hypot(tx - x, ty - 18 - y); if (d < near) { near = d; best = i; } }); return best; };
  const onAnimalAt = (a: Vec) => !!toyAt(view, a[0], a[1], tipAnimal(), pointInPolygon);
  const modeAt = (x: number, y: number): Mode => {
    if (scene === 'hall') return task === 'frost' || !frostGone ? 'wipe' : task === 'trace' ? 'trace' : 'glass';
    if (task === 'feed' && !feeding && !fed) { if (carry || tuftAt(x, y) >= 0) return 'tuft'; }
    if (task === 'scout' && !herdFound) return 'finder';
    if (task === 'walk' && !walkDone) return 'walk';
    if (task === 'low' && !lowDone) return 'gauge';
    return onAnimalAt(toAnimal(toWorld(x, y))) ? 'stroke' : 'air';
  };
  const down = (e: PointerEvent) => {
    if (isControl(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    noted();
    const [x, y] = local(e), mode = modeAt(x, y), w = toWorld(x, y);
    const record = { x, y, mode, moved: 0, t: performance.now(), fresh: false };
    pointers.set(e.pointerId, record);
    try { el.stage.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    if (mode === 'wipe') { learned.frost = true; wipe(w, 1); ripple(w); }
    if (mode === 'trace') trace(toAnimal(w));
    if (mode === 'tuft' && !carry) { const index = tuftAt(x, y); if (index >= 0) { grab(index, w, true); record.fresh = true; } }
    else if (mode === 'tuft' && carry) { const [bx, by] = toScreen(carry.at); carry.held = Math.hypot(bx - x, by - y) < 76; if (carry.held) carry.goal = null; }
    if (mode === 'finder' && finder) { learned.scout = true; finder.goal = null; }
    if (mode === 'walk') { ripple(w); }
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const [x, y] = local(e), dx = x - p.x, dy = y - p.y, now = performance.now(), dist = Math.hypot(dx, dy), w = toWorld(x, y);
    lastInput = time; p.moved += dist;
    if (p.mode === 'wipe') {
      const steps = Math.max(1, Math.ceil(dist / 12));
      for (let i = 1; i <= steps; i++) wipe(toWorld(p.x + (dx * i) / steps, p.y + (dy * i) / steps), 1);
    } else if (p.mode === 'glass') {
      // A hand stroking the glass: the trunk follows it, breath blooms where it passes, and trust grows.
      if (p.moved > 10 && now - p.t > 90) { mist(w, 30); reachFor(w, 1.2); p.t = now; sound?.rustle(0.25); }
      if (task === 'hello' && p.moved > 10) { learned.hello = true; trust = meetStep(trust, false, dist / 320); greetIfFriends(w); }
    } else if (p.mode === 'trace') {
      const steps = Math.max(1, Math.ceil(dist / 10));
      for (let i = 1; i <= steps; i++) trace(toAnimal(toWorld(p.x + (dx * i) / steps, p.y + (dy * i) / steps)));
    } else if (p.mode === 'tuft' && carry) {
      if (carry.held) { carry.at = w; if (dist > 1.5) carry.lastMove = time; }
    } else if (p.mode === 'finder' && finder) {
      finder.x = clamp(finder.x + dx, finderRadius() * 0.5, width - finderRadius() * 0.5);
    } else if (p.mode === 'gauge') {
      low = clamp(low + dy / Math.max(120, height * 0.36), 0, 1); learned.low = true;
      if (!glide) camera = lowCamera();
    } else if (p.mode === 'air') {
      // A swipe through the air is a breath of wind in the coat and the grass.
      if (dist > 2) gust = Math.min(1, gust + dist / 260);
    } else if (p.mode === 'stroke') {
      // Long fast swipes are stroked in short steps, so the trail has no gaps.
      const steps = Math.max(1, Math.ceil(dist / 14)), k = S() * place[0], power = task === 'part' ? 1.7 : 1;
      let a: Vec = [0, 0];
      for (let i = 1; i <= steps; i++) {
        a = toAnimal(toWorld(p.x + (dx * i) / steps, p.y + (dy * i) / steps));
        strokeAt(a[0], a[1], dx / steps / k, dy / steps / k, false, power);
      }
      const speed = Math.min(1, dist / Math.max(8, now - p.t) / 1.2);
      sound?.rustle(speed);
      strokeHeat = Math.min(1, strokeHeat + 0.25 + speed * 0.5);
      const centre: Vec = [centreX, (view.furBounds.minY + view.furBounds.maxY) / 2];
      lean = leanFor(mood, a[0] - centre[0], a[1] - centre[1]);
      brush(a, 0.5 + 0.5 * speed);
      if (p.moved > 24) { learned.part = true; if (task !== 'brush') learned.brush = true; }
      if (p.moved > 40) tick();
      // Near the edge of a phone, the view follows the hand along the animal.
      if (tall && task === 'brush' && !glide) {
        const edge = x < width * 0.16 ? -1 : x > width * 0.84 ? 1 : 0;
        if (edge) camera = { ...camera, x: clamp(camera.x + (edge * 5) / S(), view.bounds.minX + 150, view.bounds.maxX - 150) };
      }
      p.t = now;
    }
    p.x = x; p.y = y;
  };
  const up = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    pointers.delete(e.pointerId);
    const tapped = p.moved < 8 && e.type === 'pointerup';
    if (p.mode === 'tuft' && carry) {
      const wasHeld = carry.held, w = toWorld(p.x, p.y);
      carry.held = false;
      // A tap picks a bunch (it waits above its tuft); the next tap offers it. Dragged, it stays held out
      // where it is let go within the trunk's reach, and goes back to its tuft from anywhere else.
      if (tapped && p.fresh) carry.goal = [tufts[carry.tuft].at[0], tufts[carry.tuft].at[1] - 96];
      else if (tapped) carry.goal = inReach(w) ? w : offerSpot();
      else if (wasHeld && !inReach(carry.at)) dropBack();
      return;
    }
    if (p.mode === 'walk' && tapped) walking = Math.max(walking, 0.9);
    if (p.mode === 'finder' && tapped && finder) finder.goal = p.x;
    if (tapped && (p.mode === 'glass' || p.mode === 'stroke' || p.mode === 'air' || p.mode === 'trace' || p.mode === 'gauge')) tap(p.x, p.y, p.mode);
    if (tapped && p.mode === 'wipe') wipe(toWorld(p.x, p.y), 1.5);
  };
  const tap = (sx: number, sy: number, mode: Mode) => {
    const w = toWorld(sx, sy);
    if (scene === 'hall') {
      if (mode === 'trace') { trace(toAnimal(w), 1.6); ripple(w); return; }
      if (insidePanes(w)) knockGlass(w, true); else { ripple(w); sound?.chime(); }
      return;
    }
    if (mode === 'gauge') { low = clamp(low + 0.26, 0, 1); learned.low = true; if (!glide) camera = lowCamera(); ripple(w); sound?.chime(); return; }
    ripple(w);
    if (finale && sy < ground().horizonY - 10 && !onAnimalAt(toAnimal(w))) { streak = { x: sx / width, y: sy / Math.max(1, ground().horizonY), start: time }; sound?.chime(); tick(); return; }
    // The ProofLens: a tap inside its ready frame is the shutter.
    if (task === 'part' && lens && lensLatched) { const a = toAnimal(w); if (Math.hypot(a[0] - lens.at[0], a[1] - lens.at[1]) < lens.r) { snapLens(); return; } }
    const a = toAnimal(w), hit = toyAt(view, a[0], a[1], tipAnimal(), pointInPolygon);
    if (!hit) { sound?.chime(); gust = Math.min(1, gust + 0.4); tick(); return; }
    tick();
    switch (hit.toy) {
      case 'trunkTip': play('trunkBoop'); puffs.push({ x: w[0], y: w[1] - 8, born: time }); sound?.snort(); mood = moodLift(mood, 0.1); break;
      case 'tuskNear': play('tuskKnock'); sound?.knock(); fx('glint', w, 3); break;
      case 'earSpot':
        play('tickle'); sound?.snort(); mood = moodLift(mood, 0.18); strokeAt(a[0], a[1], 0, 0, true);
        if (!secret) { secret = true; play('ears'); sound?.found(4); fx('sparkle', w, 10); hooks.onSecret(); }
        break;
      case 'tailTip': play('tailSwish'); sound?.rustle(0.8); strokeAt(a[0], a[1], 0, 0, true); break;
      case 'footNear': stomp(hit.leg ?? 'legFront'); break;
      case 'coat': strokeAt(a[0], a[1], 0, 0, true, task === 'part' ? 2.4 : 1); sound?.rustle(0.5); mood = moodLift(mood, 0.07); brush(a, 0.7); learned.part = true; break;
    }
  };
  const snapLens = (): boolean => {
    if (task !== 'part' || !lens || !lensLatched) return false;
    const at = lens.at, r = lens.r;
    queueShot('coats', 0, () => toScreen(fromAnimal(at)), () => r * 2.05 * S(), () => { lens = null; lensLatched = false; finish('part'); });
    lensLatched = true;
    return true;
  };
  el.stage.addEventListener('pointerdown', down);
  el.stage.addEventListener('pointermove', move);
  el.stage.addEventListener('pointerup', up);
  el.stage.addEventListener('pointercancel', up);

  /* ── one helping of the step in play: a key, a button, or a child who is only watching ── */
  let helpIndex = 0;
  const help = () => {
    switch (task) {
      case 'frost': {
        // The first patch is over the eye; the rest work outward from it.
        const eye = eyeWorld(), b = glass.box, wide = (b.maxX - b.minX) * face0, spots: Vec[] = [[0, 0], [-0.6, 0.3], [0.6, -0.1], [0.1, 0.8], [-0.5, -0.5], [0.7, 0.7], [-0.2, 1.3], [0.6, -0.7], [-0.8, 1]];
        const [ox, oy] = spots[helpIndex++ % spots.length], w: Vec = [clamp(eye[0] + ox * wide, b.minX + 10, b.maxX - 10), clamp(eye[1] + oy * wide, b.minY + 10, b.maxY - 10)];
        learned.frost = true; wipe(w, 2.6); ripple(w); break;
      }
      case 'hello': { const tip = tipWorld(); knockGlass([tip[0] + face * 56, tip[1] - 150], true); break; }
      case 'trace': if (traceDone < 0) { traced = Math.min(1, traced + 0.21); learned.trace = true; sound?.found(Math.min(4, Math.floor(traced * 4))); fx('sparkle', fromAnimal(tuskPoint(traced)), 4); if (traced >= 0.985) finishTrace(); } break;
      case 'brush': comb(); break;
      case 'feed':
        if (feeding || fed) break;
        if (!carry) { const index = tufts.findIndex(tuft => tuft.grown >= 0.6); if (index >= 0) { grab(index, [tufts[index].at[0], tufts[index].at[1] - 30], false); carry!.goal = offerSpot(); } }
        else carry.goal = offerSpot();
        break;
      case 'part':
        if (lensLatched) snapLens();
        else if (lens) {
          // A parting each time, a little further round: two or three of them open the coat.
          const turn = helpIndex++ * 2.1;
          for (const [d, a] of [[0, 0], [0.5, turn], [0.5, turn + Math.PI]] as const) strokeAt(lens.at[0] + Math.cos(a) * lens.r * d, lens.at[1] + Math.sin(a) * lens.r * d * 0.8, 0, 0, true, 3.4, lens.r * 0.62);
          learned.part = true; sound?.rustle(0.7); hooks.onTick();
        }
        break;
      case 'scout': if (finder && !herdFound) { learned.scout = true; const goal = herdScreen()[0]; finder.goal = finder.x + clamp(goal - finder.x, -width * 0.16, width * 0.16); } break;
      case 'walk': if (!walkDone) walking = Math.max(walking, 1.2); break;
      case 'low': if (!lowDone) { low = clamp(low + 0.34, 0, 1); learned.low = true; if (!glide) camera = lowCamera(); sound?.chime(); } break;
      default: break;
    }
  };
  /** One long stroke along the back, from the hump toward the tail. */
  const comb = () => {
    const steps = 26, body = partFrames(view, pose).body;
    for (let k = 0; k < steps; k++) {
      const a = strokePoint(view, k / steps), b = strokePoint(view, (k + 1) / steps);
      strokeAt(a[0], a[1], (b[0] - a[0]) * 1.2, (b[1] - a[1]) * 1.2 + 1, false); strokeAt(a[0], a[1] + 40, (b[0] - a[0]) * 1.2, 2, false);
      brush(apply(body, [a[0], a[1] - 26]), 0.9);
    }
    // The crown too: the snow on its head.
    for (const spot of view.snow) if (spot.part === 'head') brush(apply(partFrames(view, pose).head, spot.at), 0.9);
    const mid = strokePoint(view, 0.5);
    strokeHeat = 1; mood = moodLift(mood, 0.12); lean = leanFor(mood, mid[0] - centreX, -40); learned.brush = true;
    sound?.rustle(0.7); hooks.onTick();
  };

  /* ── the hint hand: it shows the gesture on the real thing, and never takes a touch ── */
  const showGhost = (screen: Vec | null, press: number, alpha: number) => {
    const node = el.ghost; if (!node) return;
    if (!screen || alpha <= 0.01) { node.style.opacity = '0'; return; }
    node.style.opacity = alpha.toFixed(2);
    node.style.transform = `translate(${screen[0].toFixed(1)}px, ${screen[1].toFixed(1)}px) scale(${(1 - 0.1 * press).toFixed(3)})`;
  };
  const fadeIO = (t: number) => Math.min(ease(t / 0.12), 1 - ease((t - 0.86) / 0.14));
  /** Where the hand is at t (0..1) of its lesson for the step in play: a screen point and how hard it presses. */
  const ghostPath = (t: number): { at: Vec; press: number } | null => {
    const k = ease((t - 0.14) / 0.68), pressed = t > 0.12 && t < 0.84 ? 1 : 0;
    switch (task) {
      case 'frost': { const b = glass.box, eye = eyeWorld(), sweep = Math.sin(k * Math.PI * 3) * 0.13 * (b.maxX - b.minX); return { at: toScreen([eye[0] + sweep, eye[1] + (0.02 + 0.1 * k) * (b.maxY - b.minY)]), press: pressed }; }
      case 'hello': { const tip = tipWorld(), at = ghostKnockAt(t); return { at: toScreen([tip[0] + face * 56, tip[1] - 150]), press: at.press }; }
      case 'trace': return { at: toScreen(fromAnimal(tuskPoint(Math.min(0.999, traced + 0.3 * k)))), press: pressed };
      case 'brush': { const at = ghostAt(t), a = strokePoint(view, at.u); return { at: toScreen(fromAnimal(apply(partFrames(view, pose).body, a))), press: at.press }; }
      case 'feed': { if (feeding || fed) return null; const from = tufts[0].at, to = offerSpot(); return { at: toScreen(carry ? to : [lerp(from[0], to[0], k), lerp(from[1] - 20, to[1], k)]), press: pressed }; }
      case 'part': { if (!lens || lensLatched) return null; const c = fromAnimal(lens.at); return { at: toScreen([c[0] + Math.sin(k * Math.PI * 2) * lens.r * 0.5, c[1] + (k - 0.5) * lens.r * 0.5]), press: pressed }; }
      case 'scout': { if (!finder || herdFound) return null; return { at: [finder.x + Math.sin(k * Math.PI * 2) * width * 0.14, finder.y + finderRadius() * 0.5], press: pressed }; }
      case 'walk': { if (walkDone) return null; const g = ground(); return { at: [width / 2 + face * width * 0.22, Math.min(height - safe().bottom - 20, g.feetY + (height - g.feetY) * 0.45)], press: pressed * (0.6 + 0.4 * Math.sin(t * 20)) }; }
      case 'low': { if (lowDone) return null; const gauge = gaugeAt(); return { at: [gauge.x - 4, lerp(gauge.top, gauge.bottom, Math.max(low, k))], press: pressed }; }
      default: return null;
    }
  };
  const stepGhost = () => {
    const calm = !busy && !pointers.size && !glide && !passing && task !== 'idle' && task !== 'finale' && time - taskSince > 0.6 && stepping < 0;
    if (!ghostRun) {
      if (!calm) { showGhost(null, 0, 0); return; }
      const shown = ghostShown[task] ?? 0, plan = hintPlan(time - lastInput, shown, !!learned[task]);
      if (plan === 'wait') { showGhost(null, 0, 0); return; }
      // A child who is only watching is helped along: the game never waits on them.
      if (plan === 'help') { help(); lastInput = time - HINT.again * 0.55; ghostShown[task] = shown + 1; return; }
      if (!ghostPath(0)) return;
      ghostRun = { start: time, at: [0, 0] }; ghostShown[task] = shown + 1;
    }
    const t = (time - ghostRun.start) / GHOST.seconds, path = ghostPath(reduced ? 0.5 : t);
    if (t >= 1 || !calm || !path) { ghostRun = null; lastInput = time; showGhost(null, 0, 0); return; }
    showGhost(path.at, path.press, reduced ? (t < 0.9 ? 1 : 0) : fadeIO(t));
  };
  const gaugeAt = () => { const s = safe(), x = options.rtl ? 36 : width - 36; return { x, top: s.top + 34, bottom: Math.max(s.top + 150, height - s.bottom - 34) }; };

  /* ── the loop ── */
  const updatePose = (dt: number) => {
    const m = view.mirror ? -1 : 1;
    const next: Pose = { ...REST_POSE, step: { legFront: 0, legHind: 0, legFarFront: 0, legFarHind: 0 } };
    let blink = 0;
    // The slow breath: in, and a long way out; the cloud of it leaves the trunk as the breath turns.
    const cycle = (time * 0.21) % 1, breath = reduced ? 0.4 : cycle < 0.42 ? ease(cycle / 0.42) : 1 - ease((cycle - 0.42) / 0.58);
    next.breath = breath;
    if (!reduced) {
      const turn = Math.floor(time * 0.21 - 0.44);
      if (turn !== lastBreath && !finale?.called && !feeding) { lastBreath = turn; breathe(1.15); }
      next.swayX = Math.sin(time * 0.42) * 2.6; next.swayY = Math.sin(time * 1.05) * 0.5;
      next.nod = Math.sin(time * 0.5 + 1) * 0.012;
      next.swing = Math.sin(time * 0.6) * 0.12 + Math.sin(time * 1.37) * 0.04;
      if (time > nextFlick) { flickAt = time; nextFlick = time + 5 + Math.random() * 5; }
      if (time > nextSwish) { swishAt = time; nextSwish = time + 4 + Math.random() * 6; }
      if (swishAt >= 0) { const f = (time - swishAt) / 1.4; if (f >= 1) swishAt = -1; else next.tail = 0.16 * Math.sin(Math.PI * 2 * f) * (1 - f); }
    }
    if (flickAt >= 0) { const f = (time - flickAt) / 0.5; if (f >= 1) flickAt = -1; else if (!reduced) next.ear = -0.2 * Math.sin(Math.PI * f) * (1 - 0.4 * Math.sin(Math.PI * 2 * f)); }
    if (time > nextBlink) { blinkAt = time; nextBlink = time + 2.6 + Math.random() * 3.6; }
    if (blinkAt >= 0) { const f = (time - blinkAt) / 0.18; if (f >= 1) blinkAt = -1; else blink = reduced ? 1 : Math.sin(Math.PI * f); }

    // Mood: stroked, it settles; it leans into the hand, its eye closes, it rumbles.
    const touching = strokeHeat > 0.05;
    mood = moodStep(mood, strokeHeat, dt);
    strokeHeat = Math.max(0, strokeHeat - dt * 1.6);
    if (!touching) lean = [lean[0] * Math.max(0, 1 - dt * 2.4), lean[1] * Math.max(0, 1 - dt * 2.4)];
    next.swayX += lean[0] * m; next.swayY += lean[1];
    wide = Math.max(0, wide - dt * 0.5);
    next.brow = -0.5 * mood + 0.9 * wide;

    // The trunk reaches for a hand on the glass, or for the grass held out to it.
    const want = reach && time < reach.until ? reach : null;
    if (!want) reach = null;
    const follow = Math.min(1, dt * (carry ? 1.6 + 3 * ring : 5));
    reachLift += ((want?.lift ?? 0) - reachLift) * follow; reachSwing += ((want?.swing ?? 0) - reachSwing) * follow;
    if (Math.abs(reachLift) + Math.abs(reachSwing) > 0.003) { next.lift = Math.max(next.lift, reachLift); next.swing += reachSwing; }

    // Walking, and the sideways steps in the hall: diagonal pairs of feet, the body rocking over them.
    const stride = task === 'walk' && !walkDone && (holding() || walking > 0) ? walkPhase : stepping >= 0 ? stepping * 1.05 : -1;
    if (stride >= 0 && !reduced) {
      const beat = Math.sin(stride * Math.PI * 2);
      next.step.legFront = next.step.legFarHind = Math.max(0, beat) * 13; next.step.legHind = next.step.legFarFront = Math.max(0, -beat) * 13;
      next.swayY -= Math.abs(beat) * 3; next.nod += beat * 0.022; next.swing += beat * 0.1;
    }
    for (let i = stomps.length - 1; i >= 0; i--) {
      const k = (time - stomps[i].start) / 0.34;
      if (k >= 1) { stomps.splice(i, 1); continue; }
      next.step[stomps[i].leg] = Math.max(next.step[stomps[i].leg], 15 * Math.sin(Math.PI * k) * (reduced ? 0 : 1));
    }
    if (gesture) {
      const t = time - gesture.start;
      if (t >= GESTURE_SECONDS[gesture.id]) gesture = null;
      else {
        const d = gestureAt(gesture.id, reduced ? GESTURE_SECONDS[gesture.id] * 0.4 : t);
        next.nod += d.nod; next.ear += d.ear; next.swayY -= d.rise; next.swing += d.swing; next.curl += d.curl; next.tail += d.tail; next.brow += d.brow;
        squeeze = d.squeeze;
      }
    }
    if (!gesture) squeeze = 0;
    if (feeding) {
      const t = time - feeding.start, at = feedAt(t);
      if (!at) {
        feeding = null; mood = moodLift(mood, 0.2);
        if (task === 'feed') { hooks.onShot('trunk'); finish('feed'); }
      } else {
        const fp = feedPose(t);
        next.curl += fp.curl; next.jaw = Math.max(next.jaw, fp.jaw); next.lift = Math.max(next.lift, fp.reach * 0.16); next.swing *= 1 - Math.max(fp.curl, fp.reach * 0.6);
        if (at.phase === 'chew') { const beatNo = Math.floor(at.k * 5); if (beatNo > feeding.crunched) { feeding.crunched = beatNo; sound?.crunch(); } next.nod += 0.012 * Math.sin(at.k * Math.PI * 10); }
      }
    }
    // The calf is here: the trunk goes down to it.
    if (calf && !finale?.called) { const c = calfPlace(); if (c && c.k >= 0.5 && task !== 'low') { const k = ease((c.k - 0.5) / 0.3); next.swing += 0.2 * k; next.curl += 0.1 * k; next.nod += 0.03 * k; } }
    if (finale) {
      const lift = finaleLift(time - finale.start - SET_PIECE.call + 0.62, reduced);
      next.lift = Math.max(next.lift, lift); next.swing *= 1 - lift; next.jaw = Math.max(next.jaw, lift * 0.85); next.nod -= 0.05 * lift; next.brow += 0.6 * lift;
    }
    next.lid = lidFor(mood * (finale ? 0.3 : 1), blink, squeeze) * (1 - 0.7 * wide);
    pose = next;

    // The calf's own small life: quicker breath, a bobbing head, a trunk that will not keep still.
    if (calf) {
      const c: Pose = { ...REST_POSE, step: { legFront: 0, legHind: 0, legFarFront: 0, legFarHind: 0 } }, at = calfPlace(), k = at?.k ?? 1;
      c.turn = at?.turn ?? 1;
      c.breath = reduced ? 0.4 : 0.5 + 0.5 * Math.sin(time * 2.2);
      if (!reduced) {
        c.nod = Math.sin(time * 1.3) * 0.03; c.swing = Math.sin(time * 1.9) * 0.3; c.ear = -0.14 * Math.max(0, Math.sin(time * 2.6)); c.tail = Math.sin(time * 3.1) * 0.2;
        if (k < CALF.run) { const beat = Math.sin(time * 15); c.step.legFront = c.step.legFarHind = Math.max(0, beat) * 22; c.step.legHind = c.step.legFarFront = Math.max(0, -beat) * 22; }
      }
      c.lift = 0.5 * ease((k - 0.5) / 0.2) * (1 - 0.5 * ease((k - 0.9) / 0.1)) + (finale ? 0.4 * finaleLift(time - finale.start - SET_PIECE.answers[0] + 0.5, reduced) : 0);
      c.lid = blink > 0.5 ? 1 : 0.1; c.brow = 0.6;
      calfPose = c;
      if (!calf.arrived && k >= 1) { calf.arrived = true; sound?.snort(); mood = moodLift(mood, 0.3); fx('sparkle', tipWorld(), 8); hooks.onTick(); if (task === 'walk') finish('walk'); }
    }
    while (puffs.length && time - puffs[0].born > PUFF_SECONDS) puffs.shift();
    while (mists.length && time - mists[0].born > MIST_SECONDS) mists.shift();
  };
  const stepHall = (dt: number) => {
    // The sideways step that brings the tusk to the middle pane.
    if (Math.abs(hallShiftGoal - hallShift) > 0.5) {
      const before = hallShift;
      hallShift += clamp(hallShiftGoal - hallShift, -150 * dt, 150 * dt);
      if (reduced) hallShift = hallShiftGoal;
      stepping = Math.max(0, stepping) + dt;
      const beat = Math.floor(stepping * 2.1);
      if (beat !== lastFoot && !reduced) { lastFoot = beat; sound?.thump(); hooks.onCue('thump'); }
      if (Math.abs(hallShiftGoal - hallShift) <= 0.5 && before !== hallShift) { stepping = -1; lastInput = time; }
    } else if (stepping >= 0) stepping = -1;
    place = [1, 0, 0, 1, hallShift, 0];
    stepFrost(dt);
    if (task === 'hello' && helloAt >= 0 && time - helloAt > 1.3) finish('hello');
    if (passing) {
      const t = time - passing.start, k = clamp(t / 1.1, 0, 1);
      glass.bloom = !passing.swapped ? ease(k) : Math.max(0, 1 - ease((t - 1.1) / 1.5));
      if (!passing.swapped && k >= 1) {
        passing.swapped = true; scene = 'steppe'; el.stage.dataset.scene = scene; place = IDENTITY; hallShift = 0; hallShiftGoal = 0; stepping = -1;
        // The first sight of the steppe is the whole giant in it; the step that follows moves in.
        resize(); camera = shot('whole'); mists.length = 0; hooks.onCue('throughHalf');
      }
    }
  };
  const stepThrough = () => {
    if (!passing || !passing.swapped) return;
    const t = time - passing.start;
    glass.bloom = Math.max(0, 1 - ease((t - 1.1) / 1.5));
    if (t > 2.4) { const done = passing.onEnd; passing = null; glass.bloom = 0; hooks.onCue('steppe'); done(); }
  };
  const stepFlakes = (dt: number, wind: number) => {
    for (const f of flakes) {
      f.y += f.speed * dt * (0.6 + f.r * 0.25);
      f.x += (wind * 0.035 + Math.sin(time * 0.8 + f.drift) * 0.006) * dt;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      if (f.x > 1.02) f.x -= 1.04;
      if (f.x < -0.02) f.x += 1.04;
    }
  };
  const loop = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(loop);
    if (!palette) { palette = readPalette(el.stage); inks = makeInks(palette); if (scene === 'hall' && !frostGone) buildFrost(); }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    if (sampling && last) {
      samples.push(now - last);
      if (samples.length >= 70) { sampling = false; const chosen = chooseTier(samples.slice(10), tier); if (chosen !== tier) switchTier(chosen); }
    }
    if (last) frameMs += (Math.min(200, now - last) - frameMs) * 0.08;
    last = now; time += dt;
    if (glide) {
      const t = (now - glide.start) / glide.ms;
      camera = mixCamera(glide.from, glide.to, t);
      if (t >= 1) glide = null;
    }
    hour += clamp(hourGoal - hour, -dt * (finale ? 0.55 : 0.4), dt * (finale ? 0.55 : 0.4));
    // Seen from low down, the giant stands up into the sky: it is drawn taller from its feet, as a low eye sees it.
    if (scene === 'steppe') { const tower = 0.17 * ease(low), wider = 0.04 * ease(low); place = [1 + wider, 0, 0, 1 + tower, -wider * centreX, -tower * view.groundY]; }
    updatePose(dt);
    if (scene === 'hall') stepHall(dt);
    else {
      stepThrough();
      if (task === 'brush' && brushDone >= 0 && time - brushDone > 1.3) finish('brush');
      stepFeed(dt); stepLens(); stepScout(dt); stepWalk(dt); stepLow(dt); stepFinale();
      // Once the herd is found it never sinks back into the haze.
      if (herdFound) herdShow = Math.min(1, herdShow + dt);
    }
    stepGhost();
    stepSprings(dt);
    stepMotes(dt);
    gust = Math.max(0, gust - dt * 0.7);
    flash = Math.max(0, flash - dt * 3.2);
    const outdoors = clamp(windStrength(time) + round.wind, 0, 1);
    const wind = reduced ? 0 : Math.min(1, outdoors + gust * 0.8);
    if (!reduced) stepFlakes(dt, outdoors + gust);
    if (now - lastAudio > 150) {
      lastAudio = now;
      sound?.wind(reduced ? 0.2 : Math.min(1, outdoors * (scene === 'hall' ? 0.3 : 0.8) + gust));
      // The rumble: contentment under the hand, and a breath of it with every breath out, felt as much as heard.
      sound?.rumble(Math.max(rumbleFor(mood, strokeHeat > 0.05), 0.22 * (1 - pose.breath) * (scene === 'hall' ? 1 : 0.6), time < rumbleUntil ? 0.6 : 0));
    }
    if (!ctx || !palette || !inks) return;

    const g = ground(), light = lightAt(palette, hour, finale ? auroraAt(time - finale.start) : 0);
    let tones: Tones | null = null;
    const herd: HerdState | null = scene === 'steppe' && (task === 'scout' || herdFound || finale) ? (() => {
      const h = herdNow(), t = finale ? time - finale.start : -1;
      return { x: centreX + h.offset, depth: h.depth, show: Math.max(herdShow, task === 'scout' ? 0.2 : 0), lift: steppe.herd.map((_, i) => (t < 0 ? 0 : finaleLift(t - SET_PIECE.answers[i % SET_PIECE.answers.length] + 0.5 - (i % 2) * 0.25, reduced))), finder: finder && !herdFound ? { x: finder.x, y: finder.y, r: finderRadius() } : null };
    })() : null;
    const frameOf: SteppeFrame = { ctx, dpr, ground: g, palette, steppe, sky: round.sky, hour, time, wind, reduced, herd, show: skyShow() };
    let bundle: Bundle | null = null;
    if (carry) bundle = { x: carry.at[0], y: carry.at[1], angle: Math.sin(time * 3) * 0.08, size: 1.15 };
    if (feeding) {
      const t = time - feeding.start, at = feedAt(t), tip = tipWorld();
      if (at?.phase === 'fly') { const [x, y] = arcPoint(feeding.from, tip, ease(at.k), 30); bundle = { x, y, angle: (1 - at.k) * 0.5 * -face, size: 1.1 }; }
      else if (at?.phase === 'curl') bundle = { x: tip[0], y: tip[1], angle: 0.3, size: 1.1 - 0.6 * ease((at.k - 0.7) / 0.3) };
    }
    // The tufts to pluck stand in the afternoon's light: they belong to chapter two.
    const plucks: Sheaf[] = scene === 'steppe' && hour < 0.72 ? tufts.map((tuft, i) => ({ x: tuft.at[0], y: tuft.at[1], size: 1.35, grown: tuft.grown, shaken: tuft.shaken, cue: task === 'feed' && !carry && !feeding && !fed && i === 0 })) : [];
    const pending = shots.length && time >= shots[0].at && !glide ? shots[0] : null;
    const marks: ToolMarks = pending ? {} : {
      routeScope: scene === 'hall' && (task === 'trace' || traced > 0) && stepping < 0 ? { k: traced, guide: task === 'trace' && traceDone < 0 } : null,
      waitRing: carry && ring > 0.01 ? { at: [carry.at[0], carry.at[1] - 12], k: ring } : null,
      proofLens: lens && task === 'part' ? { at: fromAnimal(lens.at), r: lens.r, ready: lensReady } : null,
      scoutCam: finder ? { x: finder.x, y: finder.y, r: finderRadius(), lock } : null,
      viewCheck: task === 'low' && !lowDone ? { low, ...gaugeAt() } : null,
      flash,
    };
    const c = calfPlace();
    const animal: AnimalInput = { view, strands, dyn, tier, pose, place, snow, tusks: true, lens: lens && task === 'part' ? { x: lens.at[0], y: lens.at[1], r: lens.r } : null, fade: 1 };
    const small: AnimalInput | null = c && calfCoats ? { view: calfViews[c.facing], strands: calfCoats[c.facing].strands, dyn: calfCoats[c.facing].dyn, tier: 'light', pose: calfPose, place: c.place, snow: [], tusks: false, lens: null, fade: 1 } : null;
    drawFrame({
      ctx, scratch: scratchCanvas, width, height, dpr, camera, baseScale, anchor: [width / 2, height / 2], animal, calf: small, time, wind, palette, inks, light,
      // A slow frame paints fewer hairs to a lock; a quick one, more.
      hairBudget: frameMs < 22 ? 24000 : frameMs < 36 ? 14000 : 7000,
      back: () => { tones = drawSteppeBack(frameOf); }, front: scene === 'steppe' ? () => { if (tones) drawSteppeFront(frameOf, tones); } : null,
      glass: scene === 'hall' ? glass : glass.bloom > 0.01 ? { ...glass, panes: null, frost: null } : null,
      flakes: reduced ? [] : flakes, puffs, mists, motes, bundle, tufts: plucks, marks,
    });
    if (pending) { shots.shift(); takeShot(pending.id, pending.centre(), pending.size()); if (pending.id !== 'trunk') hooks.onShot(pending.id); pending.then?.(); }
    // (Development: a visit started part-way has no pictures yet; it is given stand-ins from what the stage shows.)
    if (standIns.length && time - taskSince > 1.6 && !glide) { standIns.forEach((id, i) => takeShot(id, [width * (0.3 + 0.1 * i), height * 0.5], Math.min(width, height) * 0.4, true)); standIns.length = 0; }
  };
  const switchTier = (next: Tier) => {
    tier = next; strands = strandsFor(viewId, tier); dyn = makeDynamics(strands.count); grid = buildGrid(strands); trunkRange = rangeOf(strands, 'trunk');
    if (tier === 'light') flakes = flakes.slice(0, Math.min(flakes.length, 30));
    const keep = camera; resize(); if (scene === 'steppe') camera = keep;
  };
  // In development only: where a finger would go (the hint hand's own path, and a few named places), so the rendered checks can drive real pointers.
  if (import.meta.env?.DEV) (el.stage as HTMLElement & { iafProbe?: (at: number | string) => Vec | null }).iafProbe = at => {
    if (typeof at === 'number') return ghostPath(at)?.at ?? null;
    if (at === 'herd') return scene === 'steppe' ? herdScreen() : null;
    if (at === 'ear') return toScreen(fromAnimal(view.tickle));
    if (at === 'eye') return toScreen(eyeWorld());
    if (at === 'trunk') return toScreen(tipWorld());
    if (at === 'coat') return toScreen(fromAnimal(view.hotspots.coats));
    return null;
  };
  const start = () => { if (!frame && !disposed) { last = 0; frame = requestAnimationFrame(loop); } };
  const halt = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const visibility = () => { if (document.visibilityState === 'hidden') { halt(); sound?.stop(); pointers.clear(); } else start(); };
  document.addEventListener('visibilitychange', visibility);
  start();

  return {
    task(next) { begin(next); },
    step() { noted(); help(); },
    nudge(dx, dy) {
      noted();
      if (task === 'scout' && finder && !herdFound) { learned.scout = true; finder.goal = clamp((finder.goal ?? finder.x) + dx * width * 0.07, 30, width - 30); }
      else if (task === 'low' && !lowDone) { low = clamp(low + dy * 0.2, 0, 1); learned.low = true; if (!glide) camera = lowCamera(); }
      else if (task === 'walk' && !walkDone && dx * face > 0) walking = Math.max(walking, 0.9);
      else if (scene === 'steppe') gust = Math.min(1, gust + 0.5);
    },
    snap() { noted(); return snapLens(); },
    through(onEnd) {
      if (passing || scene !== 'hall') { if (scene !== 'hall') onEnd(); return; }
      noted();
      task = 'idle'; breathe(2.4); sound?.snort(); sound?.trumpet(true, 0.15); play('hump');
      passing = { start: reduced ? time - 1.05 : time, onEnd, swapped: false };
    },
    greet(friend) {
      noted();
      sound?.hello(friend === 'pep'); flickAt = time;
      if (task === 'hello') { learned.hello = true; trust = meetStep(trust, true, 0); const tip = tipWorld(); greetIfFriends([tip[0] + face * 56, tip[1] - 150]); return; }
      if (!gesture) play(friend === 'pep' ? 'ears' : 'trunkBoop');
    },
    hold(next) { busy = next; if (busy) { ghostRun = null; showGhost(null, 0, 0); } lastInput = time; },
    jump(step) {
      // Development only: start the visit at a later step, with the story so far taken as played.
      if (!import.meta.env?.DEV) return;
      const index = STEPS.indexOf(step);
      if (index >= 1) { frostGone = true; eyeSeen = true; glass.frost = null; frostLayer = null; hooks.onLight(1); }
      if (index >= 3) { scene = 'steppe'; el.stage.dataset.scene = scene; place = IDENTITY; hallShift = 0; hallShiftGoal = 0; resize(); }
      if (index >= 4) { for (const clump of snow) clump.amount = 0; snowCleared = true; }
      if (index >= 5) fed = true;
      if (index >= 7) { const keep = camera; camera = shotFor('scout'); beginScout(); camera = keep; finder = null; herdFound = true; herdShow = 1; learned.scout = true; }
      if (index >= 8) { walked = 1; walkDone = true; ensureCalf(); calf = { start: time - CALF.seconds - 1, arrived: true }; }
      hour = hourGoal = hourFor(step);
      for (const before of STEPS.slice(0, index)) { const fact = STEP_FACT[before]; if (fact) standIns.push(fact); }
      begin(step);
    },
    photo: id => photos.get(id) ?? null,
    scene: () => scene,
    setReduced(next) { reduced = next; if (reduced && glide) { camera = { ...glide.to }; glide = null; } },
    tier: () => tier,
    dispose() {
      if (disposed) return;
      disposed = true; halt(); observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      el.stage.removeEventListener('pointerdown', down); el.stage.removeEventListener('pointermove', move);
      el.stage.removeEventListener('pointerup', up); el.stage.removeEventListener('pointercancel', up);
    },
  };
}
