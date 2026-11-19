import { createPlaySound, prefersReducedMotion, type CoachMood, type FxKind, type FxOptions } from '../play';
import {
  BUILD_YAW, CATCH_GAP_MS, DANCE_SPEED, GRIP_Y, REST, SETTLE, SETTLE_MS, SPIN_GOAL, SPIN_MAX, SQUEEZE_SPRING, SQUEEZE_STEP, THREAD_MS,
  attitude, benchLayout, catchOrder, coast, complete, dragDegrees, landStart, magnetAt, normRoll, pairSlot, partCentre, partsOf, paintForRound, placeOn, pushFor,
  seamOf, selfRight, sheathFor, shownParts, squeezeBy, touchHeight, PIECES,
  type BuildMode, type LandStep, type Orient, type PieceKind, type Placed,
} from './tinyBuildersRules';
import { DIVE_STOPS, DIVE_THINGS, LAST_DEPTH, REAL_MICROMETRES, ROD, canRecord, clampDepth, decade, depthForZoom, depthLimit, diveCamera, diveStep, pondFor, toScreen, type DiveCamera, type PondLife } from './tinyDive';
import { PHAGE, apply, fibreAngle, frameOf, legPoints, matMul, place, poseAbout, project, rotY, rotZ, sub, unproject, type Frame, type V3, type View } from './tinyMesh';
import { blend, drawGlowRing, drawPhage, drawShadow, drawThread, ink, readPalette, tonesFor, type PhageLook, type Rgb } from './tinyRender';
import { RAIL_Z, drawCue, drawDeck, drawDrop, drawMotes, drawSprite, drawTurntable } from './tinyBench';
import { drawPond, lifeAt } from './tinyPond';
import { ART_AYA, ART_LEAFLAB, ART_PROOFLENS, ART_ROOM, ART_VALLEY, LEAFLAB_CLOSED, ROOM_FLOOR_Y, VALLEY_WORKSHOP, type KitArt } from './tinyKitArt';
import { createTinyLoop } from './tinyLoop';

/** Tiny Structures: the game itself, off React. One canvas, one frame loop,
 * one synth. It owns what moves (parts, turntable, the dive, the landing, the
 * pull-back) and tells the HUD what happened through `hooks`; the HUD and
 * every real button live in TinyBuilders.tsx. Rules come from the pure
 * modules; nothing here is stored or reported. */

export type Phase = 'opening' | 'build' | 'spin' | 'built' | 'toLens' | 'dive' | 'found' | 'land' | 'setPiece' | 'done';
export interface Box { x: number; y: number; w: number; h: number }
export interface Layout { parts: Readonly<Record<string, Box>>; model: Box; aya: Box; lens: Box }
export interface TinyHooks {
  phase(phase: Phase): void;
  placed(placed: Placed): void;
  selected(id: string | null): void;
  found(count: number): void;
  landed(done: readonly LandStep[]): void;
  say(who: 'aya' | 'bebe', mood: CoachMood, key: string, piece?: PieceKind): void;
  notice(key: string | null, arg?: string): void;
  caption(index: number): void;
  canRecord(on: boolean): void;
  layout(layout: Layout): void;
  shake(): void;
  haptic(): void;
  /** A camera push on a big moment (stage fractions and zoom); null goes home. */
  camera(to: { x: number; y: number; zoom: number } | null): void;
  burst(x: number, y: number, kind: FxKind, opts?: FxOptions): void;
  /** Places the transparent button over a thing in the lens view (null hides it). */
  spot(role: 'target' | 'secret' | 'phage', box: Box | null): void;
}
export interface Touch { id: number; x: number; y: number; touch?: boolean }
export interface TinyEngine {
  dispose(): void;
  begin(): void;
  down(t: Touch): void; move(t: Touch): void; up(t: Touch): void; hover(x: number, y: number): void; wheel(deltaY: number): void;
  /** A finger on the bench: picks up the part it is on (the nearest one whose shape it touches). True when it took one. */
  grabAt(t: Touch): boolean;
  grab(id: string, t: Touch): void; tapPart(id: string): void; placeSelected(): void;
  pokeAya(): void; pokeModel(): void; keyTurn(deg: number): void;
  toLens(): void; dive(direction: number): void; record(): void; secret(): void;
  toLand(): void; turn(direction: number): void; lower(): void; squeeze(): void; phageDown(t: Touch): void;
}

