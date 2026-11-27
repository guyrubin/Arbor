/**
 * B-CAREPRO-51 + B-SHELL-42 — pure contract for scripts/sharing-care-browser.mjs.
 * No app, browser or network imports, so the guard test reads it directly.
 *
 * Cells come from the matrix of record (DEVICE_VIEWPORTS); no size is restated here.
 *  - Sharing / Care team / revoke: the release phone and desktop cells (375 and 1280) × EN/HE.
 *  - Switcher fit: the same four plus the 390 Safari phone box × EN/HE (B-SHELL-42's case).
 */
import { DEVICE_VIEWPORTS } from './release-config.mjs';

export const SHARING_ROUTES = Object.freeze(['sharing', 'care-team']);
export const SHARING_CELL_IDS = Object.freeze(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
export const SWITCHER_CELL_IDS = Object.freeze([...SHARING_CELL_IDS, 'safari-en', 'safari-he']);

const pick = (ids) => Object.freeze(ids.map((id) => {
  const cell = DEVICE_VIEWPORTS.find((viewport) => viewport.id === id);
  if (!cell) throw new Error(`SHARING_CARE_CELL_UNKNOWN ${id}`);
  return cell;
}));
export const SHARING_CELLS = pick(SHARING_CELL_IDS);
export const SWITCHER_CELLS = pick(SWITCHER_CELL_IDS);

/** Synthetic recipients only (reserved example.com domain); nothing is ever sent. */
export const SYNTHETIC_RECIPIENTS = Object.freeze({
  coParent: 'other.parent@example.com',
  professional: 'care.team@example.com',
});

/** The two grants each cell writes to the LOCAL sandbox share store: a co-parent on
 *  the week (the Sharing week card's scopes) and a professional on one visit report. */
export function syntheticGrants(childId, childName) {
  if (!childId) throw new Error('SHARING_CARE_CHILD_REQUIRED');
  return [
    { key: 'coParent', childId, childName, recipientEmail: SYNTHETIC_RECIPIENTS.coParent, role: 'co_parent', scopes: ['weekly_insight', 'story_timeline'], duration: 'until_revoked' },
    { key: 'professional', childId, childName, recipientEmail: SYNTHETIC_RECIPIENTS.professional, role: 'professional', scopes: ['report_pediatrician'], duration: '60d' },
  ];
}

/** The harness writes grants: it runs against a loopback sandbox only, never a deployed origin. */
export function assertLoopbackBase(base) {
  let url;
  try { url = new URL(base); } catch { throw new Error('SHARING_CARE_BASE_INVALID'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('SHARING_CARE_BASE_NOT_LOOPBACK');
  return url.origin;
}

/**
 * A measured box lies inside the viewport (1 px rounding slack). `gutter` asks for the
 * shell's side gutter as well; the list's own max width promises 16 px each side.
 */
export function boxInside(box, viewport, gutter = 0) {
  if (!box) return false;
  const slack = 1;
  return box.x >= gutter - slack && box.y >= -slack
    && box.x + box.width <= viewport.w - gutter + slack
    && box.y + box.height <= viewport.h + slack;
}

/** One switcher verdict from the in-page measurement: the list and every control in it. */
export function switcherVerdict(measure, viewport) {
  const problems = [];
  if (!measure?.list) return { pass: false, problems: ['switcher list not open'] };
  if (!boxInside(measure.list, viewport)) problems.push('list leaves the viewport');
  if (!boxInside(measure.list, viewport, 16)) problems.push('list crosses the 16 px gutter');
  if (measure.list.scrollWidth > measure.list.clientWidth + 1) problems.push('list content overflows its width');
  if ((measure.controls ?? []).length < 3) problems.push('fewer than two children plus Edit profile');
  for (const c of measure.controls ?? []) {
    if (!boxInside(c, viewport)) problems.push(`control "${c.label}" leaves the viewport`);
    if (c.height < 44) problems.push(`control "${c.label}" is under 44 px tall`);
    if (!c.hit) problems.push(`control "${c.label}" is covered or clipped at its centre`);
    if (c.clipped) problems.push(`control "${c.label}" text is clipped`);
  }
  return { pass: problems.length === 0, problems };
}

/** One route verdict: rendered, no error state, no horizontal overflow, the grants on the roster. */
export function routeVerdict(measure, expectedEmails) {
  const problems = [];
  if (!measure.h1) problems.push('no heading');
  if (measure.errorState) problems.push('error state shown');
  if (!measure.roster) problems.push('roster not rendered');
  if (measure.scrollWidth > measure.clientWidth + 1) problems.push(`page overflows horizontally (${measure.scrollWidth} > ${measure.clientWidth})`);
  for (const o of measure.offscreen ?? []) problems.push(`element past the viewport edge: ${o}`);
  for (const email of expectedEmails) {
    if (!(measure.rosterEmails ?? []).includes(email)) problems.push(`${email} missing from the roster`);
    if (!(measure.laneEmails ?? []).some((lane) => lane.includes(email))) problems.push(`${email} missing from who-sees-what`);
  }
  return { pass: problems.length === 0, problems };
}
