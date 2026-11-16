/** The live mammoth: one canvas, one animation frame loop, the camera, touch,
 * wheel and pinch, the fur's springs, the wind, the idle life of the animal
 * and the finale. The React component owns the words and buttons; this owns
 * everything that moves sixty times a second, writing straight to the canvas
 * and to the rings' transforms so React never re-renders per frame.
 * Everything stops in `dispose()` and while the tab is hidden. */
import {
  DISCOVERIES, PARTS, ZOOM_MAX, ZOOM_MIN, capOffset, chooseTier, clampCamera, focusTarget, generateStrands, mixCamera, pointInPolygon,
  springStep, strokeWeight, wholeView, windStrength, zoomAbout, type Bounds, type Camera, type DiscoveryId, type StrandSet, type Tier, type Vec,
} from './iceAgeFriendRules';
import { mammothView, onCoat, turnPoint, unturnPoint, type MammothView, type ViewId } from './mammothShape';
import { PUFF_SECONDS, REST_POSE, apply, drawFrame, makeDynamics, makeInks, partFrames, readPalette, trunkLine, trunkPoint, type Dynamics, type Flake, type Inks, type Palette, type Pose, type Puff } from './mammothRender';
import type { MammothSound } from './mammothAudio';

const SEED = 20261116;
const MARGIN = 70;
const GLIDE_MS = 760;
const TURN_MS = 680;
const FINALE = { rise: 1.1, hold: 2.2, fall: 1.5 };

