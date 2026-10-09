import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* P5 critic r1 on #/overview — pass A (Today P1s), unit guards over the
   SEEDED demo record (src/demo/demoFamily.ts) and the pure seams Today
   wires: A1 the parent's own words on the practice's shelf, A2 no shared
   shelf between the practice and Notice, A3 the why-line states the reason,
   A4 current-band Notice first, A7 the one gradient on "Did it". */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import PracticeCard from "../loop/PracticeCard";
import { buildDemoFamily } from "../../demo/demoFamily";
import { toObservations } from "../../lib/observations";
import { shelfCoverage, selectNextMilestonesByShelf } from "../../lib/milestones/selectByShelf";
import { choosePractice } from "../../lib/practice/choosePractice";
import { PRACTICES } from "../../content/practices";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { shelfWordsThenNow } from "../../lib/today/shelfWords";
import { bandForAgeMonths, milestoneAgeWindow } from "../../lib/milestoneData";
import { shelfLabel } from "../../lib/shelves/registry";
import { translate } from "../../lib/i18n";
import type { BehaviorLog } from "../../types";
import { todayLiveSource } from "../../testTodaySource";

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse("2026-10-06T07:00:00Z");
const DAY = 86_400_000;
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

function today(lang: "en" | "he", extraLogs: BehaviorLog[] = []) {
  const fam = buildDemoFamily({ now: NOW, lang });
  const c = fam.collections;
  const behaviorLogs = [...c.behaviorLogs, ...extraLogs];
  const obs = toObservations({ behaviorLogs, milestones: c.milestones, langObs: c.langObs, actionLoops: c.actionLoops, practiceEvents: c.practiceEvents }, { id: fam.child.id, birthDate: fam.child.birthDate });
  const now = new Date(NOW);
  const coverage = shelfCoverage(obs, now);
  const months = comparisonMonthsOf(fam.child)!;
  const pick = choosePractice({ childId: fam.child.id, milestones: c.milestones, comparisonMonths: months, practices: PRACTICES, coverage, today: now })!;
  const notices = selectNextMilestonesByShelf(c.milestones, months, { perShelf: 1, total: 3, coverage, now, excludeShelves: [pick.shelf] });
  return { fam, obs, behaviorLogs, coverage, months, pick, notices };
}

describe("pass A1 — the parent's own words on the practice's shelf", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: two notes the parent filed on the shelf (outside the 30-day count) leave the pick as is and render as THEN / NOW under the title`, () => {
      const base = today(lang);
      const note = (id: string, daysAgo: number, words: string): BehaviorLog => ({
        id, timestamp: new Date(NOW - daysAgo * DAY).toISOString(), behaviorType: "Moment", durationMinutes: 0, trigger: words, context: "Home", shelf: base.pick.shelf,
      } as BehaviorLog);
      const then = lang === "he" ? "ויתר על הרוכסן אחרי ניסיון אחד" : "Gave up on the zip after one try";
      const now = lang === "he" ? "עשה שש חתיכות ורצה עוד" : "Did six pieces and wanted more";
      const withNotes = today(lang, [note("passA-then", 52, then), note("passA-now", 38, now)]);
      expect(withNotes.pick.practice.id).toBe(base.pick.practice.id);
      const words = shelfWordsThenNow(withNotes.obs, withNotes.behaviorLogs, withNotes.pick.shelf);
      expect(words.then?.text).toContain(then);
      expect(words.now?.text).toContain(now);
      state.lang = lang;
      const quotes = [words.then!, words.now!].map((w) => ({ text: w.text, date: "x" }));
      const props = { practice: withNotes.pick.practice, milestone: withNotes.pick.milestone, shelf: withNotes.pick.shelf, childName: "Dylan", gender: "boy", onAnswer: () => undefined, quotes };
      const html = renderToStaticMarkup(<PracticeCard {...props} />);
      expect(html.match(/data-testid="practice-quote"/g)).toHaveLength(2);
      expect(html.indexOf('data-testid="practice-quotes"')).toBeGreaterThan(html.indexOf('data-testid="practice-title"'));
      expect(html.indexOf('data-testid="practice-quotes"')).toBeLessThan(html.indexOf('data-testid="practice-say"'));
      expect(text(html)).toContain(then);
      // after "Did it": filed on the shelf, next to those words
      const did = renderToStaticMarkup(<PracticeCard {...props} answered="did" />);
      const shelf = shelfLabel(withNotes.pick.shelf, (k) => translate(lang, k));
      expect(text(did)).toContain(translate(lang, "elev.loop.practice.didReceiptWords", { name: "Dylan", shelf }).replace(/[⁨⁩]/g, "").slice(0, 8));
    });
  }
  it("OverviewTab passes the shelf words to the card", () => {
    const src = todayLiveSource();
    expect(src).toContain("shelfWordsThenNow(observations, behaviorLogs, pick.shelf)");
    expect(src).toContain("quotes={loop.quotes}");
  });
});

describe("pass A2 — the practice and the Notice cards never share a shelf on one morning", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: demo morning`, () => {
      const { pick, notices } = today(lang);
      expect(notices.length).toBeGreaterThan(0);
      for (const n of notices) expect(n.shelf).not.toBe(pick.shelf);
    });
  }
});

