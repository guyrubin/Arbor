/** The glassworks scene: one canvas that is the whole world of Bottle Lab.
 * Glass Grove's pavilion and the bench are two kit plates under one camera;
 * everything else (the glow pad, the bottle, its light on the bench and the
 * walls, the discs, the sticker card, Aya, the can) is placed in that same
 * camera, so nothing floats. The scene owns everything physical (the soft
 * glass, the turn, the rub, what is carried) and every touch; the component
 * above it owns the arc and the words. It never waits on an animation: play
 * moves on timers and state. */
import { selectionHaptic } from '../../../../../../lib/native';
import type { FxKind, FxOptions, PlayFxHandle } from '../play';
import { DISC_CENTRE, KIT_AYA, KIT_CAN, KIT_DISCS, KIT_PLATE, STICKER_PRINT, type KitPicture } from './bottleKit';
import { BOTTLE_TINTS, TURN_STEP, dragTurn, freshBottle, peelSticker, placeSticker, slotView, snapRotation, stickersFull, type BottleCreation, type BottleSticker, type BottleStickerPlacement, type BottleTint } from './bottleLabRules';
import { createGlass, type GlassFrame, type Rgb } from './glassRender';
import type { GlassSound } from './glassSound';
import {
  ARCH_STEPS, FINALE_FILL, HINT_AGAIN_MS, HINT_FIRST_MS, PLATE, SOAK_MS, archSecret, benchScale, blendedProfile, dropSlot, finalePose, frostShown, hintFor, mixWeights, nextFreeSlot, nextShape,
  noDeeds, oneShape, otherFinish, plateRow, profileRadius, pullLean, pullShape, pullStretch, ringRatio, ringStep, rubFade, rubStep, settleShape, soakFront, stageLayout, turnToFree,
  type Act, type BlendedProfile, type Deeds, type FinalePose, type HintId, type Sitting, type StageLayout, type Weights,
} from './glassworks';

export type SayId = 'pulled' | 'tall' | 'round' | 'flask' | 'tinted' | 'frosted' | 'polished' | 'stuck' | 'full' | 'peeled' | 'turned' | 'rang' | 'aya' | 'arch' | 'secret' | 'behind' | 'light';
export type SceneEvent =
  | { type: 'bottle'; bottle: BottleCreation }
  | { type: 'deed'; deed: keyof Deeds }
  | { type: 'say'; say: SayId }
  | { type: 'spots' }
  /** A big moment: the stage may shake once. */
  | { type: 'beat' }
  | { type: 'free' };
export type Command =
  | { do: 'shape'; dir?: 'up' | 'down' | 'side' } | { do: 'ring' } | { do: 'disc'; tint: BottleTint } | { do: 'finish' } | { do: 'stickOn'; art: BottleSticker }
  | { do: 'peel'; slot: number } | { do: 'turn'; by: number } | { do: 'aya' } | { do: 'arch'; index: number } | { do: 'light'; by: number };
export interface Box { x: number; y: number; width: number; height: number }
export interface SceneSpots { bottle: Box; aya: Box; stickers: { slot: number; art: BottleSticker; x: number; y: number; size: number }[] }
export interface GlassScene {
  resize(width: number, height: number): void;
  setAct(act: Act): void;
  down(clientX: number, clientY: number, id: number): void;
  move(clientX: number, clientY: number, id: number): void;
  up(clientX: number, clientY: number, id: number): void;
  cancel(): void;
  command(command: Command): void;
  layout(): StageLayout;
  bottle(): BottleCreation;
  spots(): SceneSpots;
  dispose(): void;
}
export interface SceneDeps {
  canvas: HTMLCanvasElement;
  fx: () => PlayFxHandle | null;
  sound: GlassSound;
  emit: (event: SceneEvent) => void;
  sitting: Sitting;
  reduced: () => boolean;
  /** A kept bottle to start from (the child's own, reopened), or nothing. */
  start?: BottleCreation | null;
}

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
const backOut = (t: number) => { const c = clamp(t, 0, 1) - 1; return 1 + c * c * (2.7 * c + 1.7); };

/** A palette token as numbers. The canvas has no colour of its own: every
 * one is read from the makers' palette (or the Studio tokens) at run time. */
