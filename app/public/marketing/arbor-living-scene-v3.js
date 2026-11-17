/* Arbor Living Forms, live. One sculpture, eight shapes: the four brand
   ribbons and the coral orb are rebuilt every frame from blended control
   points. No model files; geometry is generated here.
   Two ways to place it. setStage glues it to one "stage" element (reduced
   motion and the film recorder use this). setPath gives it a journey: the
   places on the page where it docks, in order, and the stretches where it
   rests at the page edge; scrolling scrubs it from one to the next, so it
   travels and reshapes with the reader and plays backwards on the way up.
   Version 3 sits on the light canvas: the pearl ribbon is a shade deeper so
   it reads against paper, and `manual` lets a recorder draw one frame for a
   given time (renderAt). */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const N = 7;              // control points per ribbon
const U = 120, V = 18;    // ribbon tessellation
const STRIDE = N * 3 + 5; // points, three twists, width, cup

const arc = (cx, cy, r, a0, a1, z0 = 0, z1 = z0, ry = 1) => Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1), a = (a0 + (a1 - a0) * t) * Math.PI / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * ry, z0 + (z1 - z0) * t];
});
const R = (pts, tw, w, cup = 0.22) => ({ pts, tw, w, cup });
/* one lane across the form: a wave in y, a wave in depth, so lanes pass over and under each other */
const lane = (y0, amp, ph, z0, zAmp) => Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1), a = t * Math.PI * 2 + ph;
  return [-2.6 + 5.2 * t, y0 + amp * Math.sin(a), z0 + zAmp * Math.cos(a)];
});
/* one strand of the resting column, turning around the vertical axis */
const strand = (ph, r, z0) => Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1), a = t * Math.PI * 1.6 + ph;
  return [Math.sin(a) * r, -2.5 + 5 * t, z0 + Math.cos(a) * r];
});
const helix = (r, y0, y1, a0, turns, cx = 0) => Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1), a = a0 + turns * Math.PI * 2 * t, rr = r * (1 - t * 0.35);
  return [cx + Math.cos(a) * rr, y0 + (y1 - y0) * t, Math.sin(a) * rr];
});

