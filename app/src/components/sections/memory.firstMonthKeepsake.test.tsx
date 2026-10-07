import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* B-SHELL-NEW-keepsake — PASS A5 (1b6ba9c1) retired the LifecycleMomentCard
   body from Today; the first-month keepsake lives in #/memory's keepsakes
   section beside "Things {name} said", rendered ONCE with its own date. No
   Today mount, no celebration, no share prompt. EN + HE. */

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  anchor: "2026-08-04T09:00:00.000Z" as string | undefined,
  logs: [] as { timestamp: string }[],
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan Rubin", onboardingCompletedAt: h.anchor },
    behaviorLogs: h.logs,
    playLogs: [{ timestamp: "2026-08-06T10:00:00.000Z" }],
  }),
}));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(h.lang, k, v), uiLang: h.lang }) };
});

import FirstMonthKeepsakeRow, { firstMonthKeepsakeRow, keptOnLabel } from "../loop/FirstMonthKeepsakeRow";
import { translate } from "../../lib/i18n";

const NOW = new Date(2026, 9, 7, 9, 0, 0); // 7 Oct, local — day 64 after the anchor
const LOGS = [{ timestamp: "2026-08-04T18:00:00.000Z" }, { timestamp: "2026-08-04T19:00:00.000Z" }, { timestamp: "2026-08-20T08:00:00.000Z" }];
/** renderToStaticMarkup escapes text ("Dylan's" → "Dylan&#x27;s"). */
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8").replace(/\r\n/g, "\n");

beforeEach(() => {
  h.lang = "en";
  h.anchor = "2026-08-04T09:00:00.000Z";
  h.logs = LOGS;
});

describe("firstMonthKeepsakeRow — the closed window, once, with its own date", () => {
  it("a child whose first month has closed with something kept → ONE row dated the day the month closed", () => {
    const row = firstMonthKeepsakeRow({ onboardingCompletedAt: h.anchor, timestamps: [...LOGS.map((l) => l.timestamp), "2026-08-06T10:00:00.000Z"], now: NOW })!;
    expect(row.keptOn).toBe("2026-09-03");
    expect(row.lines).toEqual([
      { id: "moments", key: "elev.l4.moments.many", vars: { n: 4 } },
      { id: "days", key: "elev.l4.days.many", vars: { n: 3 } },
    ]);
  });

  it("the window is closed: a moment kept after day 29 changes nothing; the date never moves", () => {
    const a = firstMonthKeepsakeRow({ onboardingCompletedAt: h.anchor, timestamps: ["2026-08-05T10:00:00.000Z"], now: NOW })!;
    const b = firstMonthKeepsakeRow({ onboardingCompletedAt: h.anchor, timestamps: ["2026-08-05T10:00:00.000Z", "2026-09-20T10:00:00.000Z"], now: new Date(2026, 11, 1) })!;
    expect(a).toEqual(b);
    expect(a.lines).toEqual([{ id: "moments", key: "elev.l4.moments.one" }, { id: "days", key: "elev.l4.days.one" }]);
  });

  it("without a keepsake nothing renders: month still open, no anchor, nothing kept in the window", () => {
    expect(firstMonthKeepsakeRow({ onboardingCompletedAt: "2026-09-20T09:00:00.000Z", timestamps: ["2026-09-21T10:00:00.000Z"], now: NOW })).toBeNull();
    expect(firstMonthKeepsakeRow({ onboardingCompletedAt: undefined, timestamps: ["2026-08-05T10:00:00.000Z"], now: NOW })).toBeNull();
    expect(firstMonthKeepsakeRow({ onboardingCompletedAt: h.anchor, timestamps: [], now: NOW })).toBeNull();
    expect(firstMonthKeepsakeRow({ onboardingCompletedAt: h.anchor, timestamps: ["2026-09-25T10:00:00.000Z"], now: NOW })).toBeNull();
  });
});

describe("#/memory renders the row (EN + HE)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: one dated keepsake row — title, the ENG-L4 lines, the date; no celebration, no share prompt`, () => {
      h.lang = lang;
      const html = renderToStaticMarkup(<FirstMonthKeepsakeRow now={NOW} />);
      expect(html.match(/data-testid="memory-first-month-row"/g)).toHaveLength(1);
      expect(html).toContain(esc(translate(lang, "elev.l4.keepsake.title", { name: "Dylan" })));
      expect(html).toContain(esc(translate(lang, "elev.l4.moments.many", { n: 4 })));
      expect(html).toContain(esc(translate(lang, "elev.l4.days.many", { n: 3 })));
      expect(html).toContain(esc(keptOnLabel("2026-09-03", lang)));
      expect(keptOnLabel("2026-09-03", lang)).toMatch(/2026/);
      expect(html).toMatch(/border-s-2 ps-3/);
      expect(html).not.toMatch(/<button|ShareButton|confetti|celebrat|🎉|!|%|uppercase|gradient|#[0-9a-f]{3,6}\b/i);
    });
    it(`${lang}: without a first-month keepsake nothing renders`, () => {
      h.lang = lang;
      h.logs = [];
      h.anchor = "2026-09-20T09:00:00.000Z";
      expect(renderToStaticMarkup(<FirstMonthKeepsakeRow now={NOW} />)).toBe("");
    });
  }
});

describe("the mount: #/memory's keepsakes section, never Today", () => {
  const MEM = read("ChildMemory.tsx");
  const OV = read("../tabs/OverviewTab.tsx");
  it("ChildMemory mounts it once, right after Things {name} said (the quotes module)", () => {
    expect(MEM.match(/<FirstMonthKeepsakeRow /g)).toHaveLength(1);
    const quotes = MEM.slice(MEM.indexOf('data-module="memory-quotes"'), MEM.indexOf("</div>", MEM.indexOf('data-module="memory-quotes"')));
    expect(quotes.indexOf("<ThingsSaid ")).toBeGreaterThan(-1);
    expect(quotes.indexOf("<ThingsSaid ")).toBeLessThan(quotes.indexOf("<FirstMonthKeepsakeRow />"));
  });
  it("Today mounts no first-month keepsake and no lifecycle card (the door stays lines only)", () => {
    for (const tok of ["FirstMonthKeepsakeRow", "<LifecycleMomentCard", "buildFirstMonthKeepsake", "l4-month-lines"]) expect(OV, tok).not.toContain(tok);
  });
});