describe("pass A3 — the why-line states the chooser's reason, names the child, never a catalogue label", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: an empty shelf this month says so; no milestone title on the line`, () => {
      const { pick, coverage } = today(lang);
      expect(coverage[pick.shelf]).toBe(0);
      state.lang = lang;
      const html = renderToStaticMarkup(
        <PracticeCard practice={pick.practice} milestone={pick.milestone} shelf={pick.shelf} childName="Dylan" gender="boy" onAnswer={() => undefined} whyReason="empty" />,
      );
      const why = text(html.slice(html.indexOf('data-testid="practice-why"')));
      expect(why).toContain("Dylan");
      if (pick.milestone) expect(why).not.toContain(pick.milestone.title);
      expect(why.replace(/[⁨⁩]/g, "")).toContain(lang === "he" ? "עדיין אין כלום במדף" : "Nothing on Dylan");
    });
  }
  it("OverviewTab derives the reason from the coverage the chooser ranked by", () => {
    const src = todayLiveSource();
    // P5-LOOP c2 r1: still from the same coverage; with no words on the shelf
    // the empty reason says tonight's answer starts the page
    expect(src).toContain('if (n === 0) return shelfNewestAt ? "empty" : "startsPage";');
    expect(src).toContain("return n <= Math.min(...Object.values(coverage)) ? \"fewest\" : null;");
    expect(src).toContain("whyReason={loop.whyReason}");
    expect(readFileSync(path.join(here, "..", "loop", "PracticeCard.tsx"), "utf8")).not.toContain('"elev.loop.practice.why"');
  });
});

describe("pass A4 — Notice: current-band items first, earlier-band second", () => {
  it("the demo 3-year-old's Notice opens on a current-band item", () => {
    const { notices, months } = today("en");
    const current = milestoneAgeWindow(months).currentBandMonths;
    const tiers = notices.map((n) => (bandForAgeMonths(n.milestone.ageMonths as number).months === current ? 0 : 1));
    expect(tiers[0]).toBe(0);
    expect([...tiers].sort()).toEqual(tiers);
  });
});

describe("pass A7 — ONE gradient on Today: the \"Did it\" pill", () => {
  it("PracticeCard spells --gradient-cta once, on data-answer=did; the band stays flat", () => {
    const src = readFileSync(path.join(here, "..", "loop", "PracticeCard.tsx"), "utf8");
    expect(src.match(/--gradient-cta/g)).toHaveLength(1);
    const did = src.slice(src.indexOf('data-answer="did"'), src.indexOf('data-answer="not_today"'));
    expect(did).toContain('background: "var(--gradient-cta)"');
    expect(src).not.toMatch(/linear-gradient|--arbor-gradient-primary/);
  });
});
