/** Read-only comparison of actual Crank rendering under native/controlled time.
 * No game state, renderer, style or completion hook is changed by this probe. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';
import { pauseMakerClock } from './kids-maker-cycle-browser.mjs';
import { installGameCycleAudioProbe } from './kids-game-cycle-browser.mjs';

const output = path.resolve('output/kids-crank-render-diagnostic');
await mkdir(output, { recursive: true });
const metadata = { sha: process.env.GITHUB_SHA ?? null, expected: 8, appSource: 'unchanged c8 game source', fixture: 'synthetic Studio Home → Playbank → How Things Move', started: new Date().toISOString() };
await writeFile(path.join(output, 'run.json'), JSON.stringify(metadata, null, 2));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.aac': 'audio/aac' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.includes('..') || pathname.startsWith('/_proof') || pathname.startsWith('/api')) { res.statusCode = 404; res.end('{}'); return; }
    const root = pathname.startsWith('/visuals/') || pathname.startsWith('/fonts/') || pathname.startsWith('/audio/') ? 'public' : 'dist-studio-preview';
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('Not found'); }
});

// Observers record reflected width/height writes and actual content-box changes.
// They never wrap the renderer or assign any DOM/style/canvas property.
function observeCanvasLifetime() {
  window.crankDiagnostic = { writes: [], sizes: [], contextEvents: [], frames: 0, frameTimes: [] };
  const log = window.crankDiagnostic, observed = new WeakSet();
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) if (log.sizes.length < 400) log.sizes.push({ at: performance.now(), width: entry.contentRect.width, height: entry.contentRect.height });
  });
  const discover = () => {
    const world = document.querySelector('.ck-world');
    if (world && !observed.has(world)) { observed.add(world); resize.observe(world); }
  };
  const mutation = new MutationObserver(entries => {
    for (const entry of entries) if (entry.target instanceof HTMLCanvasElement && entry.target.classList.contains('ck-canvas') && log.writes.length < 1000) {
      log.writes.push({ at: performance.now(), name: entry.attributeName, old: entry.oldValue, value: entry.target.getAttribute(entry.attributeName), width: entry.target.width, height: entry.target.height });
    }
    discover();
  });
  mutation.observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['width', 'height'] });
  for (const event of ['contextlost', 'contextrestored']) document.addEventListener(event, e => {
    if (e.target instanceof HTMLCanvasElement && e.target.classList.contains('ck-canvas')) log.contextEvents.push({ at: performance.now(), event });
  }, true);
  const frame = at => { log.frames++; if (log.frameTimes.length >= 12) log.frameTimes.shift(); log.frameTimes.push(at); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}

// Read a detached 64² copy; the game's existing context is never requested or
// altered, avoiding willReadFrequently warnings and preserving its renderer.
function readCanvas() {
  const canvas = document.querySelector('.ck-canvas');
  if (!canvas) return { mounted: false, at: performance.now() };
  const rect = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
  const ancestors = []; let opacity = 1;
  for (let node = canvas; node; node = node.parentElement) {
    const style = getComputedStyle(node); opacity *= Number(style.opacity);
    ancestors.push({ tag: node.tagName, class: node.className, display: style.display, visibility: style.visibility, opacity: style.opacity, transform: style.transform, rect: rect(node) });
  }
  const copy = document.createElement('canvas'); copy.width = 64; copy.height = 64;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Detached bitmap reader unavailable');
  if (canvas.width > 0 && canvas.height > 0) ctx.drawImage(canvas, 0, 0, 64, 64);
  const pixels = ctx.getImageData(0, 0, 64, 64).data, colours = new Map();
  let nontransparent = 0, opaque = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]) nontransparent++;
    if (pixels[i + 3] === 255) opaque++;
    const key = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`;
    colours.set(key, (colours.get(key) ?? 0) + 1);
  }
  const box = rect(canvas), centre = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  return { mounted: true, at: performance.now(), width: canvas.width, height: canvas.height, box, opacity, ancestors,
    phase: document.querySelector('.ck-world')?.dataset, samplePixels: 4096, nontransparent, opaque, uniqueColours: colours.size,
    commonColours: [...colours].sort((a, b) => b[1] - a[1]).slice(0, 5), centreHit: centre ? { tag: centre.tagName, class: centre.className } : null,
    lifetime: structuredClone(window.crankDiagnostic) };
}
const hasPaint = probe => probe.mounted && probe.box.width > 0 && probe.box.height > 0 && probe.opacity >= 0.99 && probe.nontransparent > 3000 && probe.uniqueColours > 128;

let browser;
const rows = [], cells = RELEASE_VIEWPORTS.flatMap(viewport => ['native', 'controlled'].map(mode => ({ viewport, mode })));
assert.equal(cells.length, 8);
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`, origin = new URL(base).origin;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // Serial cells deliberately eliminate cross-page competition as a cause.
  for (const { viewport, mode } of cells) {
    const started = Date.now(), phone = viewport.id.startsWith('mobile-'), stem = `${viewport.id}-${mode}`;
    const record = { viewport: viewport.id, mode, complete: false, screenshots: [], probes: [], inputs: [], errors: [], brokenResources: [], unexpectedRequests: [] };
    let context, page;
    try {
      context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, reducedMotion: 'reduce', isMobile: phone, hasTouch: phone });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && ['/_proof/hero/sheet.json', '/_proof/scene/art.json'].includes(url.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        record.unexpectedRequests.push(url.href); return route.abort();
      });
      await context.addInitScript(() => { localStorage.setItem('arbor.kid.readAloud.muted.studio-v2-synthetic-review', '1'); Math.random = () => 0; });
      await context.addInitScript(installGameCycleAudioProbe);
      await context.addInitScript(observeCanvasLifetime);
      page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', e => record.errors.push(e.message));
      page.on('console', m => { if (['warning', 'error'].includes(m.type())) record.errors.push(m.text()); });
      page.on('response', response => { if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith('/favicon.ico')) record.brokenResources.push({ url: response.url(), status: response.status() }); });
      if (mode === 'controlled') await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') });
      const advance = ms => mode === 'native' ? page.waitForTimeout(ms) : page.clock.runFor(ms);
      const press = async (locator, purpose) => { if (phone) await locator.tap(); else await locator.click(); record.inputs.push(purpose); await advance(32); };
      const probe = async label => { const value = { label, ...await page.evaluate(readCanvas) }; record.probes.push(value); return value; };
      const capture = async (label, fullPage = true, animations = 'disabled') => {
        await probe(`${label}-before`);
        const filename = `${stem}-${label}.png`; await page.screenshot({ path: path.join(output, filename), fullPage, animations }); record.screenshots.push(filename);
        await probe(`${label}-after`);
      };
      const url = new URL(base); url.searchParams.set('lang', viewport.lang); url.searchParams.set('studioNext', '1');
      await page.goto(url.href); await page.locator('[data-studio-home]').waitFor({ state: 'visible' }); await page.evaluate(() => document.fonts.ready);
      await press(page.locator('button.studio-v2__door[data-world="playbank"]'), 'Home → Playbank');
      await press(page.locator('[data-studio-activity="crank-works"]'), 'How Things Move tile');
      await page.locator('[data-adventure="crank-works"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-studio-phase]').getAttribute('data-studio-phase'), 'play');
      if (mode === 'controlled') await pauseMakerClock(page);
      await capture('ready');
      if (mode === 'native') await page.locator('.ck-world[data-crank-phase="playing"]').waitFor({ state: 'visible', timeout: 6000 });
      else if (await page.locator('[data-play-skip]').count()) await press(page.locator('[data-play-skip]'), 'Authored opening button');
      await advance(300);
      // Exact existing driver's first fifteen real actions lead to its
      // "mechanism" capture. No hidden chapter/state change is introduced.
      for (let i = 0; i < 15; i++) {
        const step = await page.locator('.ck-world').getAttribute('data-crank-step');
        if (step === 'turnIt') { await press(page.locator('[data-crank-turn]'), step); await advance(600); }
        else if (step === 'lookIn') { await press(page.locator('[data-crank-look]'), step); await advance(3400); }
        else if (step === 'pickUp') { await press(page.locator('[data-crank-place]'), step); await advance(1600); }
        else if (step === 'testJoint') { await press(page.locator('[data-crank-test]'), step); await advance(2500); }
        else { assert.equal(step, 'bigShow', 'Only an authored idle phase may wait'); await advance(1000); }
      }
      await capture('mechanism-full-page');
      await advance(100); await capture('mechanism-viewport', false, 'allow');
      // Real one-pixel viewport resize; then ordinary RAF time to observe the
      // renderer's own recovery. Never invoke ResizeObserver or paint directly.
      await page.setViewportSize({ width: viewport.w, height: viewport.h - 1 });
      await probe('resize-immediate'); await advance(100); await capture('resized-viewport', false, 'allow');
      await page.setViewportSize({ width: viewport.w, height: viewport.h }); await advance(100);
      await capture('restored-full-page');
      record.assets = await page.evaluate(async () => {
        const names = ['crank-works-room.webp', 'crank-works-bench.webp', 'crank-works-anchorcheck.webp', 'kit-chock-mission-side.webp'];
        const resources = performance.getEntriesByType('resource').filter(entry => names.some(name => entry.name.endsWith(name))).map(entry => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize }));
        const decoded = [];
        for (const name of names) { const image = new Image(); image.src = `/visuals/studio-v2/makers/${name}`; await image.decode(); decoded.push({ name, width: image.naturalWidth, height: image.naturalHeight, complete: image.complete }); }
        return { resources, decoded };
      });
      record.audio = await page.evaluate(() => window.gameCycleAudio);
      assert.equal(record.audio.audibleSources + record.audio.media + record.audio.speech + record.audio.captures, 0);
      assert.deepEqual(record.errors, []); assert.deepEqual(record.brokenResources, []); assert.deepEqual(record.unexpectedRequests, []);
      record.complete = true;
      record.activePaint = record.probes.filter(p => /^(mechanism-|resized-viewport-|restored-full-page-)/.test(p.label)).map(p => ({ label: p.label, painted: hasPaint(p) }));
      assert.equal(record.activePaint.length, 8, 'All active, settled resize and restored before/after samples were collected');
      record.passed = record.activePaint.every(p => p.painted);
    } catch (error) {
      record.error = error.stack ?? String(error); record.passed = false;
      if (page) try { const filename = `${stem}-failed.png`; await page.screenshot({ path: path.join(output, filename), fullPage: true }); record.screenshots.push(filename); } catch (captureError) { record.captureError = String(captureError); }
    } finally {
      if (context) try { await context.close(); } catch (error) { record.teardownError = String(error); record.passed = false; }
      record.wallElapsedMs = Date.now() - started; rows.push(record);
      await writeFile(path.join(output, `${stem}.json`), JSON.stringify(record, null, 2));
      await writeFile(path.join(output, 'summary.json'), JSON.stringify({ ...metadata, complete: rows.length === 8, collected: rows.filter(r => r.complete).length, passed: rows.filter(r => r.passed).length, failed: rows.filter(r => !r.passed).length, rows }, null, 2));
      console.log(`${record.passed ? 'PASS' : 'FAIL'} Crank render ${stem} ${record.wallElapsedMs}ms (${rows.length}/8)`);
    }
  }
  assert.equal(rows.length, 8); assert.ok(rows.every(row => row.complete), 'Every comparative cell was collected');
  assert.ok(rows.every(row => row.passed), 'Every native and controlled active capture retains actual canvas paint');
} finally {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
