/** Release-only interaction evidence. Importing this module launches nothing.
 * Browser execution is allowed only inside the dedicated network-none runtime.
 * Fixtures enter the existing storage/API seams; DOM and application code are
 * never replaced. A fixture screenshot proves renderer behavior, not a provider.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { BASE, assertLoopbackOnly, captureRevision } from './config.mjs';
import { SMALL_FIXTURE, initializeSyntheticOnline } from './small-state.mjs';
import { createRuntimeDiagnostics, createAssetDiagnostics } from './runtime-diagnostics.mjs';
export { classifyReleaseConsole, sanitizedReleaseLocation } from './runtime-diagnostics.mjs';
import { SOURCE_FONT_NOTE, captureFontContextOptions, installOfflineFonts, captureScreenshot } from './font-runtime.mjs';

const rows = (route, states) => states.map(state => ({ route, state }));
export const RELEASE_INTERACTION_STATES = Object.freeze({
  navigation: [
    ...rows('shell', ['keep-closed', 'keep-open', 'keep-toggle-closed', 'keep-escape', 'keep-write']),
    ...rows('overview', ['practice-compact', 'practice-details', 'practice-outcome', 'practice-undo']),
    ...rows('practice', ['together-first-ready', 'together-settled', 'together-dock-open', 'together-dock-settled', 'together-dock-closed', 'together-return-card']),
    ...rows('timeline', ['recordnav-initial', 'recordnav-scrolled']),
    ...rows('shell', ['more-records', 'more-profile-current', 'more-memory-current']).map(item => ({ ...item, mobileOnly: true })),
    ...rows('profile', ['record-profile']), ...rows('memory', ['record-memory']),
    ...rows('development', ['watch-chosen', 'watch-cleared', 'watch-undo']),
  ],
  ask: [
    ...rows('shell', ['tools-closed', 'tools-open', 'tools-escape', 'consent-review', 'consent-read-error', 'consent-read-retry', 'consent-grant-error', 'consent-draft-return', 'ask-error-generic', 'ask-error-quota', 'ask-mock-answer', 'report-fixture']),
    ...rows('shell', ['report-opening', 'report-document', 'report-understanding', 'report-next', 'report-script', 'report-observe', 'report-avoid', 'report-help-closed', 'report-help-open', 'report-sources-closed', 'report-sources-open', 'report-council', 'report-footer']),
  ],
  'ask-diagnostic': rows('shell', ['launcher-composer', 'ask-mock-answer']),
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
    const valid = cell?.reached === true && typeof cell.shot === 'string' && cell.shot.startsWith('shots/') && cell.assertions?.length > 0 && cell.assertions.every(assertion => assertion.passed === true) && Array.isArray(cell.failures) && cell.failures.length === 0;
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

/** A capability read is not a media action. Everything else retains the
 * existing strict action deny; the local server still has TTS_DISABLED=true. */
