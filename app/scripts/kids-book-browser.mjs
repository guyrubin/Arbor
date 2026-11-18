/** Bounded actual-reader regression. Called by kids-performance-browser after
 * its existing synthetic Vite build; no extra workflow/server or cloud data.
 * The real authenticated loader and static cover image see 404, then a valid local fixture.
 * A recovered fixture image is not acceptance of any published story plate. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEVICE_VIEWPORTS, RELEASE_VIEWPORTS } from './capture/release-config.mjs';

export async function verifyBookPictureRecovery({ browser, base, output }) {
  const folder = path.join(output, 'books');
  await mkdir(folder, { recursive: true });
  const cells = [...RELEASE_VIEWPORTS, ...DEVICE_VIEWPORTS.filter(cell => cell.id.startsWith('landscape-'))];
  const image = await readFile('public/visuals/studio-v2/v30/portal-stories.webp');
  const cases = [
    { id: 'plan-page', query: 'bookReview=1', page: 'p1', path: '/api/plans/plates/plan-poo-sit/PP1', authorization: 'Bearer synthetic-book-picture' },
    { id: 'story-cover', query: 'bookReview=five-smooth-stones&cover=1', page: 'cover', path: '/visuals/books/five-smooth-stones/PL3-cover.webp', authorization: undefined },
  ];
  const inside = (inner, outer) => inner && outer && inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;
  const overlaps = (a, b) => a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const results = [];
  for (const cell of cells) for (const scenario of cases) {
    const label = `${cell.id}-${scenario.id}`;
    const context = await browser.newContext({ viewport: { width: cell.w, height: cell.h }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], requests = [], unexpected = [];
    let ready = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      window.bookReviewAudio = { plays: 0, captures: 0 };
      HTMLMediaElement.prototype.play = function () { window.bookReviewAudio.plays++; return Promise.resolve(); };
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.bookReviewAudio.captures++; throw new Error('No capture in the book fixture'); };
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = request.url();
      if (!url.startsWith(base)) { unexpected.push(url); return route.abort(); }
      const pathname = new URL(url).pathname;
      if (pathname === scenario.path) {
        requests.push({ path: pathname, method: request.method(), authorization: request.headers().authorization });
        return route.fulfill(ready
          ? { status: 200, contentType: 'image/webp', body: image }
          : { status: 404, contentType: 'application/json', body: '{}' });
      }
      if (pathname.startsWith('/api/')) { unexpected.push(pathname); return route.abort(); }
      return route.continue();
    });
    try {
      await page.goto(`${base}/?${scenario.query}&lang=${cell.lang}`);
      const retry = page.locator('[data-book-picture-retry]');
      await retry.waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      const before = await page.locator('[data-book-page]').getAttribute('data-book-page');
      const beforeWords = await page.locator('[data-book-text]').innerText();
      assert.equal(before, scenario.page);
      assert.equal(await page.locator('[data-book-reader]').getAttribute('dir'), cell.lang === 'he' ? 'rtl' : 'ltr');
      assert.equal(await retry.getAttribute('aria-label'), cell.lang === 'he' ? 'לנסות שוב את התמונה' : 'Try the picture again');
      const target = await retry.boundingBox();
      const card = await page.locator('[data-book-picture-recovery]').boundingBox();
      const art = await page.locator('[data-book-art]').boundingBox();
      assert.ok(target && target.width >= 44 && target.height >= 44, `${label}: reachable picture retry`);
      assert.ok(inside(target, { x: 0, y: 0, width: cell.w, height: cell.h }), `${label}: picture retry stays in the viewport`);
      assert.ok(inside(card, art) && inside(target, art), `${label}: recovery card and target stay inside the illustration`);
      if (scenario.page === 'cover') {
        const title = await page.locator('[data-book-text]').boundingBox();
        const open = await page.locator('[data-book-open]').boundingBox();
        assert.ok(!overlaps(card, title) && !overlaps(card, open), `${label}: recovery leaves title and Open clear`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no horizontal overflow`);
      assert.equal(requests.length, 1, 'an absent image does not poll or loop');
      assert.equal(await page.locator('img[src^="/api/plans/plates/"]').count(), 0, 'no unauthenticated bare image request');
      const missingShot = `${label}-picture-unavailable.png`;
      await page.screenshot({ path: path.join(folder, missingShot) });
      ready = true;
      // Operate the real button, hook, image request and image decode.
      await retry.click();
      await page.waitForFunction(() => {
        const img = document.querySelector('[data-book-plate] img');
        return img?.complete && img.naturalWidth > 0;
      });
      assert.equal(await retry.count(), 0, 'successful image retires its recovery action');
      assert.equal(await page.locator('[data-book-page]').getAttribute('data-book-page'), before, 'retry preserves the story position');
      assert.equal(await page.locator('[data-book-text]').innerText(), beforeWords, 'retry preserves story text and navigation');
      assert.equal(requests.length, 2, 'one deliberate retry makes exactly one additional read');
      for (const request of requests) assert.deepEqual(request, { path: scenario.path, method: 'GET', authorization: scenario.authorization });
      assert.deepEqual(await page.evaluate(() => window.bookReviewAudio), { plays: 0, captures: 0 }, 'image recovery does not start narration or capture');
      assert.deepEqual(errors, [], 'no page errors');
      assert.deepEqual(unexpected, [], 'no external, model, generation or unrecognized API calls');
      const recoveredShot = `${label}-picture-recovered.png`;
      await page.screenshot({ path: path.join(folder, recoveredShot) });
      results.push({ viewport: cell.id, surface: `book-picture-recovery-${scenario.id}`, passed: true, page: before, imageReads: requests.length, authenticated: !!scenario.authorization, recoveryBounds: { art, card, target }, screenshots: [`books/${missingShot}`, `books/${recoveredShot}`] });
    } catch (error) {
      await page.screenshot({ path: path.join(folder, `${label}-failure.png`) }).catch(() => {});
      await writeFile(path.join(folder, `${label}-failure.json`), JSON.stringify({ message: String(error), errors, requests, unexpected }, null, 2));
      throw error;
    } finally { await context.close(); }
  }
  await writeFile(path.join(folder, 'results.json'), JSON.stringify({ passed: true, scope: 'Production BookReader, authenticated plan picture and static Five Smooth Stones cover; synthetic 404 and local image response in EN/HE release and landscape cells. No real child, production plate or physical-device acceptance.', results }, null, 2));
  return results;
}
