/** Release-only interaction evidence. Importing this module launches nothing.
 * Browser execution is allowed only inside the dedicated network-none runtime.
 * Fixtures enter the existing storage/API seams; DOM and application code are
 * never replaced. A fixture screenshot proves renderer behavior, not a provider.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { BASE, assertLoopbackOnly, captureRevision } from './config.mjs';
import { REPORT_CAPTURE_STATES, collectReportStates } from './release-report-states.mjs';
import { scrollConversationTranscript, checkConversationFrame } from './conversation-frame.mjs';
import { SMALL_FIXTURE, initializeSyntheticOnline } from './small-state.mjs';
import { createRuntimeDiagnostics, createAssetDiagnostics } from './runtime-diagnostics.mjs';
import { installStylesheetObservation, observeAskDependency, observeReactStage, observeCurrentRetryCache, collectNativeDispatch } from './readiness-probes.mjs';
export { classifyReleaseConsole, sanitizedReleaseLocation } from './runtime-diagnostics.mjs';
import { observeTogetherGeometry, togetherLayoutGeometry, togetherScrollStable } from './together-geometry.mjs';
import { SOURCE_FONT_NOTE, captureFontContextOptions, installOfflineFonts, captureScreenshot } from './font-runtime.mjs';
import { RECORD_STATES, RECORD_LIMITATIONS, recordFixture, installRecordShareSink } from './record-contract.mjs';
import { collectRecordStates } from './record-states.mjs';
import { collectBehaviorRecordStates } from './record-behaviors.mjs';
import { CONFIRMED_ACTION_STATES, CONFIRMED_ACTION_LIMITATIONS, confirmedActionsFixture } from './confirmed-actions-contract.mjs';
import { collectConfirmedActionStates } from './confirmed-actions-states.mjs';
import { KEPT_SEARCH_STATES, KEPT_SEARCH_LIMITATIONS, keptSearchFixture } from './kept-search-contract.mjs';
import { collectKeptSearchStates } from './kept-search-states.mjs';
import { collectPracticeStates, PRACTICE_FIXTURE, practiceClockScript } from './practice-states.mjs';
import { KID_ENTRY_STATES, KID_ENTRY_LIMITATIONS, kidEntryFixture, kidEntryApiDisposition, validKidEntryCell } from './kid-entry-contract.mjs';
import { collectKidEntryStates } from './kid-entry-states.mjs';
import { FIRST_RUN_PREVIEW_STATES, FIRST_RUN_PREVIEW_BOUNDARY, FIRST_RUN_PREVIEW_LIMITATIONS, firstRunPreviewApiDisposition, firstRunPreviewPrimaryShot, validFirstRunPreviewCell } from './first-run-preview-contract.mjs';
import { collectFirstRunPreviewStates } from './first-run-preview-states.mjs';
import { installFirstRunPreviewBoundary, isCaptureDemoFamilyUrl } from './first-run-preview-network.mjs';

const rows = (route, states) => states.map(state => ({ route, state }));
export const RELEASE_INTERACTION_STATES = Object.freeze({
  record: RECORD_STATES,
  'kept-search': KEPT_SEARCH_STATES,
  'kid-entry': KID_ENTRY_STATES,
  'first-run-preview': FIRST_RUN_PREVIEW_STATES,
  'confirmed-actions': CONFIRMED_ACTION_STATES,
  navigation: [
    ...rows('shell', ['keep-closed', 'keep-open', 'keep-toggle-closed', 'keep-escape', 'keep-write', 'keep-close-focus']),
    ...rows('overview', ['practice-compact', 'practice-details', 'practice-outcome', 'practice-undo', 'now-scroll-initial', 'now-scroll-middle', 'now-bottom-reachable']),
    ...rows('practice', ['together-first-ready', 'together-settled', 'together-dock-open', 'together-dock-settled', 'together-dock-closed', 'together-return-card', 'together-early-back', 'together-how-to-begin', 'together-bottom-reachable']),
    ...['milestones', 'daily-play'].flatMap(route => rows(route, ['initial', 'middle', 'last-action'].map(position => `${route}-scroll-${position}`))),
    ...rows('development', ['scroll-route-reset']),
    ...rows('timeline', ['recordnav-initial', 'recordnav-scrolled']),
    ...rows('shell', ['more-records', 'more-profile-current', 'more-memory-current']).map(item => ({ ...item, mobileOnly: true })),
    ...rows('profile', ['record-profile']), ...rows('memory', ['record-memory']),
    ...rows('development', ['watch-chosen', 'watch-cleared', 'watch-undo']),
  ],
  ask: [
    ...rows('coach', ['direct-composer', 'direct-mock-answer']),
    ...rows('shell', ['tools-closed', 'tools-open', 'tools-escape', 'consent-review', 'consent-read-error', 'consent-read-retry', 'consent-grant-error', 'consent-draft-return', 'ask-error-generic', 'ask-error-quota', 'ask-mock-answer']),
    ...rows('shell', REPORT_CAPTURE_STATES),
  ],
  'report-close-only': rows('shell', ['report-text-only', 'report-close-return']),
  'ask-diagnostic': [...rows('shell', ['launcher-composer', 'ask-mock-answer']), ...rows('coach', ['direct-composer', 'direct-mock-answer'])],
});

export function expectedReleaseInteractionStates(group, viewport) {
  if (group === 'focused') return ['navigation', 'ask'].flatMap(part => expectedReleaseInteractionStates(part, viewport));
  if (!Object.hasOwn(RELEASE_INTERACTION_STATES, group)) throw new Error('RELEASE_GROUP_INVALID');
  if (!viewport || !['375x812', '1280x800'].includes(`${viewport.w}x${viewport.h}`) || !['en', 'he'].includes(viewport.lang)) throw new Error('RELEASE_VIEWPORT_INVALID');
  return RELEASE_INTERACTION_STATES[group].filter(item => !item.mobileOnly || viewport.w < 1024).map(({ route, state }) => ({ route, state, group }));
}

/** Neither a failure PNG nor a reached flag without successful assertions is a pass. */
export function missingReleaseInteractionEvidence(cells, { group, viewport, sourceSha, sourceTreeSha }) {
  return expectedReleaseInteractionStates(group, viewport).flatMap(({ route, state, group: part }) => {
    const cell = cells.find(item => item.route === route && item.state === state && item.group === part && item.lang === viewport.lang && item.viewport === `${viewport.w}x${viewport.h}` && item.sourceSha === sourceSha && (!sourceTreeSha || item.sourceTreeSha === sourceTreeSha));
    const valid = (part !== 'first-run-preview' || validFirstRunPreviewCell(cell)) && (part !== 'kid-entry' || validKidEntryCell(cell)) && cell?.reached === true && typeof cell.shot === 'string' && cell.shot.startsWith('shots/') && cell.assertions?.length > 0 && cell.assertions.every(assertion => assertion.passed === true) && Array.isArray(cell.failures) && cell.failures.length === 0;
    return valid ? [] : [{ route, state, group: part, lang: viewport.lang, viewport: `${viewport.w}x${viewport.h}`, failure: cell?.failures?.[0] ?? (cell ? 'INCOMPLETE_ASSERTIONS_OR_SCREENSHOT' : 'NOT_ATTEMPTED') }];
  });
}

export function geometryStable(before, after, tolerance = 2) {
  return !!before && !!after && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(before[key]) && Number.isFinite(after[key]) && Math.abs(before[key] - after[key]) <= tolerance);
}

/** Clip to the real scrollport: a Back link above it is not visually overlapping. */
export function clippedOverlap(a, b, clip) {
  if (![a, b, clip].every(rect => rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key])))) return null;
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width, clip.x + clip.width) - Math.max(a.x, b.x, clip.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height, clip.y + clip.height) - Math.max(a.y, b.y, clip.y));
  return width * height;
}

export function releaseFixture(bundle, lang) {
  const parsed = typeof bundle === 'string' ? JSON.parse(bundle) : bundle;
  const body = parsed?.locales?.[lang] ?? parsed;
  if (parsed?.parent?.demo !== true || body?.child?.demo !== true || typeof body.child.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.child.id) || !Array.isArray(body.collections?.milestones)) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
  const watch = body.collections.milestones.find(item => !item.checked && typeof item.id === 'string');
  return { parsed, childId: body.child.id, watch: watch ? { milestoneId: watch.id, screenItemId: 'release-synthetic-watch', chosenAt: '2026-10-09T12:00:00.000Z' } : null };
}