export function deniedCaptureApiCategory(method, pathname) {
  if (method === 'GET' && pathname === '/api/tts') return null;
  for (const [category, pattern] of [
    ['LIVE', /^\/api\/live\//], ['VOICE', /^\/api\/voice(?:\/|$)/],
    ['TTS', /^\/api\/tts(?:\/|$)/], ['VISION', /^\/api\/vision(?:\/|$)/],
    ['SHARING', /^\/api\/shares?(?:\/|$)/], ['EXPORT', /^\/api\/export(?:\/|$)/],
    ['BILLING', /^\/api\/billing(?:\/|$)/], ['CONSENT', /^\/api\/consent(?:\/|$)/],
  ]) if (pattern.test(pathname)) return category;
  return null;
}

const knownFailure = error => /^FONT_[A-Z_]+$/.test(error?.message ?? '') || ['DEPENDENT_STATE_UNREACHED', 'SYNTHETIC_WATCH_MILESTONE_MISSING'].includes(error?.message) ? error.message : error?.name === 'TimeoutError' ? 'SELECTOR_OR_ACTION_TIMEOUT' : 'INTERACTION_FAILED';

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
  const fixture = releaseFixture(bundle, viewport.lang);
  const { lang } = viewport;
  const he = lang === 'he';
  const viewportId = `${viewport.w}x${viewport.h}`;
  mkdirSync(`${output}/shots`, { recursive: true });
  const doc = { schema: 1, scope: 'release-interactions', sourceSha, sourceTreeSha, group: _reportGroup, activeGroup: group, viewport: viewportId, lang, fixture: SMALL_FIXTURE, fontMode: 'exact', fontLimitation: SOURCE_FONT_NOTE, expectedStates: _reportGroup === group ? expectedStates : expectedReleaseInteractionStates(_reportGroup, viewport), completed: false, finished: false, cells: [..._priorCells], fixtures: ['synthetic-family', 'local-mock-server', 'synthetic-local-watch-choice', 'bounded-consent-error-responses', 'bounded-chat-error-responses', 'bilingual-report-presentation-fixture'] };
  const save = () => { doc.missingEvidence = missingReleaseInteractionEvidence(doc.cells, { group: _reportGroup, viewport, sourceSha, sourceTreeSha }); writeFileSync(`${output}/evidence.json`, JSON.stringify(doc, null, 2)); };
  save();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, locale: he ? 'he-IL' : 'en-US', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block', permissions: [], ...captureFontContextOptions() });
    const apiState = { consent: 'empty', chat: 'mock', mockRequests: 0, mockResponses: 0, fixtureRequests: 0, consentReads: 0, consentWrites: 0, deniedExternal: 0, deniedActions: 0, deniedActionCategories: {}, ttsCapabilityReads: 0, apiCacheHits: 0, localRateLimits: 0 };
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === BASE) return route.continue();
      apiState.deniedExternal++;
      return route.abort();
    });
    await context.routeWebSocket(() => true, socket => socket.close());
    await context.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== BASE) { apiState.deniedExternal++; return route.abort(); }
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
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
        if (apiState.chat === 'report') return json(200, syntheticReleaseReport(lang));
        return route.fulfill({ status: apiState.chat === 'quota' ? 429 : 503, contentType: 'application/json', headers: { 'retry-after': '60' }, body: JSON.stringify({ error: 'Synthetic capture response failure' }) });
      }
      const denied = deniedCaptureApiCategory(request.method(), url.pathname);
      if (denied) { apiState.deniedActions++; apiState.deniedActionCategories[denied] = (apiState.deniedActionCategories[denied] ?? 0) + 1; return route.abort(); }
      if (request.method() === 'GET' && url.pathname === '/api/tts') apiState.ttsCapabilityReads++;

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
    await context.route('**/sandbox/demo-family.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture.parsed) }));
    await installOfflineFonts(context);
    await context.addInitScript(initializeSyntheticOnline, { lang });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const diagnostics = createRuntimeDiagnostics();
    const assets = createAssetDiagnostics();
    page.on('request', request => assets.request(request, request.url(), request.resourceType()));
    page.on('response', response => assets.response(response.request(), response.status(), response.headers()['content-type'] ?? ''));
    page.on('requestfinished', request => assets.finish(request));
    page.on('requestfailed', request => assets.finish(request, true));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.record(message.text(), message.location()); });
    page.on('pageerror', error => diagnostics.record(error.message));
    page.on('filechooser', () => { apiState.deniedActions++; });
    page.on('download', download => { apiState.deniedActions++; void download.cancel(); });
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
    const load = async route => {
      await page.goto(`${BASE}/?capture=release-${group}-${Date.now()}#/${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator('main h1, main [data-module]').first().waitFor({ state: 'visible', timeout: 30000 });
      await fontReady();
    };
    const check = (cell, id, passed, observed) => { cell.assertions.push({ id, passed: passed === true, ...(observed === undefined ? {} : { observed }) }); if (!passed) cell.failures.push(id); };
    const visible = async (cell, id, locator) => { await locator.waitFor({ state: 'visible' }); check(cell, id, await locator.isVisible()); };
    const dependent = reached => { if (!reached) throw new Error('DEPENDENT_STATE_UNREACHED'); };
    const rect = async locator => { await fontReady(); return locator.boundingBox(); };
    const openConversation = async () => {
      if (!await conversation().isVisible()) await byId('companion-launcher').locator('.companion-launch-main').click();
      await composer().locator('textarea').waitFor({ state: 'visible', timeout: 15000 });
    };
    const closeConversation = async () => { await conversation().locator('.companion-conversation-heading > button').last().click(); await byId('companion-launcher').waitFor({ state: 'visible' }); };
    const screen = async (route, state, action) => {
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
        const shot = `shots/release.${group}.${viewportId}.${lang}.${state}.exact.png`;
        await captureScreenshot(page, { path: `${output}/${shot}`, timeout: 12000, animations: 'disabled' });
        cell.shot = shot;
      } catch (error) { cell.failures.push(knownFailure(error)); }
      cell.networkEvidence = { ...apiState, deniedActionCategories: { ...apiState.deniedActionCategories } };
      cell.assetDiagnostics = assets.snapshot();
      cell.readiness = await readinessSnapshot().catch(() => ({ unavailable: true }));
      if (cell.readiness.suspenseFallbackVisible && !cell.readiness.composerVisible) cell.readiness.classification = cell.assetDiagnostics.pending.length ? 'SUSPENSE_WITH_PENDING_LOCAL_ASSETS' : 'SUSPENSE_NO_PENDING_LOCAL_ASSETS';
      cell.runtimeDiagnostics = diagnostics.snapshot();
      cell.reached = cell.failures.length === 0 && cell.assertions.length > 0 && cell.shot !== null;
      save();
      return cell.reached;
    };

    if (group === 'navigation') {
      const menu = () => byId('companion-launcher').locator('.companion-capture-menu');
      const launcherReady = await screen('shell', 'keep-closed', async cell => { await load('overview'); await visible(cell, 'KEEP_SUMMARY_VISIBLE', menu().locator('summary')); check(cell, 'KEEP_INITIALLY_CLOSED', !await menu().evaluate(el => el.open)); });
      await screen('shell', 'keep-open', async cell => { dependent(launcherReady); await menu().locator('summary').click(); check(cell, 'KEEP_OPEN', await menu().evaluate(el => el.open)); check(cell, 'THREE_KEEP_OPTIONS', await menu().locator('.companion-capture-options button:visible').count() === 3); });
      await screen('shell', 'keep-toggle-closed', async cell => { if (!await menu().evaluate(el => el.open)) throw new Error('DEPENDENT_STATE_UNREACHED'); await menu().locator('summary').click(); check(cell, 'KEEP_TOGGLE_CLOSED', !await menu().evaluate(el => el.open)); });
      await screen('shell', 'keep-escape', async cell => { dependent(launcherReady); await menu().locator('summary').click(); await menu().locator('.companion-capture-options button').first().focus(); await page.keyboard.press('Escape'); check(cell, 'KEEP_ESCAPE_CLOSED', !await menu().evaluate(el => el.open)); check(cell, 'KEEP_FOCUS_RETURNED', await menu().locator('summary').evaluate(el => document.activeElement === el)); });
      await screen('shell', 'keep-write', async cell => { dependent(launcherReady); await menu().locator('summary').click(); await menu().locator('.companion-capture-options button').first().click(); await visible(cell, 'WRITE_FORM_VISIBLE', byId('quicklog-moment-form')); await visible(cell, 'WRITE_INPUT_VISIBLE', page.locator('#quick-log-moment')); check(cell, 'KEEP_CLOSED_BEHIND_WRITE', !await menu().evaluate(el => el.open)); check(cell, 'NO_RECORDING_STARTED', await byId('composer-listening').count() === 0); });

      const practice = byId('practice-card');
      let practiceId;
      const practiceReady = await screen('overview', 'practice-compact', async cell => { await load('overview'); await visible(cell, 'PRACTICE_VISIBLE', practice); practiceId = await practice.getAttribute('data-practice-id'); check(cell, 'PRACTICE_ACTION_FIRST', await practice.getAttribute('data-presentation') === 'action-first'); check(cell, 'PRACTICE_DETAILS_CLOSED', !await byId('practice-details').evaluate(el => el.open)); await visible(cell, 'PRACTICE_OUTCOMES_VISIBLE', byId('practice-answers')); });
      await screen('overview', 'practice-details', async cell => { dependent(practiceReady); await byId('practice-details').locator('summary').click(); check(cell, 'PRACTICE_DETAILS_OPEN', await byId('practice-details').evaluate(el => el.open)); await byId('practice-details').scrollIntoViewIfNeeded(); check(cell, 'PRACTICE_ID_UNCHANGED', await practice.getAttribute('data-practice-id') === practiceId); });
      const outcome = await screen('overview', 'practice-outcome', async cell => { dependent(practiceReady); await byId('practice-answers').locator('[data-answer="did"]').click(); await visible(cell, 'PRACTICE_RECEIPT_VISIBLE', byId('practice-receipt')); await visible(cell, 'PRACTICE_UNDO_VISIBLE', byId('practice-undo')); check(cell, 'PRACTICE_ANSWERS_REPLACED', await byId('practice-answers').count() === 0); });
      await screen('overview', 'practice-undo', async cell => { dependent(outcome); await byId('practice-undo').click(); await visible(cell, 'PRACTICE_OUTCOMES_RESTORED', byId('practice-answers')); check(cell, 'PRACTICE_RECEIPT_REMOVED', await byId('practice-receipt').count() === 0); check(cell, 'PRACTICE_SAME_CARD', await practice.getAttribute('data-practice-id') === practiceId); });

      const invitation = page.locator('[data-module="together-invitation"]');
      const story = page.locator('[data-together-return="story-library"]');
      let closedGeometry, openGeometry;
      const together = await screen('practice', 'together-first-ready', async cell => { await load('practice'); await visible(cell, 'TOGETHER_INVITATION_VISIBLE', invitation); await visible(cell, 'STORY_DOOR_VISIBLE', story); check(cell, 'HISTORY_INITIALLY_CLOSED', !await byId('together-play-history').evaluate(el => el.open)); closedGeometry = await rect(story); cell.geometry = closedGeometry; });
      await screen('practice', 'together-settled', async cell => { dependent(together); await page.waitForTimeout(3000); cell.geometry = await rect(story); check(cell, 'TOGETHER_CLOSED_STABLE_AFTER_3S', geometryStable(closedGeometry, cell.geometry), { before: closedGeometry, after: cell.geometry, tolerancePx: 2 }); });
      const dock = await screen('practice', 'together-dock-open', async cell => { dependent(together); await openConversation(); await visible(cell, 'CONVERSATION_VISIBLE', conversation()); openGeometry = await rect(story); cell.geometry = openGeometry; check(cell, 'TOGETHER_STILL_MOUNTED', await invitation.count() === 1); check(cell, 'DOCK_MODE_MATCHES_VIEWPORT', await conversation().getAttribute('role') === (viewport.w >= 1280 ? 'complementary' : 'dialog')); });
      await screen('practice', 'together-dock-settled', async cell => { dependent(dock); await page.waitForTimeout(3000); cell.geometry = await rect(story); check(cell, 'TOGETHER_OPEN_STABLE_AFTER_3S', geometryStable(openGeometry, cell.geometry), { before: openGeometry, after: cell.geometry, tolerancePx: 2 }); });
      await screen('practice', 'together-dock-closed', async cell => { dependent(dock); await closeConversation(); await visible(cell, 'TOGETHER_REVEALED', invitation); await page.waitForTimeout(3000); cell.geometry = await rect(story); check(cell, 'TOGETHER_RESTORED_AFTER_DOCK', geometryStable(closedGeometry, cell.geometry), { before: closedGeometry, after: cell.geometry, tolerancePx: 2 }); });
      await screen('practice', 'together-return-card', async cell => { await load('practice'); await story.click(); await byId('secondary-place-back').waitFor({ state: 'visible' }); check(cell, 'STORY_DESTINATION_REACHED', new URL(page.url()).hash.startsWith('#/stories')); await byId('secondary-place-back').click(); await story.waitFor({ state: 'visible' }); await page.waitForFunction(() => document.activeElement?.getAttribute('data-together-return') === 'story-library'); check(cell, 'EXACT_RETURN_CARD_FOCUSED', await story.evaluate(el => document.activeElement === el)); check(cell, 'RETURN_TO_TOGETHER', new URL(page.url()).hash.startsWith('#/practice')); cell.returnMarker = 'story-library'; });

      const recordNav = async cell => {
        const back = byId('secondary-place-back'); const nav = byId('secondary-sibling-nav');
        await visible(cell, 'RECORD_BACK_MOUNTED', back); await visible(cell, 'RECORD_SIBLINGS_MOUNTED', nav);
        const geometry = { back: await rect(back), nav: await rect(nav), clip: await rect(page.locator('main')) };
        cell.geometry = geometry;
        check(cell, 'RECORD_BACK_UNIQUE', await back.count() === 1);
        check(cell, 'RECORD_BACK_NO_VISIBLE_NAV_OVERLAP', clippedOverlap(geometry.back, geometry.nav, geometry.clip) === 0, clippedOverlap(geometry.back, geometry.nav, geometry.clip));
      };
      const record = await screen('timeline', 'recordnav-initial', async cell => { await load('timeline'); await recordNav(cell); });
      await screen('timeline', 'recordnav-scrolled', async cell => { dependent(record); cell.scroll = await page.evaluate(() => { const main = document.querySelector('main'); const max = main.scrollHeight - main.clientHeight; main.scrollTop = Math.min(Math.max(100, main.clientHeight / 2), max); if (main.scrollTop < 1) window.scrollTo(0, 240); return { main: main.scrollTop, window: window.scrollY }; }); check(cell, 'RECORD_ACTUALLY_SCROLLED', cell.scroll.main > 0 || cell.scroll.window > 0); await recordNav(cell); });

      const more = () => page.locator('nav button[aria-expanded]').last();
      const records = byId('more-records-group');
      const profileLink = () => records.getByRole('button', { name: he ? /פרטים, תחומי עניין והקשר משפחתי/ : /Details, interests and family context/ });
      const memoryLink = () => records.getByRole('button', { name: he ? /לעבור על מה שארבור זוכר/ : /Review what Arbor remembers/ });
      if (viewport.w < 1024) {
        const moreReady = await screen('shell', 'more-records', async cell => { await load('overview'); await more().click(); await visible(cell, 'MORE_RECORDS_VISIBLE', records); await visible(cell, 'PROFILE_LINK_DISTINCT', profileLink()); await visible(cell, 'MEMORY_LINK_DISTINCT', memoryLink()); check(cell, 'PROFILE_MEMORY_DIFFERENT_LABELS', await profileLink().textContent() !== await memoryLink().textContent()); });
        await screen('profile', 'record-profile', async cell => { dependent(moreReady); await profileLink().click(); await page.waitForFunction(() => location.hash.startsWith('#/profile')); await visible(cell, 'PROFILE_PAGE_VISIBLE', page.locator('main h1').first()); check(cell, 'PROFILE_DESTINATION', new URL(page.url()).hash.startsWith('#/profile')); });
        await screen('shell', 'more-profile-current', async cell => { await more().click(); await visible(cell, 'PROFILE_LINK_VISIBLE', profileLink()); check(cell, 'PROFILE_CURRENT_ONLY', await profileLink().getAttribute('aria-current') === 'page' && await memoryLink().getAttribute('aria-current') !== 'page'); });
        await screen('memory', 'record-memory', async cell => { await memoryLink().click(); await page.waitForFunction(() => location.hash.startsWith('#/memory')); await visible(cell, 'MEMORY_PAGE_VISIBLE', page.locator('main h1').first()); check(cell, 'MEMORY_DESTINATION', new URL(page.url()).hash.startsWith('#/memory')); });
        await screen('shell', 'more-memory-current', async cell => { await more().click(); await visible(cell, 'MEMORY_LINK_VISIBLE', memoryLink()); check(cell, 'MEMORY_CURRENT_ONLY', await memoryLink().getAttribute('aria-current') === 'page' && await profileLink().getAttribute('aria-current') !== 'page'); });
      } else {
        for (const route of ['profile', 'memory']) await screen(route, `record-${route}`, async cell => { await load(route); await visible(cell, 'DIRECT_RECORD_PAGE_VISIBLE', page.locator('main h1').first()); check(cell, 'DIRECT_RECORD_ROUTE', new URL(page.url()).hash.startsWith(`#/${route}`)); cell.interactionScope = 'direct route; mobile More does not exist at this viewport'; });
      }
      const watchKey = `arbor.screen.watch.${fixture.childId}`;
      let watchTitle;
      const watch = await screen('development', 'watch-chosen', async cell => { if (!fixture.watch) throw new Error('SYNTHETIC_WATCH_MILESTONE_MISSING'); await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: watchKey, value: fixture.watch }); await load('development'); await visible(cell, 'CHOSEN_WATCH_CLEAR_VISIBLE', byId('portrait-unwatch')); await byId('portrait-watch').scrollIntoViewIfNeeded(); watchTitle = await page.locator('#portrait-watch-title').textContent(); check(cell, 'CHOSEN_WATCH_DETAILS_OPEN', await byId('portrait-watch-details').evaluate(el => el.open)); cell.fixture = 'synthetic-local-watch-choice'; });
      const cleared = await screen('development', 'watch-cleared', async cell => { dependent(watch); await byId('portrait-unwatch').click(); await visible(cell, 'WATCH_UNDO_VISIBLE', byId('portrait-watch-undo')); check(cell, 'WATCH_STORAGE_CLEARED', await page.evaluate(key => localStorage.getItem(key), watchKey) === null); check(cell, 'WATCH_CLEAR_CONTROL_REMOVED', await byId('portrait-unwatch').count() === 0); });
      await screen('development', 'watch-undo', async cell => { dependent(cleared); await byId('portrait-watch-undo').click(); await visible(cell, 'WATCH_CLEAR_RESTORED', byId('portrait-unwatch')); check(cell, 'WATCH_EXACT_CHOICE_RESTORED', await page.evaluate(key => localStorage.getItem(key), watchKey) === JSON.stringify(fixture.watch)); check(cell, 'WATCH_SAME_TITLE', await page.locator('#portrait-watch-title').textContent() === watchTitle); check(cell, 'WATCH_UNDO_REMOVED', await byId('portrait-watch-undo').count() === 0); });
    } else {
      const toggle = () => composer().locator('.companion-tools-toggle');
      const tools = () => composer().locator('.companion-secondary-tools');
      const consent = () => composer().locator('.companion-consent');
      const review = async () => { await toggle().click(); await tools().getByRole('button', { name: he ? 'הרשאות לקבצים' : 'File permissions', exact: true }).click(); await consent().waitFor({ state: 'visible' }); };
      const closeReview = () => consent().getByRole('button', { name: he ? 'חזרה לטיוטה' : 'Back to my draft', exact: true }).click();
      const draft = he ? 'זו טיוטת דוגמה מומצאת על בחירת ספר יחד.' : 'This is an invented draft about choosing a book together.';
      const ready = await screen('shell', group === 'ask-diagnostic' ? 'launcher-composer' : 'tools-closed', async cell => {
        await load('overview'); await visible(cell, 'LAUNCHER_VISIBLE', byId('companion-launcher')); await openConversation(); await visible(cell, 'COMPOSER_VISIBLE', composer());
        // The narrow diagnostic deliberately works on the older baseline too.
        // It cannot depend on controls introduced by the release under test.
        if (group !== 'ask-diagnostic') check(cell, 'TOOLS_INITIALLY_COLLAPSED', await toggle().getAttribute('aria-expanded') === 'false' && !await tools().isVisible());
      });
      // The actual sandbox path comes first, before any synthetic API response.
      // A presentation fixture can never conceal failed mock-answer readiness.
      await screen('shell', 'ask-mock-answer', async cell => { dependent(ready); apiState.chat = 'mock'; await composer().locator('textarea').fill(he ? 'איך אפשר לבחור ספר לקריאה יחד?' : 'How can we choose a book to read together?'); await composer().locator('[data-testid="coach-send"]').click(); const answer = byId('coach-answer-cards').last(); await answer.waitFor({ state: 'visible', timeout: 30000 }); await answer.scrollIntoViewIfNeeded(); check(cell, 'ACTUAL_MOCK_REQUEST_OBSERVED', apiState.mockRequests > 0); check(cell, 'ACTUAL_MOCK_RESPONSE_OBSERVED', apiState.mockResponses > 0); await visible(cell, 'ACTUAL_MOCK_ANSWER_RENDERED', answer); cell.fixture = 'actual-local-mock-server-response'; });
      if (group !== 'ask-diagnostic') {
      await screen('shell', 'tools-open', async cell => { dependent(ready); await toggle().click(); await visible(cell, 'TOOLS_VISIBLE', tools()); check(cell, 'TOOLS_EXPANDED', await toggle().getAttribute('aria-expanded') === 'true'); check(cell, 'TOOLS_FIVE_REAL_ACTIONS', await tools().locator('button:visible').count() === 5); });
      await screen('shell', 'tools-escape', async cell => { dependent(ready); await tools().getByRole('button', { name: he ? 'הרשאות לקבצים' : 'File permissions', exact: true }).focus(); await page.keyboard.press('Escape'); check(cell, 'TOOLS_ESCAPE_CLOSED', await toggle().getAttribute('aria-expanded') === 'false' && !await tools().isVisible()); check(cell, 'TOOLS_FOCUS_RETURNED', await toggle().evaluate(el => document.activeElement === el)); check(cell, 'CONVERSATION_REMAINS_OPEN', await conversation().isVisible()); });
      const permission = await screen('shell', 'consent-review', async cell => { dependent(ready); await composer().locator('textarea').fill(draft); await review(); await visible(cell, 'CONSENT_CHECKBOX_VISIBLE', consent().locator('input[type="checkbox"]')); check(cell, 'CONSENT_DEFAULT_UNCHECKED', !await consent().locator('input[type="checkbox"]').isChecked()); check(cell, 'CONSENT_GRANT_DISABLED', await consent().locator('.companion-consent-allow').isDisabled()); check(cell, 'CONSENT_NOT_WRITTEN_ON_REVIEW', apiState.consentWrites === 0); });
      const readError = await screen('shell', 'consent-read-error', async cell => { dependent(permission); await closeReview(); apiState.consent = 'read-error'; await review(); await visible(cell, 'CONSENT_READ_ERROR_VISIBLE', consent().locator('[role="alert"]')); check(cell, 'CONSENT_READ_FIXTURE_USED', apiState.consentReads >= 2); });
      await screen('shell', 'consent-read-retry', async cell => { dependent(readError); apiState.consent = 'empty'; await consent().getByRole('button', { name: he ? 'בדיקה נוספת' : 'Check again', exact: true }).click(); await consent().locator('[role="alert"]').waitFor({ state: 'hidden' }); check(cell, 'CONSENT_READ_RECOVERED', await consent().locator('[role="alert"]').count() === 0); check(cell, 'CONSENT_RETRY_STILL_UNCHECKED', !await consent().locator('input[type="checkbox"]').isChecked()); });
      await screen('shell', 'consent-grant-error', async cell => { dependent(permission); await consent().locator('input[type="checkbox"]').check(); await consent().locator('.companion-consent-allow').click(); await visible(cell, 'CONSENT_GRANT_ERROR_VISIBLE', consent().locator('[role="alert"]')); check(cell, 'ONLY_SYNTHETIC_GRANT_ATTEMPT', apiState.consentWrites === 1); check(cell, 'CONSENT_REMAINS_REVIEWABLE', await consent().locator('input[type="checkbox"]').isChecked()); });
      await screen('shell', 'consent-draft-return', async cell => { dependent(permission); await closeReview(); await visible(cell, 'COMPOSER_DRAFT_RETURNED', composer().locator('textarea')); check(cell, 'DRAFT_PRESERVED_THROUGH_ERRORS', await composer().locator('textarea').inputValue() === draft); check(cell, 'NO_FILES_SELECTED', await composer().locator('.companion-attachments').count() === 0); });
      for (const kind of ['generic', 'quota']) await screen('shell', `ask-error-${kind}`, async cell => { dependent(ready); apiState.chat = kind; await composer().locator('textarea').fill(draft); await composer().locator('[data-testid="coach-send"]').click(); const failure = byId('coach-failure-card'); await visible(cell, 'CHAT_FAILURE_VISIBLE', failure); await page.waitForFunction(expected => document.querySelector('[data-testid="coach-failure-card"]')?.getAttribute('data-failure-kind') === expected, kind); check(cell, 'CORRECT_CHAT_FAILURE_KIND', await failure.getAttribute('data-failure-kind') === kind); check(cell, 'CHAT_RETRY_MATCHES_FAILURE', kind === 'generic' ? await failure.locator('button').count() === 1 : await failure.locator('button').count() === 0); cell.fixture = 'bounded-chat-error-response'; });
      const reportReady = await screen('shell', 'report-fixture', async cell => { await load('overview'); await openConversation(); apiState.chat = 'report'; await composer().locator('textarea').fill(he ? 'נא להציג את הדוגמה המומצאת לצילום.' : 'Show the invented capture example.'); await composer().locator('[data-testid="coach-send"]').click(); const report = byId('coach-answer-cards').last(); await visible(cell, 'REPORT_FIXTURE_RENDERED', report); check(cell, 'REPORT_FIXTURE_DIRECTION', await report.getAttribute('dir') === (he ? 'rtl' : 'ltr')); check(cell, 'REPORT_FIXTURE_API_USED', apiState.fixtureRequests > 0); cell.fixture = 'bilingual-report-presentation-fixture'; });
      const report = () => byId('coach-answer-cards').last();
      const sections = [
        ['opening', '[data-testid="coach-report-opening"]'], ['document', '[data-testid="coach-report-document"]'],
        ['understanding', '[data-testid="coach-report-understanding"]'], ['next', '[data-testid="coach-report-next"]'],
        ['script', '[data-testid="say-this"]'], ['observe', '[data-testid="coach-report-observe"]'], ['avoid', '[data-testid="coach-report-avoid"]'],
        ['help-closed', '[data-testid="coach-report-help"]'], ['help-open', '[data-testid="coach-report-help"]'],
        ['sources-closed', '[data-testid="coach-report-sources"]'], ['sources-open', '[data-testid="coach-report-sources"]'],
        ['council', '.coach-report__council'], ['footer', '[data-testid="coach-answer-footer"]'],
      ];
      for (const [section, selector] of sections) await screen('shell', `report-${section}`, async cell => {
        dependent(reportReady); const target = report().locator(selector); await target.scrollIntoViewIfNeeded(); await visible(cell, 'REPORT_SECTION_VISIBLE', target); cell.fixture = 'bilingual-report-presentation-fixture';
        if (section.endsWith('-open') || section.endsWith('-closed')) {
          const open = section.endsWith('-open'); const control = target.locator(':scope > button');
          if (open) await control.click();
          check(cell, 'REPORT_DISCLOSURE_STATE', await control.getAttribute('aria-expanded') === String(open));
          check(cell, 'REPORT_DISCLOSURE_CONTENT_VISIBILITY', await target.locator('.coach-report__disclosure-body').isVisible() === open);
        } else check(cell, 'REPORT_SECTION_HAS_CONTENT', (await target.textContent())?.trim().length > 0);
        if (section === 'next') check(cell, 'ALL_TODAY_STEPS_RENDERED', await target.locator('ol > li').count() === syntheticReleaseReport(lang).contract.todayPlan.length);
        if (section === 'understanding') check(cell, 'ALL_HYPOTHESES_RENDERED', await target.locator('ul > li').count() === syntheticReleaseReport(lang).contract.nonDiagnosticHypotheses.length);
      });
      }
    }
    doc.finished = true;
    save();
    doc.completed = doc.missingEvidence.length === 0;
    save();
    return doc;
  } finally {
    save();
    if (context) await context.close().catch(() => {});
    await browser.close();
  }
}