/* Ribbon order: sapphire, pearl, mint, periwinkle. */
/* The hero form stands behind the phone: a tall halo whose ribbons show at its sides. */
const HALO = [
  R([[-0.7, -2.7, 0], [-1.9, -2.0, 0.1], [-2.35, -0.6, 0.2], [-2.2, 0.9, 0.2], [-1.5, 2.1, 0.1], [-0.4, 2.65, 0], [0.8, 2.6, -0.1]], [0.5, 0.9, 0.45], 0.78, 0.22),
  R([[-1.9, -2.2, 0.2], [-1.0, -2.6, 0.4], [0, -2.75, 0.5], [0.9, -2.65, 0.4], [1.7, -2.35, 0.2], [2.25, -1.85, 0.1], [2.5, -1.25, 0]], [1.15, 1.3, 1.2], 0.56, 0.2),
  R([[0.8, -2.45, 0.3], [1.7, -1.95, 0.4], [2.2, -1.05, 0.3], [2.38, -0.05, 0.2], [2.25, 0.9, 0.1], [1.95, 1.65, 0], [1.5, 2.15, -0.1]], [1.0, 0.75, 0.85], 0.5, 0.3),
  R([[1.6, -2.05, -0.2], [2.35, -1.3, -0.2], [2.72, -0.4, -0.2], [2.76, 0.5, -0.2], [2.5, 1.35, -0.2], [2.1, 1.95, -0.2], [1.55, 2.35, -0.2]], [1.0, 0.9, 0.8], 0.36, 0.22),
];
/* centre and span say where the form sits inside its stage, in scene units. */
const SCENES = [
  { rib: HALO, orb: [-2.05, 2.25, 0.4, 0.4], lens: 0, glow: 1, box: [0.1, 0, 5.4, 5.7] },
  { // approaches: the ribbons settle into a bowl, seven pebbles orbit the orb
    rib: [
      R([[-2.6, -0.4, -0.6], [-2.2, -1.0, -0.2], [-1.5, -1.4, 0.2], [-0.7, -1.55, 0.4], [0.1, -1.5, 0.5], [0.8, -1.35, 0.4], [1.4, -1.1, 0.2]], [1.1, 1.25, 1.1], 0.5, 0.22),
      R([[-1.4, -1.5, 0.6], [-0.6, -1.7, 0.8], [0.2, -1.75, 0.8], [1.0, -1.65, 0.7], [1.7, -1.4, 0.5], [2.3, -1.0, 0.2], [2.7, -0.5, -0.1]], [1.2, 1.35, 1.1], 0.42, 0.16),
      R([[2.7, -0.2, -0.7], [2.3, -0.8, -0.4], [1.7, -1.2, -0.1], [1.0, -1.4, 0], [0.3, -1.4, -0.1], [-0.4, -1.3, -0.3], [-1.0, -1.1, -0.5]], [1.0, 1.2, 1.0], 0.4, 0.22),
      R([[-2.2, -0.1, -1.0], [-1.5, -0.7, -0.9], [-0.7, -1.0, -0.8], [0.1, -1.1, -0.8], [0.9, -1.0, -0.8], [1.7, -0.7, -0.9], [2.3, -0.2, -1.0]], [1.0, 1.1, 1.0], 0.3, 0.2),
    ], orb: [0, 0.2, 0.3, 0.5], lens: 1, glow: 1.3, box: [0, -0.35, 5.9, 3.5],
  },
  { // Kids Studio: two loops, an open-ended figure of play
    rib: [
      R(arc(-1.12, 0, 1.0, 0, 360, 0.25, -0.25), [0.75, 0.95, 0.75], 0.46, 0.26),
      R(arc(0, -0.1, 1.9, 200, 340, 0.5, 0.5, 0.42), [1.25, 1.3, 1.25], 0.3, 0.16),
      R(arc(1.12, 0, 1.0, 180, 540, -0.25, 0.25), [0.75, 0.95, 0.75], 0.46, 0.26),
      R([[-1.9, -0.75, -0.3], [-1.2, -0.95, -0.1], [-0.5, -0.5, 0.1], [0, 0, 0.15], [0.5, 0.5, 0.1], [1.2, 0.95, -0.1], [1.9, 0.75, -0.3]], [0.6, 0.3, 0.6], 0.34, 0.22),
    ], orb: [0, 0, 0.42, 0.36], lens: 0, glow: 0.7, box: [0, 0, 4.9, 2.7],
  },
  { // the close: the form opens and the orb steps forward
    rib: [
      R([[-0.6, -1.7, -0.4], [-1.7, -1.2, -0.2], [-2.3, -0.3, 0], [-2.3, 0.6, 0], [-1.8, 1.4, -0.2], [-0.9, 1.8, -0.4], [0, 1.9, -0.6]], [0.7, 0.9, 0.7], 0.5, 0.3),
      R([[-1.2, -1.6, 0.2], [-0.5, -1.78, 0.4], [0.2, -1.82, 0.4], [0.9, -1.7, 0.3], [1.5, -1.5, 0.1], [2.0, -1.2, 0], [2.3, -0.8, -0.1]], [1.2, 1.3, 1.1], 0.42, 0.18),
      R([[0.6, 1.7, -0.4], [1.6, 1.3, -0.2], [2.2, 0.5, 0], [2.3, -0.3, 0], [1.9, -1.0, 0], [1.3, -1.4, 0.1], [0.6, -1.5, 0.2]], [0.7, 0.9, 0.7], 0.42, 0.28),
      R([[0.2, 2.0, -0.7], [1.2, 1.9, -0.6], [2.1, 1.4, -0.5], [2.7, 0.6, -0.4], [2.8, -0.2, -0.4], [2.5, -0.9, -0.4], [2.0, -1.4, -0.4]], [0.8, 0.9, 0.8], 0.3, 0.2),
    ], orb: [0, 0.05, 0.6, 0.56], lens: 0, glow: 1.5, box: [0.2, 0.1, 5.6, 4.3],
  },
  { // 4 · beside "six parts": the ribbons gathered in one loose knot
    rib: [
      R([[-1.45, -1.2, 0], [-2.2, -0.55, 0.1], [-2.05, 0.4, 0.2], [-1.3, 1.0, 0.2], [-0.4, 1.25, 0.1], [0.4, 1.4, 0], [1.05, 1.6, -0.1]], [0.5, 0.85, 0.4], 0.62, 0.22),
      R([[-1.5, -1.15, 0.2], [-0.9, -0.9, 0.5], [-0.2, -1.0, 0.6], [0.5, -1.12, 0.5], [1.1, -1.05, 0.3], [1.6, -0.9, 0.1], [2.0, -0.75, 0]], [1.15, 1.3, 1.2], 0.5, 0.2),
      R([[-0.95, -0.8, 0.5], [-0.35, -1.02, 0.72], [0.3, -0.9, 0.62], [0.8, -0.45, 0.35], [1.3, -0.3, 0.18], [1.95, -0.05, 0.1], [2.6, 0.45, 0]], [1.0, 0.7, 0.85], 0.44, 0.3),
      R([[0.3, -0.98, 0.05], [0.9, -0.92, 0.05], [1.4, -0.72, 0], [1.9, -0.42, 0], [2.3, -0.12, -0.1], [2.6, 0.14, -0.1], [2.8, 0.3, -0.1]], [1.0, 0.9, 0.8], 0.38, 0.22),
    ], orb: [-0.3, -0.3, 0.42, 0.38], lens: 0, glow: 0.9, box: [0.3, 0.2, 5.8, 3.6],
  },
  { // 5 · the family plan: lanes that weave past each other, a week shared out
    rib: [
      R(lane(0.62, 0.36, 0.0, 0.0, 0.42), [0.25, 1.35, 0.25], 0.36, 0.18),
      R(lane(0.0, 0.36, 2.1, 0.0, 0.42), [1.35, 0.35, 1.35], 0.32, 0.18),
      R(lane(-0.62, 0.36, 4.2, 0.0, 0.42), [0.35, 1.2, 0.35], 0.32, 0.22),
      R(lane(0.05, 0.95, 1.0, -0.55, 0.18), [1.0, 1.05, 1.0], 0.18, 0.2),
    ], orb: [0.95, 0.12, 0.28, 0.3], lens: 0, glow: 0.8, box: [0, 0, 6.0, 2.9],
  },
  { // 6 · at rest by the page edge: a slender column of strands
    rib: [
      R(strand(0.0, 0.55, 0.0), [0.4, 1.2, 0.4], 0.42, 0.2),
      R(strand(2.1, 0.5, 0.0), [1.2, 0.4, 1.2], 0.36, 0.2),
      R(strand(4.2, 0.45, 0.0), [0.6, 1.0, 0.6], 0.32, 0.24),
      R(strand(1.0, 0.78, -0.3), [1.0, 1.0, 1.0], 0.18, 0.2),
    ], orb: [0.08, 1.95, 0.2, 0.26], lens: 0, glow: 0.6, box: [0, 0, 2.3, 5.6],
  },
  { // 7 · beside privacy: the ribbons wind up around the orb, keeping it
    rib: [
      R(helix(1.25, -1.45, -0.35, 4.4, 0.8), [0.9, 1.0, 0.8], 0.38, 0.2),
      R(helix(0.98, -1.2, 0.7, 0, 1.1), [0.5, 0.7, 0.5], 0.38, 0.22),
      R(helix(0.72, -1.0, 1.0, 3.1, 1.05), [0.5, 0.6, 0.5], 0.32, 0.22),
      R(helix(0.5, -1.2, 0.3, 1.6, 0.9), [0.6, 0.7, 0.6], 0.3, 0.2),
    ], orb: [0.1, 0.05, 0.1, 0.42], lens: 0, glow: 1.0, box: [0, -0.15, 3.4, 3.4],
  },
];
const REST = 6;

