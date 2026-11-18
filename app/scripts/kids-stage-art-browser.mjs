/** Render the adopted v31 environments through the real Studio home doors.
 * Reuses the caller's browser and server; the release matrix is the only size source. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const WORLDS = [
  { id: 'stories', asset: 'glass-grove' },
  { id: 'studio', asset: 'wonderworks' },
];

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
            assert.match(assetUrl.pathname, new RegExp(`^/visuals/studio-v2/v31/${world.asset}-(800|1536)\\.webp$`), 'The displayed world uses its adopted v31 environment');
            assert.equal(image.decoded, true, 'World artwork decodes');
            assert.ok([800, 1536].includes(image.resourceWidth) && image.resourceHeight > 0, 'Selected environment has a supported source resolution');
            assert.ok(image.renderedWidth > 0 && image.renderedHeight > 0, 'World artwork has visible area');
          }
          const title = (await heading.innerText()).trim();
          assert.ok(title.length > 0, 'The world heading is readable text');
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          await page.screenshot({ path: path.join(output, screenshot), fullPage: true, animations: 'disabled' });
          assert.equal(overflow, false, 'No horizontal document overflow');
          assert.deepEqual(pageErrors, [], 'No page errors while opening the world');
          assert.deepEqual(brokenArt, [], 'No missing art while opening the world');
          rows.push({ world: world.id, viewport: viewport.id, lang: viewport.lang, passed: true,
            heading: title, imageCount: images.length, images, makerCovers, shelfImages, overflow, screenshot,
            pageErrors: [...pageErrors], brokenArt: [...brokenArt] });
        } catch (error) {
          await page.screenshot({ path: path.join(output, `failed-${screenshot}`), fullPage: true, animations: 'disabled' }).catch(() => {});
          await writeFile(path.join(output, `failed-studio-stage-${world.id}-${viewport.id}.json`), JSON.stringify({
            world: world.id, viewport: viewport.id, error: String(error), pageErrors, brokenArt,
          }, null, 2));
          throw error;
        }
      }
    } finally { await context.close(); }
  }
  return rows;
}
