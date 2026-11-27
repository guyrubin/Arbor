/** Clay Theatre's set, painted: the felt cloth and its clay dressing, the
 * hero, the onion-skin ghosts, the friend and the lamp's light. The same
 * function paints the stage, a frame on the film strip and the premiere's
 * screen: only the view changes. Geometry comes from clayBody (pure); this
 * file only lays it on a canvas. */
import { leafPoints, seeded, type Pt } from './clayShapes';
import {
  HEROES, boilOutline, buddyParts, buddyPose, heroOutline, heroPieces, ovalPoints, posePoint, posePoints, pressOutline, starPoints,
  type BuddyAct, type BuddyId, type HeroId, type Pose, type Pulls, type ToneId,
} from './clayBody';
import { GROUND, SET_W, STORIES, type Box, type ClayId, type GelId, type Print, type ShowLook, type SkyId, type StoryId } from './clayTheatreRules';
import { LIGHT, chalked, feltPattern, mixRgb, paint, paintClay, paintGhost, paintGroove, paintShadow, trace, type Palette, type PaletteName, type RGB } from './clayPaint';

type Ctx = CanvasRenderingContext2D;
/** The six lumps: which palette clay each is. */
export const CLAY_TONES: Readonly<Record<ClayId, PaletteName>> = { red: 'poppy', orange: 'orange', yellow: 'amber', green: 'leaf', blue: 'water', purple: 'violet' };
export const clayTone = (id: ClayId | null, pal: Palette): RGB => (id ? chalked(pal[CLAY_TONES[id]], pal) : mixRgb(pal.linen, pal.chalk, 0.45));
export const GEL_TONES: Readonly<Record<GelId, PaletteName | null>> = { clearGel: null, roseGel: 'rose', blueGel: 'water', goldGel: 'sun' };

export interface SceneHero {
  id: HeroId; body: RGB; trim: RGB; pulls: Pulls; pose: Pose;
  prints?: readonly Print[];
  /** A finger pressing now: where (the hero's own coordinates) and how hard (0…1). */
  press?: { at: Pt; amount: number } | null;
  /** The set point the eyes follow, if any. */
  look?: Pt | null;
  blink?: boolean;
  marble?: { tone: RGB; amount: number } | null;
  /** How much the clay boils (0 a held still, 1 a fresh drawing). */
  boil?: number;
}
export interface SceneBuddy { id: BuddyId; at: Pt; act: BuddyAct | null; tone: RGB; drawing: number }
export interface Scene {
  story: StoryId; look: ShowLook;
  /** The drawing on screen: the boil and every moving piece are seeded by it. */
  drawing: number;
  hero: SceneHero | null; ghosts?: readonly Pose[]; buddy?: SceneBuddy | null;
  gel: GelId;
}
export interface View {
  /** Pixels per clay unit and the pixel of the set's (0, 0). */
  unit: number; ox: number; oy: number;
  /** The cloth behind the hero, in clay units; or, for a film frame, the whole frame in pixels. */
  cloth?: Box; frame?: Box;
  /** 0 a tiny thumbnail … 1 the stage. */
  detail: number;
}

interface Sky { top: PaletteName; low: PaletteName; glow: PaletteName }
const SKIES: Readonly<Record<SkyId, readonly Sky[]>> = {
  seaDay: [{ top: 'sky', low: 'sky-pale', glow: 'white' }, { top: 'bluebell', low: 'blossom', glow: 'butter' }, { top: 'sea', low: 'sky-pale', glow: 'snow' }],
  // B-KID-173: the night stage is dimmed pearl felt (steel to chalk), never a navy sky.
  deepNight: [{ top: 'steel', low: 'chalk', glow: 'butter' }, { top: 'steel-light', low: 'snow', glow: 'lilac' }, { top: 'steel', low: 'sky-pale', glow: 'blossom' }],
  pondDawn: [{ top: 'sky-pale', low: 'butter', glow: 'blossom' }, { top: 'lilac', low: 'blossom', glow: 'butter' }, { top: 'sky', low: 'celadon', glow: 'white' }],
  gardenNoon: [{ top: 'sky', low: 'sky-pale', glow: 'butter' }, { top: 'sky-pale', low: 'butter', glow: 'white' }, { top: 'bluebell', low: 'sky-pale', glow: 'blossom' }],
};

