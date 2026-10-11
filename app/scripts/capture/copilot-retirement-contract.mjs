/** Pure, bounded retirement evidence. No app, browser, provider or network imports. */
export const COPILOT_RETIREMENT_NOW = '2026-10-10T09:00:00.000Z';
export const COPILOT_RETIREMENT_EXPIRED = '2026-10-12T09:00:00.000Z';
export const COPILOT_RETIREMENT_ASSERTIONS = Object.freeze({
  'legacy-arrival': ['LEGACY_HASH_REPLACED', 'SINGLE_SUPPORTED_RECORD'],
  'stored-arrival': ['STORED_COPILOT_CORRECTED', 'SINGLE_SUPPORTED_RECORD'],
  'alias-full-picture': ['FULL_PICTURE_ALIAS_REPLACED', 'SINGLE_SUPPORTED_RECORD'],
  'alias-dashboard': ['DASHBOARD_ALIAS_REPLACED', 'SINGLE_SUPPORTED_RECORD'],
  'uppercase-trailing': ['UPPERCASE_TRAILING_REPLACED', 'SINGLE_SUPPORTED_RECORD'],
  'query-arrival': ['LEGACY_QUERY_BYTES_PRESERVED', 'SINGLE_SUPPORTED_RECORD'],
  'reload-arrival': ['REAL_RELOAD_STAYS_RECORD', 'SINGLE_SUPPORTED_RECORD'],
  'back-forward': ['ACTUAL_BACK_FORWARD_RETIRES_LEGACY', 'SINGLE_SUPPORTED_RECORD'],
  'consult-closed': ['SECONDARY_SUMMARY_AFTER_PACKET_CLOSED', 'ONE_CONSULT_PRIMARY'],
  'consult-open-pointer': ['POINTER_OPENS_EXACT_PREVIEW', 'ENGLISH_LTR_PREVIEW'],
  'consult-open-keyboard': ['KEYBOARD_OPENS_EXACT_PREVIEW', 'ENGLISH_LTR_PREVIEW'],
  'consult-copy': ['EXACT_SYNTHETIC_CLIPBOARD_PAYLOAD', 'STREAK_EXPORT_ONLY'],
  'consult-close-reopen': ['REAL_DISCLOSURE_CLOSE_REOPEN', 'NO_IMPLICIT_COPY'],
  'consult-teacher': ['TEACHER_REMOVES_SUMMARY', 'RETIRED_COPY_ELEMENT_UNCLICKABLE'],
  'consult-clinician-return': ['CLINICIAN_RETURN_CLOSED', 'NO_AUDIENCE_CHANGE_COPY'],
  'consult-blocked': ['FORBIDDEN_SOURCE_BLOCKS_PREVIEW_AND_COPY', 'NO_BLOCKED_COPY'],
  'consult-recovered': ['FRESH_SAFE_SOURCE_RECOVERS', 'EXACT_RECOVERED_COPY'],
  'consult-source-retired': ['SAME_DOCUMENT_SOURCE_CHANGE_BLOCKS_COPY', 'VISIBLE_OLD_PREVIEW_NOT_EGRESS_PROOF'],
  'consult-source-fresh': ['FRESH_READ_USES_CHANGED_SOURCE', 'EXACT_CHANGED_SOURCE_COPY'],
  'consult-current-child': ['ACTUAL_CHILD_SWITCH_RETIRES_COPY', 'EXACT_CURRENT_CHILD_COPY'],
  'consult-target-current': ['REAL_TARGET_SUMMARY_CURRENT', 'EXACT_TARGET_COPY'],
  'consult-target-expired': ['TARGET_EXPIRY_HIDES_AND_INERTS_SUMMARY', 'EXPIRED_COPY_ELEMENT_UNCLICKABLE'],
  'consult-target-recovered': ['TARGET_RECOVERY_FRESH_COPY', 'TARGET_RECOVERY_NO_IMPLICIT_COPY'],
  'consult-target-replaced': ['MISSING_REPLACEMENT_TARGET_BLOCKED', 'REPLACED_COPY_ELEMENT_UNCLICKABLE'],
  'consult-away-return': ['NAVIGATION_RETURN_SUMMARY_CLOSED', 'OLD_ROUTE_COPY_ELEMENT_RETIRED'],
  'history-valid': ['EXACT_SAVED_NUMERATORS_AND_DATES', 'NO_HISTORY_GRADE_OR_DENOMINATOR'],
  'history-missing': ['MISSING_COUNTS_REMAIN_UNKNOWN', 'NO_CURRENT_COUNT_FALLBACK'],
  'history-empty': ['CONFIRMED_EMPTY_HISTORY_EXPLICIT', 'NO_FABRICATED_HISTORY_ROWS'],
  'history-child-switch': ['ACTUAL_CHILD_SWITCH_RETIRES_HISTORY', 'SIBLING_SAVED_COUNT_ONLY'],
  'history-tabs-reachable': ['ALL_FOUR_EXISTING_TABS_REACHABLE', 'HISTORY_STORAGE_UNCHANGED'],
});
export const COPILOT_RETIREMENT_STATES = Object.freeze(Object.keys(COPILOT_RETIREMENT_ASSERTIONS).map(state => ({ route: state.startsWith('consult-') ? 'consult' : 'development', state })));
export const COPILOT_RETIREMENT_LIMITATIONS = Object.freeze([
  { state: 'remote-source-loading-cache-pending-error', status: 'source-tests-only', reason: 'The existing local collection adapter acknowledges synchronous reads and maps absent/malformed local values to empty. It cannot model Firestore metadata, sustained loading or read error. No auth, hooks, confirmation flags or DOM are replaced.' },
  { state: 'history-loading-cache-error', status: 'unmodelled-existing-fixture', reason: 'Valid, missing-count, confirmed-empty and child-switch history are rendered. Remote loading/cache/error remain accepted offline tests; a local malformed read or quota error is not represented as listener-error evidence.' },
  { state: 'authenticated-owner-retirement', status: 'source-tests-only', reason: 'No real user authentication or account switching. The unchanged sandbox owner is not proof of Firebase owner transitions.' },
  { state: 'pre-render-held-callbacks', status: 'source-tests-only', reason: 'Real pointer/keyboard activation and old DOM handle rejection are captured. No React callbacks are extracted or fabricated. Pre-render receipt races remain offline callback-test evidence.' },
  { state: 'target-retirement', status: 'synthetic-date-and-hash-only', reason: 'Actual targeted Consult is expired/recovered through the existing Date-only fixture and hash query; source receipt loss is not fabricated.' },
  { state: 'clipboard', status: 'synthetic-browser-sink-only', reason: 'The actual Copy button reaches a bounded text sink installed only at navigator.clipboard.writeText. No OS clipboard permission or third-party sharing is granted.' },
]);

