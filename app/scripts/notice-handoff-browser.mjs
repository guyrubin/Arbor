/** B-GROWTH-44 Talk/Care: local synthetic sources, exact reviewed egress.
 * Text fonts use capture/font-cache.mjs's normal TLS + URL/body validation.
 * The isolated browser intercepts clipboard and the one explicit mock Send.
 * No real family account, live model, clinician, or recipient is used.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { SOURCE_CSS_URL, readPublicResource, cssFontResources, chromiumUserAgent } from "./capture/font-cache.mjs";

const base = process.env.NOTICE_TEST_BASE ?? "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "LOCAL_SYNTHETIC_SERVER_REQUIRED");
const output = path.resolve(process.env.NOTICE_HANDOFF_OUT ?? "../docs/reviews/notice-object-2026-10-18/handoffs");
mkdirSync(output, { recursive: true });
const bundle = JSON.parse(readFileSync(".data/demo-family.json", "utf8"));
assert.equal(bundle.child.demo, true);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const userAgent = chromiumUserAgent(browser.version());
const fontCss = await readPublicResource(SOURCE_CSS_URL, userAgent, "css");
const allowedFonts = new Set(cssFontResources(fontCss.bytes.toString()).urls);
const fontResources = new Map([[SOURCE_CSS_URL, Promise.resolve(fontCss)]]);
const report = { kind: "local-synthetic-mocked-egress", at: new Date().toISOString(), browser: browser.version(), seed: `${bundle.version}@${bundle.seededAt}`, cells: [], fonts: [] };
const matrix = [{ id: "mobile-en", width: 375, height: 812, lang: "en" }, { id: "mobile-he", width: 375, height: 812, lang: "he" }, { id: "desktop-en", width: 1280, height: 800, lang: "en" }, { id: "desktop-he", width: 1280, height: 800, lang: "he" }];
const childId = bundle.child.id, milestoneId = "cdc-24m-1";
const target = `#/development?notice=${milestoneId}&child=${childId}`;
const saveReport = () => writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));

try {
  for (const size of matrix) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, locale: size.lang === "he" ? "he-IL" : "en-GB", reducedMotion: "reduce", userAgent });
    await context.addInitScript(lang => {
      localStorage.setItem("arbor.uiLang", lang); localStorage.setItem("arbor.aiLang", lang); localStorage.setItem("arbor.kidmode.active", "false");
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__noticeClipboard = text; } } });
    }, size.lang);
    await context.route("**/sandbox/demo-family.json", route => route.fulfill({ json: bundle }));
    await context.route(url => ["https://fonts.googleapis.com", "https://fonts.gstatic.com"].includes(url.origin), async route => {
      const url = route.request().url(); assert(url === SOURCE_CSS_URL || allowedFonts.has(url), "UNEXPECTED_FONT_RESOURCE");
      if (!fontResources.has(url)) fontResources.set(url, readPublicResource(url, userAgent, "woff2"));
      const resource = await fontResources.get(url); await route.fulfill({ status: 200, body: resource.bytes, headers: resource.responseHeaders });
    });
    const page = await context.newPage();
    const cell = { id: size.id, shots: [], checks: [], pageErrors: [], requests: [], fonts: [] };
    report.cells.push(cell);
    page.on("pageerror", error => cell.pageErrors.push(String(error.message)));
    page.on("request", request => { if (request.method() === "POST" && /\/api\/(?:chat|coach|generate|consult)/.test(request.url())) cell.requests.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() }); });
    await page.route("**/api/chat", route => route.fulfill({ json: { text: "This is an invented local test response.", followUps: [] } }));
    const shot = async state => {
      await page.evaluate(async () => { await document.fonts.ready; });
      // Dismiss real transient toast controls; do not hide or restyle the UI.
      const dismiss = page.locator(".arbor-toast-dismiss");
      for (let count = await dismiss.count(); count > 0; count = await dismiss.count()) {
        await dismiss.first().click();
        await page.waitForFunction(previous => document.querySelectorAll(".arbor-toast-dismiss").length < previous, count);
      }
      // A visible element can still be halfway through the dock entrance.
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="notice-talk-review"], [data-testid="notice-care-target"]')].every(el => {
        for (let node = el; node && node !== document.body; node = node.parentElement) {
          if (Number(getComputedStyle(node).opacity) < 1) return false;
        }
        return true;
      }));
      const filename = `${size.id}-${state}.png`; await page.screenshot({ path: path.join(output, filename) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, `${size.id}/${state}: horizontal overflow`); cell.shots.push({ state, file: filename, overflow }); saveReport();
    };
    try {
      await page.goto(`${base}/${target}`);
      const detail = page.getByTestId("notice-object-detail"); await detail.waitFor({ state: "visible" });
      const title = await detail.getByTestId("notice-title").innerText();
      if (size.lang === "he") assert(/[\u0590-\u05ff]/.test(title), "HE_TITLE_REQUIRED");
      await detail.locator('[data-answer="not_sure"]').click(); await detail.locator('[data-phase="thanked"]').waitFor();
      await detail.getByTestId("notice-object-edit-evidence").click();
      const editor = page.getByTestId("first-keepsake-sheet"); await editor.waitFor({ state: "visible" });
      const words = size.lang === "he" ? "הוא הביט לעבר הילדה שבכתה ואז נשאר לידה עם הדובי שלו." : "He looked towards the child who was crying, then stayed beside her with his bear.";
      await editor.getByTestId("first-keepsake-note").fill(words); await editor.getByTestId("first-keepsake-date").fill("2026-10-12");
      await editor.getByTestId("first-keepsake-save").click(); await editor.waitFor({ state: "hidden" });
      await detail.locator(".notice-object-controls > summary").click(); await detail.getByTestId("notice-object-talk").click(); await detail.waitFor({ state: "hidden" });
      const review = page.getByTestId("notice-talk-review"); await review.waitFor({ state: "visible" });
      assert((await review.innerText()).includes(title)); assert((await review.innerText()).includes(words));
      assert.equal(await review.getByTestId("notice-talk-source-answer").getAttribute("aria-checked"), "false");
      assert.equal(cell.requests.length, 0); await shot("talk-source-choice");
      const field = page.getByTestId("companion-composer").locator("textarea");
      const question = size.lang === "he" ? "מה אפשר לנסות יחד סביב הרגע הזה?" : "What could we try together around this moment?";
      await field.fill(question);
      await review.getByTestId("notice-talk-source-answer").click(); await review.getByTestId("notice-talk-source-kept").click();
      let draft = await review.getByTestId("notice-talk-preview").innerText(); assert(draft.includes(words)); assert(draft.includes(title)); assert(draft.includes(`keepsakes:${milestoneId}`));
      await review.getByTestId("notice-talk-source-kept").click(); draft = await review.getByTestId("notice-talk-preview").innerText(); assert(!draft.includes(words));
      await review.getByTestId("notice-talk-source-kept").click(); await review.getByTestId("notice-talk-approved").click();
      assert.equal(await review.getByTestId("notice-talk-approved").getAttribute("aria-checked"), "true");
      await shot("talk-reviewed-message"); cell.checks.push("Same title/date/parent words; per-source inclusion/removal; explicit review required; no automatic model call");
      const replacement = `${words} ${size.lang === "he" ? "מילים מעודכנות." : "Updated words."}`;
      await page.evaluate(({ childId, milestoneId, replacement }) => {
        const key = `arbor.keepsakes.${childId}`; const rows = JSON.parse(localStorage.getItem(key) ?? "[]"); rows.find(row => row.id === milestoneId).note = replacement; localStorage.setItem(key, JSON.stringify(rows));
      }, { childId, milestoneId, replacement });
      // No storage event or React paint is needed for the final Send guard.
      await page.getByTestId("coach-send").click(); await review.getByTestId("notice-talk-source-kept").filter({ hasText: replacement }).waitFor();
      assert.equal(cell.requests.length, 0); assert.equal(await review.getByTestId("notice-talk-approved").getAttribute("aria-checked"), "false");
      await shot("talk-source-changed"); cell.checks.push("Same-tab source edit before React paint blocks Send and retires selection/approval");
      await review.getByTestId("notice-talk-source-answer").click(); await review.getByTestId("notice-talk-source-kept").click(); await review.getByTestId("notice-talk-approved").click();
      const latestDraft = await review.getByTestId("notice-talk-preview").innerText(); await page.getByTestId("coach-send").click(); await review.waitFor({ state: "hidden" });
      assert.equal(cell.requests.length, 1); assert.equal(cell.requests[0].body.message, latestDraft); assert.equal(cell.requests[0].body.childId, childId);
      cell.checks.push("The one explicit Send carries exactly the re-reviewed message to an intercepted local mock endpoint");
      await page.goto(`${base}/${target}`); await detail.waitFor({ state: "visible" });
      await detail.locator(".notice-object-controls > summary").click(); await detail.getByTestId("notice-object-care").click();
      const care = page.getByTestId("notice-care-target"); await care.waitFor({ state: "visible" });
      const conversation = page.locator(".companion-conversation");
      await conversation.waitFor({ state: "hidden" });
      assert.equal(await conversation.count(), 1); assert((await conversation.textContent()).includes(replacement));
      cell.checks.push("Care steps the companion dock aside at every width while retaining its existing conversation");
      assert((await care.innerText()).includes(title)); assert.equal(await care.getByTestId("consult-copy").isDisabled(), true);
      const items = care.getByTestId("consult-packet-item");
      assert.equal(await items.count(), 2);
      if (size.width >= 1280) assert((await items.first().boundingBox()).width >= 240, "CARE_SOURCE_READING_WIDTH");
      for (let i = 0; i < await items.count(); i++) await items.nth(i).getByRole("button").click();
      await care.getByTestId("consult-reviewed").click();
      const showAll = care.getByTestId("consult-preview-all");
      if (await showAll.isVisible()) await showAll.click();
      await care.getByTestId("consult-reviewed").scrollIntoViewIfNeeded();
      assert.equal(await care.getByTestId("consult-copy").isDisabled(), false); await shot("care-reviewed-summary");
      await care.getByTestId("consult-copy").click(); const copied = await page.evaluate(() => window.__noticeClipboard); assert(copied.includes(replacement)); assert(copied.includes(title));
      const visibleCareItems = (await items.allTextContents()).join("\n");
      for (const id of [`milestones:${milestoneId}`, `keepsakes:${milestoneId}`]) { assert(!copied.includes(id)); assert(!visibleCareItems.includes(id)); }
      cell.checks.push("Care starts unselected and uses its existing review/preview/Copy path for precisely the selected source records");
      await page.evaluate(({ childId, milestoneId }) => {
        const key = `arbor.milestones.${childId}`; const rows = JSON.parse(localStorage.getItem(key) ?? "[]"); rows.find(row => row.id === milestoneId).observationStatus = "not_yet"; localStorage.setItem(key, JSON.stringify(rows));
        window.dispatchEvent(new StorageEvent("storage", { key }));
      }, { childId, milestoneId });
      await page.waitForFunction(() => document.querySelector('[data-testid="consult-reviewed"]')?.getAttribute("aria-pressed") === "false");
      assert.equal(await care.getByTestId("consult-copy").isDisabled(), true); await shot("care-source-changed");
      cell.checks.push("Changed source withdraws Care item selections and final approval");
      cell.fonts = await page.evaluate(() => [...document.fonts].filter(face => face.status === "loaded").map(face => face.family));
      assert(cell.fonts.includes(size.lang === "he" ? "Frank Ruhl Libre" : "Fraunces")); assert(cell.fonts.includes(size.lang === "he" ? "IBM Plex Sans Hebrew" : "Instrument Sans"));
      assert.equal(cell.pageErrors.length, 0, cell.pageErrors.join("\n")); saveReport();
      process.stdout.write(`Handoff: ${size.id} passed (${cell.shots.length} rendered states)\n`);
    } catch (error) { cell.failure = String(error); await shot("failure"); throw error; }
    finally { await context.close(); }
  }
  report.fonts = await Promise.all([...fontResources].map(async ([url, pending]) => { const resource = await pending; return { url, sha256: resource.sha256, bytes: resource.size, retrievedAt: resource.retrievedAt }; }));
  saveReport();
} finally { await browser.close(); }
