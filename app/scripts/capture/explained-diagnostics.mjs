/**
 * explained-diagnostics.mjs — B-INF-14: the one allow-list of explained exceptions.
 *
 * The sweep law fails every rendered cell with a console/page/load error and every named state
 * that could not reach its screen. An entry here is the only way to let one through, and it must
 * say WHY: the route (and state) it covers, the exact diagnostic kind (a classifier enum or a
 * state-failure category — never the catch-all OTHER_ERROR or STATE_ASSERTION_FAILED, which
 * explain nothing), the reason a parent is not affected, and the row that owns the remedy.
 * The law prints each explained hit by name, so nothing passes silently.
 *
 * 29 Oct 2026: empty. Every diagnostic the release sweep showed was a defect and was repaired
 * (the co-parent 401: B-INF-14 r1, 677351af; the stale state targets: B-INF-14 r2) — no noise left.
 */
export const EXPLAINED_DIAGNOSTICS = Object.freeze([]);

const UNEXPLAINABLE = new Set(['OTHER_ERROR', 'STATE_ASSERTION_FAILED', 'REACT_MINIFIED']);

/** Rejects an entry that cannot explain anything (no route, no kind, no reason, a catch-all kind). */
export function validateExplained(list = EXPLAINED_DIAGNOSTICS) {
  for (const entry of list) {
    if (!entry || typeof entry.route !== 'string' || !entry.route) throw new Error('EXPLAINED_ROUTE_REQUIRED');
    if (typeof entry.kind !== 'string' || !/^[A-Z][A-Z0-9_]+$/.test(entry.kind) || UNEXPLAINABLE.has(entry.kind)) throw new Error('EXPLAINED_KIND_INVALID');
    if (typeof entry.why !== 'string' || entry.why.trim().length < 20) throw new Error('EXPLAINED_WHY_REQUIRED');
    if (typeof entry.owner !== 'string' || !/^B-[A-Z]+-\d+$/.test(entry.owner)) throw new Error('EXPLAINED_OWNER_REQUIRED');
    if (entry.state !== undefined && (typeof entry.state !== 'string' || !entry.state)) throw new Error('EXPLAINED_STATE_INVALID');
  }
  return list;
}

/** The entry that explains `kind` on this cell (route, and state when the entry names one), or null. */
export function explanationFor(cell, kind, list = EXPLAINED_DIAGNOSTICS) {
  const state = cell?.state ?? 'base';
  return list.find((entry) => entry.kind === kind && entry.route === cell?.route && (entry.state === undefined || entry.state === state)) ?? null;
}
