import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Play, RotateCcw, RotateCw } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import './windupRace.css';
import { KEY_AT, KeyDial, ORBIT, ROVER_LONG, RoverCar, bowWidth, coilPath } from './windupCar';
import { CHEER_ART, KIT_ART } from './windupKit';
import { BACK, BACKDROP_X0, Backdrop, Catcher, ChalkMarks, EDGE, FLOOR_TOP, Finish, Hoops, KnitBall, KnitRoll, LaneMarks, PEP_BACK, POPPERS, POPPER_HIGH, PUFFS, Pep, PetalPin, Poppers, Puffs, SceneDefs, StartSign, TRACK_TOYS, Terrain, Toys, WALL_HIGH, trackLine } from './windupRaceArt';
import { createRacerSound, type RacerSound } from './windupRaceAudio';
import { WINDUP_RACE_COPY } from './windupRaceCopy';
import { AXLE_HALF, CAR_HALF, MAX_CLICKS, PLAY_LENGTH, addChalk, closeCallAt, dragKey, nextTrack, pointAt, roomLight, sampleAt, shapeOf, simulate, tension, trackSet, wind, type RunResult, type Track } from './windupRaceRules';

/** wind → crouch → run → (flag → swap → wind of the next trail, or party → done) or (rest → return → wind). */
type Phase = 'wind' | 'crouch' | 'run' | 'rest' | 'return' | 'flag' | 'swap' | 'party' | 'done';
type Note = 'none' | 'nowind' | 'full';

/** Rover sits at rest a moment, the chalk mark appears, then it rolls home. */
const REST_MS = 1700, RETURN_S = 0.9;
/** The flower opens and the bell rings this long before the next trail. */
const FLAG_MS = 2000, SWAP_MS = 950;
/** The last flower: every bloom springs up, Rover dances, then the finish is handed over. */
const PARTY_MS = 2500;
/** The held breath between pressing Go and letting go. */
const CROUCH_S = 0.4;
const KEY_REST = 24;
/** The wall is far away: it slides at this share of the trail's speed. */
const WALL_DEPTH = 0.55;
const PIN_GAP_S = 0.075, PIN_FALL_S = 0.18;
/** A close run is watched at this share of its speed. */
const SLOW_RATE = 0.5;
/** The hint hand: how long one showing lasts, and how long a quiet spell is before it comes back. */
const DEMO_S = 2.9, QUIET_MS = 6000;

/** What this visit has already shown: the hand never returns for a gesture the child has made. */
const taught = { key: false, go: false };
/** Plays finished this visit: Play again moves on to the next set of trails and the next light. */
const visit = { plays: 0 };

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (f: number) => (f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f));
const fillLine = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));

/** Where Rover's middle is and how it leans: the midpoint of its two axles. */
function carPose(track: Track, s: number) {
  const rear = pointAt(track, s - AXLE_HALF), front = pointAt(track, s + AXLE_HALF);
  return { x: (rear.x + front.x) / 2, y: -(rear.y + front.y) / 2, lean: Math.atan2(front.y - rear.y, front.x - rear.x) };
}