const PAD_TOP = 0.42, WHITE: Rgb = [255, 255, 255];
const U = REAL_MICROMETRES.phage / PHAGE.height; // micrometres in one model unit
const EXTENT: Readonly<Record<PieceKind, readonly [number, number]>> = { head: [3.3, 2.5], tail: [3, 1.4], tailCollar: [3.5, 1.6], collar: [1.6, 1.3], baseplate: [2, 1.5], fibres: [6, 3.7], fibrePair: [6, 2.1] };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (u: number) => { const t = clamp(u, 0, 1); return t * t * (3 - 2 * t); };
const smoother = (u: number) => { const t = clamp(u, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const backOut = (u: number) => { const t = clamp(u, 0, 1) - 1; return 1 + t * t * (2.4 * t + 1.4); };
const mixV = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const nearAngle = (from: number, to: number) => to + Math.round((from - to) / 360) * 360;

interface Turn { yaw: number; tipZ: number; tipX: number; spin: number }
interface PartSim {
  id: string; kind: PieceKind; index: number; slot: number;
  rest: { centre: V3; turn: Turn }; centre: V3;
  /** 0 lying on the bench … 1 upright, as it goes on. */
  up: number; lift: number;
  mode: 'fall' | 'rest' | 'held' | 'fly' | 'back' | 'on';
  t: number; from: V3; fallY: number; fallV: number; fallAt: number; squash: number;
}

export function createTinyEngine(canvas: HTMLCanvasElement, options: { mode: BuildMode; seed: number; round: number; hooks: TinyHooks }): TinyEngine {
  const { mode, seed, hooks } = options;
  const ctx = canvas.getContext('2d');
  const pal = readPalette(canvas), sound = createPlaySound({ key: 'D' }), loop = createTinyLoop();
  const modelTones = tonesFor(pal, paintForRound(options.round)), realTones = tonesFor(pal, 'real'), ghostTones = tonesFor(pal, 'ghost');
  const life = pondFor(seed), targetOf = (role: PondLife['role']) => life.find(l => l.role === role)!;
  const load = (art: KitArt) => { const i = new Image(); i.decoding = 'async'; i.src = art.src; return i; };
  const room = load(ART_ROOM), ayaImg = load(ART_AYA), lensImg = load(ART_PROOFLENS), leafImg = load(ART_LEAFLAB), valley = load(ART_VALLEY);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let alive = true;
  const later = (ms: number, run: () => void) => { const t = setTimeout(() => { timers.delete(t); if (alive) run(); }, ms); timers.add(t); };

  let phase: Phase = 'opening', time = 0, w = 0, h = 0, dpr = 1, orient: Orient = 'portrait', laid = false;
  let view: View = { cx: 0, cy: 0, ppu: 20, dist: 150, elev: 30, target: [0, 6, 0] };
  let parX = 0, parY = 0, parTX = 0, parTY = 0, intro = 1, lastTouchX = 0.5;
  const go = (next: Phase) => { phase = next; hooks.phase(next); };
  const fx = (x: number, y: number, kind: FxKind, opts?: FxOptions) => { if (w && h) hooks.burst(x / w, y / h, kind, opts); };

  /* ---------- the bench ---------- */
  let placed: Placed = [], selected: string | null = null;
  let held: { id: string; pointer: number; x: number; y: number; sx: number; sy: number; moved: boolean; touch: boolean; carry: number } | null = null;
  let yaw = BUILD_YAW, spinVel = 0, spinTotal = 0, danced = false, danceUntil = 0;
  let spinDrag: { pointer: number; x: number; startX: number; startY: number; lastT: number; moved: boolean } | null = null;
  let stretch = 1, stretchVel = 0, hop = 0, hopVel = 0, rod = 1, ring = 0, glowKick = 0, rock = 0;
  const flex = [0, 0, 0, 0, 0, 0], seams: { y: number; r: number; t: number }[] = [];
  let ayaHop = 0, ayaHopVel = 0, ayaLean = 0, ayaUp = 0, lensT = 0, iris = 0, idleAt = 0, hintT = -1, hintId: string | null = null;
  const parts: PartSim[] = PIECES[mode].map((piece, index) => ({
    id: piece.id, kind: piece.kind, index, slot: piece.kind === 'fibrePair' ? index - PIECES[mode].findIndex(p => p.kind === 'fibrePair') : 0,
    rest: { centre: [0, 0, 0], turn: { yaw: 0, tipZ: 0, tipX: 0, spin: 0 } }, centre: [0, 0, 0], up: 0, lift: 0, mode: 'fall', t: 0, from: [0, 0, 0], fallY: 16, fallV: 0, fallAt: 0.5 + index * 0.16, squash: 0,
  }));
  const partOf = (id: string) => parts.find(p => p.id === id);
  const site = () => (orient === 'portrait' ? { aya: -6.3, leaf: [6.5, -7.4] as const, lens: [-6.4, -7.6] as const } : { aya: -8.4, leaf: [12, -7.2] as const, lens: [-12.6, -7.4] as const });
  const seatOf = (kind: PieceKind): V3 => [0, PAD_TOP + partCentre(kind)[1], 0];
  const modelFrame = (): Frame => ({ m: rotY(yaw + rock), at: [0, PAD_TOP + hop, 0], scale: 1 });
  const turnOf = (p: PartSim): Turn => {
    const r = p.rest.turn, to = nearAngle(r.yaw, yaw), u = ease(p.up);
    return { yaw: r.yaw + (to - r.yaw) * u, tipZ: r.tipZ * (1 - u), tipX: r.tipX * (1 - u), spin: r.spin * (1 - u) };
  };
  function layParts() {
    const spots = benchLayout(mode, orient, seed);
    for (const p of parts) {
      const s = spots[p.id], r = REST[p.kind];
      p.rest = { centre: [s.x, r.height, s.z], turn: { yaw: s.yaw, tipZ: r.tipZ, tipX: r.tipX, spin: p.kind === 'fibrePair' ? fibreAngle(p.slot) : 0 } };
      if (p.mode === 'rest' || p.mode === 'fall' || !laid) p.centre = p.rest.centre;
    }
    laid = true;
  }
  function boxAt(at: V3, halfW: number, halfH: number, min = 56): { x: number; y: number; w: number; h: number } {
    const s = project(view, at), bw = Math.max(min, halfW * 2 * s.s), bh = Math.max(min, halfH * 2 * s.s);
    return { x: s.x - bw / 2, y: s.y - bh / 2, w: bw, h: bh };
  }
  function publish() {
    if (!w) return;
    const boxes: Record<string, Box> = {}, at = site();
    // Far parts first, so a nearer part's button lies over a farther one's, as the parts do.
    for (const p of [...parts].sort((a, b) => a.rest.centre[2] - b.rest.centre[2])) if (p.mode !== 'on') boxes[p.id] = boxAt(p.rest.centre, EXTENT[p.kind][0], EXTENT[p.kind][1]);
    hooks.layout({
      parts: boxes, model: boxAt([0, 7.6, 0], 5.8, 8.2), aya: boxAt([at.aya, 4.2, RAIL_Z - 0.6], 2.6, 3),
      lens: boxAt([at.lens[0], 0.5, at.lens[1]], 2, 1.5),
    });
  }
  function resize() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch) return;
    w = cw; h = ch; dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const next: Orient = w >= h ? 'landscape' : 'portrait';
    const ppu = next === 'portrait' ? Math.min(h * 0.52 / 13.2, w * 0.84 / 17.8) : Math.min(h * 0.56 / 13.2, w * 0.9 / 43);
    view = { cx: w / 2, cy: h * (next === 'portrait' ? 0.4 : 0.5), ppu, dist: 150, elev: 30, target: [0, 6, 0] };
    if (next !== orient || !laid) { orient = next; layParts(); }
    publish();
  }
  const say: TinyHooks['say'] = (who, mood, key, piece) => hooks.say(who, mood, key, piece);
  const touched = () => { idleAt = time; hintT = -1; };
  function ayaCheer(strength = 1) { ayaHopVel = 9 * strength; }

  function snapDone(p: PartSim) {
    const next = placeOn(mode, placed, p.id); if (!next) { p.mode = 'rest'; return; }
    placed = next; p.mode = 'on'; hooks.placed(placed);
    const seam = seamOf(p.kind), at = project(view, [0, PAD_TOP + seam.y, 0]);
    seams.push({ y: seam.y, r: seam.r, t: 0 }); stretchVel = -2.6; ring = 1; glowKick = 1;
    fx(at.x, at.y, 'sparkle', { tones: ['white', 'sky-pale', 'gold-light'], count: 14 }); fx(at.x, at.y, 'ring', { tones: ['sky-pale'] });
    sound.place(placed.length - 1); hooks.haptic(); ayaCheer(0.7);
    if (selected === p.id) { selected = null; hooks.selected(null); }
    publish();
    if (complete(mode, placed)) later(420, wholeModel); else say('aya', 'happy', 'clicked', p.kind);
  }
  function wholeModel() {
    go('spin'); rod = 0.999; hopVel = 11; stretchVel = 3.2; ring = 1.5; danceUntil = time + 1.3; hooks.shake(); ayaCheer(1.2);
    const at = project(view, [0, PAD_TOP + 7, 0]);
    fx(at.x, at.y, 'sparkle', { tones: ['white', 'gold-light', 'sky-pale'], count: 26 }); fx(at.x, project(view, [0, PAD_TOP, 0]).y, 'ring', { tones: ['sea'] });
    sound.chapter(); say('aya', 'wow', 'standing'); idleAt = time; publish();
    if (!prefersReducedMotion()) { hooks.camera({ x: 0.5, y: 0.4, zoom: 1.16 }); later(1500, () => hooks.camera(null)); }
  }
  function startFly(p: PartSim) { p.mode = 'fly'; p.t = 0; p.from = p.centre; }
  function sendBack(p: PartSim, quiet = false) { p.mode = 'back'; p.t = 0; p.from = p.centre; if (!quiet) { sound.back(); say('aya', 'idle', 'closer'); } }
  function magnetFor(p: PartSim, centre: V3) {
    const seat = project(view, seatOf(p.kind)), here = project(view, centre);
    return magnetAt(mode, Math.hypot(here.x - seat.x, here.y - seat.y) / seat.s);
  }
  function fingerCentre(p: PartSim): V3 {
    if (!held) return p.centre;
    const z = p.rest.centre[2] * (1 - ease(held.carry)), raw = unproject(view, held.x, held.y - (held.touch ? 44 : 10), z);
    return [raw[0], Math.max(REST[p.kind].height, raw[1]), z];
  }

  function tickBench(dt: number) {
    const calm = prefersReducedMotion();
    intro = calm ? 0 : Math.max(0, intro - dt / 2.4);
    ayaUp = Math.min(1, ayaUp + dt / 0.7);
    for (const p of parts) {
      const hot = held?.id === p.id || selected === p.id || p.mode === 'fly';
      p.up = clamp(p.up + (hot ? dt / 0.2 : -dt / 0.3), 0, 1); p.squash = Math.max(0, p.squash - dt * 5);
      if (p.mode === 'fall') {
        if (calm) { p.mode = 'rest'; p.fallY = 0; p.centre = p.rest.centre; continue; }
        if (time < p.fallAt) continue;
        p.fallV += 70 * dt; p.fallY -= p.fallV * dt;
        if (p.fallY <= 0) {
          if (p.fallV > 9) { p.fallY = 0.01; p.fallV = -p.fallV * 0.28; p.squash = 1; const s = project(view, [p.rest.centre[0], 0, p.rest.centre[2]]); fx(s.x, s.y, 'dust', { tones: ['snow', 'steel-light'], count: 6 }); sound.tap(); }
          else { p.fallY = 0; p.mode = 'rest'; }
        }
        p.centre = [p.rest.centre[0], p.rest.centre[1] + Math.max(0, p.fallY), p.rest.centre[2]];
      } else if (p.mode === 'rest') {
        const want = selected === p.id ? 1.7 + 0.25 * Math.sin(time * 3) : hintId === p.id && hintT >= 0 ? 1.1 * Math.sin(Math.min(1, hintT / 0.7) * Math.PI) : 0;
        p.lift += (want - p.lift) * Math.min(1, dt * 12);
        p.centre = [p.rest.centre[0], p.rest.centre[1] + p.lift, p.rest.centre[2]];
      } else if (p.mode === 'held' && held) {
        held.carry = Math.min(1, held.carry + dt / 0.25);
        const finger = fingerCentre(p), magnet = magnetFor(p, finger);
        p.centre = mixV(finger, seatOf(p.kind), magnet.pull * 0.8);
        if (held.moved && Math.random() < dt * 22) { const s = project(view, p.centre); fx(s.x, s.y, 'glint', { tones: ['white', 'sky-pale'], count: 1 }); }
        if (magnet.lock && held.moved) { held = null; startFly(p); }
      } else if (p.mode === 'fly') {
        p.t = calm ? 1 : p.t + dt / 0.2;
        p.centre = mixV(p.from, seatOf(p.kind), backOut(p.t));
        if (p.t >= 1) snapDone(p);
      } else if (p.mode === 'back') {
        p.t = calm ? 1 : p.t + dt / 0.4; const e = ease(p.t);
        p.centre = mixV(p.from, p.rest.centre, e); p.centre = [p.centre[0], p.centre[1] + Math.sin(e * Math.PI) * 1.4, p.centre[2]];
        if (p.t >= 1) { p.mode = 'rest'; p.lift = 0; p.squash = 0.6; }
      }
    }
    // The turntable coasts; the model squashes, hops and settles on springs.
    if (!spinDrag) { const c = coast(spinVel, dt); spinVel = c.velocity; yaw += c.turn; if (phase === 'spin') spinTotal += Math.abs(c.turn); }
    if (phase === 'spin' && spinTotal >= SPIN_GOAL) finishBuild();
    if ((phase === 'spin' || phase === 'built') && !danced && Math.abs(spinVel) > DANCE_SPEED) { danced = true; danceUntil = time + 2; hooks.notice('dance'); [10, 12, 14, 15].forEach((step, i) => sound.note(step, { gain: 0.035, length: 0.3, at: i * 0.09 })); later(2600, () => hooks.notice(null)); }
    stretchVel += (-(stretch - 1) * 300 - stretchVel * 16) * dt; stretch = clamp(stretch + stretchVel * dt, 0.8, 1.2);
    hopVel += (-hop * 190 - hopVel * 13) * dt; hop = Math.max(0, hop + hopVel * dt);
    ayaHopVel += (-ayaHop * 170 - ayaHopVel * 12) * dt; ayaHop = Math.max(0, ayaHop + ayaHopVel * dt);
    ayaLean += (clamp((lastTouchX - 0.3) * 14, -7, 7) - ayaLean) * Math.min(1, dt * 4);
    if (calm) { stretch = 1; stretchVel = 0; hop = 0; hopVel = 0; ayaHop = 0; ayaHopVel = 0; ayaLean = 0; }
    ring = Math.max(0, ring - dt * 1.5); glowKick = Math.max(0, glowKick - dt * 1.4);
    if (rod < 1) rod = Math.max(0, rod - dt / 0.5);
    for (const s of seams) s.t += dt / 0.5;
    while (seams.length && seams[0].t >= 1) seams.shift();
    const whole = complete(mode, placed);
    for (let i = 0; i < 6; i++) {
      const dance = time < danceUntil ? Math.max(0, Math.sin(time * 13 + i * 1.05)) * 0.9 : 0;
      const idle = whole ? Math.max(0, Math.sin(time * 1.3 - i * 0.5)) ** 6 * 0.3 : 0;
      const fling = Math.min(0.5, Math.abs(spinVel) / SPIN_MAX * 1.2);
      flex[i] = calm ? 0 : flex[i] + (Math.max(dance, idle, fling) - flex[i]) * Math.min(1, dt * 14);
    }
    // An idle hint, shown in the world: the next part lifts and a line of light runs to its place.
    rock = 0;
    if (phase === 'build' && !held && !selected && time - idleAt > (hintT < 0 ? 5 : 0)) {
      if (hintT < 0) { hintT = 0; hintId = parts.find(p => p.mode === 'rest')?.id ?? null; }
      hintT += dt; if (hintT > 1.6) { hintT = -1; idleAt = time + 1; }
    } else if (phase === 'spin' && !spinDrag && time - idleAt > 4) {
      const u = (time - idleAt - 4) % 6; if (u < 1.2) rock = Math.sin(u / 1.2 * Math.PI * 2) * 14;
    }
    if (phase === 'toLens') {
      lensT = calm ? 1 : Math.min(1, lensT + dt / 0.95);
      if (lensT >= 1) iris = Math.min(1, iris + dt / (prefersReducedMotion() ? 0.15 : 0.85));
      if (iris >= 1) { go('dive'); sound.ambience('water'); say('bebe', 'curious', 'diveCue'); idleAt = time; }
    }
  }
  function finishBuild() {
    go('built'); ring = 1.5; hopVel = 8; ayaCheer(1.3); hooks.shake(); sound.chapter();
    const at = project(view, [0, PAD_TOP, 0]);
    fx(at.x, at.y, 'ring', { tones: ['sea'] }); fx(at.x, at.y - 6 * view.ppu, 'sparkle', { tones: ['white', 'gold-light', 'sea'], count: 30 });
    say('aya', 'wow', 'spun'); publish();
  }

  function drawRoom() {
    if (!ctx) return;
    const rail = project(view, [0, 1.15, RAIL_Z]).y + 2, scale = Math.max(w / ART_ROOM.width, rail / ROOM_FLOOR_Y) * 1.03;
    ctx.fillStyle = ink(pal.tone('snow')); ctx.fillRect(0, 0, w, h);
    if (room.complete && room.naturalWidth) ctx.drawImage(room, (w - ART_ROOM.width * scale) / 2 - parX * 7, rail - ROOM_FLOOR_Y * scale - parY * 3, ART_ROOM.width * scale, ART_ROOM.height * scale);
  }
  function partLook(p: PartSim, alpha = 1): PhageLook {
    const tones = alpha === 1 ? modelTones : { ...modelTones, alpha };
    return { tones, ...partsOf(p.kind, p.slot), ring: p.kind === 'fibres' || p.kind === 'fibrePair', time, glow: 0.75, stretch: 1 - 0.1 * p.squash };
  }
  function drawBench() {
    if (!ctx) return;
    const at = site(), shadow = pal.tone('shadow');
    // The opening: the camera settles a little closer than it starts.
    const base = view; view = intro > 0 ? { ...base, ppu: base.ppu * (1 + 0.06 * smoother(intro)), cy: base.cy - h * 0.03 * smoother(intro) } : base;
    drawRoom();
    const rise = ease(ayaUp);
    drawSprite(ctx, view, { image: ayaImg }, [at.aya, 1.15 - 5.6 - (1 - rise) * 6 + ayaHop * 1.1, RAIL_Z - 0.6], 6.2, { lean: ayaLean, squash: 1 + Math.min(0.08, ayaHop * 0.05) + 0.012 * Math.sin(time * 1.9) });
    drawDeck(ctx, view, w, h, pal, time);
    // The LeafLab with its drop of pond water, and the ProofLens: on the mat behind the turntable.
    const leaf: V3 = [at.leaf[0], 0, at.leaf[1]], lensRest: V3 = [at.lens[0], 0, at.lens[1]];
    drawShadow(ctx, view, leaf, 2.5, 0.5, shadow);
    const leafBox = drawSprite(ctx, view, { image: leafImg, crop: LEAFLAB_CLOSED }, leaf, 3.5, { baseline: 0.86 });
    const dropAt = project(view, [leaf[0], 1.22, leaf[2] - 0.15]);
    if (leafBox) drawDrop(ctx, dropAt.x, dropAt.y, 0.46 * dropAt.s, pal, phase === 'built' || phase === 'toLens' ? 0.5 + 0.4 * Math.sin(time * 2.4) : 0);
    drawTurntable(ctx, view, pal, { yaw, ring, rod, time });
    // Shadows first, then everything that stands on the bench, far to near.
    const anyOn = placed.length > 0;
    if (anyOn) drawShadow(ctx, view, [0, 0.42, 0.2], 4.6, 0.26, shadow);
    for (const p of parts) if (p.mode !== 'on') drawShadow(ctx, view, [p.centre[0], Math.max(0, p.centre[1] - REST[p.kind].height) * 4, p.centre[2]], EXTENT[p.kind][0] * 0.95, 0.5 / (1 + Math.max(0, p.centre[1] - REST[p.kind].height) * 0.5), shadow);
    const loose = parts.filter(p => p.mode !== 'on').sort((a, b) => a.centre[2] - b.centre[2]);
    const drawPart = (p: PartSim) => drawPhage(ctx, view, frameOf(poseAbout(partCentre(p.kind), p.centre, turnOf(p))), partLook(p));
    for (const p of loose) if (p.centre[2] < 0 && p.mode !== 'held' && p.mode !== 'fly') drawPart(p);
    const frame = modelFrame();
    if (anyOn) drawPhage(ctx, view, frame, { tones: modelTones, ...shownParts(mode, placed), flex, glow: 0.75 + 0.8 * glowKick, time, stretch });
    // The light ghost of the part in hand, at its own place.
    const active = held ? partOf(held.id) : selected ? partOf(selected) : hintT >= 0 && hintId ? partOf(hintId) : undefined;
    if (active && active.mode !== 'fly' && active.mode !== 'on') {
      const pull = held ? magnetFor(active, fingerCentre(active)).pull : 0.2;
      const alpha = (hintT >= 0 && !held && !selected ? 0.3 * Math.sin(Math.min(1, hintT / 1.6) * Math.PI) : 0.3 + 0.4 * pull) * (0.85 + 0.15 * Math.sin(time * 5));
      drawPhage(ctx, view, { ...frame, at: [0, PAD_TOP, 0] }, { tones: { ...ghostTones, alpha }, ...partsOf(active.kind, active.slot), ring: false, time });
      if (hintT >= 0 && !held && !selected) {
        const a = project(view, active.centre), b = project(view, seatOf(active.kind));
        for (let i = 0; i < 7; i++) {
          const u = clamp(hintT * 1.1 - i * 0.07, 0, 1); if (u <= 0 || u >= 1) continue;
          const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 60;
          ctx.fillStyle = ink(blend(pal.tone('sea'), WHITE, 0.5), 0.9 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(x, y, 4.5 - i * 0.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    for (const s of seams) drawGlowRing(ctx, view, frame, s.y, s.r * (1 + s.t * 1.6), blend(pal.tone('sky-pale'), WHITE, 0.6), (1 - s.t) ** 2 * 1.2, 0.2);
    for (const p of loose) if (p.centre[2] >= 0 || p.mode === 'held' || p.mode === 'fly') drawPart(p);
    // The ProofLens: at rest on the mat; then it hops across and hovers over the drop.
    const e = ease(lensT), hover: V3 = [leaf[0], 2.9, leaf[2] + 0.3], lensAt: V3 = [lensRest[0] + (hover[0] - lensRest[0]) * e, hover[1] * e + Math.sin(e * Math.PI) * 5, lensRest[2] + (hover[2] - lensRest[2]) * e];
    drawShadow(ctx, view, [lensAt[0], lensAt[1] * 3, lensAt[2]], 2.5, 0.5 / (1 + lensAt[1] * 0.4), shadow);
    if (e > 0.9) {
      const top = project(view, lensAt), g = ctx.createLinearGradient(0, top.y, 0, dropAt.y);
      g.addColorStop(0, ink(pal.tone('sea'), 0.55)); g.addColorStop(1, ink(pal.tone('sky-pale'), 0.1));
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(top.x - 0.5 * top.s, top.y); ctx.lineTo(top.x + 0.5 * top.s, top.y); ctx.lineTo(dropAt.x + 0.9 * dropAt.s, dropAt.y); ctx.lineTo(dropAt.x - 0.9 * dropAt.s, dropAt.y); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const lensBox = drawSprite(ctx, view, { image: lensImg }, lensAt, 4, { baseline: 0.84, lean: Math.sin(e * Math.PI) * -10 });
    if (phase === 'built' && lensBox) drawCue(ctx, lensBox.x + lensBox.w / 2, lensBox.y + lensBox.h * 0.5, lensBox.w * 0.6, lensBox.h * 0.56, time, pal.tone('studio-signal'));
    drawMotes(ctx, w, h, prefersReducedMotion() ? 0 : time, pal);
    view = base;
    return dropAt;
  }

  /* ---------- the dive ---------- */
  let depth = 0, holdDir = 0, autoTo: number | null = null, found = 0, lastDecade = 0, flash = 0, shimmer = 0, couldRecord = false, secretFound = false, toastAt = -9;
  const moods = new Map<PondLife, number>(), pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const surfaceY = DIVE_STOPS[3].at.y - ROD.width / 2, phageHome = DIVE_STOPS[4].at;
  const gripFrame = (roll: number, turn: number): Frame => { const m = matMul(rotZ(roll), rotY(turn)); return { m, at: sub([0, GRIP_Y, 0], apply(m, [0, GRIP_Y, 0])), scale: 1 }; };
  const lensView = (x: number, y: number, px: number): View => ({ cx: x, cy: y, ppu: px / PHAGE.height, dist: 600, elev: 6, target: [0, GRIP_Y, 0] });
  const landField = () => (orient === 'portrait' ? 0.31 : 0.43);
  function landCamera(): DiveCamera {
    const field = landField(), span = field * h / Math.min(w, h);
    return { x: phageHome.x, y: surfaceY - span * 0.24, field };
  }
  function cameraNow(): DiveCamera {
    const from = diveCamera(depth); if (land.cam <= 0) return from;
    const to = landCamera(), u = smoother(land.cam);
    return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u, field: Math.exp(Math.log(from.field) + (Math.log(to.field) - Math.log(from.field)) * u) };
  }
  function record() {
    if (phase !== 'dive' || !canRecord(depth, found)) return;
    found += 1; hooks.found(found); const thing = DIVE_THINGS[found], target = targetOf(thing);
    flash = 1; moods.set(target, 1.4); autoTo = found; holdDir = 0; couldRecord = false; hooks.canRecord(false);
    const s = toScreen(diveCamera(depth), lifeAt(target, time), Math.min(w, h), w / 2, h / 2);
    fx(s.x, s.y, 'ring', { tones: ['white'] }); fx(s.x, s.y, 'sparkle', { tones: ['white', 'sky-pale', 'gold-light'], count: 16 });
    sound.place(found * 2); sound.breath({ tone: 5200, gain: 0.018, length: 0.1 }); hooks.haptic();
    if (found >= LAST_DEPTH) { go('found'); shimmer = 1; hooks.shake(); if (!prefersReducedMotion()) { hooks.camera({ x: 0.5, y: 0.45, zoom: 1.14 }); later(1600, () => hooks.camera(null)); } later(350, () => sound.chapter()); say('bebe', 'wow', 'fact-phage'); }
    else { say('bebe', 'happy', `fact-${thing}`); if (thing === 'bacterium') later(3200, () => { if (phase === 'dive') { hooks.notice('beyond'); later(5200, () => hooks.notice(null)); } }); }
    idleAt = time;
  }
  function tickDive(dt: number) {
    const limit = depthLimit(found), before = depth;
    if (autoTo != null) { const d = autoTo - depth; depth = Math.abs(d) < 0.01 ? autoTo : depth + Math.sign(d) * Math.min(Math.abs(d), dt * (0.5 + Math.abs(d) * 1.6)); if (depth === autoTo) autoTo = null; }
    else if (holdDir) depth = diveStep(depth, holdDir, dt, limit);
    depth = clampDepth(depth, limit);
    const dec = decade(depth);
    if (dec > lastDecade && phase === 'dive') { hooks.notice('closer', String(10 ** dec)); sound.note(Math.max(0, 10 - dec * 2), { gain: 0.04, length: 0.7 }); const stamp = time; toastAt = stamp; later(1700, () => { if (toastAt === stamp) hooks.notice(null); }); }
    lastDecade = dec;
    if (depth > before && Math.floor(depth * 6) !== Math.floor(before * 6)) sound.breath({ tone: 1400 - depth * 220, gain: 0.012, length: 0.3 });
    const can = phase === 'dive' && canRecord(depth, found) && autoTo == null;
    if (can !== couldRecord) { couldRecord = can; hooks.canRecord(can); if (can) { say('bebe', 'curious', `spot-${DIVE_THINGS[found + 1]}`); sound.pick(); } }
    flash = Math.max(0, flash - dt * 2.6); shimmer = Math.max(0, shimmer - dt / 2.6);
    for (const [one, m] of moods) { if (m <= dt) moods.delete(one); else moods.set(one, m - dt); }
  }
  function drawRealPhage(x: number, y: number, px: number, roll: number, look: Partial<PhageLook>, tint = 0) {
    if (!ctx) return;
    const v = lensView(x, y, px), frame = gripFrame(roll, 0);
    // A soft halo: the thing is lit for the picture, it does not shine by itself.
    ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(x, y, 0, x, y, px * 0.75);
    g.addColorStop(0, ink(pal.tone('sky-pale'), 0.2)); g.addColorStop(1, ink(pal.tone('sky-pale'), 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, px * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    drawPhage(ctx, v, frame, { tones: realTones, glow: 0.9, time, ...look });
    if (tint > 0.02) { ctx.save(); ctx.globalAlpha = Math.min(1, tint); drawPhage(ctx, v, frame, { tones: modelTones, glow: 1.2, time, ...look }); ctx.restore(); }
    return { v, frame };
  }
  function drawLens(camera: DiveCamera, landing: boolean) {
    if (!ctx) return;
    const side = Math.min(w, h);
    drawPond(ctx, w, h, camera, life, time, pal, {
      skip: one => landing && one.role === 'phage',
      mood: one => Math.min(1, moods.get(one) ?? 0),
      phage: (one, x, y, px) => { drawRealPhage(x, y, px, -lifeAt(one, time).turn, { flex: [0, 1, 2, 3, 4, 5].map(i => 0.18 * Math.max(0, Math.sin(time * 1.6 + i + one.phase))) }, one.role === 'phage' ? shimmer : 0); return true; },
    });
    // The thing to record wears the cue; the buttons over it are real ones, placed by the HUD.
    const next = phase === 'dive' && found < LAST_DEPTH ? targetOf(DIVE_THINGS[found + 1]) : null;
    if (next && couldRecord) {
      const s = toScreen(camera, lifeAt(next, time), side, w / 2, h / 2), r = Math.max(34, next.size * s.k * 0.62);
      drawCue(ctx, s.x, s.y, r, r, time, pal.tone('studio-signal'));
      hooks.spot('target', { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 });
    } else hooks.spot('target', null);
    const secret = targetOf('secret'), ss = toScreen(camera, lifeAt(secret, time), side, w / 2, h / 2), sr = secret.size * ss.k * 0.5;
    hooks.spot('secret', phase === 'dive' && !secretFound && sr > 16 && sr < side && ss.x > -sr && ss.x < w + sr && ss.y > -sr && ss.y < h + sr ? { x: ss.x - Math.max(28, sr), y: ss.y - Math.max(28, sr), w: Math.max(56, sr * 2), h: Math.max(56, sr * 2) } : null);
    if (phase === 'dive' && !prefersReducedMotion() && time - idleAt > 3.5 && !holdDir && autoTo == null && !couldRecord) {
      // Press and hold: three slow ripples at the middle.
      for (let i = 0; i < 3; i++) { const u = ((time * 0.6 + i / 3) % 1); ctx.strokeStyle = ink(WHITE, 0.5 * (1 - u)); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(w / 2, h / 2, 14 + u * 46, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (flash > 0.01) { ctx.fillStyle = ink(WHITE, 0.4 * flash); ctx.fillRect(0, 0, w, h); }
  }

  /* ---------- the landing ---------- */
  const land = {
    cam: 0, x: 0, height: 17.9, roll: 0, vy: 0, vroll: 0, tumble: -1, from: { x: 0, roll: 0 }, to: { x: 0, roll: 0 },
    grab: null as null | { pointer: number; dx: number; dy: number; x: number; height: number }, swirl: null as null | { pointer: number; x: number }, done: [] as LandStep[],
    caught: [false, false, false, false, false, false], catching: false, settle: -1, sink: 0, squeeze: 0, floor: 0, pressing: false, third: 0, dna: -1, note: 0, lastSay: 0,
  };
  const mark = (step: LandStep) => { if (!land.done.includes(step)) { land.done = [...land.done, step]; hooks.landed(land.done); } };
  const phagePx = () => REAL_MICROMETRES.phage * Math.min(w, h) / cameraNow().field;
  const phageScreen = () => toScreen(cameraNow(), { x: phageHome.x + land.x * U, y: surfaceY - land.height * U }, Math.min(w, h), w / 2, h / 2);
  function footScreen(i: number) {
    const s = phageScreen(), v = lensView(s.x, s.y, phagePx());
    return project(v, place(gripFrame(land.roll, 0), legPoints(i, land.sink).foot));
  }
  function bounce(kind: 'side' | 'head', contactX: number) {
    land.vy = 13; land.vroll = -Math.sign(normRoll(land.roll) || 1) * (mode === 'assisted' ? 150 : 95); land.grab = null; stretchVel = kind === 'head' ? -2.4 : -1.2;
    const s = phageScreen(), ppu = phagePx() / PHAGE.height;
    fx(s.x + contactX * ppu, s.y + touchHeight(land.roll).height * ppu, 'ring', { tones: ['spring'] }); fx(s.x + contactX * ppu, s.y + touchHeight(land.roll).height * ppu, 'drop', { tones: ['sky-pale', 'white'], count: 8 });
    sound.back(); hooks.haptic(); say('aya', 'curious', kind === 'head' ? 'headOff' : 'sideOff');
  }
  function beginCatch() {
    land.catching = true; land.grab = null; land.swirl = null; land.vy = 0; land.vroll = 0;
    catchOrder(land.roll).forEach((foot, k) => later(k * CATCH_GAP_MS, () => {
      land.caught[foot] = true; const s = footScreen(foot);
      fx(s.x, s.y, 'glint', { tones: ['white', 'spring'], count: 5 }); fx(s.x, s.y, 'ring', { tones: ['spring'] }); sound.place(k); hooks.haptic();
    }));
    later(6 * CATCH_GAP_MS + 250, () => { mark('legs'); say('aya', 'happy', 'legsOn'); land.settle = 0; });
  }
  function tickLand(dt: number) {
    land.cam = Math.min(1, land.cam + dt / 1.1);
    if (land.tumble >= 0) {
      land.tumble = prefersReducedMotion() ? 1 : land.tumble + dt / 1.5; const e = ease(land.tumble);
      land.x = land.from.x + (land.to.x - land.from.x) * e; land.roll = land.from.roll + (land.to.roll - land.from.roll) * e; land.height = 17.9 + Math.sin(e * Math.PI) * 1.2;
      if (land.tumble >= 1) { land.tumble = -1; say('aya', 'idle', 'landCue'); idleAt = time; }
      return;
    }
    stretchVel += (-(stretch - 1) * 300 - stretchVel * 16) * dt; stretch = clamp(stretch + stretchVel * dt, 0.8, 1.2);
    if (!land.done.includes('legs')) {
      if (land.catching) { land.roll += (0 - land.roll) * Math.min(1, dt * 7); land.height += (GRIP_Y - land.height) * Math.min(1, dt * 9); return; }
      land.height += land.vy * dt; land.vy *= Math.exp(-3.5 * dt); land.roll = normRoll(land.roll + land.vroll * dt); land.vroll *= Math.exp(-3 * dt);
      const gap = land.height - touchHeight(land.roll).height;
      land.roll = selfRight(land.roll, gap, mode, dt);
      if (land.grab) { land.x += (land.grab.x - land.x) * Math.min(1, dt * 14); land.height += (land.grab.height - land.height) * Math.min(1, dt * 14); }
      else { land.height += Math.sin(time * 0.9) * 0.25 * dt; land.x += Math.cos(time * 0.7) * 0.2 * dt; }
      land.x = clamp(land.x, -8, 8); land.height = Math.min(21, land.height);
      const touch = touchHeight(land.roll);
      if (land.height <= touch.height && land.vy <= 0.5) {
        land.height = touch.height;
        const how = attitude(land.roll);
        if (how === 'legs') beginCatch(); else bounce(how, touch.x);
      }
      return;
    }
    if (land.settle >= 0 && land.settle < 1) {
      land.settle = Math.min(1, land.settle + dt * 1000 / SETTLE_MS); land.sink = SETTLE * ease(land.settle);
      if (land.settle >= 1) {
        mark('pad'); stretchVel = -1.6; hooks.shake(); sound.note(0, { gain: 0.06, length: 0.8 }); sound.breath({ tone: 260, gain: 0.03, length: 0.4 });
        const s = phageScreen(); fx(s.x, s.y + GRIP_Y * phagePx() / PHAGE.height, 'ring', { tones: ['spring'] });
        say('aya', 'happy', 'padOn'); later(1500, () => { if (!land.done.includes('squeeze')) say('aya', 'idle', 'squeezeCue'); });
      }
      return;
    }
    if (land.done.includes('pad') && !land.done.includes('squeeze')) {
      land.squeeze = land.pressing ? squeezeBy(land.squeeze, dt * 0.8) : Math.max(land.floor, squeezeBy(land.squeeze, -dt * SQUEEZE_SPRING));
      const third = Math.floor(land.squeeze * 3 + 0.001);
      if (third > land.third) { hooks.haptic(); sound.note(4 + third * 2, { gain: 0.04, length: 0.25 }); }
      land.third = third;
      if (land.squeeze >= 1) {
        mark('squeeze'); land.pressing = false; hooks.shake(); sound.place(8); sound.breath({ tone: 700, gain: 0.03, length: 0.25 });
        const s = phageScreen(), y = s.y + GRIP_Y * phagePx() / PHAGE.height; fx(s.x, y, 'ring', { tones: ['white'] }); fx(s.x, y, 'sparkle', { tones: ['white', 'spring'], count: 10 });
        say('aya', 'wow', 'squeezed'); later(900, () => { land.dna = 0; say('aya', 'curious', 'thread'); });
      }
      return;
    }
    if (land.dna >= 0 && land.dna < 1) {
      land.dna = Math.min(1, land.dna + dt * 1000 / THREAD_MS);
      const n = Math.floor(land.dna * 7); if (n > land.note) { land.note = n; sound.note(5 + n, { gain: 0.035, length: 0.5 }); }
      if (land.dna >= 1) { mark('thread'); sound.chapter(); hooks.haptic(); say('aya', 'happy', 'landed'); later(1900, startSetPiece); }
    }
  }
  function drawLanding(camera: DiveCamera, alpha = 1) {
    if (!ctx) return;
    const side = Math.min(w, h), s = toScreen(camera, { x: phageHome.x + land.x * U, y: surfaceY - land.height * U }, side, w / 2, h / 2), px = REAL_MICROMETRES.phage * s.k;
    if (px < 2.5) return;
    const feel = land.done.includes('legs') ? 0 : clamp(1 - (land.height - touchHeight(land.roll).height) / 6, 0, 1);
    const look: Partial<PhageLook> = { sink: land.sink, sheath: sheathFor(land.squeeze), dna: Math.max(0, land.dna), stretch, glow: 0.9 + (land.dna > 0 && land.dna < 1 ? 0.6 : 0), flex: [0, 1, 2, 3, 4, 5].map(i => (land.caught[i] ? 0 : 0.2 * Math.max(0, Math.sin(time * (1.6 + 5 * feel) + i)) * (1 + feel))) };
    ctx.save(); ctx.globalAlpha = alpha;
    const drawn = drawRealPhage(s.x, s.y, px, land.roll, look);
    if (drawn) {
      drawThread(ctx, drawn.v, drawn.frame, { tones: realTones, ...look }, time);
      // Each foot that has taken hold glows where it grips.
      for (let i = 0; i < 6; i++) if (land.caught[i]) { const f = project(drawn.v, place(drawn.frame, legPoints(i, land.sink).foot)), r = px * 0.045; ctx.save(); ctx.globalCompositeOperation = 'screen'; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 2.4); g.addColorStop(0, ink(WHITE, 0.9)); g.addColorStop(0.4, ink(pal.tone('spring'), 0.6)); g.addColorStop(1, ink(pal.tone('spring'), 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
    ctx.restore();
    if (phase === 'land') {
      hooks.spot('phage', { x: s.x - Math.max(40, px * 0.42), y: s.y - Math.max(40, px * 0.55), w: Math.max(80, px * 0.84), h: Math.max(80, px * 1.1) });
      const waiting = land.tumble < 0 && time - idleAt > 3 && !land.grab && !land.swirl && !prefersReducedMotion();
      if (waiting && !land.done.includes('legs') && !land.catching) {
        // The swirl: two arcs of light that turn the way the water would turn it.
        const dir = -Math.sign(normRoll(land.roll) || 1), spin = time * 2.2 * dir;
        ctx.strokeStyle = ink(WHITE, 0.55); ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const a of [0, Math.PI]) { ctx.beginPath(); ctx.arc(s.x, s.y, px * 0.62, spin + a, spin + a + 1.1 * dir, dir < 0); ctx.stroke(); }
      } else if (waiting && land.done.includes('pad') && !land.done.includes('squeeze') && !land.pressing) {
        const u = (time * 0.8) % 1, y = s.y - px * 0.36; ctx.strokeStyle = ink(WHITE, 0.7 * (1 - u)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, y, 12 + u * 30, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  /* ---------- the pull-back ---------- */
  const sp = { t: -1, caption: -1, depth: LAST_DEPTH, cheer: false };
  function startSetPiece() {
    if (phase !== 'land') return;
    go('setPiece'); hooks.spot('phage', null); sp.t = 0; sp.depth = LAST_DEPTH; sound.setPiece(); danceUntil = 0; rod = 0; yaw = BUILD_YAW; spinVel = 0; lensT = 1; intro = 0;
  }
  function tickSetPiece(dt: number) {
    sp.t += dt;
    const t = sp.t, cap = t < 2.7 ? 0 : t < 4.7 ? 1 : t < 7.5 ? 2 : t < 9.2 ? 3 : 4;
    if (cap !== sp.caption) { sp.caption = cap; hooks.caption(cap); if (cap > 0) sound.note(8 - cap, { gain: 0.03, length: 0.9 }); }
    land.cam = 1 - ease((t - 0.9) / 0.8);
    const u = smoother((t - 1.6) / 5.4);
    sp.depth = prefersReducedMotion() ? Math.round(LAST_DEPTH * (1 - u)) : LAST_DEPTH * (1 - u);
    if (t > 7 && !sp.cheer) { sp.cheer = true; danceUntil = time + 1.8; hopVel = 9; ayaCheer(1.4); sound.ambience('hall'); const at = project(view, [0, PAD_TOP + 7, 0]); fx(at.x, at.y, 'sparkle', { tones: ['white', 'gold-light', 'sea'], count: 24 }); }
    if (t > 7) tickBench(dt);
    if (t >= 12.6) { go('done'); }
  }
  function drawValley(zoom: number, alpha: number) {
    if (!ctx || !valley.complete || !valley.naturalWidth) { if (ctx) { ctx.fillStyle = ink(pal.tone('sky-pale'), alpha); ctx.fillRect(0, 0, w, h); } return; }
    const scale = Math.max(w / ART_VALLEY.width, h / ART_VALLEY.height) * zoom, iw = ART_VALLEY.width * scale, ih = ART_VALLEY.height * scale;
    const wide = w >= h, k = clamp((zoom - 1) / 1.6, 0, 1), fx0 = VALLEY_WORKSHOP[0] * k + (wide ? 0.5 : 0.43) * (1 - k), fy0 = VALLEY_WORKSHOP[1] * k + 0.5 * (1 - k);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(valley, clamp(w / 2 - fx0 * iw, w - iw, 0), clamp(h / 2 - fy0 * ih, h - ih, 0), iw, ih);
    ctx.restore();
  }
  function drawSetPiece() {
    if (!ctx) return;
    const t = sp.t, reduced = prefersReducedMotion();
    if (t < 7) { const camera = (() => { const save = depth; depth = sp.depth; const c = cameraNow(); depth = save; return c; })(); drawLens(camera, true); drawLanding(camera, 1); return; }
    if (t < 8.9) {
      // Out through the lens: the drop is one bright bead on the LeafLab again.
      const dropAt = drawBench(); if (!dropAt) return;
      const u = reduced ? 1 : ease((t - 7) / 1.1), r = Math.hypot(w, h) * (1 - u);
      if (r > 1) { ctx.save(); ctx.beginPath(); ctx.arc(dropAt.x, dropAt.y, r, 0, Math.PI * 2); ctx.clip(); drawLens(diveCamera(0), true); ctx.restore(); lensRim(dropAt.x, dropAt.y, r); }
      return;
    }
    // Up and away: the bench falls back into Wonderworks, in Horizon Valley.
    const u = ease((t - 8.9) / 2.2);
    drawValley(reduced ? 1 : 2.6 - 1.6 * u, 1);
    if (u < 1) {
      // The room dissolves into the valley it stands in while the camera keeps rising.
      ctx.save(); ctx.globalAlpha = 1 - ease(u * 1.7); drawBench(); ctx.restore();
    }
  }
  function lensRim(x: number, y: number, r: number) {
    if (!ctx) return;
    ctx.strokeStyle = ink(pal.tone('graphite'), 0.92); ctx.lineWidth = Math.max(6, Math.min(w, h) * 0.03); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ink(pal.tone('sea'), 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r - Math.min(w, h) * 0.018), 0, Math.PI * 2); ctx.stroke();
  }

  /* ---------- one frame ---------- */
  function frame(dt: number) {
    if (!alive || !ctx) return false;
    if (!w || !h) { resize(); if (!w || !h) return true; }
    time += dt;
    parX += (parTX - parX) * Math.min(1, dt * 5); parY += (parTY - parY) * Math.min(1, dt * 5);
    if (phase === 'dive' || phase === 'found') tickDive(dt);
    else if (phase === 'land') { tickDive(dt); tickLand(dt); }
    else if (phase === 'setPiece') tickSetPiece(dt);
    else if (phase !== 'done') tickBench(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (phase === 'done') return true;
    if (phase === 'setPiece') drawSetPiece();
    else if (phase === 'dive' || phase === 'found') drawLens(diveCamera(depth), false);
    else if (phase === 'land') { const camera = cameraNow(); drawLens(camera, true); drawLanding(camera); }
    else {
      const dropAt = drawBench();
      if (phase === 'toLens' && iris > 0 && dropAt) {
        const r = Math.hypot(w, h) * ease(iris);
        ctx.save(); ctx.beginPath(); ctx.arc(dropAt.x, dropAt.y, r, 0, Math.PI * 2); ctx.clip(); drawLens(diveCamera(0), false); ctx.restore(); lensRim(dropAt.x, dropAt.y, r);
      }
    }
    return true;
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  resize();
  loop.run('frame', dt => frame(dt));

  /* ---------- what the child does ---------- */
  const awake = () => { if (phase === 'dive' || phase === 'found' || phase === 'land') sound.ambience('water'); else sound.ambience('hall'); };
  function grab(id: string, t: Touch) {
    const p = partOf(id); if (!p || phase !== 'build' || held || (p.mode !== 'rest' && p.mode !== 'back') || parts.some(q => q.mode === 'fly')) return;
    awake(); touched(); lastTouchX = t.x / Math.max(1, w);
    if (p.kind === 'fibrePair') { p.slot = pairSlot(mode, placed, p.id); }
    held = { id, pointer: t.id, x: t.x, y: t.y, sx: t.x, sy: t.y, moved: false, touch: !!t.touch, carry: 0 };
    p.mode = 'held'; sound.pick(); hooks.haptic(); say('aya', 'curious', 'picked', p.kind);
    const s = project(view, p.centre); fx(s.x, s.y, 'glint', { tones: ['white', 'sky-pale'], count: 4 });
  }
  function release() {
    if (!held) return; const p = partOf(held.id), was = held, pull = p ? magnetFor(p, fingerCentre(p)).pull : 0; held = null; if (!p || p.mode !== 'held') return;
    if (!was.moved) {
      // A tap, not a drag: the part hovers, picked; a second tap (or a tap on the model) puts it on.
      p.mode = 'rest';
      if (selected === p.id) { startFly(p); } else { selected = p.id; hooks.selected(p.id); }
      return;
    }
    if (pull > 0) startFly(p); else sendBack(p);
  }
  /** Which loose part a point on the screen is on: the one whose middle is nearest, each measured in its own size, so a small part beside a big one is still easy to take. */
  function partAt(x: number, y: number): PartSim | undefined {
    let best: PartSim | undefined, least = 1.2;
    for (const p of parts) {
      if (p.mode !== 'rest' && p.mode !== 'back') continue;
      const s = project(view, p.centre), d = Math.hypot((x - s.x) / Math.max(30, EXTENT[p.kind][0] * s.s), (y - s.y) / Math.max(30, EXTENT[p.kind][1] * s.s));
      if (d < least) { least = d; best = p; }
    }
    return best;
  }
  function placeSelected() { const p = selected ? partOf(selected) : undefined; if (p && p.mode === 'rest' && phase === 'build') { awake(); touched(); if (p.kind === 'fibrePair') p.slot = pairSlot(mode, placed, p.id); startFly(p); } }

  return {
    dispose() { alive = false; loop.stop(); sound.dispose(); observer?.disconnect(); timers.forEach(clearTimeout); timers.clear(); },
    begin() { if (phase !== 'opening') return; go('build'); idleAt = time - 3.4; say('aya', 'idle', 'buildCue'); for (const p of parts) if (p.mode === 'fall') p.fallAt = Math.min(p.fallAt, time + p.index * 0.05); },
    hover(x, y) { if (w && h) { parTX = clamp(x / w * 2 - 1, -1, 1); parTY = clamp(y / h * 2 - 1, -1, 1); } },
    grab, placeSelected,
    grabAt(t) { const p = phase === 'build' && !held ? partAt(t.x, t.y) : undefined; if (!p) return false; grab(p.id, t); return held?.id === p.id; },
    tapPart(id) {
      const p = partOf(id); if (!p || phase !== 'build' || p.mode !== 'rest') return;
      awake(); touched();
      if (selected === id) { placeSelected(); return; }
      selected = id; hooks.selected(id); if (p.kind === 'fibrePair') p.slot = pairSlot(mode, placed, p.id); sound.pick(); hooks.haptic(); say('aya', 'curious', 'picked', p.kind);
    },
    down(t) {
      awake(); touched(); lastTouchX = t.x / Math.max(1, w); pointers.set(t.id, { x: t.x, y: t.y });
      if (phase === 'build') { const p = partAt(t.x, t.y); if (p && !held) grab(p.id, t); else if (selected) placeSelected(); return; }
      if (phase === 'spin' || phase === 'built') { spinDrag = { pointer: t.id, x: t.x, startX: t.x, startY: t.y, lastT: time, moved: false }; spinVel = 0; return; }
      if (phase === 'dive') {
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); holdDir = 0; return; }
        if (prefersReducedMotion()) { depth = Math.min(depthLimit(found), Math.floor(depth + 1e-6) + 1); } else { holdDir = 1; autoTo = null; }
        return;
      }
      if (phase === 'land' && land.tumble < 0) {
        if (land.done.includes('pad') && !land.done.includes('squeeze')) { land.pressing = true; return; }
        if (!land.done.includes('legs') && !land.catching) land.swirl = { pointer: t.id, x: t.x };
      }
    },
    move(t) {
      lastTouchX = t.x / Math.max(1, w); if (pointers.has(t.id)) pointers.set(t.id, { x: t.x, y: t.y });
      if (held && held.pointer === t.id) { held.x = t.x; held.y = t.y; if (Math.hypot(t.x - held.sx, t.y - held.sy) > 8) held.moved = true; return; }
      if (spinDrag && spinDrag.pointer === t.id) {
        const dx = t.x - spinDrag.x, deg = dragDegrees(dx, view.ppu), dt = Math.max(0.008, time - spinDrag.lastT);
        if (Math.abs(t.x - spinDrag.startX) > 6) spinDrag.moved = true;
        yaw += deg; if (phase === 'spin') spinTotal += Math.abs(deg); spinVel = spinVel * 0.5 + (deg / dt) * 0.5; spinDrag.x = t.x; spinDrag.lastT = time;
        if (Math.abs(deg) > 2.5 && Math.floor(yaw / 30) !== Math.floor((yaw - deg) / 30)) sound.tap();
        return;
      }
      if (phase === 'dive' && pointers.size === 2 && pinch > 0) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0) { depth = depthForZoom(depth, d / pinch, depthLimit(found)); pinch = d; autoTo = null; }
        return;
      }
      if (phase === 'land') {
        if (land.grab && land.grab.pointer === t.id) {
          const camera = cameraNow(), k = Math.min(w, h) / camera.field;
          land.grab.x = (camera.x + (t.x + land.grab.dx - w / 2) / k - phageHome.x) / U;
          land.grab.height = (surfaceY - (camera.y + (t.y + land.grab.dy - h / 2) / k)) / U; land.vy = 0;
        } else if (land.swirl && land.swirl.pointer === t.id) {
          const dx = t.x - land.swirl.x; land.swirl.x = t.x; land.vroll = clamp(land.vroll - dx * 9, -420, 420);
          if (Math.abs(dx) > 3 && Math.random() < 0.3) fx(t.x, t.y, 'drop', { tones: ['white', 'sky-pale'], count: 1 });
        }
      }
    },
    up(t) {
      pointers.delete(t.id); if (pointers.size < 2) pinch = 0;
      if (held && held.pointer === t.id) { release(); return; }
      if (spinDrag && spinDrag.pointer === t.id) {
        const tap = !spinDrag.moved, at = { x: spinDrag.startX, y: spinDrag.startY }; spinDrag = null; idleAt = time;
        if (tap) { spinVel = 0; pokeAt(at.x, at.y); } else spinVel = clamp(spinVel, -SPIN_MAX, SPIN_MAX);
        return;
      }
      if (phase === 'dive') { holdDir = 0; idleAt = time; return; }
      if (phase === 'land') { if (land.grab?.pointer === t.id) land.grab = null; if (land.swirl?.pointer === t.id) land.swirl = null; land.pressing = false; idleAt = time; }
    },
    wheel(deltaY) { if (phase === 'dive') { awake(); touched(); autoTo = null; depth = depthForZoom(depth, Math.exp(-deltaY * 0.0022), depthLimit(found)); } },
    pokeAya() { awake(); ayaCheer(1.2); sound.note(9 + Math.floor(Math.random() * 4), { gain: 0.04, length: 0.3 }); hooks.haptic(); say('aya', 'happy', Math.random() < 0.5 ? 'ayaPoke1' : 'ayaPoke2'); },
    pokeModel() { pokeAt(view.cx, view.cy - 4 * view.ppu); },
    keyTurn(deg) { if (phase !== 'spin' && phase !== 'built') return; awake(); touched(); spinVel = pushFor(deg); sound.tap(); },
    toLens() { if (phase !== 'built') return; awake(); go('toLens'); lensT = 0; iris = 0; sound.pick(); say('bebe', 'happy', 'lensLine'); hooks.haptic(); },
    dive(direction) {
      if (phase !== 'dive') return; awake(); touched();
      const limit = depthLimit(found), to = direction > 0 ? Math.min(limit, Math.floor(depth + 1e-6) + 1) : Math.max(0, Math.ceil(depth - 1e-6) - 1);
      if (prefersReducedMotion()) depth = to; else autoTo = to; sound.tap();
    },
    record,
    secret() {
      if (secretFound || phase !== 'dive') return; secretFound = true; const one = targetOf('secret'); moods.set(one, 3);
      const s = toScreen(diveCamera(depth), lifeAt(one, time), Math.min(w, h), w / 2, h / 2);
      fx(s.x, s.y, 'sparkle', { tones: ['white', 'gold-light', 'blossom'], count: 22 }); sound.chapter(); hooks.haptic(); hooks.spot('secret', null);
      say('bebe', 'wow', one.kind === 'waterBear' ? 'secretBear' : 'secretWheel');
    },
    toLand() {
      if (phase !== 'found') return; awake(); go('land'); const one = targetOf('phage'), here = lifeAt(one, time), start = landStart(seed, mode);
      land.x = (here.x - phageHome.x) / U; land.roll = normRoll(-here.turn); land.from = { x: land.x, roll: land.roll }; land.to = { x: start.x, roll: start.roll }; land.tumble = 0; land.height = 17.9;
      sound.breath({ tone: 900, gain: 0.03, length: 0.8 }); say('aya', 'curious', 'tumble'); hooks.canRecord(false);
      later(5200, () => { if (phase === 'land') { hooks.notice('only'); later(5200, () => hooks.notice(null)); } });
    },
    phageDown(t) {
      if (phase !== 'land' || land.tumble >= 0) return; awake(); touched(); pointers.set(t.id, { x: t.x, y: t.y });
      if (land.done.includes('pad') && !land.done.includes('squeeze')) { land.pressing = true; return; }
      if (land.done.includes('legs') || land.catching) return;
      const s = phageScreen(); land.grab = { pointer: t.id, dx: s.x - t.x, dy: s.y - t.y, x: land.x, height: land.height }; sound.pick(); hooks.haptic();
    },
    turn(direction) { if (phase === 'land' && land.tumble < 0 && !land.catching && !land.done.includes('legs')) { awake(); touched(); land.vroll = clamp(land.vroll + direction * 130, -420, 420); sound.tap(); } },
    lower() { if (phase === 'land' && land.tumble < 0 && !land.catching && !land.done.includes('legs')) { awake(); touched(); land.vy = -9; sound.tap(); } },
    squeeze() { if (phase === 'land' && land.done.includes('pad') && !land.done.includes('squeeze')) { awake(); touched(); land.floor = squeezeBy(land.floor, SQUEEZE_STEP); land.squeeze = Math.max(land.squeeze, land.floor); sound.tap(); } },
  };

  /** A tap on the finished model: each part answers. */
  function pokeAt(x: number, y: number) {
    if (phase !== 'spin' && phase !== 'built') return;
    const head = project(view, [0, PAD_TOP + PHAGE.head.y0, 0]).y, base = project(view, [0, PAD_TOP + PHAGE.base.y1 + 0.6, 0]).y;
    if (Math.abs(x - view.cx) > 6.4 * view.ppu || y < project(view, [0, PAD_TOP + PHAGE.height + 1, 0]).y || y > project(view, [0, 0, 6]).y) return;
    hooks.haptic();
    if (y < head) { glowKick = 1.4; stretchVel = 1.4; sound.note(12, { gain: 0.04, length: 0.6 }); fx(x, y, 'glint', { tones: ['white', 'gold-light'], count: 6 }); say('aya', 'curious', 'toyHead'); }
    else if (y < base) { stretchVel = -2.4; sound.note(7, { gain: 0.04, length: 0.3 }); sound.note(9, { gain: 0.03, length: 0.3, at: 0.09 }); say('aya', 'curious', 'toyTail'); }
    else { danceUntil = time + 0.9; sound.note(5, { gain: 0.04, length: 0.25 }); say('aya', 'happy', 'toyLegs'); }
  }
}
