/* Arbor Living Forms, live. One sculpture, four shapes: the four brand
   ribbons and the coral orb are rebuilt every frame from blended control
   points. The sculpture is glued to a "stage" element on the page, so it
   scrolls with the section it belongs to and stops rendering when no stage
   is on screen. No model files; geometry is generated here.
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
];

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
  const box = [...SCENES[0].box];
  const state = { scene: 0, stage: null, shown: false, sel: -1, lit: new Set(), intro: reduced ? 1 : 0, px: 0, py: 0, tpx: 0, tpy: 0, w: 0, h: 0, visible: true, woke: performance.now(), paused: false, lost: false };

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
    /* nothing to draw unless a stage is on screen */
    const el = state.stage, r = el && el.getBoundingClientRect();
    if (!r || !r.width || r.bottom < -60 || r.top > state.h + 60) {
      if (state.shown) { canvas.style.visibility = 'hidden'; state.shown = false; }
      return;
    }
    const want = packed[state.scene], wantBox = SCENES[state.scene].box;
    const k = reduced || manual ? 1 : 1 - Math.exp(-dt * 3.4);
    if (!state.shown) { canvas.style.visibility = 'visible'; state.shown = true; }
    for (let n = 0; n < cur.length; n++) cur[n] += (want[n] - cur[n]) * k;
    for (let n = 0; n < 4; n++) box[n] += (wantBox[n] - box[n]) * k;
    state.px += (state.tpx - state.px) * k; state.py += (state.tpy - state.py) * k;
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

    /* glue the form to its stage: world units per pixel at the z = 0 plane */
    const d = camera.position.z, H = 2 * d * Math.tan(camera.fov * Math.PI / 360), u = H / state.h;
    const sc = Math.min(r.width * u / box[2], r.height * u / box[3]);
    root.scale.setScalar(sc * (0.72 + 0.28 * grow));
    root.position.set((r.left + r.width / 2 - state.w / 2) * u - box[0] * sc, (state.h / 2 - r.top - r.height / 2) * u - box[1] * sc, 0);
    root.rotation.y = state.px * 0.22 + (reduced ? 0 : Math.sin(time * 0.31) * 0.09) + (1 - grow) * -0.9;
    root.rotation.x = -state.py * 0.12 + (reduced ? 0 : Math.sin(time * 0.23) * 0.03);
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
    setLens(n) { state.sel = n; wake(); },
    setLit(list) { state.lit = new Set(list); wake(); },
    /* the film's pause control also holds the form still */
    setPaused(on) { state.paused = !!on; wake(); },
    /* manual mode: draw the frame for time t, in seconds */
    renderAt(t) { time = t; if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(performance.now()); },
    lensColors: LENS,
  };
}
