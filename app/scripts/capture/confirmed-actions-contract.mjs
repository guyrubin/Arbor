/** Additive synthetic Parent action contract. Importing this module performs no I/O. */
import { recordFixture } from './record-contract.mjs';

export const CONFIRMED_ACTIONS_NOW = '2026-10-10T06:00:00.000Z'; // 09:00 Asia/Jerusalem
export const CONFIRMED_ACTIONS_EXPIRED = '2026-10-12T12:00:00.000Z';
const rows = (route, states) => states.map(state => ({ route, state }));
export const CONFIRMED_ACTION_STATES = Object.freeze([
  ...rows('overview', ['record-parent-source', 'record-step-source', 'record-local-failure', 'record-local-retry',
    'chosen-tonight-override', 'visit-lead', 'visit-tonight-override',
    'sayback-yes-failure', 'sayback-yes-saved', 'sayback-not_today-failure', 'sayback-not_today-saved',
    'chosen-helped-failure', 'chosen-helped-saved', 'chosen-not_today-failure', 'chosen-not_today-saved']),
  ...rows('consult', ['visit-target-arrival', 'visit-history-return', 'consult-typed-draft', 'consult-expired-inert',
    'consult-restored-draft', 'consult-teacher-review-retirement', 'consult-missing-target', 'consult-child-target-isolation']),
  ...rows('milestones', ['milestone-kept-parity', 'milestone-text-review', 'milestone-review-cancel',
    'milestone-reviewed-send', 'milestone-editor-cancel', 'milestone-editor-save', 'milestone-stale-open',
    'milestone-stale-final-send', 'milestone-editor-stale-final-send', 'milestone-child-return']),
  ...rows('family', ['ritual-start-local-failure', 'ritual-start-local-saved', 'ritual-reload-repeat', 'ritual-library-start', 'ritual-failed-child-retirement', 'ritual-saved-child-return']),
  { route: 'overview', state: 'ritual-now-destination' },
  ...rows('plans', ['routine-partial', 'routine-complete', 'routine-repeat-toggle', 'routine-reload',
    'routine-card-isolation', 'routine-reset', 'routine-sibling-return', 'routine-local-failure', 'routine-local-retry']),
]);
export const CONFIRMED_ACTION_LIMITATIONS = Object.freeze([
  { state: 'remote-acknowledgement-and-metadata', status: 'not-exercised', reason: 'The sandbox acknowledges successful localStorage writes only. No Firestore cache, pending, error, SDK write promise, rules or cross-device confirmation is fabricated.' },
  { state: 'consult-draft-eligibility', status: 'synthetic-clock-only', reason: 'Actual typing and retained hidden/inert DOM are tested through expiry/recovery of the same target using a synthetic Date-only clock with native performance, timers and animation time, and same-target hash updates. This is not a Firestore source-loss transition or durable draft storage.' },
  { state: 'storage-failure', status: 'synthetic-persistence-seam', reason: 'After hydration a scoped Storage.setItem fault throws before writing a known synthetic child key. The original setter is restored in finally before retry.' },
  { state: 'native-share', status: 'not-exercised', reason: 'Actual reviewed text reaches only the existing synthetic browser share sink; no external recipient, clipboard, upload or native OS share is exercised.' },
  { state: 'family-pending-retirement', status: 'not-exercised', reason: 'Family source is reviewed separately. Browser capture covers actual local failure, retry, saved first-step destination and child retirement after settlement. Delayed server continuations and topic/language ABA remain offline-source evidence only.' },
]);

export function confirmedActionsFixture(bundle, lang) {
  const fixture = recordFixture(bundle, lang);
  const body = fixture.parsed.locales?.[lang] ?? fixture.parsed;
  body.child.languages = ['Hebrew (Native)', 'English (Transition)'];
  const he = lang === 'he';
  const words = {
    parent: he ? 'בבוקר בחרנו יחד נעליים ליד הדלת.' : 'In the morning we chose shoes together by the door.',
    step: he ? 'הצענו שתי נעליים מוכרות לפני היציאה.' : 'Offer two familiar shoes before leaving home.',
    chosen: he ? 'לשבת יחד ולקרוא עמוד אחד.' : 'Sit together and read one page.',
    draft: he ? 'טיוטה מומצאת לביקור, עוד לא נשמרה או נשלחה.' : 'Invented visit draft, not yet saved or sent.',
    edited: he ? 'מילים מומצאות שההורה ערך לפני השליחה.' : 'Invented words edited by the parent before sending.',
  };
  const routineRows = [
    { id: 'capture-morning', name: he ? 'בוקר מומצא יחד' : 'Invented morning together', steps: [
      { text: he ? 'לבחור חולצה מוכרת' : 'Choose a familiar shirt', done: false },
      { text: he ? 'להניח נעליים ליד הדלת' : 'Put shoes by the door', done: false },
      { text: he ? 'לבחור ספר לדרך' : 'Choose a book to take', done: false },
    ] },
    { id: 'capture-goodbye', name: he ? 'פרידה מומצאת' : 'Invented goodbye', steps: [
      { text: he ? 'לנופף לשלום יחד' : 'Wave goodbye together', done: false },
      { text: he ? 'ללכת יחד אל הדלת' : 'Walk to the door together', done: false },
    ] },
  ];
  const plan = { id: 'capture-confirmed-plan', title: he ? 'בוקר יחד' : 'Mornings together', issue: 'morning shoes', createdAt: '2026-10-01T09:00:00Z', phases: [{ id: 'phase', title: 'First', steps: [{ id: 'step', text: words.step, status: 'pending' }] }] };
  const chosen = { id: 'capture-confirmed-chosen', recommendation: words.chosen, source: 'coach', status: 'accepted', acceptedAt: '2026-10-10T05:00:00Z', capacity: 'tiny' };
  const visit = { id: 'capture-confirmed-visit', who: '', profession: 'slp', role: 'CAPTURE LEGACY ROLE MUST STAY OUT', when: '', whenIso: '2026-10-11T09:00:00.000Z', mode: 'In person', status: 'confirmed' };
  // Earlier requested/elapsed rows and another valid visit prove exact selection.
  const appointments = [
    { ...visit, id: 'capture-requested-visit', profession: 'pediatrician', status: 'requested', whenIso: '2026-10-10T07:00:00.000Z' },
    { ...visit, id: 'capture-elapsed-visit', profession: 'teacher', whenIso: '2026-10-10T05:00:00.000Z' },
    visit,
    { ...visit, id: 'capture-other-visit', profession: 'ot', whenIso: '2026-10-12T09:00:00.000Z' },
  ];
  const collections = { ...body.collections, actionPlans: [], actionLoops: [], appointments: [], apptFollowUps: [], apptQuestions: [], programs: [], familyGoals: [], familyTopics: [], playLogs: [], routines: [] };
  body.collections = collections;
  body.siblings[0].collections = Object.fromEntries(Object.keys(collections).map(name => [name, []]));
  return { ...fixture, collections, words, routineRows, plan, chosen, visit, appointments, lang };
}

