/** B-GROWTH-44 local, synthetic integration and visual evidence.
 * Run against the ordinary mock development server on localhost:3000.
 * Public text fonts use the repository's strict URL/body validator and normal
 * TLS validation in Node; Chrome's certificate store differs in this runner.
 * This does not change CSS, disable certificate checks, or claim Firestore proof.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { SOURCE_CSS_URL, readPublicResource, cssFontResources, chromiumUserAgent } from "./capture/font-cache.mjs";

const base = process.env.NOTICE_TEST_BASE ?? "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "LOCAL_SYNTHETIC_SERVER_REQUIRED");
const output = path.resolve(process.env.NOTICE_TEST_OUT ?? "../docs/reviews/notice-object-2026-10-18/rendered");
mkdirSync(output, { recursive: true });
const bundle = JSON.parse(readFileSync(".data/demo-family.json", "utf8"));
assert.equal(bundle.child.demo, true);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const userAgent = chromiumUserAgent(browser.version());
const fontCss = await readPublicResource(SOURCE_CSS_URL, userAgent, "css");
const allowedFonts = new Set(cssFontResources(fontCss.bytes.toString()).urls);
const fontResources = new Map([[SOURCE_CSS_URL, Promise.resolve(fontCss)]]);
const report = { kind: "local-synthetic", at: new Date().toISOString(), browser: browser.version(), seed: `${bundle.version}@${bundle.seededAt}`, fonts: [], cells: [] };
const matrix = [{ id: "mobile-en", width: 375, height: 812, lang: "en" }, { id: "mobile-he", width: 375, height: 812, lang: "he" }, { id: "desktop-en", width: 1280, height: 800, lang: "en" }, { id: "desktop-he", width: 1280, height: 800, lang: "he" }];
const childId = bundle.child.id;
const milestoneId = "cdc-24m-1";
const target = `#/development?notice=${milestoneId}&child=${childId}`;

try {
  for (const size of matrix) {
    const context = await browser.newContext({ viewport: size, locale: size.lang === "he" ? "he-IL" : "en-GB", reducedMotion: "reduce", userAgent });
    await context.addInitScript(lang => {
      localStorage.setItem("arbor.uiLang", lang); localStorage.setItem("arbor.aiLang", lang);
      localStorage.setItem("arbor.kidmode.active", "false");
    }, size.lang);
    await context.route("**/sandbox/demo-family.json", route => route.fulfill({ json: bundle }));
    await context.route(url => ["https://fonts.googleapis.com", "https://fonts.gstatic.com"].includes(url.origin), async route => {
      const url = route.request().url();
      assert(url === SOURCE_CSS_URL || allowedFonts.has(url), "UNEXPECTED_FONT_RESOURCE");
      if (!fontResources.has(url)) fontResources.set(url, readPublicResource(url, userAgent, "woff2"));
      const resource = await fontResources.get(url);
      await route.fulfill({ status: 200, body: resource.bytes, headers: resource.responseHeaders });
    });
    const page = await context.newPage();
    const cell = { id: size.id, shots: [], checks: [], pageErrors: [], modelRequests: [], fonts: [] };
    page.on("pageerror", error => cell.pageErrors.push(String(error.message)));
    page.on("request", request => {
      if (request.method() === "POST" && /\/api\/(?:chat|coach|todays-focus|generate|consult)/.test(request.url())) cell.modelRequests.push(new URL(request.url()).pathname);
    });
    const detail = page.getByTestId("notice-object-detail");
    const record = () => page.evaluate(({ childId, milestoneId }) => JSON.parse(localStorage.getItem(`arbor.milestones.${childId}`) ?? "[]").find(item => item.id === milestoneId), { childId, milestoneId });
    const shot = async state => {
      await page.evaluate(async () => { await document.fonts.ready; });
      const dismiss = page.locator(".arbor-toast-dismiss");
      for (let count = await dismiss.count(); count > 0; count = await dismiss.count()) {
        await dismiss.first().click();
        await page.waitForFunction(previous => document.querySelectorAll(".arbor-toast-dismiss").length < previous, count);
      }
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(el => {
        for (let node = el; node && node !== document.body; node = node.parentElement) {
          if (Number(getComputedStyle(node).opacity) < 1) return false;
        }
        return true;
      }));
      const filename = `${size.id}-${state}.png`;
      await page.screenshot({ path: path.join(output, filename) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, `${size.id}/${state}: horizontal overflow`);
      cell.shots.push({ state, file: filename, overflow });
    };
    await page.goto(`${base}/${target}`);
    await detail.waitFor({ state: "visible" });
    await page.getByTestId("notice-area-art").evaluate(img => img.decode());
    await shot("unanswered");
    cell.fonts = await page.evaluate(() => [...document.fonts].filter(face => face.status === "loaded").map(face => face.family));
    assert(cell.fonts.includes(size.lang === "he" ? "Frank Ruhl Libre" : "Fraunces"), "DISPLAY_FONT_NOT_LOADED");
    assert(cell.fonts.includes(size.lang === "he" ? "IBM Plex Sans Hebrew" : "Instrument Sans"), "BODY_FONT_NOT_LOADED");
    for (const button of await detail.locator('[data-answer]').all()) assert((await button.boundingBox()).height >= 44, "ANSWER_TOUCH_TARGET");
    await detail.locator('[data-answer="yes"]').focus();
    await page.keyboard.press(size.lang === "he" ? "ArrowLeft" : "ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-answer")), "not_yet");
    await page.keyboard.press("End");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-answer")), "not_sure");
    await page.keyboard.press("Space");
    cell.checks.push("Three 44px touch targets; keyboard arrows follow locale and End/Space selects the neutral answer");
    await detail.locator('[data-phase="thanked"]').waitFor();
    assert.equal((await record()).observationStatus, "not_sure");
    assert.equal((await record()).checked, false);
    await shot("not-sure");
    await page.reload(); await detail.waitFor({ state: "visible" });
    await detail.locator('[data-phase="thanked"]').waitFor();
    cell.checks.push("Neutral answer persists after reload without marking an observed milestone");
    await detail.getByTestId("notice-change").click();
    await detail.locator('[data-answer="not_yet"]').click();
    await detail.locator('[data-phase="thanked"]').waitFor();
    await shot("not-yet");
    await detail.getByTestId("notice-change").click();
    await detail.locator('[data-answer="yes"]').click();
    await detail.locator('[data-phase="seen"]').waitFor();
    assert.equal((await record()).checked, true);
    await shot("seen");
    await detail.locator('[data-when="earlier"]').click();
    await page.waitForFunction(({ childId, milestoneId }) => JSON.parse(localStorage.getItem(`arbor.milestones.${childId}`) ?? "[]").find(item => item.id === milestoneId)?.observedWhen === "earlier", { childId, milestoneId });
    await detail.getByTestId("notice-object-edit-evidence").click();
    const editor = page.getByTestId("first-keepsake-sheet");
    await editor.waitFor({ state: "visible" });
    assert.equal(await editor.getByTestId("first-keepsake-date").inputValue(), "");
    const words = size.lang === "he" ? "עצר ליד הילדה שבכתה והביא לה את הדובי. אחר כך ישב לידה בשקט וחיכה עד שהיא חייכה." : "He stopped beside the child who was crying and brought her the bear. Then he sat quietly with her until she smiled.";
    await editor.getByTestId("first-keepsake-note").fill(words);
    await editor.getByTestId("first-keepsake-date").fill("2026-10-12");
    await shot("dated-words-editor");
    await editor.getByTestId("first-keepsake-save").click();
    await editor.waitFor({ state: "hidden" });
    await detail.getByTestId("notice-object-keepsake").waitFor();
    await shot("with-words");
    cell.checks.push("Approximate observation requests an explicit evidence date; words survive save");
    await page.reload(); await detail.getByTestId("notice-object-keepsake").waitFor();
    assert((await detail.getByTestId("notice-object-keepsake").innerText()).includes(words));
    cell.checks.push("Exact object and dated words reopen after reload");
    await detail.locator(".notice-object-controls > summary").click();
    await detail.locator(".notice-object-controls").scrollIntoViewIfNeeded();
    await shot("connected-actions");
    await detail.getByTestId("notice-object-remove-answer").click();
    await page.waitForFunction(({ childId, milestoneId }) => !JSON.parse(localStorage.getItem(`arbor.milestones.${childId}`) ?? "[]").find(item => item.id === milestoneId)?.observationStatus, { childId, milestoneId });
    const kept = await page.evaluate(({ childId, milestoneId }) => JSON.parse(localStorage.getItem(`arbor.keepsakes.${childId}`) ?? "[]").find(item => item.milestoneId === milestoneId), { childId, milestoneId });
    assert.equal(kept.note, words); assert.equal(kept.noticedOn, "2026-10-12");
    cell.checks.push("Removing the response retains independently kept words and their exact date");
    assert.equal(cell.pageErrors.length, 0, cell.pageErrors.join("\n"));
    assert.equal(cell.modelRequests.length, 0, "Notice navigation/save made an AI request");
    report.cells.push(cell);
    writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    await context.close();
    process.stdout.write(`Observation: ${size.id} passed (${cell.shots.length} rendered states)\n`);
  }
  report.fonts = await Promise.all([...fontResources].map(async ([url, pending]) => { const resource = await pending; return { url, sha256: resource.sha256, bytes: resource.size, retrievedAt: resource.retrievedAt }; }));
  writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
