import { forwardRef, useEffect, useImperativeHandle, useRef, type MutableRefObject, type ReactNode } from 'react';
import { fallenLeaves, frost, lifeAt, seasonAt, smoothstep, snowDepth, viewMix, weatherAt, wrapYear, appleState } from './seasonDialRules';
import { coverAt, fallAt, hourAt, puddleFill, rainbowAt, seededPlay, shadowOf, sunArc, type SkyState, type StageLayout } from './seasonDialPlay';
import { growTree, makeTreePainter, mixRgb, paintApple, paintBed, paintCloud, paintLooseLeaf, paintPuddle, paintRainbow, paintSnowFriend, paintSnowMound, readTones, type Tones } from './seasonWorldArt';
import { SEASON_VIEWS } from './seasonDialKit';
import { yearLook } from './seasonDialPaint';

/** The living terrace: the season views cross-fading under one sun, the
 * tree, the clouds, the floor and the weather on two canvases, and the
 * camera's own glass in front (rain beads, frost). It reads the year and the
 * sky from a mutable ref every frame, so turning the dial never waits on
 * React. One frame loop, paused when the tab is hidden, released on unmount. */

export interface WorldLive {
  /** The year shown (unwrapped turns are fine). */
  year: number;
  sky: SkyState;
  /** The hour of the day, when the film overrides the year's own. */
  hour: number | null;
  /** 0..1: the film's golden hour. */
  gold: number;
}
export type WorldTouch =
  | 'cloudPuff' | 'sunDisc' | 'treeCrown' | 'knotHole' | 'floorPuddle' | 'snowFriend' | 'farMountain' | 'terraceFloor' | 'openSky';
export interface WorldHandle {
  /** What lies under a stage point (px). */
  touchAt(x: number, y: number): WorldTouch;
  /** The world answers a touch there. Returns how much it gave (apples, snow…), for the sound. */
  answer(touch: WorldTouch, x: number, y: number): number;
  /** A swipe of wind: `dir` -1 left … 1 right. */
  gust(dir: number, strength: number): void;
  /** A finger moving on the glass: brushes snow off the ledge, wipes rain beads. Returns how many things it moved. */
  brush(x: number, y: number): number;
  /** A flock crosses the valley (the mountain's echo). */
  flock(): void;
  /** The crown's centre on the stage, for effects. */
  crown(): { x: number; y: number; rx: number; ry: number };
}
export interface SeasonWorldProps {
  layout: StageLayout; live: MutableRefObject<WorldLive>; still: boolean; kind: number; cloudSeed: number; drift: 1 | -1;
  /** The friends on the terrace (DOM sprites), between the two canvases. */
  children?: ReactNode;
}

const TREE = growTree();
interface Flake { x: number; y: number; z: number; p: number }
interface AirLeaf { x: number; y: number; z: number; rot: number; spin: number; hue: number; life: number; vx: number; vy: number }
interface Bead { x: number; y: number; r: number; vy: number; run: boolean; life: number; top: number }
interface Ripple { x: number; y: number; t: number; big: number }
interface Faller { x: number; y: number; vy: number; vx: number; r: number; floor: number; red: number; rest: number }

