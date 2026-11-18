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
          await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
          assert.equal(overflow, false, 'No horizontal document overflow');
          assert.deepEqual(pageErrors, [], 'No page errors while opening the world');
          assert.deepEqual(brokenArt, [], 'No missing art while opening the world');
          rows.push({ world: world.id, viewport: viewport.id, lang: viewport.lang, passed: true,
            heading: title, imageCount: images.length, images, overflow, screenshot,
            pageErrors: [...pageErrors], brokenArt: [...brokenArt] });
        } catch (error) {
          await page.screenshot({ path: path.join(output, `failed-${screenshot}`), fullPage: true }).catch(() => {});
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
