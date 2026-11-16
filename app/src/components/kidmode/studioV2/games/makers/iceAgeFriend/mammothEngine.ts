/** The live mammoth: one canvas, one animation frame loop, the camera, touch,
 * wheel and pinch, the fur's springs, the wind, the animal's mood and idle
 * life, the meeting at the glass, the step into the hall, the toys and the
 * finale. The React component owns the words, the pictures and the buttons;
 * this owns everything that moves sixty times a second, writing straight to
 * the canvas and to a few elements' transforms so React never re-renders per
 * frame. Everything stops in `dispose()` and while the tab is hidden. */
import {
  DISCOVERIES, FOCUS_ZOOMS, PARTS, ZOOM_MAX, ZOOM_MIN, capOffset, chooseTier, focusTarget, generateStrands, mixCamera, pointInPolygon,
  springStep, stageCamera, strokeWeight, wholeView, windStrength, zoomAbout, type Camera, type DiscoveryId, type StrandSet, type Tier, type Vec,
} from './iceAgeFriendRules';
import { mammothView, strokePoint, toyAt, type MammothView, type ViewId } from './mammothShape';
import {
  IDENTITY, MIST_SECONDS, PUFF_SECONDS, REST_POSE, apply, drawFrame, makeDynamics, makeInks, paint, partFrames, readPalette, trunkLine, trunkPoint,
  type Affine, type Bundle, type Dynamics, type Flake, type Glass, type Inks, type LegId, type Mist, type Mote, type Palette, type Pose, type Puff, type Sheaf, type ToolMark,
} from './mammothRender';
import {
  DAY_WEATHER, ENTER_SECONDS, FEED, FEED_SECONDS, FINALE_ANSWERS, FINALE_CALL, FINALE_SECONDS, GESTURE_SECONDS, GHOST, SNOW_GONE, TURN_SECONDS,
  arcPoint, brushSnow, comesAnyway, enterAt, feedAt, feedPose, finaleLift, gestureAt, ghostAt, ghostDue, ghostKnockAt, leanFor, lidFor, meetStep, moodLift, moodStep,
  regrow, rumbleFor, seedSnow, snowLeft, turnAt, type DayId, type GestureId, type SnowClump,
} from './mammothPlayRules';
import { HALL, HALL_PICTURE, type FriendId } from './mammothArt';
import type { MammothSound } from './mammothAudio';

const SEED = 20261116;
const MARGIN = 70;
const GLIDE_MS = 760;
const MOTE_CAP = 90;

