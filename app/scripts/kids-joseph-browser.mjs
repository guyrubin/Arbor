/** B-BOOK-83: the actual HeroJourneyTab → HeroScenePlayer route, all eight
 * Joseph beats and every existing choice. Static art comes from shipped
 * files. Only the account/storage boundary and missing narration are
 * synthetic; one injected image failure proves deliberate recovery. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS, DEVICE_VIEWPORTS } from './capture/release-config.mjs';

const STORY = 'joseph-and-his-brothers';
const ART = `/visuals/stories/v2/${STORY}/`;
const BEATS = ['call', 'challenge', 'fear', 'decision', 'consequence', 'growth', 'victory', 'reflection'];
const CHILD = 'joseph-synthetic-review';
const inside = (a, b) => a && b && a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;

export async function verifyJosephStory({ browser, base, output }) {
  const folder = path.join(output, 'joseph');
  await mkdir(folder, { recursive: true });
  const provenance = JSON.parse(await readFile(path.resolve('../docs/design/story-art-v2.json'), 'utf8'));
  const frames = new Map(provenance.assets.map(asset => [asset.beat, asset]));
  assert.equal(frames.size, 9, 'a complete reviewed cover plus eight scenes is required');
  const cells = [...RELEASE_VIEWPORTS, ...DEVICE_VIEWPORTS.filter(cell => cell.id.startsWith('landscape-'))];
  const results = [];
  for (const cell of cells) {
    const context = await browser.newContext({ viewport: { width: cell.w, height: cell.h }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], unexpected = [], narrationReads = [], staticReads = [], screenshots = [], pages = [], outcomes = [];
    let injectedMissing = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith(ART)) staticReads.push({ path: url.pathname, query: url.search, status: response.status() });
    });
    await context.addInitScript(() => {
      window.josephReviewMedia = { plays: 0, captures: 0 };
      HTMLMediaElement.prototype.play = function () { window.josephReviewMedia.plays++; return Promise.resolve(); };
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.josephReviewMedia.captures++; throw new Error('Synthetic story review cannot record'); };
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!request.url().startsWith(base)) { unexpected.push(request.url()); return route.abort(); }
      if (url.pathname === `/api/children/${CHILD}/book-assets/${STORY}/file` && url.searchParams.get('path') === 'manifest.json') {
        narrationReads.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization });
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{}', headers: { 'cache-control': 'no-store' } });
      }
      if (url.pathname.startsWith('/api/')) { unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
      if (!injectedMissing && new RegExp(`^${ART}growth(?:-480)?\\.webp$`).test(url.pathname)) {
        injectedMissing = true;
        return route.fulfill({ status: 404, contentType: 'text/plain', body: '', headers: { 'cache-control': 'no-store' } });
      }
      return route.continue();
    });
    const shot = async label => {
      const file = `${cell.id}-${label}.png`;
      await page.screenshot({ path: path.join(folder, file), animations: 'disabled' });
      screenshots.push(`joseph/${file}`);
    };
    const paint = async () => {
      await page.waitForFunction(() => [...document.querySelectorAll('[data-kid-book-reader], [data-kid-book-reader] > div, [data-kid-book-text]')].every(el => Number(getComputedStyle(el).opacity) === 1));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const readPicture = async id => {
      const scope = id === 'cover' ? page.locator('[data-kid-book-cover]') : page.locator(`[data-kid-book-beat="${id}"]`);
      await scope.waitFor({ state: 'visible' });
      const art = scope.locator('[data-kid-book-art]');
      // The production landscape Decision layout intentionally hides its
      // picture so all three answers remain reachable. It is tested as such.
      if (id === 'decision' && cell.h <= 520) {
        assert.equal(await art.isVisible(), false);
        return { id, picture: 'intentionally hidden on short decision page' };
      }
      await scope.locator(`[data-story-art-image="${id}"]`).waitFor({ state: 'visible' });
      await page.waitForFunction(beat => {
        const img = document.querySelector(`[data-story-art-image="${beat}"]`);
        return img?.complete && img.naturalWidth > 0;
      }, id);
      await paint();
      const picture = await scope.locator(`[data-story-art-image="${id}"]`).evaluate(img => {
        const box = img.getBoundingClientRect(), style = getComputedStyle(img);
        return { url: new URL(img.currentSrc).pathname, width: img.naturalWidth, height: img.naturalHeight, box: { x: box.x, y: box.y, width: box.width, height: box.height }, objectFit: style.objectFit, objectPosition: style.objectPosition, transform: style.transform };
      });
      const expected = frames.get(id);
      assert.ok(expected, `${id}: reviewed frame metadata`);
      assert.match(picture.url, new RegExp(`^${ART}${id}(?:-480)?\\.webp$`), `${cell.id}: exact authored ${id} scene, not a repeated cover`);
      assert.equal(picture.objectPosition, expected.crop.objectPosition, `${cell.id}/${id}: reviewed per-scene camera`);
      assert.equal(picture.transform, 'none', 'art is never mirrored or zoomed in Hebrew');
      assert.ok(Math.abs(picture.width / picture.height - (id === 'cover' ? .75 : 1.5)) < .003, `${id}: actual native derivative aspect`);
      const selected = expected.exports.find(file => file.path === `app/public${picture.url}`);
      assert.ok(selected, `${id}: the selected file is in the reviewed export set`);
      const drawnWidth = picture.objectFit === 'contain'
        ? Math.min(picture.box.width, picture.box.height * selected.width / selected.height)
        : Math.max(picture.box.width, picture.box.height * selected.width / selected.height);
      assert.ok(selected.width + 1 >= drawnWidth, `${cell.id}/${id}: ${selected.width}px source covers ${drawnWidth}px uncropped image at DPR1`);
      const hero = scope.locator('[data-story-own-hero="approved"]');
      const heroBox = await hero.boundingBox(), artBox = await art.boundingBox();
      assert.ok(inside(heroBox, artBox), `${cell.id}/${id}: the existing own portrait stays inside the picture`);
      assert.equal(await hero.locator('img').getAttribute('src'), await page.evaluate(() => window.josephReviewFixture.heroUrl));
      assert.equal(await scope.locator('[data-story-own-hero]').count(), 1, `${id}: one identity only`);
      const heroCenter = (heroBox.x + heroBox.width / 2 - artBox.x) / artBox.width;
      assert.ok(Math.abs(heroCenter - expected.heroSlot.centerX) * artBox.width <= 2, `${id}: portrait uses the reviewed physical slot without RTL mirroring`);
      return { id, ...picture, sourcePixels: { width: selected.width, height: selected.height }, uncroppedRenderedWidth: drawnWidth, heroBox, artBox };
    };
    const controls = async () => {
      const items = await page.locator('[data-kid-book-reader] button:visible').evaluateAll(buttons => buttons.filter(button => !button.disabled).map(button => {
        const rect = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label') || button.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
      assert.ok(items.length > 0 && items.every(item => item.width >= 44 && item.height >= 44), `${cell.id}: all reading controls meet the touch floor`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${cell.id}: no horizontal overflow`);
      return items;
    };
    try {
      await page.goto(`${base}/?josephReview=1&lang=${cell.lang}`);
      await page.locator('[data-kid-book-cover]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.documentElement.classList.contains('msr-ready'));
      assert.equal(await page.locator('[data-joseph-review]').getAttribute('dir'), cell.lang === 'he' ? 'rtl' : 'ltr');
      pages.push(await readPicture('cover'));
      await controls();
      await shot('cover');
      // All three choices traverse the actual reader. The first pass captures
      // every shipped scene; later passes prove distinct outcomes and reread.
      for (let choice = 0; choice < 3; choice++) {
        await page.locator('[data-kid-book-next]').click();
        for (const beat of BEATS) {
          await page.locator(`[data-kid-book-beat="${beat}"]`).waitFor({ state: 'visible' });
          if (beat === 'growth' && choice === 0) {
            const retry = page.locator('[data-story-picture-retry]');
            await retry.waitFor({ state: 'visible' });
            const words = await page.locator('[data-kid-book-text]').innerText();
            const retryBox = await retry.boundingBox(), artBox = await page.locator('[data-kid-book-art]').boundingBox();
            assert.ok(retryBox?.width >= 44 && retryBox.height >= 44 && inside(retryBox, artBox), 'recovery remains usable inside the art');
            assert.equal(await page.locator('[data-story-own-hero="approved"]').count(), 1, 'an image failure keeps the own hero');
            await shot('growth-unavailable');
            await retry.click();
            await readPicture(beat);
            assert.equal(await page.locator('[data-kid-book-text]').innerText(), words, 'retry preserves narration and position');
          }
          const current = await readPicture(beat);
          const readingControls = await controls();
          const text = page.locator('[data-kid-book-text]');
          assert.equal(await text.getAttribute('lang'), cell.lang);
          assert.equal(await text.getAttribute('dir'), cell.lang === 'he' ? 'rtl' : 'ltr');
          if (choice === 0) { pages.push({ ...current, controls: readingControls }); await shot(beat); }
          if (beat === 'consequence') {
            const words = await text.innerText();
            outcomes.push(words);
            if (choice > 0) await shot(`choice-${choice + 1}-outcome`);
          }
          if (beat === 'decision') {
            const options = page.locator('[data-testid="decision-choice"]');
            assert.equal(await options.count(), 3);
            assert.equal(await page.locator('[data-kid-book-next]').count(), 0, 'decision has no unusable Next');
            await options.nth(choice).click();
          } else if (beat === 'growth' && choice === 0) {
            // Back preserves the selected choice; Next returns to this same
            // authored scene without a new generation or a reset to cover.
            await page.locator('[data-kid-book-nav] button').first().click();
            await page.locator('[data-kid-book-beat="consequence"]').waitFor({ state: 'visible' });
            assert.equal(await page.locator('[data-kid-book-text]').innerText(), outcomes[0]);
            await page.locator('[data-kid-book-next]').click();
            await readPicture('growth');
            await page.locator('[data-kid-book-next]').click();
          } else await page.locator('[data-kid-book-next]').click();
        }
        await page.locator('[data-kid-book-ending]').waitFor({ state: 'visible' });
        await paint();
        await controls();
        if (choice === 0) await shot('ending');
        if (choice < 2) {
          await page.locator('[data-kid-book-ending] button').first().click();
          await readPicture('cover');
        }
      }
      assert.equal(new Set(outcomes).size, 3, 'all three authored outcomes remain distinct');
      await page.locator('[data-kid-book-ending] button').nth(1).click();
      const shelfCover = page.locator(`[data-kid-book="${STORY}"]`);
      await shelfCover.waitFor({ state: 'visible' });
      assert.equal(await shelfCover.locator('[data-kid-book-own-hero]').count(), 1, 'returning to the shelf keeps this child on this cover');
      await shelfCover.click();
      await readPicture('cover');
      await page.locator('[data-joseph-review-exit]').click();
      await page.locator('[data-joseph-review-closed]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-kid-book-reader]').count(), 0, 'exit unmounts the reader');
      assert.equal(injectedMissing, true);
      assert.ok(staticReads.filter(read => read.status === 200).length >= 9, 'real published files were decoded');
      assert.equal(narrationReads.length, 1, 'one unavailable synthetic narration manifest, no runtime voice fallback');
      assert.deepEqual(narrationReads[0], { path: `/api/children/${CHILD}/book-assets/${STORY}/file`, method: 'GET', authorization: 'Bearer synthetic-joseph-reader' });
      assert.deepEqual(await page.evaluate(() => window.josephReviewMedia), { plays: 0, captures: 0 });
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, [], 'no external, generation, plan-image or other API calls');
      results.push({ viewport: cell.id, surface: 'joseph-authored-legacy-reader', passed: true, story: STORY, pages, choices: outcomes.length, staticReads, narration: { synthetic: true, available: false, reads: narrationReads }, pictureRecovery: 'one injected 404 followed by the real static file', screenshots });
    } catch (error) {
      await page.screenshot({ path: path.join(folder, `${cell.id}-failure.png`), animations: 'disabled' }).catch(() => {});
      await writeFile(path.join(folder, `${cell.id}-failure.json`), JSON.stringify({ message: String(error), errors, unexpected, narrationReads, staticReads, pages }, null, 2));
      throw error;
    } finally { await context.close(); }
  }
  await writeFile(path.join(folder, 'results.json'), JSON.stringify({ passed: true, scope: 'Actual HeroJourneyTab/HeroScenePlayer and committed Joseph art, synthetic geometric identity/profile/storage. All choices, back, reread, shelf return, exit and image retry in EN/HE release/landscape cells. Narration unavailable by fixture; no real-child or physical-device/narrator acceptance.', results }, null, 2));
  return results;
}