export default function WindupRace() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = WINDUP_RACE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const [round, setRound] = useState(() => visit.plays);
  const tracks = trackSet(round), light = roomLight(round);
  const [place, setPlace] = useState(0);
  const track = tracks[place];
  const [phase, setPhaseState] = useState<Phase>('wind');
  const [clicks, setClicksState] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<'none' | 'short' | 'back'>('none');
  const [note, setNote] = useState<Note>('none');
  const [finished, setFinished] = useState(0);
  const [goHint, setGoHint] = useState(false);
  const [size, setSize] = useState({ w: 360, h: 460 });

  const phaseRef = useRef<Phase>('wind'), clicksRef = useRef(0), turnRef = useRef(0), trackRef = useRef(track), placeRef = useRef(0);
  trackRef.current = track;
  const sizeRef = useRef(size); sizeRef.current = size;
  const runRef = useRef<RunResult | null>(null), clockRef = useRef(0), eventRef = useRef(0), clackRef = useRef(0), slowAt = useRef<number | null>(null), rate = useRef(1);
  const returnRef = useRef({ from: 0, t: 0 });
  const keyShown = useRef(KEY_REST), keySpeed = useRef(0), dragging = useRef(false), toothAt = useRef(0);
  const camK = useRef(0), flagK = useRef(0), nearK = useRef(0), speedK = useRef(0), lead = useRef(0), page = useRef<{ fx: number; fy: number } | null>(null);
  const rock = useRef({ at: -10, amp: 0 }), shiver = useRef(-10), time = useRef(0), phaseAt = useRef(0), goAt = useRef(-10);
  const honkAt = useRef(-10), bloomAt = useRef(-10), bloomOpen = useRef(false), cushionAt = useRef(-10);
  const coilLevel = useRef(-1);
  const pep = useRef({ x: 0, vx: 0, stride: 0, pose: '', hopAt: -10, taps: [] as number[], zoom: 0 });
  const toyAt = useRef<number[]>([]), lampOn = useRef<boolean[]>([]), toyLive = useRef(-10), pinAt = useRef<number[]>([]);
  const puffs = useRef(Array.from({ length: PUFFS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, g: 0, born: -10, life: 0, r: 5 }))), puffNext = useRef(0);
  const demoAt = useRef(-10);
  const raf = useRef(0), last = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useRef<RacerSound | null>(null);
  const reduced = useRef(reducedMotion());

  const stage = useRef<HTMLDivElement>(null), wall = useRef<HTMLDivElement>(null), floor = useRef<HTMLDivElement>(null);
  const world = useRef<SVGGElement>(null);
  const car = useRef<SVGGElement>(null), body = useRef<SVGGElement>(null), key = useRef<SVGGElement>(null), coilD = useRef<SVGPathElement>(null);
  const lamps = useRef<SVGGElement>(null), honk = useRef<SVGGElement>(null), carShade = useRef<SVGEllipseElement>(null);
  const ball = useRef<SVGGElement>(null), ballSpin = useRef<SVGGElement>(null), squash = useRef<SVGGElement>(null);
  const flower = useRef<SVGGElement>(null), flowerShut = useRef<SVGImageElement>(null), flowerOpen = useRef<SVGImageElement>(null);
  const pins = useRef<(SVGGElement | null)[]>([]), toys = useRef<(SVGGElement | null)[]>([]), glows = useRef<(SVGEllipseElement | null)[]>([]);
  const coils = useRef<(SVGGElement | null)[]>([]), blooms = useRef<(SVGGElement | null)[]>([]), puffNodes = useRef<(SVGCircleElement | null)[]>([]);
  const pepRoot = useRef<SVGGElement>(null), pepFlip = useRef<SVGGElement>(null), pepBob = useRef<SVGGElement>(null);
  const pepSit = useRef<SVGImageElement>(null), pepSide = useRef<SVGImageElement>(null), pepGlad = useRef<SVGImageElement>(null);
  const keyHit = useRef<HTMLButtonElement>(null), hand = useRef<HTMLDivElement>(null), mapCar = useRef<SVGCircleElement>(null), mapPep = useRef<SVGCircleElement>(null);

  const setPhase = (next: Phase) => { phaseRef.current = next; phaseAt.current = time.current; setPhaseState(next); kick(); };
  const setClicks = (next: number) => { clicksRef.current = next; setClicksState(next); };
  const later = (ms: number, run: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); run(); }, ms);
    timers.current.push(id);
  };
  const clearTimers = () => { for (const id of timers.current) clearTimeout(id); timers.current = []; };
  const bump = (amp: number) => { rock.current = { at: time.current, amp }; kick(); };
  const puff = (x: number, y: number, vx: number, vy: number, life: number, r: number, g = 0) => {
    puffs.current[puffNext.current++ % PUFFS] = { x, y, vx, vy, g, born: time.current, life, r };
  };
  const dust = (x: number, y: number, back: number) => { if (reduced.current) return; for (let i = 0; i < 3; i++) puff(x - i * 5, y - 3, -back * (.5 + i * .3), -16 - i * 9, .5 + i * .08, 5 + i * 1.6); };

  /* ---------- the hint hand ---------- */

  /** After a quiet spell the hand shows the next gesture again, until the child has made it. */
  const armHint = (ms = QUIET_MS) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      hintTimer.current = null;
      if (phaseRef.current !== 'wind' || dragging.current) { armHint(); return; }
      if (!taught.key && clicksRef.current === 0) { demoAt.current = time.current; kick(); armHint(QUIET_MS + DEMO_S * 1000); }
      else if (!taught.go && clicksRef.current > 0) { setGoHint(true); later(2600, () => setGoHint(false)); armHint(QUIET_MS + 2600); }
    }, ms);
  };
  /** Any touch ends a showing at once and starts the quiet spell again. */
  const touched = () => { demoAt.current = -10; setGoHint(false); armHint(); };

  /* ---------- the picture, every frame, straight from the refs ---------- */

  const paint = () => {
    const t = trackRef.current, { w: W, h: H } = sizeRef.current, ph = phaseRef.current, run = runRef.current, now = time.current;
    let s = t.start, turns = clicksRef.current + turnRef.current, ballAt = t.ball, clock = -1;
    if (run && (ph === 'run' || ph === 'rest' || ph === 'flag' || ph === 'swap' || ph === 'party')) {
      clock = clockRef.current;
      const sample = sampleAt(run, clock); s = sample.s; turns = sample.turns; ballAt = sample.ball;
    } else if (ph === 'return') {
      s = lerp(returnRef.current.from, t.start, ease(returnRef.current.t / RETURN_S)); turns = 0;
    }
    const pose = carPose(t, s), reduce = reduced.current, since = now - phaseAt.current;

    // Camera: close on Rover and its key while winding; pulled back to follow the run,
    // wider when Rover is fast, closer as it slows; closer still for a close finish.
    const z0 = clamp(Math.min(W / 350, H / 300), .62, 1.5);
    const share = lerp(.54, .2, clamp((W - 500) / 400));
    const zw = Math.max(z0 * 1.15, Math.min(z0 * 2.3, W * share / ROVER_LONG, H * .44 / 118));
    const k = ease(camK.current), near = ease(nearK.current);
    let z = lerp(zw, z0 * (1.1 - .24 * speedK.current) * (1 + .26 * near), k);
    let fx = lerp(pose.x - 2, pose.x + lead.current * (1 - near), k), fy = lerp(pose.y - 54, pose.y * .55 - 32, k);
    let sx = lerp(W * .5, W * lerp(.4, .5, near), k), sy = lerp(H * .6, H * .72, k);
    // At the flower the camera frames the flower and Rover together.
    const fk = ease(flagK.current), flagAt = pointAt(t, t.flag);
    if (fk > 0) {
      const mid = (flagAt.x + pose.x) / 2, span = Math.abs(flagAt.x - pose.x) + 300;
      const zf = Math.max(z0 * .86, Math.min(z0 * 1.12, W * .92 / span));
      fx = lerp(fx, mid, fk); fy = lerp(fy, Math.min(pose.y, -flagAt.y) * .55 - 40, fk); sx = lerp(sx, W * .5, fk); z = lerp(z, zf, fk);
    }
    if (reduce && k >= 1 && fk === 0) {
      // With motion reduced the camera does not glide: it cuts a page on when Rover nears the edge.
      z = z0;
      const p = page.current, screenX = p ? (pose.x - p.fx) * z + W * .4 : -1;
      if (!p || screenX > W * .84 || screenX < W * .1) page.current = { fx: pose.x + (W * .4 - W * .22) / z, fy: pose.y * .55 - 32 };
      fx = page.current!.fx; fy = page.current!.fy; sx = W * .4; sy = H * .72;
    }
    const ox = sx - fx * z, oy = sy - fy * z;
    world.current?.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${z.toFixed(4)})`);
    const centre = (W / 2 - ox) / z, drift = reduce ? 0 : centre * (1 - WALL_DEPTH) * z;
    if (wall.current) wall.current.style.transform = `translate(${(ox + BACKDROP_X0 * z + drift).toFixed(1)}px, ${(oy + (FLOOR_TOP - WALL_HIGH + 5) * z).toFixed(1)}px) scale(${z.toFixed(4)})`;
    if (floor.current) floor.current.style.transform = `translate(${(ox + BACKDROP_X0 * z).toFixed(1)}px, ${(oy + FLOOR_TOP * z).toFixed(1)}px) scale(${z.toFixed(4)})`;

    // Rover: where it is and how it leans; then everything its body does on top of that.
    const leanDeg = -pose.lean * 180 / Math.PI;
    car.current?.setAttribute('transform', `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${leanDeg.toFixed(2)})`);
    const rocked = now - rock.current.at, shake = now - shiver.current, honked = now - honkAt.current, went = now - goAt.current;
    let tilt = 0, dx = 0, dy = 0, wide = 1, tall = 1;
    if (!reduce) {
      if (rocked < 1.4) tilt += rock.current.amp * Math.exp(-5 * rocked) * Math.sin(rocked * 22);
      if (shake < .45) tilt += 1.7 * Math.sin(shake * 60) * (1 - shake / .45);
      // A wound spring wants out: Rover trembles, more the tighter it is.
      if (ph === 'wind' || ph === 'crouch') { const store = clamp((clicksRef.current - 2) / 10); if (store > 0) { tilt += store * .85 * Math.sin(now * 47) * (.55 + .45 * Math.sin(now * 13)); dy += store * .5 * Math.sin(now * 61); } }
      // The held breath: Rover sinks back on its wheels, then springs forward and long.
      if (ph === 'crouch') { const a = ease(since / CROUCH_S); dx -= 5 * a; wide += .035 * a; tall -= .075 * a; tilt -= 2.2 * a; }
      if (went < .5) { const a = Math.exp(-went * 9) * Math.cos(went * 16); wide += .06 * a; tall -= .05 * a; tilt -= 3 * Math.exp(-went * 7); }
      if (honked < .32) dy -= 6 * Math.sin(Math.PI * honked / .32);
      // The last flower: Rover hops and rears twice.
      if (ph === 'party') { const hop = Math.abs(Math.sin(Math.min(since, 1.6) * Math.PI / .8)); dy -= 13 * hop; tilt -= 9 * hop; }
      if (ph === 'run' && clock >= 0) dy += .5 * Math.sin(s / 7);
    }
    body.current?.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -30) scale(${wide.toFixed(4)} ${tall.toFixed(4)})`);
    if (carShade.current) carShade.current.style.opacity = (1 + dy / 26).toFixed(2);
    // The key: the finger turns it while winding (a tight spring fights the finger); it spins back as the spring lets go.
    const strain = !reduce && dragging.current && clicksRef.current > 4 ? Math.sin(now * 90) * (clicksRef.current - 4) * 1.4 : 0;
    const showing = now - demoAt.current, demo = showing >= 0 && showing < DEMO_S ? ease(clamp((showing - .35) / 1.9)) * (1 - ease(clamp((showing - 2.3) / .4))) : 0;
    let keyAngle = ph === 'wind' || ph === 'crouch' ? keyShown.current + strain + (reduce ? 0 : demo * 320) : KEY_REST + turns * 360;
    if (ph === 'party' && !reduce) keyAngle += 1080 * ease(since / 1.8);
    key.current?.setAttribute('transform', `scale(${bowWidth(keyAngle).toFixed(3)} 1)`);
    const tight = clamp(turns / MAX_CLICKS), level = Math.round(tight * 36);
    if (level !== coilLevel.current) { coilLevel.current = level; coilD.current?.setAttribute('d', coilPath(level / 36)); }
    if (lamps.current) lamps.current.style.opacity = honked < .4 ? (1 - honked / .4).toFixed(2) : '0';
    if (honk.current) { const on = honked < .45 && !reduce; honk.current.style.opacity = on ? (1 - honked / .45).toFixed(2) : honked < .25 ? '1' : '0'; if (on) honk.current.setAttribute('transform', `translate(${(54 + honked * 46).toFixed(1)} -36) scale(${(.7 + honked * 1.5).toFixed(2)})`); }

    // The key's touch target and the hint hand follow the key on screen.
    const c = Math.cos(-pose.lean), sn = Math.sin(-pose.lean);
    const kx = (pose.x + KEY_AT.x * c - KEY_AT.y * sn) * z + ox, ky = (pose.y + KEY_AT.x * sn + KEY_AT.y * c) * z + oy;
    const hit = keyHit.current;
    if (hit) {
      const r = Math.max(44, (ORBIT + 9) * z);
      hit.style.inlineSize = hit.style.blockSize = `${(r * 2).toFixed(0)}px`;
      hit.style.transform = `translate(${(kx - r).toFixed(1)}px, ${(ky - r).toFixed(1)}px)`;
    }
    if (hand.current) {
      const on = showing >= 0 && showing < DEMO_S && ph === 'wind';
      hand.current.style.opacity = on ? Math.min(clamp(showing / .3), clamp((DEMO_S - showing) / .35)).toFixed(2) : '0';
      if (on) {
        const round1 = reduce ? .1 : ease(clamp((showing - .35) / 1.9)), a = -Math.PI / 2 + round1 * Math.PI * 2 * 1.05, r = ORBIT * z;
        hand.current.style.transform = `translate(${(kx + Math.cos(a) * r).toFixed(1)}px, ${(ky + Math.sin(a) * r).toFixed(1)}px)`;
      }
    }

    // Things on the trail that move: the knit ball, the petals, the cushion, the flower.
    if (t.ball !== null && ballAt !== null && ball.current) {
      const rolled = Math.max(0, ballAt - t.ball), off = Math.min(1, rolled / 240), p = pointAt(t, ballAt);
      // Nudged, it rolls on ahead and away toward the wall, out of the lane.
      ball.current.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(-p.y - 44 * off).toFixed(1)}) scale(${(1 - .14 * off).toFixed(3)})`);
      ballSpin.current?.setAttribute('transform', `rotate(${(rolled / 21 * 180 / Math.PI).toFixed(1)})`);
    }
    const at = run?.dominoesAt ?? null;
    t.dominoes.forEach((d, i) => {
      const node = pins.current[i]; if (!node) return;
      const start = at === null || clock < 0 ? Infinity : at + i * PIN_GAP_S;
      const f = clock < start ? 0 : reduce ? 1 : Math.min(1, ((clock - start) / PIN_FALL_S) ** 2);
      const poked = now - (pinAt.current[i] ?? -10), wobble = f === 0 && poked < .9 && !reduce ? 7 * Math.exp(-5 * poked) * Math.sin(poked * 20) : 0;
      const p = pointAt(t, d);
      node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(-p.y).toFixed(1)}) rotate(${(f * (i === t.dominoes.length - 1 ? 86 : 42) + wobble).toFixed(1)})`);
    });
    if (squash.current) {
      const depth = Math.max(0, s + CAR_HALF - t.cushion), poked = now - cushionAt.current;
      const sq = Math.max(.6, 1 - depth / 90) * (poked < .8 && !reduce ? 1 - .12 * Math.exp(-6 * poked) * Math.cos(poked * 22) : 1);
      squash.current.setAttribute('transform', `translate(152 0) scale(${sq.toFixed(3)} ${(1 + (1 - sq) * .3).toFixed(3)}) translate(-152 0)`);
    }
    if (flower.current) {
      const opened = now - bloomAt.current, open = bloomOpen.current;
      if (flowerOpen.current) flowerOpen.current.style.opacity = open ? '1' : '0';
      if (flowerShut.current) flowerShut.current.style.opacity = open ? '0' : '1';
      const pop = opened < 1 && !reduce ? 1 + .22 * Math.exp(-5 * opened) * Math.cos(opened * 17) : 1;
      const sway = opened < 1 && !reduce ? 6 * Math.exp(-4 * opened) * Math.sin(opened * 13) : 0;
      flower.current.setAttribute('transform', `rotate(${sway.toFixed(2)}) scale(${(2 - pop).toFixed(3)} ${pop.toFixed(3)})`);
    }
    // The spring blooms of the celebration: one at any flower, all of them at the last.
    const cheer = ph === 'flag' || ph === 'party' || ph === 'swap' ? since : -1;
    for (let i = 0; i < POPPERS.length; i++) {
      const coil = coils.current[i], bloom = blooms.current[i]; if (!coil || !bloom) continue;
      const age = ph === 'party' ? cheer - .15 - i * .2 : ph === 'flag' && i === 0 ? cheer - .25 : -1;
      const up = age < 0 ? 0 : reduce ? 1 : 1 - Math.exp(-6 * age) * Math.cos(age * 15);
      coil.style.opacity = bloom.style.opacity = age < 0 ? '0' : '1';
      if (age >= 0) {
        coil.setAttribute('transform', `scale(1 ${Math.max(.05, up).toFixed(3)})`);
        bloom.setAttribute('transform', `translate(0 ${(-POPPER_HIGH * up).toFixed(1)}) rotate(${(reduce ? 0 : 14 * Math.exp(-3 * age) * Math.sin(age * 15) + age * 40).toFixed(1)})`);
      }
    }

    // Pep.
    const dog = pep.current, glad = ph === 'flag' || ph === 'party', running = Math.abs(dog.vx) > 40;
    const pose2 = glad && !running ? 'glad' : running ? 'side' : 'sit';
    if (pose2 !== dog.pose) {
      dog.pose = pose2;
      if (pepSit.current) pepSit.current.style.opacity = pose2 === 'sit' ? '1' : '0';
      if (pepSide.current) pepSide.current.style.opacity = pose2 === 'side' ? '1' : '0';
      if (pepGlad.current) pepGlad.current.style.opacity = pose2 === 'glad' ? '1' : '0';
    }
    const hopped = now - dog.hopAt;
    let lift = 0, stretch = 1;
    if (!reduce) {
      if (pose2 === 'side') lift = Math.abs(Math.sin(dog.stride / 30)) * 11;
      else if (pose2 === 'glad') lift = Math.abs(Math.sin(since * 7)) * 15 * Math.max(.25, 1 - since / 2.6);
      if (hopped < .5) { lift += 20 * Math.sin(Math.PI * hopped / .5); stretch = 1 + .06 * Math.sin(Math.PI * hopped / .25); }
    }
    pepRoot.current?.setAttribute('transform', `translate(${dog.x.toFixed(1)} ${-PEP_BACK})`);
    // The side view looks left as drawn: it is turned to face the way he runs.
    pepFlip.current?.setAttribute('transform', pose2 === 'side' && dog.vx > 0 ? 'scale(-1 1)' : 'scale(1 1)');
    pepBob.current?.setAttribute('transform', `translate(0 ${(-lift).toFixed(1)}) scale(${(2 - stretch).toFixed(3)} ${stretch.toFixed(3)})`);

    // Toys answering a touch.
    const list = TRACK_TOYS[t.id];
    if (now - toyLive.current < 1.4) for (let i = 0; i < list.length; i++) {
      const node = toys.current[i], age = now - (toyAt.current[i] ?? -10); if (!node) continue;
      if (age > 1.2) { node.removeAttribute('transform'); node.style.opacity = '1'; continue; }
      if (reduce) { node.style.opacity = age < .2 ? '.55' : '1'; continue; }
      const kind = list[i].kind, ring = Math.exp(-6 * age) * Math.cos(age * 24);
      node.setAttribute('transform', kind === 'waterCan' ? `rotate(${(26 * Math.sin(Math.PI * Math.min(1, age / .9))).toFixed(1)} 34 0)`
        : kind === 'deskLamp' ? `rotate(${(7 * Math.exp(-5 * age) * Math.sin(age * 17)).toFixed(1)})`
          : `scale(${(1 + ring * .09).toFixed(3)} ${(1 - ring * .2).toFixed(3)})`);
    }
    for (let i = 0; i < PUFFS; i++) {
      const node = puffNodes.current[i], p = puffs.current[i], age = now - p.born; if (!node) continue;
      if (age < 0 || age > p.life) { if (node.style.opacity !== '0') node.style.opacity = '0'; continue; }
      const f = age / p.life;
      node.setAttribute('cx', (p.x + p.vx * age).toFixed(1)); node.setAttribute('cy', (p.y + p.vy * age + .5 * p.g * age * age).toFixed(1));
      node.setAttribute('r', (p.r * (p.g ? 1 : .6 + f)).toFixed(1)); node.style.opacity = ((1 - f) * (p.g ? .95 : .8)).toFixed(2);
    }
    mapCar.current?.setAttribute('cx', (s + CAR_HALF * .4).toFixed(1));
    mapPep.current?.setAttribute('cx', dog.x.toFixed(1));
  };

  /* ---------- the clock ---------- */

  const openFlower = () => { if (bloomOpen.current) return; bloomOpen.current = true; bloomAt.current = time.current; sound.current?.bell(); pep.current.hopAt = time.current; kick(); };
  const finishRun = () => {
    const run = runRef.current; if (!run) return;
    sound.current?.whirr(0, 0);
    if (run.finished) {
      setFinished(count => Math.max(count, placeRef.current + 1));
      const next = nextTrack(placeRef.current);
      if (next === null) {
        // The last flower: every bloom springs up, the bell plays up the scale, then the finish is handed over.
        setPhase('party'); sound.current?.fanfare();
        POPPERS.forEach((_, i) => later(150 + i * 200, () => { sound.current?.boing(5 + i * 2); void selectionHaptic(); }));
        later(PARTY_MS, () => { visit.plays += 1; setPhase('done'); });
        return;
      }
      setPhase('flag');
      later(250, () => sound.current?.boing(7));
      later(FLAG_MS, () => {
        setPhase('swap');
        later(SWAP_MS * .48, () => {
          placeRef.current = next; setPlace(next); runRef.current = null; clockRef.current = 0; page.current = null; bloomOpen.current = false; bloomAt.current = -10;
          setMarks([]); setClicks(0); turnRef.current = 0; keyShown.current = KEY_REST; keySpeed.current = 0; camK.current = 0; flagK.current = 0; nearK.current = 0; setOutcome('none'); setNote('none');
          toyAt.current = []; lampOn.current = []; pinAt.current = []; pep.current.pose = '';
        });
        later(SWAP_MS, () => { setPhase('wind'); armHint(); });
      });
      return;
    }
    setMarks(current => addChalk(current, run.reach)); sound.current?.chalk();
    setOutcome(run.events.some(event => event.kind === 'turnback') ? 'back' : 'short');
    setPhase('rest');
    later(REST_MS, startReturn);
  };
  const startReturn = () => {
    if (phaseRef.current !== 'rest') return;
    clearTimers();
    const run = runRef.current;
    returnRef.current = { from: run ? run.stop : trackRef.current.start, t: reduced.current ? RETURN_S : 0 };
    runRef.current = null; clockRef.current = 0;
    setPhase('return');
  };
  const endReturn = () => {
    setClicks(0); turnRef.current = 0; keyShown.current = KEY_REST; keySpeed.current = 0; page.current = null;
    setPhase('wind'); armHint();
  };
  const release = () => {
    if (phaseRef.current !== 'crouch') return;
    const t = trackRef.current, run = simulate(t, clicksRef.current);
    runRef.current = run; slowAt.current = closeCallAt(t, run); rate.current = 1;
    clockRef.current = 0; eventRef.current = 0; clackRef.current = 0; turnRef.current = 0; page.current = null;
    goAt.current = time.current; sound.current?.sproing(); void selectionHaptic();
    const p = carPose(t, t.start); dust(p.x - 40, p.y, 70);
    setPhase('run');
  };
  const advance = (dt: number) => {
    time.current += dt;
    const now = time.current, ph = phaseRef.current, run = runRef.current, t = trackRef.current, slow = reduced.current;
    const follow = ph === 'run' || ph === 'rest' || ph === 'flag' || ph === 'return' || ph === 'party';
    const wantK = ph === 'swap' ? camK.current : follow ? 1 : 0;
    camK.current = slow ? wantK : wantK > camK.current ? Math.min(1, camK.current + dt / .75) : Math.max(0, camK.current - dt / .6);
    const wantF = ph === 'flag' || ph === 'party' || (ph === 'swap' && flagK.current > 0) ? 1 : 0;
    flagK.current = slow ? wantF : wantF > flagK.current ? Math.min(1, flagK.current + dt / .8) : Math.max(0, flagK.current - dt / .4);
    if (ph === 'wind' || ph === 'crouch') {
      // The key settles onto its click like a pawl on a tooth: a touch past, then back.
      const target = KEY_REST + (clicksRef.current + turnRef.current) * 360;
      if (dragging.current || slow) { keyShown.current = target; keySpeed.current = 0; }
      else {
        keySpeed.current += ((target - keyShown.current) * 320 - keySpeed.current * 25) * dt; keyShown.current += keySpeed.current * dt;
        if (Math.abs(keyShown.current - target) < .3 && Math.abs(keySpeed.current) < 6) { keyShown.current = target; keySpeed.current = 0; }
      }
    }
    if (ph === 'crouch' && now - phaseAt.current >= (slow ? 0 : CROUCH_S)) release();
    if (ph === 'return') {
      returnRef.current.t += dt;
      if (returnRef.current.t >= RETURN_S) endReturn();
    }
    let speed = 0, carS = ph === 'return' ? lerp(returnRef.current.from, t.start, ease(returnRef.current.t / RETURN_S)) : t.start;
    if (run && phaseRef.current === 'run') {
      // A close finish is watched slowly.
      const close = slowAt.current !== null && clockRef.current >= slowAt.current;
      rate.current = slow ? 1 : lerp(rate.current, close ? SLOW_RATE : 1, Math.min(1, dt * 6));
      clockRef.current += dt * rate.current;
      const clock = clockRef.current;
      while (eventRef.current < run.events.length && run.events[eventRef.current].t <= clock) {
        const event = run.events[eventRef.current++], at = carPose(t, sampleAt(run, event.t).s);
        if (event.kind === 'bump') { sound.current?.knock(); bump(5); dust(at.x, at.y, 30); }
        else if (event.kind === 'ball') { sound.current?.thump(); bump(2.5); }
        else if (event.kind === 'tunnel') sound.current?.rustle();
        else if (event.kind === 'dominoes') bump(2);
        else if (event.kind === 'flag') openFlower();
        else if (event.kind === 'cushion') { sound.current?.thump(); bump(3); dust(at.x + 40, at.y, -40); }
        else if (event.kind === 'stop') { sound.current?.knock(.5); bump(2.2); }
      }
      if (run.dominoesAt !== null) while (clackRef.current < t.dominoes.length && clock >= run.dominoesAt + clackRef.current * PIN_GAP_S + PIN_FALL_S) sound.current?.clack(clackRef.current++);
      const sample = sampleAt(run, clock);
      speed = sample.v; carS = sample.s;
      sound.current?.whirr(Math.abs(sample.v) / 780 * rate.current, sample.turns / MAX_CLICKS);
      if (clock >= run.duration + .05) finishRun();
    } else if (run) carS = sampleAt(run, clockRef.current).s;
    const fast = clamp(Math.abs(speed) / 700), close = ph === 'run' && slowAt.current !== null && clockRef.current >= slowAt.current;
    speedK.current = slow ? 0 : lerp(speedK.current, ph === 'run' ? fast : 0, Math.min(1, dt * 2.4));
    lead.current = slow ? 0 : lerp(lead.current, ph === 'run' ? Math.sign(speed) * (30 + 90 * fast) : 0, Math.min(1, dt * 2.2));
    nearK.current = slow ? 0 : close ? Math.min(1, nearK.current + dt / .7) : Math.max(0, nearK.current - dt / .5);

    // Pep scouts ahead of Rover, waits by it, and is first to the flower.
    const dog = pep.current, carX = carPose(t, carS).x, flagX = pointAt(t, t.flag).x;
    let want = carX + 150;
    if (dog.zoom === 1) { want = flagX + 40; if (Math.abs(dog.x - want) < 12) dog.zoom = 2; }
    else if (dog.zoom === 2) { if (Math.abs(dog.x - want) < 12) dog.zoom = 0; }
    else if (phaseRef.current === 'run') want = Math.min(carX + 120, flagX + 70);
    else if (ph === 'flag' || ph === 'party') want = flagX + 70;
    const gap = want - dog.x, top = dog.zoom ? 1500 : 1050;
    dog.vx = slow ? 0 : Math.abs(gap) < 3 ? 0 : clamp(gap * 5, -top, top);
    dog.x = slow ? want : dog.x + dog.vx * dt; dog.stride += Math.abs(dog.vx) * dt;
  };
  const busy = () => {
    const ph = phaseRef.current, now = time.current;
    if (ph === 'run' || ph === 'return' || ph === 'crouch' || ph === 'party' || ph === 'flag' || dragging.current) return true;
    if (ph === 'wind' && clicksRef.current > 2 && !reduced.current) return true;
    if (Math.abs(camK.current - (ph === 'swap' ? camK.current : ph === 'wind' ? 0 : 1)) > .0001 || nearK.current > 0 || Math.abs(lead.current) > .5 || speedK.current > .005) return true;
    if (ph === 'wind' && (Math.abs(keyShown.current - (KEY_REST + (clicksRef.current + turnRef.current) * 360)) > .01 || keySpeed.current !== 0)) return true;
    if (Math.abs(pep.current.vx) > 0 || now - pep.current.hopAt < .6 || now - demoAt.current < DEMO_S + .1) return true;
    if (now - toyLive.current < 1.5 || now - honkAt.current < .5 || now - bloomAt.current < 1.1 || now - cushionAt.current < .9) return true;
    if (puffs.current.some(p => now - p.born < p.life + .05)) return true;
    return now - rock.current.at < 1.4 || now - shiver.current < .5 || now - goAt.current < .6;
  };
  const frame = (now: number) => {
    raf.current = 0;
    const dt = last.current ? Math.min(.05, Math.max(0, (now - last.current) / 1000)) : 1 / 60;
    last.current = now;
    advance(dt); paint();
    if (busy() && document.visibilityState !== 'hidden') raf.current = requestAnimationFrame(frame);
    else last.current = 0;
  };
  const frameRef = useRef(frame); frameRef.current = frame;
  const kick = () => { if (!raf.current && typeof requestAnimationFrame === 'function') raf.current = requestAnimationFrame(now => frameRef.current(now)); };

  useEffect(() => {
    const instance = createRacerSound(); sound.current = instance;
    // The kit pictures are fetched before the first run needs them.
    const warm = typeof Image === 'function' ? KIT_ART.map(src => { const picture = new Image(); picture.decoding = 'async'; picture.src = src; return picture; }) : [];
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => { reduced.current = !!media?.matches; kick(); };
    media?.addEventListener?.('change', motion);
    const visible = () => { if (document.visibilityState === 'hidden') { instance.quiet(); } else { last.current = 0; kick(); } };
    document.addEventListener('visibilitychange', visible);
    armHint(1100);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0;
      for (const id of timers.current) clearTimeout(id); timers.current = [];
      if (hintTimer.current) clearTimeout(hintTimer.current); hintTimer.current = null;
      media?.removeEventListener?.('change', motion);
      document.removeEventListener('visibilitychange', visible);
      instance.dispose(); sound.current = null; warm.length = 0;
    };
  }, []);
  useEffect(() => { if (muted) sound.current?.quiet(); }, [muted]);
  // A new trail: Pep waits just ahead of the start.
  useLayoutEffect(() => { pep.current.x = pointAt(track, track.start).x + 150; pep.current.vx = 0; pep.current.zoom = 0; }, [track]);

  useLayoutEffect(() => {
    const node = stage.current; if (!node) return;
    const measure = () => { const r = node.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSize(prev => (Math.abs(prev.w - r.width) < .5 && Math.abs(prev.h - r.height) < .5 ? prev : { w: r.width, h: r.height })); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Repaint whenever React has redrawn the scene (size, trail, marks, phase).
  useLayoutEffect(() => { paint(); kick(); });

  /* ---------- the child's actions ---------- */

  const clicked = (next: number) => {
    taught.key = true;
    setClicks(next); setNote(next >= MAX_CLICKS ? 'full' : 'none'); setOutcome('none');
    sound.current?.tick(next); void selectionHaptic();
    // Each click shows: a spark of dust off the key, and Pep's ears go up.
    const p = carPose(trackRef.current, trackRef.current.start);
    if (!reduced.current) puff(p.x + KEY_AT.x + 16, p.y + KEY_AT.y, 26, -30, .35, 2.6);
    if (next === MAX_CLICKS) pep.current.hopAt = time.current;
  };
  const windOnce = () => {
    if (phaseRef.current !== 'wind') return;
    touched();
    if (clicksRef.current >= MAX_CLICKS) { sound.current?.stop(); shiver.current = time.current; setNote('full'); kick(); return; }
    turnRef.current = 0; clicked(wind(clicksRef.current));
    later(45, () => sound.current?.tooth()); later(90, () => sound.current?.tooth());
    kick();
  };
  const go = () => {
    if (phaseRef.current !== 'wind') return;
    touched();
    if (clicksRef.current === 0) { shiver.current = time.current; setNote('nowind'); sound.current?.knock(.4); if (!taught.key) { demoAt.current = time.current + .25; } kick(); return; }
    taught.go = true;
    clearTimers();
    turnRef.current = 0; setNote('none'); setOutcome('none');
    sound.current?.crouch(); void selectionHaptic();
    setPhase('crouch');
  };
  /** Back to start: everything as it was before Go, the spring still wound. */
  const reset = () => {
    const ph = phaseRef.current;
    if (ph === 'rest') { startReturn(); return; }
    if (ph !== 'run' && ph !== 'crouch') return;
    const run = runRef.current;
    clearTimers(); sound.current?.whirr(0, 0);
    const wound = ph === 'crouch' ? clicksRef.current : run ? Math.round(run.samples[0].turns) : 0;
    runRef.current = null; clockRef.current = 0; eventRef.current = 0; clackRef.current = 0; page.current = null; rate.current = 1; slowAt.current = null; nearK.current = 0;
    bloomOpen.current = false; bloomAt.current = -10;
    setClicks(wound); turnRef.current = 0; keyShown.current = KEY_REST + wound * 360; keySpeed.current = 0;
    setOutcome('none'); setNote('none');
    setPhase('wind'); armHint();
  };
  /** The horn: Rover's eyes shine, it hops, and what stands nearby jumps. Under the arches it echoes. */
  const beep = () => {
    const ph = phaseRef.current; if (ph === 'done' || ph === 'swap') return;
    const t = trackRef.current, run = runRef.current, s = run && ph !== 'wind' ? sampleAt(run, clockRef.current).s : t.start;
    sound.current?.horn(!!t.tunnel && s >= t.tunnel[0] - 20 && s <= t.tunnel[1] + 20);
    honkAt.current = time.current; void selectionHaptic();
    const x = carPose(t, s).x;
    TRACK_TOYS[t.id].forEach((toy, i) => { if (Math.abs(toy.x - x) < 230 && toy.kind !== 'restRug') { toyAt.current[i] = time.current + .06; toyLive.current = time.current; } });
    t.dominoes.forEach((d, i) => { if (Math.abs(d - s) < 230) pinAt.current[i] = time.current; });
    if (Math.abs(pep.current.x - x) < 260) pep.current.hopAt = time.current;
    if (ph === 'wind') armHint();
    kick();
  };
  const pokeToy = (i: number) => {
    const toy = TRACK_TOYS[trackRef.current.id][i]; if (!toy) return;
    toyAt.current[i] = time.current; toyLive.current = time.current; void selectionHaptic();
    if (toy.kind === 'pad') sound.current?.plink(toy.pick % 6);
    else if (toy.kind === 'musicTile') sound.current?.plink(5 + toy.pick * 2);
    else if (toy.kind === 'waterCan') { sound.current?.rustle(); if (!reduced.current) for (let d = 0; d < 4; d++) puff(toy.x + 46 + d * 3, -toy.back * BACK - 46, 22 + d * 7, -10 - d * 8, .55, 2.2, 260); }
    else if (toy.kind === 'deskLamp') { lampOn.current[i] = !lampOn.current[i]; const glow = glows.current[i]; if (glow) glow.style.opacity = lampOn.current[i] ? '1' : '0'; sound.current?.tooth(); }
    kick();
  };
  /** Pep answers a pat with a hop; three quick pats and he dashes to the flower and back. */
  const pokePep = () => {
    const dog = pep.current, now = performance.now();
    dog.hopAt = time.current; sound.current?.squeak(); void selectionHaptic();
    dog.taps = [...dog.taps.filter(at => now - at < 2600), now];
    if (dog.taps.length >= 3 && phaseRef.current === 'wind' && dog.zoom === 0 && !reduced.current) { dog.taps = []; dog.zoom = 1; }
    kick();
  };
  const pokeFlower = () => { bloomAt.current = time.current; sound.current?.rustle(); void selectionHaptic(); kick(); };
  const pokeCushion = () => { cushionAt.current = time.current; sound.current?.thump(); void selectionHaptic(); kick(); };

  // Turning the key by circling a finger round it. A short touch without a turn is one click.
  const drag = useRef<{ id: number; cx: number; cy: number; angle: number; moved: number; at: number } | null>(null);
  const keyDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'wind') return;
    touched();
    const r = event.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    drag.current = { id: event.pointerId, cx, cy, angle: Math.atan2(event.clientY - cy, event.clientX - cx), moved: 0, at: performance.now() };
    dragging.current = true; toothAt.current = turnRef.current;
    sound.current?.tooth();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is a nicety */ }
    kick();
  };
  const keyMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.id !== event.pointerId || phaseRef.current !== 'wind') return;
    const angle = Math.atan2(event.clientY - d.cy, event.clientX - d.cx);
    if (Math.hypot(event.clientX - d.cx, event.clientY - d.cy) < 6) return;
    let delta = angle - d.angle;
    if (delta > Math.PI) delta -= Math.PI * 2; else if (delta < -Math.PI) delta += Math.PI * 2;
    d.angle = angle; d.moved += Math.abs(delta);
    if (delta <= 0) return; // the ratchet holds a backwards turn
    if (clicksRef.current >= MAX_CLICKS) {
      if (time.current - shiver.current > .6) { shiver.current = time.current; sound.current?.stop(); setNote('full'); kick(); }
      return;
    }
    const result = dragKey(clicksRef.current, turnRef.current, delta / (Math.PI * 2));
    // The ratchet's teeth: six to a turn, felt and heard under the finger.
    if (result.made > 0 || Math.floor(result.turn * 6) !== Math.floor(toothAt.current * 6)) sound.current?.tooth();
    turnRef.current = result.turn; toothAt.current = result.turn;
    if (result.made > 0) clicked(result.clicks);
    kick();
  };
  const keyUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.id !== event.pointerId) return;
    drag.current = null; dragging.current = false;
    if (d.moved < .6 && performance.now() - d.at < 500) windOnce();
    // Let go mid-turn: the ratchet holds the clicks made, the part-turn springs back.
    turnRef.current = 0; kick();
  };

  // Keyboard: Space winds, Enter lets go, H sounds the horn (when no other control has focus).
  const keysRef = useRef({ windOnce, go, beep }); keysRef.current = { windOnce, go, beep };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('button, a, input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); keysRef.current.windOnce(); }
      else if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); keysRef.current.go(); }
      else if (event.code === 'KeyH' && !event.repeat) { event.preventDefault(); keysRef.current.beep(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- words ---------- */

  const windCue = note === 'nowind' ? w.noWind : note === 'full' || clicks >= MAX_CLICKS ? w.full : outcome !== 'none' ? w.again : clicks > 0 ? w.windMore : w.wind;
  const cue = phase === 'wind' ? windCue : phase === 'crouch' || phase === 'run' ? w.running : phase === 'rest' ? (outcome === 'back' ? w.rolledBack : w.stopped)
    : phase === 'return' ? w.again : phase === 'flag' ? w.flag : phase === 'swap' ? w.nextTrack : phase === 'party' ? w.party : w.finish;
  const total = shapeOf(track).total;
  const flagPoint = pointAt(track, track.flag), cushionPoint = pointAt(track, track.cushion);
  const running = phase === 'run' || phase === 'rest' || phase === 'crouch';
  const setPin = useCallback((i: number) => (node: SVGGElement | null) => { pins.current[i] = node; }, []);
  const setToy = useCallback((i: number) => (node: SVGGElement | null) => { toys.current[i] = node; }, []);
  const setGlow = useCallback((i: number) => (node: SVGEllipseElement | null) => { glows.current[i] = node; }, []);
  const setCoil = useCallback((i: number) => (node: SVGGElement | null) => { coils.current[i] = node; }, []);
  const setBloom = useCallback((i: number) => (node: SVGGElement | null) => { blooms.current[i] = node; }, []);
  const setPuff = useCallback((i: number) => (node: SVGCircleElement | null) => { puffNodes.current[i] = node; }, []);

  /** Outside the Studio (which remounts the game instead), Play again starts the next set at its first trail. */
  const restart = () => {
    clearTimers(); sound.current?.quiet();
    setRound(visit.plays);
    placeRef.current = 0; setPlace(0); runRef.current = null; clockRef.current = 0; page.current = null; camK.current = 0; flagK.current = 0; nearK.current = 0; bloomOpen.current = false; bloomAt.current = -10;
    setMarks([]); setClicks(0); turnRef.current = 0; keyShown.current = KEY_REST; keySpeed.current = 0; setOutcome('none'); setNote('none'); setFinished(0);
    setPhase('wind'); armHint();
  };

  if (phase === 'done') {
    return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction}>
      <section className="adventure wr" data-adventure="windup-race" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={restart} playAgainLabel={shared.again} homeLabel={shared.home} />
      </section>
    </GameShell>;
  }

  const id = 'wr-';
  return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction} hearIt={`${cue} ${w.trackLines[track.id]} ${w.instruction}`}>
    <section className="adventure wr" data-adventure="windup-race" data-phase={phase} data-track={track.id} data-wound={clicks > 0} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="wr-top">
        <ol className="wr-flags" aria-label={fillLine(w.progress, place + 1, PLAY_LENGTH)}>
          {tracks.map((item, i) => <li key={item.id} className="wr-flags__pip" data-done={i < finished} data-now={i === place && i >= finished} aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="12" cy="5.6" rx="3.5" ry="4.8" transform={`rotate(${a} 12 12)`} className="wr-flags__petal" />)}
              <circle cx="12" cy="12" r="3" className="wr-flags__heart" />
            </svg>
          </li>)}
        </ol>
        <p className="wr-top__track"><strong>{w.tracks[track.id]}</strong></p>
      </div>
      <p className="wr-cue" aria-live="polite">{cue}</p>
      {/* The scene reads left to right in both languages: physics and trail are never mirrored. */}
      <div className="wr-stage" ref={stage} data-swap={phase === 'swap'} data-light={light} dir="ltr">
        <div className="wr-scene" key={`${round}:${place}`}>
          <Backdrop width={total + 1400} wallRef={wall} floorRef={floor} />
          <div className="wr-daylight" aria-hidden="true" />
          <svg className="wr-svg" viewBox={`0 0 ${size.w.toFixed(0)} ${size.h.toFixed(0)}`} width="100%" height="100%" role="group" aria-label={w.scene}>
            <SceneDefs id={id} />
            <g ref={world}>
              <LaneMarks track={track} />
              <StartSign track={track} id={id} />
              <Toys track={track} id={id} toyRef={setToy} glowRef={setGlow} onPoke={pokeToy} />
              <Pep parts={{ root: pepRoot, flip: pepFlip, bob: pepBob, sit: pepSit, side: pepSide, glad: pepGlad }} id={id} onPoke={pokePep} />
              <Terrain track={track} id={id} />
              <Poppers x={flagPoint.x} y={-flagPoint.y} id={id} coilRef={setCoil} bloomRef={setBloom} />
              <Finish x={flagPoint.x} y={-flagPoint.y} id={id} wrapRef={flower} foldedRef={flowerShut} openRef={flowerOpen} onPoke={pokeFlower} />
              {track.tunnel && <Hoops from={pointAt(track, track.tunnel[0]).x} to={pointAt(track, track.tunnel[1]).x} near={false} id={id} />}
              {track.bumps.map(item => <KnitRoll key={item.at} x={item.at - 2} id={id} />)}
              {track.dominoes.map((_, i) => <PetalPin key={i} index={i} pinRef={setPin(i)} id={id} />)}
              <ChalkMarks track={track} marks={marks} />
              {track.ball !== null && <KnitBall ballRef={ball} spinRef={ballSpin} id={id} />}
              <g ref={car}>
                <RoverCar parts={{ body, key, coilPath: coilD, lamps, honk, shadow: carShade }} />
                <KeyDial clicks={clicks} />
              </g>
              {track.tunnel && <Hoops from={pointAt(track, track.tunnel[0]).x} to={pointAt(track, track.tunnel[1]).x} near id={id} />}
              <Catcher x={cushionPoint.x} y={-cushionPoint.y} id={id} squashRef={squash} onPoke={pokeCushion} />
              <Puffs puffRef={setPuff} />
            </g>
          </svg>
          <svg className="wr-map" viewBox={`-40 -150 ${track.cushion + 180} 175`} role="img" aria-label={w.map} style={{ aspectRatio: `${track.cushion + 180} / 175` }}>
            <path d={trackLine(track)} className="wr-map__line" vectorEffect="non-scaling-stroke" />
            {marks.map((m, i) => <rect key={`${i}:${m}`} x={m - 5} y={-pointAt(track, m).y - 40} width="10" height="44" className="wr-map__chalk" data-fresh={i === marks.length - 1} />)}
            <g transform={`translate(${track.flag} ${-flagPoint.y - 70})`} className="wr-map__flower">
              <path d="M0 0V70" vectorEffect="non-scaling-stroke" />
              {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-26" rx="15" ry="22" transform={`rotate(${a})`} />)}
            </g>
            <circle ref={mapPep} cx={track.start + 150} cy={-66} r="20" className="wr-map__pep" />
            <circle ref={mapCar} cx={track.start} cy={-pointAt(track, track.start).y - 12} r="34" className="wr-map__car" />
          </svg>
        </div>
        <button type="button" ref={keyHit} className="wr-key" data-wr-key="" hidden={phase !== 'wind'}
          aria-label={fillLine(w.key, w.tension[tension(clicks)])} aria-describedby="wr-keys"
          onPointerDown={keyDown} onPointerMove={keyMove} onPointerUp={keyUp} onPointerCancel={keyUp}
          onClick={event => { if (event.detail === 0) windOnce(); }} />
        <div className="wr-hand" ref={hand} aria-hidden="true"><HintHand /></div>
        {CHEER_ART && <img className="wr-cheer" src={CHEER_ART} alt="" draggable={false} data-on={phase === 'party'} />}
      </div>
      <p id="wr-keys" className="wr-sr">{w.keys}</p>
      {muted && <p className="adventure-quiet wr-quiet">{w.quiet}</p>}
      <div className="wr-controls">
        {running || phase === 'flag' || phase === 'party' || phase === 'return' || phase === 'swap'
          ? <>
            <button type="button" className="wr-button wr-button--horn" data-wr-control="horn" onClick={beep}><HornGlyph />{w.horn}</button>
            <button type="button" className="wr-button" data-wr-control="reset" disabled={!running} onClick={reset}><RotateCcw size={22} aria-hidden="true" />{w.reset}</button>
          </>
          : <>
            <button type="button" className="wr-button wr-button--wind" data-wr-control="wind" disabled={phase !== 'wind'} data-full={clicks >= MAX_CLICKS} onClick={windOnce}><RotateCw size={22} aria-hidden="true" />{w.windButton}</button>
            <button type="button" className="wr-button wr-button--go" data-wr-control="go" disabled={phase !== 'wind'} data-ready={phase === 'wind' && clicks > 0} onClick={go}>
              <Play size={22} aria-hidden="true" />{w.go}
              {goHint && <span className="wr-hand wr-hand--go" aria-hidden="true"><HintHand /></span>}
            </button>
          </>}
      </div>
    </section>
  </GameShell>;
}