/** Bounded bilingual presentation fixture, independent of provider/server claims. */
export function syntheticReleaseReport(lang) {
  const he = lang === 'he';
  const choose = (en, hebrew) => he ? hebrew : en;
  const contract = {
    text: choose('This is an invented capture example about choosing a book together. A short, predictable invitation gives you something simple to try.', 'זו דוגמה מומצאת לצילום על בחירת ספר יחד. הזמנה קצרה וצפויה מציעה משהו פשוט שאפשר לנסות.'),
    riskLevel: 'Low', ageBand: '3-4y', domains: ['language_communication'],
    nonDiagnosticHypotheses: [{ label: choose('A choice may help', 'בחירה יכולה לעזור'), confidence: 'one possibility', rationale: choose('The invented example describes a change from playing to reading.', 'הדוגמה המומצאת מתארת מעבר ממשחק לקריאה.') }],
    todayPlan: [choose('Put two familiar books within reach.', 'להניח שני ספרים מוכרים בהישג יד.'), choose('Let the child point to the book to read together.', 'לתת לילד לבחור בהצבעה את הספר לקריאה משותפת.')],
    parentScript: choose('Which book shall we read together?', 'איזה ספר נקרא יחד?'),
    observe: [choose('Notice which invitation the child responds to.', 'לשים לב לאיזו הזמנה הילד מגיב.')],
    avoid: [choose('Avoid turning the choice into a test.', 'להימנע מהפיכת הבחירה למבחן.')],
    escalateIf: [choose('If a concern continues, discuss your observations with your own professional.', 'אם הדאגה נמשכת, אפשר לשוחח על התצפיות עם איש המקצוע שלכם.')],
    frameRouting: { aim: '', twoAxes: '', story: '', shadow: '', marriage: '', shepherd: '' },
    memoryProposals: [], approvedMemoryFactsUsed: 0, handoffNotes: { teacher: '', professional: '' }, followUps: [],
    sourceCardsUsed: ['release-presentation-fixture'], sourceCards: [{ id: 'release-presentation-fixture', title: choose('Invented capture fixture; not an external source', 'דוגמה מומצאת לצילום; אינה מקור חיצוני'), type: 'practice_card' }],
    document: { documentType: choose('invented note', 'פתק מומצא'), keyPoints: [choose('The example suggests choosing between two books.', 'הדוגמה מציעה לבחור בין שני ספרים.')], questionsForProfessional: [choose('Would this invitation fit our routine?', 'האם ההזמנה הזו יכולה להתאים לשגרה שלנו?')], handoffNote: '', suggestedMemory: [] },
  };
  return { text: contract.text, contract, council: [{ scholarId: 'release-fixture', name: choose('Capture fixture', 'דוגמה לצילום'), concept: choose('Shared reading', 'קריאה משותפת'), takeaway: choose('Offer a small choice.', 'להציע בחירה קטנה.'), suggestion: choose('Keep the invitation short.', 'לשמור על הזמנה קצרה.') }] };
}

/** Exact read-only capability/owner-grant lists in the isolated mock server.
 * Every media or sharing mutation/subpath retains the strict action deny. */
export function deniedCaptureApiCategory(method, pathname) {
  if (method === 'GET' && pathname === '/api/tts') return null;
  if (method === 'GET' && pathname === '/api/shares') return null;
  for (const [category, pattern] of [
    ['LIVE', /^\/api\/live\//], ['VOICE', /^\/api\/voice(?:\/|$)/],
    ['TTS', /^\/api\/tts(?:\/|$)/], ['VISION', /^\/api\/vision(?:\/|$)/],
    ['SHARING', /^\/api\/shares?(?:\/|$)/], ['EXPORT', /^\/api\/export(?:\/|$)/],
    ['BILLING', /^\/api\/billing(?:\/|$)/], ['CONSENT', /^\/api\/consent(?:\/|$)/],
  ]) if (pattern.test(pathname)) return category;
  return null;
}

/** Click-time facts cannot be substituted with a sample taken before Playwright
 * actionability scrolling or animation waits. */
export function observedEarlyBackClick(evidence) {
  return evidence?.sampledAt === 'captured-click' && evidence.trusted === true && evidence.outgoingVisible === true && evidence.destinationVisible === false;
}
export function observedScrolledNavigationClick(evidence) {
  return evidence?.sampledAt === 'captured-click' && evidence.trusted === true && evidence.outsideMain === true && Number.isFinite(evidence.mainScrollTop) && evidence.mainScrollTop > 0;
}

const knownFailure = error => /^FONT_[A-Z_]+$/.test(error?.message ?? '') || ['DEPENDENT_STATE_UNREACHED', 'SYNTHETIC_WATCH_MILESTONE_MISSING'].includes(error?.message) ? error.message : error?.name === 'TimeoutError' ? 'SELECTOR_OR_ACTION_TIMEOUT' : 'INTERACTION_FAILED';

/** Only fixed enums survive; wrapped browser exception text is transient. */
export function sanitizedCollectorFailure(error) {
  const types = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'SecurityError', 'TimeoutError', 'DOMException'];
  const message = typeof error?.message === 'string' ? error.message : '';
  const wrapped = /\b(SecurityError|TypeError|ReferenceError|RangeError|SyntaxError):/.exec(message)?.[1];
  const errorType = wrapped ?? (types.includes(error?.name) ? error.name : 'OtherError');
  const code = errorType === 'SecurityError' && /\blocalStorage\b/.test(message) ? 'STORAGE_ACCESS_DENIED'
    : errorType === 'TimeoutError' ? 'SELECTOR_OR_ACTION_TIMEOUT' : 'COLLECTOR_ABORTED';
  return { errorType, code };
}

