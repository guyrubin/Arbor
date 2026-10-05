/**
 * B-TODAY-29 — the weekly letter says what worked, and sends it.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { hardMomentCards } from "../../content/hardMomentCards";
import type { ActionLoopEntry } from "../../actionLoop/model";
import WhatWorkedCard, { whatWorkedThisWeek, whatWorkedText } from "../weekly/WhatWorkedCard";
import { hardMomentWordsText } from "../behaviors/HardMomentWords";

const WEEK_START = Date.parse("2026-10-04T00:00:00.000Z"); // Sunday
const NOW = Date.parse("2026-10-06T18:00:00.000Z");
const tantrum = hardMomentCards.find((c) => c.id === "tantrum")!;
const refusal = hardMomentCards.find((c) => c.id === "refusal")!;
const held = (card: typeof tantrum, at: string, over: Partial<ActionLoopEntry> = {}): ActionLoopEntry => ({
  id: `today.c1.${at.slice(0, 10)}`, recommendation: card.doNow.en, source: "hard-moment", capacity: "standard",
  status: "completed", acceptedAt: at, outcome: "helped", outcomeAt: at, held: "yes", ...over,
});
const LOOP = [
  held(tantrum, "2026-10-05T19:00:00.000Z"),
  held(refusal, "2026-10-06T08:00:00.000Z"),
  held(tantrum, "2026-09-28T19:00:00.000Z"), // last week
  held(refusal, "2026-10-05T08:00:00.000Z", { held: "no", outcome: "not_today" }), // not held
];
const t = (lang: "en" | "he") => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

describe("B-TODAY-29 — what worked this week", () => {
  it("two held outcomes this week → two lines, newest first, one per card; last week and 'not this time' are left out", () => {
    const lines = whatWorkedThisWeek(LOOP, WEEK_START, { locale: "en", childName: "Dylan", nowMs: NOW });
    expect(lines.map((l) => l.card.id)).toEqual(["refusal", "tantrum"]);
    expect(lines[0].sentence).toBe(refusal.sayThis.en.replace(/\{\{childName\}\},?\s*/g, "").replace(/^./, (c) => c.toUpperCase()));
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: renders the title, two sentences and their days, and the text-only send`, () => {
      const lines = whatWorkedThisWeek(LOOP, WEEK_START, { locale: lang, childName: "Dylan", nowMs: NOW });
      const html = renderToStaticMarkup(<WhatWorkedCard lines={lines} childName="Dylan" parentName="Guy" locale={lang} t={t(lang)} />);
      expect(html).toContain(translate(lang, "wk.worked.title", { name: "Dylan" }));
      expect(html.match(/data-testid="weekly-what-worked-line"/g)).toHaveLength(2);
      const day = (iso: string) => new Date(iso).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { weekday: "long" });
      expect(html).toContain(day("2026-10-06T08:00:00.000Z"));
      expect(html).toContain(day("2026-10-05T19:00:00.000Z"));
      expect(html).toContain(translate(lang, "hm.send.cta"));
      expect(html).not.toMatch(/uppercase|gradient|%|>0</);
    });
  }

  it("zero held outcomes → no card (never an empty card, never '0')", () => {
    const lines = whatWorkedThisWeek([LOOP[2], LOOP[3]], WEEK_START, { locale: "en", childName: "Dylan", nowMs: NOW });
    expect(lines).toEqual([]);
    expect(renderToStaticMarkup(<WhatWorkedCard lines={lines} childName="Dylan" parentName="Guy" locale="en" t={t("en")} />)).toBe("");
  });

  it("the share payload is the B-ASKJB-33 payload of each line joined by blank lines (no link)", () => {
    const lines = whatWorkedThisWeek(LOOP, WEEK_START, { locale: "he", childName: "Dylan", nowMs: NOW });
    const text = whatWorkedText(lines, { locale: "he", parentName: "גיא", t: t("he") });
    expect(text).toBe([refusal, tantrum].map((c) => hardMomentWordsText(c, { locale: "he", parentName: "גיא", t: t("he") })).join("\n\n"));
    expect(text).not.toMatch(/https?:|ref=|utm_/);
  });

  it("the card sits inside the letter's module (route budget unchanged)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "WeeklyTab.tsx"), "utf8");
    const recap = src.slice(src.indexOf('data-module="weekly-recap"'), src.indexOf("{/* The week's narrative"));
    expect(recap).toContain("<WhatWorkedCard");
    expect(src).not.toMatch(/data-module="weekly-worked"/);
  });
});