function token(style: CSSStyleDeclaration, name: string): Rgb {
  const raw = style.getPropertyValue(name).trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(raw)?.[1];
  if (!hex) return [255, 255, 255];
  const full = hex.length <= 4 ? [...hex].map(c => c + c).join('') : hex;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const HEX = Array.from({ length: 256 }, (_, n) => n.toString(16).padStart(2, '0'));
const byte = (v: number) => HEX[v <= 0 ? 0 : v >= 255 ? 255 : v | 0];
/** A resolved palette colour with an alpha, as the canvas takes it (eight hex digits, worked out here). */
const ink = (c: Rgb, alpha = 1) => `#${byte(c[0])}${byte(c[1])}${byte(c[2])}${byte(alpha * 255 + 0.5)}`;

interface Spring { v: number; vel: number }
function spring(s: Spring, target: number, k: number, c: number, dt: number) {
  let left = dt;
  while (left > 1e-5) { const h = Math.min(left, 1 / 120); left -= h; s.vel += (k * (target - s.v) - c * s.vel) * h; s.v += s.vel * h; }
}

type Gesture =
  | { kind: 'shape'; id: number; x0: number; y0: number; moved: boolean; from: Weights; span: number; last: string }
  | { kind: 'disc'; id: number; x0: number; y0: number; moved: boolean; tint: BottleTint; ox: number; oy: number }
  | { kind: 'rub'; id: number; x: number; y: number; far: number; done: boolean; trail: number }
  | { kind: 'carry'; id: number; x0: number; y0: number; moved: boolean; art: BottleSticker }
  | { kind: 'turn'; id: number; x0: number; rot0: number; moved: boolean; slot: number | null; notch: number }
  | { kind: 'light'; id: number; x0: number; moved: boolean; note: number }
  | { kind: 'toy'; id: number };

interface DiscState { tint: BottleTint; x: number; y: number; lift: number; under: boolean }
interface Flying { art: BottleSticker; x0: number; y0: number; slot: number | null; t: number; x1?: number; y1?: number }
interface Mote { x: number; y: number; r: number; speed: number; phase: number }
interface Bubble { u: number; v: number; r: number; speed: number; phase: number }

export function createGlassScene(deps: SceneDeps): GlassScene | null {
  const { canvas, sound, emit, sitting } = deps;
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return null;
  const glass = createGlass();
  const style = getComputedStyle(canvas);
  const C = {
    white: token(style, '--mk-white'), snow: token(style, '--mk-snow'), shadow: token(style, '--mk-shadow'), ink: token(style, '--mk-ink'), slate: token(style, '--mk-slate'),
    sky: token(style, '--mk-sky-pale'), skyDeep: token(style, '--mk-sky'), sun: token(style, '--mk-sun'), butter: token(style, '--mk-butter'), orange: token(style, '--mk-orange'), amber: token(style, '--mk-amber'),
    sea: token(style, '--mk-sea'), celadon: token(style, '--mk-celadon'), teal: token(style, '--mk-teal'), rose: token(style, '--mk-rose'), blossom: token(style, '--mk-blossom'), roseDeep: token(style, '--mk-rose-deep'),
    poppy: token(style, '--mk-poppy'), water: token(style, '--mk-water'), lilac: token(style, '--mk-lilac'), wood: token(style, '--mk-wood-light'), woodDark: token(style, '--mk-wood'),
    indigo: token(style, '--mk-indigo'), pearl: token(style, '--studio-pearl'), surface: token(style, '--studio-surface'), graphite: token(style, '--studio-graphite'), mist: token(style, '--studio-mist'), signal: token(style, '--studio-signal'), tealInk: token(style, '--studio-teal-ink'),
  };
  /** What each tint lets through (0..1 per channel), and the colour its light paints. */
  const pass = (c: Rgb, lift = 0): Rgb => [lerp(c[0] / 255, 1, lift), lerp(c[1] / 255, 1, lift), lerp(c[2] / 255, 1, lift)];
  const TINT_PASS: Record<BottleTint, Rgb> = { clear: pass(mixRgb(C.sky, C.celadon, 0.25), 0.72), sea: pass(mixRgb(C.sea, C.celadon, 0.2), 0.04), amber: pass(C.amber, 0.02), rose: pass(mixRgb(C.rose, C.roseDeep, 0.25), 0.04) };
  const TINT_LIGHT: Record<BottleTint, Rgb> = { clear: mixRgb(C.skyDeep, C.white, 0.3), sea: mixRgb(C.sea, C.teal, 0.12), amber: mixRgb(C.amber, C.orange, 0.2), rose: mixRgb(C.rose, C.roseDeep, 0.3) };
  const TINT_TONES: Record<BottleTint, readonly string[]> = { clear: ['white', 'sky-pale', 'sky'], sea: ['sea', 'sky-pale', 'white'], amber: ['amber', 'sun', 'white'], rose: ['rose', 'blossom', 'white'] };
  const STICKER_RING: Record<BottleSticker, Rgb> = { star: C.orange, leaf: token(style, '--mk-leaf'), wave: C.water, sun: C.amber, moon: token(style, '--mk-bluebell'), heart: C.rose };

  // ── Pictures ─────────────────────────────────────────────────────────────
  const pictures = new Map<string, HTMLImageElement>();
  const load = (p: KitPicture) => { let img = pictures.get(p.src); if (!img) { img = new Image(); img.decoding = 'async'; img.src = p.src; pictures.set(p.src, img); } return img; };
  const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;
  const room = load(KIT_PLATE.room), bench = load(KIT_PLATE.bench), can = load(KIT_CAN);
  const ayaPics = { front: load(KIT_AYA.front), side: load(KIT_AYA.side), sitting: load(KIT_AYA.sitting) };
  const discPics = Object.fromEntries(BOTTLE_TINTS.map(t => [t, load(KIT_DISCS[t])])) as Record<BottleTint, HTMLImageElement>;
  const stickerPics = Object.fromEntries(Object.entries(STICKER_PRINT).map(([art, p]) => [art, load(p.picture)])) as Record<BottleSticker, HTMLImageElement>;

  // ── State ────────────────────────────────────────────────────────────────
  let L = stageLayout(390, 700, sitting.ayaLeft), dpr = 1, alive = true, frame = 0, last = 0, time = 0, lift = 0;
  let act: Act = 'opening', actT = 0;
  const made: BottleCreation = deps.start ? { ...deps.start, stickers: deps.start.stickers.map(s => ({ ...s })) } : freshBottle();
  let weights: Weights = deps.start ? oneShape(made.shape) : sitting.lump, target: Weights = deps.start ? oneShape(made.shape) : sitting.lump;
  if (!deps.start) made.shape = settleShape(sitting.lump);
  let profile: BlendedProfile = blendedProfile(weights, 72);
  const stretch: Spring = { v: 1, vel: 0 }, lean: Spring = { v: 0, vel: 0 };
  let stretchTo = 1, leanTo = 0, ripple = 0, heat = deps.start ? 0 : 1, glowUp = 0;
  let tintFrom: Rgb = TINT_PASS[made.tint], tintTo: Rgb = TINT_PASS[made.tint], soak = 1, soakPart = -1, lightFrom: Rgb = TINT_LIGHT[made.tint], lightTo: Rgb = TINT_LIGHT[made.tint];
  let rub = 0, autoRub = 0, rotation = -20, rotTo = -20, rainbow = 0, lightX = sitting.sunSide * 0.25, lightAuto = 0, squash = 0;
  let px = 0, py = 0, pxTo = 0, pyTo = 0;
  let gesture: Gesture | null = null, carry: { art: BottleSticker; x: number; y: number; hot: number | null } | null = null;
  const discs: DiscState[] = sitting.discs.map(tint => ({ tint, x: 0, y: 0, lift: 0, under: false }));
  const flying: Flying[] = [];
  let ayaX = 0, ayaHop = 0, ayaHops = 0, ayaIn = 0, ayaBehind = 0, ayaLook = 0, ayaLean = 0, touchX = 0, touchY = 0;
  let discsIn = 0, cardIn = 0, finaleT = 0, pose: FinalePose = finalePose(0), freed = false, water = 0, slosh = 0, sloshV = 0;
  const deeds: Deeds = noDeeds();
  const rung: number[] = [];
  let hintClock = 0, hintShown: HintId | null = null, hintT = 0, glint = 0, hold = 0;
  const motes: Mote[] = []; const bubbles: Bubble[] = [];
  { let s = sitting.seed >>> 0; const roll = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < sitting.motes; i++) motes.push({ x: roll(), y: roll() * 0.8, r: 0.6 + roll() * 1.6, speed: 0.004 + roll() * 0.01, phase: roll() * TAU });
    for (let i = 0; i < 14; i++) bubbles.push({ u: roll() * 1.4 - 0.7, v: roll(), r: 1 + roll() * 2.6, speed: 0.12 + roll() * 0.2, phase: roll() * TAU }); }
  const still = () => deps.reduced();
  const fxAt = (x: number, y: number, kind: FxKind, opts?: FxOptions) => deps.fx()?.burst(x / L.width, y / L.height, kind, opts);
  const fxTrail = (x: number, y: number, kind: FxKind, opts?: FxOptions) => deps.fx()?.trail(x / L.width, y / L.height, kind, opts);

  // ── The bottle's geometry, now ───────────────────────────────────────────
  const G = { top: 0, height: 0, capTop: 0, capFoot: 0, eTop: 0, eFoot: 0.375 };
  const sizeGlass = () => {
    G.height = profile.height * L.unit * stretch.v; G.top = L.base.y - G.height;
    G.eTop = ringRatio(plateRow(L, G.top)); G.eFoot = ringRatio(plateRow(L, L.base.y));
    G.capTop = radiusV(0) * Math.abs(G.eTop); G.capFoot = radiusV(1) * G.eFoot;
  };
  const radiusV = (v: number) => {
    const wave = ripple ? 1 + ripple * Math.sin(v * 9 - time * 15) * Math.sin(Math.PI * clamp(v, 0, 1)) : 1;
    return profileRadius(profile, v) * L.unit / Math.sqrt(stretch.v) * wave * (1 + squash * (v - 0.4) * 0.5);
  };
  const axisV = (v: number) => { const up = (1 - v) * G.height; return L.base.x + Math.tan(lean.v * Math.PI / 180) * up + lean.vel * 0.0016 * up * (1 - v); };
  const yV = (v: number) => G.top + v * G.height;
  /** Where a stage point sits on the glass: `u` across (-1..1 inside), `v` down its height. Null well outside it. */
  const onGlass = (x: number, y: number, slack = 0): { u: number; v: number } | null => {
    const v = (y - G.top) / Math.max(1, G.height);
    if (v < -0.08 - slack || v > 1.06 + slack) return null;
    const vc = clamp(v, 0, 1), r = Math.max(radiusV(vc), 14 * L.unit), u = (x - axisV(vc)) / r;
    return Math.abs(u) <= 1 + slack * 2 ? { u, v: vc } : null;
  };
  const slotSpot = (slot: number, turn = rotation) => {
    const view = slotView(slot, turn), v = profile.stickerRows[view.row], r = radiusV(v), y = yV(v), e = ringRatio(plateRow(L, y));
    return { x: axisV(v) + view.x * r * 0.94, y: y + view.depth * r * e, view, size: profile.sticker * L.unit * 1.18, v };
  };
  const discHome = (index: number) => L.discs[index];
  const underSpot = () => ({ x: L.base.x + L.discWidth * 0.04, y: L.base.y + 2 });
  const benchFarY = () => (PLATE.benchFar - L.y0) * L.k;

  // ── Deeds, words, small rewards ──────────────────────────────────────────
  const did = (deed: keyof Deeds) => { deeds[deed]++; emit({ type: 'deed', deed }); hintClock = 0; hintShown = null; };
  const say = (id: SayId) => emit({ type: 'say', say: id });
  const cheer = (big = false) => { if (!still()) { ayaHop = 1e-4; ayaHops = big ? 2 : 1; } sound.hop(); };
  /** A hit-pause: the picture holds for a blink on a big moment, then carries on. */
  const beat = (seconds: number, shake = false) => { if (still()) return; hold = Math.max(hold, seconds); if (shake) emit({ type: 'beat' }); };
  const kick = (amount: number, velocity = 0) => { if (still()) return; ripple = Math.max(ripple, amount); stretch.vel += velocity; };
  const publish = () => { emit({ type: 'bottle', bottle: { kind: 'bottle', shape: made.shape, tint: made.tint, finish: made.finish, stickers: made.stickers.map(s => ({ art: s.art, slot: s.slot })) } }); emit({ type: 'spots' }); };

  const ring = (x?: number, y?: number) => {
    void selectionHaptic();
    const side = x === undefined ? 0 : clamp((x - L.base.x) / (60 * L.unit), -1, 1);
    sound.ring(ringStep(weights, water), 1);
    kick(0.035, 0); if (!still()) { lean.vel -= side * 26; sloshV += side * 0.5; }
    fxAt(x ?? L.base.x, y ?? yV(0.45), 'ring', { tones: ['white'], size: 0.9 });
    fxAt(x ?? L.base.x, y ?? yV(0.45), 'glint', { tones: TINT_TONES[made.tint], count: 3 });
    glint = 1; say('rang');
  };
  const setShape = (shape: BottleCreation['shape'], how: 'pull' | 'tap') => {
    const changed = shape !== made.shape;
    made.shape = shape; target = oneShape(shape); stretchTo = 1; leanTo = 0;
    if (still()) { weights = target; profile = blendedProfile(weights, 72); }
    kick(0.075, how === 'tap' ? 2.6 : 1.2);
    sound.settle(ringStep(target));
    fxAt(L.base.x, yV(0.5), 'sparkle', { tones: ['sun', 'butter', 'orange', 'white'], count: 14, spread: 1.2 });
    fxAt(L.base.x, L.base.y, 'ring', { tones: ['butter'], size: 1.4 });
    if (changed) cheer();
    beat(0.05); did('shaped'); say(shape); publish();
  };
  const setTint = (tint: BottleTint) => {
    void selectionHaptic();
    for (const d of discs) d.under = d.tint === tint;
    did('coloured');
    if (tint === made.tint && soak >= 1) { sound.place(0); kick(0.03); glowUp = 1; return; }
    // The colour the glass shows now becomes where the soak starts from.
    const shown = soak >= 1 ? tintTo : mixRgb(tintFrom, tintTo, 0.5);
    tintFrom = shown; tintTo = TINT_PASS[tint]; lightFrom = lightTo; lightTo = TINT_LIGHT[tint];
    made.tint = tint; soak = still() ? 1 : 0; soakPart = -1; glowUp = 1;
    sound.place(1);
    if (still()) { tintFrom = tintTo; sound.soak(4); }
    say('tinted'); publish();
  };
  const flipFinish = () => {
    made.finish = otherFinish(made.finish); rub = 0; autoRub = 0;
    const frost = made.finish === 'frost';
    void selectionHaptic(); sound.finish(frost); kick(0.04);
    fxAt(L.base.x, yV(0.45), frost ? 'dust' : 'sparkle', { tones: frost ? ['white', 'snow', 'sky-pale'] : ['white', 'sky-pale', 'sun'], count: 16, spread: 1.4 });
    fxAt(L.base.x, yV(0.45), 'ring', { tones: ['white'], size: 2 });
    cheer(); beat(0.06, true); did('rubbed'); say(frost ? 'frosted' : 'polished'); publish();
  };
  const stick = (art: BottleSticker, slot: number) => {
    const next = placeSticker(made.stickers, art, slot);
    if (next === made.stickers) return false;
    made.stickers = [...next];
    const at = slotSpot(slot);
    void selectionHaptic(); sound.stick(made.stickers.length); kick(0.03); squash = still() ? 0 : 0.05;
    fxAt(at.x, at.y, 'glint', { tones: ['white', 'sun'], count: 4 });
    fxAt(at.x, at.y, 'ring', { tones: ['white'], size: 0.7 });
    if (made.stickers.length === 1 || stickersFull(made.stickers)) cheer(stickersFull(made.stickers));
    beat(0.04); did('stuck'); say(stickersFull(made.stickers) ? 'full' : 'stuck'); publish();
    return true;
  };
  const fly = (art: BottleSticker, x: number, y: number, slot: number | null) => {
    if (slot !== null && still()) { stick(art, slot); return; }
    const home = L.card.stickers[sitting.card.indexOf(art)] ?? L.card.stickers[0];
    flying.push({ art, x0: x, y0: y, slot, t: 0, x1: home.x, y1: home.y });
    if (slot === null) sound.back();
  };
  const tapSticker = (art: BottleSticker) => {
    if (act !== 'dress') return;
    const from = L.card.stickers[sitting.card.indexOf(art)] ?? L.card.stickers[0];
    if (stickersFull(made.stickers)) { sound.back(); kick(0.03); say('full'); return; }
    let slot = nextFreeSlot(made.stickers.concat(flying.filter(f => f.slot !== null).map(f => ({ art: f.art, slot: f.slot as number }))), rotTo);
    if (slot === null) { const turn = turnToFree(made.stickers, rotTo); if (turn !== null) { rotTo = turn; slot = nextFreeSlot(made.stickers, rotTo); } }
    if (slot === null) { sound.back(); return; }
    sound.pick(); fly(art, from.x, from.y, slot);
  };
  const peel = (slot: number) => {
    const off = made.stickers.find(s => s.slot === slot);
    if (!off || act !== 'dress') return;
    const at = slotSpot(slot);
    made.stickers = [...peelSticker(made.stickers, slot)];
    void selectionHaptic(); sound.peel();
    if (!still()) flying.push({ art: off.art, x0: at.x, y0: at.y, slot: null, t: 0, x1: (L.card.stickers[sitting.card.indexOf(off.art)] ?? at).x, y1: (L.card.stickers[sitting.card.indexOf(off.art)] ?? at).y });
    say('peeled'); publish();
  };
  const turnBy = (by: number) => { rotTo = snapRotation(rotTo + by); sound.turn(Math.round(rotTo / TURN_STEP)); if (still()) rotation = rotTo; did('turned'); say('turned'); emit({ type: 'spots' }); };
  const tapAya = () => {
    void selectionHaptic(); cheer();
    fxAt(ayaX, L.aya.y - L.aya.height * 0.7, 'sparkle', { tones: ['bluebell', 'sky', 'white'], count: 6, size: 0.7 });
    if (act === 'colour' && autoRub === 0 && !gesture) { autoRub = 1e-4; ayaLook = 1; } else say('aya');
  };
  const tapArch = (index: number) => {
    const a = L.arches[index]; if (!a) return;
    void selectionHaptic(); sound.arch(ARCH_STEPS[index]);
    fxAt(a.x + a.width / 2, a.y + a.height * 0.4, 'glint', { tones: ['white', 'sky-pale'], count: 3, size: 1.2 });
    fxAt(a.x + a.width / 2, a.y + a.height * 0.45, 'ring', { tones: ['white'], size: 1.6 });
    rung.push(index); if (rung.length > 6) rung.shift();
    if (archSecret(rung)) { rung.length = 0; rainbow = 1; sound.secret(); cheer(true); say('secret'); for (const arch of L.arches) fxAt(arch.x + arch.width / 2, arch.y + arch.height / 2, 'sparkle', { tones: ['rose', 'sun', 'sea', 'lilac', 'white'], count: 10 }); }
    else say('arch');
  };

  // ── Touch ────────────────────────────────────────────────────────────────
  const local = (clientX: number, clientY: number) => { const box = canvas.getBoundingClientRect(); return { x: (clientX - box.left) * (L.width / Math.max(1, box.width)), y: (clientY - box.top) * (L.height / Math.max(1, box.height)) }; };
  const inBox = (b: Box, x: number, y: number, pad = 0) => x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y - pad && y <= b.y + b.height + pad;
  const ayaBox = (): Box => ({ x: ayaX - L.aya.height * 0.3, y: L.aya.y - L.aya.height, width: L.aya.height * 0.6, height: L.aya.height });
  const discAt = (x: number, y: number) => {
    if (act !== 'colour' || discsIn < 0.6) return null;
    for (let i = discs.length - 1; i >= 0; i--) { const d = discs[i], w = discWidthAt(d.y) * 0.5 + 8, h = Math.max(22, w * 0.5); if (!d.under && Math.abs(x - d.x) <= w && Math.abs(y - d.y) <= h) return d; }
    return null;
  };
  const discWidthAt = (y: number) => L.discWidth * benchScale(plateRow(L, y)) / benchScale(plateRow(L, L.discs[0].y));
  const cardAt = (x: number, y: number) => {
    if (act !== 'dress' || cardIn < 0.6) return null;
    const half = Math.max(28, L.card.size / 2 + 3);
    for (let i = 0; i < L.card.stickers.length; i++) { const s = L.card.stickers[i]; if (Math.abs(x - s.x) <= half && Math.abs(y - s.y) <= half) return sitting.card[i]; }
    return null;
  };
  const stickerAt = (x: number, y: number) => {
    for (const s of made.stickers) { const at = slotSpot(s.slot); if (at.view.front && at.view.scaleX > 0.3 && Math.hypot((x - at.x) / Math.max(0.3, at.view.scaleX), y - at.y) <= at.size / 2 + 4) return s.slot; }
    return null;
  };
  const hotSlot = (x: number, y: number) => {
    const at = onGlass(x, y, 0.12); if (!at) return null;
    const rows = profile.stickerRows; let row = 0;
    for (let r = 1; r < 3; r++) if (Math.abs(at.v - rows[r]) < Math.abs(at.v - rows[row])) row = r;
    return dropSlot(made.stickers, rotation, at.u, row);
  };

  const down = (clientX: number, clientY: number, id: number) => {
    if (gesture || act === 'opening' || act === 'done') return;
    const { x, y } = local(clientX, clientY); touchX = x; touchY = y;
    hintClock = 0; hintShown = null;
    if (act === 'finale') { if (freed) gesture = { kind: 'light', id, x0: x, moved: false, note: Math.round(lightX * 4) }; return; }
    const disc = discAt(x, y);
    if (disc) { gesture = { kind: 'disc', id, x0: x, y0: y, moved: false, tint: disc.tint, ox: disc.x - x, oy: disc.y - y }; sound.pick(); void selectionHaptic(); return; }
    const art = cardAt(x, y);
    if (art) { gesture = { kind: 'carry', id, x0: x, y0: y, moved: false, art }; return; }
    if (act === 'dress') { const slot = stickerAt(x, y); if (slot !== null) { gesture = { kind: 'turn', id, x0: x, rot0: rotation, moved: false, slot, notch: Math.round(rotation / TURN_STEP) }; return; } }
    if (onGlass(x, y, 0.1)) {
      if (act === 'shape') gesture = { kind: 'shape', id, x0: x, y0: y, moved: false, from: weights, span: Math.max(60, profile.height * L.unit), last: settleShape(weights) };
      else if (act === 'colour') gesture = { kind: 'rub', id, x, y, far: 0, done: false, trail: 0 };
      else gesture = { kind: 'turn', id, x0: x, rot0: rotation, moved: false, slot: null, notch: Math.round(rotation / TURN_STEP) };
      return;
    }
    if (ayaIn > 0.7 && inBox(ayaBox(), x, y, 6)) { tapAya(); gesture = { kind: 'toy', id }; return; }
    const arch = L.arches.findIndex(a => inBox(a, x, y) && y < benchFarY());
    if (arch >= 0) { tapArch(arch); gesture = { kind: 'toy', id }; return; }
    // The bench answers too: a little dust where it is patted.
    if (y > benchFarY() + 8) { fxAt(x, y, 'dust', { tones: ['white', 'linen'], count: 5, size: 0.6 }); sound.rub(); }
    gesture = { kind: 'toy', id };
  };
  const move = (clientX: number, clientY: number, id: number) => {
    const { x, y } = local(clientX, clientY);
    pxTo = clamp(x / L.width * 2 - 1, -1, 1); pyTo = clamp(y / L.height * 2 - 1, -1, 1); touchX = x; touchY = y;
    const g = gesture; if (!g || g.id !== id) return;
    if (g.kind === 'shape') {
      const dx = (x - g.x0) / g.span, dy = (y - g.y0) / g.span;
      if (!g.moved && Math.hypot(x - g.x0, y - g.y0) > 8) { g.moved = true; void selectionHaptic(); say('pulled'); }
      if (!g.moved) return;
      weights = pullShape(g.from, dx, dy); profile = blendedProfile(weights, 72); target = weights;
      stretchTo = pullStretch(dy); leanTo = pullLean(dx);
      if (still()) { stretch.v = stretchTo; lean.v = leanTo; }
      const now = settleShape(weights);
      if (now !== g.last) { g.last = now; sound.stretch(ringStep(oneShape(now))); void selectionHaptic(); fxAt(x, y, 'sparkle', { tones: ['sun', 'orange', 'butter'], count: 5, size: 0.7 }); }
      else if (Math.random() < 0.18) fxTrail(x, y, 'sparkle', { tones: ['sun', 'butter'], size: 0.5 });
    } else if (g.kind === 'disc') {
      if (!g.moved && Math.hypot(x - g.x0, y - g.y0) > 8) g.moved = true;
      const d = discs.find(q => q.tint === g.tint); if (!d || !g.moved) return;
      d.x = clamp(x + g.ox, 20, L.width - 20); d.y = clamp(y + g.oy, benchFarY() + 14, L.height - 12); d.lift = 1;
    } else if (g.kind === 'rub') {
      const step = Math.hypot(x - g.x, y - g.y); g.x = x; g.y = y; g.far += step;
      if (g.done || !onGlass(x, y, 0.12)) return;
      rub = rubStep(rub, step, Math.max(60, radiusV(0.6) * 2));
      g.trail += step;
      if (g.trail > 22) { g.trail = 0; fxTrail(x, y, made.finish === 'frost' ? 'glint' : 'dust', { tones: made.finish === 'frost' ? ['white', 'sun'] : ['white', 'snow'], size: 0.6 }); sound.rub(); }
      if (rub >= 1) { g.done = true; flipFinish(); }
    } else if (g.kind === 'carry') {
      if (!g.moved && Math.hypot(x - g.x0, y - g.y0) > 9) {
        if (stickersFull(made.stickers)) { sound.back(); say('full'); gesture = { kind: 'toy', id }; return; }
        g.moved = true; sound.peel(); void selectionHaptic();
      }
      if (g.moved) carry = { art: g.art, x, y, hot: hotSlot(x, y) };
    } else if (g.kind === 'turn') {
      if (!g.moved && Math.abs(x - g.x0) > 8) g.moved = true;
      if (!g.moved) return;
      rotation = g.rot0 + dragTurn(x - g.x0, Math.max(80, radiusV(0.6) * 2)); rotTo = rotation;
      const notch = Math.round(rotation / TURN_STEP);
      if (notch !== g.notch) { g.notch = notch; sound.turn(notch); void selectionHaptic(); emit({ type: 'spots' }); }
    } else if (g.kind === 'light') {
      if (!g.moved && Math.abs(x - g.x0) > 6) g.moved = true;
      lightX = clamp((x - L.width / 2) / (L.width * 0.42), -1, 1); lightAuto = 0;
      const note = Math.round(lightX * 4);
      if (note !== g.note) { g.note = note; sound.light(9 + note); say('light'); }
    }
  };
  const up = (clientX: number, clientY: number, id: number) => {
    const g = gesture; if (!g || g.id !== id) return;
    gesture = null;
    const { x, y } = local(clientX, clientY);
    if (g.kind === 'shape') {
      if (!g.moved) { ring(x, y); setShape(nextShape(made.shape), 'tap'); }
      else setShape(settleShape(weights), 'pull');
    } else if (g.kind === 'disc') {
      const d = discs.find(q => q.tint === g.tint); if (!d) return;
      d.lift = 0;
      const near = Math.hypot((d.x - L.base.x) / (radiusV(1) + L.discWidth * 0.5), (d.y - L.base.y) / (L.discWidth * 0.55)) < 1.15 || !!onGlass(x, y, 0.05);
      if (!g.moved || near) setTint(g.tint); else sound.back();
    } else if (g.kind === 'rub') {
      if (g.far < 8) ring(x, y);
    } else if (g.kind === 'carry') {
      const held = carry; carry = null;
      if (!g.moved) { tapSticker(g.art); return; }
      const slot = held ? hotSlot(x, y) : null;
      if (slot !== null) stick(g.art, slot); else fly(g.art, x, y, null);
    } else if (g.kind === 'turn') {
      if (!g.moved) { if (g.slot !== null) peel(g.slot); else ring(x, y); return; }
      rotTo = snapRotation(rotation);
      if (Math.abs(rotation - g.rot0) > 18) { did('turned'); say('turned'); }
      emit({ type: 'spots' });
    } else if (g.kind === 'light' && !g.moved) { if (onGlass(x, y, 0.1)) ring(x, y); }
  };
  const cancel = () => {
    const g = gesture; gesture = null; carry = null;
    if (g?.kind === 'shape' && g.moved) setShape(settleShape(weights), 'pull');
    if (g?.kind === 'disc') { const d = discs.find(q => q.tint === g.tint); if (d) d.lift = 0; }
    if (g?.kind === 'turn') rotTo = snapRotation(rotation);
  };
  const command = (c: Command) => {
    hintClock = 0; hintShown = null;
    if (c.do === 'ring') ring();
    else if (c.do === 'shape' && act === 'shape') setShape(c.dir === 'up' ? 'tall' : c.dir === 'down' ? 'round' : c.dir === 'side' ? 'flask' : nextShape(made.shape), 'tap');
    else if (c.do === 'disc' && act === 'colour') setTint(c.tint);
    else if (c.do === 'finish' && act === 'colour') { if (autoRub === 0) autoRub = still() ? 0.99 : 1e-4; }
    else if (c.do === 'stickOn') tapSticker(c.art);
    else if (c.do === 'peel') peel(c.slot);
    else if (c.do === 'turn' && (act === 'dress' || (act === 'finale' && freed))) turnBy(c.by);
    else if (c.do === 'aya') tapAya();
    else if (c.do === 'arch') tapArch(c.index);
    else if (c.do === 'light' && act === 'finale') { lightX = clamp(lightX + c.by, -1, 1); lightAuto = 0; sound.light(9 + Math.round(lightX * 4)); say('light'); }
  };

  // ── Time ─────────────────────────────────────────────────────────────────
  const step = (dt: number) => {
    time += dt; actT += dt;
    const quiet = still();
    px += (pxTo - px) * Math.min(1, dt * 5); py += (pyTo - py) * Math.min(1, dt * 5);
    if (!gesture || gesture.kind !== 'shape') {
      const before = weights; weights = mixWeights(weights, target, quiet ? 1 : 1 - Math.exp(-dt * 11));
      if (before.round !== weights.round || before.tall !== weights.tall || before.flask !== weights.flask) profile = blendedProfile(weights, 72);
    }
    const hot = heat > 0.4;
    if (quiet) { stretch.v = stretchTo; stretch.vel = 0; lean.v = leanTo; lean.vel = 0; ripple = 0; squash = 0; }
    else {
      spring(stretch, stretchTo, gesture?.kind === 'shape' ? 300 : hot ? 150 : 420, gesture?.kind === 'shape' ? 24 : hot ? 6.5 : 18, dt);
      spring(lean, leanTo, gesture?.kind === 'shape' ? 260 : hot ? 110 : 300, gesture?.kind === 'shape' ? 22 : hot ? 5.5 : 14, dt);
      ripple *= Math.exp(-dt * (hot ? 2.6 : 5)); if (ripple < 0.001) ripple = 0;
      squash *= Math.exp(-dt * 9);
    }
    stretch.v = clamp(stretch.v, 0.7, 1.4); lean.v = clamp(lean.v, -18, 18);
    const heatTo = !deps.start && (act === 'opening' || act === 'shape') ? 1 : 0;
    heat += (heatTo - heat) * (quiet ? 1 : 1 - Math.exp(-dt * 1.5));
    glowUp *= Math.exp(-dt * 1.2); rainbow = Math.max(0, rainbow - dt / 4.5); glint = Math.max(0, glint - dt * 2.2);
    // Colour climbing the glass.
    if (soak < 1) {
      soak = Math.min(1, soak + dt * 1000 / SOAK_MS);
      const part = Math.min(4, Math.floor(soak * 5));
      if (part !== soakPart) { soakPart = part; sound.soak(part); fxAt(L.base.x + (part % 2 ? 1 : -1) * radiusV(0.7) * 0.4, yV(1 - soakFront(soak) * 0.9), 'sparkle', { tones: TINT_TONES[made.tint], count: 6, size: 0.8, angle: 270, arc: 80 }); }
      if (soak >= 1) { tintFrom = tintTo; lightFrom = lightTo; kick(0.05, 1); cheer(); beat(0.05, true); fxAt(L.base.x, G.top, 'ring', { tones: TINT_TONES[made.tint], size: 1.6 }); fxAt(L.base.x, yV(0.3), 'glint', { tones: TINT_TONES[made.tint], count: 5 }); }
    }
    // The rub: Aya's when she is asked, the child's own otherwise; a rub let go fades.
    if (autoRub > 0) {
      autoRub += dt / 0.95; rub = Math.min(1, autoRub);
      if (Math.random() < 0.5) fxTrail(L.base.x + Math.sin(time * 16) * radiusV(0.6) * 0.7, yV(0.3 + 0.5 * ((time * 0.9) % 1)), made.finish === 'frost' ? 'glint' : 'dust', { tones: ['white', 'snow'], size: 0.6 });
      if (rub >= 1) flipFinish();
    } else if (!gesture || gesture.kind !== 'rub') rub = rubFade(rub, dt);
    if (!gesture || gesture.kind !== 'turn') { if (quiet) rotation = rotTo; else rotation += (rotTo - rotation) * (1 - Math.exp(-dt * 10)); }
    // The discs glide: home, under the bottle, or in the hand.
    discs.forEach((d, i) => {
      if (gesture?.kind === 'disc' && gesture.tint === d.tint && gesture.moved) return;
      const to = d.under ? underSpot() : discHome(i), rate = quiet ? 1 : 1 - Math.exp(-dt * 9);
      d.x += (to.x - d.x) * rate; d.y += (to.y - d.y) * rate; d.lift *= 1 - rate;
    });
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]; f.t += dt / (f.slot === null ? 0.34 : 0.4);
      if (f.slot !== null && Math.random() < 0.5) { const to = slotSpot(f.slot), t = ease(f.t); fxTrail(lerp(f.x0, to.x, t), lerp(f.y0, to.y, t) - Math.sin(t * Math.PI) * 46, 'glint', { tones: ['white', 'sun'], size: 0.45 }); }
      if (f.t >= 1) { flying.splice(i, 1); if (f.slot !== null && !stick(f.art, f.slot)) sound.back(); }
    }
    // Aya: in at the opening, a hop when something lands, behind the glass at the finale.
    ayaIn = Math.min(1, ayaIn + dt / (quiet ? 0.01 : 0.9));
    if (ayaHop > 0) { ayaHop += dt / 0.36; if (ayaHop >= 1) { ayaHops--; ayaHop = ayaHops > 0 ? 1e-4 : 0; } }
    ayaLook = Math.max(0, ayaLook - dt * 0.8);
    // She leans toward whatever is being touched, and toward the glass while it is rubbed for her.
    const leanTo2 = gesture && gesture.kind !== 'toy' ? clamp((touchX - ayaX) / Math.max(120, L.width * 0.5), -1, 1) * 0.1 - clamp((L.aya.y - L.aya.height * 0.6 - touchY) / L.height, -0.4, 0.4) * 0.05 * Math.sign(touchX - ayaX || 1) : ayaLook > 0 ? Math.sign(L.base.x - ayaX) * 0.09 : 0;
    ayaLean += (leanTo2 - ayaLean) * Math.min(1, dt * 7);
    const want = (name: 'colour' | 'dress') => act === name ? 1 : 0;
    discsIn += (want('colour') - discsIn) * (quiet ? 1 : 1 - Math.exp(-dt * 5)); cardIn += (want('dress') - cardIn) * (quiet ? 1 : 1 - Math.exp(-dt * 5));
    if (act === 'finale') {
      finaleT += dt; const was = pose; pose = finalePose(finaleT, quiet);
      if (!was.flow && pose.flow) sound.pour();
      if (pose.flow && Math.random() < 0.3) fxTrail(axisV(0), G.top - 4, 'drop', { tones: ['sky', 'white', 'sky-pale'], size: 0.8 });
      if (was.sun < 0.05 && pose.sun >= 0.05) { sound.setPiece(); sound.ambience('garden'); beat(0.08, true); }
      if (was.behind < 0.5 && pose.behind >= 0.5) { say('behind'); sound.fizz(); }
      water = pose.water * FINALE_FILL; ayaBehind = pose.behind;
      if (!freed) { rotation = rotTo + pose.turn; if (pose.free) { freed = true; rotTo = snapRotation(rotation); emit({ type: 'free' }); emit({ type: 'spots' }); } }
      if (freed && !gesture) { lightAuto += dt; lightX += (Math.sin(lightAuto * 0.5 + sitting.sunSide) * 0.6 - lightX) * Math.min(1, dt * 0.6); }
      glowUp = Math.max(glowUp, pose.sun * 0.9);
      if (pose.sun > 0.3 && Math.random() < 0.04 && !quiet) fxAt(L.base.x + (Math.random() - 0.5) * radiusV(0.6) * 2, yV(Math.random() * 0.8), 'glint', { tones: TINT_TONES[made.tint], count: 1, size: 0.9 });
    }
    if (quiet) { slosh = 0; sloshV = 0; } else { sloshV += (-60 * slosh - 3.2 * sloshV - lean.vel * 0.02) * dt; slosh = clamp(slosh + sloshV * dt, -0.5, 0.5); }
    // The ghost hand: shown after a quiet moment, again after a longer one.
    const hint = act === 'opening' || act === 'finale' || act === 'done' || gesture ? null : hintFor(act, deeds);
    if (!hint) { hintClock = 0; hintShown = null; }
    else { hintClock += dt * 1000; if (!hintShown && hintClock > (hintT > 0 ? HINT_AGAIN_MS : HINT_FIRST_MS)) { hintShown = hint; hintT = 1e-4; } if (hintShown) { hintT += dt; if (hintT > 3.4) { hintShown = null; hintClock = 0; } } }
    // On a tall stage the finale raises the picture, so the bench in front of the bottle is clear for its light.
    const liftTo = act === 'finale' && L.portrait ? 1 : 0;
    if (lift !== liftTo) { lift = quiet ? liftTo : Math.abs(liftTo - lift) < 0.004 ? liftTo : lift + (liftTo - lift) * (1 - Math.exp(-dt * 2.4)); L = stageLayout(L.width, L.height, sitting.ayaLeft, lift); sizeBuffers(); }
    sizeGlass();
  };

  // ── Painting ─────────────────────────────────────────────────────────────
  const plateX = (x: number) => (x - L.x0) * L.k, plateY = (y: number) => (y - L.y0) * L.k;
  const sunAt = () => ({ x: L.base.x + lightX * 150 * L.k, y: plateY(PLATE.horizon - 96 + Math.abs(lightX) * 26) });
  const lightNow = (): Rgb => mixRgb(lightFrom, lightTo, soak);
  let causticCanvas: HTMLCanvasElement | null = null, causticImage: ImageData | null = null, causticAt = -1;
  const CAUSTIC = 72;
  /** The light glass focuses: a net of bright threads over a soft pool, worked out a few times a second on a small tile. */
  const caustic = () => {
    if (!causticCanvas) { causticCanvas = document.createElement('canvas'); causticCanvas.width = CAUSTIC; causticCanvas.height = CAUSTIC; }
    const tick = still() ? 0 : Math.floor(time * 14);
    if (tick === causticAt) return causticCanvas;
    causticAt = tick;
    const c = causticCanvas.getContext('2d'); if (!c) return causticCanvas;
    causticImage ??= c.createImageData(CAUSTIC, CAUSTIC);
    const data = causticImage.data, t = still() ? 0 : time * 0.9;
    for (let j = 0; j < CAUSTIC; j++) for (let i = 0; i < CAUSTIC; i++) {
      const x = i / CAUSTIC * 7, y = j / CAUSTIC * 7;
      const a = Math.sin(x * 1.3 + t + Math.sin(y * 1.7 + t * 0.7) * 1.4) + Math.sin(y * 1.5 - t * 0.8 + Math.sin(x * 1.9 + t * 0.5) * 1.3);
      const b = Math.sin((x + y) * 1.1 - t * 0.6 + Math.sin((x - y) * 1.6 + t) * 1.2) + Math.sin((x - y) * 1.2 + t * 0.9 + Math.sin((x + y) * 1.4 - t * 0.4));
      const thread = Math.max(0, 1 - Math.abs(a) * 0.9) ** 5 + Math.max(0, 1 - Math.abs(b) * 0.9) ** 5;
      const dx = i / CAUSTIC - 0.5, dy = j / CAUSTIC - 0.5, rim = Math.max(0, 1 - (dx * dx + dy * dy) * 4) ** 1.4;
      const o = (j * CAUSTIC + i) * 4, v = Math.min(1, thread * 0.85 + 0.1) * rim;
      data[o] = C.white[0]; data[o + 1] = C.white[1]; data[o + 2] = C.white[2]; data[o + 3] = v * 255;
    }
    c.putImageData(causticImage, 0, 0);
    return causticCanvas;
  };
  const glowBlob = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colour: Rgb, alpha: number, mode: GlobalCompositeOperation = 'screen') => {
    if (alpha <= 0.003 || rx <= 0 || ry <= 0) return;
    c.save(); c.globalCompositeOperation = mode; c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, ink(colour, alpha)); g.addColorStop(0.5, ink(colour, alpha * 0.45)); g.addColorStop(1, ink(colour, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
  };
  const patch = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: Rgb, alpha: number, turn = 0) => {
    if (alpha <= 0.003) return;
    glowBlob(c, x, y, w * 0.6, h * 0.6, mixRgb(colour, C.white, 0.15), Math.min(1, alpha * 0.9), 'multiply');
    glowBlob(c, x, y, w * 0.56, h * 0.56, colour, Math.min(1, alpha * 1.25));
    c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = Math.min(1, alpha * 0.9); c.imageSmoothingEnabled = true; c.translate(x, y); c.rotate(turn); c.drawImage(caustic(), -w / 2, -h / 2, w, h); c.restore();
  };
  const shade = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) => glowBlob(c, x, y, rx, ry, C.shadow, alpha, 'multiply');

  const drawSticker = (c: CanvasRenderingContext2D, art: BottleSticker, x: number, y: number, size: number, scaleX = 1, alpha = 1, back = false, lift = 0) => {
    const img = stickerPics[art], print = STICKER_PRINT[art], r = size / 2;
    c.save(); c.translate(x, y); c.scale((back ? -1 : 1) * Math.max(0.06, scaleX), 1); c.globalAlpha = alpha;
    if (!back) { c.fillStyle = ink(C.shadow, 0.2 + lift * 0.06); c.beginPath(); c.arc(1 + lift * 3, 2 + lift * 6, r * 1.03, 0, TAU); c.fill(); }
    c.fillStyle = ink(C.white); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = ink(mixRgb(STICKER_RING[art], C.white, 0.84)); c.beginPath(); c.arc(0, 0, r * 0.88, 0, TAU); c.fill();
    if (ready(img)) {
      c.save(); c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.clip();
      const [sx, sy, crop] = print.crop, d = r * 0.86 * 2 * print.fit;
      // The crop may reach past the picture's edge: draw the whole picture, placed so the crop fills the disc.
      const s = d / crop; c.drawImage(img, -d / 2 - sx * s, -d / 2 - sy * s, print.picture.width * s, print.picture.height * s);
      c.restore();
    }
    c.strokeStyle = ink(STICKER_RING[art], 0.5); c.lineWidth = Math.max(1, r * 0.06); c.beginPath(); c.arc(0, 0, r * 0.88, 0, TAU); c.stroke();
    if (!back) { c.strokeStyle = ink(C.white, 0.75); c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, r * 0.7, Math.PI * 1.08, Math.PI * 1.45); c.stroke(); }
    c.restore();
  };

  const drawAya = (c: CanvasRenderingContext2D) => {
    if (ayaIn <= 0) return;
    const behind = ayaBehind, side = sitting.ayaLeft ? -1 : 1;
    const homeX = L.aya.x;
    const enter = still() ? 1 : backOut(ayaIn), fromX = side < 0 ? -L.aya.height : L.width + L.aya.height;
    const restX = lerp(fromX, homeX, enter);
    // At the finale she goes round the back of the bottle: further away, so smaller and higher on the bench.
    const feetY = lerp(L.aya.y, benchFarY() + (L.base.y - benchFarY()) * 0.34, ease(behind));
    ayaX = lerp(restX, L.base.x, ease(behind));
    const size = L.aya.height * lerp(1, 0.84, ease(behind));
    const moving = (behind > 0.02 && behind < 0.98) || ayaIn < 0.98;
    const hop = ayaHop > 0 ? Math.sin(ayaHop * Math.PI) : moving ? Math.abs(Math.sin(time * 9)) * 0.5 : 0;
    const landing = ayaHop > 0.82 ? (ayaHop - 0.82) / 0.18 : 0;
    const breathe = still() ? 0 : Math.sin(time * 1.9) * 0.012;
    const which = moving ? 'side' : behind >= 0.98 || ayaHop > 0 || act === 'finale' ? 'front' : 'sitting';
    const img = ayaPics[which], pic = KIT_AYA[which];
    if (!ready(img)) return;
    const h = size * (which === 'sitting' ? 0.9 : 1), w = h * pic.width / pic.height;
    // The side and sitting pictures face right as stored: turn her toward the glass (or the way she walks).
    const faceRight = which === 'front' ? true : behind > 0.02 && behind < 0.98 ? side < 0 : ayaIn < 0.98 ? side < 0 : side < 0;
    shade(c, ayaX, feetY + 2, w * 0.42 * (1 - hop * 0.3), w * 0.1, 0.34 * (1 - hop * 0.4));
    c.save(); c.translate(ayaX, feetY - hop * size * 0.16); c.scale((faceRight ? 1 : -1) * (1 + landing * 0.06), 1 + breathe - landing * 0.07 + hop * 0.04);
    c.rotate(still() ? 0 : clamp(ayaLean, -0.12, 0.12));
    c.drawImage(img, -w / 2, -h, w, h); c.restore();
  };

  /** Everything behind the bottle. Painted on the screen, and once more into the glass's own buffer to be bent. */
  const drawBack = (c: CanvasRenderingContext2D, forGlass: boolean) => {
    const drift = still() ? 0 : px * 9 * L.k * 1.2;
    if (ready(room)) c.drawImage(room, plateX(0) - drift - 12 * L.k, plateY(0), PLATE.width * L.k + 24 * L.k, PLATE.roomHeight * L.k);
    else { c.fillStyle = ink(C.pearl); c.fillRect(0, 0, L.width, L.height); }
    const tint = lightNow(), sunUp = act === 'finale' ? pose.sun : 0, dim = act === 'finale' ? pose.dim : 0;
    // Daylight grades the room a little differently each sitting; the finale lowers the sun into the arch.
    if (sitting.light !== 'day') { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = ink(sitting.light === 'warm' ? mixRgb(C.butter, C.white, 0.9) : mixRgb(C.sky, C.white, 0.84), 1); c.fillRect(0, 0, L.width, benchFarY() + 40); c.restore(); }
    if (ready(bench)) c.drawImage(bench, plateX(0), plateY(PLATE.benchTop), PLATE.width * L.k, PLATE.benchHeight * L.k);
    if (dim > 0) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = ink(mixRgb(C.white, mixRgb(C.indigo, C.slate, 0.5), 0.66), 1); c.globalAlpha = dim; c.fillRect(0, 0, L.width, L.height); c.restore(); }
    if (sunUp > 0) {
      const s = sunAt(), reach = Math.max(L.width, L.height);
      // The valley sun, low in the arch: a wide warm bloom, a white heart, long shafts through the dusty air.
      glowBlob(c, s.x, s.y, reach * 0.62, reach * 0.62, mixRgb(C.orange, C.sun, 0.55), 0.42 * sunUp);
      glowBlob(c, s.x, s.y, 260 * L.k, 260 * L.k, mixRgb(C.sun, C.white, 0.5), 0.75 * sunUp);
      glowBlob(c, s.x, s.y, 70 * L.k, 70 * L.k, C.white, sunUp);
      if (!forGlass) {
        c.save(); c.globalCompositeOperation = 'screen';
        for (let n = 0; n < 7; n++) {
          const swing = still() ? 0 : Math.sin(time * 0.3 + n * 1.7) * 0.03, at = Math.PI / 2 + (n - 3) * 0.2 + lightX * 0.22 + swing, far = reach * 1.3;
          const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, far); g.addColorStop(0, ink(mixRgb(C.butter, C.white, 0.5), 0.13 * sunUp)); g.addColorStop(0.55, ink(C.butter, 0.05 * sunUp)); g.addColorStop(1, ink(C.butter, 0));
          c.fillStyle = g;
          for (const wide of [0.085 + (n % 3) * 0.02, 0.05, 0.022]) { c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(at - wide) * far, s.y + Math.sin(at - wide) * far); c.lineTo(s.x + Math.cos(at + wide) * far, s.y + Math.sin(at + wide) * far); c.closePath(); c.fill(); }
        }
        c.restore();
      }
      // The glass throws its colour up the walls and over the ceiling; the patches wander with the light.
      const wide = L.width, hi = benchFarY(), drift2 = still() ? 0 : time * 0.22;
      const spots: [number, number, number, number, number][] = [[0.14, 0.4, 0.34, 0.5, 0.3], [0.86, 0.36, 0.32, 0.48, -0.4], [0.5, 0.1, 0.6, 0.24, 0], [0.31, 0.66, 0.24, 0.3, 0.8], [0.72, 0.64, 0.26, 0.32, -0.7], [0.04, 0.72, 0.2, 0.26, 0.2], [0.96, 0.7, 0.2, 0.28, 0.5]];
      spots.forEach(([fx0, fy0, fw, fh, turn], n) => {
        const sway = -lightX * (0.05 + (n % 3) * 0.03) + Math.sin(drift2 * (1 + n * 0.3) + n) * 0.012;
        const colour = rainbow > 0 ? [C.rose, C.sun, C.sea, C.lilac][n % 4] : made.tint === 'clear' && soak >= 1 ? [C.skyDeep, C.blossom, C.butter, C.celadon][n % 4] : n % 3 === 2 && made.stickers.length ? mixRgb(tint, STICKER_RING[made.stickers[n % made.stickers.length].art], 0.5) : n % 2 ? mixRgb(tint, C.white, 0.2) : tint;
        patch(c, (fx0 + sway) * wide, fy0 * hi + Math.cos(drift2 + n) * 5, fw * Math.min(wide, hi * 1.6), fh * hi, colour, 0.62 * sunUp, turn + lightX * 0.3);
      });
    }
    if (rainbow > 0 && !forGlass) {
      // The secret: a bow of light from arch to arch.
      const cx0 = L.base.x, cy0 = benchFarY() + 30 * L.k, r0 = Math.min(L.width * 0.62, 620 * L.k), a = Math.min(1, rainbow * 2) * 0.34;
      c.save(); c.globalCompositeOperation = 'screen'; c.lineWidth = 15 * L.k;
      [C.poppy, C.orange, C.sun, token(style, '--mk-spring'), C.sea, C.lilac].forEach((col, n) => { c.strokeStyle = ink(col, a); c.beginPath(); c.arc(cx0, cy0, r0 - n * 14 * L.k, Math.PI, Math.PI * (1 + Math.min(1, (1 - rainbow) * 3.2 + 0.1))); c.stroke(); });
      c.restore();
    }
    // The glow pad the bottle stands on: a heat plate first, a light pad after.
    const padR = Math.max(radiusV(1) * 1.32, 62 * L.unit), e = G.eFoot, padColour = heat > 0.05 ? mixRgb(tint, C.orange, heat) : tint, pulse = still() ? 0 : Math.sin(time * 2.2) * 0.05;
    c.save(); c.translate(L.base.x, L.base.y + 1);
    c.fillStyle = ink(C.shadow, 0.16); c.beginPath(); c.ellipse(0, 4 * L.unit, padR * 1.05, padR * e * 1.05, 0, 0, TAU); c.fill();
    c.fillStyle = ink(mixRgb(C.pearl, C.white, 0.5)); c.beginPath(); c.ellipse(0, 0, padR, padR * e, 0, 0, TAU); c.fill();
    c.strokeStyle = ink(C.teal, 0.55); c.lineWidth = Math.max(1.2, 1.8 * L.unit); c.beginPath(); c.ellipse(0, 0, padR * 0.9, padR * e * 0.9, 0, 0, TAU); c.stroke();
    const pg = c.createRadialGradient(0, 0, 0, 0, 0, padR * 0.86); pg.addColorStop(0, ink(mixRgb(padColour, C.white, 0.6), 0.95)); pg.addColorStop(0.6, ink(mixRgb(padColour, C.white, 0.3), 0.7 + pulse)); pg.addColorStop(1, ink(padColour, 0.12));
    c.scale(1, e); c.fillStyle = pg; c.beginPath(); c.arc(0, 0, padR * 0.86, 0, TAU); c.fill(); c.restore();
    glowBlob(c, L.base.x, L.base.y, padR * 2.1, padR * 2.1 * e, padColour, (0.2 + heat * 0.34 + glowUp * 0.25 + pulse) * (1 + sunUp * 0.4));
    // A disc under the bottle, seen through its foot.
    for (const d of discs) if (d.under || (act === 'colour' && d.y < L.base.y - 4)) drawDisc(c, d);
    // The bottle's shadow is its own colour, with the light it gathers inside: toward the child, since the windows are behind it.
    const len = G.height * (0.2 + sunUp * 0.5), wide = radiusV(0.6) * (1.05 + sunUp * 0.5), sx = L.base.x - lightX * len * (0.2 + sunUp * 0.9), sy = L.base.y + len * 0.42 * (G.eFoot / 0.375);
    shade(c, sx, sy, wide * 1.25, len * 0.62, 0.2 + sunUp * 0.12);
    shade(c, L.base.x, L.base.y + G.capFoot * 0.35, radiusV(1) * 1.1, G.capFoot * 1.5, 0.3);
    patch(c, sx, sy + len * 0.08, wide * (1.7 + sunUp), len * (0.9 + sunUp * 0.5), tint, 0.34 + sunUp * 0.5 + glowUp * 0.2, -lightX * 0.5);
    glowBlob(c, sx, sy + len * 0.05, wide * 0.6, len * 0.28, mixRgb(tint, C.white, 0.55), 0.3 + sunUp * 0.45);
    if (sunUp > 0) for (const s of made.stickers) { const at = slotSpot(s.slot); glowBlob(c, sx + at.view.x * wide * 0.8, sy + len * (0.3 - at.v * 0.5), wide * 0.24, len * 0.1, STICKER_RING[s.art], 0.4 * sunUp * (at.view.front ? 0.5 : 1)); }
    if (ayaBehind > 0.02 || forGlass || act !== 'finale') drawAya(c);
    // Stickers on the far side show through the glass, back to front.
    if (forGlass) for (const s of made.stickers) { const at = slotSpot(s.slot); if (!at.view.front) drawSticker(c, s.art, at.x, at.y, at.size, at.view.scaleX, 0.82, true); }
  };
  const drawDisc = (c: CanvasRenderingContext2D, d: DiscState) => {
    const img = discPics[d.tint]; if (!ready(img)) return;
    const index = discs.indexOf(d), enter = still() ? (act === 'colour' || d.under ? 1 : 0) : d.under ? 1 : backOut(clamp(discsIn * 1.4 - index * 0.1, 0, 1));
    if (enter <= 0.01) return;
    const w = discWidthAt(d.y) * (1 + d.lift * 0.12) * enter, h = w * KIT_DISCS[d.tint].height / KIT_DISCS[d.tint].width, drop = (1 - enter) * 40;
    shade(c, d.x + w * 0.06, d.y + h * 0.42 + d.lift * 8, w * 0.46, h * 0.36, 0.3 - d.lift * 0.1);
    if (!d.under) glowBlob(c, d.x, d.y + h * 0.3, w * 0.5, h * 0.4, TINT_LIGHT[d.tint], 0.3);
    c.save(); c.globalAlpha = Math.min(1, enter * 1.4); c.drawImage(img, d.x - w * DISC_CENTRE, d.y - h * 0.5 - d.lift * 12 + drop, w, h); c.restore();
  };

  const silhouette = (c: CanvasRenderingContext2D) => {
    const steps = 44, rt = radiusV(0), rb = radiusV(1);
    c.beginPath();
    c.ellipse(axisV(0), G.top, rt, Math.max(0.5, G.capTop), 0, Math.PI, TAU);
    for (let n = 0; n <= steps; n++) { const v = n / steps; c.lineTo(axisV(v) + radiusV(v), yV(v)); }
    c.ellipse(axisV(1), L.base.y, rb, Math.max(0.5, G.capFoot), 0, 0, Math.PI);
    for (let n = steps; n >= 0; n--) { const v = n / steps; c.lineTo(axisV(v) - radiusV(v), yV(v)); }
    c.closePath();
  };
  let frameData: GlassFrame | null = null, glassBox = { x: 0, y: 0, width: 0, height: 0, scale: 1 };
  const sizeBuffers = () => {
    const halfW = 182 * L.unit, top = (profile.height * 1.26 + 30) * L.unit, bottom = 50 * L.unit;
    const width = halfW * 2, height = Math.max(top, (270 * 1.26 + 30) * L.unit) + bottom;
    const scale = Math.min(1.25, Math.sqrt(190000 / (width * height)));
    glassBox = { x: L.base.x - halfW, y: L.base.y + bottom - height, width, height, scale };
  };
  const drawGlass = (c: CanvasRenderingContext2D) => {
    if (!glass) return;
    const b = glassBox, s = b.scale, behind = glass.resize(b.width * s, b.height * s);
    if (!behind) return;
    const bw = glass.width, bh = glass.height;
    behind.setTransform(bw / b.width, 0, 0, bh / b.height, -b.x * bw / b.width, -b.y * bh / b.height);
    behind.clearRect(b.x, b.y, b.width, b.height);
    drawBack(behind, true);
    if (!frameData || frameData.axis.length !== bh) frameData = { axis: new Float32Array(bh), radius: new Float32Array(bh), topRow: 0, footRow: 0, waterRow: bh + 9, waterTilt: 0, tintFrom, tintTo, tintFront: 0, frost: 0, heat: 0, glow: 0, rainbow: 0, light: 0, time: 0, sky: C.sky, ember: mixRgb(C.orange, C.poppy, 0.3), flame: mixRgb(C.sun, C.white, 0.3), veil: C.snow };
    const f = frameData, sy = bh / b.height, sx = bw / b.width, rt = radiusV(0), rb = radiusV(1);
    for (let j = 0; j < bh; j++) {
      const y = b.y + (j + 0.5) / sy; let r = 0, ax = L.base.x;
      if (y < G.top) { const d = (G.top - y) / Math.max(0.5, G.capTop); if (d < 1) { r = rt * Math.sqrt(1 - d * d); ax = axisV(0); } }
      else if (y <= L.base.y) { const v = (y - G.top) / G.height; r = radiusV(v); ax = axisV(v); }
      else { const d = (y - L.base.y) / Math.max(0.5, G.capFoot); if (d < 1) { r = rb * Math.sqrt(1 - d * d); ax = axisV(1); } }
      f.radius[j] = r * sx; f.axis[j] = (ax - b.x) * sx;
    }
    f.topRow = (G.top - b.y) * sy; f.footRow = (L.base.y - b.y) * sy;
    f.waterRow = water > 0.004 ? (L.base.y - water * G.height - b.y) * sy : bh + 9; f.waterTilt = slosh * 6 * sy;
    f.tintFrom = tintFrom; f.tintTo = tintTo;
    f.tintFront = soak >= 1 ? -9 : (L.base.y + G.capFoot - soakFront(soak) * (G.height + G.capFoot + G.capTop) - b.y) * sy;
    f.frost = frostShown(made.finish, rub); f.heat = heat; f.glow = clamp(glowUp * 0.6 + (act === 'finale' ? pose.sun * 0.55 : 0) + (act === 'colour' || act === 'dress' ? 0.12 : 0), 0, 1);
    f.rainbow = Math.min(1, rainbow * 1.6); f.light = clamp(-px * 0.8 + lean.v * 0.05 + lightX * 0.8, -1.6, 1.6); f.time = still() ? 0 : time;
    const out = glass.render(f); if (!out) return;
    // Hot glass throws its own light on the air round it.
    if (heat > 0.03) { glowBlob(c, L.base.x, yV(0.66), radiusV(0.6) * 2.6, G.height * 0.8, C.orange, heat * 0.34); glowBlob(c, L.base.x, yV(0.86), radiusV(0.8) * 1.5, G.height * 0.34, C.sun, heat * 0.4); }
    c.save(); silhouette(c); c.clip(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(out, b.x, b.y, b.width, b.height); c.restore();
  };

  const drawFront = (c: CanvasRenderingContext2D) => {
    const tint = lightNow(), frost = frostShown(made.finish, rub), crisp = 1 - frost * 0.55, deep = mixRgb(mixRgb(tint, C.slate, 0.55), C.shadow, 0.2);
    // The outline is only a hairline of the glass's own deep colour: the edge is made by the bands inside it.
    c.save(); silhouette(c); c.strokeStyle = ink(deep, 0.3); c.lineWidth = 1.1; c.lineJoin = 'round'; c.stroke(); c.restore();
    // The lip: a thick ring of glass. Seen from below (above the horizon) its near edge is the upper one.
    const rt = radiusV(0), lipY = G.top, lipR = Math.max(0.5, G.capTop), near = G.eTop >= 0;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = ink(deep, 0.34 * crisp); c.lineWidth = Math.max(1, 2.2 * L.unit); c.beginPath(); c.ellipse(axisV(0), lipY, rt * 0.98, lipR, 0, near ? Math.PI : 0, near ? TAU : Math.PI); c.stroke();
    c.strokeStyle = ink(C.white, 0.92 * crisp); c.lineWidth = Math.max(1.4, 2.6 * L.unit); c.beginPath(); c.ellipse(axisV(0), lipY, rt * 0.97, lipR, 0, near ? 0.15 : Math.PI + 0.15, near ? Math.PI - 0.15 : TAU - 0.15); c.stroke();
    c.strokeStyle = ink(C.white, 0.5 * crisp); c.lineWidth = Math.max(1, 1.4 * L.unit); c.beginPath(); c.ellipse(axisV(0.03), yV(0.03), radiusV(0.03) * 0.94, Math.abs(radiusV(0.03) * ringRatio(plateRow(L, yV(0.03)))) + 0.5, 0, near ? 0.3 : Math.PI + 0.3, near ? Math.PI - 0.3 : TAU - 0.3); c.stroke();
    // The foot: thick glass, a bright near edge and the dark lens of the base above it.
    const rb = radiusV(1), fy = L.base.y, fe = G.eFoot;
    c.strokeStyle = ink(deep, 0.42 * crisp); c.lineWidth = Math.max(1.6, 4.5 * L.unit); c.beginPath(); c.ellipse(axisV(1), fy - 5 * L.unit, rb * 0.93, rb * fe * 0.93, 0, 0.1, Math.PI - 0.1); c.stroke();
    c.strokeStyle = ink(C.white, 0.9 * crisp); c.lineWidth = Math.max(1.2, 2 * L.unit); c.beginPath(); c.ellipse(axisV(1), fy, rb * 0.9, rb * fe * 0.9, 0, 0.25, Math.PI - 0.25); c.stroke();
    c.strokeStyle = ink(C.white, 0.42 * crisp); c.lineWidth = Math.max(1, 1.3 * L.unit); c.beginPath(); c.ellipse(axisV(1), fy - 9 * L.unit, rb * 0.86, rb * fe * 0.8, 0, 0.3, Math.PI - 0.3); c.stroke();
    c.strokeStyle = ink(deep, 0.2 * crisp); c.lineWidth = Math.max(1, 1.2 * L.unit); c.beginPath(); c.ellipse(axisV(1), fy, rb * 0.97, rb * fe * 0.97, 0, Math.PI, TAU); c.stroke();
    c.restore();
    // Water, at the finale: its surface ring, the bright line where it meets the near glass, bubbles.
    if (water > 0.004) {
      const v = 1 - water, wy = yV(v), wr = radiusV(v) * 0.93, we = ringRatio(plateRow(L, wy)), ry = Math.max(0.8, Math.abs(wr * we)), tilt = Math.atan(slosh * 0.35);
      c.save(); silhouette(c); c.clip(); c.translate(axisV(v), wy); c.rotate(tilt);
      c.fillStyle = ink(mixRgb(tint, C.white, 0.7), 0.26); c.beginPath(); c.ellipse(0, 0, wr, ry, 0, 0, TAU); c.fill();
      c.strokeStyle = ink(deep, 0.3); c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, wr, ry, 0, we >= 0 ? Math.PI : 0, we >= 0 ? TAU : Math.PI); c.stroke();
      c.strokeStyle = ink(C.white, 0.95); c.lineWidth = Math.max(1.4, 2.2 * L.unit); c.beginPath(); c.ellipse(0, 0, wr, ry, 0, we >= 0 ? 0.08 : Math.PI + 0.08, we >= 0 ? Math.PI - 0.08 : TAU - 0.08); c.stroke();
      c.restore();
      if (!still()) { c.save(); silhouette(c); c.clip(); for (const bub of bubbles) { const rise = (bub.v + time * bub.speed) % 1, bv = 1 - rise * water * 0.96, r = radiusV(bv) * 0.8, x = axisV(bv) + (bub.u + Math.sin(time * 3 + bub.phase) * 0.06) * r, y = yV(bv), br = bub.r * L.unit * (0.7 + rise * 0.5); c.strokeStyle = ink(C.white, 0.75); c.lineWidth = 1; c.beginPath(); c.arc(x, y, br, 0, TAU); c.stroke(); c.fillStyle = ink(C.white, 0.5); c.beginPath(); c.arc(x - br * 0.3, y - br * 0.3, br * 0.32, 0, TAU); c.fill(); } c.restore(); }
    }
    // Stickers on the near side, wrapped to the glass.
    const front = made.stickers.map(s => ({ s, at: slotSpot(s.slot) })).filter(q => q.at.view.front).sort((a, b) => a.at.view.depth - b.at.view.depth);
    for (const { s, at } of front) drawSticker(c, s.art, at.x, at.y, at.size, at.view.scaleX, 1);
    // A ring where a carried sticker would land.
    if (carry && carry.hot !== null) { const at = slotSpot(carry.hot); c.save(); c.translate(at.x, at.y); c.scale(Math.max(0.2, at.view.scaleX), 1); c.strokeStyle = ink(C.signal, 0.95); c.lineWidth = 3; c.setLineDash([7, 6]); c.lineDashOffset = -time * 30; c.beginPath(); c.arc(0, 0, at.size / 2 + 3, 0, TAU); c.stroke(); c.restore(); }
    // Glints: small four-point stars where the shoulder catches a window.
    if (frost < 0.6) {
      const twinkle = (v: number, u: number, phase: number, size: number) => {
        const a = still() ? 0.75 : 0.45 + 0.4 * Math.sin(time * 2.4 + phase) + glint * 0.5; if (a <= 0.05) return;
        const x = axisV(v) + u * radiusV(v), y = yV(v), r = size * L.unit * (0.8 + a * 0.5);
        c.save(); c.translate(x, y); c.globalCompositeOperation = 'screen'; c.fillStyle = ink(C.white, Math.min(1, a));
        for (let n = 0; n < 2; n++) { c.rotate(Math.PI / 2 * n); c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 0.14, r, 0); c.quadraticCurveTo(0, r * 0.14, -r, 0); c.fill(); }
        c.restore(); glowBlob(c, x, y, r * 0.7, r * 0.7, C.white, a * 0.6);
      };
      const light = clamp(-px * 0.07 + lightX * 0.07, -0.14, 0.14);
      twinkle(0.3, -0.5 + light, 0, 13); twinkle(0.62, 0.62 + light, 2.1, 8); twinkle(0.12, -0.3 + light, 4, 6);
    }
    // The discs and the sticker card, on the bench in front.
    for (const d of discs) if (!d.under && !(act === 'colour' && d.y < L.base.y - 4)) drawDisc(c, d);
    if (cardIn > 0.01) {
      const k = still() ? 1 : backOut(cardIn), card = L.card, dy = (1 - k) * 60;
      c.save(); c.globalAlpha = Math.min(1, cardIn * 1.6); c.translate(0, dy);
      // A sticker sheet propped on a pale wood ledge: narrower at the top, as a sheet leaning back is.
      const lean2 = Math.min(10, card.width * 0.018), ledge = Math.max(7, card.height * 0.075), bottom = card.y + card.height;
      shade(c, card.x + card.width / 2, bottom + ledge * 0.9, card.width * 0.56, Math.max(7, card.height * 0.11), 0.4);
      const rad = Math.min(16, card.height * 0.16), g = c.createLinearGradient(0, card.y, 0, bottom); g.addColorStop(0, ink(C.surface)); g.addColorStop(1, ink(mixRgb(C.pearl, C.mist, 0.4)));
      c.fillStyle = ink(C.shadow, 0.14); c.beginPath(); c.moveTo(card.x + lean2 + 5, card.y + 5); c.lineTo(card.x + card.width - lean2 + 5, card.y + 5); c.lineTo(card.x + card.width + 5, bottom); c.lineTo(card.x + 5, bottom); c.closePath(); c.fill();
      c.fillStyle = g; c.beginPath(); c.moveTo(card.x + lean2 + rad, card.y); c.lineTo(card.x + card.width - lean2 - rad, card.y); c.quadraticCurveTo(card.x + card.width - lean2, card.y, card.x + card.width - lean2 + 1, card.y + rad);
      c.lineTo(card.x + card.width, bottom); c.lineTo(card.x, bottom); c.lineTo(card.x + lean2 - 1, card.y + rad); c.quadraticCurveTo(card.x + lean2, card.y, card.x + lean2 + rad, card.y); c.closePath(); c.fill();
      c.strokeStyle = ink(C.graphite, 0.1); c.lineWidth = 1; c.stroke();
      const wood = c.createLinearGradient(0, bottom - 2, 0, bottom + ledge); wood.addColorStop(0, ink(mixRgb(C.wood, C.white, 0.35))); wood.addColorStop(1, ink(C.woodDark));
      c.fillStyle = wood; c.beginPath(); c.roundRect(card.x - 8, bottom - 3, card.width + 16, ledge + 3, ledge * 0.45); c.fill();
      c.fillStyle = ink(C.white, 0.35); c.fillRect(card.x - 4, bottom - 2, card.width + 8, 1.4);
      sitting.card.forEach((art, i) => { const s = card.stickers[i], held = carry?.art === art || flying.some(f => f.art === art && f.slot !== null); c.strokeStyle = ink(C.graphite, 0.1); c.lineWidth = 1; c.beginPath(); c.arc(s.x, s.y, card.size / 2, 0, TAU); c.stroke(); if (!held) drawSticker(c, art, s.x, s.y + (still() ? 0 : Math.sin(time * 2 + i) * 1.2), card.size * 0.94); });
      c.restore();
    }
    for (const f of flying) {
      const to = f.slot !== null ? slotSpot(f.slot) : null, t = ease(f.t), tx = to ? to.x : f.x1 ?? f.x0, ty = to ? to.y : f.y1 ?? f.y0;
      const x = lerp(f.x0, tx, t), y = lerp(f.y0, ty, t) - Math.sin(t * Math.PI) * 46 * (to ? 1 : 0.5), size = lerp(L.card.size, to ? to.size : L.card.size * 0.9, t);
      drawSticker(c, f.art, x, y, size * (1 + Math.sin(t * Math.PI) * 0.18), to ? lerp(1, to.view.scaleX, t) : 1, to ? 1 : 1 - t * 0.2, false, 1 - t);
    }
    if (carry) drawSticker(c, carry.art, carry.x, carry.y - 30, L.card.size * 1.18, 1, 1, false, 1);
    // The finale's can, tipping water into the mouth.
    if (act === 'finale' && pose.can > 0.01 && ready(can)) {
      const side = sitting.ayaLeft ? -1 : 1, w = 96 * L.unit, h = w * KIT_CAN.height / KIT_CAN.width, mouthX = axisV(0), mouthY = G.top - Math.abs(G.capTop);
      const cx0 = lerp(L.base.x + side * (radiusV(0.6) + w), mouthX + side * w * 0.66, ease(pose.can)), cy0 = lerp(L.base.y - h * 0.5, mouthY - h * 0.72, ease(pose.can));
      c.save(); c.globalAlpha = Math.min(1, pose.can * 3); c.translate(cx0, cy0); c.scale(-side, 1); c.rotate(pose.tip * 0.62); c.drawImage(can, -w / 2, -h / 2, w, h); c.restore();
      if (pose.flow) { const sx0 = cx0 - side * w * 0.42, sy0 = cy0 + h * 0.02; c.save(); c.lineCap = 'round'; c.strokeStyle = ink(mixRgb(C.skyDeep, C.white, 0.5), 0.75); c.lineWidth = 4 * L.unit; c.beginPath(); c.moveTo(sx0, sy0); c.quadraticCurveTo(mouthX + side * 4, sy0 - 2, mouthX, yV(1 - Math.max(0.02, water))); c.stroke(); c.strokeStyle = ink(C.white, 0.8); c.lineWidth = 1.4 * L.unit; c.stroke(); c.restore(); }
    }
    if (act === 'finale' && ayaBehind <= 0.02) drawAya(c);
    // Dust in the window light.
    if (!still()) for (const m of motes) { const x = ((m.x + time * m.speed) % 1) * L.width, y = (m.y + Math.sin(time * 0.4 + m.phase) * 0.03) * L.height * 0.8, a = 0.16 + 0.14 * Math.sin(time * 1.3 + m.phase); glowBlob(c, x, y, m.r * 2.4, m.r * 2.4, C.white, a + (act === 'finale' ? pose.sun * 0.25 : 0)); }
    if (hintShown) drawHint(c, hintShown, hintT);
  };

  /** The ghost hand: shows the chapter's gesture on the real thing, never in the way of a touch. */
  const drawHint = (c: CanvasRenderingContext2D, hint: HintId, t: number) => {
    const loop = (t % 1.7) / 1.7, go = ease(clamp((loop - 0.12) / 0.6, 0, 1)), alpha = Math.min(1, loop / 0.1, (1 - loop) / 0.18) * 0.92;
    let x = L.base.x, y = yV(0.5);
    if (hint === 'pull') { x = L.base.x + radiusV(0.4) * 0.2; y = lerp(yV(0.42), yV(0.42) - G.height * 0.3, go); }
    else if (hint === 'disc') { const d = discs.find(q => q.tint !== made.tint && q.tint !== 'clear') ?? discs[1], i = discs.indexOf(d), from = discHome(i); x = lerp(from.x, L.base.x, go); y = lerp(from.y, L.base.y, go); }
    else if (hint === 'rub') { x = L.base.x + Math.sin(loop * TAU * 2.5) * radiusV(0.6) * 0.6; y = lerp(yV(0.4), yV(0.7), loop); }
    else if (hint === 'stickOn') { const from = L.card.stickers[0], slot = nextFreeSlot(made.stickers, rotation), to = slot !== null ? slotSpot(slot) : { x: L.base.x, y: yV(0.5) }; x = lerp(from.x, to.x, go); y = lerp(from.y, to.y, go); }
    else if (hint === 'turn') { x = lerp(L.base.x - radiusV(0.6) * 0.7, L.base.x + radiusV(0.6) * 0.7, go); y = yV(0.55); }
    const s = clamp(L.unit * 1.5, 1.1, 2.2) * (1 - 0.08 * Math.sin(Math.min(1, loop / 0.14) * Math.PI));
    c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(s, s);
    c.strokeStyle = ink(C.signal, 0.9); c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 9 + 2 * Math.sin(t * 6), 0, TAU); c.stroke();
    // A small mitten: fingertip on the spot, palm below and to the side.
    c.translate(1, 1); c.rotate(-0.32);
    const hand = () => { c.beginPath(); c.roundRect(-4.2, -2, 8.4, 20, 4.2); c.roundRect(-7, 11, 17, 17, 7); c.roundRect(8, 13, 7, 12, 3.5); };
    c.fillStyle = ink(C.shadow, 0.25); c.save(); c.translate(1.5, 2.5); hand(); c.fill(); c.restore();
    c.fillStyle = ink(C.surface); hand(); c.fill(); c.strokeStyle = ink(C.graphite, 0.55); c.lineWidth = 1.1; hand(); c.stroke();
    c.restore();
  };

  const paint = () => {
    const c = ctx; if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, L.width, L.height);
    drawBack(c, false); drawGlass(c); drawFront(c);
  };

  const loop = (now: number) => {
    frame = 0; if (!alive) return;
    // A slow device still tells the story in the same time: up to a tenth of a second a frame.
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60; last = now;
    if (hold > 0) hold -= dt; else step(dt);
    paint();
    if (document.visibilityState !== 'hidden') frame = requestAnimationFrame(loop);
  };
  const onVisibility = () => { if (document.visibilityState === 'hidden') { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; } else if (alive && !frame) frame = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', onVisibility);

  const resize = (width: number, height: number) => {
    const first = L.width !== width || L.height !== height;
    L = stageLayout(width, height, sitting.ayaLeft, lift);
    dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(3400000 / Math.max(1, L.width * L.height)));
    const pw = Math.round(L.width * dpr), ph = Math.round(L.height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    if (first) discs.forEach((d, i) => { const to = d.under ? underSpot() : discHome(i); d.x = to.x; d.y = to.y; });
    sizeBuffers(); sizeGlass(); ayaX = L.aya.x;
    emit({ type: 'spots' });
    if (!frame && alive) frame = requestAnimationFrame(loop);
  };

  return {
    resize,
    setAct(next) {
      if (next === act) return;
      act = next; actT = 0; hintClock = 0; hintShown = null; hintT = 0; gesture = null; carry = null;
      if (next === 'shape' || next === 'dress') sound.ambience('hall');
      if (next === 'colour') { stretchTo = 1; leanTo = 0; target = oneShape(made.shape); fxAt(L.base.x, yV(0.5), 'dust', { tones: ['white', 'sky-pale'], count: 12, spread: 1.3 }); kick(0.04); }
      if (next === 'dress') { for (const d of discs) d.under = d.under && d.tint === made.tint; autoRub = 0; rub = 0; }
      if (next === 'finale') { finaleT = 0; pose = finalePose(0, still()); freed = false; rotTo = snapRotation(rotation); for (const f of flying) f.t = 1; }
      emit({ type: 'spots' });
    },
    down, move, up, cancel, command,
    layout: () => L,
    bottle: () => ({ kind: 'bottle', shape: made.shape, tint: made.tint, finish: made.finish, stickers: made.stickers.map((s: BottleStickerPlacement) => ({ art: s.art, slot: s.slot })) }),
    spots() {
      const half = Math.max(radiusV(0.6), 40 * L.unit) * 1.1;
      return {
        bottle: { x: L.base.x - half, y: G.top - 8, width: half * 2, height: G.height + G.capFoot + 12 },
        aya: ayaBox(),
        stickers: made.stickers.map(s => ({ s, at: slotSpot(s.slot, rotTo) })).filter(q => q.at.view.front && q.at.view.scaleX > 0.3).map(q => ({ slot: q.s.slot, art: q.s.art, x: q.at.x, y: q.at.y, size: q.at.size })),
      };
    },
    dispose() {
      alive = false; if (frame) cancelAnimationFrame(frame); frame = 0;
      document.removeEventListener('visibilitychange', onVisibility);
      glass?.dispose(); causticCanvas = null; pictures.clear();
      try { ctx?.clearRect(0, 0, canvas.width, canvas.height); } catch { /* Canvas gone. */ }
    },
  };
}