export function copilotRetirementFixture(bundle, lang) {
  const parsed = JSON.parse(typeof bundle === 'string' ? bundle : JSON.stringify(bundle));
  const body = parsed?.locales?.[lang] ?? parsed;
  if (!['en', 'he'].includes(lang) || parsed?.parent?.demo !== true || body?.child?.demo !== true || !Array.isArray(body.collections?.milestones)) throw new Error('SYNTHETIC_COPILOT_FIXTURE_REQUIRED');
  const he = lang === 'he';
  const child = { ...body.child, id: 'capture-copilot-a', name: he ? 'נועה' : 'Noa', age: 4, ageMonths: 48, ageMonthsAsOf: '2026-10-10', birthDate: '2022-10-10', demo: true };
  delete child.birthMonth; delete child.preterm; delete child.avatar; delete child.photoUrl;
  const sibling = { ...child, id: 'capture-copilot-b', name: he ? 'מירה' : 'Mira' };
  const milestone = { id: 'capture-copilot-milestone', custom: true, ageMonths: 48, checked: true, observationStatus: 'yes', observedAt: COPILOT_RETIREMENT_NOW, domain: 'language_communication', title: he ? 'בחרנו ספר יחד' : 'We chose a book together', description: '', icon: 'chat' };
  const speech = result => ({ id: `capture-speech-${result}`, sound: 's', level: 'word', result, timestamp: '2026-10-09T09:00:00.000Z' });
  const collections = {
    ...Object.fromEntries(Object.keys(body.collections).map(key => [key, []])),
    milestones: [milestone], behaviorLogs: [], speechAttempts: [speech('got'), speech('missed')],
    mimicSessions: [{ id: 'capture-mimic', timestamp: '2026-10-09T09:00:00.000Z' }],
    missionRecords: [0, 1].map((day, index) => ({ id: `capture-mission-${index}`, date: `2026-10-${String(10 - day).padStart(2, '0')}`, timestamp: `2026-10-${String(10 - day).padStart(2, '0')}T09:00:00.000Z`, completed: true, domain: 'language' })),
    adventureResults: [0, 1].map(index => ({ id: `capture-story-${index}`, timestamp: '2026-10-09T09:00:00.000Z' })),
    practiceEvents: [{ id: 'capture-event', kind: 'vocab-naming', domain: 'language', timestamp: '2026-10-09T09:00:00.000Z' }],
    screenings: [{ id: 'capture-screen', answeredAt: COPILOT_RETIREMENT_NOW, watchAreas: [{ domain: 'language_communication' }] }],
    bandSnapshots: [
      { id: '2026-W40', date: '2026-10-05', bands: [{ domain: 'language', reached: 17, total: 2, band: 'strong', signal: 99 }, { domain: 'social', reached: 0, total: 7, band: 'emerging', signal: 0 }] },
      { id: '2026-W39', date: '2026-09-28', bands: [{ domain: 'language', reached: 3, total: 80, band: 'developing', signal: 44 }] },
    ],
    appointments: [], apptFollowUps: [], programs: [], familyGoals: [],
  };
  const siblingCollections = { ...structuredClone(collections), speechAttempts: [], mimicSessions: [], missionRecords: [], adventureResults: [], practiceEvents: [], screenings: [], bandSnapshots: [{ id: '2026-W38', date: '2026-09-21', bands: [{ domain: 'language', reached: 9 }] }] };
  body.child = child; body.collections = collections; body.siblings = [{ child: sibling, collections: siblingCollections }];
  const visit = { id: 'capture-copilot-visit', who: '', profession: 'slp', when: '', whenIso: '2026-10-11T09:00:00.000Z', mode: 'In person', status: 'confirmed' };
  return { parsed, child, sibling, childId: child.id, siblingId: sibling.id, collections, siblingCollections, visit, lang };
}