const pack = scene => {
  const out = new Float32Array(STRIDE * 4 + 6);
  scene.rib.forEach((r, k) => {
    const o = k * STRIDE;
    r.pts.forEach((p, i) => out.set(p, o + i * 3));
    out.set([...r.tw, r.w, r.cup], o + N * 3);
  });
  out.set([...scene.orb, scene.lens, scene.glow], STRIDE * 4);
  return out;
};
const smooth = t => t * t * (3 - 2 * t);
const clamp01 = v => Math.min(1, Math.max(0, v));

export function mountLivingForms(canvas, { reduced = false, manual = false } = {}) {
  let renderer;
  try {
    /* Ask for a context on a throwaway canvas first, so a browser without WebGL takes the still artwork quietly. */
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
  } catch { return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  camera.position.set(0, 0, 13);
  const key = new THREE.DirectionalLight(0xfff4e6, 1.15); key.position.set(-3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9db4ff, 0.5); rim.position.set(5, 1, -4); scene.add(rim);

  const root = new THREE.Group(); scene.add(root);
  const PALETTE = [['#2f58d6', '#142f96'], ['#f3e9d8', '#dccbb0'], ['#a5e6cf', '#8f88e6'], ['#a99bee', '#7088e6']];
  const ribbons = PALETTE.map(([a, b]) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((U + 1) * V * 3), col = new Float32Array((U + 1) * V * 3), idx = [];
    const ca = new THREE.Color(a), cb = new THREE.Color(b), c = new THREE.Color();
    for (let i = 0; i <= U; i++) for (let j = 0; j < V; j++) {
      c.copy(ca).lerp(cb, smooth(i / U)); col.set([c.r, c.g, c.b], (i * V + j) * 3);
      if (i < U) { const p = i * V + j, q = i * V + (j + 1) % V; idx.push(p, q, p + V, q, q + V, p + V); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.55, sheen: 0.2, sheenRoughness: 0.6, sheenColor: 0xffffff, envMapIntensity: 0.5 });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; root.add(mesh);
    return g;
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({ color: '#f47b5c', roughness: 0.45, envMapIntensity: 0.5, emissive: '#e2553a', emissiveIntensity: 0.25 }));
  root.add(orb);
  const orbLight = new THREE.PointLight('#ff8a63', 0, 6, 2); root.add(orbLight);

  const LENS = ['#e8a18a', '#8670ce', '#3fb7a4', '#f3c969', '#5d8df0', '#e58fb7', '#9ad7c4'];
  const lensGeo = new THREE.SphereGeometry(1, 28, 18);
  const lenses = LENS.map(color => {
    const m = new THREE.Mesh(lensGeo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6, emissive: color, emissiveIntensity: 0.12 }));
    m.scale.setScalar(0); m.visible = false; /* pebbles start hidden, or they flash at full size on the first frames */
    root.add(m); return m;
  });

  const packed = SCENES.map(pack);
  const cur = new Float32Array(packed[0]);
  const mix = new Float32Array(packed[0].length);
  const box = [...SCENES[0].box];
  const state = { scene: 0, stage: null, path: null, shown: false, sel: -1, lit: new Set(), intro: reduced ? 1 : 0, px: 0, py: 0, tpx: 0, tpy: 0, w: 0, h: 0, visible: true, woke: performance.now(), paused: false, lost: false, alpha: 1, sy: scrollY, lean: 0 };

  /* The journey. Each docking place is an element the form fits inside; each resting stretch is a
     section where it waits small at the page edge (wide screens) or out of sight (narrow ones).
     A reading line across the window (the middle, lowered near the end so the last place can be
     reached) says which two points the reader is between and how far; the form blends their
     shape, place and size by that fraction, holding still at each end for a moment so it settles. */
  const journey = (vw, vh, u) => {
    const rtl = document.documentElement.dir === 'rtl';
    const fit = (r, bx) => { const s = Math.min(r.width * u / bx[2], r.height * u / bx[3]); return { x: (r.left + r.width / 2 - vw / 2) * u - bx[0] * s, y: (vh / 2 - r.top - r.height / 2) * u - bx[1] * s, s, al: 1 }; };
    const rest = bx => {
      const hp = Math.min(340, Math.max(220, vh * 0.38)), s = hp * u / bx[3], wp = bx[2] / bx[3] * hp;
      const margin = (vw - Math.min(1180, vw - 80)) / 2, show = Math.min(wp * 0.62, Math.max(48, margin + 6));
      const xp = rtl ? show - wp / 2 : vw - show + wp / 2;
      return { x: (xp - vw / 2) * u - bx[0] * s, y: -bx[1] * s, s, al: vw > 1020 ? (margin >= 96 ? 0.8 : 0.5) : 0 };
    };
    const pts = [];
    for (const it of state.path) {
      const r = it.el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (it.rest) {
        const a = r.top + vh * 0.3, b = r.bottom - vh * 0.3;
        if (b - a > 40) pts.push({ c: a, n: REST }, { c: b, n: REST }); else pts.push({ c: (r.top + r.bottom) / 2, n: REST });
      } else pts.push({ c: r.top + r.height / 2, n: it.n, r });
    }
    if (!pts.length) return null;
    const left = document.documentElement.scrollHeight - (scrollY + vh);
    const line = vh * (0.5 + 0.28 * clamp01(1 - left / (vh * 0.7)));
    let i = 0, f = 0;
    if (line > pts[0].c) {
      if (line >= pts[pts.length - 1].c) i = pts.length - 1;
      else { while (line >= pts[i + 1].c) i++; f = (line - pts[i].c) / Math.max(1, pts[i + 1].c - pts[i].c); }
    }
    const A = pts[i], B = pts[Math.min(pts.length - 1, i + 1)];
    const g = smooth(clamp01((f - 0.12) / 0.76));
    const pa = A.r ? fit(A.r, SCENES[A.n].box) : rest(SCENES[A.n].box);
    const pb = B.r ? fit(B.r, SCENES[B.n].box) : rest(SCENES[B.n].box);
    const m = (p, q) => p + (q - p) * g;
    return { a: A.n, b: B.n, g, x: m(pa.x, pb.x), y: m(pa.y, pb.y), s: m(pa.s, pb.s), al: m(pa.al, pb.al), turn: A.n === B.n ? 0 : Math.sin(Math.PI * g) * 0.42 * (i % 2 ? -1 : 1) };
  };

  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3(), Nn = new THREE.Vector3(), W = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
  const curveAt = (o, u, out) => {
    const s = clamp01(u) * (N - 1), i = Math.min(N - 2, Math.floor(s)), t = s - i;
    const a = o + Math.max(0, i - 1) * 3, b = o + i * 3, c = o + (i + 1) * 3, d = o + Math.min(N - 1, i + 2) * 3;
    for (let k = 0; k < 3; k++) {
      const p0 = cur[a + k], p1 = cur[b + k], p2 = cur[c + k], p3 = cur[d + k];
      out.setComponent(k, 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t));
    }
    return out;
  };
  const buildRibbon = (k, time, grow) => {
    const o = k * STRIDE, m = o + N * 3, pos = ribbons[k].attributes.position.array;
    const t0 = cur[m], t1 = cur[m + 1], t2 = cur[m + 2], width = cur[m + 3], cup = cur[m + 4];
    for (let i = 0; i <= U; i++) {
      const u = i / U, ug = u * grow;
      curveAt(o, ug, P); curveAt(o, ug + 0.004, Q); T.subVectors(Q, P);
      if (T.lengthSq() < 1e-10) T.set(1, 0, 0); T.normalize();
      B.crossVectors(T, Z); if (B.lengthSq() < 1e-4) B.crossVectors(T, Y); B.normalize();
      Nn.crossVectors(T, B);
      const tw = (u < 0.5 ? t0 + (t1 - t0) * u * 2 : t1 + (t2 - t1) * (u - 0.5) * 2) + (reduced ? 0 : Math.sin(time * 0.55 + k * 1.7 + u * 3) * 0.07);
      const cs = Math.cos(tw), sn = Math.sin(tw);
      W.copy(B).multiplyScalar(cs).addScaledVector(Nn, sn);       // wide axis
      Q.copy(Nn).multiplyScalar(cs).addScaledVector(B, -sn);      // thin axis
      const w = width * Math.pow(Math.sin(Math.PI * u), 0.75) * (0.35 + 0.65 * grow), th = 0.016 + w * 0.045;
      for (let j = 0; j < V; j++) {
        const a = j / V * Math.PI * 2, s = Math.cos(a), e = Math.sin(a) * th + cup * w * (s * s - 0.5), n = (i * V + j) * 3;
        pos[n] = P.x + W.x * w * s + Q.x * e; pos[n + 1] = P.y + W.y * w * s + Q.y * e; pos[n + 2] = P.z + W.z * w * s + Q.z * e;
      }
    }
    ribbons[k].attributes.position.needsUpdate = true;
    ribbons[k].computeVertexNormals();
  };

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === state.w && h === state.h)) return;
    state.w = w; state.h = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 1.6));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };

  let last = performance.now(), time = 0, raf = 0;
  const frame = now => {
    raf = 0;
    if (state.lost) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    /* the form moves for a while after the visitor does something, then slows to rest:
       no motion on the page runs on by itself, and a resting page costs no frames */
    const idle = (now - state.woke) / 1000;
    const live = state.paused ? 0 : idle < 9 ? 1 : Math.max(0, 1 - (idle - 9) / 5);
    if (!reduced && !manual) time += dt * live;
    resize();
    const vw = state.w, vh = state.h;
    /* world units per pixel at the z = 0 plane */
    const u = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360) / vh;
    const hide = () => { if (state.shown) { canvas.style.visibility = 'hidden'; state.shown = false; } };
    let want, X, Yw, S, alpha = 1, turn = 0;
    if (state.path) {
      /* the journey: where the scroll is between two docking places, and the form between them */
      const j = journey(vw, vh, u);
      alpha = j ? j.al : 0;
      if (!j || alpha < 0.02) { hide(); return; }
      const A = packed[j.a], Bk = packed[j.b];
      for (let n = 0; n < mix.length; n++) mix[n] = A[n] + (Bk[n] - A[n]) * j.g;
      want = mix; X = j.x; Yw = j.y; S = j.s; turn = j.turn;
    } else {
      /* glued to one stage: nothing to draw unless it is on screen */
      const el = state.stage, r = el && el.getBoundingClientRect();
      if (!r || !r.width || r.bottom < -60 || r.top > vh + 60) { hide(); return; }
      want = packed[state.scene];
      const wantBox = SCENES[state.scene].box, kb = reduced || manual ? 1 : 1 - Math.exp(-dt * 3.4);
      for (let n = 0; n < 4; n++) box[n] += (wantBox[n] - box[n]) * kb;
      S = Math.min(r.width * u / box[2], r.height * u / box[3]);
      X = (r.left + r.width / 2 - vw / 2) * u - box[0] * S;
      Yw = (vh / 2 - r.top - r.height / 2) * u - box[1] * S;
    }
    if (!state.shown) { canvas.style.visibility = 'visible'; state.shown = true; }
    if (Math.abs(alpha - state.alpha) > 0.005) { state.alpha = alpha; canvas.style.opacity = alpha > 0.995 ? '' : alpha.toFixed(3); }
    /* the shape follows the scroll with a short ease, so a morph feels poured, not stepped */
    const k = reduced || manual ? 1 : 1 - Math.exp(-dt * (state.path ? 6.5 : 3.4));
    for (let n = 0; n < cur.length; n++) cur[n] += (want[n] - cur[n]) * k;
    const kp = reduced || manual ? 1 : 1 - Math.exp(-dt * 3.4);
    state.px += (state.tpx - state.px) * kp; state.py += (state.tpy - state.py) * kp;
    /* a slight lean with the scroll speed, gone as soon as the page stops */
    const sy = scrollY, vel = dt > 0 ? (sy - state.sy) / dt : 0; state.sy = sy;
    const lean = reduced || manual || !state.path ? 0 : Math.max(-1, Math.min(1, vel / 2600)) * 0.08;
    state.lean += (lean - state.lean) * Math.min(1, dt * 5);
    if (manual) state.intro = Math.min(1, 0.55 + time / 2.4); else if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / 2.4);
    const grow = 1 - Math.pow(1 - state.intro, 4);

    for (let rb = 0; rb < 4; rb++) buildRibbon(rb, time, grow);
    const o = STRIDE * 4, bob = reduced ? 0 : Math.sin(time * 0.9) * 0.035;
    orb.position.set(cur[o], cur[o + 1] + bob, cur[o + 2]); orb.scale.setScalar(cur[o + 3] * (0.4 + 0.6 * grow));
    orbLight.position.copy(orb.position); orbLight.intensity = cur[o + 5] * 1.4 * grow;
    orb.material.emissiveIntensity = 0.12 + cur[o + 5] * 0.22;

    const lensAmt = cur[o + 4];
    lenses.forEach((m, n) => {
      const a = time * (0.22 + n * 0.013) + n * Math.PI * 2 / 7, rad = (1.5 + (n % 3) * 0.22) * smooth(clamp01(lensAmt));
      m.position.set(orb.position.x + Math.cos(a) * rad, orb.position.y + Math.sin(a) * rad * 0.42 + Math.sin(a * 2 + n) * 0.16 * lensAmt, orb.position.z + Math.sin(a) * rad * 0.8);
      const size = clamp01(lensAmt * 1.4) * (state.sel === n ? 0.27 : state.lit.has(n) ? 0.165 : 0.105);
      m.scale.x += (size - m.scale.x) * (reduced ? 1 : 0.14); m.scale.y = m.scale.x * 0.86; m.scale.z = m.scale.x;
      m.material.emissiveIntensity = state.sel === n ? 0.55 : state.lit.has(n) ? 0.24 : 0.08;
      m.visible = m.scale.x > 0.004;
    });

    root.scale.setScalar(S * (0.72 + 0.28 * grow));
    root.position.set(X, Yw, 0);
    /* between two places the form turns a little, so its depth shows; docked, it faces the reader */
    root.rotation.y = state.px * 0.22 + (reduced ? 0 : Math.sin(time * 0.31) * 0.09) + turn + (1 - grow) * -0.9;
    root.rotation.x = -state.py * 0.12 + (reduced ? 0 : Math.sin(time * 0.23) * 0.03) + state.lean;
    root.rotation.z = state.lean * -0.5;
    renderer.render(scene, camera);
    if (!reduced && !manual && state.visible && (live > 0 || idle < 16)) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && !state.lost) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const wake = () => { state.woke = performance.now(); kick(); };

  addEventListener('resize', kick);
  /* the canvas is fixed and the form is glued to a stage in the page, so every scroll needs a frame (also under reduced motion) */
  addEventListener('scroll', wake, { passive: true });
  addEventListener('pointermove', e => { state.tpx = e.clientX / innerWidth * 2 - 1; state.tpy = e.clientY / innerHeight * 2 - 1; wake(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { state.visible = !document.hidden; if (state.visible) kick(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); state.lost = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } document.documentElement.classList.remove('webgl'); document.documentElement.classList.add('no-webgl'); });
  kick();

  return {
    /* el: the element the form should sit in (null hides it); n: which shape */
    setStage(el, n = 0) { state.stage = el; state.scene = Math.min(SCENES.length - 1, Math.max(0, n)); wake(); },
    /* list: [{ el, n }] to dock inside el with shape n, or [{ el, rest: true }] to rest by the edge
       while el is read; in page order. An empty list goes back to the stage. */
    setPath(list) { state.path = list && list.length ? list : null; wake(); },
    setLens(n) { state.sel = n; wake(); },
    setLit(list) { state.lit = new Set(list); wake(); },
    /* the film's pause control also holds the form still */
    setPaused(on) { state.paused = !!on; wake(); },
    /* manual mode: draw the frame for time t, in seconds */
    renderAt(t) { time = t; if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(performance.now()); },
    lensColors: LENS,
  };
}
