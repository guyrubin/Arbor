/** Execute the actual service worker and production registration block against
 * two real browser clients. Synthetic drafts/public art; no cloud or family data.
 * This tests update continuity, not acoustic timing or personal avatar likeness. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const worker = await readFile('public/sw.js', 'utf8');
const main = await readFile('src/main.tsx', 'utf8');
const registrationStart = main.indexOf("if (import.meta.env.PROD && 'serviceWorker' in navigator)");
assert.ok(registrationStart > 0, 'Production registration seam exists');
const registration = main.slice(registrationStart).replace('import.meta.env.PROD', 'true');
let version = 'browser-v1';
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<label>Unfinished creation<input id="draft"></label>
<script>window.bootNonce=Math.random();${registration}</script></body></html>`;
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/sw.js') {
    res.setHeader('Content-Type', 'application/javascript'); res.end(worker.replaceAll('__BUILD_ID__', version));
  } else if (url.pathname === '/visuals/test.webp') {
    res.setHeader('Content-Type', 'text/plain'); res.end(version + '-art');
  } else if (url.pathname === '/fonts/material-symbols-rounded-subset.woff2') {
    res.setHeader('Content-Type', 'application/octet-stream'); res.end('synthetic-cache-fixture');
  } else if (url.pathname === '/' || url.pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  } else { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext();
  const a = await context.newPage(); const errors = [];
  a.on('pageerror', e => errors.push(e.message));
  await a.goto(base);
  await a.evaluate(() => navigator.serviceWorker.ready);
  await a.reload(); await a.waitForFunction(() => !!navigator.serviceWorker.controller);
  const b = await context.newPage(); b.on('pageerror', e => errors.push(e.message));
  await b.goto(base); await b.waitForFunction(() => !!navigator.serviceWorker.controller);
  await a.locator('#draft').fill('unfinished melody');
  await b.locator('#draft').fill('unfinished room');
  const boots = await Promise.all([a, b].map(page => page.evaluate(() => window.bootNonce)));
  assert.equal(await a.evaluate(async () => (await fetch('/visuals/test.webp')).text()), 'browser-v1-art');

  version = 'browser-v2';
  await a.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
  await a.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting, null, { timeout: 30000 });
  assert.deepEqual(await Promise.all([a, b].map(page => page.evaluate(() => window.bootNonce))), boots, 'Neither open client reloaded');
  assert.equal(await a.locator('#draft').inputValue(), 'unfinished melody');
  assert.equal(await b.locator('#draft').inputValue(), 'unfinished room');
  await a.close();
  assert.ok(await b.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), 'One remaining client still protects its session');
  assert.equal(await b.locator('#draft').inputValue(), 'unfinished room');
  await b.close();

  const fresh = await context.newPage(); fresh.on('pageerror', e => errors.push(e.message));
  await fresh.goto(base);
  await fresh.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    return !reg?.waiting && reg?.active?.state === 'activated' && keys.includes('arbor-shell-browser-v2') && !keys.includes('arbor-shell-browser-v1');
  }, null, { timeout: 30000 });
  if (!await fresh.evaluate(() => !!navigator.serviceWorker.controller)) await fresh.reload();
  await fresh.evaluate(() => fetch('/visuals/test.webp'));
  await fresh.waitForFunction(async () => {
    const response = await (await caches.open('arbor-kid-art-v1')).match('/visuals/test.webp');
    return response && await response.text() === 'browser-v2-art';
  });
  await context.setOffline(true);
  assert.equal(await fresh.evaluate(async () => (await fetch('/visuals/test.webp')).text()), 'browser-v2-art', 'Refreshed art works offline');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['two-client-draft-continuity', 'waiting-worker', 'last-client-activation', 'stable-art-revalidation', 'offline-art'], pageErrors: errors }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