export function confirmedActionVariant(fixture, variant) {
  const collections = JSON.parse(JSON.stringify(fixture.collections));
  if (variant === 'record-parent' || variant === 'record-step' || variant === 'visit' || variant === 'chosen') {
    collections.actionPlans = [fixture.plan];
    collections.behaviorLogs.push({ id: 'capture-confirmed-parent-note', behaviorType: 'Moment', trigger: fixture.words.parent, durationMinutes: 0, timestamp: '2026-10-07T09:00:00Z' });
  }
  if (variant === 'record-step') collections.actionLoops = [{ ...fixture.chosen, id: 'capture-tried-plan-step', source: 'plan', status: 'completed', planId: fixture.plan.id, recommendation: fixture.words.step, outcome: 'helped', outcomeAt: '2026-10-08T09:00:00Z' }];
  if (variant === 'visit' || variant === 'chosen') collections.appointments = fixture.appointments;
  if (variant === 'chosen') collections.actionLoops = [fixture.chosen];
  if (variant === 'routines') collections.routines = structuredClone(fixture.routineRows);
  if (variant === 'sayback') collections.keepsakes.push({ id: 'capture-confirmed-sayback', kind: 'quote', note: 'Another book please', language: 'English', noticedOn: '2026-10-09', createdAt: '2026-10-09', updatedAt: '2026-10-09' });
  if (!['base', 'record-parent', 'record-step', 'visit', 'chosen', 'sayback', 'routines'].includes(variant)) throw new Error('CONFIRMED_ACTION_VARIANT_INVALID');
  return collections;
}

/** Install AFTER hydration only. Fault the actual local persistence boundary,
 * never application state/metadata. Restore the original descriptor in finally. */
export function installConfirmedStorageFault({ childId, kind }) {
  if (!/^[\w-]{1,100}$/.test(childId) || !['actionLoops', 'routines'].includes(kind)) throw new Error('CONFIRMED_STORAGE_FAULT_SCOPE_INVALID');
  if (window.__arborConfirmedStorageFault) throw new Error('CONFIRMED_STORAGE_FAULT_ALREADY_ARMED');
  const key = `arbor.${kind}.${childId}`;
  if (localStorage.getItem('arbor.activeChildId') !== childId) throw new Error('CONFIRMED_STORAGE_FAULT_CHILD_MISMATCH');
  const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
  const original = Storage.prototype.setItem;
  const state = { key, rejected: 0, previous: localStorage.getItem(key), restore: () => Object.defineProperty(Storage.prototype, 'setItem', descriptor) };
  Object.defineProperty(Storage.prototype, 'setItem', { ...descriptor, value(name, value) {
    if (this === localStorage && name === key) { state.rejected++; throw new DOMException('Synthetic capture quota failure', 'QuotaExceededError'); }
    return original.call(this, name, value);
  } });
  window.__arborConfirmedStorageFault = state;
}
export function restoreConfirmedStorageFault() {
  const state = window.__arborConfirmedStorageFault;
  if (!state) return null;
  const evidence = { key: state.key, rejected: state.rejected, unchanged: localStorage.getItem(state.key) === state.previous };
  state.restore();
  delete window.__arborConfirmedStorageFault;
  return evidence;
}

export function validConfirmedActionFrame(frame) {
  return !!frame && frame.visible && frame.hit && frame.inMain && frame.enabled
    && [frame.width, frame.height, frame.pageWidth, frame.viewportWidth].every(Number.isFinite)
    && frame.width >= 44 && frame.height >= 44 && frame.pageWidth <= frame.viewportWidth + 1;
}
