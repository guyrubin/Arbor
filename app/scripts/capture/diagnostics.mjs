/** Supplemental current-shell evidence; the historical sweep stays byte-for-byte unchanged. */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BASE, FONT_LIMITATION } from './config.mjs';

export async function collectDiagnostics(output, bundle) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const apiCache = new Map();
  const result = { fontLimitation: FONT_LIMITATION, cells: [], layout: [] };
  const save = () => writeFile(path.join(output, 'diagnostics.json'), JSON.stringify(result, null, 2));
  try {
    for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
      for (const lang of ['en', 'he']) {
        const context = await browser.newContext({ viewport: vp, locale: lang === 'he' ? 'he-IL' : 'en-US', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block', reducedMotion: 'reduce', permissions: [] });
        // Deny browser requests outside this synthetic origin as defense in depth.
        // Docker --network none also contains APIRequestContext, raw sockets,
        // redirects and any provider path that bypasses browser routing.
        await context.route('**/*', (route) => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
        await context.routeWebSocket(() => true, () => {});
        await context.route('**/api/**', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== BASE) return route.abort();
          const cacheable = request.method() === 'GET' || (request.method() === 'POST' && ['/api/todays-focus', '/api/digest'].includes(url.pathname));
          if (!cacheable) return route.continue();
          const key = `${request.method()} ${url.href} ${request.postData() ?? ''}`;
          if (apiCache.has(key)) return route.fulfill(apiCache.get(key));
          try {
            let response = await route.fetch();
            if (response.status() === 429 && !response.headers()['x-ai-quota-limit']) {
              await new Promise((resolve) => setTimeout(resolve, 65_000));
              response = await route.fetch();
            }
            const entry = { status: response.status(), headers: response.headers(), body: await response.body() };
            if (response.status() === 200) apiCache.set(key, entry);
            return route.fulfill(entry);
          } catch { return route.abort().catch(() => {}); }
        });
        await context.route('**/sandbox/demo-family.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: bundle }));
        await context.addInitScript(({ lang }) => {
          localStorage.setItem('arbor.uiLang', lang);
          localStorage.setItem('arbor.aiLang', lang);
          localStorage.setItem('arbor.kidmode.active', JSON.stringify({ open: false }));
        }, { lang });
        const page = await context.newPage();
        page.setDefaultTimeout(12_000);
        const viewport = `${vp.width}x${vp.height}`;
        const record = async (state, action, required = false, route = 'shell') => {
          const cell = { route, viewport, lang, state, required, reached: false };
          try {
            await action();
            cell.finalHash = await page.evaluate(() => location.hash);
            cell.shot = `shots/${route}.${viewport}.${lang}.${state}.png`;
            await page.screenshot({ path: path.join(output, cell.shot), animations: 'disabled' });
            cell.reached = true;
          } catch (error) {
            cell.reason = String(error.message ?? error).split('\n')[0].slice(0, 300);
            cell.shot = null;
          }
          result.cells.push(cell);
          await save();
          return cell.reached;
        };
        try {
          await page.goto(`${BASE}/?capture=supplement#/overview`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          await page.locator('[data-testid=companion-launcher]').waitFor({ state: 'visible' });
          const open = await record('launcher-open', async () => {
            await page.locator('[data-testid=companion-launcher] .companion-launch-main').click();
            await page.locator('.companion-conversation [data-testid=companion-composer] textarea').waitFor({ state: 'visible' });
          }, true);
          if (open) {
            const answered = await record('launcher-answered', async () => {
              await page.locator('.companion-conversation [data-testid=companion-composer] textarea').fill(lang === 'he' ? 'הוא מתפרק כשאנחנו עוזבים את גן השעשועים' : 'He melts down when we leave the playground');
              await page.locator('.companion-conversation [data-testid=coach-send]').click();
              const report = page.locator('[data-testid=coach-answer-cards]').last();
              await report.waitFor({ state: 'visible', timeout: 30_000 });
              await report.evaluate((element) => element.scrollIntoView({ block: 'start' }));
            }, true);
            if (answered) {
              for (const section of ['understanding', 'next', 'observe', 'avoid']) {
                await record(`report-${section}`, async () => {
                  const block = page.locator(`[data-testid=coach-report-${section}]`).last();
                  await block.waitFor({ state: 'visible' });
                  await block.scrollIntoViewIfNeeded();
                });
              }
              for (const disclosure of ['help', 'sources']) {
                await record(`report-${disclosure}-open`, async () => {
                  const button = page.locator(`[data-testid=coach-report-${disclosure}] button[aria-expanded]`).last();
                  await button.waitFor({ state: 'visible' });
                  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
                  await button.scrollIntoViewIfNeeded();
                });
              }
              if (vp.width >= 1280) await record('panel-expanded', async () => {
                await page.locator('.companion-conversation-heading .companion-chrome-button').first().click();
                await page.locator('.companion-workspace.is-expanded').waitFor({ state: 'visible' });
                await page.locator('[data-testid=coach-answer-cards]').last().evaluate((el) => el.scrollIntoView({ block: 'start' }));
              });
            }
          }
        } catch (error) {
          result.cells.push({ route: 'shell', state: 'launcher-setup', viewport, lang, reached: false, reason: String(error.message ?? error).split('\n')[0].slice(0, 300) });
        }
        // New full loads preserve source route behavior. Sample natural layout
        // for 3 s in each phase; CSS animations are not rewritten.
        for (const route of ['development', 'practice']) {
          try {
            await page.goto(`${BASE}/?capture=layout#/${route}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
            await page.locator(route === 'practice' ? '[data-module=together-invitation]' : 'main h1').waitFor({ state: 'visible' });
            for (const phase of ['baseline', 'dock-open', 'dock-closed']) {
              const layout = { route, viewport, lang, phase, reached: false, samples: [], fontLimitation: FONT_LIMITATION };
              try {
                if (phase === 'dock-open') {
                  await page.locator('[data-testid=companion-launcher] .companion-launch-main').click();
                  await page.locator('.companion-conversation textarea').waitFor({ state: 'visible' });
                } else if (phase === 'dock-closed') {
                  await page.locator('.companion-conversation-heading .companion-chrome-button').last().click();
                  await page.locator('[data-testid=companion-launcher]').waitFor({ state: 'visible' });
                }
                for (const delay of [0, 250, 750, 2000]) {
                  await page.waitForTimeout(delay);
                  layout.samples.push(await page.evaluate(() => ({
                    atMs: Math.round(performance.now()),
                    fontsStatus: document.fonts.status,
                    fontFaces: [...document.fonts].map((f) => ({ family: f.family, status: f.status, weight: f.weight })),
                    modules: [...document.querySelectorAll('main [data-module], main h1')].map((el) => {
                      const box = el.getBoundingClientRect();
                      return { name: el.getAttribute('data-module') ?? 'h1', top: box.top, height: box.height, width: box.width };
                    }),
                    textFonts: [...document.querySelectorAll('main h1, main h2, main p')].slice(0, 30).map((el) => {
                      const css = getComputedStyle(el);
                      return { tag: el.tagName, family: css.fontFamily, size: css.fontSize, lineHeight: css.lineHeight };
                    }),
                  })));
                }
                layout.finalHash = await page.evaluate(() => location.hash);
                layout.shot = `shots/${route}.${viewport}.${lang}.${phase}.png`;
                await page.screenshot({ path: path.join(output, layout.shot), animations: 'disabled', fullPage: phase !== 'dock-open' });
                layout.reached = true;
              } catch (error) {
                layout.reason = String(error.message ?? error).split('\n')[0].slice(0, 300);
              }
              result.layout.push(layout);
              await save();
            }
          } catch (error) {
            result.layout.push({ route, viewport, lang, phase: 'setup', reached: false, reason: String(error.message ?? error).split('\n')[0].slice(0, 300) });
          }
        }
        // Only click already-present history chips. No generated historical
        // record, subscription, email opt-in or external export is fabricated.
        await record('current-week', async () => {
          await page.goto(`${BASE}/?capture=weekly#/weekly`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          await page.locator('[data-testid=weekly-eyebrow]').waitFor({ state: 'visible' });
          await page.waitForTimeout(1000);
        }, false, 'weekly');
        await record('historical-week', async () => {
          const history = page.locator('[data-testid=weekly-after-story] > div button');
          if (await history.count() < 2) throw new Error('Synthetic seed has no historical weekly report chip; historical template was not rendered.');
          await history.nth(1).click();
          await page.locator('[data-testid=weekly-eyebrow]').scrollIntoViewIfNeeded();
        }, false, 'weekly');
        await save();
        await context.close();
      }
    }
  } finally { await browser.close(); }
  return result;
}