/** The set is painted in three passes so the stage can keep the still ones: the cloth and what stands behind the cast, the cast, and what stands in front. */
export type ScenePart = 'backPass' | 'castPass' | 'frontPass';
/** Paints the set for one drawing: all of it, or one pass. */
export function paintScene(ctx: Ctx, view: View, scene: Scene, pal: Palette, part?: ScenePart): void {
  const back = !part || part === 'backPass', cast = !part || part === 'castPass', front = !part || part === 'frontPass';
  const story = STORIES[scene.story], P = (p: Pt): Pt => [view.ox + p[0] * view.unit, view.oy + p[1] * view.unit];
  const u = view.unit, d = scene.drawing, detail = view.detail, salt = scene.look.dressing;
  const clay = (points: readonly Pt[], tone: RGB, seed: number, boil = 0, extra: { alpha?: number; gloss?: number } = {}) =>
    paintClay(ctx, (boil ? boilOutline(points, d, seed, boil) : points).map(P), tone, pal, { seed: seed + salt, drawing: boil ? d : 0, unit: u, detail, ...extra });
  const sky = SKIES[story.sky][scene.look.hour % 3];
  ctx.save();
  if (view.frame) { ctx.beginPath(); ctx.rect(view.frame.x, view.frame.y, view.frame.w, view.frame.h); ctx.clip(); }
  const cloth = view.frame ? { x: (view.frame.x - view.ox) / u, y: (view.frame.y - view.oy) / u, w: view.frame.w / u, h: view.frame.h / u } : view.cloth;
  const left = cloth ? cloth.x : 0, right = cloth ? cloth.x + cloth.w : SET_W, top = cloth ? cloth.y : 0;

  /* The cloth: a felt cyclorama standing on the stage (or, on film, the whole frame). */
  if (cloth && back) {
    const [x0, y0] = P([cloth.x, cloth.y]), w = cloth.w * u, h = cloth.h * u, r = view.frame ? 0 : Math.min(w * 0.16, h * 0.42);
    const shape = () => { ctx.beginPath(); ctx.moveTo(x0, y0 + h); ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0); ctx.lineTo(x0 + w - r, y0); ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); ctx.lineTo(x0 + w, y0 + h); ctx.closePath(); };
    if (!view.frame) paintShadow(ctx, x0 + w / 2 - LIGHT[0] * 16 * u, y0 + h + 3 * u, w * 0.56, 13 * u, pal, 0.3);
    ctx.save(); shape(); ctx.clip();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, paint(pal[sky.top])); g.addColorStop(0.78, paint(pal[sky.low])); g.addColorStop(1, paint(mixRgb(pal[sky.low], pal[sky.glow], 0.5)));
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    const glow = ctx.createRadialGradient(x0 + w * 0.7, y0 + h * 0.12, 0, x0 + w * 0.7, y0 + h * 0.12, Math.max(w, h) * 0.7);
    glow.addColorStop(0, paint(pal[sky.glow], 0.5)); glow.addColorStop(1, paint(pal[sky.glow], 0));
    ctx.fillStyle = glow; ctx.fillRect(x0, y0, w, h);
    if (detail > 0.4) {
      const nap = feltPattern(ctx, pal);
      if (nap) { ctx.fillStyle = nap; ctx.fillRect(x0, y0, w, h); }
      // The cloth curves away at its edges: a soft shade inside them.
      const edge = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      edge.addColorStop(0, paint(pal.shadow, 0.26)); edge.addColorStop(0.1, paint(pal.shadow, 0)); edge.addColorStop(0.9, paint(pal.shadow, 0)); edge.addColorStop(1, paint(pal.shadow, 0.3));
      ctx.fillStyle = edge; ctx.fillRect(x0, y0, w, h);
    }
    ctx.restore();
    if (!view.frame && detail > 0.4) {
      // A stitched hem, the way felt is finished.
      ctx.save(); const inset = 5 * u; ctx.setLineDash([5 * u, 4 * u]); ctx.lineWidth = Math.max(1, 1.3 * u); ctx.strokeStyle = paint(pal.white, 0.6); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0 + inset, y0 + h); ctx.lineTo(x0 + inset, y0 + r); ctx.quadraticCurveTo(x0 + inset, y0 + inset, x0 + r, y0 + inset); ctx.lineTo(x0 + w - r, y0 + inset); ctx.quadraticCurveTo(x0 + w - inset, y0 + inset, x0 + w - inset, y0 + r); ctx.lineTo(x0 + w - inset, y0 + h); ctx.stroke(); ctx.restore();
      ctx.save(); shape(); ctx.lineWidth = Math.max(1, 1.2 * u); ctx.strokeStyle = paint(mixRgb(pal[sky.top], pal.shadow, 0.5), 0.5); ctx.stroke(); ctx.restore();
    }
  }
  if (view.frame && back) {
    // On film the stage floor is in the picture too.
    const [, gy] = P([0, GROUND - 14]);
    const floor = ctx.createLinearGradient(0, gy, 0, view.frame.y + view.frame.h);
    floor.addColorStop(0, paint(mixRgb(pal.snow, pal.chalk, 0.5))); floor.addColorStop(1, paint(mixRgb(pal.chalk, pal.slate, 0.25)));
    ctx.fillStyle = floor; ctx.fillRect(view.frame.x, gy, view.frame.w, view.frame.y + view.frame.h - gy);
  }
  const clip = () => { if (!cloth) return; const [x0, y0] = P([cloth.x, cloth.y]); ctx.beginPath(); ctx.rect(x0, y0 - 400 * u, cloth.w * u, cloth.h * u + 400 * u + 60 * u); ctx.clip(); };

  /* Dressing behind the hero. */
  ctx.save(); clip();
  const span = right - left, at = (k: number) => left + span * k;
  if (!back) { /* kept from an earlier pass */ }
  else if (story.sky === 'seaDay') {
    clay(ovalPoints(at(0.16 + 0.5 * seeded(salt, 1)), top + 44 + 20 * seeded(salt, 2), 21, 21), pal.sun, 11);
    for (let i = 0; i < 2; i++) cloud(at(0.2 + 0.55 * seeded(salt, 3 + i) + i * 0.08), top + 64 + 34 * i + 18 * seeded(salt, 6 + i), 0.8 + 0.3 * seeded(salt, 8 + i), 20 + i);
    waves(GROUND - 34, 'sea', 30, 0.55);
  } else if (story.sky === 'deepNight') {
    const mx = at(0.74 - 0.5 * seeded(salt, 1)), my = top + 50 + 24 * seeded(salt, 2);
    clay(ovalPoints(mx, my, 25, 25), mixRgb(pal.butter, pal.white, 0.25), 12);
    for (let i = 0; i < 7; i++) {
      const sx = at(0.07 + 0.86 * seeded(salt, 20 + i)), sy = top + 22 + (GROUND - top - 120) * seeded(salt, 40 + i), r = 6 + 5 * seeded(salt, 60 + i), tw = 1 + 0.08 * Math.sin(d * 0.9 + i * 2);
      if (Math.hypot(sx - mx, sy - my) < 44) continue;
      clay(starPoints(r * tw, r * 0.46).map(([x, y]) => [sx + x, sy + y] as Pt), pal.amber, 30 + i);
    }
    clay(moundPoints(at(0.5), GROUND - 6, span * 0.62, 26), mixRgb(pal.steel, pal.lilac, 0.4), 13);
  } else if (story.sky === 'pondDawn') {
    clay(ovalPoints(at(0.2 + 0.6 * seeded(salt, 1)), top + 52, 19, 19), mixRgb(pal.sun, pal.blossom, 0.3), 11);
    for (let i = 0; i < 5; i++) { const rx = at(i < 3 ? 0.03 + 0.05 * i : 0.87 + 0.05 * (i - 3)), hgt = 70 + 50 * seeded(salt, 10 + i); clay(leafPoints({ ax: rx, ay: GROUND - 8, tx: rx + 10 * (seeded(salt, 20 + i) - 0.5), ty: GROUND - 8 - hgt, w: 5 }), i % 2 ? pal.leaf : pal['leaf-deep'], 40 + i); }
    waves(GROUND - 26, 'teal', 34, 0.3);
    for (let i = 0; i < 3; i++) pad(at(0.16 + 0.3 * i + 0.1 * seeded(salt, 30 + i)), GROUND - 16 + 3 * (i % 2), 26 + 6 * seeded(salt, 33 + i), 50 + i);
  } else {
    clay(ovalPoints(at(0.78 - 0.5 * seeded(salt, 1)), top + 46, 20, 20), pal.sun, 11);
    cloud(at(0.3 + 0.3 * seeded(salt, 3)), top + 78, 0.9, 20);
    clay(moundPoints(at(0.26), GROUND - 4, span * 0.56, 58), pal.spring, 13);
    clay(moundPoints(at(0.78), GROUND - 4, span * 0.5, 42), pal.leaf, 14);
    for (let i = 0; i < 4; i++) flower(at(0.08 + 0.28 * i + 0.08 * seeded(salt, 70 + i)), GROUND - 18 - 16 * seeded(salt, 74 + i), 60 + i * 3, (['poppy', 'amber', 'violet', 'rose'] as const)[(i + (salt % 4)) % 4]);
  }
  ctx.restore();

  /* Ghosts of the frames already shot, oldest faintest. */
  if (cast && scene.hero && scene.ghosts?.length) {
    const full = heroOutline(scene.hero.id, scene.hero.pulls);
    scene.ghosts.forEach((pose, i) => paintGhost(ctx, posePoints(scene.hero!.id, pose, full).map(P), pal, scene.ghosts!.length === 1 ? 0.8 : 0.4 + 0.5 * (i / (scene.ghosts!.length - 1)), u));
  }
  if (cast && scene.buddy) paintBuddy(scene.buddy);
  if (cast && scene.hero) paintHero(scene.hero);

  /* Dressing in front of the hero: the near wave, the near grass. */
  ctx.save(); clip();
  if (!front) { /* kept from an earlier pass */ }
  else if (story.sky === 'seaDay') waves(GROUND - 12, 'teal', 26, 0);
  else if (story.sky === 'pondDawn') waves(GROUND - 6, 'teal-deep', 20, 0.7);
  else if (story.sky === 'gardenNoon') for (let i = 0; i < 9; i++) { const gx = at(0.04 + 0.115 * i); clay(leafPoints({ ax: gx, ay: GROUND + 2, tx: gx + 6 * (seeded(salt, 90 + i) - 0.5), ty: GROUND - 14 - 8 * seeded(salt, 80 + i), w: 4 }), i % 2 ? pal.leaf : pal.moss, 80 + i); }
  ctx.restore();

  /* The lamp's gel: light of that colour over everything on the set. */
  if (!part) paintGel(ctx, view, scene.gel, pal);
  ctx.restore();

  function cloud(x: number, y: number, k: number, seed: number) {
    const tone = mixRgb(pal.snow, pal.white, 0.5);
    clay(ovalPoints(x - 20 * k, y + 5 * k, 18 * k, 12 * k), tone, seed); clay(ovalPoints(x + 20 * k, y + 6 * k, 20 * k, 12 * k), tone, seed + 100); clay(ovalPoints(x, y - 3 * k, 22 * k, 16 * k), tone, seed + 200);
  }
  /** A ridged band of clay water right across the cloth, its crests rolling a little on every drawing. */
  function waves(y: number, tone: PaletteName, wavelength: number, phase: number) {
    const pts: Pt[] = [], n = Math.ceil(span / 4) + 2, roll = d * 0.35 + phase * 6.28;
    for (let i = 0; i <= n; i++) { const x = left - 12 + (i / n) * (span + 24), crest = Math.abs(Math.sin((x / wavelength) * 3.14 + roll)); pts.push([x, y + 5 - 9 * Math.pow(crest, 0.7)]); }
    const foot = GROUND + (view.frame ? 60 : 16);
    const px = pts.map(P), [fx0, fy] = P([left - 12, foot]), [fx1] = P([right + 12, foot]), round = view.frame ? 0 : 9 * u;
    if (!view.frame && detail > 0.4) paintShadow(ctx, (fx0 + fx1) / 2 - LIGHT[0] * 10 * u, fy + 1.5 * u, (fx1 - fx0) * 0.52, 8 * u, pal, 0.32);
    ctx.save(); ctx.beginPath(); px.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineTo(fx1, fy - round); ctx.quadraticCurveTo(fx1, fy, fx1 - round, fy); ctx.lineTo(fx0 + round, fy); ctx.quadraticCurveTo(fx0, fy, fx0, fy - round); ctx.closePath();
    const c = pal[tone], g = ctx.createLinearGradient(0, P([0, y - 8])[1], 0, fy);
    g.addColorStop(0, paint(mixRgb(c, pal.white, 0.3))); g.addColorStop(0.3, paint(c)); g.addColorStop(1, paint(mixRgb(c, pal.shadow, 0.35)));
    ctx.fillStyle = g; ctx.fill();
    if (detail > 0.4) {
      ctx.clip();
      // Finger-dragged ridges along the water, and a lit crest.
      ctx.lineWidth = Math.max(0.8, 1.1 * u); ctx.lineCap = 'round';
      for (let row = 1; row <= 3; row++) {
        ctx.strokeStyle = paint(row % 2 ? pal.white : mixRgb(c, pal.shadow, 0.6), row % 2 ? 0.26 : 0.2); ctx.beginPath();
        for (let i = 0; i <= n; i++) { const p = P([pts[i][0], pts[i][1] + row * 7]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
        ctx.stroke();
      }
      ctx.strokeStyle = paint(pal.white, 0.7); ctx.lineWidth = Math.max(1.2, 2 * u); ctx.beginPath();
      for (let i = 0; i <= n; i++) { const p = P([pts[i][0], pts[i][1] + 1.6]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function pad(x: number, y: number, r: number, seed: number) {
    const pts = ovalPoints(x, y, r, r * 0.3, 18).filter((_, i) => i !== 16);
    pts.splice(16, 0, [x + r * 0.35, y - r * 0.02]);
    clay(pts, pal.leaf, seed);
  }
  function flower(x: number, y: number, seed: number, tone: PaletteName) {
    clay(leafPoints({ ax: x, ay: GROUND, tx: x + 2, ty: y, w: 3 }), pal['leaf-deep'], seed);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + seed; clay(ovalPoints(x + 8 * Math.cos(a), y + 8 * Math.sin(a), 6, 6, 10), pal[tone], seed + i + 1); }
    clay(ovalPoints(x, y, 4.6, 4.6, 10), pal.butter, seed + 9);
  }

  function tone(id: ToneId, hero: SceneHero): RGB {
    return id === 'body' ? hero.body : id === 'trim' ? hero.trim : id === 'pale' ? mixRgb(pal.snow, pal.white, 0.5) : id === 'dark' ? pal.ink : id === 'warm' ? pal.orange : mixRgb(pal['sky-pale'], pal.white, 0.4);
  }
  function paintHero(hero: SceneHero) {
    const spec = HEROES[hero.id], boil = (hero.boil ?? 1) * 0.9, press = hero.press && hero.press.amount > 0 ? hero.press : null;
    const place = (pts: readonly Pt[]) => posePoints(hero.id, hero.pose, pts).map(P);
    let outline = heroOutline(hero.id, hero.pulls);
    if (press) outline = pressOutline(outline, press.at, press.amount);
    const body = place(boilOutline(outline, d, 1, boil)), size = u * spec.size;
    const feet = Math.max(...body.map(p => p[1])), minX = Math.min(...body.map(p => p[0])), maxX = Math.max(...body.map(p => p[0]));
    // The shadow lies on the stage floor: wide and firm when the clay sits on it, small and faint when it is carried high.
    const floorY = P([0, GROUND])[1], high = Math.max(0, floorY - feet), near = Math.max(0.25, 1 - high / (150 * u));
    paintShadow(ctx, (minX + maxX) / 2 - LIGHT[0] * (10 + high * 0.12), floorY + 2 * u, ((maxX - minX) / 2) * (0.62 + 0.4 * near), 9 * u * near, pal, 0.36 * near + 0.06);
    const pieces = heroPieces(hero.id, hero.pulls);
    const look = { seed: 500, drawing: d, unit: size, detail, marble: hero.marble ?? undefined };
    const pieceLook = (i: number) => ({ seed: 600 + i * 17, drawing: d, unit: size, detail });
    // The rocket's flame, while it is off the ground.
    if (hero.id === 'rocket' && hero.pulls.back >= 1 && high > 10 * u) {
      const flick = 0.8 + 0.4 * seeded(d, 91);
      paintClay(ctx, place(leafPoints({ ax: -76, ay: 0, tx: -76 - 62 * flick, ty: 6 * (seeded(d, 92) - 0.5), w: 19 })), pal.orange, pal, { seed: 700, drawing: d, unit: size, detail, gloss: 0.6 });
      paintClay(ctx, place(leafPoints({ ax: -76, ay: 0, tx: -76 - 36 * flick, ty: 4 * (seeded(d, 93) - 0.5), w: 10 })), pal.sun, pal, { seed: 701, drawing: d, unit: size, detail, gloss: 0.6 });
    }
    pieces.forEach((p, i) => { if ((p.piece.kind === 'leaf' || p.piece.kind === 'ball') && p.piece.under) paintClay(ctx, place(boilOutline(p.points, d, 20 + i, boil * 0.5)), tone(p.piece.tone, hero), pal, pieceLook(i)); });
    const prints = (hero.prints ?? []).map(pr => { const [x, y] = P(posePoint(hero.id, hero.pose, [pr.x, pr.y])); return { x, y, r: 12 * size, rot: pr.rot + hero.pose.rot }; });
    if (press) { const [x, y] = P(posePoint(hero.id, hero.pose, press.at)); prints.push({ x, y, r: (9 + 5 * press.amount) * size, rot: 0 }); }
    paintClay(ctx, body, hero.body, pal, { ...look, prints });
    // Trim clay pressed into the body: it cannot spill past the body's edge.
    ctx.save(); trace(ctx, body); ctx.clip();
    pieces.forEach((p, i) => { if (p.piece.kind === 'ball' && p.piece.inside) paintClay(ctx, place(boilOutline(p.points, d, 40 + i, boil * 0.4)), tone(p.piece.tone, hero), pal, { ...pieceLook(i), alpha: Math.min(1, p.grow) }); });
    ctx.restore();
    pieces.forEach((p, i) => {
      const piece = p.piece;
      if ((piece.kind === 'leaf' || piece.kind === 'ball') && !piece.under && !(piece.kind === 'ball' && piece.inside)) {
        const pts = place(boilOutline(p.points, d, 60 + i, boil * 0.5));
        paintClay(ctx, pts, tone(piece.tone, hero), pal, pieceLook(i));
        if (piece.kind === 'ball' && piece.spiral && detail > 0.3) {
          const c = P(posePoint(hero.id, hero.pose, [piece.cx, piece.cy])), rr = piece.rx * p.grow * size;
          paintGroove(ctx, () => { ctx.beginPath(); for (let k = 0; k <= 60; k++) { const a = (k / 60) * Math.PI * 4.6 + 0.6, rad = rr * 0.86 * (1 - k / 66), x = c[0] + hero.pose.flip * Math.cos(a) * rad, y = c[1] + Math.sin(a) * rad * 0.94; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); } }, tone(piece.tone, hero), pal, Math.max(1.4, 2.6 * size));
        }
      } else if (piece.kind === 'blush') {
        const c = P(posePoint(hero.id, hero.pose, [piece.x, piece.y])), rr = piece.r * p.grow * size, g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rr);
        g.addColorStop(0, paint(pal.rose, 0.6)); g.addColorStop(1, paint(pal.rose, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, Math.PI * 2); ctx.fill();
      } else if (piece.kind === 'smile') {
        const a = P(posePoint(hero.id, hero.pose, [piece.x - piece.w, piece.y])), b = P(posePoint(hero.id, hero.pose, [piece.x + piece.w, piece.y])), m = P(posePoint(hero.id, hero.pose, [piece.x, piece.y + piece.dip * 2 * Math.min(1, p.grow)]));
        paintGroove(ctx, () => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); }, hero.body, pal, Math.max(1.4, 2.8 * size));
      } else if (piece.kind === 'eye') {
        const c = P(posePoint(hero.id, hero.pose, [piece.x, piece.y])), rr = piece.r * Math.min(1.1, p.grow) * size;
        paintClay(ctx, ovalPoints(c[0], c[1], rr, rr, 14), mixRgb(pal.white, pal.snow, 0.4), pal, { seed: 800 + i, drawing: 0, unit: size, detail: Math.min(detail, 0.5) });
        if (hero.blink) { paintGroove(ctx, () => { ctx.beginPath(); ctx.moveTo(c[0] - rr * 0.7, c[1]); ctx.quadraticCurveTo(c[0], c[1] + rr * 0.5, c[0] + rr * 0.7, c[1]); }, hero.body, pal, Math.max(1.2, 2.4 * size)); }
        else {
          let ex = hero.pose.flip * 0.25, ey = 0.05;
          if (hero.look) { const t = P(hero.look), dx = t[0] - c[0], dy = t[1] - c[1], len = Math.hypot(dx, dy) || 1; ex = dx / len * 0.34; ey = dy / len * 0.34; }
          const pr = (piece.pupil / piece.r) * rr, px = c[0] + ex * rr, py = c[1] + ey * rr;
          ctx.fillStyle = paint(pal.ink); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = paint(pal.white, 0.95); ctx.beginPath(); ctx.arc(px + LIGHT[0] * pr * 0.45, py + LIGHT[1] * pr * 0.45, pr * 0.34, 0, Math.PI * 2); ctx.fill();
        }
      } else if (piece.kind === 'porthole') {
        const c = P(posePoint(hero.id, hero.pose, [piece.x, piece.y])), rr = piece.r * Math.min(1.1, p.grow) * size;
        paintClay(ctx, ovalPoints(c[0], c[1], rr, rr, 16), hero.trim, pal, pieceLook(i));
        const glass = ctx.createRadialGradient(c[0] + LIGHT[0] * rr * 0.3, c[1] + LIGHT[1] * rr * 0.3, 0, c[0], c[1], rr * 0.66);
        glass.addColorStop(0, paint(pal.white)); glass.addColorStop(0.5, paint(pal['sky-pale'])); glass.addColorStop(1, paint(pal.water));
        ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(c[0], c[1], rr * 0.64, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = paint(pal.shadow, 0.35); ctx.lineWidth = Math.max(0.8, size); ctx.stroke();
      }
    });
  }
  function paintBuddy(buddy: SceneBuddy) {
    const pose = buddy.act ? buddyPose(buddy.act, buddy.at, buddy.drawing) : { x: buddy.at[0], y: buddy.at[1], rot: 0, sx: 1, sy: 1 };
    const r = (pose.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), k = 0.92;
    const place = (pts: readonly Pt[]) => pts.map(([x, y]) => P([pose.x + (x * pose.sx * c - y * pose.sy * s) * k, pose.y + (x * pose.sx * s + y * pose.sy * c) * k]));
    const floorY = P([0, GROUND])[1], [bx, by] = P([pose.x, pose.y]), high = Math.max(0, floorY - by);
    paintShadow(ctx, bx - LIGHT[0] * 8, floorY + u, 22 * u * Math.max(0.4, 1 - high / (200 * u)), 5 * u, pal, 0.22);
    const parts = buddyParts(buddy.id, (buddy.drawing % 4) / 4), toneOf = (id: ToneId): RGB => id === 'trim' || id === 'body' ? buddy.tone : id === 'pale' ? mixRgb(pal.snow, pal.white, 0.5) : id === 'dark' ? pal.ink : id === 'warm' ? pal.orange : mixRgb(pal['sky-pale'], pal.white, 0.3);
    for (const under of [true, false]) parts.forEach((part, i) => {
      if (!!part.under !== under) return;
      paintClay(ctx, place(boilOutline(part.points, buddy.drawing, 900 + i, 0.5)), toneOf(part.tone), pal, { seed: 900 + i * 13, drawing: buddy.drawing, unit: u * k, detail: Math.min(detail, 0.9), alpha: part.tone === 'glass' ? 0.78 : 1 });
      if (part.face && !under || part.face && part.under) { const [fx, fy] = place([[part.face.x, part.face.y]])[0]; ctx.fillStyle = paint(part.tone === 'dark' ? pal.white : pal.ink); ctx.beginPath(); ctx.arc(fx, fy, part.face.r * u * k, 0, Math.PI * 2); ctx.fill(); }
    });
    if (buddy.id === 'starlet') { const [ax, ay] = place([[-8, -3]])[0], [bx2, by2] = place([[8, -3]])[0]; ctx.fillStyle = paint(pal.ink); for (const [x, y] of [[ax, ay], [bx2, by2]]) { ctx.beginPath(); ctx.arc(x, y, 2.6 * u * k, 0, Math.PI * 2); ctx.fill(); } }
  }
}
/** The lamp's gel: light of that colour laid over everything already painted (and nothing else). */
export function paintGel(ctx: Ctx, view: View, gelId: GelId, pal: Palette): void {
  const gel = GEL_TONES[gelId];
  if (!gel) return;
  const box = view.frame ?? (view.cloth ? { x: view.ox + (view.cloth.x - 220) * view.unit, y: view.oy + (view.cloth.y - 60) * view.unit, w: (view.cloth.w + 440) * view.unit, h: (view.cloth.h + 160) * view.unit } : null);
  if (!box) return;
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  const cx = box.x + box.w * 0.8, cy = box.y + box.h * 0.1, wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(box.w, box.h));
  wash.addColorStop(0, paint(mixRgb(pal[gel], pal.white, 0.5), 0.34)); wash.addColorStop(0.45, paint(pal[gel], 0.2)); wash.addColorStop(1, paint(mixRgb(pal[gel], pal.shadow, 0.45), 0.3));
  ctx.fillStyle = wash; ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}
/** A rounded hill of clay sitting on the floor line. */
function moundPoints(cx: number, base: number, width: number, height: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push([cx - width / 2 + width * k, base - height * Math.pow(Math.sin(Math.PI * k), 0.8)]); }
  // Its foot is a rounded slab on the stage, never a cut edge.
  const foot = base + 20;
  pts.push([cx + width / 2 + 3, base + 8], [cx + width / 2 - 2, foot - 2], [cx + width / 2 - 14, foot], [cx, foot + 1], [cx - width / 2 + 14, foot], [cx - width / 2 + 2, foot - 2], [cx - width / 2 - 3, base + 8]);
  return pts;
}

/** The view that fits the film into a pixel frame: the set's middle, wide enough for every pose in the film. */
export function filmView(frame: Box, poses: readonly Pose[], detail: number): View {
  let x0 = 20, x1 = SET_W - 20, y0 = 40;
  for (const p of poses) { x0 = Math.min(x0, p.x - 80); x1 = Math.max(x1, p.x + 80); y0 = Math.min(y0, p.y - 70); }
  const y1 = GROUND + 34, unit = Math.min(frame.w / (x1 - x0), frame.h / (y1 - y0));
  return { unit, ox: frame.x + frame.w / 2 - ((x0 + x1) / 2) * unit, oy: frame.y + frame.h - y1 * unit, frame, detail };
}