export interface EngineHooks {
  /** The zoom settled at a new value (for enabling the +/− buttons). */
  onZoom(zoom: number): void;
  /** The first touch, key or button: a gesture, so sound may start. */
  onGesture(): void;
}
export interface EngineElements {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Backdrop layers, each with its parallax depth (0 far .. 1 the ground). */
  layers: { node: SVGGElement; depth: number }[];
  backdrop: SVGSVGElement;
  rings: Partial<Record<DiscoveryId, HTMLElement | null>>;
}
export interface MammothEngine {
  zoomBy(factor: number): void;
  pan(dx: number, dy: number): void;
  whole(): void;
  turn(): void;
  view(): ViewId;
  focus(id: DiscoveryId, avoidBottom: number): void;
  /** A keyboard stroke: combs a band of fur across the middle of the view. */
  comb(): void;
  finale(onCall: () => void, onEnd: () => void): void;
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

export function createMammothEngine(el: EngineElements, hooks: EngineHooks, sound: MammothSound | null, startReduced: boolean): MammothEngine {
  const ctx = el.canvas.getContext('2d', { alpha: true });
  let reduced = startReduced;
  let disposed = false;
  let palette: Palette | null = null, inks: Inks | null = null;
  let viewId: ViewId = 'side';
  let view: MammothView = mammothView(viewId);
  const forced = tierOverride();
  let tier: Tier = forced ?? 'full';
  const sets = new Map<string, StrandSet>();
  let strands: StrandSet = strandsFor(viewId, tier);
  let dyn: Dynamics = makeDynamics(strands.count);
  let grid = buildGrid(strands);
  let trunkRange: [number, number] = rangeOf(strands, 'trunk');

  // Both views fit the same scale, so turning never jumps in size.
  const union: Bounds = (() => { const a = mammothView('side').bounds, b = mammothView('turned').bounds; return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }; })();
  let width = 0, height = 0, dpr = 1, baseScale = 1;
  let camera: Camera = wholeView(view.bounds);
  let glide: { from: Camera; to: Camera; start: number; ms: number } | null = null;
  let turning: { start: number; swapped: boolean } | null = null;
  let finale: { start: number; called: boolean; ended: boolean; onCall: () => void; onEnd: () => void } | null = null;
  let time = 0, last = 0, frame = 0, dirty = true;
  const samples: number[] = [];
  let sampling = !forced;
  let pose: Pose = { ...REST_POSE };
  let nextBlink = 2.5, blinkAt = -1, nextFlick = 5, flickAt = -1, nextPuff = 2, nextSwish = 3, swishAt = -1;
  const puffs: Puff[] = [];
  let flakes: Flake[] = makeFlakes(56);
  let lastAudio = 0;

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
      const key = cellKey(set.rx[i], set.ry[i]);
      const list = map.get(key); if (list) list.push(i); else map.set(key, [i]);
    }
    return map;
  }
  function cellKey(x: number, y: number) { return (Math.floor(x / 32) + 500) * 4096 + (Math.floor(y / 32) + 500); }
  function makeFlakes(n: number): Flake[] {
    return Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), r: 0.9 + Math.random() * Math.random() * 2.6, speed: 0.025 + Math.random() * 0.05, drift: Math.random() * Math.PI * 2 }));
  }
  const S = () => baseScale * camera.zoom;
  const half = () => ({ w: width / 2 / baseScale, h: height / 2 / baseScale });
  const clamp = (c: Camera): Camera => ({ ...clampCamera(c, c.zoom, view.bounds, half(), MARGIN), zoom: c.zoom });
  const toWorld = (sx: number, sy: number): Vec => [camera.x + (sx - width / 2) / S(), camera.y + (sy - height / 2) / S()];
  const setCamera = (next: Camera, settle = true) => {
    const before = camera.zoom;
    camera = clamp(next); dirty = true;
    if (settle && Math.abs(before - camera.zoom) > 1e-3) hooks.onZoom(camera.zoom);
  };
  const glideTo = (target: Camera) => {
    const to = clamp(target);
    if (reduced) { glide = null; setCamera(to); return; }
    glide = { from: { ...camera }, to, start: performance.now(), ms: GLIDE_MS };
  };

  /* ── size ── */
  const resize = () => {
    const box = el.stage.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    dpr = Math.min(tier === 'light' ? 1.5 : 2, globalThis.devicePixelRatio || 1);
    el.canvas.width = Math.round(width * dpr); el.canvas.height = Math.round(height * dpr);
    el.backdrop.setAttribute('viewBox', `0 0 ${width} ${height}`);
    baseScale = Math.min(width / ((union.maxX - union.minX) * 1.06), height / ((union.maxY - union.minY) * 1.12));
    camera = clamp(camera); dirty = true;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(el.stage);
  resize();

  /* ── fur: stroking and springs ── */
  const touch = (i: number) => { if (!dyn.active[i]) { dyn.active[i] = 1; dyn.live.push(i); } };
  const strokeAt = (wx: number, wy: number, dx: number, dy: number, pat: boolean) => {
    const R = Math.max(9, Math.min(70, 34 / S()));
    const visit = (i: number, x: number, y: number) => {
      const d = Math.hypot(x - wx, y - wy), k = strokeWeight(d, R);
      if (!k) return;
      let ox: number, oy: number;
      if (pat) { const m = d || 1; ox = dyn.ox[i] + ((x - wx) / m) * 7 * k; oy = dyn.oy[i] + ((y - wy) / m) * 7 * k - 2 * k; }
      else { ox = dyn.ox[i] + dx * k * 1.9; oy = dyn.oy[i] + dy * k * 1.9; }
      [ox, oy] = capOffset(ox, oy, strands.len[i]);
      dyn.ox[i] = ox; dyn.oy[i] = oy; dyn.vx[i] = 0; dyn.vy[i] = 0; touch(i);
    };
    const c0x = Math.floor((wx - R) / 32), c1x = Math.floor((wx + R) / 32), c0y = Math.floor((wy - R) / 32), c1y = Math.floor((wy + R) / 32);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const list = grid.get((cx + 500) * 4096 + (cy + 500));
      if (list) for (const i of list) visit(i, strands.rx[i], strands.ry[i]);
    }
    for (let i = trunkRange[0]; i < trunkRange[1]; i++) visit(i, dyn.wx[i], dyn.wy[i]);
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

  /* ── pointers: stroke on fur, pan elsewhere, pinch to zoom ── */
  const pointers = new Map<number, { x: number; y: number; mode: 'stroke' | 'pan'; moved: number; t: number }>();
  let pinch: { d: number; mid: Vec } | null = null;
  const local = (e: PointerEvent | WheelEvent): Vec => { const r = el.stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const isControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button, [data-iaf-tag]');
  const down = (e: PointerEvent) => {
    if (isControl(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    hooks.onGesture();
    const [x, y] = local(e), [wx, wy] = toWorld(x, y);
    const mode = onCoat(view, wx, wy, pointInPolygon) ? 'stroke' : 'pan';
    pointers.set(e.pointerId, { x, y, mode, moved: 0, t: performance.now() });
    try { el.stage.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
    }
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const [x, y] = local(e);
    const dx = x - p.x, dy = y - p.y;
    if (pointers.size >= 2 && pinch) {
      p.x = x; p.y = y;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: Vec = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const focusWorld = toWorld(mid[0], mid[1]);
      let next = zoomAbout(camera, d / pinch.d, { x: focusWorld[0], y: focusWorld[1] });
      next = { ...next, x: next.x - (mid[0] - pinch.mid[0]) / (baseScale * next.zoom), y: next.y - (mid[1] - pinch.mid[1]) / (baseScale * next.zoom) };
      glide = null; setCamera(next); pinch = { d, mid };
      return;
    }
    p.moved += Math.hypot(dx, dy);
    if (p.mode === 'pan') { glide = null; setCamera({ ...camera, x: camera.x - dx / S(), y: camera.y - dy / S() }); }
    else {
      // Long fast swipes are stroked in short steps, so the trail has no gaps.
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 14));
      for (let k = 1; k <= steps; k++) {
        const [wx, wy] = toWorld(p.x + (dx * k) / steps, p.y + (dy * k) / steps);
        strokeAt(wx, wy, dx / steps / S(), dy / steps / S(), false);
      }
      const now = performance.now();
      sound?.rustle(Math.min(1, Math.hypot(dx, dy) / Math.max(8, now - p.t) / 1.2));
      p.t = now;
    }
    p.x = x; p.y = y;
  };
  const up = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    // A tap on the fur ruffles it.
    if (p.mode === 'stroke' && p.moved < 6 && e.type === 'pointerup') { const [wx, wy] = toWorld(p.x, p.y); strokeAt(wx, wy, 0, 0, true); sound?.rustle(0.5); }
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault(); hooks.onGesture();
    const [x, y] = local(e), [wx, wy] = toWorld(x, y);
    glide = null;
    setCamera(zoomAbout(camera, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), { x: wx, y: wy }));
  };
  el.stage.addEventListener('pointerdown', down);
  el.stage.addEventListener('pointermove', move);
  el.stage.addEventListener('pointerup', up);
  el.stage.addEventListener('pointercancel', up);
  el.stage.addEventListener('wheel', wheel, { passive: false });

  /* ── the loop ── */
  const ease = (t: number) => t * t * (3 - 2 * t);
  const updatePose = (dt: number) => {
    const next: Pose = { ...REST_POSE, turn: pose.turn };
    if (!reduced) {
      next.swayX = Math.sin(time * 0.42) * 2.6; next.swayY = Math.sin(time * 1.05) * 0.9;
      next.nod = Math.sin(time * 0.5 + 1) * 0.012;
      next.swing = Math.sin(time * 0.6) * 0.12 + Math.sin(time * 1.37) * 0.04;
      if (time > nextFlick) { flickAt = time; nextFlick = time + 5 + Math.random() * 5; }
      if (flickAt >= 0) { const f = (time - flickAt) / 0.5; if (f >= 1) flickAt = -1; else next.ear = -0.2 * Math.sin(Math.PI * f) * (1 - 0.4 * Math.sin(Math.PI * 2 * f)); dirty = true; }
      if (time > nextSwish) { swishAt = time; nextSwish = time + 4 + Math.random() * 6; }
      if (swishAt >= 0) { const f = (time - swishAt) / 1.4; if (f >= 1) swishAt = -1; else next.tail = 0.16 * Math.sin(Math.PI * 2 * f) * (1 - f); }
      if (time > nextPuff && !finale) { const tip = tipWorld(); puffs.push({ x: tip[0], y: tip[1] - 6, born: time }); nextPuff = time + 3.4 + Math.random() * 1.6; }
    }
    if (time > nextBlink) { blinkAt = time; nextBlink = time + 2.6 + Math.random() * 3.6; }
    if (blinkAt >= 0) { const f = (time - blinkAt) / 0.18; if (f >= 1) blinkAt = -1; else next.blink = reduced ? 1 : Math.sin(Math.PI * f); dirty = true; }
    if (finale) {
      const t = time - finale.start, { rise, hold, fall } = FINALE;
      let lift = 0;
      if (reduced) lift = t < rise + hold ? 1 : 0;
      else lift = t < rise ? ease(t / rise) : t < rise + hold ? 1 : t < rise + hold + fall ? 1 - ease((t - rise - hold) / fall) : 0;
      next.lift = lift; next.swing = next.swing * (1 - lift);
      if (!finale.called && t > rise * 0.7) {
        finale.called = true; finale.onCall();
        if (!reduced) { const tip = tipWorld(); puffs.push({ x: tip[0], y: tip[1], born: time }, { x: tip[0] + 10, y: tip[1] - 14, born: time + 0.35 }); }
      }
      if (!finale.ended && t > rise + hold + fall) { finale.ended = true; finale.onEnd(); finale = null; }
      dirty = true;
    }
    while (puffs.length && time - puffs[0].born > PUFF_SECONDS) puffs.shift();
    void dt;
    pose = next;
  };
  const tipWorld = (): Vec => {
    const frames = partFrames(view, pose), line = trunkLine(view, pose);
    const [x, y] = trunkPoint(line, 1, 0, view.mirror);
    return apply(frames.head, [x, y]);
  };
  const placeRings = (frames: ReturnType<typeof partFrames>, line: ReturnType<typeof trunkLine>) => {
    const s = S();
    for (const id of DISCOVERIES) {
      const node = el.rings[id]; if (!node) continue;
      let world: Vec;
      if (id === 'trunk') { const [x, y] = trunkPoint(line, 0.9, 0, view.mirror); world = apply(frames.head, [x, y]); }
      else world = apply(id === 'ears' ? frames.ear : id === 'tusks' ? frames.head : frames.body, view.hotspots[id]);
      const x = (world[0] - camera.x) * s + width / 2, y = (world[1] - camera.y) * s + height / 2;
      const out = x < 6 || y < 6 || x > width - 6 || y > height - 6 || (turning !== null && pose.turn < 0.5);
      node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      node.style.visibility = out ? 'hidden' : '';
    }
  };
  const placeBackdrop = () => {
    const centre = wholeView(view.bounds);
    for (const { node, depth } of el.layers) {
      const z = 1 + (camera.zoom - 1) * depth, cx = centre.x + (camera.x - centre.x) * depth, cy = centre.y + (camera.y - centre.y) * depth;
      node.setAttribute('transform', `translate(${(width / 2).toFixed(1)} ${(height / 2).toFixed(1)}) scale(${(baseScale * z).toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
    }
  };
  const stepFlakes = (dt: number, wind: number) => {
    for (const f of flakes) {
      f.y += f.speed * dt * (0.6 + f.r * 0.25);
      f.x += (wind * 0.035 + Math.sin(time * 0.8 + f.drift) * 0.006) * dt;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      if (f.x > 1.02) f.x -= 1.04;
    }
  };
  let lastCamKey = '';
  const tick = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
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
      camera = clamp(mixCamera(glide.from, glide.to, t)); dirty = true;
      if (t >= 1) { glide = null; hooks.onZoom(camera.zoom); }
    }
    if (turning) {
      const t = (now - turning.start) / TURN_MS;
      if (t >= 0.5 && !turning.swapped) { turning.swapped = true; swapView(); }
      pose.turn = t >= 1 ? 1 : Math.max(0.02, Math.abs(Math.cos(Math.PI * t)));
      if (t >= 1) turning = null;
      dirty = true;
    }
    updatePose(dt);
    stepSprings(dt);
    const wind = reduced ? 0 : windStrength(time);
    if (!reduced) { stepFlakes(dt, wind); dirty = true; }
    if (now - lastAudio > 150) { lastAudio = now; sound?.wind(reduced ? 0.25 : wind); }
    const camKey = `${camera.x.toFixed(2)}:${camera.y.toFixed(2)}:${camera.zoom.toFixed(4)}:${width}:${height}:${viewId}`;
    if (camKey !== lastCamKey) { lastCamKey = camKey; placeBackdrop(); }
    if (!dirty || !ctx || !palette || !inks) return;
    dirty = false;
    const out = drawFrame({ ctx, width, height, dpr, camera, baseScale, view, strands, dyn, tier, time, wind, pose, palette, inks, flakes: reduced ? [] : flakes, puffs });
    placeRings(out.frames, out.trunk);
  };
  const switchTier = (next: Tier) => {
    tier = next; strands = strandsFor(viewId, tier); dyn = makeDynamics(strands.count); grid = buildGrid(strands); trunkRange = rangeOf(strands, 'trunk');
    if (tier === 'light') flakes = flakes.slice(0, 32);
    resize();
  };
  const swapView = () => {
    viewId = viewId === 'side' ? 'turned' : 'side';
    view = mammothView(viewId); strands = strandsFor(viewId, tier); dyn = makeDynamics(strands.count); grid = buildGrid(strands); trunkRange = rangeOf(strands, 'trunk');
    // Close up, keep looking at the same spot on the animal; from afar, show all of it.
    const [x, y] = viewId === 'turned' ? turnPoint([camera.x, camera.y]) : unturnPoint([camera.x, camera.y]);
    camera = clamp(camera.zoom <= 1.01 ? wholeView(view.bounds) : { ...camera, x, y }); dirty = true;
  };
  const start = () => { if (!frame && !disposed) { last = 0; frame = requestAnimationFrame(tick); } };
  const halt = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const visibility = () => { if (document.visibilityState === 'hidden') { halt(); sound?.stop(); } else start(); };
  document.addEventListener('visibilitychange', visibility);
  start();

  return {
    zoomBy(factor) { hooks.onGesture(); const target = glide ? glide.to : camera; glideTo(zoomAbout(target, factor, { x: target.x, y: target.y })); },
    pan(dx, dy) { hooks.onGesture(); glide = null; setCamera({ ...camera, x: camera.x + dx / S(), y: camera.y + dy / S() }); },
    whole() { hooks.onGesture(); glideTo(wholeView(view.bounds)); },
    turn() {
      hooks.onGesture();
      if (turning) return;
      if (reduced) { swapView(); hooks.onZoom(camera.zoom); return; }
      turning = { start: performance.now(), swapped: false };
    },
    view: () => viewId,
    focus(id, avoidBottom) {
      hooks.onGesture();
      const frames = partFrames(view, pose);
      let point: Vec;
      if (id === 'trunk') { const [x, y] = trunkPoint(trunkLine(view, pose), 0.9, 0, view.mirror); point = apply(frames.head, [x, y]); }
      else point = apply(id === 'ears' ? frames.ear : id === 'tusks' ? frames.head : frames.body, view.hotspots[id]);
      const target = focusTarget({ x: point[0], y: point[1] }, view.bounds, half(), MARGIN);
      // Keep the spot above the card that opens over the bottom of the stage.
      glideTo({ ...target, y: target.y + avoidBottom / 2 / (baseScale * target.zoom) });
    },
    comb() {
      hooks.onGesture();
      const [ax, ay] = toWorld(width * 0.2, height * 0.5), [bx] = toWorld(width * 0.8, height * 0.5);
      const steps = 24, dx = (bx - ax) / steps;
      for (let k = 0; k <= steps; k++) { strokeAt(ax + dx * k, ay, dx, 2, false); strokeAt(ax + dx * k, ay + 40 / S(), dx, 2, false); }
      sound?.rustle(0.7);
    },
    finale(onCall, onEnd) { if (finale) return; finale = { start: time, called: false, ended: false, onCall, onEnd }; },
    setReduced(next) { reduced = next; if (reduced && glide) { camera = clamp(glide.to); glide = null; } dirty = true; },
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
export { ZOOM_MAX, ZOOM_MIN };