/** Exact expected synthetic text; offline tests compare this to the production
 * builder + derivations, so browser evidence cannot accept its own observed text. */
export function expectedCopilotSummary(fixture, { sibling = false, changed = false, preview = false } = {}) {
  const child = sibling ? fixture.sibling : fixture.child;
  const lines = [
    `ARBOR PRACTICE SUMMARY — ${child.name}, age 4 years`,
    'Generated 2026-10-10 · Parent-collected observational data · NOT a diagnostic assessment', '',
    'Domain picture (milestone checklist + home practice signal):',
    `  • Talking & understanding: 1 of 1 milestones noticed by parent (home-practice signal; basis: milestone checklist${sibling ? '' : ', daily missions'})`, '',
    `Home practice, last 7 days: ${sibling ? 0 : changed ? 9 : 8} interactions on ${sibling ? 0 : 2} days across ${sibling ? 0 : 2} of 8 domains.${preview ? '' : ` Streak: ${sibling ? 0 : 2} days.`}`,
  ];
  if (!sibling) lines.push('', 'Articulation practice (parent/auto-scored at home):', '  • /s/ — 2 attempts, about 1 of the last 2 landed (parent/auto-scored, not a normed measure), highest level: word', '', `Story play: ${changed ? 3 : 2} story scenes played.`, '', 'Non-diagnostic patterns worth a conversation:', '  • Talking & understanding: 1 contributing observation; evidence: From your latest Development Check');
  return lines.join('\n');
}

