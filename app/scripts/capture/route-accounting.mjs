/**
 * route-accounting.mjs — B-DESIGN-05 (agent half): every one of the 43 route IDs, accounted for.
 *
 * The row's acceptance: Parent renders and retained redirects in EN/HE at 375 and 1280 plus 1920
 * EN; the admin-only route denied to a parent; G0/G1 on the five V3 hubs with actual fonts.
 * This file is the account: each ID's class, what a parent sees there, and the cells its evidence
 * needs. scripts/routeAccounting.test.ts holds it to src/lib/routes.ts (a new route without a line
 * here fails) and `rendered-sweep.mjs --matrix design` renders exactly DESIGN_VIEWPORT_IDS.
 * Pure data; no app or browser imports.
 */

/** The design acceptance cells (ids of DEVICE_VIEWPORTS in release-config.mjs). */
export const DESIGN_VIEWPORT_IDS = Object.freeze(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he', 'wide-en']);

/** The five V3 hubs G0/G1 approve (three places, two doors; Talk is a panel, not a page). */
export const V3_HUBS = Object.freeze({ now: 'overview', child: 'development', together: 'practice', learn: 'masterclasses', care: 'consult' });

/**
 * parent   — a parent surface (its v3 home renders it), all DESIGN_VIEWPORT_IDS
 * preview  — the parent's preview of a kid tool (Together → parent preview → the child's own
 *            experience behind the Kid Mode gate); parent register, all DESIGN_VIEWPORT_IDS
 * redirect — a retired ID kept as a deep link (RETIRED_ROUTES): it must land on its target
 * admin    — admin-only: a parent is denied (the view gates on entitlement.isAdmin; the server 403s)
 */
export const ROUTE_ACCOUNT = Object.freeze({
  overview: 'parent', weekly: 'parent', 'day-windows': 'parent', 'smart-reminders': 'parent',
  coach: 'parent',
  development: 'parent', milestones: 'parent', language: 'parent', screening: 'parent', timeline: 'parent', journal: 'parent', behaviors: 'parent',
  profile: 'parent', science: 'parent',
  practice: 'parent', 'daily-play': 'parent', plans: 'parent', stories: 'parent', 'bedtime-stories': 'parent', comics: 'parent',
  speech: 'preview', mimic: 'preview', feelings: 'preview', adventures: 'preview',
  masterclasses: 'parent', learn: 'parent', family: 'parent',
  consult: 'parent', handoff: 'parent', safety: 'parent', 'care-team': 'parent', appointments: 'parent', sharing: 'parent', reports: 'parent', 'school-brief': 'parent',
  strengths: 'redirect', memory: 'redirect', 'find-pro': 'redirect', scholar: 'redirect', journey: 'redirect', routines: 'redirect', copilot: 'redirect',
  attribution: 'admin',
});

/** The cells each class must render (redirects and the admin denial are checked in EN/HE at 375/1280). */
export function requiredCells(kind) {
  if (kind === 'parent' || kind === 'preview') return DESIGN_VIEWPORT_IDS;
  if (kind === 'redirect' || kind === 'admin') return DESIGN_VIEWPORT_IDS.filter((id) => id !== 'wide-en');
  throw new Error('ROUTE_ACCOUNT_KIND_UNKNOWN');
}
