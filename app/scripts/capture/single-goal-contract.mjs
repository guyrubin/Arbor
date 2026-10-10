/** Bounded synthetic acceptance for B-GROWTH-40. No app/browser/network effects. */
import { validSingleGoalNetwork } from './single-goal-network.mjs';
export const SINGLE_GOAL_ROUTES = Object.freeze(['profile', 'development', 'daily-play', 'plans']);
const rows = (route, states) => states.map(state => ({ route, state }));
export const SINGLE_GOAL_STATES = Object.freeze([
  ...SINGLE_GOAL_ROUTES.map(route => ({ route, state: `history-${route}` })),
  ...rows('development', ['profile-door-arrival', 'picker-history', 'picker-keyboard', 'replacement-question', 'replacement-cancel',
    'picker-close', 'picker-reopen', 'replacement-save', 'saved-reopen', 'earlier-open', 'earlier-question', 'earlier-save', 'earlier-reopen']),
  ...rows('profile', ['browser-back']), ...rows('development', ['browser-forward', 'forward-reopen']),
  ...rows('daily-play', ['daily-picker', 'daily-question', 'daily-cancel', 'daily-save', 'daily-reopen', 'daily-escape']),
  ...['empty', 'long'].flatMap(kind => SINGLE_GOAL_ROUTES.map(route => ({ route, state: `${kind}-${route}` }))),
  ...rows('development', ['empty-picker', 'empty-question', 'empty-cancel', 'empty-save', 'empty-reopen',
    'long-picker', 'long-earlier', 'long-question', 'long-cancel', 'long-save', 'long-reopen', 'history-child-return',
    'watch-chosen', 'watch-cleared', 'watch-undo']),
]);
export const SINGLE_GOAL_LIMITATIONS = Object.freeze([
  { state: 'remote-pending-failure-retry', status: 'offline-source-test-only', reason: 'The unchanged sandbox goal writer resolves locally without Firestore. Pending acknowledgement, transport failure/retry after close/reopen, and changed-source admission remain the corrected actual-source persistence/lifecycle tests. No artificial delay, fake successful remote acknowledgement or runtime patch is used.' },
  { state: 'owner-session-races', status: 'offline-source-test-only', reason: 'No account, auth provider, session injection, credential or auth bypass is used. Owner A-to-B-to-identical-A and overlapping obsolete/new writes remain corrected source-test evidence, not browser coverage or cross-device transactions.' },
  { state: 'local-persistence', status: 'synthetic-local-only', reason: 'Real controls mutate only invented profiles through the existing local sandbox writer. Storage reads, close/reopen and reload establish observed local state only; quota/access failure durability is not certified.' },
  { state: 'browser-back', status: 'browser-history-only', reason: 'Actual browser Back/Forward follows the real Profile door and retires the picker. This does not exercise native Android Back.' },
  { state: 'full-row', status: 'hold-unchanged', reason: 'Canonical B-GROWTH-40 full-row HOLD/re-sort under P5 B-LOOP-09 stays open. No ActionPlan coupling, extra Now offer, program/arbiter/prompt change, old hub reconstruction or full Parent acceptance is claimed.' },
]);
export const SINGLE_GOAL_DOORS = Object.freeze({ profile: 'profile-goals-edit', development: 'portrait-goals-edit', 'daily-play': 'daily-play-goals-edit' });
export const SINGLE_GOAL_SURFACES = Object.freeze({ profile: { primary: 'capture-moment', budget: 3 }, development: { primary: 'explore-child-record', budget: 3 }, 'daily-play': { primary: 'log-play', budget: 3 }, plans: { primary: 'advance-plan-step', budget: 3 } });
export function singleGoalFixture(bundle, lang) {
  const parsed = JSON.parse(typeof bundle === 'string' ? bundle : JSON.stringify(bundle));
  const body = parsed?.locales?.[lang] ?? parsed;
  if (!['en', 'he'].includes(lang) || parsed?.parent?.demo !== true || body?.child?.demo !== true || !body.collections || !Array.isArray(body.collections.milestones) || !body.collections.milestones.length || typeof body.collections.milestones[0]?.id !== 'string') throw new Error('SYNTHETIC_SINGLE_GOAL_FIXTURE_REQUIRED');
  const he = lang === 'he';
  const goal = (goalId, label, domainId, day, extra = {}) => ({ goalId, label, domainId, addedAt: `2026-09-${day}T10:00:00.000Z`, ...extra });
  const goals = [goal('transitions', 'Preserved original transition label', 'regulation', '01', { captureMetadata: { source: 'invented-parent-choice', keep: true } }),
    goal('capture-retired-goal', he ? 'בחירה קודמת מומצאת שנשארה בתיעוד' : 'An invented earlier choice retained in the record', 'social', '02', { retainedExtra: ['unchanged', 7] }),
    goal('early-talking', 'Preserved original talking label', 'language', '03')];
  const longGoals = [goal('capture-retired-long-earlier', he ? 'בחירה קודמת עם תיאור ארוך: לקרוא יחד ספר מוכר, לעצור ליד התמונה ולתת מקום לכל המילים שלנו בעברית ובאנגלית' : 'An earlier retained choice with a long label: read a familiar book together, pause by the picture and make room for all of our words in Hebrew and English', 'language', '01', { retainedExtra: { original: true } }),
    goal('capture-retired-long-current', he ? 'בחירה שמורה עם תיאור ארוך במיוחד: לבחור יחד את הספר של הערב, למצוא מקום נעים ולשוחח על התמונות בקצב המשפחתי שלנו, בעברית וגם באנגלית, בלי למהר לדף הבא' : 'A retained choice with a very long label: choose the evening book together, find a comfortable place and talk about the pictures at our own family pace, in Hebrew and English, without rushing to the next page', 'cognitive', '03', { retainedExtra: { original: true } })];
  const profile = (id, name, activeGoals) => {
    const child = { ...body.child, id, name, demo: true, age: 4, activeGoals };
    for (const key of ['birthDate', 'ageMonths', 'ageMonthsAsOf', 'preterm', 'photoUrl', 'avatar']) delete child[key];
    return child;
  };
  const children = [profile('capture-goal-history', he ? 'נועה' : 'Noa', goals), profile('capture-goal-empty', he ? 'מירה' : 'Mira', []), profile('capture-goal-long', he ? 'טל' : 'Tal', longGoals)];
  const collections = Object.fromEntries(Object.keys(body.collections).map(name => [name, []]));
  collections.milestones = [{ ...body.collections.milestones[0], checked: false }];
  collections.behaviorLogs = [{ id: 'capture-goal-note', timestamp: '2026-10-01T10:00:00.000Z', behaviorType: 'Moment', trigger: he ? 'מילים מומצאות שנשארות בתיעוד' : 'Invented words that stay in the record', durationMinutes: 0 }];
  body.child = children[0]; body.collections = collections;
  body.siblings = children.slice(1).map(child => ({ child, collections: structuredClone(collections) }));
  const watch = { milestoneId: collections.milestones[0].id, screenItemId: 'capture-goal-watch', chosenAt: '2026-10-01T12:00:00.000Z' };
  return { parsed, children, childId: children[0].id, collectionNames: Object.keys(collections), watch, lang,
    fixtureMethod: 'Existing sandbox/demo-family.json bootstrap; real hydrateDemoFamily writes profiles/collections once. Three invented child variants are reached by the real child picker. Watch choice is a one-time, separately identified local preload.' };
}
/** One-time invented watch fixture before app startup. Never repairs later UI state. */
export function initializeSingleGoalWatch({ childId, watch }) {
  const marker = 'arbor.capture.singleGoal.watchSeeded';
  if (sessionStorage.getItem(marker)) return;
  localStorage.setItem(`arbor.screen.watch.${childId}`, JSON.stringify(watch));
  sessionStorage.setItem(marker, 'true');
}
const common = ['ACTUAL_SETTLED_GOAL_FRAME', 'FOUR_ROUTE_VOCABULARY', 'ONE_PRIMARY_WITHIN_MODULE_BUDGET', 'NO_HORIZONTAL_OVERFLOW', 'GOAL_HISTORY_EXACT', 'CHILD_COLLECTIONS_UNCHANGED', 'ONLY_APPROVED_PROFILE_CHANGE', 'NO_GOAL_MUTATION_DISPATCH', 'SYNTHETIC_ONLINE', 'NO_PROHIBITED_ACTIONS', 'FINAL_NETWORK_COUNTERS_ZERO'];
export function singleGoalRequiredAssertions(state) {
  if (!SINGLE_GOAL_STATES.some(row => row.state === state)) return [];
  const specific = state.startsWith('history-') && state !== 'history-child-return' || /^(empty|long)-(profile|development|daily-play|plans)$/.test(state) ? ['ACTUAL_SINGLE_CURRENT_LINE'] : [];
  const facts = {
    'profile-door-arrival': ['PROFILE_DOOR_ACTUAL_ARRIVAL'], 'picker-history': ['THREE_STORED_ONE_CURRENT', 'GOAL_TARGETS_44PX'],
    'picker-keyboard': ['REAL_TAB_WRAPS_BOTH_DIRECTIONS'], 'replacement-question': ['EXPLICIT_REPLACEMENT_QUESTION', 'CONFIRMATION_FOCUS', 'GOAL_TARGETS_44PX'],
    'replacement-cancel': ['CANCEL_RESTORES_CHOICES_AND_DIALOG_FOCUS'], 'picker-close': ['CLOSE_RETURNS_OPENER_FOCUS'], 'picker-reopen': ['REOPEN_NO_STALE_CHOICE'],
    'replacement-save': ['LOCAL_SAVE_PRESERVES_EVERY_RECORD'], 'saved-reopen': ['REOPEN_SHOWS_SAVED_CURRENT'],
    'earlier-open': ['EARLIER_LIST_COMPLETE'], 'earlier-question': ['EXPLICIT_REPLACEMENT_QUESTION', 'CONFIRMATION_FOCUS'],
    'earlier-save': ['LOCAL_SAVE_PRESERVES_EVERY_RECORD'], 'earlier-reopen': ['REOPEN_SHOWS_SAVED_CURRENT'],
    'browser-back': ['ACTUAL_BACK_RETIRES_PICKER'], 'browser-forward': ['ACTUAL_FORWARD_NO_STALE_PICKER'], 'forward-reopen': ['REOPEN_NO_STALE_CHOICE'],
    'daily-picker': ['SAME_PROVIDER_PICKER'], 'daily-question': ['EXPLICIT_REPLACEMENT_QUESTION', 'CONFIRMATION_FOCUS'], 'daily-cancel': ['CANCEL_RESTORES_CHOICES_AND_DIALOG_FOCUS'],
    'daily-save': ['LOCAL_SAVE_PRESERVES_EVERY_RECORD'], 'daily-reopen': ['REOPEN_SHOWS_SAVED_CURRENT'], 'daily-escape': ['ESCAPE_RETURNS_OPENER_FOCUS'],
    'empty-picker': ['EMPTY_NO_CURRENT_OR_EARLIER'], 'empty-question': ['EMPTY_CHOICE_PRESERVES_NOTES', 'CONFIRMATION_FOCUS'], 'empty-cancel': ['CANCEL_RESTORES_CHOICES_AND_DIALOG_FOCUS'],
    'empty-save': ['LOCAL_SAVE_PRESERVES_EVERY_RECORD'], 'empty-reopen': ['REOPEN_SHOWS_SAVED_CURRENT'],
    'long-picker': ['FULL_LONG_LABEL_RETAINED', 'GOAL_TARGETS_44PX'], 'long-earlier': ['EARLIER_LIST_COMPLETE', 'FULL_LONG_LABEL_RETAINED'],
    'long-question': ['EXPLICIT_REPLACEMENT_QUESTION', 'CONFIRMATION_FOCUS'], 'long-cancel': ['CANCEL_RESTORES_CHOICES_AND_DIALOG_FOCUS'],
    'long-save': ['LOCAL_SAVE_PRESERVES_EVERY_RECORD'], 'long-reopen': ['REOPEN_SHOWS_SAVED_CURRENT'],
    'history-child-return': ['ACTUAL_CHILD_RETURN_PRESERVES_GOALS'],
    'watch-chosen': ['ACTUAL_CHOSEN_WATCH', 'GOAL_TARGETS_44PX'], 'watch-cleared': ['ACTUAL_CLEAR_RECEIPT_AND_STORAGE', 'GOAL_TARGETS_44PX'], 'watch-undo': ['ACTUAL_UNDO_RESTORES_WATCH', 'GOAL_TARGETS_44PX'],
  };
  const touch = /^(history|empty|long)-(profile|development|daily-play)$/.test(state) ? ['GOAL_TARGETS_44PX'] : [];
  const savedLine = state.endsWith('-save') ? ['ACTUAL_SINGLE_CURRENT_LINE', 'GOAL_TARGETS_44PX'] : [];
  return [...common, ...specific, ...touch, ...savedLine, ...(facts[state] ?? [])];
}
export function singleGoalShot(cell) { return `shots/release.single-goal.${cell.viewport}.${cell.lang}.${cell.state}.exact.png`; }
export function validSingleGoalCell(cell) {
  const required = singleGoalRequiredAssertions(cell?.state);
  return required.length > 0 && cell.shot === singleGoalShot(cell) && cell.fixture === 'synthetic-single-goal-actual-controls-local-only'
    && required.every(id => cell.assertions?.some(fact => fact.id === id && fact.passed === true))
    && cell.frames?.length > 0 && cell.frames.every(frame => frame.ready === true)
    && validSingleGoalNetwork(cell.networkEvidence);
}
/** Compare actual stored arrays without reproducing the production merge helper. */
export function compareGoalSave(before, after, selectedId, newGoal = null) {
  if (!Array.isArray(before) || !Array.isArray(after) || new Set(before.map(goal => goal.goalId)).size !== before.length) return false;
  const previous = before.find(goal => goal.goalId === selectedId);
  const selected = after.at(-1);
  if (!selected || selected.goalId !== selectedId || !Number.isFinite(Date.parse(selected.addedAt))) return false;
  const times = before.map(goal => Date.parse(goal.addedAt)).filter(Number.isFinite);
  if (times.length && Date.parse(selected.addedAt) <= Math.max(...times)) return false;
  const withoutTime = ({ addedAt, ...rest }) => rest;
  return JSON.stringify(after.slice(0, -1)) === JSON.stringify(before.filter(goal => goal.goalId !== selectedId))
    && JSON.stringify(withoutTime(selected)) === JSON.stringify(previous ? withoutTime(previous) : newGoal);
}
/** Passive observation serialized by Playwright. No DOM, app or storage mutation. */
export function observeSingleGoalFrame({ route, childId, selector, expectedText = null, outgoing = null, waitUntilReady = false }) {
  const visible = node => { const box = node.getBoundingClientRect(); const style = getComputedStyle(node); return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !node.closest('[hidden]'); };
  const root = document.querySelector(`#main [data-route="${route}"]`);
  const matches = [...document.querySelectorAll(selector)]; const target = matches.find(visible);
  const main = document.querySelector('#main'); const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
  const ancestors = []; for (let node = target; node; node = node.parentElement) { const style = getComputedStyle(node); ancestors.push({ opacity: Number(style.opacity), transform: style.transform, display: style.display, visibility: style.visibility }); }
  const modules = [...(root?.querySelectorAll('[data-module]') ?? [])].filter(node => !node.closest('[data-module-demoted], [data-module-disclosure]') && !node.parentElement?.closest('[data-module]')).map(node => node.getAttribute('data-module'));
  const primary = [...(root?.querySelectorAll('[data-primary-move]') ?? [])].map(node => node.getAttribute('data-primary-move'));
  const active = document.activeElement;
  const frame = { route, childId, selector, hash: location.hash, activeChildId: localStorage.getItem('arbor.activeChildId'), matches: matches.length,
    targetConnected: !!target?.isConnected, targetVisible: !!target, targetText: target?.innerText?.trim() ?? '', mainText: main?.innerText?.trim() ?? '', modules, primary,
    pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, mainClientWidth: main?.clientWidth ?? 0, mainScrollWidth: main?.scrollWidth ?? 0,
    targetWidth: target?.getBoundingClientRect().width ?? 0, targetScrollWidth: target?.scrollWidth ?? 0, targetClientWidth: target?.clientWidth ?? 0,
    dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length, focus: { insideDialog: !!dialog?.contains(active), isTarget: active === target, insideInert: !!active?.closest('[inert]'), connected: !!active?.isConnected },
    direction: document.documentElement.dir, ancestors, outgoingRetired: !outgoing || !outgoing.isConnected };
  frame.ready = !!root && frame.hash === `#/${route}` && frame.activeChildId === childId && frame.matches === 1 && frame.targetConnected && frame.targetVisible && frame.targetText.length > 0 && (!expectedText || frame.targetText.includes(expectedText)) && frame.outgoingRetired
    && ancestors.length > 0 && ancestors.every(style => style.opacity >= 0.999 && ['none', 'matrix(1, 0, 0, 1, 0, 0)', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'].includes(style.transform) && style.display !== 'none' && style.visibility !== 'hidden');
  return waitUntilReady && !frame.ready ? false : frame;
}
