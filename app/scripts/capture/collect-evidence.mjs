/** Bounded current-selector evidence. Synthetic/local only; no historical sweep. */
import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE, FONT_LIMITATION, assertLoopbackOnly } from './config.mjs';
import { SMALL_FIXTURE, initializeSyntheticOnline, missingSmallEvidence } from './small-state.mjs';
import { fontMode } from './font-cache.mjs';
import { SOURCE_FONT_NOTE, captureFontContextOptions, installOfflineFonts, captureScreenshot } from './font-runtime.mjs';

assertLoopbackOnly(networkInterfaces());
if (process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('OFFLINE_CONTAINER_REQUIRED');
const output = '/capture-output';
const bundle = readFileSync('.data/demo-family.json', 'utf8');
if (JSON.parse(bundle).child?.demo !== true) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
const mode = fontMode(process.env.ARBOR_CAPTURE_FONT_MODE);
const doc = { scope: 'small-mobile-current-selectors', fixture: SMALL_FIXTURE, fontMode: mode, fontLimitation: mode === 'exact' ? SOURCE_FONT_NOTE : FONT_LIMITATION, completed: false, cells: [] };
const save = () => { doc.missingEvidence = missingSmallEvidence(doc.cells); writeFileSync(`${output}/evidence.json`, JSON.stringify(doc, null, 2)); };
save();
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const cache = new Map();
try {
  for (const lang of ['en', 'he']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: lang === 'he' ? 'he-IL' : 'en-US', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block', permissions: [], ...captureFontContextOptions() });
    await context.route('**/*', (route) => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
    await context.routeWebSocket(() => true, () => {});
    await context.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== BASE) return route.abort();
      const cacheable = request.method() === 'GET' || (request.method() === 'POST' && ['/api/todays-focus', '/api/digest'].includes(url.pathname));
      if (!cacheable) return route.continue();
      const key = `${request.method()} ${url.href} ${request.postData() ?? ''}`;
      if (cache.has(key)) return route.fulfill(cache.get(key));
      try {
        const response = await route.fetch({ timeout: 15_000 });
        const entry = { status: response.status(), headers: response.headers(), body: await response.body() };
        if (response.status() === 200) cache.set(key, entry);
        return route.fulfill(entry);
      } catch { return route.abort().catch(() => {}); }
    });
    await context.route('**/sandbox/demo-family.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: bundle }));
    await installOfflineFonts(context);
    await context.addInitScript(initializeSyntheticOnline, { lang });
    const page = await context.newPage();
    page.setDefaultTimeout(8_000);
    // Diagnose cold lazy-module readiness without recording page text, prompts,
    // query strings, API payloads, headers or arbitrary console messages.
    const pendingModules = new Map();
    const moduleFailures = [];
    const runtimeErrors = [];
    const modulePath = (request) => {
      const url = new URL(request.url());
      return url.origin === BASE && ['script', 'stylesheet'].includes(request.resourceType())
        ? url.pathname.replace(/[^a-zA-Z0-9_./@-]/g, '').slice(0, 200) : null;
    };
    page.on('request', (request) => { const path = modulePath(request); if (path) pendingModules.set(request, { path, startedAt: Date.now() }); });
    page.on('requestfinished', (request) => pendingModules.delete(request));
    page.on('requestfailed', (request) => {
      const path = modulePath(request);
      if (path) moduleFailures.push({ path, kind: 'MODULE_REQUEST_FAILED' });
      pendingModules.delete(request);
    });
    page.on('response', (response) => { const path = modulePath(response.request()); if (path && response.status() >= 400) moduleFailures.push({ path, status: response.status() }); });
    page.on('pageerror', () => runtimeErrors.push('PAGE_SCRIPT_ERROR'));
    page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push('CONSOLE_ERROR'); });
    const diagnostics = () => ({
      pendingModules: [...pendingModules.values()].slice(-100).map(({ path, startedAt }) => ({ path, elapsedMs: Date.now() - startedAt })),
      moduleFailures: moduleFailures.slice(-100), runtimeErrors: runtimeErrors.slice(-100),
    });
    const load = async (route) => {
      await page.goto(`${BASE}/?capture=small-${lang}-${Date.now()}#/${route}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.locator('main h1, main [data-module]').first().waitFor({ state: 'visible', timeout: 30_000 });
    };
    const screen = async (route, state, action) => {
      const cell = { route, state, lang, viewport: '375x812', fontMode: mode, reached: false };
      doc.cells.push(cell); save();
      console.log(`Evidence screen: ${route}/${state}/${lang}; screenshots=${doc.cells.filter((c) => c.shot).length}.`);
      try {
        await action(cell);
        // Measure layout after the same font readiness required for the PNG.
        if (mode === 'exact') await page.evaluate(async () => {
          await Promise.race([document.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('FONT_READY_TIMEOUT')), 15_000))]);
        });
        Object.assign(cell, await page.evaluate(() => ({
          finalHash: location.hash,
          navigatorOnline: navigator.onLine,
          browserFixture: window.__arborCaptureFixture,
          elapsedSinceNavigationMs: Math.round(performance.now()),
          fontsStatus: document.fonts.status,
          fontFaces: [...document.fonts].map((font) => ({ family: font.family, status: font.status, weight: font.weight })),
          modules: [...document.querySelectorAll('main [data-module], main h1')].map((el) => { const box = el.getBoundingClientRect(); return { name: el.getAttribute('data-module') ?? 'h1', top: box.top, width: box.width, height: box.height }; }),
        })));
        if (cell.navigatorOnline !== true || cell.browserFixture?.connectivity !== 'synthetic-online') throw new Error('SYNTHETIC_ONLINE_STATE_MISSING');
        cell.shot = `shots/${route}.375x812.${lang}.${state}.${mode}.png`;
        await captureScreenshot(page, { path: `${output}/${cell.shot}`, timeout: 12_000, animations: 'disabled' });
        cell.reached = true;
      } catch (error) {
        cell.shot = null;
        // Static classification only. No raw browser/server logs or page text.
        cell.failure = /^FONT_[A-Z_]+$/.test(error?.message ?? '') || ['DEPENDENT_STATE_UNREACHED', 'SYNTHETIC_ONLINE_STATE_MISSING'].includes(error?.message) ? error.message : error?.name === 'TimeoutError' ? 'SELECTOR_OR_CAPTURE_TIMEOUT' : 'SCREEN_CAPTURE_FAILED';
        // A failed state is never counted as reached. Keep its actual pixels for
        // diagnosis, including any real app errors, instead of hiding the flaw.
        if (cell.failure !== 'DEPENDENT_STATE_UNREACHED') {
          const failureShot = `shots/${route}.375x812.${lang}.${state}.failure.fonts-unverified.png`;
          try { await page.screenshot({ path: `${output}/${failureShot}`, timeout: 5000, animations: 'disabled' }); cell.failureShot = failureShot; } catch { /* partial JSON still survives */ }
        }
      }
      cell.runtimeDiagnostics = diagnostics();
      save();
      return cell.reached;
    };
    await screen('overview', 'now', async () => { await load('overview'); await page.locator('[data-testid=companion-launcher]').waitFor({ state: 'visible' }); });
    const opened = await screen('shell', 'launcher-open', async (cell) => {
      const startedAt = Date.now();
      await page.locator('[data-testid=companion-launcher] .companion-launch-main').click();
      const composer = page.locator('.companion-conversation [data-testid=companion-composer] textarea');
      try { await composer.waitFor({ state: 'visible', timeout: 8_000 }); }
      catch (error) {
        if (error?.name !== 'TimeoutError') throw error;
        cell.pendingAt8s = diagnostics();
        cell.pendingShot = `shots/shell.375x812.${lang}.lazy-pending-8s.fonts-unverified.png`;
        await page.screenshot({ path: `${output}/${cell.pendingShot}`, timeout: 5000, animations: 'disabled' });
        save();
        // Keep slow development-server readiness visible as a finding. Do not
        // silently turn the original eight-second pending state into a pass.
        await composer.waitFor({ state: 'visible', timeout: 45_000 });
      }
      cell.composerReadyMs = Date.now() - startedAt;
      cell.slowLazyReadiness = cell.composerReadyMs > 8_000;
    });
    const answered = await screen('shell', 'structured-answer', async () => {
      if (!opened) throw new Error('DEPENDENT_STATE_UNREACHED');
      await page.locator('.companion-conversation [data-testid=companion-composer] textarea').fill(lang === 'he' ? 'הוא מתפרק כשאנחנו עוזבים את גן השעשועים' : 'He melts down when we leave the playground');
      await page.locator('.companion-conversation [data-testid=coach-send]').click();
      const report = page.locator('[data-testid=coach-answer-cards]').last();
      await report.waitFor({ state: 'visible', timeout: 25_000 });
      await report.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    });
    for (const section of ['understanding', 'next']) await screen('shell', `report-${section}`, async () => {
      if (!answered) throw new Error('DEPENDENT_STATE_UNREACHED');
      await page.locator(`[data-testid=coach-report-${section}]`).last().scrollIntoViewIfNeeded();
    });
    const togetherReady = await screen('practice', 'together-first-ready', async () => {
      await load('practice');
      await page.locator('[data-module=together-invitation]').waitFor({ state: 'visible' });
    });
    await screen('practice', 'together-after-3s', async () => { if (!togetherReady) throw new Error('DEPENDENT_STATE_UNREACHED'); await page.waitForTimeout(3000); });
    await screen('journal', 'journal', async () => { await load('journal'); });
    await screen('timeline', 'timeline', async () => { await load('timeline'); });
    await screen('shell', 'mobile-more', async () => {
      await load('overview');
      await page.locator('nav button[aria-expanded]').last().click();
      await page.locator('[role=dialog]').last().waitFor({ state: 'visible' });
    });
    await context.close();
  }
  doc.finished = true;
  doc.completed = missingSmallEvidence(doc.cells).length === 0;
  save();
  if (doc.missingEvidence.length) process.exitCode = 1;
} finally { save(); await browser.close(); }