export function installCopilotClipboardSink() {
  const sink = { kind: 'synthetic-copilot-clipboard-only', calls: [] };
  Object.defineProperty(window, '__arborCopilotClipboard', { configurable: true, value: sink });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
    if (typeof text !== 'string' || text.length > 20_000 || sink.calls.length >= 30) throw new Error('COPILOT_CLIPBOARD_BOUND_EXCEEDED');
    sink.calls.push(text);
  } } });
}
/** Target identity is in the visit H1 when the selected audience matches. */
export function validCopilotTargetHeading(receipt, lang) {
  if (!['en', 'he'].includes(lang)) return false;
  const plain = text => typeof text === 'string' ? text.replace(/[\u2066-\u2069]/g, '').trim() : '';
  const date = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(new Date('2026-10-11T09:00:00.000Z'));
  const expected = lang === 'he' ? `מתכוננים לפגישה עם קלינאי/ת תקשורת ב־${date}` : `Prepare for Speech therapist on ${date}`;
  return receipt?.appointment === 'capture-copilot-visit' && receipt?.selectedSlp === true
    && receipt?.unavailableCount === 0 && receipt?.secondaryLineCount === 0 && plain(receipt?.heading) === expected;
}
export function validCopilotNetwork(network) {
  return !!network && network.deniedActions === 0 && network.deniedExternal === 0 && network.copilotDenied === 0
    && network.privateExportAuthHeaders === 0 && network.privateExportHeaderChecks > 0
    && network.privateExportHeaderReadsPending === 0 && network.privateExportHeaderReadFailures === 0;
}
export function copilotApiDisposition(method, pathname) {
  if (method === 'POST' && ['/api/todays-focus', '/api/digest'].includes(pathname)) return 'read';
  if (!['GET', 'HEAD'].includes(method)) return 'deny';
  if (/^\/api\/(?:auth|privacy|export|billing)(?:\/|$)|\/book-assets(?:\/|$)/.test(pathname)) return 'deny';
  return 'read';
}
export function copilotRequiredAssertions(state) {
  const unique = COPILOT_RETIREMENT_ASSERTIONS[state];
  return unique ? [...unique, 'ROOT_LOCALE_DIRECTION', 'NO_HORIZONTAL_OVERFLOW', 'CONTROL_REACHABLE_44PX', 'NO_RUNTIME_ERRORS', 'FINAL_COPILOT_NETWORK_GUARD'] : [];
}
export function validCopilotRetirementCell(cell) {
  const required = copilotRequiredAssertions(cell?.state);
  const copyStates = ['consult-copy', 'consult-recovered', 'consult-source-fresh', 'consult-current-child', 'consult-target-current', 'consult-target-recovered'];
  const expected = expectedCopilotSummary({ child: { name: cell?.lang === 'he' ? 'נועה' : 'Noa' }, sibling: { name: cell?.lang === 'he' ? 'מירה' : 'Mira' } }, { sibling: cell?.state === 'consult-current-child', changed: cell?.state === 'consult-source-fresh' });
  const copy = cell?.clipboardEvidence;
  const exactCopy = !copyStates.includes(cell?.state) || (copy?.syntheticOnly === true && Number.isInteger(copy.before) && copy.before >= 0 && copy.after === copy.before + 1 && copy.actual === expected && copy.expected === expected);
  return (cell?.state !== 'consult-target-current' || validCopilotTargetHeading(cell?.targetEvidence, cell?.lang)) && exactCopy && required.length > 0 && required.every(id => cell?.assertions?.some(assertion => assertion.id === id && assertion.passed === true))
    && validCopilotNetwork(cell?.networkEvidence) && cell?.frame?.ready === true
    && cell?.controlFrame?.reachable === true && cell?.controlFrame?.width >= 44 && cell?.controlFrame?.height >= 44
    && cell?.rootDirection === (cell?.lang === 'he' ? 'rtl' : 'ltr')
    && Array.isArray(cell?.runtimeDiagnostics?.recent) && Object.keys(cell?.runtimeDiagnostics?.counts ?? {}).every(key => key === 'SERVICE_WORKER_BLOCKED');
}
