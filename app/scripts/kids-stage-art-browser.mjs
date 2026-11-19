/** Render every Studio world through its real home door, plus the shared keepsake flow.
 * Reuses the caller's browser and server; the release matrix is the only size source. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const WORLDS = [
  { id: 'stories', folder: 'v31', asset: 'glass-grove', largeWidth: 1536 },
  { id: 'studio', folder: 'v31', asset: 'wonderworks', largeWidth: 1536 },
  { id: 'playbank', folder: 'rooms', asset: 'playbank', largeWidth: 1600 },
  { id: 'feelings', folder: 'rooms', asset: 'feelings', largeWidth: 1600 },
];

async function captureShell(page, surface, output, screenshot) {
  await surface.waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  const renderedImages = surface.locator('img:visible');
  for (let index = 0; index < await renderedImages.count(); index++) await renderedImages.nth(index).scrollIntoViewIfNeeded();
  await renderedImages.evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const layout = await surface.evaluate(element => {
    const heading = element.querySelector('h1'), box = heading?.getBoundingClientRect();
    return {
      heading: heading?.textContent?.trim(),
      headingFits: !!heading && heading.scrollWidth <= heading.clientWidth + 1 && box.width > 0 && box.height > 0,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.ok(layout.heading && layout.headingFits, 'The shared surface has a complete readable heading');
  assert.equal(layout.overflow, false, 'No horizontal document overflow');
  await page.evaluate(() => new Promise(resolve => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true, animations: 'disabled' });
  return layout;
}

async function backHome(page) {
  await page.locator('.studio-v2-bar > button').first().click();
  await page.locator('[data-studio-home]').waitFor({ state: 'visible' });
}

export async function verifyStudioWorldPlates({ browser, base, output }) {
  await mkdir(output, { recursive: true });
  const rows = [];
  const origin = new URL(base).origin;
  for (const viewport of RELEASE_VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.w, height: viewport.h }, reducedMotion: 'reduce',
    });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const pageErrors = [], brokenArt = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/visuals/') && response.status() >= 400) brokenArt.push(response.url());
    });
    try {
      for (const world of WORLDS) {
        pageErrors.length = 0;
        brokenArt.length = 0;
        const screenshot = `studio-stage-${world.id}-${viewport.id}.png`;
        try {
          const url = new URL(base);
          url.searchParams.set('lang', viewport.lang);
          await page.goto(url.href);
          await page.locator('[data-studio-home]').waitFor({ state: 'visible' });
          if (world === WORLDS[0]) {
            const homeShot = `studio-shell-home-${viewport.id}.png`;
            const home = await captureShell(page, page.locator('[data-studio-home]'), output, homeShot);
            const doors = await page.locator('button.studio-v2__door').evaluateAll(elements => elements.map(element => {
              const box = element.getBoundingClientRect();
              return { world: element.dataset.world, text: element.innerText.trim(), width: box.width, height: box.height, visible: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth };
            }));
            assert.equal(doors.length, 4, 'All four world doors are available');
            assert.ok(doors.every(door => door.text && door.visible && door.width >= 44 && door.height >= 44), 'Every world door is readable and reachable on the initial screen');
            rows.push({ surface: 'home', viewport: viewport.id, lang: viewport.lang, passed: true, ...home, doors, screenshot: homeShot });
          }
          await page.locator(`button.studio-v2__door[data-world="${world.id}"]`).click();
          const scene = page.locator(`.studio-v2--world[data-world="${world.id}"]`);
          await scene.waitFor({ state: 'visible' });
          const heading = scene.getByRole('heading', { level: 1 });
          await heading.waitFor({ state: 'visible' });
          await page.evaluate(() => document.fonts.ready);
          // Maker covers are React.lazy imports with a null Suspense fallback.
          // They start on mounting the world (no idle/IntersectionObserver gate).
          // Wait for their actual SVGs, and visit the shelf as a reader would so
          // any lazy raster images also load before the full-page capture.
          const activityArt = scene.locator('[data-activity-art]');
          for (let index = 0; index < await activityArt.count(); index++) {
            await activityArt.nth(index).scrollIntoViewIfNeeded();
          }
          const covers = scene.locator('[data-maker-cover]');
          const makerCovers = [];
          for (let index = 0; index < await covers.count(); index++) {
            const cover = covers.nth(index);
            await cover.locator(':scope > svg').waitFor({ state: 'visible' });
            makerCovers.push(await cover.getAttribute('data-maker-cover'));
          }
          const shelfImages = await scene.locator('.studio-v2__activity img:visible, .studio-v2__activity svg image').evaluateAll(async elements => {
            const sources = await Promise.all(elements.map(async element => {
              if (element instanceof HTMLImageElement) {
                await element.decode();
                return element.currentSrc || element.src;
              }
              return new URL(element.href.baseVal, document.baseURI).href;
            }));
            return Promise.all([...new Set(sources)].map(async src => {
              const image = new Image();
              image.src = src;
              await image.decode();
              return { src, width: image.naturalWidth, height: image.naturalHeight };
            }));
          });
          assert.ok(shelfImages.every(image => image.width > 0 && image.height > 0), 'All displayed shelf image resources decode');
          await page.evaluate(() => new Promise(resolve => {
            window.scrollTo(0, 0);
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }));
          const plates = scene.locator(`img[data-studio-plate="${world.id}"]:visible`);
          await plates.first().waitFor({ state: 'visible' });
          const images = await plates.evaluateAll(async elements => Promise.all(elements.map(async image => {
            await image.decode();
            // Width-descriptor srcsets density-correct naturalWidth. Decode the selected
            // resource without srcset as well to record its real pixel dimensions.
            const resource = new Image();
            resource.src = image.currentSrc || image.src;
            await resource.decode();
            const box = image.getBoundingClientRect(), style = getComputedStyle(image);
            return {
              currentSrc: resource.src, decoded: image.complete && image.naturalWidth > 0,
              naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
              resourceWidth: resource.naturalWidth, resourceHeight: resource.naturalHeight,
              renderedWidth: box.width, renderedHeight: box.height,
              objectFit: style.objectFit, objectPosition: style.objectPosition,
            };
          })));
          assert.ok(images.length > 0, `${world.id}: visible world artwork is present`);
          for (const image of images) {
            const assetUrl = new URL(image.currentSrc);
            assert.equal(assetUrl.origin, origin, 'World art is served by the app');
            assert.match(assetUrl.pathname, new RegExp(`^/visuals/studio-v2/${world.folder}/${world.asset}-(800|${world.largeWidth})\\.webp$`), 'The displayed world uses its approved environment');
            assert.equal(image.decoded, true, 'World artwork decodes');
            assert.ok([800, world.largeWidth].includes(image.resourceWidth) && image.resourceHeight > 0, 'Selected environment has a supported source resolution');
            assert.ok(image.renderedWidth > 0 && image.renderedHeight > 0, 'World artwork has visible area');
          }
          const title = (await heading.innerText()).trim();
          assert.ok(title.length > 0, 'The world heading is readable text');
          const host = await scene.locator('[data-studio-host]').evaluate(element => {
            let determinant = 1;
            for (let node = element.querySelector('img'); node && node !== document.body; node = node.parentElement) {
              const matrix = new DOMMatrix(getComputedStyle(node).transform);
              determinant *= matrix.a * matrix.d - matrix.b * matrix.c;
            }
            const image = element.querySelector('img');
            return { crew: element.dataset.studioHost, src: image.currentSrc || image.src, mirrored: determinant < 0 };
          });
          assert.equal(host.mirrored, false, 'Approved companion anatomy and equipment retain their original sides in both languages');
          const firstChoice = await scene.locator('.studio-v2__activity').first().boundingBox();
          assert.ok(firstChoice && firstChoice.y < viewport.h - 44, 'A first world choice is reachable without scrolling past an oversized introduction');
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          await page.screenshot({ path: path.join(output, screenshot), fullPage: true, animations: 'disabled' });
          await backHome(page);
          assert.equal(overflow, false, 'No horizontal document overflow');
          assert.deepEqual(pageErrors, [], 'No page errors while opening the world');
          assert.deepEqual(brokenArt, [], 'No missing art while opening the world');
          rows.push({ world: world.id, viewport: viewport.id, lang: viewport.lang, passed: true,
            heading: title, imageCount: images.length, images, host, makerCovers, shelfImages, overflow, screenshot, returnedHome: true,
            pageErrors: [...pageErrors], brokenArt: [...brokenArt] });
        } catch (error) {
          await page.screenshot({ path: path.join(output, `failed-${screenshot}`), fullPage: true, animations: 'disabled' }).catch(() => {});
          await writeFile(path.join(output, `failed-studio-stage-${world.id}-${viewport.id}.json`), JSON.stringify({
            world: world.id, viewport: viewport.id, error: String(error), pageErrors, brokenArt,
          }, null, 2));
          throw error;
        }
      }
      // Use the real synthetic collection adapter and actual choices. Nothing is
      // injected into progress: returning and reopening must preserve what was kept.
      await page.locator('[data-studio-open-collection]').click();
      const emptyShot = `studio-shell-collection-empty-${viewport.id}.png`;
      const empty = await captureShell(page, page.locator('[data-studio-collection]'), output, emptyShot);
      assert.equal(await page.locator('.studio-keepsakes__collection > li').count(), 0, 'An empty collection never invents earned items');
      await backHome(page);
      await page.locator('[data-studio-open-quest]').click();
      const quest = page.locator('[data-studio-quest]');
      const initialShot = `studio-shell-quest-start-${viewport.id}.png`;
      const initial = await captureShell(page, quest, output, initialShot);
      for (let step = 1; step <= 4; step++) {
        await quest.locator('.studio-keepsakes__choices button').first().click();
        await page.waitForFunction(expected => document.querySelectorAll('[data-studio-quest] .studio-keepsakes__steps [data-done="true"]').length === expected, step);
        if (step === 2) {
          await backHome(page);
          await page.locator('[data-studio-open-quest]').click();
          assert.equal(await quest.locator('.studio-keepsakes__steps [data-done="true"]').count(), 2, 'The cozy corner resumes the two actually kept choices');
          await captureShell(page, quest, output, `studio-shell-quest-resumed-${viewport.id}.png`);
        }
      }
      const finishShot = `studio-shell-quest-finish-${viewport.id}.png`;
      await quest.locator('[data-kid-sticker-new]').waitFor({ state: 'visible' });
      const finished = await captureShell(page, quest, output, finishShot);
      assert.equal(await quest.locator('.studio-keepsakes__choices button').count(), 0, 'A completed corner has no remaining choices');
      rows.push({ surface: 'quest', viewport: viewport.id, lang: viewport.lang, passed: true, initial, finished, resumed: true, keptSteps: 4, screenshot: finishShot });
      await backHome(page);
      await page.locator('[data-studio-open-collection]').click();
      await page.locator('.studio-keepsakes__collection > li').waitFor({ state: 'visible' });
      const collectionShot = `studio-shell-collection-kept-${viewport.id}.png`;
      const collection = await captureShell(page, page.locator('[data-studio-collection]'), output, collectionShot);
      assert.equal(await page.locator('.studio-keepsakes__collection > li').count(), 1, 'Only the actually completed cozy corner is collected');
      await page.locator('.studio-keepsakes__collection button').click();
      await quest.waitFor({ state: 'visible' });
      assert.equal(await quest.locator('.studio-keepsakes__steps [data-done="true"]').count(), 4, 'The kept corner reopens in its completed state');
      rows.push({ surface: 'collection', viewport: viewport.id, lang: viewport.lang, passed: true, empty, ...collection, earnedItems: 1, reopened: true, screenshot: collectionShot });
      assert.deepEqual(pageErrors, [], 'No page errors in the shared shell and keepsake flow');
      assert.deepEqual(brokenArt, [], 'No missing art in the shared shell and keepsake flow');
    } catch (error) {
      await page.screenshot({ path: path.join(output, `failed-studio-shell-${viewport.id}.png`), fullPage: true, animations: 'disabled' }).catch(() => {});
      await writeFile(path.join(output, `failed-studio-shell-${viewport.id}.json`), JSON.stringify({ viewport: viewport.id, error: String(error), pageErrors, brokenArt, completed: rows.filter(row => row.viewport === viewport.id) }, null, 2));
      throw error;
    } finally { await context.close(); }
  }
  return rows;
}
