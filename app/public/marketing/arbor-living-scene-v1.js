/* Arbor Living Forms, live. One sculpture, eight shapes: the four brand
   ribbons and the coral orb are rebuilt every frame from blended control
   points, so the form the visitor sees is the chapter they are reading.
   No model files; geometry is generated here. */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const N = 7;              // control points per ribbon
const U = 120, V = 18;    // ribbon tessellation
const STRIDE = N * 3 + 5; // points, three twists, width, cup

const arc = (cx, cy, r, a0, a1, z0 = 0, z1 = z0, ry = 1) => Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1), a = (a0 + (a1 - a0) * t) * Math.PI / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * ry, z0 + (z1 - z0) * t];
});
const helix = (r, y0, y1, a0, turns, cx = 0) => Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1), a = a0 + turns * Math.PI * 2 * t, rr = r * (1 - t * 0.35);
  return [cx + Math.cos(a) * rr, y0 + (y1 - y0) * t, Math.sin(a) * rr];
});
const R = (pts, tw, w, cup = 0.22) => ({ pts, tw, w, cup });

/* Ribbon order: sapphire, pearl, mint, periwinkle. */
const TOGETHER = [
  R([[-1.45, -1.2, 0], [-2.2, -0.55, 0.1], [-2.05, 0.4, 0.2], [-1.3, 1.0, 0.2], [-0.4, 1.25, 0.1], [0.4, 1.4, 0], [1.05, 1.6, -0.1]], [0.5, 0.85, 0.4], 0.8, 0.22),
  R([[-1.5, -1.15, 0.2], [-0.9, -0.9, 0.5], [-0.2, -1.0, 0.6], [0.5, -1.12, 0.5], [1.1, -1.05, 0.3], [1.6, -0.9, 0.1], [2.0, -0.75, 0]], [1.15, 1.3, 1.2], 0.62, 0.2),
  R([[-0.95, -0.8, 0.5], [-0.35, -1.02, 0.72], [0.3, -0.9, 0.62], [0.8, -0.45, 0.35], [1.3, -0.3, 0.18], [1.95, -0.05, 0.1], [2.6, 0.45, 0]], [1.0, 0.7, 0.85], 0.52, 0.3),
  R([[0.3, -0.98, 0.05], [0.9, -0.92, 0.05], [1.4, -0.72, 0], [1.9, -0.42, 0], [2.3, -0.12, -0.1], [2.6, 0.14, -0.1], [2.8, 0.3, -0.1]], [1.0, 0.9, 0.8], 0.46, 0.22),
];
const SCENES = [
  { rib: TOGETHER, orb: [-0.3, -0.32, 0.45, 0.42], lens: 0, glow: 1 },
  { // the moment: the form opens, the orb steps forward
    rib: [
      R([[-0.6, -1.7, -0.4], [-1.7, -1.2, -0.2], [-2.3, -0.3, 0], [-2.3, 0.6, 0], [-1.8, 1.4, -0.2], [-0.9, 1.8, -0.4], [0, 1.9, -0.6]], [0.7, 0.9, 0.7], 0.5, 0.3),
      R([[-1.2, -1.6, 0.2], [-0.5, -1.78, 0.4], [0.2, -1.82, 0.4], [0.9, -1.7, 0.3], [1.5, -1.5, 0.1], [2.0, -1.2, 0], [2.3, -0.8, -0.1]], [1.2, 1.3, 1.1], 0.42, 0.18),
      R([[0.6, 1.7, -0.4], [1.6, 1.3, -0.2], [2.2, 0.5, 0], [2.3, -0.3, 0], [1.9, -1.0, 0], [1.3, -1.4, 0.1], [0.6, -1.5, 0.2]], [0.7, 0.9, 0.7], 0.42, 0.28),
      R([[0.2, 2.0, -0.7], [1.2, 1.9, -0.6], [2.1, 1.4, -0.5], [2.7, 0.6, -0.4], [2.8, -0.2, -0.4], [2.5, -0.9, -0.4], [2.0, -1.4, -0.4]], [0.8, 0.9, 0.8], 0.3, 0.2),
    ], orb: [0, 0.05, 0.6, 0.56], lens: 0, glow: 1.5,
  },
  { // perspectives: the ribbons settle into a bowl, the lenses orbit
    rib: [
      R([[-2.6, -0.4, -0.6], [-2.2, -1.0, -0.2], [-1.5, -1.4, 0.2], [-0.7, -1.55, 0.4], [0.1, -1.5, 0.5], [0.8, -1.35, 0.4], [1.4, -1.1, 0.2]], [1.1, 1.25, 1.1], 0.5, 0.22),
      R([[-1.4, -1.5, 0.6], [-0.6, -1.7, 0.8], [0.2, -1.75, 0.8], [1.0, -1.65, 0.7], [1.7, -1.4, 0.5], [2.3, -1.0, 0.2], [2.7, -0.5, -0.1]], [1.2, 1.35, 1.1], 0.42, 0.16),
      R([[2.7, -0.2, -0.7], [2.3, -0.8, -0.4], [1.7, -1.2, -0.1], [1.0, -1.4, 0], [0.3, -1.4, -0.1], [-0.4, -1.3, -0.3], [-1.0, -1.1, -0.5]], [1.0, 1.2, 1.0], 0.4, 0.22),
      R([[-2.2, -0.1, -1.0], [-1.5, -0.7, -0.9], [-0.7, -1.0, -0.8], [0.1, -1.1, -0.8], [0.9, -1.0, -0.8], [1.7, -0.7, -0.9], [2.3, -0.2, -1.0]], [1.0, 1.1, 1.0], 0.3, 0.2),
    ], orb: [0, 0.2, 0.3, 0.5], lens: 1, glow: 1.3,
  },
  { // one step: everything winds into a single rising spiral
    rib: [
      R(helix(1.25, -1.45, -0.35, 4.4, 0.8), [0.9, 1.0, 0.8], 0.38, 0.2),
      R(helix(0.98, -1.2, 0.7, 0, 1.1), [0.5, 0.7, 0.5], 0.38, 0.22),
      R(helix(0.72, -1.0, 1.0, 3.1, 1.05), [0.5, 0.6, 0.5], 0.32, 0.22),
      R(helix(0.5, -1.2, 0.3, 1.6, 0.9), [0.6, 0.7, 0.6], 0.3, 0.2),
    ], orb: [0.38, 1.22, 0.2, 0.4], lens: 0, glow: 0.6,
  },
  { // Kids Studio: two loops, an open-ended figure of play
    rib: [
      R(arc(-1.12, 0, 1.0, 0, 360, 0.25, -0.25), [0.75, 0.95, 0.75], 0.46, 0.26),
      R(arc(0, -0.1, 1.9, 200, 340, 0.5, 0.5, 0.42), [1.25, 1.3, 1.25], 0.3, 0.16),
      R(arc(1.12, 0, 1.0, 180, 540, -0.25, 0.25), [0.75, 0.95, 0.75], 0.46, 0.26),
      R([[-1.9, -0.75, -0.3], [-1.2, -0.95, -0.1], [-0.5, -0.5, 0.1], [0, 0, 0.15], [0.5, 0.5, 0.1], [1.2, 0.95, -0.1], [1.9, 0.75, -0.3]], [0.6, 0.3, 0.6], 0.34, 0.22),
    ], orb: [0, 0, 0.42, 0.36], lens: 0, glow: 0.5,
  },
  { // Growth: a seed held in a crescent, rings gathering behind
    rib: [
      R(arc(0, 0.1, 1.5, 205, 335, 0.55, 0.55, 0.8), [1.2, 1.3, 1.2], 0.42, 0.2),
      R(arc(0, 0, 1.3, 255, 105, 0.1, 0.1), [0.5, 0.8, 0.5], 0.5, 0.3),
      R(arc(0.05, 0, 0.98, -75, 75, 0.2, 0.2), [0.6, 0.8, 0.6], 0.36, 0.26),
      R(arc(0, 0, 0.72, 100, 250, 0.25, 0.25), [0.7, 0.8, 0.7], 0.24, 0.2),
    ], orb: [0, -0.05, 0.4, 0.34], lens: 0, glow: 0.4,
  },
  { rib: TOGETHER, orb: [-0.3, -0.32, 0.45, 0.42], lens: 0, glow: 0.4 },
  { rib: TOGETHER, orb: [-0.3, -0.32, 0.45, 0.42], lens: 0, glow: 1.2 },
];
/* Where the sculpture sits per scene: x, y as viewport fractions, then scale. */
const WIDE = [[0.47, -0.04, 1], [0.47, 0, 0.9], [0.47, 0.02, 0.86], [-0.5, -0.02, 0.98], [0.8, 0.7, 0.3], [0.46, 0, 0.8], [0.9, 0.2, 0.001], [0.5, -0.06, 1]];
const TALL = [[0, 0.5, 0.56], [0, 0.5, 0.52], [0, 0.5, 0.5], [0, 0.52, 0.56], [0.5, 0.8, 0.22], [0, 0.5, 0.46], [0, 0.9, 0.001], [0, 0.56, 0.52]];

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

