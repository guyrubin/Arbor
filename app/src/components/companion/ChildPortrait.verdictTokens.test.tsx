import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Observation } from "../../lib/observations";
import type { Milestone } from "../../types";

/* B-INF-08 — the verdictTokens=0 cap on My child (#/development), proven on the
   page itself. The real ChildPortrait is rendered (synthetic catalogue rows and
   an invented child; no child data) at each release viewport EN+HE
   (scripts/capture/release-config.mjs RELEASE_VIEWPORTS: the phone composition
   below 1024, the desk one above), loaded into Chromium, and weighed by the
   sweep's OWN in-page measure — `collect` is read out of
   scripts/rendered-sweep.mjs, not re-implemented — so the number asserted is
   the number the sweep records and scripts/weightLimits.test.ts caps at 0.
   Negative controls: a count line, a percentage, a graded chip, a progress bar
   and a second paint on a blank area, each injected into a real area row of
   the rendered page, must each raise verdictTokens above the cap; a plain
   count ("31 seen") must not. Needs Playwright's Chromium (CI installs it
   before `npm test`); skipped, saying so, where it is not installed. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  phone: false,
  profile: {} as Record<string, unknown>,
  milestones: [] as Milestone[],
  observations: [] as Observation[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: state.profile, milestones: state.milestones, behaviorLogs: [], playLogs: [],
  setActiveTab: vi.fn(), seedCoach: vi.fn(), openCaptureSheet: vi.fn(),
  setMilestoneObservation: vi.fn(() => Promise.resolve()), addCustomMilestone: vi.fn(() => Promise.resolve()),
  pendingMemoryItems: [],
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => ({ observations: state.observations, sources: { behaviorLogs: [] }, reload: vi.fn() }) }));
vi.mock("../../hooks/useChildCollection", async original => ({
  ...(await original<typeof import("../../hooks/useChildCollection")>()),
  useChildCollection: () => ({ items: [], upsert: vi.fn(() => Promise.resolve()), remove: vi.fn(() => Promise.resolve()) }),
}));
vi.mock("../../hooks/useNoticeActions", () => ({ useNoticeActions: () => ({
  scopeKey: `account-a:${state.profile.id}`, confirmed: true, isCurrent: () => true,
  keepsakes: { items: [], upsert: vi.fn(), remove: vi.fn() },
  forMilestone: () => ({ onAnswer: vi.fn() }),
}) }));
vi.mock("../../hooks/useHashQuery", async original => ({
  ...(await original<typeof import("../../hooks/useHashQuery")>()),
  useHashQuery: () => new URLSearchParams(""),
  goToRoute: vi.fn(),
}));
vi.mock("../../lib/screeningWatch", async original => ({
  ...(await original<typeof import("../../lib/screeningWatch")>()),
  readWatchFocus: () => null, resolveWatchFocus: () => null, clearWatchFocus: vi.fn(), writeWatchFocus: vi.fn(),
}));
vi.mock("../ui/CelebrationMoment", async original => ({
  ...(await original<typeof import("../ui/CelebrationMoment")>()),
  hasCelebrated: () => true, markCelebrated: vi.fn(),
}));
vi.mock("../ui/Sheet", async original => ({ ...(await original<typeof import("../ui/Sheet")>()), useCompactSurface: () => state.phone }));
vi.mock("../../design/useComposition", () => ({ useComposition: () => (state.phone ? "phone" : "desk") }));
vi.mock("./ChildDoors", async original => ({ ...(await original<typeof import("./ChildDoors")>()), useChildPhoneLayout: () => state.phone }));
import ChildPortrait from "./ChildPortrait";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { RELEASE_VIEWPORTS } from "../../../scripts/capture/release-config.mjs";
import { VERDICT_TEXT_PATTERNS } from "../../../scripts/capture/verdict-tokens.mjs";

/** The sweep's in-page per-cell measure, verbatim from scripts/rendered-sweep.mjs. */
const SWEEP = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "scripts", "rendered-sweep.mjs"), "utf8");
const COLLECT = (() => {
  const start = SWEEP.indexOf("\nfunction collect(");
  const end = SWEEP.indexOf("\n}\n", start);
  return start < 0 || end < 0 ? "" : SWEEP.slice(start + 1, end + 2);
})();

