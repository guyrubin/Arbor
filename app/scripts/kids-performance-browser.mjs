/** Actual game components with synthetic records; no cloud writes or private avatars. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
const output = path.resolve('output/kids-performance');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.includes('..') || pathname.startsWith('/_proof') || pathname.startsWith('/api')) { res.statusCode = 404; res.end('{}'); return; }
    const root = pathname.startsWith('/visuals/') || pathname.startsWith('/fonts/') ? 'public' : 'dist-studio-preview';
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const games = [
  { id: 'river-rescue', world: 'playbank', chunk: 'RiverRescue', en: 'Canal Quest', he: 'מסע בתעלות' },
  { id: 'feelings-forest', world: 'feelings', chunk: 'FeelingsForest', en: 'Story Theater', he: 'תיאטרון הסיפורים' },
  { id: 'rhythm-garden', world: 'studio', chunk: 'RhythmGarden', en: 'Sound Orbit', he: 'מסלול הצלילים' },
];
let browser; const results = [];
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  for (const width of [375, 1280]) for (const lang of ['en', 'he']) for (const game of games) {
    const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 800 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await context.addInitScript(() => {
      Math.random = () => 0;
      window.qa = { audio: [], captures: 0 };
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.qa.captures++; throw new Error('Capture forbidden in fixture'); };
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function(...args) {
        const node = original.apply(this, args), record = { starts: [], stops: [], ended: false };
        window.qa.audio.push(record);
        node.addEventListener('ended', () => { record.ended = true; });
        const start = node.start.bind(node), stop = node.stop.bind(node);
        node.start = when => { record.starts.push(when); return start(when); };
        node.stop = when => { record.stops.push(when ?? null); return stop(when); };
        return node;
      };
    });
    const page = await context.newPage(), errors = [], brokenArt = [], browserLog = [], chunks = new Set();
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) browserLog.push(message.text()); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', res => {
      const url = res.url();
      if (url.includes('/assets/')) chunks.add(url);
      if (url.includes('/visuals/') && res.status() >= 400) brokenArt.push(url);
    });
    try {
      await page.goto(`${base}/?lang=${lang}`);
      await page.locator('[data-studio-home]').waitFor();
      await page.waitForTimeout(450);
      assert.ok(![...chunks].some(url => /RiverRescue-|RhythmGarden-|FeelingsForest-|SneakFreeze-/.test(url)), 'Home does not fetch unrelated game modules');
      await page.locator(`button.studio-v2__door[data-world="${game.world}"]`).click();
      await page.locator('button.studio-v2__activity').filter({ hasText: game[lang] }).click();
      await page.locator('[data-studio-phase="intro"]').waitFor();
      await page.waitForFunction(chunk => performance.getEntriesByType('resource').some(entry => entry.name.includes('/assets/' + chunk + '-')), game.chunk);
      const start = Date.now();
      await page.locator('[data-studio-start]').click();
      await page.locator(`[data-adventure="${game.id}"]`).waitFor();
      const warmPlayMs = Date.now() - start;
      assert.equal(await page.locator(`[data-adventure="${game.id}"]`).getAttribute('dir'), lang === 'he' ? 'rtl' : 'ltr');
      if (game.id === 'river-rescue') {
        const sail = page.getByRole('button', { name: lang === 'he' ? 'יוצאים לשיט' : 'Set sail', exact: true });
        assert.ok(await sail.isDisabled());
        for (const cell of [3, 4, 1, 2]) await page.locator(`button[data-cell="${cell}"]`).click();
        assert.ok(await sail.isEnabled()); await sail.click();
        await page.locator('.river-landscape[data-phase="arrived"]').waitFor();
      } else if (game.id === 'feelings-forest') {
        const choices = page.locator('button[data-feeling]');
        const count = await choices.count();
        for (let index = 0; index < count && await choices.count(); index++) await choices.nth(index).click();
        await page.locator('.forest-choices--support button').first().click();
        await page.locator('.forest-stage[data-phase="outcome"]').waitFor();
      } else {
        await page.getByRole('button', { name: lang === 'he' ? 'להראות את המנגינה' : 'Show the tune', exact: true }).click();
        // Instrument envelopes are 350ms; do not count the independent 70ms UI tap cue.
        const schedule = await page.evaluate(() => window.qa.audio.filter(record => record.starts.length && Math.abs(record.stops[0] - record.starts[0] - .35) < .00001));
        assert.equal(schedule.length, 2, 'Two notes scheduled synchronously: ' + JSON.stringify(await page.evaluate(() => ({ audio: window.qa.audio, hidden: document.visibilityState, mute: document.querySelector('[data-kid-sound]')?.getAttribute('aria-pressed'), quiet: document.querySelector('.adventure-quiet')?.textContent, phase: document.querySelector('.rhythm-stage')?.getAttribute('data-phase'), activated: navigator.userActivation?.hasBeenActive }))));
        assert.ok(Math.abs(schedule[1].starts[0] - schedule[0].starts[0] - .760) < .00001, 'One audio-clock tempo');
        await page.getByRole('button', { name: lang === 'he' ? 'הפסקה' : 'Pause', exact: true }).click();
        assert.ok(await page.evaluate(() => window.qa.audio.filter(record => record.starts.length && Math.abs(record.stops[0] - record.starts[0] - .35) < .00001).every(record => record.ended || record.stops.length >= 2)), 'Pause cancels even future notes');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await page.screenshot({ path: path.join(output, `${game.id}-${lang}-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => window.qa.captures), 0);
      assert.deepEqual(errors, []); assert.deepEqual(brokenArt, []); assert.equal(overflow, false, 'No horizontal document overflow');
      results.push({ game: game.id, lang, width, warmPlayMs, passed: true, overflow, pageErrors: errors, brokenArt });
    } catch (error) {
      await page.screenshot({ path: path.join(output, `failed-${game.id}-${lang}-${width}.png`), fullPage: true }).catch(() => {});
      const details = { game: game.id, lang, width, error: String(error), pageErrors: errors, browserLog, body: await page.locator('body').innerText().catch(() => '') };
      console.error(JSON.stringify(details, null, 2));
      await writeFile(path.join(output, 'failure.json'), JSON.stringify(details, null, 2));
      throw error;
    } finally { await context.close(); }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ fixture: 'synthetic-preview; actual game components and assets', results }, null, 2));
  console.log(JSON.stringify({ passed: true, cases: results.length, results }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