export function mountLivingForms(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
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
  const PALETTE = [['#2f58d6', '#142f96'], ['#f4eee3', '#e6dfd2'], ['#a5e6cf', '#8f88e6'], ['#a99bee', '#7088e6']];
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
    root.add(m); return m;
  });

  const ringGroup = new THREE.Group(); ringGroup.rotation.set(-0.18, 0.16, 0); root.add(ringGroup);
  const beadGeo = new THREE.SphereGeometry(1, 20, 14);
  const beadCols = ['#3fb7a4', '#8670ce', '#e8765a', '#3a63dc'];
  const rings = Array.from({ length: 5 }, (_, i) => {
    const r = 1.75 + i * 0.36, g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.011, 8, 160), new THREE.MeshBasicMaterial({ color: '#191e5c', transparent: true, opacity: 0 }));
    g.add(mesh);
    const beads = Array.from({ length: i + 2 }, (_, b) => {
      const a = (i * 1.9 + b * (5.1 / (i + 2)) + 0.6), m = new THREE.Mesh(beadGeo, new THREE.MeshStandardMaterial({ color: beadCols[(i + b) % 4], roughness: 0.45 }));
      m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); g.add(m); return m;
    });
    ringGroup.add(g); return { g, mesh, beads };
  });
  const kept = new THREE.Mesh(beadGeo, new THREE.MeshStandardMaterial({ color: '#f47b5c', roughness: 0.4, emissive: '#e2553a', emissiveIntensity: 0.3 }));
  ringGroup.add(kept);

  const packed = SCENES.map(pack);
  const cur = new Float32Array(packed[0]), tgt = new Float32Array(packed[0]);
  const lay = [0, 0, 1], layT = [0, 0, 1];
  const state = { p: 0, growth: 0, hover: -1, kept: 0, keptT: 0, rings: 0, intro: reduced ? 1 : 0, px: 0, py: 0, tpx: 0, tpy: 0, tall: false, w: 0, h: 0, visible: true };

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
    state.w = w; state.h = h; state.tall = w / h < 0.9;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.tall ? 2 : 1.6));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };

  let last = performance.now(), time = 0, raf = 0, dirty = true;
  const frame = now => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduced) time += dt;
    resize();
    const p = Math.min(SCENES.length - 1, Math.max(0, state.p)), i = Math.min(SCENES.length - 2, Math.floor(p)), f = smooth(clamp01((p - i - 0.22) / 0.56));
    const A = packed[i], Bk = packed[i + 1];
    for (let n = 0; n < tgt.length; n++) tgt[n] = A[n] + (Bk[n] - A[n]) * f;
    const table = state.tall ? TALL : WIDE;
    for (let n = 0; n < 3; n++) layT[n] = table[i][n] + (table[i + 1][n] - table[i][n]) * f;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4.2);
    for (let n = 0; n < cur.length; n++) cur[n] += (tgt[n] - cur[n]) * k;
    for (let n = 0; n < 3; n++) lay[n] += (layT[n] - lay[n]) * k;
    state.px += (state.tpx - state.px) * k; state.py += (state.tpy - state.py) * k;
    if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / 2.4);
    const grow = 1 - Math.pow(1 - state.intro, 4);

    for (let r = 0; r < 4; r++) buildRibbon(r, time, grow);
    const o = STRIDE * 4, bob = reduced ? 0 : Math.sin(time * 0.9) * 0.035;
    orb.position.set(cur[o], cur[o + 1] + bob, cur[o + 2]); orb.scale.setScalar(cur[o + 3] * (0.4 + 0.6 * grow));
    orbLight.position.copy(orb.position); orbLight.intensity = cur[o + 5] * 1.4 * grow;
    orb.material.emissiveIntensity = 0.12 + cur[o + 5] * 0.22;

    const lensAmt = cur[o + 4];
    lenses.forEach((m, n) => {
      const a = time * (0.22 + n * 0.013) + n * Math.PI * 2 / 7, rad = (1.5 + (n % 3) * 0.22) * smooth(clamp01(lensAmt));
      m.position.set(orb.position.x + Math.cos(a) * rad, orb.position.y + Math.sin(a) * rad * 0.42 + Math.sin(a * 2 + n) * 0.16 * lensAmt, orb.position.z + Math.sin(a) * rad * 0.8);
      const want = clamp01(lensAmt * 1.4) * (state.hover === n ? 0.24 : 0.135);
      m.scale.x += (want - m.scale.x) * (reduced ? 1 : 0.14); m.scale.y = m.scale.x * 0.86; m.scale.z = m.scale.x;
      m.visible = m.scale.x > 0.004;
    });

    const near = clamp01(1 - Math.abs(p - 5) * 1.6), want = near * (1 + state.growth * 4);
    state.rings += (want - state.rings) * k;
    ringGroup.position.set(orb.position.x, orb.position.y, orb.position.z - 0.9);
    rings.forEach((ring, n) => {
      const v = smooth(clamp01(state.rings - n));
      ring.mesh.material.opacity = v * 0.34; ring.g.scale.setScalar(0.9 + 0.1 * v); ring.g.rotation.z = time * 0.02 * (n % 2 ? -1 : 1);
      ring.beads.forEach(b => b.scale.setScalar(v * 0.06)); ring.g.visible = v > 0.002;
    });
    state.kept += (state.keptT * near - state.kept) * (reduced ? 1 : 0.07);
    const ka = 2.3 - state.kept * 1.2, kr = 1.75 * state.kept;
    kept.position.set(Math.cos(ka) * kr, Math.sin(ka) * kr, 0.9 * (1 - state.kept)); kept.scale.setScalar(0.1 * clamp01(state.kept * 3)); kept.visible = state.kept > 0.01;

    const d = camera.position.z, H = 2 * d * Math.tan(camera.fov * Math.PI / 360), Wd = H * camera.aspect;
    const fit = state.tall ? Math.min(1, Wd / 5.6) / 0.56 : Math.min(1.15, Wd / 10.6);
    root.position.set(lay[0] * Wd / 2, lay[1] * H / 2, 0);
    root.scale.setScalar(lay[2] * fit * (0.72 + 0.28 * grow));
    root.rotation.y = state.px * 0.22 + (reduced ? 0 : Math.sin(time * 0.31) * 0.09) + (1 - grow) * -0.9;
    root.rotation.x = -state.py * 0.12 + (reduced ? 0 : Math.sin(time * 0.23) * 0.03);
    renderer.render(scene, camera);
    dirty = false;
    if (!reduced && state.visible) raf = requestAnimationFrame(frame);
  };
  const kick = () => { dirty = true; if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  addEventListener('resize', kick);
  addEventListener('pointermove', e => { state.tpx = e.clientX / innerWidth * 2 - 1; state.tpy = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  document.addEventListener('visibilitychange', () => { state.visible = !document.hidden; if (state.visible) kick(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); document.documentElement.classList.add('no-webgl'); });
  kick();

  return {
    setProgress(p, growth) { state.p = p; state.growth = growth; if (reduced) kick(); },
    setLens(n) { state.hover = n; if (reduced) kick(); },
    setKept(on) { state.keptT = on ? 1 : 0; if (reduced) kick(); },
    lensColors: LENS,
  };
}
