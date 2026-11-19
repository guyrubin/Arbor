/** Actual complete catalogue reads. Real legacy and canonical reader state;
 * real committed canonical/Joseph art; explicitly synthetic profile, poses,
 * plan plate responses and unavailable narration. No generation or real user.
 * Three isolated cells run at a time. Each persists its own progress, and
 * failures do not prevent the remaining titles/languages producing evidence. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS, DEVICE_VIEWPORTS } from './capture/release-config.mjs';

const LEGACY = ['david-and-goliath', 'moses-and-pharaoh', 'noahs-ark', 'jonah-and-the-great-fish', 'joseph-and-his-brothers', 'jacob-wrestling-the-angel'];
const BOOKS = ['five-smooth-stones'];
const PLANS = ['plan-poo-sit', 'plan-sleep-alone', 'plan-dropoff', 'plan-big-feelings', 'plan-screen-end', 'plan-new-food', 'plan-toilet-start', 'plan-stay-in-bed'];
const CHILD = 'catalogue-synthetic-review';
const normalize = value => String(value ?? '').replace(/[\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
const inside = (a, b) => a && b && a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
const separate = (a, b) => a && b && (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1);

export async function verifyStoryCatalogue({ browser, base, output }) {
  const folder = path.join(output, 'story-catalogue');
  await mkdir(folder, { recursive: true });
  // Canonical release cells plus the short landscape layout changed here.
  // HE-m is a separate real read, not inferred from the HE-f screenshots.
  const primary = [...RELEASE_VIEWPORTS, ...DEVICE_VIEWPORTS.filter(cell => cell.id.startsWith('landscape-'))];
  const cells = primary.flatMap(cell => [
    { ...cell, gender: 'girl', label: cell.id },
    ...(cell.lang === 'he' && !cell.id.startsWith('landscape-') ? [{ ...cell, gender: 'boy', label: `${cell.id}-boy` }] : []),
  ]);
  const titles = [...LEGACY.map(id => ({ kind: 'legacy', id })), ...BOOKS.map(id => ({ kind: 'book', id })), ...PLANS.map(id => ({ kind: 'plan', id }))];
  const jobs = titles.flatMap(title => cells.map(cell => ({ title, cell, label: `${title.kind}-${title.id}-${cell.label}` })));
  assert.equal(jobs.length, 120, 'the full catalogue keeps all 120 independent cells');
  assert.equal(new Set(jobs.map(job => job.label)).size, jobs.length, 'each cell owns a unique evidence folder');
  const results = new Array(jobs.length);
  const reportErrors = [];
  let reportWrites = Promise.resolve();
  const writeResults = () => {
    // Array slots preserve catalogue order even when cells finish out of order.
    // Snapshot before queueing: no overlapping writes or later mutations.
    const completed = results.filter(Boolean);
    const body = JSON.stringify({ passed: completed.length === jobs.length && completed.every(result => result.passed), scope: 'Actual complete legacy/canonical/plan reads; committed canonical/Joseph art; synthetic geometric identity, unavailable narration and plan image bytes. No real-family eligibility or live plan-art acceptance.', expectedCells: jobs.length, completedCells: completed.length, results: completed }, null, 2);
    reportWrites = reportWrites.then(() => writeFile(path.join(folder, 'results.json'), body)).catch(error => { reportErrors.push(String(error)); });
    return reportWrites;
  };
  const runCell = async (title, cell) => {
    const label = `${title.kind}-${title.id}-${cell.label}`;
    const cellFolder = path.join(folder, label);
    const errors = [], unexpected = [], requests = [], issues = [], screenshots = [], frames = [], paths = [];
    const evidence = { label, title: title.id, kind: title.kind, viewport: cell.id, gender: cell.gender, passed: false, frames, paths, screenshots, issues, errors, unexpected, requests };
    let context, page;
    let injectedFailure = false, planRecovery = false;
    const check = (condition, message) => { if (!condition) issues.push(message); };
    const persist = () => writeFile(path.join(cellFolder, 'progress.json'), JSON.stringify(evidence, null, 2));
    const shot = async name => {
      const file = `${name}.png`;
      await page.screenshot({ path: path.join(cellFolder, file), animations: 'disabled' });
      screenshots.push(`story-catalogue/${label}/${file}`);
    };
    const readyCanonicalPicture = async name => {
      // A plan's authenticated source resolves after its page mounts. Do not
      // mistake an empty FallbackImg (or a loaded hero alone) for a picture.
      // The deliberate unavailable-cover capture does not call this helper.
      try {
        await page.waitForFunction(() => {
          const base = [...document.querySelectorAll('[data-book-plate] > img')];
          const states = [...document.querySelectorAll('[data-book-state-plate]')];
          const ready = img => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
          return base.length === 1 && ready(base[0]) && states.every(state => ready(state.querySelector('img')));
        }, undefined, { timeout: 12000 });
        await page.locator('[data-book-plate] > img, [data-book-state-plate] > img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      } catch (error) {
        throw new Error(`${name}: expected base plate and every displayed art-state plate must be present and decoded`, { cause: error });
      }
    };
    const paint = async () => {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('[data-kid-book-reader] img, [data-book-reader] img')].map(img => img.decode().catch(() => {})));
        document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).forEach(animation => { try { animation.finish(); } catch {} });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await page.waitForFunction(() => [...document.querySelectorAll('[data-kid-book-reader], [data-kid-book-reader] > div, [data-kid-book-text]')].every(element => Number(getComputedStyle(element).opacity) >= .995));
    };
    const glyphs = async locator => locator.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      const range = document.createRange(); range.selectNodeContents(element);
      const ink = [...range.getClientRects()].filter(r => r.width && r.height);
      const clip = window.storyCatalogueClip(element);
      const inkRect = ink.length ? { x: Math.min(...ink.map(r => r.left)), y: Math.min(...ink.map(r => r.top)), width: Math.max(...ink.map(r => r.right)) - Math.min(...ink.map(r => r.left)), height: Math.max(...ink.map(r => r.bottom)) - Math.min(...ink.map(r => r.top)) } : null;
      return { text: element.textContent, rect: { x: box.x, y: box.y, width: box.width, height: box.height }, inkRect, fontSize: parseFloat(style.fontSize), scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, fits: ink.length > 0 && ink.every(r => r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1), visible: ink.length > 0 && ink.every(r => r.left >= clip.x - 1 && r.right <= clip.x + clip.width + 1 && r.top >= clip.y - 1 && r.bottom <= clip.y + clip.height + 1) };
    }));
    // A paragraph can legitimately be taller than its scrollable paper. Check
    // each real rendered line after actually scrolling it into the visible
    // clipping bounds; checking the whole DD box cannot prove this contract.
    const reachableLines = async (locator, scrollSelector) => locator.evaluateAll((elements, selector) => elements.map(element => {
      const scroll = element.closest(selector);
      const previous = scroll?.scrollTop ?? 0;
      if (scroll) scroll.scrollTop = 0;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const lines = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        [...range.getClientRects()].forEach((rect, index) => { if (rect.width && rect.height) lines.push({ node, index }); });
      }
      let reachable = lines.length > 0;
      for (const line of lines) {
        const range = document.createRange(); range.selectNodeContents(line.node);
        let rect = range.getClientRects()[line.index];
        let clip = window.storyCatalogueClip(element);
        if (scroll) scroll.scrollTop += rect.top - (clip.y + Math.max(0, (clip.height - rect.height) / 2));
        rect = range.getClientRects()[line.index];
        clip = window.storyCatalogueClip(element);
        reachable &&= rect.left >= clip.x - 1 && rect.right <= clip.x + clip.width + 1 && rect.top >= clip.y - 1 && rect.bottom <= clip.y + clip.height + 1;
      }
      if (scroll) scroll.scrollTop = previous;
      return { text: element.textContent, lines: lines.length, reachable };
    }), scrollSelector);
    const controls = async selector => page.locator(selector).evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(), clip = window.storyCatalogueClip(element);
      return { text: element.textContent, aria: element.getAttribute('aria-label'), disabled: element.disabled, x: box.x, y: box.y, width: box.width, height: box.height, visible: box.left >= clip.x - 1 && box.right <= clip.x + clip.width + 1 && box.top >= clip.y - 1 && box.bottom <= clip.y + clip.height + 1 };
    }));
    const inspect = async ({ name, expected, legacy = false, capture = true }) => {
      const scroll = legacy ? page.locator('[data-catalogue-scroll]') : null;
      if (scroll) await scroll.evaluate(element => { element.scrollTop = 0; });
      if (!legacy) await readyCanonicalPicture(name);
      await paint();
      const paras = legacy ? page.locator('[data-kid-book-text]') : page.locator('[data-book-para]');
      const words = await glyphs(paras);
      if (expected) check(normalize(words.map(word => word.text).join(' ')) === normalize(Array.isArray(expected) ? expected.join(' ') : expected), `${name}: exact authored narration/choice echo retained`);
      for (const word of words) {
        check(word.fontSize >= (legacy ? 20 : 18), `${name}: readable body type (${word.fontSize}px)`);
        check(word.fits && word.scrollHeight <= word.clientHeight + 1, `${name}: every glyph fits its paragraph`);
      }
      const viewport = legacy ? await scroll.boundingBox() : { x: 0, y: 0, width: cell.w, height: cell.h };
      const selector = legacy ? '[data-kid-book-reader] button:visible:enabled' : '[data-book-reader] button:visible:enabled';
      const toys = await controls(selector);
      check(toys.every(toy => toy.width >= 44 && toy.height >= 44), `${name}: every active control clears 44px`);
      const initiallyVisible = toys.every(toy => toy.visible && inside(toy, viewport));
      const lines = legacy ? [] : await reachableLines(paras, '[data-reading-scroll]');
      if (legacy) {
        for (const paragraph of await paras.all()) {
          await paragraph.scrollIntoViewIfNeeded();
          check(inside(await paragraph.boundingBox(), viewport), `${name}: every full paragraph is reachable`);
        }
      } else {
        check(lines.every(line => line.reachable), `${name}: every authored text line is reachable at readable size`);
      }
      for (const button of await page.locator(selector).all()) {
        await button.scrollIntoViewIfNeeded();
        check(inside(await button.boundingBox(), viewport), `${name}: every action is fully reachable`);
        check(await button.evaluate(element => {
          const box = element.getBoundingClientRect(), clip = window.storyCatalogueClip(element);
          return box.left >= clip.x - 1 && box.right <= clip.x + clip.width + 1 && box.top >= clip.y - 1 && box.bottom <= clip.y + clip.height + 1;
        }), `${name}: action is not hidden behind a paper clipping edge`);
      }
      const images = await page.locator(legacy ? '[data-kid-book-reader] img' : '[data-book-reader] img').evaluateAll(elements => elements.map(img => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, width: img.naturalWidth, height: img.naturalHeight, transform: getComputedStyle(img).transform })));
      check(images.every(img => img.loaded), `${name}: visible identity/art image bytes decode`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal page overflow`);
      if (!legacy) {
        const wordBox = page.locator('.bk-words');
        if (await wordBox.count()) check(await wordBox.evaluate(element => element.scrollHeight <= element.clientHeight + 1), `${name}: reading sheet does not hide text in an inner scroller`);
      }
      if (scroll) await scroll.evaluate(element => { element.scrollTop = 0; });
      if (!legacy) await page.locator('[data-reading-scroll]').evaluateAll(elements => elements.forEach(element => { element.scrollTop = 0; }));
      const frame = { name, words, lines, controls: toys, controlsInitiallyVisible: initiallyVisible, images };
      frames.push(frame);
      if (capture) await shot(name);
      await persist();
      return frame;
    };
    try {
      await mkdir(cellFolder, { recursive: true });
      context = await browser.newContext({ viewport: { width: cell.w, height: cell.h }, reducedMotion: 'reduce' });
      page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        const url = new URL(response.url());
        if (/\/visuals\/(books|stories)\//.test(url.pathname)) requests.push({ source: 'committed-art', path: url.pathname, status: response.status() });
      });
      await context.addInitScript(() => {
        // Visible bounds include the actual overflow clips, not a tight text
        // line box (font ascent can exceed that box without any clipped ink).
        window.storyCatalogueClip = element => {
          let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
            if (style.overflowX !== 'visible') { left = Math.max(left, box.left + parent.clientLeft); right = Math.min(right, box.left + parent.clientLeft + parent.clientWidth); }
            if (style.overflowY !== 'visible') { top = Math.max(top, box.top + parent.clientTop); bottom = Math.min(bottom, box.top + parent.clientTop + parent.clientHeight); }
            // The actual reader/fixture shell is fixed to this viewport;
            // ordinary document wrappers do not clip that fixed surface.
            if (style.position === 'fixed') break;
          }
          return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
        };
        window.storyCatalogueMedia = { plays: 0, captures: 0, syntheses: 0 };
        HTMLMediaElement.prototype.play = function () { window.storyCatalogueMedia.plays++; return Promise.resolve(); };
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.storyCatalogueMedia.captures++; throw new Error('No recording in the synthetic catalogue'); };
        if (window.speechSynthesis) window.speechSynthesis.speak = () => { window.storyCatalogueMedia.syntheses++; };
      });
      // A geometric layout plate, encoded by the browser: not an unrelated
      // scene presented as accepted plan artwork. The production PNG loader is
      // exercised with a real decodable image and its real authenticated route.
      const geometricPng = Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#edf1ee'; ctx.fillRect(0, 0, 1536, 1024);
        ctx.fillStyle = '#d5e1df'; ctx.fillRect(0, 696, 1536, 328);
        ctx.strokeStyle = '#93aca8'; ctx.lineWidth = 3;
        for (let x = 192; x < 1536; x += 192) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
        return canvas.toDataURL('image/png').split(',')[1];
      }), 'base64');
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== new URL(base).origin) { unexpected.push(request.url()); return route.abort(); }
        if (url.pathname === `/api/children/${CHILD}/book-assets/${title.id}/file` && url.searchParams.get('path') === 'manifest.json') {
          requests.push({ source: 'synthetic-unavailable-narration', path: url.pathname, method: request.method(), authorization: request.headers().authorization });
          return route.fulfill({ status: 404, contentType: 'application/json', body: '{}', headers: { 'cache-control': 'no-store' } });
        }
        if (title.kind === 'plan' && url.pathname.startsWith(`/api/plans/plates/${title.id}/`)) {
          const status = !injectedFailure ? 404 : 200;
          injectedFailure = true;
          requests.push({ source: 'synthetic-geometric-plan-plate', path: url.pathname, status, method: request.method(), authorization: request.headers().authorization });
          return route.fulfill(status === 404 ? { status, contentType: 'application/json', body: '{}' } : { status, contentType: 'image/png', body: geometricPng });
        }
        if (url.pathname.startsWith('/api/')) { unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
        return route.continue();
      });
      await page.goto(`${base}/?storyCatalogue=${title.kind}&id=${title.id}&lang=${cell.lang}&gender=${cell.gender}`);
      await page.waitForFunction(() => Boolean(window.storyCatalogueFixture));
      const spec = await page.evaluate(() => window.storyCatalogueFixture);
      evidence.artwork = spec.artwork;
      assert.deepEqual([...spec.catalogue.legacy].sort(), [...LEGACY].sort(), 'every eligible legacy title is operated');
      assert.deepEqual([...spec.catalogue.books].sort(), [...BOOKS].sort(), 'every real canonical title is operated; no engine fixture counted');
      assert.deepEqual([...spec.catalogue.plans].sort(), [...PLANS].sort(), 'every authored plan pattern is operated');
      await page.waitForFunction(() => document.documentElement.classList.contains('msr-ready'));
      if (title.kind === 'legacy') {
        await page.locator('[data-kid-book-cover]').waitFor({ state: 'visible' });
        await inspect({ name: 'cover', legacy: true });
        const cover = page.locator('[data-kid-book-cover]');
        const visibleTitles = cover.locator('[data-kid-book-card-title]:visible, [data-kid-book-title]:visible');
        const coverWords = await glyphs(visibleTitles);
        const paper = await visibleTitles.evaluateAll(elements => elements.map(element => {
          const box = element.closest('.kid-page-plate, [data-kid-book-art]')?.getBoundingClientRect();
          return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
        }));
        const ownHero = cover.locator('[data-kid-book-own-hero], [data-story-own-hero="approved"]');
        const heroCount = await ownHero.count();
        const hero = heroCount === 1 ? await ownHero.boundingBox() : null;
        const art = await cover.locator('[data-kid-book-art]').boundingBox();
        check(coverWords.length === 1 && normalize(coverWords[0].text) === normalize(spec.title), 'cover shows its complete authored title exactly once');
        check(coverWords.length === 1 && coverWords.every((word, index) => word.visible && inside(word.inkRect, paper[index])), 'all legacy cover title glyphs stay visible on their paper leaf');
        check(heroCount === 1 && inside(hero, art), 'cover keeps exactly one own synthetic portrait fully inside its art leaf');
        check(coverWords.length === 1 && separate(coverWords[0].inkRect, hero), 'cover title is not hidden behind the own portrait');
        frames.push({ name: 'cover-geometry', paper, words: coverWords, hero, art });
        await persist();
        assert.equal(spec.paths.length, 3);
        for (let n = 0; n < spec.paths.length; n++) {
          const branch = spec.paths[n], seen = [];
          await page.locator('[data-kid-book-next]').click();
          for (const beat of branch.pages) {
            await page.locator(`[data-kid-book-beat="${beat.id}"]`).waitFor({ state: 'visible' });
            seen.push(beat.id);
            await inspect({ name: `${branch.choice}-${beat.id}`, legacy: true, expected: beat.text, capture: n === 0 || beat.id === 'consequence' });
            const identities = page.locator('[data-kid-book-portrait="approved"], [data-story-own-hero="approved"]');
            check(await identities.count() === 1, `${branch.choice}/${beat.id}: exactly one approved synthetic identity`);
            if (beat.id === 'decision') {
              assert.equal(await page.locator('[data-testid="decision-choice"]').count(), 3);
              check(await page.locator('[data-kid-book-next]').count() === 0, 'decision has no unusable Next');
              if (n === 0) {
                await page.locator('[data-kid-book-nav] button').first().click();
                await page.locator('[data-kid-book-beat="fear"]').waitFor({ state: 'visible' });
                await page.locator('[data-kid-book-next]').click();
                await page.locator('[data-kid-book-beat="decision"]').waitFor({ state: 'visible' });
                check(normalize(await page.locator('[data-kid-book-text]').innerText()) === normalize(beat.text), 'decision Back/Next preserves authored words');
              }
              await page.locator('[data-testid="decision-choice"]').nth(n).click();
            } else await page.locator('[data-kid-book-next]').click();
          }
          await page.locator('[data-kid-book-ending]').waitFor({ state: 'visible' });
          await paint();
          await page.locator('[data-catalogue-scroll]').evaluate(element => { element.scrollTop = 0; });
          const viewport = await page.locator('[data-catalogue-scroll]').boundingBox();
          const toys = await controls('[data-kid-book-ending] button');
          check(toys.length === 2 && toys.every(toy => inside(toy, viewport)), `${branch.choice}: ending replay/shelf actions initially visible`);
          check(inside(await page.locator('[data-kid-book-end-title]').boundingBox(), viewport), `${branch.choice}: ending title visible`);
          paths.push({ choice: branch.choice, seen, ended: true });
          if (n === 0) await shot('ending');
          await persist();
          if (n < spec.paths.length - 1) {
            await page.locator('[data-kid-book-ending] button').first().click();
            await page.locator('[data-kid-book-cover]').waitFor({ state: 'visible' });
          }
        }
        await page.locator('[data-kid-book-ending] button').nth(1).click();
        const tile = page.locator(`[data-kid-book="${title.id}"]`);
        await tile.waitFor({ state: 'visible' });
        check(await tile.locator('[data-kid-book-own-hero]').count() === 1, 'shelf keeps the passed own hero once');
        await shot('shelf-return');
        await tile.click();
        await page.locator('[data-kid-book-cover]').waitFor({ state: 'visible' });
        await page.locator('[data-catalogue-exit]').click();
      } else {
        await page.locator('[data-book-page="cover"]').waitFor({ state: 'visible' });
        if (title.kind === 'plan') {
          await page.locator('[data-book-picture-retry]').waitFor({ state: 'visible' });
          const before = await page.locator('[data-book-text]').innerText();
          await shot('cover-picture-unavailable');
          await page.locator('[data-book-picture-retry]').click();
          await readyCanonicalPicture('cover-picture-recovered');
          check(await page.locator('[data-book-text]').innerText() === before, 'plan retry retains cover words and position');
          planRecovery = true;
        }
        await inspect({ name: 'cover' });
        const coverFront = await page.locator('[data-book-reader]').getAttribute('data-page-type') === 'cover';
        const paper = await page.locator(coverFront ? '.bk-frame' : '[data-book-text]').boundingBox();
        const coverWords = await glyphs(page.locator('.bk-title, .bk-name-line, .bk-cover-line'));
        const open = await page.locator('[data-book-open]').boundingBox();
        const ownHero = page.locator('[data-book-hero]');
        const hero = await ownHero.boundingBox();
        check(coverWords.length >= 2 && coverWords.every(word => word.visible && inside(word.inkRect, paper)), 'all cover title/name/line glyphs stay on the physical cover or title page');
        check(await ownHero.count() === 1, 'cover retains exactly one approved synthetic identity');
        check(separate(open, hero), 'cover Open control does not cover the own hero');
        frames.push({ name: 'cover-geometry', paper, words: coverWords, open, hero });
        await persist();
        const advance = async (at, branch) => {
          const states = [];
          for (let click = 0; click < 12; click++) {
            const next = page.locator('[data-book-next]');
            await next.click(); // honors the real final-state hold; no test clock
            await readyCanonicalPicture(`${at}-advance-${click + 1}`);
            await paint();
            const current = await page.locator('[data-book-page]').getAttribute('data-book-page');
            if (current !== at) return states;
            const statePlate = page.locator('[data-book-state-plate]');
            const state = await statePlate.count() ? await statePlate.getAttribute('data-book-state-plate') : null;
            states.push(state);
            if (branch === spec.paths[0].choice) await shot(`${branch ?? 'linear'}-${at}-state-${click + 1}`);
          }
          throw new Error(`${at}: actual Next never advanced after all authored art states`);
        };
        for (let n = 0; n < spec.paths.length; n++) {
          const branch = spec.paths[n], seen = [];
          await page.locator('[data-book-open]').click();
          for (const authored of branch.pages) {
            await page.locator(`[data-book-page="${authored.id}"]`).waitFor({ state: 'visible' });
            seen.push(authored.id);
            const tag = `${branch.choice ?? 'linear'}-${authored.id}`;
            await inspect({ name: tag, expected: authored.text, capture: n === 0 || authored.repaired.length > 0 || /^(p6|p7|p8|p10)/.test(authored.id) });
            check(await page.locator('[data-book-hero]').count() === (authored.hero ? 1 : 0), `${tag}: own synthetic pose appears exactly when the authored page calls for it`);
            if (await page.locator('[data-book-choose]').count()) await page.locator('[data-book-choose]').click();
            if (await page.locator('[data-choice-card]').count()) {
              await inspect({ name: `${tag}-choices`, capture: n === 0 });
              check(await page.locator('[data-choice-card]').count() === 3, `${tag}: all three authored choices reachable`);
              check(await page.locator('[data-book-go]').isDisabled(), `${tag}: choice confirmation requires an actual selection`);
              await page.locator(`[data-choice-card="${branch.choice}"]`).click();
              check(await page.locator(`[data-choice-card="${branch.choice}"]`).getAttribute('aria-pressed') === 'true', `${tag}: selected choice is clear`);
              await page.locator('[data-book-go]').click();
              continue;
            }
            for (let tap = 0; tap < authored.repaired.length; tap++) {
              const step = authored.repaired[tap];
              if (tap === 0) {
                await page.keyboard.press(cell.lang === 'he' ? 'ArrowLeft' : 'ArrowRight');
                check(await page.locator('[data-book-page]').getAttribute('data-book-page') === authored.id, `${tag}: unrepaired page cannot be skipped with the keyboard`);
              }
              await page.locator(`[data-book-item="${step.item}"]`).click();
              await inspect({ name: `${tag}-repair-${step.item}`, expected: step.text, capture: true });
            }
            const states = await advance(authored.id, branch.choice);
            if (states.length) frames.push({ name: `${tag}-art-states`, states });
          }
          await page.locator('[data-book-page="end"]').waitFor({ state: 'visible' });
          await paint();
          const viewport = { x: 0, y: 0, width: cell.w, height: cell.h };
          const toys = await controls('[data-book-end-screen] button:visible');
          check(toys.every(toy => toy.visible && inside(toy, viewport) && toy.width >= 44 && toy.height >= 44), `${branch.choice ?? 'linear'}: ending actions fully visible`);
          const endWords = await glyphs(page.locator('.bk-end-title, .bk-end-frame'));
          check(endWords.length === 2 && endWords.every(word => word.visible && inside(word.rect, viewport)), `${branch.choice ?? 'linear'}: complete ending title and frame line`);
          frames.push({ name: `${branch.choice ?? 'linear'}-ending`, words: endWords, controls: toys });
          paths.push({ choice: branch.choice, seen, ended: true });
          await shot(`${branch.choice ?? 'linear'}-ending`);
          await page.locator('[data-book-grownup]').click();
          const panel = page.locator('[data-book-grownup-panel]');
          await panel.waitFor({ state: 'visible' });
          const grownupLines = await reachableLines(panel.locator('dt, dd'), '[data-book-grownup-panel]');
          check(grownupLines.length > 0 && grownupLines.every(line => line.reachable), 'every line of the complete grown-up panel is reachable');
          frames.push({ name: `${branch.choice ?? 'linear'}-grownup`, lines: grownupLines });
          await page.locator('[data-book-grownup]').click();
          await persist();
          if (n < spec.paths.length - 1) {
            await page.locator('[data-book-read-again]').click();
            await page.locator('[data-book-page="cover"]').waitFor({ state: 'visible' });
          }
        }
        check(await page.evaluate(() => window.storyCatalogueFixture.completed) === spec.paths.length, 'only actual endings report completion');
        await page.locator('[data-book-read-again]').click();
        await page.locator('[data-book-page="cover"]').waitFor({ state: 'visible' });
        await page.locator('[data-book-open]').click();
        await page.locator('[data-book-page="p1"]').waitFor({ state: 'visible' });
        check(await page.evaluate(() => window.storyCatalogueFixture.completed) === spec.paths.length, 'reread/open does not mint another finish');
        await page.locator('[data-book-close]').click();
        if (title.kind === 'plan') check(planRecovery, 'this pattern recovered through its actual authenticated plate route');
      }
      await page.locator('[data-catalogue-closed]').waitFor({ state: 'visible' });
      check(await page.locator('[data-kid-book-reader], [data-book-reader]').count() === 0, 'close unmounts the actual reader');
      check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
      check(unexpected.length === 0, `no generation or unapproved API/network: ${unexpected.join('; ')}`);
      check(requests.filter(read => read.source.startsWith('synthetic')).every(read => read.method === 'GET' && read.authorization === 'Bearer synthetic-story-catalogue'), 'every synthetic private read uses the real authenticated seam');
      const media = await page.evaluate(() => window.storyCatalogueMedia);
      check(media.captures === 0 && media.plays === 0 && media.syntheses === 0, 'no capture or fallback narration synthesis');
      evidence.media = media;
      evidence.passed = issues.length === 0;
      if (issues.length) await shot('failure');
    } catch (error) {
      issues.push(String(error));
      evidence.passed = false;
      if (page) {
        await shot('failure').catch(() => {});
        evidence.layout = await page.locator('[data-kid-book-reader], [data-kid-book-page], [data-kid-book-text], [data-book-reader], [data-book-text], [data-book-art]').evaluateAll(elements => elements.map(element => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          return { tag: element.tagName, attrs: [...element.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]), box: { x: box.x, y: box.y, width: box.width, height: box.height }, overflow: style.overflow, fontSize: style.fontSize, text: element.textContent?.slice(0, 300) };
        })).catch(() => []);
      }
    } finally {
      if (context) await context.close().catch(error => { issues.push(`context cleanup: ${error}`); evidence.passed = false; });
      await persist().catch(error => { issues.push(`progress write: ${error}`); evidence.passed = false; });
    }
    return evidence;
  };
  let nextJob = 0;
  const worker = async () => {
    while (nextJob < jobs.length) {
      const index = nextJob++;
      const { title, cell, label } = jobs[index];
      const started = Date.now();
      try {
        results[index] = await runCell(title, cell);
      } catch (error) {
        // A harness/setup failure also owns a result; later cells still run.
        results[index] = { label, title: title.id, kind: title.kind, viewport: cell.id, gender: cell.gender, passed: false, frames: [], paths: [], screenshots: [], issues: [`cell runner: ${error}`], errors: [], unexpected: [], requests: [] };
        await mkdir(path.join(folder, label), { recursive: true }).then(() => writeFile(path.join(folder, label, 'progress.json'), JSON.stringify(results[index], null, 2))).catch(writeError => { reportErrors.push(`${label}: ${writeError}`); });
      }
      results[index].elapsedMs = Date.now() - started;
      console.log(`[story-catalogue] ${results[index].passed ? 'PASS' : 'FAIL'} ${label} ${(results[index].elapsedMs / 1000).toFixed(1)}s`);
      await writeResults();
    }
  };
  const workers = await Promise.allSettled(Array.from({ length: 3 }, () => worker()));
  for (const worker of workers) if (worker.status === 'rejected') reportErrors.push(String(worker.reason));
  await reportWrites;
  assert.equal(results.filter(Boolean).length, jobs.length, 'every scheduled cell records a result');
  assert.deepEqual(results.map(result => result.label), jobs.map(job => job.label), 'final results retain all unique cells in deterministic catalogue order');
  assert.equal(new Set(results.map(result => result.label)).size, 120, 'all 120 independent cells are retained');
  await writeResults();
  const failed = results.filter(result => !result.passed);
  if (failed.length || reportErrors.length) throw new AggregateError([...failed.map(result => new Error(`${result.kind}/${result.title}/${result.viewport}/${result.gender}: ${result.issues.join('; ')}`)), ...reportErrors.map(error => new Error(error))], `Story catalogue failed ${failed.length}/${results.length} cells with ${reportErrors.length} reporting errors; every cell's progress and screenshots are retained in story-catalogue.`);
  return results;
}