export type Phase = 'meet' | 'enter' | 'explore' | 'leave';
export interface EngineHooks {
  /** The zoom settled at a new value (for enabling the +/− buttons). */
  onZoom(zoom: number): void;
  /** The first touch, key or button: a gesture, so sound may start. */
  onGesture(): void;
  /** The mammoth is at the glass, stepping through, in the hall, or leaving. */
  onPhase(phase: Phase): void;
  /** A reward moment: the friends on the floor hop (a big one for the big moments). */
  onCheer(big: boolean): void;
  /** A light tap of the phone's haptics. */
  onTick(): void;
}
export interface EngineElements {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The picture layers that move with the camera: the steppe, the hall, the friends on the floor. */
  layers: HTMLElement[];
  rings: Partial<Record<DiscoveryId, HTMLElement | null>>;
  /** The hint hand. */
  ghost: HTMLElement | null;
  /** The cushion the grass stands on. */
  basket: HTMLElement | null;
  /** The ring that answers a touch where it lands. */
  ripple: HTMLElement | null;
}
export interface MammothEngine {
  zoomBy(factor: number): void;
  pan(dx: number, dy: number): void;
  whole(): void;
  turn(): void;
  view(): ViewId;
  phase(): Phase;
  /** Looks at a discovery with the crew's tool for it. The first time, the ProofLens takes its photo into `photo`. */
  focus(id: DiscoveryId, avoidBottom: number, first: boolean, photo: HTMLCanvasElement | null): void;
  /** The fact card closed: the tool is put away. */
  release(): void;
  /** The keyboard's touch: a knock on the glass while the mammoth is beyond it, a stroke along its back once it is in. */
  comb(): void;
  /** Offers a bunch of grass from the cushion. False while it is still eating the last one. */
  feed(): boolean;
  /** A friend on the floor was tapped: the mammoth notices. */
  greet(friend: FriendId): void;
  /** A fact card is open (or the game is otherwise busy): no hint hand over it. */
  hold(busy: boolean): void;
  finale(onEnd: () => void): void;
  /** A wave of the trunk, and back out to the steppe. */
  farewell(onEnd: () => void): void;
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

export function createMammothEngine(el: EngineElements, hooks: EngineHooks, sound: MammothSound | null, options: { reduced: boolean; day: DayId; faceRight?: boolean; random?: () => number }): MammothEngine {
  const ctx = el.canvas.getContext('2d', { alpha: true });
  const random = options.random ?? Math.random;
  const weather = DAY_WEATHER[options.day];
  let reduced = options.reduced;
  let disposed = false;
  let palette: Palette | null = null, inks: Inks | null = null;
  let viewId: ViewId = options.faceRight ? 'turned' : 'side';
  let view: MammothView = mammothView(viewId);
  const forced = tierOverride();
  let tier: Tier = forced ?? 'full';
  const sets = new Map<string, StrandSet>();
  let strands: StrandSet = strandsFor(viewId, tier);
  let dyn: Dynamics = makeDynamics(strands.count);
  let grid = buildGrid(strands);
  let trunkRange: [number, number] = rangeOf(strands, 'trunk');

  /* ── layout: where the hall picture, the stage and the animal sit ── */
  let width = 0, height = 0, dpr = 1, baseScale = 1;
  let home: Camera = wholeView(view.bounds);
  let camera: Camera = { ...home };
  let layout = { offX: 0, offY: 0, imgW: 1, imgH: 1 };
  let panes: Vec[][] = [];
  const glass: Glass = { panes: null, box: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, behind: true, bloom: 0 };
  let beyond: Affine = IDENTITY;
  let place: Affine = IDENTITY;
  let sheafAt: Vec | null = null;

  let glide: { from: Camera; to: Camera; start: number; ms: number } | null = null;
  let time = 0, last = 0, frame = 0, dirty = true;
  const samples: number[] = [];
  let sampling = !forced;
  let pose: Pose = { ...REST_POSE, step: { ...REST_POSE.step } };

  /* ── the story so far ── */
  let phase: Phase = 'meet';
  let trust = 0;
  let arriving = reduced ? -1 : 0;       // the walk up to the glass at the start (seconds, -1 = there)
  let entering = -1;                      // seconds into stepping through, or -1
  let leaving: { start: number; onEnd: () => void; swapped: boolean; ended: boolean } | null = null;
  let turning = -1;                       // seconds into the turn, or -1
  let turnSwapped = false, turnLanded = false;
  let finale: { start: number; called: boolean; answered: number; onEnd: () => void } | null = null;
  let gesture: { id: GestureId; start: number } | null = null;
  let feeding: { start: number; from: Vec; crunched: number } | null = null;
  let mood = 0, strokeHeat = 0, lean: Vec = [0, 0], squeeze = 0;
  let reach: { lift: number; swing: number; until: number } | null = null, reachLift = 0, reachSwing = 0;
  let busy = false;
  let lastInput = 0, ghostShown = 0, learnedKnock = false, learnedStroke = false, glassKnocks = 0;
  let ghostRun: { kind: 'knock' | 'stroke'; start: number; taps: number; at: Vec } | null = null;
  const stomps: { leg: LegId; start: number }[] = [];
  let gust = 0;
  let nextBlink = 2.5, blinkAt = -1, nextFlick = 5, flickAt = -1, nextPuff = 2, nextSwish = 3, swishAt = -1;
  const puffs: Puff[] = [], motes: Mote[] = [], mists: Mist[] = [];
  let flakes: Flake[] = makeFlakes(weather.flakes);
  let snow: SnowClump[] = seedSnow(view.snow.length, weather.cover, random);
  let snowCleared = snowLeft(snow) <= 0;
  let sheaf = { grown: 1, shaken: -9 }, hallSince = -1;
  let lastAudio = 0, lastTick = 0;
  let tool: { id: DiscoveryId; start: number } | null = null;
  const shots: { id: DiscoveryId; at: number; target: HTMLCanvasElement }[] = [];

  function strandsFor(id: ViewId, t: Tier): StrandSet {
    const key = `${id}:${t}`;
    let set = sets.get(key);
    if (!set) { const v = mammothView(id); set = generateStrands(v.regions, t, SEED, { mirror: v.mirror, bounds: v.furBounds }); sets.set(key, set); }
    return set;
  }
  function rangeOf(set: StrandSet, part: typeof PARTS[number]): [number, number] {
    const found = set.parts.find(p => p.part === part);
    return found ? [found.start, found.end] : [0, 0];
  }
  function buildGrid(set: StrandSet): Map<number, number[]> {
    const map = new Map<number, number[]>(), trunk = set.parts.find(p => p.part === 'trunk');
    for (let i = 0; i < set.count; i++) {
      if (trunk && i >= trunk.start && i < trunk.end) continue;
      const key = (Math.floor(set.rx[i] / 32) + 500) * 4096 + (Math.floor(set.ry[i] / 32) + 500);
      const list = map.get(key); if (list) list.push(i); else map.set(key, [i]);
    }
    return map;
  }
  function makeFlakes(n: number): Flake[] {
    return Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), r: 0.9 + Math.random() * Math.random() * 2.6, speed: 0.025 + Math.random() * 0.05, drift: Math.random() * Math.PI * 2 }));
  }

  const S = () => baseScale * camera.zoom;
  const half = () => ({ w: width / 2 / baseScale, h: height / 2 / baseScale });
  const hold = (c: Camera): Camera => ({ ...stageCamera(c, c.zoom, home, view.bounds, half(), MARGIN), zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, c.zoom)) });
  const toWorld = (sx: number, sy: number): Vec => [camera.x + (sx - width / 2) / S(), camera.y + (sy - height / 2) / S()];
  const toScreen = (w: Vec): Vec => [(w[0] - camera.x) * S() + width / 2, (w[1] - camera.y) * S() + height / 2];
  /** The world ↔ the animal's own drawing space (they are the same once it stands in the hall). */
  const toAnimal = (w: Vec): Vec => [(w[0] - place[4]) / place[0], (w[1] - place[5]) / place[3]];
  const fromAnimal = (a: Vec): Vec => apply(place, a);
  /** A point of the hall picture (fractions) in world units. */
  const pictureToWorld = (fx: number, fy: number): Vec => [home.x + (layout.offX + fx * layout.imgW - width / 2) / baseScale, home.y + (layout.offY + fy * layout.imgH - height / 2) / baseScale];
  const setCamera = (next: Camera, settle = true) => {
    const before = camera.zoom;
    camera = hold(next); dirty = true;
    if (settle && Math.abs(before - camera.zoom) > 1e-3) hooks.onZoom(camera.zoom);
  };
  const glideTo = (target: Camera) => {
    const to = hold(target);
    if (reduced) { glide = null; setCamera(to); return; }
    glide = { from: { ...camera }, to, start: performance.now(), ms: GLIDE_MS };
    // Say where the zoom is going at once, so the buttons and the room's focus change with the move, not after it.
    if (Math.abs(to.zoom - camera.zoom) > 1e-3) hooks.onZoom(to.zoom);
  };

  /** The place beyond the glass where the mammoth stands, for the way it faces. */
  const placeBeyond = () => {
    const spot = pictureToWorld(view.mirror ? 1 - HALL.beyond.x : HALL.beyond.x, HALL.beyond.y), s = HALL.beyond.scale, whole = wholeView(view.bounds);
    beyond = [s, 0, 0, s, spot[0] - s * whole.x, spot[1] - s * view.groundY];
  };

  /** The view while the mammoth is beyond the glass: closer to the wall, so the giant fills it; the floor stays in sight below. */
  const meetCamera = (): Camera => {
    const span = (view.bounds.maxX - view.bounds.minX) * baseScale * HALL.beyond.scale;
    const zoom = clamp((0.9 * width) / span, 1, Math.min(1.6, (height * 0.62) / ((view.furBounds.maxY - view.furBounds.minY) * baseScale * HALL.beyond.scale)));
    const z = Math.max(1, zoom), spot = pictureToWorld(view.mirror ? 1 - HALL.beyond.x : HALL.beyond.x, HALL.beyond.y);
    // Never show past the edge of the hall picture; keep the giant a little above the middle, the floor in sight below it.
    const reachX = Math.max(0, (layout.imgW / 2 - width / (2 * z)) / baseScale), mid = home.x + (layout.offX + layout.imgW / 2 - width / 2) / baseScale;
    const top = home.y + (layout.offY - height / 2) / baseScale + height / (2 * z) / baseScale, bottom = home.y + (layout.offY + layout.imgH - height / 2) / baseScale - height / (2 * z) / baseScale;
    const middle = spot[1] - ((view.furBounds.maxY - view.furBounds.minY) * HALL.beyond.scale) / 2;
    return { x: clamp(spot[0] - (view.mirror ? -1 : 1) * 24, mid - reachX, mid + reachX), y: clamp(middle + (0.09 * height) / (z * baseScale), Math.min(top, bottom), bottom), zoom: z };
  };

  /* ── size ── */
  const resize = () => {
    const box = el.stage.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    dpr = Math.min(tier === 'light' ? 1.5 : 2, globalThis.devicePixelRatio || 1);
    el.canvas.width = Math.round(width * dpr); el.canvas.height = Math.round(height * dpr);
    // The hall picture covers the stage; the stage it shows sits low in the view, the floor in front of it in reach.
    const k = Math.max(width / HALL_PICTURE.width, height / HALL_PICTURE.height);
    const imgW = HALL_PICTURE.width * k, imgH = HALL_PICTURE.height * k;
    const b = view.bounds, span = b.maxX - b.minX;
    const offX = clamp(width / 2 - HALL.stage.x * imgW, width - imgW, 0), offY = clamp(height * 0.8 - HALL.stage.y * imgH, height - imgH, 0);
    layout = { offX, offY, imgW, imgH };
    baseScale = Math.min(HALL.stage.span * imgW, 0.94 * width) / span;
    const whole = wholeView(b), keep = { x: camera.x - home.x, y: camera.y - home.y };
    home = { x: whole.x - (offX + HALL.stage.x * imgW - width / 2) / baseScale, y: view.groundY - (offY + HALL.stage.y * imgH - height / 2) / baseScale, zoom: ZOOM_MIN };
    const style = el.stage.style;
    style.setProperty('--iaf-img-x', `${offX.toFixed(1)}px`); style.setProperty('--iaf-img-y', `${offY.toFixed(1)}px`);
    style.setProperty('--iaf-img-w', `${imgW.toFixed(1)}px`); style.setProperty('--iaf-img-h', `${imgH.toFixed(1)}px`);
    style.setProperty('--iaf-tall', `${((view.furBounds.maxY - view.furBounds.minY) * baseScale).toFixed(1)}px`);
    // The wall of glass, and the place beyond it where the mammoth first stands.
    panes = HALL.panes.map(pane => pane.map(([fx, fy]) => pictureToWorld(fx, fy)));
    const path = new Path2D();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pane of panes) {
      pane.forEach(([x, y], i) => { if (i) path.lineTo(x, y); else path.moveTo(x, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
      path.closePath();
    }
    glass.panes = path; glass.box = { minX, minY, maxX, maxY };
    placeBeyond();
    if (el.basket) {
      const node = el.basket;
      sheafAt = [home.x + (node.offsetLeft + node.offsetWidth / 2 - width / 2) / baseScale, home.y + (node.offsetTop + node.offsetHeight * 0.4 - height / 2) / baseScale];
    }
    // Close to the wall the floor's edges are out of view: the crew and the cushion stand in to where the view ends.
    const wall = meetCamera(), midX = width / 2 + (wall.x - home.x) * baseScale, reachX = width / (2 * wall.zoom);
    style.setProperty('--iaf-wall-left', `${Math.max(0, midX - reachX).toFixed(1)}px`); style.setProperty('--iaf-wall-right', `${Math.max(0, width - (midX + reachX)).toFixed(1)}px`);
    style.setProperty('--iaf-wall-lift', `${Math.max(0, height - (height / 2 + (wall.y - home.y) * baseScale + height / (2 * wall.zoom))).toFixed(1)}px`);
    camera = glass.behind && !leaving ? wall : hold({ x: home.x + keep.x, y: home.y + keep.y, zoom: camera.zoom }); lastCamKey = ''; dirty = true;
  };
  let lastCamKey = '';
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(el.stage);
  resize();
  el.stage.dataset.mammoth = 'beyond'; el.stage.dataset.view = 'wall';

  /* ── fur: stroking and springs ── */
  const wake = (i: number) => { if (!dyn.active[i]) { dyn.active[i] = 1; dyn.live.push(i); } };
  /** Stroke at a point of the animal's own space. */
  const strokeAt = (ax: number, ay: number, dx: number, dy: number, pat: boolean) => {
    const R = clamp(34 / (S() * place[0]), 9, 70);
    const visit = (i: number, x: number, y: number) => {
      const d = Math.hypot(x - ax, y - ay), k = strokeWeight(d, R);
      if (!k) return;
      let ox: number, oy: number;
      if (pat) { const m = d || 1; ox = dyn.ox[i] + ((x - ax) / m) * 7 * k; oy = dyn.oy[i] + ((y - ay) / m) * 7 * k - 2 * k; }
      else { ox = dyn.ox[i] + dx * k * 1.9; oy = dyn.oy[i] + dy * k * 1.9; }
      [ox, oy] = capOffset(ox, oy, strands.len[i]);
      dyn.ox[i] = ox; dyn.oy[i] = oy; dyn.vx[i] = 0; dyn.vy[i] = 0; wake(i);
    };
    const c0x = Math.floor((ax - R) / 32), c1x = Math.floor((ax + R) / 32), c0y = Math.floor((ay - R) / 32), c1y = Math.floor((ay + R) / 32);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const list = grid.get((cx + 500) * 4096 + (cy + 500));
      if (list) for (const i of list) visit(i, strands.rx[i], strands.ry[i]);
    }
    for (let i = trunkRange[0]; i < trunkRange[1]; i++) visit(i, dyn.wx[i], dyn.wy[i]);
    dirty = true;
  };
  /** A shiver through the whole coat: every hair is thrown a little and springs back. */
  const shakeCoat = (amount: number) => {
    for (let i = 0; i < strands.count; i++) {
      const len = strands.len[i], a = strands.phase[i];
      dyn.ox[i] = Math.cos(a * 3) * len * 0.32 * amount; dyn.oy[i] = -Math.abs(Math.sin(a * 2)) * len * 0.2 * amount;
      dyn.vx[i] = Math.sin(a) * 60 * amount; dyn.vy[i] = 0; wake(i);
    }
    dirty = true;
  };
  const stepSprings = (dt: number) => {
    if (!dyn.live.length) return;
    const keep: number[] = [];
    for (const i of dyn.live) {
      const [ox, vx] = springStep(dyn.ox[i], dyn.vx[i], dt), [oy, vy] = springStep(dyn.oy[i], dyn.vy[i], dt);
      if (Math.abs(ox) + Math.abs(oy) < 0.04 && Math.abs(vx) + Math.abs(vy) < 0.04) { dyn.ox[i] = 0; dyn.oy[i] = 0; dyn.vx[i] = 0; dyn.vy[i] = 0; dyn.active[i] = 0; continue; }
      dyn.ox[i] = ox; dyn.vx[i] = vx; dyn.oy[i] = oy; dyn.vy[i] = vy; keep.push(i);
    }
    dyn.live = keep; dirty = true;
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
  const mist = (w: Vec, r = 44) => { mists.push({ x: w[0], y: w[1], r: r / baseScale, born: time }); if (mists.length > 10) mists.shift(); };
  /** Loose snow thrown from a world point; it falls to the floor (or the snow) at the animal's feet and melts away. */
  const scatter = (w: Vec, count: number, spread: number, up: number) => {
    if (reduced) return;
    const floor = fromAnimal([0, view.groundY])[1] + 6;
    for (let i = 0; i < count && motes.length < MOTE_CAP; i++) {
      const a = random() * Math.PI * 2, v = (0.3 + random() * 0.7) * spread;
      motes.push({ x: w[0] + Math.cos(a) * 6, y: w[1] + Math.sin(a) * 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - up * (0.5 + random() * 0.5), r: (1.4 + random() * 2.6) * place[0], born: time, life: 1.3 + random() * 1.1, floor: floor + random() * 16 });
    }
    dirty = true;
  };
  const stepMotes = (dt: number) => {
    if (!motes.length) return;
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      if (time - m.born >= m.life) { motes.splice(i, 1); continue; }
      if (m.y >= m.floor) { m.vx *= 0.8; continue; }
      m.vy += 520 * dt; m.x += m.vx * dt; m.y = Math.min(m.floor, m.y + m.vy * dt);
    }
    dirty = true;
  };
  const play = (id: GestureId) => { gesture = { id, start: time }; dirty = true; };
  const stomp = (leg: LegId) => { stomps.push({ leg, start: time }); };
  const footWorld = (leg: LegId): Vec => { const f = view.feet[leg]; return fromAnimal([(f.x0 + f.x1) / 2, f.y]); };

  /* ── the trunk reaches for a point ── */
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
  const reachScratch = trunkLine(view, REST_POSE);
  const tipAnimal = (): Vec => {
    const frames = partFrames(view, pose), line = trunkLine(view, pose);
    const [x, y] = trunkPoint(line, 1, 0, view.mirror);
    return apply(frames.head, [x, y]);
  };
  const tipWorld = (): Vec => fromAnimal(tipAnimal());

  /* ── meeting at the glass ── */
  const knockGlass = (w: Vec, counts: boolean) => {
    ripple(w); mist(w, 34); sound?.glass(); tick();
    reachFor(w, 1.6);
    flickAt = time;
    if (counts) { learnedKnock = true; trust = meetStep(trust, true, 0); if (trust >= 1) befriend(); }
  };
  const befriend = () => {
    if (phase !== 'meet') return;
    phase = 'enter'; entering = 0; ghostRun = null; hooks.onPhase(phase);
    if (reduced) { entering = ENTER_SECONDS * 0.46; }
  };
  const arrive = () => {
    // Step back from the wall to take in the hall, as the mammoth steps into it.
    if (reduced) camera = { ...home }; else glide = { from: { ...camera }, to: { ...home }, start: performance.now(), ms: 900 };
    glass.behind = false; glass.bloom = Math.max(glass.bloom, 0); place = IDENTITY; el.stage.dataset.mammoth = 'inside'; el.stage.dataset.view = 'hall'; hallSince = time;
    stomp('legFront'); stomp('legHind'); sound?.thump(); sound?.snort();
    shakeCoat(0.8);
    // It brought the steppe in with it: snow slides off its back and feet.
    for (const clump of snow) if (clump.amount > 0 && random() < 0.5) scatter(apply(partFrames(view, pose).body, view.snow[clump.spot].at), 2, 60, 40);
    scatter(footWorld('legFront'), 8, 130, 60); scatter(footWorld('legHind'), 8, 130, 60);
    hooks.onCheer(true); hooks.onTick();
  };

  /* ── toys ── */
  const insidePanes = (w: Vec) => panes.some(pane => pointInPolygon(w[0], w[1], pane));
  const tap = (sx: number, sy: number) => {
    const w = toWorld(sx, sy);
    if (phase === 'meet') { knockGlass(w, true); return; }
    if (phase !== 'explore') { ripple(w); return; }
    const a = toAnimal(w), hit = toyAt(view, a[0], a[1], tipAnimal(), pointInPolygon);
    ripple(w);
    if (!hit) {
      // The glass still answers: a knock, a patch of breath, and now and then the herd far out on the steppe.
      if (insidePanes(w)) { mist(w, 30); sound?.glass(); glassKnocks++; if (glassKnocks % 3 === 0) { sound?.trumpet(true, 0.25); gust = 1; play('ears'); hooks.onCheer(false); } }
      else sound?.chime();
      tick();
      return;
    }
    tick();
    switch (hit.toy) {
      case 'trunkTip': play('trunkBoop'); puffs.push({ x: w[0], y: w[1] - 8, born: time }); sound?.snort(); mood = moodLift(mood, 0.1); break;
      case 'tuskNear': play('tuskKnock'); sound?.knock(); break;
      case 'earSpot': play('tickle'); sound?.snort(); mood = moodLift(mood, 0.18); strokeAt(a[0], a[1], 0, 0, true); hooks.onCheer(false); break;
      case 'tailTip': play('tailSwish'); sound?.rustle(0.8); strokeAt(a[0], a[1], 0, 0, true); break;
      case 'footNear': { const leg = hit.leg ?? 'legFront'; stomp(leg); sound?.thump(); scatter(footWorld(leg), 7, 120, 70); break; }
      case 'coat': strokeAt(a[0], a[1], 0, 0, true); sound?.rustle(0.5); mood = moodLift(mood, 0.07); brush(a, 0.6); break;
    }
  };
  /** Brushes the snow off the back near a point of the animal's space. */
  const brush = (a: Vec, strength: number) => {
    if (snowCleared) return;
    const frames = partFrames(view, pose);
    for (const clump of snow) {
      if (clump.amount <= 0) continue;
      const spot = view.snow[clump.spot], at = apply(spot.part === 'head' ? frames.head : frames.body, spot.at);
      // The frames carry the sway; compare in the animal's space without the turn.
      const d = Math.hypot(at[0] - a[0], at[1] - a[1]), reachR = spot.r * 1.9 + 16 / (S() * place[0]);
      if (d > reachR) continue;
      const result = brushSnow(clump.amount, strength * (1 - d / reachR));
      if (result.shed < 0.02) continue;
      clump.amount = result.amount;
      scatter(fromAnimal([spot.at[0], spot.at[1] - 4]), Math.ceil(result.shed * 9), 90, 50);
      if (result.amount <= SNOW_GONE) { sound?.chime(); tick(); }
    }
    if (!snowCleared && snowLeft(snow) <= 0) { snowCleared = true; sound?.found(4); shakeCoat(0.5); play('hump'); hooks.onCheer(true); }
  };
  const startFeed = () => {
    if (phase !== 'explore' || feeding || finale || turning >= 0) { sheaf.shaken = time; sound?.rustle(0.6); dirty = true; return false; }
    feeding = { start: time, from: sheafAt ?? tipWorld(), crunched: 0 };
    sheaf = { grown: 0, shaken: time }; sound?.rustle(0.9); hooks.onTick();
    return true;
  };

  /* ── pointers: stroke on fur, carry grass, pan elsewhere, pinch to zoom ── */
  const pointers = new Map<number, { x: number; y: number; mode: 'stroke' | 'pan' | 'glass'; moved: number; t: number }>();
  let pinch: { d: number; mid: Vec } | null = null;
  const local = (e: PointerEvent | WheelEvent): Vec => { const r = el.stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const isControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button, [data-iaf-tag]');
  const noted = () => { lastInput = time; if (ghostRun) ghostRun = null; hooks.onGesture(); };
  const down = (e: PointerEvent) => {
    if (isControl(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    noted();
    const [x, y] = local(e), a = toAnimal(toWorld(x, y));
    const onAnimal = phase === 'explore' && !!toyAt(view, a[0], a[1], tipAnimal(), pointInPolygon);
    pointers.set(e.pointerId, { x, y, mode: phase === 'meet' ? 'glass' : onAnimal ? 'stroke' : 'pan', moved: 0, t: performance.now() });
    try { el.stage.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      pinch = { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, mid: [(p.x + q.x) / 2, (p.y + q.y) / 2] };
    }
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const [x, y] = local(e);
    const dx = x - p.x, dy = y - p.y, now = performance.now();
    lastInput = time;
    if (pointers.size >= 2 && pinch && phase === 'explore') {
      p.x = x; p.y = y;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: Vec = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const focusWorld = toWorld(mid[0], mid[1]);
      let next = zoomAbout(camera, d / pinch.d, { x: focusWorld[0], y: focusWorld[1] });
      next = { ...next, x: next.x - (mid[0] - pinch.mid[0]) / (baseScale * next.zoom), y: next.y - (mid[1] - pinch.mid[1]) / (baseScale * next.zoom) };
      glide = null; setCamera(next); pinch = { d, mid };
      return;
    }
    const dist = Math.hypot(dx, dy);
    p.moved += dist;
    if (p.mode === 'glass') {
      // A hand stroking the glass: the trunk follows it, breath blooms where it passes, and trust grows.
      if (phase === 'meet' && p.moved > 10) {
        const w = toWorld(x, y);
        if (now - p.t > 90) { mist(w, 30); reachFor(w, 1.2); p.t = now; sound?.rustle(0.25); }
        learnedKnock = true; trust = meetStep(trust, false, dist / 320);
        if (trust >= 1) befriend();
      }
    } else if (p.mode === 'pan') {
      const before = camera;
      glide = null; setCamera({ ...camera, x: camera.x - dx / S(), y: camera.y - dy / S() });
      // With nothing to pan to, a swipe through the air is a breath of wind in the coat.
      if (Math.abs(before.x - camera.x) + Math.abs(before.y - camera.y) < 0.01 && dist > 2) gust = Math.min(1, gust + dist / 260);
    } else {
      // Long fast swipes are stroked in short steps, so the trail has no gaps.
      const steps = Math.max(1, Math.ceil(dist / 14)), k = S() * place[0];
      let a: Vec = [0, 0];
      for (let i = 1; i <= steps; i++) {
        a = toAnimal(toWorld(p.x + (dx * i) / steps, p.y + (dy * i) / steps));
        strokeAt(a[0], a[1], dx / steps / k, dy / steps / k, false);
      }
      const speed = Math.min(1, dist / Math.max(8, now - p.t) / 1.2);
      sound?.rustle(speed);
      strokeHeat = Math.min(1, strokeHeat + 0.25 + speed * 0.5);
      const centre = wholeView(view.furBounds);
      lean = leanFor(mood, a[0] - centre.x, a[1] - centre.y);
      brush(a, 0.5 + 0.5 * speed);
      if (p.moved > 24) learnedStroke = true;
      if (p.moved > 40) tick();
      p.t = now;
    }
    p.x = x; p.y = y;
  };
  const up = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (p.moved < 8 && e.type === 'pointerup') tap(p.x, p.y);
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault(); noted();
    if (phase !== 'explore') return;
    const [x, y] = local(e), [wx, wy] = toWorld(x, y);
    glide = null;
    setCamera(zoomAbout(camera, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), { x: wx, y: wy }));
  };
  el.stage.addEventListener('pointerdown', down);
  el.stage.addEventListener('pointermove', move);
  el.stage.addEventListener('pointerup', up);
  el.stage.addEventListener('pointercancel', up);
  el.stage.addEventListener('wheel', wheel, { passive: false });

  /* ── the hint hand ── */
  const showGhost = (screen: Vec | null, press: number, alpha: number) => {
    const node = el.ghost; if (!node) return;
    if (!screen || alpha <= 0.01) { node.style.opacity = '0'; return; }
    node.style.opacity = alpha.toFixed(2);
    node.style.transform = `translate(${screen[0].toFixed(1)}px, ${screen[1].toFixed(1)}px) scale(${(1 - 0.1 * press).toFixed(3)})`;
  };
  const stepGhost = () => {
    const calm = !busy && !pointers.size && !glide && camera.zoom < 1.05 && turning < 0 && !feeding && !finale && !leaving;
    if (!ghostRun) {
      const kind = phase === 'meet' && arriving < 0 ? 'knock' : phase === 'explore' ? 'stroke' : null;
      const learned = kind === 'knock' ? learnedKnock : learnedStroke;
      if (!kind || !calm || !ghostDue(time - lastInput, ghostShown, learned, busy)) { showGhost(null, 0, 0); return; }
      if (kind === 'knock' && comesAnyway(ghostShown)) { befriend(); return; }
      // Tap the glass in front of the trunk; stroke along the back.
      const tipA = tipAnimal();
      ghostRun = { kind, start: time, taps: 0, at: fromAnimal([tipA[0] + (view.mirror ? 60 : -60), tipA[1] - 150]) };
      ghostShown++;
    }
    const t = (time - ghostRun.start) / GHOST.seconds;
    if (t >= 1 || !calm) { ghostRun = null; lastInput = time; showGhost(null, 0, 0); return; }
    if (ghostRun.kind === 'knock') {
      const at = ghostKnockAt(reduced ? 0.45 : t);
      if (at.tap > ghostRun.taps) { ghostRun.taps = at.tap; knockGlass(ghostRun.at, false); }
      showGhost(toScreen(ghostRun.at), at.press, reduced ? (t < 0.9 ? 1 : 0) : at.alpha);
    } else {
      const at = ghostAt(reduced ? 0.5 : t), a = strokePoint(view, at.u), w = fromAnimal(apply(partFrames(view, pose).body, a));
      if (at.press > 0.5) { const ahead = strokePoint(view, Math.min(1, at.u + 0.02)); strokeAt(a[0], a[1], (ahead[0] - a[0]) * 1.4, (ahead[1] - a[1]) * 1.4 + 0.6, false); }
      showGhost(toScreen(w), at.press, reduced ? (t < 0.9 ? 1 : 0) : at.alpha);
    }
  };

  /* ── the loop ── */
  const updatePose = (dt: number) => {
    const m = view.mirror ? -1 : 1;
    const next: Pose = { ...REST_POSE, step: { legFront: 0, legHind: 0, legFarFront: 0, legFarHind: 0 } };
    let blink = 0;
    if (!reduced) {
      next.swayX = Math.sin(time * 0.42) * 2.6; next.swayY = Math.sin(time * 1.05) * 0.9;
      next.nod = Math.sin(time * 0.5 + 1) * 0.012;
      next.swing = Math.sin(time * 0.6) * 0.12 + Math.sin(time * 1.37) * 0.04;
      if (time > nextFlick) { flickAt = time; nextFlick = time + 5 + Math.random() * 5; }
      if (time > nextSwish) { swishAt = time; nextSwish = time + 4 + Math.random() * 6; }
      if (swishAt >= 0) { const f = (time - swishAt) / 1.4; if (f >= 1) swishAt = -1; else next.tail = 0.16 * Math.sin(Math.PI * 2 * f) * (1 - f); }
      if (time > nextPuff && !finale && !feeding) { const tip = tipWorld(); puffs.push({ x: tip[0], y: tip[1] - 6 * place[0], born: time }); nextPuff = time + 3.4 + Math.random() * 1.6; }
    }
    if (flickAt >= 0) { const f = (time - flickAt) / 0.5; if (f >= 1) flickAt = -1; else if (!reduced) next.ear = -0.2 * Math.sin(Math.PI * f) * (1 - 0.4 * Math.sin(Math.PI * 2 * f)); dirty = true; }
    if (time > nextBlink) { blinkAt = time; nextBlink = time + 2.6 + Math.random() * 3.6; }
    if (blinkAt >= 0) { const f = (time - blinkAt) / 0.18; if (f >= 1) blinkAt = -1; else blink = reduced ? 1 : Math.sin(Math.PI * f); dirty = true; }

    // Mood: stroked, it settles; it leans into the hand, its eye closes, it rumbles.
    const touching = strokeHeat > 0.05;
    mood = moodStep(mood, strokeHeat, dt);
    strokeHeat = Math.max(0, strokeHeat - dt * 1.6);
    if (!touching) lean = [lean[0] * Math.max(0, 1 - dt * 2.4), lean[1] * Math.max(0, 1 - dt * 2.4)];
    next.swayX += lean[0] * m; next.swayY += lean[1];
    next.brow = -0.5 * mood;
    if (mood > 0.02 || touching) dirty = true;

    // The trunk reaches for a hand on the glass.
    const want = reach && time < reach.until ? reach : null;
    if (!want) reach = null;
    const follow = Math.min(1, dt * 5);
    reachLift += ((want?.lift ?? 0) - reachLift) * follow; reachSwing += ((want?.swing ?? 0) - reachSwing) * follow;
    if (Math.abs(reachLift) + Math.abs(reachSwing) > 0.003) { next.lift = Math.max(next.lift, reachLift); next.swing += reachSwing; dirty = true; }

    // The walk up to the glass: diagonal pairs of feet, the body rocking over them.
    if (arriving >= 0) {
      const beat = Math.sin(arriving * Math.PI * 2 * 1.9);
      next.step.legFront = next.step.legFarHind = Math.max(0, beat) * 12; next.step.legHind = next.step.legFarFront = Math.max(0, -beat) * 12;
      next.swayY -= Math.abs(beat) * 3; next.nod += beat * 0.02;
    }
    for (let i = stomps.length - 1; i >= 0; i--) {
      const k = (time - stomps[i].start) / 0.34;
      if (k >= 1) { stomps.splice(i, 1); continue; }
      next.step[stomps[i].leg] = Math.max(next.step[stomps[i].leg], 15 * Math.sin(Math.PI * k) * (reduced ? 0 : 1)); dirty = true;
    }

    if (gesture) {
      const t = time - gesture.start;
      if (t >= GESTURE_SECONDS[gesture.id]) gesture = null;
      else {
        const d = gestureAt(gesture.id, reduced ? GESTURE_SECONDS[gesture.id] * 0.4 : t);
        next.nod += d.nod; next.ear += d.ear; next.swayY -= d.rise; next.swing += d.swing; next.curl += d.curl; next.tail += d.tail; next.brow += d.brow;
        squeeze = d.squeeze; dirty = true;
      }
    }
    if (!gesture) squeeze = 0;

    if (feeding) {
      const t = time - feeding.start, at = feedAt(t);
      if (!at) { feeding = null; mood = moodLift(mood, 0.2); hooks.onCheer(false); }
      else {
        const fp = feedPose(t);
        next.curl += fp.curl; next.jaw = Math.max(next.jaw, fp.jaw); next.lift = Math.max(next.lift, fp.reach * 0.16); next.swing *= 1 - Math.max(fp.curl, fp.reach * 0.6);
        if (at.phase === 'chew') { const beatNo = Math.floor(at.k * 5); if (beatNo > feeding.crunched) { feeding.crunched = beatNo; sound?.crunch(); } next.nod += 0.012 * Math.sin(at.k * Math.PI * 10); }
        dirty = true;
      }
    }
    sheaf.grown = regrow(sheaf.grown, feeding ? 0 : dt);

    if (turning >= 0) {
      const at = turnAt(reduced ? TURN_SECONDS : turning);
      if (at.swapped && !turnSwapped) { turnSwapped = true; swapView(); }
      if (at.landed && !turnLanded) { turnLanded = true; sound?.thump(); scatter(footWorld('legFront'), 6, 120, 60); scatter(footWorld('legHind'), 6, 120, 60); shakeCoat(0.45); hooks.onTick(); }
      next.turn = at.face; next.hop = at.hop * 12; next.squash = at.squash;
      turning += dt;
      if (turning >= TURN_SECONDS) turning = -1;
      dirty = true;
    }

    if (finale) {
      const t = time - finale.start, lift = finaleLift(t, reduced);
      next.lift = Math.max(next.lift, lift); next.swing *= 1 - lift; next.jaw = Math.max(next.jaw, lift * 0.85); next.nod -= 0.05 * lift; next.brow += 0.6 * lift;
      if (!finale.called && t > FINALE_CALL) {
        finale.called = true; sound?.trumpet(); gust = 1; shakeCoat(0.9); hooks.onCheer(true); hooks.onTick();
        const frames = partFrames(view, pose);
        // Whatever snow is left flies up off its back in the sun.
        for (const clump of snow) { if (clump.amount > 0) { scatter(fromAnimal(apply(frames.body, view.snow[clump.spot].at)), 5, 150, 190); clump.amount = 0; } }
        snowCleared = true;
        const tip = tipWorld(); puffs.push({ x: tip[0], y: tip[1], born: time }, { x: tip[0] + 10, y: tip[1] - 14, born: time + 0.35 });
      }
      while (finale.answered < FINALE_ANSWERS.length && t > FINALE_ANSWERS[finale.answered]) { sound?.trumpet(true); finale.answered++; hooks.onCheer(false); }
      if (t > FINALE_SECONDS) { const done = finale.onEnd; finale = null; done(); }
      dirty = true;
    }

    next.lid = lidFor(mood, blink, squeeze);
    pose = next;
    while (puffs.length && time - puffs[0].born > PUFF_SECONDS) puffs.shift();
    while (mists.length && time - mists[0].born > MIST_SECONDS) mists.shift();
    if (mists.length || puffs.length) dirty = true;
  };
  /** Where the animal stands: walking up beyond the glass, stepping through, in the hall, going back out. */
  const updatePlace = (dt: number) => {
    if (arriving >= 0) {
      arriving += dt;
      const k = ease(arriving / 2.2);
      place = [beyond[0], 0, 0, beyond[3], beyond[4] + (1 - k) * 620 * beyond[0] * (view.mirror ? -1 : 1), beyond[5]];
      if (arriving >= 2.2) { arriving = -1; place = beyond; lastInput = time; }
      dirty = true;
      return;
    }
    if (entering >= 0) {
      const before = enterAt(entering); entering += dt; const at = enterAt(entering);
      glass.bloom = at.bloom;
      if (at.inside && !before.inside || (at.inside && glass.behind)) arrive();
      if (!at.inside) { const s = beyond[0] * (1 + 0.1 * at.near), whole = wholeView(view.bounds); place = [s, 0, 0, s, beyond[4] + beyond[0] * whole.x - s * whole.x, beyond[5] + beyond[3] * view.groundY - s * view.groundY + 6 * at.near]; }
      else pose.squash = Math.max(pose.squash, at.settle * 0.8);
      if (at.done) { entering = -1; glass.bloom = 0; phase = 'explore'; lastInput = time; hooks.onPhase(phase); }
      dirty = true;
      return;
    }
    if (leaving) {
      const t = time - leaving.start, wave = GESTURE_SECONDS.farewell, k = clamp((t - wave) / 0.9, 0, 1);
      glass.bloom = k < 0.5 ? ease(k * 2) : 1 - ease((k - 0.5) * 2);
      if (k >= 0.5 && !leaving.swapped) { leaving.swapped = true; glass.behind = true; place = beyond; el.stage.dataset.mammoth = 'beyond'; camera = { ...home }; hooks.onZoom(camera.zoom); play('farewell'); }
      if (k >= 1 && t > wave + 0.9 + 0.5 && !leaving.ended) { leaving.ended = true; glass.bloom = 0; leaving.onEnd(); }
      dirty = true;
    }
  };
  /** Where a discovery is on the animal just now (its own space). */
  const spotAnimal = (id: DiscoveryId, frames: ReturnType<typeof partFrames>, line: ReturnType<typeof trunkLine>): Vec => {
    if (id === 'trunk') { const [x, y] = trunkPoint(line, 0.9, 0, view.mirror); return apply(frames.head, [x, y]); }
    return apply(id === 'ears' ? frames.ear : id === 'tusks' ? frames.head : frames.body, view.hotspots[id]);
  };
  /** The ProofLens records the actual view: the photo is cut from what the stage shows at that moment. */
  const takeShot = (shot: { id: DiscoveryId; target: HTMLCanvasElement }, frames: ReturnType<typeof partFrames>, line: ReturnType<typeof trunkLine>) => {
    const g = shot.target.getContext('2d'); if (!g || !palette) return;
    const world = fromAnimal(spotAnimal(shot.id, frames, line)), [sx, sy] = toScreen(world), size = Math.min(width, height) * 0.34;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = paint(palette['sky-pale']); g.fillRect(0, 0, shot.target.width, shot.target.height);
    try { g.drawImage(el.canvas, (sx - size / 2) * dpr, (sy - size / 2) * dpr, size * dpr, size * dpr, 0, 0, shot.target.width, shot.target.height); } catch { /* nothing to copy yet */ }
    shot.target.dataset.shot = 'true';
    ripple(world); sound?.shutter(); hooks.onTick(); hooks.onCheer(false);
  };
  const placeRings = (frames: ReturnType<typeof partFrames>, line: ReturnType<typeof trunkLine>) => {
    for (const id of DISCOVERIES) {
      const node = el.rings[id]; if (!node) continue;
      const a = spotAnimal(id, frames, line);
      const [x, y] = toScreen(fromAnimal(a));
      const out = x < 6 || y < 6 || x > width - 6 || y > height - 6 || (turning >= 0 && pose.turn < 0.5);
      node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      node.style.visibility = out ? 'hidden' : '';
    }
  };
  const placeLayers = () => {
    const z = camera.zoom, tx = (home.x - camera.x) * baseScale * z, ty = (home.y - camera.y) * baseScale * z;
    const transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${z.toFixed(4)})`;
    for (const layer of el.layers) layer.style.transform = transform;
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
    if (!palette) { palette = readPalette(el.stage); inks = makeInks(palette); }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    if (sampling && last) {
      samples.push(now - last);
      if (samples.length >= 70) {
        sampling = false;
        const chosen = chooseTier(samples.slice(10), tier);
        if (chosen !== tier) switchTier(chosen);
      }
    }
    last = now; time += dt;
    if (glide) {
      const t = (now - glide.start) / glide.ms;
      const mixed = mixCamera(glide.from, glide.to, t);
      camera = phase === 'explore' ? hold(mixed) : mixed; dirty = true;
      if (t >= 1) { glide = null; hooks.onZoom(camera.zoom); }
    }
    updatePose(dt);
    updatePlace(dt);
    stepGhost();
    stepSprings(dt);
    stepMotes(dt);
    gust = Math.max(0, gust - dt * 0.7);
    // Out on the steppe the wind blows free; in the hall it is the draught through the dome, unless a hand stirs it.
    const outdoors = clamp(windStrength(time) + weather.wind, 0, 1);
    const wind = reduced ? 0 : Math.min(1, (glass.behind ? outdoors : outdoors * 0.55) + gust * 0.8);
    if (!reduced) { stepFlakes(dt, outdoors + gust); dirty = true; }
    if (now - lastAudio > 150) { lastAudio = now; sound?.wind(reduced ? 0.2 : Math.min(1, outdoors * (glass.behind ? 0.8 : 0.45) + gust)); sound?.rumble(rumbleFor(mood, strokeHeat > 0.05)); }
    const camKey = `${camera.x.toFixed(2)}:${camera.y.toFixed(2)}:${camera.zoom.toFixed(4)}:${width}:${height}`;
    if (camKey !== lastCamKey) { lastCamKey = camKey; placeLayers(); }
    if (!dirty || !ctx || !palette || !inks) return;
    dirty = false;
    let bundle: Bundle | null = null;
    if (feeding) {
      const t = time - feeding.start, at = feedAt(t), tip = tipWorld();
      if (at?.phase === 'fly') { const [x, y] = arcPoint(feeding.from, tip, ease(at.k), 110); bundle = { x, y, angle: (1 - at.k) * 0.9 * (view.mirror ? -1 : 1), size: 1 }; }
      else if (at?.phase === 'curl') bundle = { x: tip[0], y: tip[1], angle: 0.3, size: 1 - 0.5 * ease((at.k - 0.7) / 0.3) };
    }
    // The grass shows once the cushion has come to rest in its place on the floor.
    const grass: Sheaf | null = sheafAt && hallSince >= 0 && (reduced || time - hallSince > 1) ? { x: sheafAt[0], y: sheafAt[1], size: Math.max(0.5, 30 / baseScale / 46), grown: sheaf.grown, shaken: sheaf.shaken } : null;
    const fade = entering >= 0 && !glass.behind ? clamp(1 - enterAt(entering).settle * 1.15, 0, 1) : 1;
    // The crew's tool at work on the open discovery: the RouteScope's measured curve, the ScoutCam's frame.
    let mark: ToolMark | null = null;
    if (tool && (tool.id === 'tusks' || tool.id === 'trunk')) mark = { kind: tool.id === 'tusks' ? 'routeScope' : 'scoutCam', k: reduced ? 1 : clamp((time - tool.start - 0.5) / 1.1, 0, 1), at: fromAnimal(spotAnimal('trunk', partFrames(view, pose), trunkLine(view, pose))) };
    if (tool && time - tool.start < 1.8) dirty = true;
    const out = drawFrame({ ctx, width, height, dpr, camera, baseScale, anchor: [width / 2, height / 2], place, view, strands, dyn, tier, time, wind, pose, palette, inks, glass, flakes: reduced ? [] : flakes, puffs, mists, snow, motes, bundle, sheaf: grass, tool: mark, fade });
    placeRings(out.frames, out.trunk);
    for (let i = shots.length - 1; i >= 0; i--) if (time >= shots[i].at && !glide) { takeShot(shots[i], out.frames, out.trunk); shots.splice(i, 1); dirty = true; }
    if (shots.length) dirty = true;
  };
  const switchTier = (next: Tier) => {
    tier = next; strands = strandsFor(viewId, tier); dyn = makeDynamics(strands.count); grid = buildGrid(strands); trunkRange = rangeOf(strands, 'trunk');
    if (tier === 'light') flakes = flakes.slice(0, Math.min(flakes.length, 30));
    resize();
  };
  const swapView = () => {
    const mirrorX = (x: number) => view.bounds.minX + view.bounds.maxX - x;
    viewId = viewId === 'side' ? 'turned' : 'side';
    view = mammothView(viewId); strands = strandsFor(viewId, tier); dyn = makeDynamics(strands.count); grid = buildGrid(strands); trunkRange = rangeOf(strands, 'trunk');
    // Close up, keep looking at the same spot on the animal; from afar, show all of it.
    placeBeyond();
    camera = hold(camera.zoom <= 1.01 ? home : { ...camera, x: mirrorX(camera.x) }); dirty = true;
  };
  const start = () => { if (!frame && !disposed) { last = 0; frame = requestAnimationFrame(loop); } };
  const halt = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const visibility = () => { if (document.visibilityState === 'hidden') { halt(); sound?.stop(); } else start(); };
  document.addEventListener('visibilitychange', visibility);
  hooks.onPhase(phase);
  start();

  return {
    zoomBy(factor) { noted(); if (phase !== 'explore') return; const target = glide ? glide.to : camera; glideTo(zoomAbout(target, factor, { x: target.x, y: target.y })); },
    pan(dx, dy) { noted(); if (phase !== 'explore') return; glide = null; setCamera({ ...camera, x: camera.x + dx / S(), y: camera.y + dy / S() }); },
    whole() { noted(); glideTo(home); },
    turn() {
      noted();
      if (phase !== 'explore' || turning >= 0 || finale) return;
      turning = 0; turnSwapped = false; turnLanded = false;
    },
    view: () => viewId,
    phase: () => phase,
    focus(id, avoidBottom, first, photo) {
      noted();
      const frames = partFrames(view, pose), point = spotAnimal(id, frames, trunkLine(view, pose));
      const zoom = FOCUS_ZOOMS[id] ?? 2.2;
      // ViewCheck looks from low down: the camera sinks toward the floor and the hump towers over it.
      const aim = id === 'hump' ? { x: point[0], y: point[1] + 150 } : { x: point[0], y: point[1] };
      const target = focusTarget(aim, view.bounds, half(), MARGIN, zoom);
      // Keep the spot above the card that opens over the bottom of the stage.
      glideTo({ ...target, y: target.y + avoidBottom / 2 / (baseScale * target.zoom) });
      tool = { id, start: time };
      // The first time, the mammoth shows what the words are about, and the ProofLens takes its photo.
      if (first) {
        play(id); if (id === 'coats') shakeCoat(0.7); if (id === 'tusks') scatter(fromAnimal(apply(frames.head, view.hotspots.tusks)), 6, 90, 40);
        sound?.found(DISCOVERIES.indexOf(id));
        if (photo) shots.push({ id, at: time + (reduced ? 0.05 : GESTURE_SECONDS[id] * 0.55 + 0.6), target: photo });
      } else sound?.chime();
    },
    release() { tool = null; dirty = true; },
    comb() {
      noted();
      if (phase === 'meet') { const tipA = tipAnimal(); knockGlass(fromAnimal([tipA[0] + (view.mirror ? 60 : -60), tipA[1] - 150]), true); return; }
      if (phase !== 'explore') return;
      // One long stroke along the back, from the hump toward the tail.
      const steps = 26, body = partFrames(view, pose).body;
      for (let k = 0; k < steps; k++) {
        const a = strokePoint(view, k / steps), b = strokePoint(view, (k + 1) / steps);
        strokeAt(a[0], a[1], (b[0] - a[0]) * 1.2, (b[1] - a[1]) * 1.2 + 1, false); strokeAt(a[0], a[1] + 40, (b[0] - a[0]) * 1.2, 2, false);
        brush(apply(body, [a[0], a[1] - 26]), 0.9);
      }
      const mid = strokePoint(view, 0.5), centre = wholeView(view.furBounds);
      strokeHeat = 1; mood = moodLift(mood, 0.12); lean = leanFor(mood, mid[0] - centre.x, mid[1] - centre.y); learnedStroke = true;
      sound?.rustle(0.7); hooks.onTick();
    },
    feed() { noted(); return startFeed(); },
    greet(friend) {
      noted();
      sound?.hello(friend === 'pep');
      if (phase === 'meet') { trust = meetStep(trust, true, 0); learnedKnock = true; flickAt = time; if (trust >= 1) befriend(); return; }
      if (phase === 'explore' && !gesture) play(friend === 'pep' ? 'ears' : 'trunkBoop');
    },
    hold(next) { busy = next; if (busy) { ghostRun = null; showGhost(null, 0, 0); } lastInput = time; },
    finale(onEnd) {
      if (finale) return;
      feeding = null; glideTo(home);
      finale = { start: time, called: false, answered: 0, onEnd };
    },
    farewell(onEnd) {
      if (leaving) return;
      noted();
      phase = 'leave'; hooks.onPhase(phase); glideTo(home); play('farewell'); sound?.snort();
      leaving = { start: time, onEnd, swapped: false, ended: false };
      if (reduced) leaving.start = time - GESTURE_SECONDS.farewell;
    },
    setReduced(next) { reduced = next; if (reduced && glide) { camera = hold(glide.to); glide = null; } if (reduced && arriving >= 0) { arriving = -1; place = beyond; } dirty = true; },
    tier: () => tier,
    dispose() {
      if (disposed) return;
      disposed = true; halt(); observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      el.stage.removeEventListener('pointerdown', down); el.stage.removeEventListener('pointermove', move);
      el.stage.removeEventListener('pointerup', up); el.stage.removeEventListener('pointercancel', up);
      el.stage.removeEventListener('wheel', wheel);
    },
  };
}
export { ZOOM_MAX, ZOOM_MIN, FEED, FEED_SECONDS };