export async function collectReleaseInteractions({ output, bundle, viewport, group, sourceSha, sourceTreeSha, _priorCells = [], _reportGroup = group, _apiCache = new Map() }) {
  // Keep these guards inside the entry point so pure contracts can be tested
  // without importing Playwright, creating sockets or requiring a container.
  assertLoopbackOnly(networkInterfaces());
  if (process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('OFFLINE_CONTAINER_REQUIRED');
  captureRevision(sourceSha);
  if (sourceTreeSha) captureRevision(sourceTreeSha);
  const expectedStates = expectedReleaseInteractionStates(group, viewport);
  if (path.resolve(output) !== '/capture-output') throw new Error('RELEASE_OUTPUT_INVALID');
  if (process.env.ARBOR_CAPTURE_FONT_MODE !== 'exact') throw new Error('FONT_EXACT_REQUIRED');
  if (process.env.MODEL_PROVIDER !== 'mock' || process.env.MEMORY_ADAPTER !== 'local' || process.env.REQUIRE_AUTH !== 'false' || process.env.LIVE_ENABLED !== 'false') throw new Error('SANDBOX_ENVIRONMENT_REQUIRED');
  if (group === 'focused') {
    const navigation = await collectReleaseInteractions({ output, bundle, viewport, group: 'navigation', sourceSha, sourceTreeSha, _reportGroup: 'focused', _apiCache });
    return collectReleaseInteractions({ output, bundle, viewport, group: 'ask', sourceSha, sourceTreeSha, _priorCells: navigation.cells, _reportGroup: 'focused', _apiCache });
  }
  const firstRunPreview = group === 'first-run-preview';
  if (firstRunPreview && process.env.NODE_ENV !== 'development') throw new Error('FIRST_RUN_DEV_PREVIEW_REQUIRED');
  const record = group === 'record' ? recordFixture(bundle, viewport.lang) : null;
  const confirmed = group === 'confirmed-actions' ? confirmedActionsFixture(bundle, viewport.lang) : null;
  const keptSearch = group === 'kept-search' ? keptSearchFixture(bundle, viewport.lang) : null;
  const kidEntry = group === 'kid-entry' ? kidEntryFixture(bundle, viewport.lang) : null;
  const practiceCapture = group === 'navigation';
  const fixture = releaseFixture(keptSearch?.parsed ?? kidEntry?.parsed ?? confirmed?.parsed ?? record?.parsed ?? bundle, viewport.lang);
  const { lang } = viewport;
  const he = lang === 'he';
  const viewportId = `${viewport.w}x${viewport.h}`;
  mkdirSync(`${output}/shots`, { recursive: true });
  const doc = { schema: 1, scope: 'release-interactions', sourceSha, sourceTreeSha, group: _reportGroup, activeGroup: group, viewport: viewportId, lang, fixture: SMALL_FIXTURE, fontMode: 'exact', fontLimitation: SOURCE_FONT_NOTE, expectedStates: _reportGroup === group ? expectedStates : expectedReleaseInteractionStates(_reportGroup, viewport), completed: false, finished: false, cells: [..._priorCells], fixtures: ['synthetic-family', 'local-mock-server', 'synthetic-local-watch-choice', 'bounded-consent-error-responses', 'bounded-chat-error-responses', 'bilingual-report-presentation-fixture'] };
  const save = () => { doc.missingEvidence = missingReleaseInteractionEvidence(doc.cells, { group: _reportGroup, viewport, sourceSha, sourceTreeSha }); writeFileSync(`${output}/evidence.json`, JSON.stringify(doc, null, 2)); };
  if (firstRunPreview) { doc.scope = 'first-run-dev-preview'; doc.firstRunPreview = FIRST_RUN_PREVIEW_BOUNDARY; doc.firstRunPreviewBoundaries = FIRST_RUN_PREVIEW_LIMITATIONS; doc.fixtures = ['existing-dev-onboarding-preview', 'existing-seeded-synthetic-family', 'real-disposable-local-writes']; }
  if (record) {
    doc.recordBoundaries = RECORD_LIMITATIONS;
    doc.fixtures.push('synthetic-record-local-storage', 'synthetic-browser-share-sink');
    doc.recordFixture = { childId: record.childId, eligibleRows: record.expected.all, months: record.expected.months, sourceCollections: Object.keys(record.collections), negativeControls: record.text.forbidden.length };
  }
  if (confirmed) {
    doc.confirmedActionBoundaries = CONFIRMED_ACTION_LIMITATIONS;
    doc.fixtures.push('synthetic-confirmed-actions-local-storage', 'scoped-local-storage-quota-fault', 'synthetic-browser-share-sink', 'synthetic-Date-only-native-animation-time');
  }
  if (keptSearch) {
    doc.keptSearchBoundaries = KEPT_SEARCH_LIMITATIONS;
    doc.fixtures.push('preloaded-ai-draft-and-unverified-lineage-not-model-proof', 'synthetic-browser-share-sink', 'synthetic-Date-only-native-animation-time');
  }
  if (kidEntry) { doc.kidEntryBoundaries = KID_ENTRY_LIMITATIONS; doc.fixtures = ['synthetic-family', 'local-mock-server', 'synthetic-three-child-entry-profiles', 'synthetic-book-narration-refusal']; }
  if (practiceCapture) doc.fixtures.push(PRACTICE_FIXTURE, 'practice-only-Date-native-animation-time');
  save();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, locale: he ? 'he-IL' : 'en-US', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block', permissions: [], ...captureFontContextOptions() });
    let selectedReportFixture = null;
    const apiState = { consent: 'empty', chat: 'mock', mockRequests: 0, mockResponses: 0, fixtureRequests: 0, consentReads: 0, consentWrites: 0, deniedExternal: 0, deniedActions: 0, deniedActionCategories: {}, ttsCapabilityReads: 0, shareListReads: 0, apiCacheHits: 0, localRateLimits: 0 };
    if (firstRunPreview) apiState.firstRunDeniedWrites = 0;
    if (kidEntry) Object.assign(apiState, { kidEntryNarrationRefusals: 0, kidEntryDeniedMutations: 0 });
    await context.route('**/*', route => {
      if (Object.hasOwn(apiState, 'firstRunDeniedWrites') && !['GET', 'HEAD'].includes(route.request().method())) { apiState.firstRunDeniedWrites++; apiState.deniedActions++; return route.abort(); }
      if (new URL(route.request().url()).origin === BASE) return route.continue();
      apiState.deniedExternal++;
      return route.abort();
    });
    await context.routeWebSocket(() => true, socket => socket.close());
    await context.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== BASE) { apiState.deniedExternal++; return route.abort(); }
      if (firstRunPreview && firstRunPreviewApiDisposition(request.method(), url.pathname) === 'deny') { apiState.firstRunDeniedWrites++; apiState.deniedActions++; return route.abort(); }
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (kidEntry) {
        const disposition = kidEntryApiDisposition(request.method(), url.pathname, kidEntry.childIds);
        if (disposition === 'synthetic-narration-refusal') { apiState.kidEntryNarrationRefusals++; return json(409, { code: 'synthetic_capture_media_disabled' }); }
        if (disposition === 'deny') { apiState.kidEntryDeniedMutations++; apiState.deniedActions++; return route.abort(); }
      }
      if (url.pathname === '/api/live/availability') return json(200, { available: false });
      if (url.pathname === `/api/consent/${encodeURIComponent(fixture.childId)}` && request.method() === 'GET') {
        apiState.consentReads++;
        return apiState.consent === 'read-error' ? json(503, { error: 'Synthetic capture read failure' }) : json(200, { grants: [] });
      }
      if (url.pathname === '/api/consent' && request.method() === 'POST') {
        apiState.consentWrites++;
        // A real grant is never recorded, even if an unexpected UI path fires.
        return json(503, { error: 'Synthetic capture grant failure' });
      }
      if (url.pathname === '/api/chat' && request.method() === 'POST') {
        if (apiState.chat === 'mock') { apiState.mockRequests++; return route.continue(); }
        apiState.fixtureRequests++;
        if (apiState.chat === 'report') return json(200, selectedReportFixture ?? syntheticReleaseReport(lang));
        return route.fulfill({ status: apiState.chat === 'quota' ? 429 : 503, contentType: 'application/json', headers: { 'retry-after': '60' }, body: JSON.stringify({ error: 'Synthetic capture response failure' }) });
      }
      const denied = deniedCaptureApiCategory(request.method(), url.pathname);
      if (denied) { apiState.deniedActions++; apiState.deniedActionCategories[denied] = (apiState.deniedActionCategories[denied] ?? 0) + 1; return route.abort(); }
      if (request.method() === 'GET' && url.pathname === '/api/tts') apiState.ttsCapabilityReads++;
      if (request.method() === 'GET' && url.pathname === '/api/shares') apiState.shareListReads++;

      // The same safe read cache as the canonical sweep, shared across the
      // focused groups. Prevent the fixture's 30/min limiter from manufacturing
      // later UI failures; actual chat and consent requests above stay uncached.
      const cacheable = request.method() === 'GET' || (request.method() === 'POST' && ['/api/todays-focus', '/api/digest'].includes(url.pathname));
      if (cacheable) {
        const key = `${request.method()} ${url.href} ${request.postData() ?? ''}`;
        if (_apiCache.has(key)) { apiState.apiCacheHits++; return route.fulfill(_apiCache.get(key)); }
        try {
          const response = await route.fetch({ timeout: 15000 });
          if (response.status() === 429) apiState.localRateLimits++;
          const entry = { status: response.status(), headers: response.headers(), body: await response.body() };
          if (response.status() === 200) _apiCache.set(key, entry);
          return route.fulfill(entry);
        } catch { return route.abort().catch(() => {}); }
      }
      return route.continue();
    });
    await context.route(isCaptureDemoFamilyUrl, route => {
      if (Object.hasOwn(apiState, 'firstRunDeniedWrites') && !['GET', 'HEAD'].includes(route.request().method())) { apiState.firstRunDeniedWrites++; apiState.deniedActions++; return route.abort(); }
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.parsed) });
    });
    await installOfflineFonts(context);
    // Playwright runs matching routes in reverse registration order. This must
    // be last: safe same-origin reads fall back to the existing handlers.
    if (firstRunPreview) await installFirstRunPreviewBoundary(context, apiState);
    if (kidEntry) await context.addInitScript(initializeSyntheticOnline, { lang, preserveKidMode: true });
    else await context.addInitScript(initializeSyntheticOnline, { lang });
    if (practiceCapture) await context.addInitScript({ content: practiceClockScript(fixture.parsed) });
    if (record || confirmed || keptSearch) await context.addInitScript(installRecordShareSink);
    if (group === 'ask-diagnostic') await context.addInitScript(installStylesheetObservation);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const diagnostics = createRuntimeDiagnostics();
    const assets = createAssetDiagnostics();
    page.on('request', request => assets.request(request, request.url(), request.resourceType()));
    page.on('response', response => assets.response(response.request(), response.status(), response.headers()['content-type'] ?? ''));
    page.on('requestfinished', request => assets.finish(request));
    page.on('requestfailed', request => assets.finish(request, true));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.record(message.text(), message.location()); });
    page.on('pageerror', error => diagnostics.recordPageError(error));
    page.on('filechooser', () => { apiState.deniedActions++; });
    page.on('download', download => {
      if (record && apiState.expectedPrintDownload && download.url().startsWith(`blob:${BASE}/`) && /\.html$/.test(download.suggestedFilename())) { apiState.printDownloads = (apiState.printDownloads ?? 0) + 1; return; }
      apiState.deniedActions++; void download.cancel();
    });
    page.on('response', response => { const url = new URL(response.url()); if (apiState.chat === 'mock' && url.origin === BASE && url.pathname === '/api/chat' && response.ok()) apiState.mockResponses++; });
    const readinessSnapshot = () => page.evaluate(() => {
      const visible = selector => { const el = document.querySelector(selector); if (!el) return false; const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].flatMap(link => {
        try { const url = new URL(link.href); return url.origin === location.origin && /^\/assets\/[a-zA-Z0-9_.-]{1,150}\.css$/.test(url.pathname) ? [{ path: url.pathname, sheetReady: link.sheet !== null, disabled: link.disabled === true }] : []; } catch { return []; }
      }).slice(0, 100);
      return { visibility: document.visibilityState, readyState: document.readyState,
        conversationVisible: visible('.companion-conversation:not([hidden])'), suspenseFallbackVisible: visible('.companion-conversation .companion-loading'),
        composerVisible: visible('.companion-conversation [data-testid="companion-composer"]'), composerCount: document.querySelectorAll('[data-testid="companion-composer"]').length,
        errorBoundaryVisible: visible('.companion-conversation [role="alert"]'), stylesheets };
    });
    const byId = id => page.locator(`[data-testid="${id}"]`);
    const composer = () => page.locator('.companion-conversation:not([hidden]) [data-testid="companion-composer"]');
    const conversation = () => page.locator('.companion-conversation:not([hidden])');
    const fontReady = () => page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('FONT_READY_TIMEOUT')), 15000))]); });
    let entryMode = 'full-route-load';
    const load = async (route, { practiceFixture = false } = {}) => {
      entryMode = route === 'coach' ? 'direct-coach-route' : 'full-route-load';
      await page.goto(`${BASE}/?capture=release-${group}-${Date.now()}${practiceFixture ? '&capturePractice=1' : ''}#/${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator('main h1, main [data-module]').first().waitFor({ state: 'visible', timeout: 30000 });
      await fontReady();
    };
    const check = (cell, id, passed, observed) => { cell.assertions.push({ id, passed: passed === true, ...(observed === undefined ? {} : { observed }) }); if (!passed) cell.failures.push(id); };
    const visible = async (cell, id, locator) => { await locator.waitFor({ state: 'visible' }); check(cell, id, await locator.isVisible()); };
    const dependent = reached => { if (!reached) throw new Error('DEPENDENT_STATE_UNREACHED'); };
    const rect = async locator => { await fontReady(); return locator.boundingBox(); };
    const openConversation = async () => {
      if (!await conversation().isVisible()) { entryMode = 'launcher'; await byId('companion-launcher').locator('.companion-launch-main').click(); }
      await composer().locator('textarea').waitFor({ state: 'visible', timeout: 15000 });
    };
    const closeConversation = async () => { await conversation().locator('.companion-conversation-heading > button').last().click(); await byId('companion-launcher').waitFor({ state: 'visible' }); };
    const clickWithEvidence = async target => {
      // Observation only: no preventDefault, state mutation or synthetic event.
      await target.evaluate(el => {
        const state = { evidence: null, listener: null };
        state.listener = event => {
          if (!event.composedPath().includes(el)) return;
          const visible = selector => { const item = document.querySelector(selector); if (!item) return false; const box = item.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(item).visibility !== 'hidden'; };
          state.evidence = { sampledAt: 'captured-click', trusted: event.isTrusted, outsideMain: !el.closest('#main'), mainScrollTop: document.querySelector('#main')?.scrollTop ?? null,
            outgoingVisible: visible('[data-module="together-invitation"]'), destinationVisible: visible('[data-route="stories"] [data-module="stories-tonight"]') };
          document.removeEventListener('click', state.listener, true);
        };
        window.__arborCaptureClickObservation = state;
        document.addEventListener('click', state.listener, { capture: true, passive: true });
      });
      try {
        await target.click();
        return await page.evaluate(() => window.__arborCaptureClickObservation?.evidence ?? null);
      } finally {
        await page.evaluate(() => { const state = window.__arborCaptureClickObservation; if (state?.listener) document.removeEventListener('click', state.listener, true); delete window.__arborCaptureClickObservation; });
      }
    };
    const mainScrollFrame = async (cell, route, position = 'last-action') => {
      await load(route);
      await page.locator(`#main [data-route="${route}"]`).waitFor({ state: 'attached' });
      const result = await page.evaluate(async ({ route, position }) => {
        const main = document.querySelector('#main');
        const rail = document.querySelector('[data-testid="companion-launcher-rail"]');
        const content = main?.querySelector(`[data-route="${route}"]`);
        if (!main || !rail || !content) return { surfaceFound: false };
        const boxOf = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, top: b.top, bottom: b.bottom }; };
        const max = Math.max(0, main.scrollHeight - main.clientHeight);
        main.scrollTop = position === 'initial' ? 0 : position === 'middle' ? max / 2 : max;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const mainBox = boxOf(main), railBox = boxOf(rail);
        const nav = document.querySelector('.arbor-app > nav');
        const navBox = nav && nav.getBoundingClientRect().height > 0 ? boxOf(nav) : null;
        const workspace = main.closest('.companion-workspace');
        const reservedNavHeight = parseFloat(getComputedStyle(workspace).getPropertyValue('--companion-navigation-height')) || 0;
        const actions = [...content.querySelectorAll('button:not([disabled]), a[href], summary')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !el.closest('[hidden]'); });
        const inView = actions.filter(el => { const b = el.getBoundingClientRect(); return b.top >= mainBox.top && b.bottom <= mainBox.bottom; });
        const target = position === 'last-action' ? actions.at(-1) : inView[0];
        const targetBox = target ? boxOf(target) : null;
        const hit = targetBox ? document.elementFromPoint(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2) : null;
        return { surfaceFound: true, screenshotScope: 'main-scrollport-frame', position, main: mainBox, rail: railBox, nav: navBox, reservedNavHeight,
          scrollTop: main.scrollTop, scrollMax: max, windowScroll: window.scrollY, targetFound: !!target, target: targetBox,
          fullyAboveDock: !!targetBox && targetBox.top >= mainBox.top && targetBox.bottom <= Math.min(mainBox.bottom, railBox.top, navBox?.top ?? innerHeight),
          hitTarget: !!hit && (hit === target || target.contains(hit)) };
      }, { route, position });
      cell.scrollFrame = result;
      check(cell, 'MAIN_SCROLLPORT_AND_RAIL_FOUND', result.surfaceFound === true);
      check(cell, 'MAIN_ENDS_ABOVE_LAUNCHER_RAIL', result.surfaceFound && result.main.bottom <= result.rail.top + 1);
      check(cell, 'RAIL_ENDS_ABOVE_MOBILE_NAV', result.surfaceFound && (!result.nav || result.rail.bottom <= result.nav.top + 1));
      check(cell, 'MEASURED_NAV_HEIGHT_RESERVED', result.surfaceFound && (!result.nav || Math.abs(result.reservedNavHeight - result.nav.height) <= 1));
      check(cell, 'WINDOW_NOT_USED_AS_SCROLLPORT', result.windowScroll === 0);
      check(cell, 'REQUESTED_MAIN_SCROLL_POSITION', result.surfaceFound && Math.abs(result.scrollTop - (position === 'initial' ? 0 : position === 'middle' ? result.scrollMax / 2 : result.scrollMax)) <= 1);
      if (position === 'last-action') {
        check(cell, 'FINAL_ACTION_FOUND', result.targetFound === true);
        check(cell, 'FINAL_ACTION_VISIBLE_ABOVE_DOCK', result.fullyAboveDock === true);
        check(cell, 'FINAL_ACTION_NOT_OCCLUDED', result.hitTarget === true);
      }
    };
    const screen = async (route, state, action, afterCapture) => {
      const cell = { route, state, group, lang, viewport: viewportId, sourceSha, sourceTreeSha, reached: false, fontMode: 'exact', assertions: [], failures: [], shot: null };
      doc.cells.push(cell); save();
      console.log(`Release interaction: ${group}/${state}/${lang}; cells=${doc.cells.length}.`);
      try {
        await action(cell);
        const environment = await page.evaluate(() => ({ finalHash: location.hash, navigatorOnline: navigator.onLine, syntheticOnline: window.__arborCaptureFixture?.connectivity === 'synthetic-online', documentLang: document.documentElement.lang, direction: document.documentElement.dir }));
        Object.assign(cell, environment);
        check(cell, 'SYNTHETIC_ONLINE', environment.navigatorOnline && environment.syntheticOnline);
        check(cell, 'NO_PROHIBITED_ACTIONS', apiState.deniedActions === 0, apiState.deniedActions);
      } catch (error) { cell.failures.push(knownFailure(error)); }
      // Even an assertion failure keeps its actual exact-font pixels. Such a
      // cell remains unreached; screenshots cannot convert missing evidence.
      try {
        const shot = firstRunPreview ? firstRunPreviewPrimaryShot({ state, viewport: viewportId, lang }) : `shots/release.${group}.${viewportId}.${lang}.${state}.exact.png`;
        await captureScreenshot(page, { path: `${output}/${shot}`, timeout: 12000, animations: 'disabled' });
        cell.shot = shot;
      } catch (error) { cell.failures.push(knownFailure(error)); }
      // Bounded follow-through can run after preserving an honest first-fold
      // image. Its failures still fail the same cell; no second image or
      // changed scroll position is passed off as the initial viewport.
      if (afterCapture && cell.shot && cell.failures.length === 0) {
        try {
          await afterCapture(cell);
          check(cell, 'NO_PROHIBITED_ACTIONS_AFTER_CAPTURE', apiState.deniedActions === 0, apiState.deniedActions);
        } catch (error) { cell.failures.push(knownFailure(error)); }
      }
      cell.networkEvidence = { ...apiState, deniedActionCategories: { ...apiState.deniedActionCategories } };
      cell.entryMode = entryMode;
      cell.assetDiagnostics = assets.snapshot();
      cell.readiness = await readinessSnapshot().catch(() => ({ unavailable: true }));
      if (cell.readiness.suspenseFallbackVisible && !cell.readiness.composerVisible) cell.readiness.classification = cell.assetDiagnostics.pending.length ? 'SUSPENSE_WITH_PENDING_LOCAL_ASSETS' : 'SUSPENSE_NO_PENDING_LOCAL_ASSETS';
      if (group === 'ask-diagnostic') {
        cell.dependencyBoundary = await page.evaluate(observeAskDependency).catch(() => ({ unavailable: true }));
        cell.reactStage = await page.evaluate(observeReactStage).catch(() => ({ unavailable: true }));
      }
      cell.runtimeDiagnostics = diagnostics.snapshot();
      cell.reached = cell.failures.length === 0 && cell.assertions.length > 0 && cell.shot !== null;
      save();
      // Preserve the failed real attempt BEFORE any import probe. Probe recovery
      // is diagnostic evidence only and can never turn this cell into a pass.
      if (group === 'ask-diagnostic' && ['launcher-composer', 'direct-composer'].includes(state) && !cell.reached && cell.readiness.suspenseFallbackVisible && !cell.readiness.composerVisible) {
        cell.retryCache = await observeCurrentRetryCache(page, { retainedFailure: true });
        save();
        cell.nativeDispatch = await collectNativeDispatch(page);
        save();
        // Stop and tear down this context in the enclosing finally if a stuck
        // browser cannot acknowledge disposal. Never overlap later probes.
        if (cell.nativeDispatch.cleanup !== 'confirmed') throw new Error('NATIVE_DISPATCH_CLEANUP_UNCONFIRMED');
        cell.afterDispatchReactStage = await page.evaluate(observeReactStage).catch(() => ({ unavailable: true }));
        cell.afterDispatchReadiness = await readinessSnapshot().catch(() => ({ unavailable: true }));
        save();
        const module = cell.assetDiagnostics.recent.find(item => /^\/assets\/CoachTab-[a-zA-Z0-9_-]{1,100}\.js$/.test(item.path) && item.state === 'finished' && item.status === 200 && item.mime === 'javascript');
        cell.postFailureProbe = module
          ? await page.evaluate(observeAskDependency, { probeModulePath: module.path }).catch(() => ({ unavailable: true }))
          : { unavailable: true, reason: 'NO_SUCCESSFUL_OBSERVED_COACH_ASSET' };
        cell.afterProbeReadiness = await readinessSnapshot().catch(() => ({ unavailable: true }));
        cell.afterProbeReactStage = await page.evaluate(observeReactStage).catch(() => ({ unavailable: true }));
        save();
      }
      return cell.reached;
    };

    if (firstRunPreview) {
      entryMode = 'existing-dev-onboarding-preview';
      await collectFirstRunPreviewStates({ page, viewport, screen, check, apiState });
    } else if (group === 'kept-search') {
      await collectKeptSearchStates({ page, context, fixture: keptSearch, viewport, output, sourceSha, sourceTreeSha, apiState, load, screen, check, visible, byId, captureDiagnostics: () => ({ runtime: diagnostics.snapshot(), assets: assets.snapshot() }) });
    } else if (group === 'kid-entry') {
      await collectKidEntryStates({ page, fixture: kidEntry, viewport, load, screen, check, byId, apiState });
    } else if (group === 'confirmed-actions') {
      await collectConfirmedActionStates({ page, context, fixture: confirmed, viewport, output, sourceSha, sourceTreeSha, apiState, load, screen, check, visible, byId, captureDiagnostics: () => ({ runtime: diagnostics.snapshot(), assets: assets.snapshot() }), recordBootstrapClock: trace => { doc.confirmedActionBootstrap = trace; save(); } });
    } else if (group === 'record') {
      const helpers = { page, context, fixture: record, viewport, output, sourceSha, sourceTreeSha, apiState, load, screen, check, visible, byId };
      await collectRecordStates(helpers);
      await collectBehaviorRecordStates(helpers);
    } else if (group === 'navigation') {
      const menu = () => byId('companion-launcher').locator('.companion-capture-menu');
      const launcherReady = await screen('shell', 'keep-closed', async cell => { await load('overview'); await visible(cell, 'KEEP_SUMMARY_VISIBLE', menu().locator('summary')); check(cell, 'KEEP_INITIALLY_CLOSED', !await menu().evaluate(el => el.open)); });
      await screen('shell', 'keep-open', async cell => { dependent(launcherReady); await menu().locator('summary').click(); check(cell, 'KEEP_OPEN', await menu().evaluate(el => el.open)); check(cell, 'THREE_KEEP_OPTIONS', await menu().locator('.companion-capture-options button:visible').count() === 3); });
      await screen('shell', 'keep-toggle-closed', async cell => { if (!await menu().evaluate(el => el.open)) throw new Error('DEPENDENT_STATE_UNREACHED'); await menu().locator('summary').click(); check(cell, 'KEEP_TOGGLE_CLOSED', !await menu().evaluate(el => el.open)); });
      await screen('shell', 'keep-escape', async cell => { dependent(launcherReady); await menu().locator('summary').click(); await menu().locator('.companion-capture-options button').first().focus(); await page.keyboard.press('Escape'); check(cell, 'KEEP_ESCAPE_CLOSED', !await menu().evaluate(el => el.open)); check(cell, 'KEEP_FOCUS_RETURNED', await menu().locator('summary').evaluate(el => document.activeElement === el)); });
      await screen('shell', 'keep-write', async cell => { dependent(launcherReady); await menu().locator('summary').click(); await menu().locator('.companion-capture-options button').first().click(); await visible(cell, 'WRITE_FORM_VISIBLE', byId('quicklog-moment-form')); await visible(cell, 'WRITE_INPUT_VISIBLE', page.locator('#quick-log-moment')); check(cell, 'KEEP_CLOSED_BEHIND_WRITE', !await menu().evaluate(el => el.open)); check(cell, 'NO_RECORDING_STARTED', await byId('composer-listening').count() === 0); });

      await screen('shell', 'keep-close-focus', async cell => {
        await visible(cell, 'WRITE_FORM_BEFORE_CLOSE', byId('quicklog-moment-form'));
        await page.keyboard.press('Escape'); await byId('quicklog-moment-form').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.matches('.companion-capture-menu > summary'));
        check(cell, 'KEEP_CLOSE_RETURNS_TO_VISIBLE_SUMMARY', await menu().locator('summary').isVisible() && await menu().locator('summary').evaluate(el => document.activeElement === el));
      });

      await collectPracticeStates({ page, fixture, load, screen, check, visible, byId });

      for (const [state, position] of [['now-scroll-initial', 'initial'], ['now-scroll-middle', 'middle'], ['now-bottom-reachable', 'last-action']]) await screen('overview', state, cell => mainScrollFrame(cell, 'overview', position));
      for (const route of ['milestones', 'daily-play']) for (const position of ['initial', 'middle', 'last-action']) await screen(route, `${route}-scroll-${position}`, cell => mainScrollFrame(cell, route, position));
      await screen('development', 'scroll-route-reset', async cell => {
        await load('milestones');
        const before = await page.locator('#main').evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
        check(cell, 'MAIN_SCROLLED_BEFORE_ROUTE_CHANGE', before > 0);
        const navigation = viewport.w < 1024 ? page.locator('.arbor-app > nav') : byId('app-sidebar').locator('nav');
        const childDoor = navigation.getByRole('button', { name: he ? /^הילד שלי/ : /^My child/ });
        cell.navigationAtClick = await clickWithEvidence(childDoor);
        check(cell, 'MAIN_STILL_SCROLLED_AT_NAVIGATION_CLICK', observedScrolledNavigationClick(cell.navigationAtClick));
        await page.locator('#main [data-route="development"] [data-module]').first().waitFor({ state: 'visible' });
        const offsets = await page.evaluate(() => ({ main: document.querySelector('#main').scrollTop, window: scrollY }));
        cell.scrollOffsets = offsets;
        check(cell, 'MAIN_RESET_ON_ROUTE_CHANGE', offsets.main === 0 && offsets.window === 0);
      });

      const invitation = page.locator('[data-module="together-invitation"]');
      const story = page.locator('[data-together-return="story-library"]');
      const togetherGeometry = async () => { await fontReady(); return story.evaluate(observeTogetherGeometry); };
      let firstGeometry, preDockGeometry, openGeometry;
      const together = await screen('practice', 'together-first-ready', async cell => {
        await load('practice'); await visible(cell, 'TOGETHER_INVITATION_VISIBLE', invitation); await visible(cell, 'STORY_DOOR_VISIBLE', story);
        check(cell, 'HISTORY_INITIALLY_CLOSED', !await byId('together-play-history').evaluate(el => el.open));
        firstGeometry = await togetherGeometry(); cell.geometryObservation = firstGeometry; cell.geometry = firstGeometry.geometry;
        check(cell, 'TOGETHER_ENTRY_GEOMETRY_OBSERVED', togetherLayoutGeometry(firstGeometry, true) !== null);
      });
      await screen('practice', 'together-settled', async cell => {
        dependent(together); await page.waitForTimeout(3000);
        const after = await togetherGeometry(); cell.geometryObservation = after; cell.geometry = after.geometry;
        const beforeLayout = togetherLayoutGeometry(firstGeometry, true), afterLayout = togetherLayoutGeometry(after);
        check(cell, 'TOGETHER_CLOSED_STABLE_AFTER_3S', geometryStable(beforeLayout, afterLayout), { before: beforeLayout, after: afterLayout, tolerancePx: 2 });
        check(cell, 'TOGETHER_CLOSED_SCROLL_UNCHANGED', togetherScrollStable(firstGeometry.scrollOffsets, after.scrollOffsets), { before: firstGeometry.scrollOffsets, after: after.scrollOffsets });
      });
      const dock = await screen('practice', 'together-dock-open', async cell => {
        dependent(together);
        // The dock restores the settled viewport it was opened from. Do not
        // compare its dismissal with a sample taken during the route entrance.
        preDockGeometry = await togetherGeometry(); cell.beforeDockGeometry = preDockGeometry;
        check(cell, 'TOGETHER_PRE_DOCK_ENTRANCE_FINISHED', togetherLayoutGeometry(preDockGeometry) !== null);
        await openConversation(); await visible(cell, 'CONVERSATION_VISIBLE', conversation());
        openGeometry = await togetherGeometry(); cell.geometryObservation = openGeometry; cell.geometry = openGeometry.geometry;
        check(cell, 'TOGETHER_STILL_MOUNTED', await invitation.count() === 1);
        check(cell, 'DOCK_MODE_MATCHES_VIEWPORT', await conversation().getAttribute('role') === (viewport.w >= 1280 ? 'complementary' : 'dialog'));
      });
      await screen('practice', 'together-dock-settled', async cell => {
        dependent(dock); await page.waitForTimeout(3000);
        const after = await togetherGeometry(); cell.geometryObservation = after; cell.geometry = after.geometry;
        check(cell, 'TOGETHER_OPEN_STABLE_AFTER_3S', geometryStable(openGeometry.geometry, after.geometry), { before: openGeometry.geometry, after: after.geometry, tolerancePx: 2 });
        check(cell, 'TOGETHER_OPEN_SCROLL_UNCHANGED', togetherScrollStable(openGeometry.scrollOffsets, after.scrollOffsets), { before: openGeometry.scrollOffsets, after: after.scrollOffsets });
      });
      await screen('practice', 'together-dock-closed', async cell => {
        dependent(dock); await closeConversation(); await visible(cell, 'TOGETHER_REVEALED', invitation); await page.waitForTimeout(3000);
        const after = await togetherGeometry(); cell.geometryObservation = after; cell.geometry = after.geometry;
        check(cell, 'DOCK_CLOSE_FOCUS_RETURNS_TO_LAUNCHER', await byId('companion-launcher').locator('.companion-launch-main').evaluate(el => document.activeElement === el));
        check(cell, 'TOGETHER_RESTORED_AFTER_DOCK', geometryStable(preDockGeometry.geometry, after.geometry), { before: preDockGeometry.geometry, after: after.geometry, tolerancePx: 2 });
        check(cell, 'TOGETHER_DOCK_SCROLL_RESTORED', togetherScrollStable(preDockGeometry.scrollOffsets, after.scrollOffsets), { before: preDockGeometry.scrollOffsets, after: after.scrollOffsets });
      });
      await screen('practice', 'together-return-card', async cell => { await load('practice'); await story.click(); await byId('secondary-place-back').waitFor({ state: 'visible' }); check(cell, 'STORY_DESTINATION_REACHED', new URL(page.url()).hash.startsWith('#/stories')); await page.locator('[data-route="stories"] [data-module="stories-tonight"]').waitFor({ state: 'visible' }); await invitation.waitFor({ state: 'hidden' }); check(cell, 'STORY_CONTENT_MOUNTED', true); await byId('secondary-place-back').click(); await story.waitFor({ state: 'visible' }); await page.waitForFunction(() => document.activeElement?.getAttribute('data-together-return') === 'story-library'); check(cell, 'EXACT_RETURN_CARD_FOCUSED', await story.evaluate(el => document.activeElement === el)); check(cell, 'RETURN_TO_TOGETHER', new URL(page.url()).hash.startsWith('#/practice')); cell.returnMarker = 'story-library'; });

      await screen('practice', 'together-early-back', async cell => {
        await load('practice'); await story.click();
        const back = byId('secondary-place-back'); await back.waitFor({ state: 'visible' });
        cell.transitionAtBack = await clickWithEvidence(back);
        await story.waitFor({ state: 'visible' });
        check(cell, 'EARLY_BACK_WINDOW_OBSERVED', observedEarlyBackClick(cell.transitionAtBack));
        check(cell, 'EARLY_BACK_RETURN_ROUTE', new URL(page.url()).hash.startsWith('#/practice'));
        try { await page.waitForFunction(() => document.activeElement?.getAttribute('data-together-return') === 'story-library', null, { timeout: 8000 }); }
        catch { /* Keep an explicit failed focus assertion, not a selector excuse. */ }
        check(cell, 'EARLY_BACK_EXACT_CARD_FOCUS', await story.evaluate(el => document.activeElement === el));
        cell.returnMarker = 'story-library';
      });
      await screen('practice', 'together-how-to-begin', async cell => {
        await load('practice');
        const card = page.locator('.companion-offscreen-card').filter({ has: page.locator('.companion-door-link') }).first();
        await card.scrollIntoViewIfNeeded();
        const title = await card.locator('h3').textContent();
        const say = (await card.locator('.companion-say').textContent()).replace(/[“”"״]/g, '').trim();
        await card.click();
        const dialog = page.locator('[role="dialog"][aria-modal="true"]').last();
        const preview = dialog.locator('.companion-preview');
        await visible(cell, 'ACTIVITY_CONTEXT_VISIBLE', preview);
        check(cell, 'ACTIVITY_TITLE_PRESERVED', (await dialog.getByRole('heading').first().textContent())?.trim() === title?.trim());
        check(cell, 'CONCRETE_ACTIVITY_DETAIL', (await preview.locator('p').first().textContent())?.trim().length >= 20);
        check(cell, 'EXACT_SAY_THIS_PRESERVED', (await preview.locator('blockquote').textContent()).replace(/[“”"״]/g, '').trim().includes(say));
        await visible(cell, 'TRY_ACTIVITY_CONTROL_VISIBLE', preview.locator('.companion-primary'));
        check(cell, 'KEEP_ACTION_REMAINS_DISTINCT', await preview.locator('.companion-text-button').count() === 1);
      });
      await screen('practice', 'together-bottom-reachable', cell => mainScrollFrame(cell, 'practice'));

      const recordNav = async cell => {
        const back = byId('secondary-place-back'); const nav = page.locator('[data-density-toggle]');
        await visible(cell, 'RECORD_BACK_MOUNTED', back); await visible(cell, 'RECORD_DENSITY_NAV_MOUNTED', nav); check(cell, 'TWO_DENSITY_TABS', await nav.locator('[role=tab]').count() === 2); check(cell, 'NO_DUPLICATE_SHELL_NAV', await byId('secondary-sibling-nav').count() === 0);
        const geometry = { back: await rect(back), nav: await rect(nav), clip: await rect(page.locator('main')) };
        cell.geometry = geometry;
        check(cell, 'RECORD_BACK_UNIQUE', await back.count() === 1);
        check(cell, 'RECORD_BACK_NO_VISIBLE_NAV_OVERLAP', clippedOverlap(geometry.back, geometry.nav, geometry.clip) === 0, clippedOverlap(geometry.back, geometry.nav, geometry.clip));
      };
      const record = await screen('timeline', 'recordnav-initial', async cell => { await load('timeline'); await recordNav(cell); });
      await screen('timeline', 'recordnav-scrolled', async cell => { dependent(record); cell.scroll = await page.evaluate(() => { const main = document.querySelector('#main'); const max = main.scrollHeight - main.clientHeight; main.scrollTop = Math.min(Math.max(100, main.clientHeight / 2), max); return { main: main.scrollTop, window: window.scrollY }; }); check(cell, 'RECORD_ACTUALLY_SCROLLED', cell.scroll.main > 0 && cell.scroll.window === 0); await recordNav(cell); });

      const more = () => page.locator('nav button[aria-expanded]').last();
      const records = byId('more-records-group');
      const profileLink = () => records.getByRole('button', { name: he ? /פרטים, תחומי עניין והקשר משפחתי/ : /Details, interests and family context/ });
      const memoryLink = () => records.getByRole('button', { name: he ? /לעבור על מה שארבור זוכר/ : /Review what Arbor remembers/ });
      if (viewport.w < 1024) {
        const moreReady = await screen('shell', 'more-records', async cell => { await load('overview'); await more().click(); await visible(cell, 'MORE_RECORDS_VISIBLE', records); await visible(cell, 'PROFILE_LINK_DISTINCT', profileLink()); await visible(cell, 'MEMORY_LINK_DISTINCT', memoryLink()); check(cell, 'PROFILE_MEMORY_DIFFERENT_LABELS', await profileLink().textContent() !== await memoryLink().textContent()); });
        const profileReached = await screen('profile', 'record-profile', async cell => { dependent(moreReady); await profileLink().click(); await page.waitForFunction(() => location.hash.startsWith('#/profile')); await visible(cell, 'PROFILE_PAGE_VISIBLE', page.locator('main h1').first()); check(cell, 'PROFILE_DESTINATION', new URL(page.url()).hash.startsWith('#/profile')); });
        const profileCurrent = await screen('shell', 'more-profile-current', async cell => { dependent(profileReached); await more().click(); await visible(cell, 'PROFILE_LINK_VISIBLE', profileLink()); check(cell, 'PROFILE_CURRENT_ONLY', await profileLink().getAttribute('aria-current') === 'page' && await memoryLink().getAttribute('aria-current') !== 'page'); });
        const memoryReached = await screen('memory', 'record-memory', async cell => { dependent(profileCurrent); await memoryLink().click(); await page.waitForFunction(() => location.hash.startsWith('#/memory')); await visible(cell, 'MEMORY_PAGE_VISIBLE', page.locator('main h1').first()); check(cell, 'MEMORY_DESTINATION', new URL(page.url()).hash.startsWith('#/memory')); });
        await screen('shell', 'more-memory-current', async cell => { dependent(memoryReached); await more().click(); await visible(cell, 'MEMORY_LINK_VISIBLE', memoryLink()); check(cell, 'MEMORY_CURRENT_ONLY', await memoryLink().getAttribute('aria-current') === 'page' && await profileLink().getAttribute('aria-current') !== 'page'); });
      } else {
        for (const route of ['profile', 'memory']) await screen(route, `record-${route}`, async cell => { await load(route); await visible(cell, 'DIRECT_RECORD_PAGE_VISIBLE', page.locator('main h1').first()); check(cell, 'DIRECT_RECORD_ROUTE', new URL(page.url()).hash.startsWith(`#/${route}`)); cell.interactionScope = 'direct route; mobile More does not exist at this viewport'; });
      }
      const watchKey = `arbor.screen.watch.${fixture.childId}`;
      let watchTitle;
      const watch = await screen('development', 'watch-chosen', async cell => { if (!fixture.watch) throw new Error('SYNTHETIC_WATCH_MILESTONE_MISSING'); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: watchKey, value: fixture.watch }); await load('development'); await visible(cell, 'CHOSEN_WATCH_CLEAR_VISIBLE', byId('portrait-unwatch')); await byId('portrait-watch').scrollIntoViewIfNeeded(); watchTitle = await page.locator('#portrait-watch-title').textContent(); check(cell, 'CHOSEN_WATCH_DETAILS_OPEN', await byId('portrait-watch-details').evaluate(el => el.open)); cell.fixture = 'synthetic-local-watch-choice'; });
      const cleared = await screen('development', 'watch-cleared', async cell => { dependent(watch); await byId('portrait-unwatch').click(); await visible(cell, 'WATCH_UNDO_VISIBLE', byId('portrait-watch-undo')); check(cell, 'WATCH_STORAGE_CLEARED', await page.evaluate(key => localStorage.getItem(key), watchKey) === null); check(cell, 'WATCH_CLEAR_CONTROL_REMOVED', await byId('portrait-unwatch').count() === 0); });
      await screen('development', 'watch-undo', async cell => { dependent(cleared); await byId('portrait-watch-undo').click(); await visible(cell, 'WATCH_CLEAR_RESTORED', byId('portrait-unwatch')); check(cell, 'WATCH_EXACT_CHOICE_RESTORED', await page.evaluate(key => localStorage.getItem(key), watchKey) === JSON.stringify(fixture.watch)); check(cell, 'WATCH_SAME_TITLE', await page.locator('#portrait-watch-title').textContent() === watchTitle); check(cell, 'WATCH_UNDO_REMOVED', await byId('portrait-watch-undo').count() === 0); });
    } else if (group === 'report-close-only') {
      await collectReportStates({ page, lang, check, visible, byId, composer, load, openConversation, closeConversation, syntheticReleaseReport,
        screen: (route, state, action) => screen(route, state, async cell => { cell.fixture = 'bilingual-report-presentation-fixture'; await action(cell); }),
        setReportFixture: response => { selectedReportFixture = response; apiState.chat = 'report'; },
      }, { closeOnly: true });
    } else {
      const toggle = () => composer().locator('.companion-tools-toggle');
      const tools = () => composer().locator('.companion-secondary-tools');
      const consent = () => composer().locator('.companion-consent');
      const review = async () => { await toggle().click(); await tools().getByRole('button', { name: he ? 'הרשאות לקבצים' : 'File permissions', exact: true }).click(); await consent().waitFor({ state: 'visible' }); };
      const closeReview = () => consent().getByRole('button', { name: he ? 'חזרה לטיוטה' : 'Back to my draft', exact: true }).click();
      const draft = he ? 'זו טיוטת דוגמה מומצאת על בחירת ספר יחד.' : 'This is an invented draft about choosing a book together.';
      const launcherReady = await screen('shell', group === 'ask-diagnostic' ? 'launcher-composer' : 'tools-closed', async cell => {
        await load('overview'); await visible(cell, 'LAUNCHER_VISIBLE', byId('companion-launcher')); await openConversation(); await visible(cell, 'COMPOSER_VISIBLE', composer());
        // The narrow diagnostic deliberately works on the older baseline too.
        // It cannot depend on controls introduced by the release under test.
        if (group !== 'ask-diagnostic') check(cell, 'TOOLS_INITIALLY_COLLAPSED', await toggle().getAttribute('aria-expanded') === 'false' && !await tools().isVisible());
      });
      // The launcher is always attempted first. A later direct-route success
      // never converts a failed launcher cell into success or preloads it.
      const mockAnswer = async cell => {
        apiState.chat = 'mock';
        const frameBaseline = await checkConversationFrame(conversation(), cell, { check, phase: 'BEFORE_SEND' });
        const before = { requests: apiState.mockRequests, responses: apiState.mockResponses, answers: await byId('coach-answer-cards').count() };
        await composer().locator('textarea').fill(he ? 'איך אפשר לבחור ספר לקריאה יחד?' : 'How can we choose a book to read together?');
        await composer().locator('[data-testid="coach-send"]').click();
        const answer = byId('coach-answer-cards').nth(before.answers);
        await answer.waitFor({ state: 'visible', timeout: 30000 });
        await checkConversationFrame(conversation(), cell, { check, baseline: frameBaseline, phase: 'AFTER_RESPONSE' });
        await answer.evaluate(scrollConversationTranscript);
        await checkConversationFrame(conversation(), cell, { check, baseline: frameBaseline, phase: 'AFTER_CAPTURE_SCROLL' });
        check(cell, 'ACTUAL_MOCK_REQUEST_OBSERVED', apiState.mockRequests > before.requests);
        check(cell, 'ACTUAL_MOCK_RESPONSE_OBSERVED', apiState.mockResponses > before.responses);
        await visible(cell, 'ACTUAL_MOCK_ANSWER_RENDERED', answer);
        cell.fixture = 'actual-local-mock-server-response';
      };
      await screen('shell', 'ask-mock-answer', async cell => { dependent(launcherReady); await mockAnswer(cell); });
      // A repeated real user flow is diagnostic only. Keep both original failed
      // cells intact, and reload the fresh direct route afterward as before.
      if (group === 'ask-diagnostic' && !launcherReady) {
        const repeated = { scope: 'post-failure-same-document-close-and-reopen', failures: [], closedToLauncher: false, reopenedWithComposer: false, shot: null };
        doc.sameDocumentLauncherReopen = repeated; save();
        repeated.before = await page.evaluate(observeReactStage).catch(() => ({ unavailable: true }));
        try {
          await closeConversation();
          repeated.closedToLauncher = await byId('companion-launcher').isVisible();
          await openConversation();
          repeated.reopenedWithComposer = await composer().locator('textarea').isVisible();
        } catch (error) { repeated.failures.push(knownFailure(error)); }
        repeated.readiness = await readinessSnapshot().catch(() => ({ unavailable: true }));
        repeated.reactStage = await page.evaluate(observeReactStage).catch(() => ({ unavailable: true }));
        repeated.dependencyBoundary = await page.evaluate(observeAskDependency).catch(() => ({ unavailable: true }));
        try {
          const shot = `shots/release.ask-diagnostic.${viewportId}.${lang}.launcher-reopen.exact.png`;
          await captureScreenshot(page, { path: `${output}/${shot}`, timeout: 12000, animations: 'disabled' });
          repeated.shot = shot;
        } catch (error) { repeated.failures.push(knownFailure(error)); }
        save();
      }
      const ready = await screen('coach', 'direct-composer', async cell => {
        await load('coach'); await openConversation();
        await visible(cell, 'DIRECT_ROUTE_COMPOSER_VISIBLE', composer());
        check(cell, 'DIRECT_COACH_HASH', new URL(page.url()).hash.startsWith('#/coach'));
        check(cell, 'DIRECT_ENTRY_WITHOUT_LAUNCHER_CLICK', entryMode === 'direct-coach-route');
      });
      await screen('coach', 'direct-mock-answer', async cell => { dependent(ready); await mockAnswer(cell); });
      if (group !== 'ask-diagnostic') {
      await screen('shell', 'tools-open', async cell => { dependent(ready); await toggle().click(); await visible(cell, 'TOOLS_VISIBLE', tools()); check(cell, 'TOOLS_EXPANDED', await toggle().getAttribute('aria-expanded') === 'true'); check(cell, 'TOOLS_FIVE_REAL_ACTIONS', await tools().locator('button:visible').count() === 5); });
      await screen('shell', 'tools-escape', async cell => { dependent(ready); await tools().getByRole('button', { name: he ? 'הרשאות לקבצים' : 'File permissions', exact: true }).focus(); await page.keyboard.press('Escape'); check(cell, 'TOOLS_ESCAPE_CLOSED', await toggle().getAttribute('aria-expanded') === 'false' && !await tools().isVisible()); check(cell, 'TOOLS_FOCUS_RETURNED', await toggle().evaluate(el => document.activeElement === el)); check(cell, 'CONVERSATION_REMAINS_OPEN', await conversation().isVisible()); });
      const permission = await screen('shell', 'consent-review', async cell => { dependent(ready); await composer().locator('textarea').fill(draft); await review(); await visible(cell, 'CONSENT_CHECKBOX_VISIBLE', consent().locator('input[type="checkbox"]')); check(cell, 'CONSENT_DEFAULT_UNCHECKED', !await consent().locator('input[type="checkbox"]').isChecked()); check(cell, 'CONSENT_GRANT_DISABLED', await consent().locator('.companion-consent-allow').isDisabled()); check(cell, 'CONSENT_NOT_WRITTEN_ON_REVIEW', apiState.consentWrites === 0); });
      const readError = await screen('shell', 'consent-read-error', async cell => { dependent(permission); await closeReview(); apiState.consent = 'read-error'; await review(); await visible(cell, 'CONSENT_READ_ERROR_VISIBLE', consent().locator('[role="alert"]')); check(cell, 'CONSENT_READ_FIXTURE_USED', apiState.consentReads >= 2); });
      await screen('shell', 'consent-read-retry', async cell => { dependent(readError); apiState.consent = 'empty'; await consent().getByRole('button', { name: he ? 'בדיקה נוספת' : 'Check again', exact: true }).click(); await consent().locator('[role="alert"]').waitFor({ state: 'hidden' }); check(cell, 'CONSENT_READ_RECOVERED', await consent().locator('[role="alert"]').count() === 0); check(cell, 'CONSENT_RETRY_STILL_UNCHECKED', !await consent().locator('input[type="checkbox"]').isChecked()); });
      await screen('shell', 'consent-grant-error', async cell => { dependent(permission); await consent().locator('input[type="checkbox"]').check(); await consent().locator('.companion-consent-allow').click(); await visible(cell, 'CONSENT_GRANT_ERROR_VISIBLE', consent().locator('[role="alert"]')); check(cell, 'ONLY_SYNTHETIC_GRANT_ATTEMPT', apiState.consentWrites === 1); check(cell, 'CONSENT_REMAINS_REVIEWABLE', await consent().locator('input[type="checkbox"]').isChecked()); });
      await screen('shell', 'consent-draft-return', async cell => { dependent(permission); await closeReview(); await visible(cell, 'COMPOSER_DRAFT_RETURNED', composer().locator('textarea')); check(cell, 'DRAFT_PRESERVED_THROUGH_ERRORS', await composer().locator('textarea').inputValue() === draft); check(cell, 'NO_FILES_SELECTED', await composer().locator('.companion-attachments').count() === 0); });
      for (const kind of ['generic', 'quota']) await screen('shell', `ask-error-${kind}`, async cell => { dependent(ready); apiState.chat = kind; await composer().locator('textarea').fill(draft); await composer().locator('[data-testid="coach-send"]').click(); const failure = byId('coach-failure-card'); await visible(cell, 'CHAT_FAILURE_VISIBLE', failure); await page.waitForFunction(expected => document.querySelector('[data-testid="coach-failure-card"]')?.getAttribute('data-failure-kind') === expected, kind); check(cell, 'CORRECT_CHAT_FAILURE_KIND', await failure.getAttribute('data-failure-kind') === kind); check(cell, 'CHAT_RETRY_MATCHES_FAILURE', kind === 'generic' ? await failure.locator('button').count() === 1 : await failure.locator('button').count() === 0); cell.fixture = 'bounded-chat-error-response'; });
      await collectReportStates({ page, lang, check, visible, byId, composer, load, openConversation, closeConversation, syntheticReleaseReport,
        screen: (route, state, action) => screen(route, state, async cell => { cell.fixture = 'bilingual-report-presentation-fixture'; await action(cell); }),
        setReportFixture: response => { selectedReportFixture = response; apiState.chat = 'report'; },
      });
      }
    }
    doc.finished = true;
    save();
    doc.completed = doc.missingEvidence.length === 0;
    save();
    return doc;
  } catch (error) {
    doc.collectorFailure = { phase: doc.cells.length === 0 ? 'startup' : 'collection', ...sanitizedCollectorFailure(error) };
    save();
    throw error;
  } finally {
    save();
    if (context) await context.close().catch(() => {});
    await browser.close();
  }
}
