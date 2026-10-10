/** Pure DEV-preview evidence contract. Never an auth or acknowledgement fixture. */
export const FIRST_RUN_PREVIEW_BOUNDARY = Object.freeze({
  entry: 'existing DEV-only ?onboarding=1',
  auth: 'existing local-sandbox user; no Firebase identity',
  profileBaseline: 'existing seeded synthetic family; not an empty remote account',
  writes: 'real UI handlers to disposable browser-local storage only',
  productionGateVerified: false,
  remoteAcknowledgementVerified: false,
  closeControl: 'absent in current OnboardingFlow; Escape does not dismiss',
  destination: 'explicit full navigation removing the DEV preview query; not automatic ProfileGate exit',
});
export const FIRST_RUN_PREVIEW_LIMITATIONS = Object.freeze([
  { state: 'production-first-run-entry', status: 'blocked', reason: 'computeNeedsOnboarding requires Firestore; the existing forced preview is DEV-only' },
  { state: 'empty-account-first-create', status: 'blocked', reason: 'readLocalProfiles replaces an empty local list with defaultChildProfile; no remote identity is supplied' },
  { state: 'server-create-acknowledgement', status: 'blocked', reason: 'local addChild uses Promise.resolve; no delayed or failed server receipt can be exercised' },
  { state: 'owner-selection-aba-and-pending-close', status: 'offline-source-tests-only', reason: 'the local preview cannot establish the reviewed remote owner/selection/write races' },
  { state: 'profile-gate-automatic-destination', status: 'blocked', reason: 'the DEV force flag stays true until full navigation removes the query' },
  { state: 'first-run-close', status: 'not-implemented', reason: 'OnboardingFlow exposes Back but no Close; no substitute is counted as Close' },
  { state: 'clinical-area-notice', status: 'closed', reason: 'ONBOARDING_NOTICE_REVIEWS remains empty; only the neutral existing journal question is expected' },
  { state: 'provider-crash-and-cross-tab-recovery', status: 'not-claimed', reason: 'a successful local checkpoint reload is not pending-write reservation recovery' },
]);
const common = ['DEV_PREVIEW_BOUNDARY', 'CONTENT_AND_TITLE_VISIBLE', 'DIRECTION_MATCHES_LOCALE', 'UNCHANGED_BASELINE_PROFILES', 'NO_REMOTE_OR_MODEL_WRITES'];
export const FIRST_RUN_PREVIEW_REQUIRED_ASSERTIONS = Object.freeze({
  'about-initial': ['INITIAL_BLANK_FORM', 'INITIAL_CONTINUE_DISABLED', 'THREE_STEP_PROGRESS', 'NO_CLOSE_CONTROL', 'ABOUT_TITLE_EXACT'],
  'about-keyboard-escape': ['REAL_TAB_REACHES_FORM', 'ESCAPE_DOES_NOT_DISMISS', 'NO_CLOSE_CONTROL'],
  'about-consent-required': ['FORM_VALID_EXCEPT_CONSENT', 'CONSENT_REQUIRED_TO_CONTINUE', 'NO_CHILD_CREATED'],
  'about-unsaved-reload': ['UNSAVED_FORM_RESET_ON_RELOAD', 'NO_CHILD_CREATED'],
  'worry-local-created': ['ONE_LOCAL_CHILD_CREATED', 'LOCAL_ABOUT_FIELDS_MATCH', 'LOCAL_CHILD_SELECTED', 'WORRY_STEP_VISIBLE'],
  'about-back-retained': ['REAL_BACK_TO_ABOUT', 'FORM_VALUES_RETAINED', 'SAME_CHILD_NO_DUPLICATE'],
  'worry-repeat-same-child': ['SAME_CHILD_NO_DUPLICATE', 'WORRY_STEP_VISIBLE'],
  'neutral-card': ['AREA_SELECTED_BY_REAL_KEYBOARD', 'NEUTRAL_NOTICE_EXACT', 'LOCAL_DRAFT_CHECKPOINTED', 'PRIMARY_ACTION_REACHABLE'],
  'worry-card-back': ['REAL_BACK_TO_WORRY', 'CHOICE_RETAINED', 'SAME_CHILD_NO_DUPLICATE'],
  'neutral-checkpoint-reload': ['RELOAD_RESUMES_LOCAL_STEP_THREE', 'NEUTRAL_NOTICE_EXACT', 'SAME_CHILD_NO_DUPLICATE'],
  'local-completion-repeat': ['LOCAL_COMPLETION_RECORDED', 'ONE_ACCEPTED_ACTION_EXACT', 'REPEAT_DID_NOT_DUPLICATE', 'FORCED_PREVIEW_STILL_MOUNTED'],
  'explicit-preview-exit-now': ['EXPLICIT_PREVIEW_REMOVAL', 'ACTUAL_NOW_DESTINATION', 'ACCEPTED_STEP_VISIBLE', 'SAME_CHILD_NO_DUPLICATE'],
  'browser-back-preview': ['REAL_BROWSER_BACK', 'COMPLETED_CHILD_NOT_REOPENED', 'SAME_CHILD_NO_DUPLICATE'],
  'browser-forward-now': ['REAL_BROWSER_FORWARD', 'ACTUAL_NOW_DESTINATION', 'ACCEPTED_STEP_VISIBLE', 'SAME_CHILD_NO_DUPLICATE'],
});
export const FIRST_RUN_PREVIEW_STATES = Object.freeze(Object.keys(FIRST_RUN_PREVIEW_REQUIRED_ASSERTIONS).map(state => ({ route: 'onboarding-dev-preview', state })));
export function firstRunPreviewRequiredAssertions(state) {
  return Object.hasOwn(FIRST_RUN_PREVIEW_REQUIRED_ASSERTIONS, state) ? [...common, ...FIRST_RUN_PREVIEW_REQUIRED_ASSERTIONS[state]] : [];
}
/** One immutable primary-image identity per required state, locale and viewport. */
export function firstRunPreviewPrimaryShot({ state, viewport, lang } = {}) {
  if (!Object.hasOwn(FIRST_RUN_PREVIEW_REQUIRED_ASSERTIONS, state ?? '') || !['375x812', '1280x800'].includes(viewport) || !['en', 'he'].includes(lang)) return null;
  return `shots/release.first-run-preview.${viewport}.${lang}.${state}.dev-only.exact.png`;
}
export function validFirstRunPreviewCell(cell) {
  const required = firstRunPreviewRequiredAssertions(cell?.state);
  return required.length > 0 && cell?.shot === firstRunPreviewPrimaryShot(cell) && required.every(id => cell?.assertions?.some(row => row.id === id && row.passed === true))
    && cell?.fixture === 'existing-dev-onboarding-preview'
    && cell?.firstRunPreview?.productionGateVerified === false && cell?.firstRunPreview?.remoteAcknowledgementVerified === false
    && cell?.firstRunPreview?.auth === FIRST_RUN_PREVIEW_BOUNDARY.auth
    && cell?.frames?.length > 0 && cell.frames.every(frame => frame.ready === true)
    && cell?.networkEvidence?.firstRunDeniedWrites === 0 && cell?.networkEvidence?.mockRequests === 0 && cell?.networkEvidence?.deniedExternal === 0;
}
export function firstRunPreviewApiDisposition(method, pathname) {
  // No fabricated successful writes, delayed promises, API-auth fixtures or model calls.
  // Read-only capability queries are permitted; model endpoints are denied even as GET.
  if (method === 'GET' && pathname === '/api/live/availability') return 'read';
  if (/^\/api\/(?:chat|live|voice|vision|generate|onboarding\/family-child)(?:\/|$)/.test(pathname)) return 'deny';
  return ['GET', 'HEAD'].includes(method) ? 'read' : 'deny';
}
export function firstRunPreviewText(lang) {
  if (!['en', 'he'].includes(lang)) throw new Error('FIRST_RUN_PREVIEW_LOCALE_INVALID');
  const name = lang === 'he' ? 'ילד לדוגמה' : 'Preview Child';
  return { name, about: lang === 'he' ? 'קצת על הילד או הילדה' : 'About your child', neutral: lang === 'he' ? `מה קרה היום עם ${name}?` : `What happened with ${name} today?` };
}
/** Baseline families are never edited by the collector or by first-run handlers. */
export function firstRunPreviewProfileFacts(baseline, current, childId = null) {
  if (!Array.isArray(baseline) || !baseline.length || !Array.isArray(current)) return { baselineUnchanged: false, newCount: -1, sameChild: false };
  const original = new Set(baseline.map(child => child.id));
  const added = current.filter(child => !original.has(child.id));
  return {
    baselineUnchanged: baseline.every(child => JSON.stringify(current.find(row => row.id === child.id)) === JSON.stringify(child)) && new Set(current.map(child => child.id)).size === current.length,
    newCount: added.length,
    sameChild: childId !== null && added.length === 1 && added[0].id === childId,
  };
}