/** Seen it on a few Words, Moving and Food rows (yesterday), Not yet elsewhere: counts on some areas, blank others. */
const record = (): Milestone[] => {
  const by = groupMilestonesByShelf(ALL_MILESTONES.map(m => ({ ...m })));
  const marked = new Set([...by.words.slice(0, 5), ...by.moving.slice(0, 2), ...by.food.slice(0, 1)].map(m => m.id));
  const at = new Date(Date.now() - 86_400_000).toISOString();
  return ALL_MILESTONES.map(m => (marked.has(m.id) ? { ...m, checked: true, observationStatus: "yes" as const, observationUpdatedAt: at } : { ...m, observationStatus: "not_yet" as const }));
};
const birthDate = (monthsAgo: number) => {
  const d = new Date(); d.setMonth(d.getMonth() - monthsAgo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

type Viewport = { id: string; w: number; h: number; lang: "en" | "he" };
const VIEWPORTS = RELEASE_VIEWPORTS as readonly Viewport[];
const cellOf = (vp: Viewport) => `development|${vp.w}x${vp.h}|${vp.lang}`;

function renderMyChild(vp: Viewport): string {
  state.lang = vp.lang;
  state.phone = vp.w < 1024; // the composition seam: desk ≥ 1024 px, else phone
  state.profile = { id: "child-a", name: "Noa Example", birthDate: birthDate(30), strengths: ["Curiosity"], interests: [] };
  state.milestones = record();
  state.observations = [];
  const body = renderToStaticMarkup(<ChildPortrait />);
  const dir = vp.lang === "he" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${vp.lang}" dir="${dir}"><head><meta charset="utf-8"></head><body><div id="root"><main>${body}</main></div></body></html>`;
}

/** Injected into a real area row of the rendered page; each must be counted. */
const INJECT: { name: string; js: string }[] = [
  { name: "a count line on an area row (EN)", js: `tile().append(Object.assign(document.createElement("span"), { textContent: "Seen 3 of 12" }))` },
  { name: "a count line on an area row (HE)", js: `tile().append(Object.assign(document.createElement("span"), { textContent: "נצפו 3 מתוך 12" }))` },
  { name: "a percentage on an area row", js: `tile().append(Object.assign(document.createElement("span"), { textContent: "64%" }))` },
  { name: "a graded chip on an area row", js: `tile().append(Object.assign(document.createElement("span"), { textContent: "High" }))` },
  { name: "a progress bar on an area row", js: `{ const b = document.createElement("div"); b.setAttribute("role", "progressbar"); b.style.cssText = "display:block;width:40px;height:6px"; tile().append(b); }` },
  { name: "a second paint on a blank area (a colour code)", js: `quiet()[1].style.background = "rgb(220, 60, 60)"` },
];
const HELPERS = `const tile = () => document.querySelector('main [data-testid="dev-map-tile"]');
const quiet = () => [...document.querySelectorAll('main [data-testid="dev-map-tile"][data-tone="quiet"]')];`;

type Weight = { verdictTokens: number };
const chromiumPath = (() => { try { return chromium.executablePath(); } catch { return ""; } })();
const haveChromium = !!chromiumPath && fs.existsSync(chromiumPath);

describe("B-INF-08 — the sweep's measure is the one read here", () => {
  it("collect() is found in scripts/rendered-sweep.mjs and counts verdictTokens from the shared patterns", () => {
    expect(COLLECT.startsWith("function collect(")).toBe(true);
    expect(COLLECT).toContain("verdictTokens");
    expect(COLLECT.trimEnd().endsWith("}")).toBe(true);
    expect(SWEEP).toMatch(/verdict: VERDICT_TEXT_PATTERNS/);
  });

  it("My child renders its eight area rows, some with a count and some blank, in every release cell", () => {
    for (const vp of VIEWPORTS) {
      const html = renderMyChild(vp);
      expect(html.match(/data-testid="dev-map-tile"/g), cellOf(vp)).toHaveLength(8);
      expect((html.match(/data-tone="quiet"/g) ?? []).length, cellOf(vp)).toBeGreaterThanOrEqual(2);
      expect(html, cellOf(vp)).toContain('data-testid="dev-map-seen-area"');
    }
  });
});

describe.skipIf(!haveChromium)(`B-INF-08 — verdictTokens on the rendered My child page${haveChromium ? "" : " [skipped: Playwright Chromium is not installed (npx playwright install chromium)]"}`, () => {
  let browser: Browser;
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 60_000);
  afterAll(async () => { await browser?.close(); });

  const weigh = async (vp: Viewport, inject?: string): Promise<Weight> => {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    try {
      await page.setContent(renderMyChild(vp), { waitUntil: "load" });
      if (inject) await page.evaluate(`(() => { ${HELPERS} ${inject}; })()`);
      const args = { lang: vp.lang, allowLatin: [], verdict: VERDICT_TEXT_PATTERNS, region: "main" };
      const rec = (await page.evaluate(`(${COLLECT})(${JSON.stringify(args)})`)) as { mounted: boolean; weight: Weight };
      expect(rec.mounted, `${cellOf(vp)} mounted`).toBe(true);
      return rec.weight;
    } finally {
      await page.close();
    }
  };

  for (const vp of VIEWPORTS) {
    it(`${cellOf(vp)}: the page as shipped carries 0 verdict tokens, and a plain count stays 0`, async () => {
      expect((await weigh(vp)).verdictTokens).toBe(0);
      const plain = `tile().append(Object.assign(document.createElement("span"), { textContent: "31 seen" }))`;
      expect((await weigh(vp, plain)).verdictTokens).toBe(0);
    }, 30_000);

    it(`${cellOf(vp)}: the cap FAILS on each injected verdict (count line, percentage, chip, bar, colour code)`, async () => {
      const got: Record<string, number> = {};
      for (const { name, js } of INJECT) got[name] = (await weigh(vp, js)).verdictTokens;
      // HARD_CAPS (scripts/weightLimits.test.ts): verdictTokens ≤ 0 on development; every fixture breaks it.
      expect(Object.entries(got).filter(([, n]) => !(n > 0)).map(([name]) => name)).toEqual([]);
    }, 60_000);
  }
});