/** The hand that shows a gesture: interface, drawn in the Studio's own tokens. */
function HintHand() {
  return <svg viewBox="0 0 48 56" width="48" height="56" focusable="false">
    <path className="wr-hand__skin" d="M17 4.5c3 0 5 2.2 5 5.2v14.6l2.2-.5c1.9-.4 3.6.5 4.4 2l1.6-.4c2-.4 3.8.6 4.6 2.3l1.300-.2c3-.4 5.4 1.800 5.400 4.900v7.600c0 7.400-5.200 12.500-12.800 12.500h-3.700c-4.200 0-7.300-1.700-9.700-5.200L6.300 34.800c-1.500-2.300-.9-5 1.200-6.300 1.900-1.200 4.200-.7 5.700 1.100l-1.200 0V9.700c0-3 2-5.200 5-5.200z" />
    <path className="wr-hand__line" d="M22 24.300v8M28.600 26v6.800M34.800 28v5.600" />
  </svg>;
}
/** A rubber-bulb horn. */
function HornGlyph() {
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" className="wr-glyph">
    <circle cx="6" cy="14" r="4" /><path d="M9.300 11.300l8.200-5.800v15l-8.200-4.300z" /><path d="M20.300 9.500q2 3.500 0 7" className="wr-glyph__open" />
  </svg>;
}
