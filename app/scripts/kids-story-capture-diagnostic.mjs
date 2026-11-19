/** Observational only: same reader/source/bytes, no release-assertion replacement. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import { canonicalBookPaintReady } from './kids-story-paint.mjs';

const output = path.resolve('output/kids-story-capture-diagnostic');
await mkdir(output, { recursive: true });
const sourcePaths = ['app/src', 'app/public', 'app/package-lock.json', 'app/scripts/studio-v2-preview', 'app/scripts/kids-story-catalogue-browser.mjs', 'app/scripts/kids-story-paint.mjs'];
const metadata = {
  sha: process.env.GITHUB_SHA ?? null,
  scope: 'Observational capture lifecycle diagnostic, not a replacement for the complete120 release gate. Actual reader and authenticated synthetic plan plates; no private identity or cloud writes.',
  sourceObjects: Object.fromEntries(sourcePaths.map(file => [file, execFileSync('git', ['rev-parse', `HEAD:${file}`], { encoding: 'utf8' }).trim()])),
};
await writeFile(path.join(output, 'run.json'), JSON.stringify(metadata, null, 2));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
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

function observe() {
  const ids = new WeakMap(); let nextId = 1;
  const identity = element => {
    if (!(element instanceof Element)) return null;
    if (!ids.has(element)) ids.set(element, nextId++);
    return { id: ids.get(element), tag: element.tagName, class: element.className, page: element.getAttribute('data-book-page') };
  };
  const state = { events: [], raf: 0, dropped: 0 };
  const log = event => { if (state.events.length < 1500) state.events.push({ time: performance.now(), raf: state.raf, ...event }); else state.dropped++; };
  const tick = () => { state.raf++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  for (const type of ['animationstart', 'animationend', 'animationcancel', 'transitionrun', 'transitionend', 'transitioncancel']) {
    document.addEventListener(type, event => log({ type, target: identity(event.target), name: event.animationName ?? event.propertyName, elapsed: event.elapsedTime }), true);
  }
  new MutationObserver(records => {
    for (const record of records) {
      const element = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!element?.closest('[data-book-reader]') && element?.tagName !== 'STYLE') continue;
      log({ type: 'mutation', kind: record.type, target: identity(element), attribute: record.attributeName, value: record.attributeName ? element.getAttribute(record.attributeName) : undefined, added: [...record.addedNodes].map(identity).filter(Boolean), removed: [...record.removedNodes].map(identity).filter(Boolean) });
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'hidden'] });
  const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const styles = ['display', 'visibility', 'opacity', 'position', 'transform', 'transformOrigin', 'filter', 'backfaceVisibility', 'overflow', 'overflowX', 'overflowY', 'clipPath', 'maskImage', 'zIndex', 'isolation', 'mixBlendMode', 'contain', 'contentVisibility', 'pointerEvents'];
  window.captureObservation = (includeBitmap = false) => {
    const image = document.querySelector('[data-book-plate] > img');
    const chain = [];
    for (let element = image; element; element = element.parentElement) {
      const css = getComputedStyle(element);
      chain.push({ ...identity(element), box: rect(element), style: Object.fromEntries(styles.map(key => [key, css[key]])) });
    }
    const pixels = [];
    // Pixel readback can synchronize raster work. Do it only after the
    // three original captures, never as a hidden readiness intervention.
    if (includeBitmap && image?.complete && image.naturalWidth > 0) {
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      for (const [x, y] of [[96, 96], [96, 800], [192, 96]]) {
        try { ctx.clearRect(0, 0, 1, 1); ctx.drawImage(image, x, y, 1, 1, 0, 0, 1, 1); pixels.push({ x, y, rgba: [...ctx.getImageData(0, 0, 1, 1).data] }); }
        catch (error) { pixels.push({ x, y, error: String(error) }); }
      }
    }
    const art = document.querySelector('[data-book-art]'); const box = art ? rect(art) : null;
    const occlusion = box ? [[.1, .1], [.5, .3], [.9, .6]].map(([rx, ry]) => {
      const x = box.x + box.width * rx, y = box.y + box.height * ry;
      return { x, y, elements: document.elementsFromPoint(x, y).slice(0, 8).map(identity) };
    }) : [];
    return {
      time: performance.now(), raf: state.raf, page: document.querySelector('[data-book-page]')?.getAttribute('data-book-page'),
      image: image ? { ...identity(image), src: image.currentSrc, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight, pixels } : null,
      chain, occlusion,
      animations: document.getAnimations().map(animation => ({ target: identity(animation.effect?.target), name: animation.animationName, playState: animation.playState, currentTime: animation.currentTime, startTime: animation.startTime, timing: animation.effect?.getComputedTiming() })),
      events: state.events.splice(0), droppedEvents: state.dropped,
    };
  };
  HTMLMediaElement.prototype.play = function () { throw new Error('No media playback in this observational fixture'); };
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new Error('No capture in this observational fixture'); };
  if (window.speechSynthesis) window.speechSynthesis.speak = () => { throw new Error('No narration synthesis in this observational fixture'); };
}

async function runCell(browser, base, cell) {
  const directory = path.join(output, cell.label); await mkdir(directory, { recursive: true });
  const context = await browser.newContext({ viewport: cell.viewport, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const result = { ...cell, frames: [], errors: [], requests: [], unexpected: [], complete: false };
  const persist = () => writeFile(path.join(directory, 'observations.json'), JSON.stringify(result, null, 2));
  page.on('pageerror', error => result.errors.push(error.message));
  await context.addInitScript(observe);
  let firstFailure = false;
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#edf1ee'; ctx.fillRect(0, 0, 1536, 1024);
    ctx.fillStyle = '#d5e1df'; ctx.fillRect(0, 696, 1536, 328); ctx.strokeStyle = '#93aca8'; ctx.lineWidth = 3;
    for (let x = 192; x < 1536; x += 192) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== new URL(base).origin) { result.unexpected.push(request.url()); return route.abort(); }
    if (url.pathname === '/api/children/catalogue-synthetic-review/book-assets/plan-poo-sit/file' && url.searchParams.get('path') === 'manifest.json') return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (url.pathname.startsWith('/api/plans/plates/plan-poo-sit/')) {
      const status = firstFailure ? 200 : 404; firstFailure = true;
      result.requests.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization, status });
      return route.fulfill(status === 404 ? { status, contentType: 'application/json', body: '{}' } : { status, contentType: 'image/png', body: png });
    }
    if (url.pathname.startsWith('/api/')) { result.unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    return route.continue();
  });
  const ready = async () => {
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-book-plate] > img');
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    });
    await page.locator('[data-book-plate] > img').evaluate(img => img.decode());
  };
  const prepare = async () => {
    await ready();
    await page.evaluate(async finish => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll('[data-book-reader] img')].map(img => img.decode().catch(() => {})));
      if (finish) document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).forEach(animation => { try { animation.finish(); } catch {} });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, cell.completion === 'explicit-finish');
    // Native variant observes actual finite animation completion. No clock,
    // styles, durations or source values are changed in either variant.
    if (cell.completion === 'native') await page.waitForFunction(() => document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).every(animation => animation.playState === 'finished' || animation.playState === 'idle'));
    await page.waitForFunction(canonicalBookPaintReady, { expectedChoiceIds: [] }, { timeout: 12000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const capture = async name => {
    await prepare();
    // Reproduce the real catalogue's measurement and control-reachability
    // work between its paint wait and screenshot, without changing values.
    await page.locator('[data-book-para]').evaluateAll(elements => elements.map(element => { const range = document.createRange(); range.selectNodeContents(element); return { box: element.getBoundingClientRect().toJSON(), lines: [...range.getClientRects()].map(r => r.toJSON()), font: getComputedStyle(element).fontSize }; }));
    for (const button of await page.locator('[data-book-reader] button:visible:enabled').all()) { await button.scrollIntoViewIfNeeded(); await button.boundingBox(); }
    await page.locator('[data-reading-scroll]').evaluateAll(elements => elements.forEach(element => { element.scrollTop = 0; }));
    const frame = { name, captures: [] };
    for (const animation of cell.order) {
      const before = await page.evaluate(() => window.captureObservation());
      const file = `${name}-${animation}.png`;
      await page.screenshot({ path: path.join(directory, file), animations: animation });
      const after = await page.evaluate(() => window.captureObservation());
      frame.captures.push({ file, animation, before, after });
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    frame.afterTwoRaf = await page.evaluate(() => window.captureObservation());
    const file = `${name}-after-raf-allow.png`;
    await page.screenshot({ path: path.join(directory, file), animations: 'allow' });
    frame.afterTwoRafFile = file;
    frame.decodedAfterCaptures = await page.evaluate(() => window.captureObservation(true));
    result.frames.push(frame); await persist();
  };
  try {
    await page.goto(`${base}/?storyCatalogue=plan&id=plan-poo-sit&lang=en&gender=girl`);
    await page.waitForFunction(() => Boolean(window.storyCatalogueFixture) && document.documentElement.classList.contains('msr-ready'));
    const spec = await page.evaluate(() => window.storyCatalogueFixture); assert.equal(spec.id, 'plan-poo-sit'); assert.equal(spec.paths.length, 1);
    await page.locator('[data-book-picture-retry]').waitFor({ state: 'visible' }); await page.locator('[data-book-picture-retry]').click();
    await capture('cover'); await page.locator('[data-book-open]').click();
    for (const authored of spec.paths[0].pages) {
      await page.locator(`[data-book-page="${authored.id}"]`).waitFor({ state: 'visible' }); await capture(authored.id);
      for (let click = 0; click < 12; click++) {
        await page.locator('[data-book-next]').click(); await ready(); await prepare();
        if (await page.locator('[data-book-page]').getAttribute('data-book-page') !== authored.id) break;
        if (click === 11) throw new Error(`${authored.id}: actual Next did not advance`);
      }
    }
    await page.locator('[data-book-page="end"]').waitFor({ state: 'visible' });
    assert.ok(result.requests.every(r => r.method === 'GET' && r.authorization === 'Bearer synthetic-story-catalogue'));
    assert.equal(result.unexpected.length, 0); assert.equal(result.errors.length, 0); result.complete = true;
  } catch (error) { result.failure = String(error); }
  finally { await persist(); await context.close(); }
  return result;
}

let browser;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const cells = [];
  for (const [device, viewport] of [['desktop', { width: 1280, height: 800 }], ['landscape', { width: 844, height: 390 }]]) {
    for (const completion of ['explicit-finish', 'native']) for (const first of ['disabled', 'allow']) for (let repeat = 1; repeat <= 2; repeat++) {
      cells.push({ label: `${device}-${completion}-${first}-first-${repeat}`, viewport, completion, order: first === 'disabled' ? ['disabled', 'allow'] : ['allow', 'disabled'] });
    }
  }
  let index = 0; const results = new Array(cells.length);
  await Promise.all([0, 1, 2].map(async () => {
    while (index < cells.length) {
      const at = index++; results[at] = await runCell(browser, base, cells[at]);
      console.log(`[capture-observation] ${results[at].complete ? 'COMPLETE' : 'FAILED'} ${cells[at].label} ${results[at].frames.length} pages`);
    }
  }));
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ ...metadata, cells: results.map(({ frames, ...cell }) => ({ ...cell, frames: frames.length })) }, null, 2));
  assert.ok(results.every(result => result.complete), 'every observational reader must finish; this says nothing about PNG painting acceptance');
} finally { await browser?.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
