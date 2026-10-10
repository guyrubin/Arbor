/** Pure DEV-preview evidence contract. Never an auth or acknowledgement fixture. */
export const FIRST_RUN_PREVIEW_BOUNDARY = Object.freeze({
  entry: 'existing DEV-only ?onboarding=1',
  auth: 'existing local-sandbox user; no Firebase identity',
  profileBaseline: 'existing seeded synthetic family; not an empty remote account',
  writes: 'real UI handlers to disposable browser-local storage only',
  observationReceipt: 'real completion handler resolved against disposable local storage; not a remote acknowledgement',
  narration: 'exact runtime POST for the observed newly-created child receives a labeled local 409 refusal; no media/provider success',
  productionGateVerified: false,
  remoteAcknowledgementVerified: false,
  closeControl: 'absent in current OnboardingFlow; Escape does not dismiss',
  destination: 'explicit full navigation removing the DEV preview query; not automatic ProfileGate exit',
});
export const FIRST_RUN_PREVIEW_LIMITATIONS = Object.freeze([
  { state: 'production-first-run-entry', status: 'blocked', reason: 'computeNeedsOnboarding requires Firestore; the existing forced preview is DEV-only' },
  { state: 'empty-account-first-create', status: 'blocked', reason: 'readLocalProfiles replaces an empty local list with defaultChildProfile; no remote identity is supplied' },
  { state: 'server-create-acknowledgement', status: 'blocked', reason: 'local addChild uses Promise.resolve; no delayed or failed server receipt can be exercised' },
  { state: 'observation-server-rejection-retry', status: 'offline-source-tests-only', reason: 'No supported local failure or delayed acknowledgement seam; actual form/provider tests cover rejection, retained draft, retry and stale lifetimes without inventing browser evidence' },
  { state: 'native-hebrew-month-control', status: 'external-review', reason: 'he-IL Playwright locale is requested; actual native month-control language depends on the browser/OS and must be reviewed in fresh PNGs' },
  { state: 'owner-selection-aba-and-pending-close', status: 'offline-source-tests-only', reason: 'the local preview cannot establish the reviewed remote owner/selection/write races' },
  { state: 'profile-gate-automatic-destination', status: 'blocked', reason: 'the DEV force flag stays true until full navigation removes the query' },
  { state: 'first-run-close', status: 'not-implemented', reason: 'OnboardingFlow exposes Back but no Close; no substitute is counted as Close' },
  { state: 'automatic-shell-narration', status: 'synthetic-refusal', reason: 'Only the exact runtime POST for the child observed from the real form save receives local 409. The prior 44/56 run did not record denied endpoints; its counters alone cannot identify them.' },
  { state: 'clinical-area-notice', status: 'closed', reason: 'ONBOARDING_NOTICE_REVIEWS remains empty; only the neutral existing journal question is expected' },
  { state: 'provider-crash-and-cross-tab-recovery', status: 'not-claimed', reason: 'a successful local checkpoint reload is not pending-write reservation recovery' },
]);
const common = ['DEV_PREVIEW_BOUNDARY', 'CONTENT_AND_TITLE_VISIBLE', 'DIRECTION_MATCHES_LOCALE', 'UNCHANGED_BASELINE_PROFILES', 'NO_REMOTE_OR_MODEL_WRITES', 'FIRST_RUN_FINAL_NETWORK_GUARD'];
export const FIRST_RUN_PREVIEW_REQUIRED_ASSERTIONS = Object.freeze({
  'about-initial': ['INITIAL_BLANK_FORM', 'INITIAL_CONTINUE_DISABLED', 'THREE_STEP_PROGRESS', 'NO_CLOSE_CONTROL', 'ABOUT_TITLE_EXACT'],
  'about-keyboard-escape': ['REAL_TAB_REACHES_FORM', 'ESCAPE_DOES_NOT_DISMISS', 'NO_CLOSE_CONTROL'],
  'about-consent-required': ['FORM_VALID_EXCEPT_CONSENT', 'ENGLISH_SELECTION_CHECK_VISIBLE', 'HEBREW_SELECTION_CHECK_VISIBLE', 'CONSENT_REQUIRED_TO_CONTINUE', 'NO_CHILD_CREATED'],
  'about-unsaved-reload': ['UNSAVED_FORM_RESET_ON_RELOAD', 'NO_CHILD_CREATED'],
  'worry-local-created': ['ONE_LOCAL_CHILD_CREATED', 'LOCAL_ABOUT_FIELDS_MATCH', 'LOCAL_CHILD_SELECTED', 'WORRY_STEP_VISIBLE', 'CREATED_CHILD_NARRATION_SCOPE'],
  'about-back-retained': ['REAL_BACK_TO_ABOUT', 'FORM_VALUES_RETAINED', 'SAME_CHILD_NO_DUPLICATE'],
  'worry-repeat-same-child': ['SAME_CHILD_NO_DUPLICATE', 'WORRY_STEP_VISIBLE', 'NOTHING_SELECTION_CHECK_VISIBLE'],
  'worry-moving-selected': ['AREA_SELECTED_BY_REAL_KEYBOARD', 'MOVING_SELECTION_CHECK_VISIBLE', 'NOTHING_DESELECTED'],
  'neutral-card': ['AREA_SELECTED_BY_REAL_KEYBOARD', 'NEUTRAL_NOTICE_EXACT', 'NOTICING_CTA_EXACT', 'LOCAL_DRAFT_CHECKPOINTED', 'PRIMARY_ACTION_REACHABLE'],
  'worry-card-back': ['REAL_BACK_TO_WORRY', 'CHOICE_RETAINED', 'SAME_CHILD_NO_DUPLICATE'],
  'neutral-checkpoint-reload': ['RELOAD_RESUMES_LOCAL_STEP_THREE', 'NEUTRAL_NOTICE_EXACT', 'NOTICING_CTA_EXACT', 'SAME_CHILD_NO_DUPLICATE'],
  'hard-moment-card': ['HARD_MOMENT_GUIDE_VISIBLE', 'HARD_MOMENT_CTA_UNCHANGED', 'NO_ACTION_ACCEPTED'],
  'urgent-card': ['EXISTING_URGENT_SUPPORT_VISIBLE', 'EXISTING_URGENT_PHONE_TARGETS', 'NO_ACTION_ACCEPTED'],
  'talking-say-back-card': ['NEUTRAL_NOTICE_EXACT', 'FULL_SAY_BACK_VISIBLE', 'NOTICING_CTA_EXACT', 'SAME_CHILD_NO_DUPLICATE'],
  'local-completion-repeat': ['LOCAL_COMPLETION_RECORDED', 'ONE_ACCEPTED_ACTION_EXACT', 'OBSERVATION_ACCEPTED_WITHOUT_EFFICACY', 'NOTICING_CTA_EXACT', 'REPEAT_DID_NOT_DUPLICATE', 'FORCED_PREVIEW_STILL_MOUNTED'],
  'explicit-preview-exit-now': ['EXPLICIT_PREVIEW_REMOVAL', 'ACTUAL_NOW_DESTINATION', 'ACCEPTED_STEP_VISIBLE', 'SAME_CHILD_NO_DUPLICATE'],
  'browser-back-preview': ['REAL_BROWSER_BACK', 'COMPLETED_CHILD_NOT_REOPENED', 'SAME_CHILD_NO_DUPLICATE'],
  'browser-forward-now': ['REAL_BROWSER_FORWARD', 'ACTUAL_NOW_DESTINATION', 'ACCEPTED_STEP_VISIBLE', 'SAME_CHILD_NO_DUPLICATE'],
  'observation-blank': ['FULL_QUESTION_AND_DETAILS_VISIBLE', 'OBSERVATION_PURPOSE_EXACT', 'BLANK_SUBMISSION_DISABLED', 'ONE_OBSERVATION_MODULE_AND_PRIMARY', 'NO_EFFICACY_CONTROLS', 'NO_PREMATURE_RECEIPT'],
  'observation-urgent-text': ['EXISTING_OBSERVATION_URGENT_SUPPORT_VISIBLE', 'EXISTING_URGENT_PHONE_TARGETS', 'NO_PREMATURE_RECEIPT', 'NO_OBSERVATION_SAVED'],
  'observation-multiline': ['FULL_QUESTION_AND_DETAILS_VISIBLE', 'MULTILINE_WORDS_RETAINED', 'REAL_TAB_REACHES_SAVE', 'OBSERVATION_SAVE_REACHABLE', 'ONE_OBSERVATION_MODULE_AND_PRIMARY', 'NO_EFFICACY_CONTROLS', 'NO_PREMATURE_RECEIPT'],
  'observation-local-receipt': ['LOCAL_HANDLER_RECEIPT_ONLY', 'EXACT_COMPLETED_OBSERVATION', 'FULL_QUESTION_AND_DETAILS_VISIBLE', 'SAVED_WORDS_VISIBLE', 'ONE_OBSERVATION_MODULE_AND_PRIMARY', 'ONE_RECEIPT', 'NO_EFFICACY_CONTROLS', 'OPEN_RECORD_REACHABLE'],
  'observation-history-row': ['EXACT_HISTORY_ROUTE_AND_ROW', 'FACTUAL_OBSERVATION_HISTORY_TITLE', 'HISTORY_RECORD_UNCHANGED', 'NO_HISTORY_EFFICACY_OR_DURATION'],
  'observation-history-details': ['FULL_HISTORY_QUESTION_AND_WORDS_VISIBLE', 'HISTORY_SEPARATE_ATTRIBUTION', 'HISTORY_RAW_TEXT_WHITESPACE', 'NO_HISTORY_EFFICACY_OR_DURATION', 'REAL_ROW_OPENED_DETAILS'],
  'observation-details-close': ['REAL_DETAILS_CLOSE', 'FOCUS_RESTORED_TO_EXACT_ROW', 'HISTORY_RECORD_UNCHANGED'],
  'observation-completed-reload': ['COMPLETED_ROW_SURVIVES_RELOAD', 'NO_REPEATED_OBSERVATION_TASK', 'NO_STALE_RECEIPT', 'SAME_CHILD_NO_DUPLICATE'],
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
    && cell?.assertions?.every(row => row.passed === true)
    && cell?.fixture === 'existing-dev-onboarding-preview'
    && cell?.firstRunPreview?.productionGateVerified === false && cell?.firstRunPreview?.remoteAcknowledgementVerified === false
    && cell?.firstRunPreview?.auth === FIRST_RUN_PREVIEW_BOUNDARY.auth
    && cell?.firstRunPreview?.observationReceipt === FIRST_RUN_PREVIEW_BOUNDARY.observationReceipt
    && cell?.frames?.length > 0 && cell.frames.every(frame => frame.ready === true)
    && validFirstRunNetworkEvidence(cell?.networkEvidence);
}
export function validFirstRunNetworkEvidence(evidence) {
  return evidence?.firstRunDeniedWrites === 0 && evidence?.mockRequests === 0 && evidence?.deniedExternal === 0 && evidence?.deniedActions === 0
    && Number.isInteger(evidence?.firstRunNarrationRefusals) && evidence.firstRunNarrationRefusals >= 0
    && validFirstRunRefusalAccounting(evidence);
}
function validFirstRunRefusalAccounting(evidence) {
  const stats = evidence.firstRunRequestDiagnostics;
  const key = 'POST:CREATED_CHILD_BOOK_NARRATION:synthetic-409-refusal';
  return !!stats?.counts && Object.keys(stats.counts).every(name => name === key)
    && (stats.counts[key] ?? 0) === evidence.firstRunNarrationRefusals
    && Array.isArray(stats.recent) && stats.recent.length === Math.min(evidence.firstRunNarrationRefusals, 8)
    && stats.recent.every(row => Object.keys(row).length === 3 && row.method === 'POST' && row.category === 'CREATED_CHILD_BOOK_NARRATION' && row.disposition === 'synthetic-409-refusal');
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
  const quote = lang === 'he' ? 'כדור' : 'ball';
  const sayBack = lang === 'he' ? `אמרו את זה בחזרה והוסיפו עוד משהו: כן, ${quote}! איזה ${quote} יפה.` : `Say it back and add one: Yes, ${quote}! What a lovely ${quote}.`;
  const neutral = lang === 'he' ? `מה קרה היום עם ${name}?` : `What happened with ${name} today?`;
  return { name, quote, sayBack, recommendation: `${neutral}\n${sayBack}`,
    words: lang === 'he' ? 'הוא אמר כדור.\nואז גלגל אותו אליי.' : 'He said ball.\nThen rolled it to me.',
    notice: lang === 'he' ? 'נשים לב לרגע אחד היום' : "I'll notice a moment today",
    keep: lang === 'he' ? 'לשמור את הרגע' : 'Keep this moment',
    receipt: lang === 'he' ? 'הרגע נשמר ברשומות שלכם.' : 'Moment kept in your record.',
    open: lang === 'he' ? 'לפתוח את הרשומות' : 'Open record',
    purpose: lang === 'he' ? 'כתבו רגע אחד ששמתם לב אליו. המילים שלכם יישמרו לצד השאלה ברשומות שלכם.' : 'Write one moment you noticed. Your words will stay with this question in your record.',
    chosen: lang === 'he' ? 'השאלה שבחרתם' : 'The question you chose',
    answer: lang === 'he' ? 'מה שמתם לב אליו' : 'What you noticed',
    suggested: lang === 'he' ? 'הניסוח הוצע על ידי Arbor' : 'Wording suggested by Arbor',
    parentAuthor: lang === 'he' ? 'אתם' : 'You',
    history: lang === 'he' ? 'תיעדתם את מה ששמתם לב אליו' : 'You recorded what you noticed',
    try: lang === 'he' ? 'ננסה את זה היום' : "I'll try it today",
    about: lang === 'he' ? 'קצת על הילד או הילדה' : 'About your child', neutral: lang === 'he' ? `מה קרה היום עם ${name}?` : `What happened with ${name} today?` };
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
