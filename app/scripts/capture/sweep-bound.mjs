/**
 * sweep-bound.mjs — B-INF-11: the rendered sweep's bounds, as pure contracts.
 *
 * - The run deadline: a whole sweep finishes inside a bound derived from its own cell count
 *   (or `--deadline <minutes>`); cells it never reached are MISSING, and the law fails them.
 * - The per-cell bound: one cell (load, ready, state, record, shots) never holds the run.
 * - The overlay settle (runs IN the page): a dialog opens through a scale/opacity transition,
 *   so a record taken on its first frame reads every 44 px control at 0.95 × 44 = 42 px.
 *   Measure only once every visible overlay layer is unscaled and holds still.
 *
 * No browser, app or network imports; `settleOverlayGeometry` is serialized into the page.
 */

/** One cell's hard bound: a page that never answers is closed and its cell recorded. */
export const CELL_BOUND_MS = 4 * 60_000;
/** The unrecorded warm-up load (a cold Vite compile is ≈60 s). */
export const WARMUP_BOUND_MS = 3 * 60_000;
/** Deadline arithmetic per cell (not a per-cell limit): a healthy cell takes 2–10 s. */
export const BASE_CELL_BUDGET_MS = 30_000;
export const STATE_CELL_BUDGET_MS = 30_000;
/** How long a record waits for the overlay layers to settle before it measures anyway. */
export const SETTLE_BUDGET_MS = 1_500;

/** The run's wall-clock bound: `--deadline <minutes>` wins; else warm-up + every cell's budget. */
export function sweepDeadlineMs({ baseCells, stateCells = 0, minutes = null }) {
  if (minutes !== null && minutes !== undefined) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0) throw new Error('SWEEP_DEADLINE_INVALID');
    return Math.round(value * 60_000);
  }
  if (!Number.isInteger(baseCells) || baseCells < 0 || !Number.isInteger(stateCells) || stateCells < 0) throw new Error('SWEEP_DEADLINE_INVALID');
  return WARMUP_BOUND_MS + baseCells * BASE_CELL_BUDGET_MS + stateCells * STATE_CELL_BUDGET_MS;
}

/** Resolves `{ timedOut: false, value }`, or `{ timedOut: true }` once `ms` passes (the work is not cancelled). */
export function raceBound(work, ms) {
  let timer;
  const bound = new Promise((resolve) => { timer = setTimeout(() => resolve({ timedOut: true }), ms); });
  const settled = Promise.resolve(work).then((value) => ({ timedOut: false, value }));
  settled.catch(() => {});
  return Promise.race([settled, bound]).finally(() => clearTimeout(timer));
}

/**
 * IN THE PAGE (serialized by page.evaluate; self-contained). Waits, frame by frame, until every
 * visible overlay layer — role=dialog, aria-modal and the Modal's backdrop layer — has no scale
 * on itself or an ancestor and its box and opacity read the same on two consecutive frames.
 * Returns { settled, ms }; never throws, never waits past `budgetMs`.
 */
export async function settleOverlayGeometry(budgetMs) {
  const start = performance.now();
  const frame = () => new Promise((resolve) => {
    const timer = setTimeout(resolve, 50); // a throttled page still advances
    requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
  });
  const visibleLayer = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (typeof el.checkVisibility === 'function') return el.checkVisibility({ checkVisibilityCSS: true });
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const layers = () => [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-arbor-dialog-layer]')].filter(visibleLayer);
  const scaleOf = (transform) => {
    const m = /^matrix(3d)?\(([^)]+)\)$/.exec(transform || '');
    if (!m) return null;
    const v = m[2].split(',').map(Number);
    const [a, b, c, d] = m[1] ? [v[0], v[1], v[4], v[5]] : v;
    return { x: Math.hypot(a, b), y: Math.hypot(c, d) };
  };
  const scaled = (el) => {
    for (let cur = el; cur && cur.nodeType === 1; cur = cur.parentElement) {
      const s = scaleOf(getComputedStyle(cur).transform);
      if (s && (Math.abs(s.x - 1) > 0.001 || Math.abs(s.y - 1) > 0.001)) return true;
    }
    return false;
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let cur = el; cur && cur.nodeType === 1; cur = cur.parentElement) o *= Number(getComputedStyle(cur).opacity || 1);
    return o;
  };
  const snapshot = (els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return `${r.left.toFixed(1)},${r.top.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)},${opacityOf(el).toFixed(2)}`;
  }).join('|');
  let previous = null;
  for (;;) {
    const els = layers();
    const snap = snapshot(els);
    if (snap === previous && !els.some(scaled)) return { settled: true, ms: Math.round(performance.now() - start) };
    if (performance.now() - start >= budgetMs) return { settled: false, ms: Math.round(performance.now() - start) };
    previous = snap;
    await frame();
  }
}
