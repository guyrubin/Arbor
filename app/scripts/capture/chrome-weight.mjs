/**
 * chrome-weight.mjs — B-INF-09: the chrome's own weight, per rendered cell, and its caps.
 *
 * The rendered sweep (scripts/rendered-sweep.mjs) writes a `chromeWeight` block on every cell,
 * measured over the [data-chrome] regions (phone dock and strip, sidebar, top bar). The caps
 * (P4 B-INF-09 What): ≤ 8 tappable, 0 upper case, 0 gradients, 0 text under 12 px, 0 controls
 * under 44 px. This module is the one home of those caps; the sweep's totals and the ratchet
 * (scripts/weightLimits.test.ts) both read it. Pure: no browser, no filesystem.
 */
export const CHROME_METRICS = Object.freeze(["tappable", "textSizes", "under12", "uppercase", "gradients", "sub44"]);

export const CHROME_CAPS = Object.freeze([
  Object.freeze({ metric: "tappable", max: 8 }),
  Object.freeze({ metric: "uppercase", max: 0 }),
  Object.freeze({ metric: "gradients", max: 0 }),
  Object.freeze({ metric: "under12", max: 0 }),
  Object.freeze({ metric: "sub44", max: 0 }),
]);

/** A chromeWeight block carrying every metric as a finite number. */
export function isChromeWeight(block) {
  return !!block && typeof block === "object" && CHROME_METRICS.every((m) => Number.isFinite(block[m]));
}

/** Chrome caps on one cell: the broken caps, as "chrome metric value > max". */
export function chromeCapViolations(cell) {
  if (!cell?.chromeWeight) return [];
  return CHROME_CAPS.filter((cap) => cell.chromeWeight[cap.metric] > cap.max).map((cap) => `chrome ${cap.metric} ${cell.chromeWeight[cap.metric]} > ${cap.max}`);
}

const isBaseCell = (c) => (c.state ?? "base") === "base";

/**
 * The run's chrome summary over its mounted base cells: how many carry a complete block
 * (`cells`), the mounted ones that do not (`missing`, keys), the worst value per metric, and
 * per capped metric the number of cells over its cap.
 */
export function chromeWeightTotals(cells) {
  const mounted = (cells ?? []).filter((c) => isBaseCell(c) && c.mounted);
  const weighed = mounted.filter((c) => isChromeWeight(c.chromeWeight));
  const worst = Object.fromEntries(CHROME_METRICS.map((m) => [m, Math.max(0, ...weighed.map((c) => c.chromeWeight[m]))]));
  const overCells = Object.fromEntries(CHROME_CAPS.map((cap) => [cap.metric, weighed.filter((c) => c.chromeWeight[cap.metric] > cap.max).length]));
  const missing = mounted.filter((c) => !isChromeWeight(c.chromeWeight)).map((c) => `${c.route}|${c.viewport}|${c.lang}`);
  return { cells: weighed.length, mounted: mounted.length, missing, worst, overCells };
}

/** One stdout fragment: "chrome=<weighed>/<mounted> over=tappable:n,…" (only caps broken). */
export function chromeSummary(totals) {
  const over = Object.entries(totals.overCells).filter(([, n]) => n > 0).map(([m, n]) => `${m}:${n}`).join(",") || "none";
  return `chrome=${totals.cells}/${totals.mounted} chromeOver=${over} chromeWorstTap=${totals.worst.tappable}`;
}