export const SeasonWorld = forwardRef<WorldHandle, SeasonWorldProps>(function SeasonWorld({ layout, live, still, kind, cloudSeed, drift, children }, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null), backRef = useRef<HTMLCanvasElement | null>(null), frontRef = useRef<HTMLCanvasElement | null>(null);
  const sunRef = useRef<HTMLDivElement | null>(null), frostRef = useRef<HTMLDivElement | null>(null);
  const props = useRef({ layout, still, kind, drift }); props.current = { layout, still, kind, drift };
  const sim = useRef({
    t: 0, gust: 0, sway: 0, snowOff: 0, bloom: null as { x: number; y: number; t: number } | null, picked: new Set<number>(), pickedSeason: -1,
    clouds: [] as { x: number; y: number; size: number; seed: number; pulse: number }[], rain: [] as Flake[], snow: [] as Flake[], leaves: [] as AirLeaf[], petals: [] as Flake[],
    beads: [] as Bead[], ripples: [] as Ripple[], fallers: [] as Faller[], cells: new Float32Array(48).fill(1), floorShift: 0, eyes: 0, friendWobble: 0, flock: -1, sunPulse: 0,
    treeKey: '', treeWait: 0, treeCv: null as HTMLCanvasElement | null, shadeCv: null as HTMLCanvasElement | null, tones: null as Tones | null, dpr: 1,
  });

  useEffect(() => {
    const random = seededPlay(cloudSeed || 7);
    sim.current.clouds = Array.from({ length: 5 }, (_, i) => ({ x: (i + random() * 0.7) / 5, y: 0.12 + random() * 0.5, size: 0.75 + random() * 0.6, seed: Math.floor(random() * 9999) + 1, pulse: 0 }));
  }, [cloudSeed]);

  /** Geometry shared by drawing and touching. */
  const geo = () => {
    const L = props.current.layout, H = L.tree.h;
    return { L, H, crown: { x: L.tree.x + TREE.crown.cx * H, y: L.tree.y + TREE.crown.cy * H, rx: TREE.crown.rx * H, ry: TREE.crown.ry * H }, knot: { x: L.tree.x + TREE.knot.x * H, y: L.tree.y + TREE.knot.y * H }, skyH: Math.max(40, L.horizon) };
  };
  const cloudAt = (i: number) => { const { L, skyH } = geo(), c = sim.current.clouds[i]; const span = L.w * 1.3; return { x: ((c.x % 1 + 1) % 1) * span - L.w * 0.15, y: Math.max(18, skyH * (L.portrait ? 0.14 + c.y * 0.36 : 0.1 + c.y * 0.62)), size: Math.max(34, Math.min(L.w, L.h) * 0.11) * c.size }; };
  const sunAtNow = () => { const { L, skyH } = geo(), v = live.current, arc = sunArc(wrapYear(v.year), v.hour ?? hourAt(wrapYear(v.year))); return { arc, x: arc.x * L.w, y: L.horizon - arc.lift * skyH * 0.92 - skyH * 0.04 }; };

  useImperativeHandle(ref, () => ({
    touchAt(x, y) {
      const { L, crown, knot } = geo(), s = sim.current, year = wrapYear(live.current.year);
      if (Math.hypot(x - knot.x, y - knot.y) < Math.max(22, L.tree.h * 0.05)) return 'knotHole';
      // A cloud riding over the top of the crown is the cloud: a finger on it means the sky, not the tree.
      if (y < crown.y - crown.ry * 0.4) for (let i = 0; i < s.clouds.length; i++) { const c = cloudAt(i); if (Math.abs(x - c.x) < c.size && Math.abs(y - c.y) < c.size * 0.55) return 'cloudPuff'; }
      if (((x - crown.x) / (crown.rx * 1.02)) ** 2 + ((y - crown.y) / (crown.ry * 1.05)) ** 2 < 1) return 'treeCrown';
      if (Math.abs(x - L.tree.x) < L.tree.h * 0.07 && y < L.tree.y && y > crown.y) return 'treeCrown';
      if (lifeAt(year).snowman > 0.4 && Math.abs(x - L.spots.snowFriend.x) < L.spots.snowFriend.h * 0.34 && y < L.spots.snowFriend.y + 6 && y > L.spots.snowFriend.y - L.spots.snowFriend.h) return 'snowFriend';
      if (y >= L.floorTop) {
        const fill = puddleFill(year, live.current.sky);
        if (fill > 0.15) for (const p of L.puddles) if (((x - p.x) / (p.rx * 1.1)) ** 2 + ((y - p.y) / (p.ry * 1.6 + 8)) ** 2 < 1) return 'floorPuddle';
        return 'terraceFloor';
      }
      // The far mountain is a cone: its flanks widen below the peak (the low winter sun sits just above it).
      const peakY = L.horizon - L.view.size * 0.1, peakX = L.view.left + L.view.size * 0.51;
      if (y > peakY && y < L.horizon + 4 && Math.abs(x - peakX) < (y - peakY) * 1.5 + L.view.size * 0.012) return 'farMountain';
      const sun = sunAtNow();
      if (Math.hypot(x - sun.x, y - sun.y) < Math.max(34, Math.min(L.w, L.h) * 0.075)) return 'sunDisc';
      for (let i = 0; i < s.clouds.length; i++) { const c = cloudAt(i); if (Math.abs(x - c.x) < c.size * 1.25 && Math.abs(y - c.y) < c.size * 0.7) return 'cloudPuff'; }
      return y < L.wallTop ? 'openSky' : 'terraceFloor';
    },
    answer(touch, x, y) {
      const { L, crown } = geo(), s = sim.current, year = wrapYear(live.current.year), season = seasonAt(year);
      if (touch === 'cloudPuff' || touch === 'openSky') {
        // The nearest cloud swells under the finger; in open sky it comes over to where the finger is.
        let best = 0, near = Infinity;
        s.clouds.forEach((_, i) => { const c = cloudAt(i), d = Math.hypot(x - c.x, y - c.y); if (d < near) { near = d; best = i; } });
        const c = s.clouds[best]; c.pulse = 1;
        if (touch === 'openSky') { c.x = (x + L.w * 0.15) / (L.w * 1.3); c.y = Math.max(0, Math.min(1, L.portrait ? (y / Math.max(40, L.horizon) - 0.14) / 0.36 : (y / Math.max(40, L.horizon) - 0.1) / 0.62)); }
        return 1;
      }
      if (touch === 'sunDisc') { s.sunPulse = 1; return 1; }
      if (touch === 'knotHole') { s.eyes = 2.4; return 1; }
      if (touch === 'snowFriend') { s.friendWobble = 1; return 1; }
      if (touch === 'floorPuddle') { s.ripples.push({ x, y, t: 0, big: 1 }, { x, y, t: -0.12, big: 1 }); return 1; }
      if (touch === 'treeCrown') {
        s.sway += (x < crown.x ? 1 : -1) * 0.9;
        const tx = (x - L.tree.x) / L.tree.h, ty = (y - L.tree.y) / L.tree.h;
        if (season === 0) { s.bloom = { x: tx, y: ty, t: 1 }; return 2; }
        if (season === 3) { const had = 1 - s.snowOff; s.snowOff = 1; return had > 0.3 ? 3 : 1; }
        if (season === 2) {
          for (let i = 0; i < 12 && s.leaves.length < 60; i++) s.leaves.push({ x: x + (Math.random() - 0.5) * crown.rx * 0.5, y: y + (Math.random() - 0.5) * crown.ry * 0.4, z: 0.4 + Math.random() * 0.6, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 7, hue: Math.random(), life: 4, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 60 });
          return 2;
        }
        // Summer: the nearest ripe apple lets go.
        let best = -1, near = Infinity;
        TREE.apples.forEach((a, i) => { if (s.picked.has(i) || appleState(a.seed, year).size < 0.5) return; const d = Math.hypot(a.x - tx, a.y - ty); if (d < near) { near = d; best = i; } });
        if (best >= 0) {
          const a = TREE.apples[best]; s.picked.add(best); s.pickedSeason = season;
          s.fallers.push({ x: L.tree.x + a.x * L.tree.h, y: L.tree.y + a.y * L.tree.h, vy: 0, vx: (Math.random() - 0.5) * 60, r: a.r * L.tree.h, floor: L.tree.y + L.tree.h * (0.06 + Math.random() * 0.1), red: appleState(a.seed, year).red, rest: 0 });
          return 4;
        }
        return 1;
      }
      return 1;
    },
    gust(dir, strength) { const s = sim.current; s.gust = Math.max(-1.6, Math.min(1.6, s.gust + dir * strength)); s.sway += dir * strength * 0.8; s.floorShift += dir * strength; },
    brush(x, y) {
      const { L } = geo(), s = sim.current, year = wrapYear(live.current.year);
      let moved = 0;
      if (snowDepth(year) > 0.25 && Math.abs(y - L.wallTop) < Math.max(26, L.h * 0.045)) {
        const i = Math.floor((x / L.w) * s.cells.length);
        for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < s.cells.length && s.cells[j] > 0.3) { s.cells[j] = 0; moved++; }
      }
      for (const b of s.beads) if (b.life > 0 && Math.hypot(b.x * L.w - x, b.y * L.h - y) < 30) { b.life = 0; moved++; }
      return moved;
    },
    flock() { sim.current.flock = 0; },
    crown() { return geo().crown; },
  }), [live]);

  useEffect(() => {
    const root = rootRef.current, back = backRef.current, front = frontRef.current;
    if (!root || !back || !front) return;
    const s = sim.current;
    s.tones = readTones(root);
    const tones = s.tones, painter = makeTreePainter(TREE, tones);
    let raf = 0, last = 0, alive = true, skip = 0;
    const views = Array.from(root.querySelectorAll<HTMLElement>('[data-sd-view]'));
    const stops = SEASON_VIEWS.map(v => v.at);
    const fit = (cv: HTMLCanvasElement) => {
      const { L } = geo(), dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, L.w * L.h > 620000 ? 1.5 : 2);
      s.dpr = dpr;
      const pw = Math.round(L.w * dpr), ph = Math.round(L.h * dpr);
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      const ctx = cv.getContext('2d'); if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, L.w, L.h);
      return ctx;
    };
    const draw = (time: number) => {
      raf = 0; if (!alive) return;
      raf = requestAnimationFrame(draw);
      const quiet = props.current.still;
      if (quiet && (skip = (skip + 1) % 6) !== 1) { last = time; return; }
      const real = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60; last = time;
      const dt = quiet ? 0 : real;
      s.t += dt;
      const { L, H, crown, skyH } = geo(), v = live.current, year = wrapYear(v.year), season = seasonAt(year);
      const sun = sunAtNow(), arc = sun.arc, cover = coverAt(year, v.sky), fall = fallAt(year, v.sky), air = weatherAt(year);
      const gold = Math.max(arc.gold * 0.55, v.gold), day = arc.day * (1 - 0.3 * smoothstep(0.5, 1, cover));
      const skyTone = mixRgb(mixRgb(tones.of('sky'), tones.of('steel-light'), smoothstep(0.4, 0.95, cover)), tones.of('amber'), gold * 0.35);

      /* settle the little motions */
      s.gust *= Math.exp(-real / 0.9); s.sway *= Math.exp(-real / 0.55); s.floorShift *= Math.exp(-real / 5);
      if (s.bloom) { s.bloom.t -= real / 1.6; if (s.bloom.t <= 0) s.bloom = null; }
      if (fall.snow > 0.2) s.snowOff = Math.max(0, s.snowOff - real / 9); else if (season !== 3) s.snowOff = 0;
      if (s.pickedSeason >= 0 && (year < 0.18 || year > 0.56)) { s.picked.clear(); s.pickedSeason = -1; s.fallers.length = 0; }
      s.eyes = Math.max(0, s.eyes - real); s.friendWobble *= Math.exp(-real / 0.5); s.sunPulse *= Math.exp(-real / 0.45);
      for (let i = 0; i < s.cells.length; i++) if (s.cells[i] < 1) s.cells[i] = Math.min(1, s.cells[i] + (fall.snow > 0.15 ? real / 7 : real / 40));

      /* the views, the sun and the light (DOM, set here so React never has to) */
      const mix = viewMix(stops, year);
      views.forEach((el, i) => {
        const o = i === mix.from ? 1 : i === mix.to ? mix.t : 0;
        el.style.opacity = o.toFixed(3); el.style.visibility = o > 0.004 ? 'visible' : 'hidden'; el.style.zIndex = i === mix.to ? '1' : '0';
      });
      const light = (name: string, value: number | string) => root.style.setProperty(name, typeof value === 'number' ? value.toFixed(3) : value);
      const shade = shadowOf(arc, L.tree.x / L.w);
      light('--sd-sun-x', `${sun.x.toFixed(1)}px`); light('--sd-sun-y', `${sun.y.toFixed(1)}px`);
      light('--sd-gold', gold); light('--sd-day', day); light('--sd-dim', smoothstep(0.5, 1, cover) * 0.5 + fall.rain * 0.12); light('--sd-glow', arc.day * (1 - 0.7 * smoothstep(0.45, 0.95, cover)));
      light('--sd-sh-x', shade.dx); light('--sd-sh-y', shade.dy); light('--sd-sh-a', shade.strength * (1 - 0.7 * smoothstep(0.4, 0.95, cover)));
      if (sunRef.current) sunRef.current.style.transform = `translate(${sun.x.toFixed(1)}px, ${sun.y.toFixed(1)}px) scale(${(1 + s.sunPulse * 0.35).toFixed(3)})`;
      if (frostRef.current) { const f = frost(year) * 0.9; frostRef.current.style.opacity = f.toFixed(3); frostRef.current.style.visibility = f > 0.01 ? 'visible' : 'hidden'; }
      root.dataset.gold = gold > 0.02 ? '1' : '0'; root.dataset.dim = cover > 0.5 || fall.rain > 0.02 ? '1' : '0'; root.dataset.dusk = day < 0.985 ? '1' : '0';

      /* ── the back canvas ── */
      const ctx = fit(back); if (!ctx) return;
      paintRainbow(ctx, tones, L.w * 0.5, L.horizon + L.view.size * 0.06, Math.min(L.view.size * 0.44, L.w * 0.62), rainbowAt(year, v.sky));
      const heavy = smoothstep(0.42, 0.95, cover);
      s.clouds.forEach((c, i) => {
        c.x += (dt * (0.006 + 0.004 * c.size) * props.current.drift + s.gust * real * 0.09) / 1.3; c.pulse *= Math.exp(-real / 0.4);
        const at = cloudAt(i), show = Math.min(1, 0.16 + cover * 1.1) * (i < 2 || cover > 0.3 ? 1 : cover / 0.3);
        paintCloud(ctx, tones, at.x, at.y, at.size * (0.8 + 0.5 * cover), heavy, show * (0.55 + 0.45 * arc.day), c.seed, 1 - c.pulse * 0.22);
      });
      if (s.flock >= 0) {
        s.flock += real / 5.5;
        if (s.flock >= 1) s.flock = -1;
        else {
          const k = Math.max(1, L.view.size / 560);
          ctx.strokeStyle = tones.css(tones.of('slate')); ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round'; ctx.globalAlpha = 0.8;
          for (let i = 0; i < 9; i++) {
            const bx = L.w * (1.1 - s.flock * 1.35) + ((i % 3) * 34 + Math.floor(i / 3) * 20) * k, by = skyH * (0.4 + 0.05 * (i % 3)) + Math.floor(i / 3) * 16 * k + Math.sin(s.t * 2 + i) * 3, flap = Math.sin(s.t * 9 + i) * 6 * k;
            ctx.beginPath(); ctx.moveTo(bx - 12 * k, by - flap); ctx.quadraticCurveTo(bx - 5 * k, by - 3 * k, bx, by); ctx.quadraticCurveTo(bx + 5 * k, by - 3 * k, bx + 12 * k, by - flap); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      // Snow lying along the parapet: a row of mounds a finger can brush off.
      const depth = snowDepth(year);
      if (depth > 0.03) {
        const n = s.cells.length, cw = L.w / n;
        for (let i = 0; i < n; i++) {
          const hh = depth * s.cells[i] * (L.view.size * 0.012) * (0.7 + 0.6 * (((i * 7919) % 13) / 13));
          ctx.globalAlpha = 1; paintSnowMound(ctx, tones, (i + 0.5) * cw, L.wallTop + L.view.size * 0.004, cw * 1.25, hh);
        }
      }
      const fill = puddleFill(year, v.sky);
      for (const p of L.puddles) paintPuddle(ctx, tones, p.x, p.y, p.rx, p.ry, fill, skyTone, s.t);
      // Ripples where rain lands and where a finger splashes.
      ctx.strokeStyle = tones.css(tones.of('white'));
      for (let i = s.ripples.length - 1; i >= 0; i--) {
        const r = s.ripples[i]; r.t += real * (r.big ? 1.1 : 2.2);
        if (r.t >= 1) { s.ripples.splice(i, 1); continue; }
        if (r.t < 0) continue;
        const rr = (r.big ? 46 : 12) * (0.3 + r.t) * (L.w > 700 ? 1.3 : 1);
        ctx.globalAlpha = (1 - r.t) * (r.big ? 0.8 : 0.5); ctx.lineWidth = r.big ? 2.2 : 1.1;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // The floor's own litter: fallen leaves in autumn, petals after the blossom.
      const carpet = fallenLeaves(year), petalsDown = smoothstep(0.08, 0.13, year) * (1 - smoothstep(0.17, 0.24, year));
      if (carpet > 0.02 || petalsDown > 0.02) {
        const random = seededPlay(4411);
        for (let i = 0; i < 84; i++) {
          const near = i < 46, ang = random() * Math.PI * 2, rad = near ? H * (0.1 + random() * 0.34) : 0, d = near ? 0 : random();
          const fx = near ? L.tree.x + Math.cos(ang) * rad * 1.5 : random() * L.w, fy = near ? L.tree.y + H * 0.03 + Math.sin(ang) * rad * 0.3 : L.floorTop + d * d * (L.h - L.floorTop) + 6;
          const th = random(), hue = random(), rot = random() * 6, size = H * 0.042 * (0.75 + 0.7 * ((fy - L.floorTop) / Math.max(1, L.h - L.floorTop)));
          const x = ((fx + s.floorShift * (40 + 120 * hue) + L.w) % (L.w + 40)) - 20;
          if (fy < L.floorTop + 3) continue;
          if (carpet > th * 0.9) { ctx.globalAlpha = Math.min(1, (carpet - th * 0.9) * 6); paintLooseLeaf(ctx, tones, x, fy, rot + s.floorShift * hue * 3, size, 3 + hue * 2, 0.35 + 0.5 * random(), 0.42); }
          else if (petalsDown > th && i % 2 === 0) { ctx.globalAlpha = Math.min(1, (petalsDown - th) * 5) * 0.9; ctx.beginPath(); ctx.ellipse(x, fy, size * 0.3, size * 0.13, rot, 0, Math.PI * 2); ctx.fillStyle = tones.css(mixRgb(tones.of('blossom'), tones.of('white'), hue * 0.6)); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
      }

      /* the tree: painted into its own picture when the year or the light moves, then set down with its shadow */
      const lightX = Math.max(-1, Math.min(1, (sun.x - crown.x) / (L.w * 0.5))), lightLen = Math.hypot(lightX, 0.75) || 1;
      const key = `${Math.round(year * 1600)}|${Math.round(lightX * 10)}|${Math.round(gold * 12)}|${Math.round(day * 8)}|${Math.round(s.snowOff * 10)}|${s.picked.size}|${s.bloom ? Math.round(s.bloom.t * 12) : 0}|${Math.round(H)}|${props.current.kind}`;
      const cw = Math.ceil(TREE.reach * 2 * H + 24), ch = Math.ceil(H * 1.14);
      // A slow device repaints the tree every few frames while the year is moving, never every frame.
      if (s.treeWait > 0 && s.treeCv) s.treeWait--;
      else if (key !== s.treeKey || !s.treeCv) {
        const began = performance.now();
        s.treeKey = key;
        const cv = s.treeCv ?? (s.treeCv = document.createElement('canvas')), q = s.dpr;
        if (cv.width !== Math.round(cw * q) || cv.height !== Math.round(ch * q)) { cv.width = Math.round(cw * q); cv.height = Math.round(ch * q); }
        const tc = cv.getContext('2d');
        if (tc) {
          tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, cv.width, cv.height);
          painter.paint(tc, H, q, cw / 2, H * 1.06, { year, lightX: lightX / lightLen, lightY: -0.75 / lightLen, gold, day, snowOff: s.snowOff, picked: s.picked, ripe: yearLook(props.current.kind).ripe, bloom: s.bloom });
        }
        const sv = s.shadeCv ?? (s.shadeCv = document.createElement('canvas')), sw = Math.max(8, Math.round(cw / 5)), sh = Math.max(8, Math.round(ch / 5));
        if (sv.width !== sw || sv.height !== sh) { sv.width = sw; sv.height = sh; }
        const sc = sv.getContext('2d');
        if (sc) { sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, sw, sh); sc.drawImage(cv, 0, 0, sw, sh); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = tones.css(tones.of('indigo-deep')); sc.fillRect(0, 0, sw, sh); }        s.treeWait = Math.min(6, Math.floor((performance.now() - began) / 9));
      }
      const windy = Math.max(air.leaves, fall.rain * 0.5, fall.snow * 0.3);
      const shear = (Math.sin(s.t * 0.9) * 0.006 + Math.sin(s.t * 2.3 + 1) * 0.003) + windy * Math.sin(s.t * 3.1) * 0.01 + s.gust * 0.05 + s.sway * Math.sin(s.t * 14) * 0.02;
      if (s.shadeCv) {
        ctx.save(); ctx.translate(L.tree.x, L.tree.y + 2); ctx.transform(1, 0, -shade.dx, -shade.dy, 0, 0);
        ctx.globalAlpha = Math.min(0.5, shade.strength * (1 - 0.7 * smoothstep(0.4, 0.95, cover)) * 1.15); ctx.imageSmoothingEnabled = true;
        ctx.drawImage(s.shadeCv, -cw / 2, -H * 1.06, cw, ch); ctx.restore();
      }
      paintBed(ctx, tones, L.tree.x, L.tree.y, H * 0.2, depth, smoothstep(0.02, 0.2, year) * (1 - smoothstep(0.5, 0.66, year)));
      if (s.treeCv) { ctx.save(); ctx.translate(L.tree.x, L.tree.y); ctx.transform(1, 0, shear, 1, 0, 0); ctx.drawImage(s.treeCv, -cw / 2, -H * 1.06, cw, ch); ctx.restore(); }
      if (s.eyes > 0) {
        const blink = s.eyes > 2.2 || (s.eyes < 1.3 && s.eyes > 1.15) ? 0.15 : 1, kx = L.tree.x + TREE.knot.x * H + shear * TREE.knot.y * H, ky = L.tree.y + TREE.knot.y * H, er = H * 0.0062;
        ctx.fillStyle = tones.css(tones.of('butter')); ctx.globalAlpha = Math.min(1, s.eyes * 2);
        for (const ex of [-1, 1]) { ctx.beginPath(); ctx.ellipse(kx + ex * er * 1.5, ky, er, er * blink, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      const friend = lifeAt(year).snowman;
      if (friend > 0.02) { ctx.globalAlpha = Math.min(1, friend * 1.6); paintSnowFriend(ctx, tones, L.spots.snowFriend.x, L.spots.snowFriend.y, L.spots.snowFriend.h * (0.55 + 0.45 * friend), yearLook(props.current.kind).scarf, lightX, s.friendWobble * Math.sin(s.t * 18)); ctx.globalAlpha = 1; }
      for (const f of s.fallers) {
        if (f.rest < 1) { f.vy += 1500 * real; f.y += f.vy * real; f.x += f.vx * real; if (f.y > f.floor) { f.y = f.floor; f.vy = -f.vy * 0.36; f.vx *= 0.6; if (Math.abs(f.vy) < 60) f.rest = 1; } }
        ctx.beginPath(); ctx.ellipse(f.x, f.floor + f.r * 0.8, f.r * 1.1, f.r * 0.3, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.22; ctx.fillStyle = tones.css(tones.of('shadow')); ctx.fill(); ctx.globalAlpha = 1;
        paintApple(ctx, tones, f.x, f.y, f.r, f.red, yearLook(props.current.kind).ripe);
      }

      /* ── the front canvas: what falls, and the glass ── */
      const fc = fit(front); if (!fc) return;
      const slant = s.gust * 0.5 + props.current.drift * 0.1, hs = L.h / 720;
      const want = (list: Flake[], n: number) => { while (list.length < n) list.push({ x: Math.random(), y: Math.random(), z: Math.random(), p: Math.random() * 6 }); if (list.length > n) list.length = n; };
      want(s.rain, Math.round(130 * fall.rain)); want(s.snow, Math.round(120 * fall.snow)); want(s.petals, Math.round(28 * air.petals));
      fc.lineCap = 'round'; fc.strokeStyle = tones.css(mixRgb(tones.of('white'), tones.of('sky'), 0.3));
      for (const d of s.rain) {
        const speed = (900 + 1100 * d.z) * hs, len = (20 + 44 * d.z) * hs, ground = L.floorTop + d.z * (L.h - L.floorTop) * 1.05;
        d.y += (speed * dt) / L.h; d.x -= (slant * speed * dt) / L.w;
        if (d.y * L.h > ground) { if (s.ripples.length < 16 && d.z > 0.1 && !quiet) s.ripples.push({ x: d.x * L.w, y: ground, t: 0, big: 0 }); d.y = -0.05 - Math.random() * 0.2; d.x = Math.random() * 1.2 - 0.1; d.z = Math.random(); }
        fc.globalAlpha = 0.3 + 0.5 * d.z; fc.lineWidth = (1 + 2.2 * d.z) * Math.max(0.85, hs);
        fc.beginPath(); fc.moveTo(d.x * L.w, d.y * L.h); fc.lineTo(d.x * L.w + slant * len, d.y * L.h - len); fc.stroke();
      }
      fc.fillStyle = tones.css(tones.of('white'));
      for (const d of s.snow) {
        d.y += ((34 + 96 * d.z) * hs * dt) / L.h; d.x += ((Math.sin(d.p + s.t * 1.1) * 16 + s.gust * 320 * (0.3 + d.z)) * dt) / L.w;
        if (d.y > 1.04) { d.y = -0.04; d.x = Math.random(); } if (d.x > 1.05) d.x -= 1.1; else if (d.x < -0.05) d.x += 1.1;
        const r = (1.1 + 3.4 * d.z * d.z) * (d.z > 0.9 ? 1.9 : 1) * Math.max(0.8, hs);
        fc.globalAlpha = d.z > 0.9 ? 0.42 : 0.5 + 0.45 * d.z; fc.beginPath(); fc.arc(d.x * L.w, d.y * L.h, r, 0, Math.PI * 2); fc.fill();
      }
      for (const d of s.petals) {
        d.y += ((40 + 50 * d.z) * hs * dt) / L.h; d.x += ((Math.sin(d.p + s.t * 1.6) * 26 + s.gust * 300 - 14 * props.current.drift) * dt) / L.w;
        if (d.y > 1.04) { d.y = -0.04; d.x = Math.random(); } if (d.x > 1.05) d.x -= 1.1; else if (d.x < -0.05) d.x += 1.1;
        const r = (3 + 5 * d.z) * Math.max(0.8, hs);
        fc.globalAlpha = 0.85; fc.fillStyle = tones.css(mixRgb(tones.of('blossom'), tones.of('white'), d.z * 0.6));
        fc.beginPath(); fc.ellipse(d.x * L.w, d.y * L.h, r, r * 0.55, d.p + s.t * (1 + d.z), 0, Math.PI * 2); fc.fill();
      }
      // Leaves on the wind: the autumn's own, and any torn loose by a touch or a gust.
      const ambient = Math.round(30 * air.leaves);
      let have = 0; for (const l of s.leaves) if (l.life > 90) have++;
      while (have < ambient && s.leaves.length < 70) { s.leaves.push({ x: Math.random() * L.w, y: Math.random() * L.h * 0.9, z: Math.random(), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 5, hue: Math.random(), life: 100, vx: 0, vy: 0 }); have++; }
      for (let i = s.leaves.length - 1; i >= 0; i--) {
        const l = s.leaves[i], wild = l.life > 90;
        if (wild && have > ambient) { s.leaves.splice(i, 1); have--; continue; }
        if (!wild) { l.life -= real; l.vy += 220 * real; l.vx *= Math.exp(-real / 1.2); if (l.life <= 0) { s.leaves.splice(i, 1); continue; } }
        const wind = -(70 + 150 * l.z) * props.current.drift * (wild ? 1 : 0.25) + s.gust * 620 * (0.4 + l.z);
        l.x += (wind + l.vx + Math.sin(s.t * 2 + l.rot) * 30) * dt; l.y += ((wild ? 46 + 60 * l.z : Math.min(l.vy, 240)) + Math.cos(s.t * 1.7 + l.hue * 6) * 26) * dt * hs; l.rot += l.spin * dt;
        if (wild) { if (l.x < -30) l.x = L.w + 20; else if (l.x > L.w + 30) l.x = -20; if (l.y > L.h + 20) { l.y = -20; l.x = Math.random() * L.w; } }
        fc.globalAlpha = wild ? 0.95 : Math.min(1, l.life);
        paintLooseLeaf(fc, tones, l.x, l.y, l.rot, (12 + 20 * l.z) * Math.max(0.8, hs), 3 + l.hue * 2, 0.4 + 0.5 * l.z, 0.55 + 0.45 * Math.abs(Math.sin(l.rot * 0.7 + s.t)));
      }
      // Rain beads on the camera's glass: they gather, swell and run.
      if (fall.rain > 0.12 && s.beads.length < 22 && Math.random() < real * (2 + 6 * fall.rain) && !quiet) s.beads.push({ x: Math.random(), y: Math.random() * 0.8, r: 3 + Math.random() * 6, vy: 0, run: false, life: 1, top: 0 });
      for (let i = s.beads.length - 1; i >= 0; i--) {
        const b = s.beads[i];
        if (!b.run) { b.top = b.y; b.r += real * 0.5 * fall.rain; if (b.r > 9.5 || Math.random() < real * 0.12) b.run = true; if (fall.rain < 0.08) b.life -= real / 5; }
        else { b.vy = Math.min(0.7, b.vy + real * 0.5); b.y += b.vy * real * (0.6 + 0.4 * Math.sin(s.t * 5 + b.x * 40)); }
        if (b.y > 1.05 || b.life <= 0) { s.beads.splice(i, 1); continue; }
        const bx = b.x * L.w, by = b.y * L.h;
        fc.globalAlpha = 0.16 * b.life; fc.fillStyle = tones.css(tones.of('white'));
        if (b.run) { fc.beginPath(); fc.moveTo(bx - b.r * 0.3, b.top * L.h); fc.lineTo(bx + b.r * 0.3, b.top * L.h); fc.lineTo(bx + b.r * 0.6, by); fc.lineTo(bx - b.r * 0.6, by); fc.closePath(); fc.fill(); }
        fc.globalAlpha = 0.3 * b.life; fc.beginPath(); fc.ellipse(bx, by, b.r, b.r * 1.15, 0, 0, Math.PI * 2); fc.fill();
        fc.globalAlpha = 0.36 * b.life; fc.strokeStyle = tones.css(tones.of('slate')); fc.lineWidth = 1; fc.beginPath(); fc.arc(bx, by + b.r * 0.1, b.r * 0.95, 0.15 * Math.PI, 0.85 * Math.PI); fc.stroke();
        fc.globalAlpha = 0.9 * b.life; fc.beginPath(); fc.ellipse(bx - b.r * 0.32, by - b.r * 0.4, b.r * 0.26, b.r * 0.18, -0.6, 0, Math.PI * 2); fc.fill();
      }
      fc.globalAlpha = 1;
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; } else if (!raf && alive) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(draw);
    return () => {
      alive = false; if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      // Give the pixels back: canvases are sized to nothing on the way out.
      for (const cv of [back, front, s.treeCv, s.shadeCv]) if (cv) { cv.width = 0; cv.height = 0; }
      s.treeCv = null; s.shadeCv = null; s.treeKey = ''; painter.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = layout.view.size;
  return <div ref={rootRef} className="sd-world" data-sd-world="">
    <div className="sd-views" data-play-depth="3" aria-hidden="true">
      {SEASON_VIEWS.map(view => <div key={view.id} className="sd-view" data-sd-view={view.id} style={{ inlineSize: size, blockSize: size, left: layout.view.left, top: layout.view.top }}>
        <img className="sd-view__side" src={view.picture.src} alt="" draggable={false} decoding="async" style={{ left: -size + 2 }} />
        <img src={view.picture.src} alt="" draggable={false} decoding="async" />
        <img className="sd-view__side" src={view.picture.src} alt="" draggable={false} decoding="async" style={{ left: size - 2 }} />
      </div>)}
    </div>
    <div ref={sunRef} className="sd-sun" aria-hidden="true"><span className="sd-sun__rays" /><span className="sd-sun__disc" /></div>
    <canvas ref={backRef} className="sd-canvas" aria-hidden="true" />
    <div className="sd-cast">{children}</div>
    <canvas ref={frontRef} className="sd-canvas sd-canvas--front" aria-hidden="true" />
    <div className="sd-light sd-light--glow" aria-hidden="true" />
    <div className="sd-light sd-light--gold" aria-hidden="true" />
    <div className="sd-light sd-light--dim" aria-hidden="true" />
    <div className="sd-light sd-light--dusk" aria-hidden="true" />
    <div ref={frostRef} className="sd-frost" aria-hidden="true" />
  </div>;
});
