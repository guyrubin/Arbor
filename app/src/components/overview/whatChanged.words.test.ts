import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeWhatChanged } from "./whatChangedEvents";
import { whatChangedLineText } from "./WhatChanged";
import { translate } from "../../lib/i18n";
import { buildTimeline, signalTitle } from "../../lib/signalTimeline";
import { computeWeeklyContext } from "../../ai/chatContext";
import { loopFirewallHits } from "../../lib/loop/firewall";

/* B-GROWTH-15 — two Hebrew words written down produce the SAME words line on
   the record (Journal) and on Now's What changed, EN + HE, the count and the
   language only; the approved weekly context carries wordsLoggedCount: 2 and
   no word text. */

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date("2026-10-28T16:00:00.000Z");
const PREV = "2026-10-27T08:00:00.000Z";
const WORDS = [
  { id: "w1", timestamp: "2026-10-28T09:00:00.000Z", language: "Hebrew", phrase: "כדור" },
  { id: "w2", timestamp: "2026-10-28T10:30:00.000Z", language: "Hebrew", phrase: "עוד" },
  { id: "w0", timestamp: "2026-10-20T10:30:00.000Z", language: "Hebrew", phrase: "אבא" }, // before the last visit
];
const base = { previousVisitAt: PREV, behaviorLogs: [], playLogs: [], milestones: [], actionLoop: [], approvedFactsSince: 0, firstsState: { seen: [] } };
const tr = (lang: "en" | "he") => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
const strip = (s: string) => s.replace(/[⁦-⁩]/g, "");

describe("B-GROWTH-15 · the words line on Now agrees with the record", () => {
  const changed = composeWhatChanged({ ...base, langObs: WORDS });
  const line = changed.lines.find((l) => l.kind === "words")!;

  it("one words line for the two words since the last visit (the older word is not news)", () => {
    expect(changed.lines.filter((l) => l.kind === "words")).toHaveLength(1);
    expect(line).toMatchObject({ kind: "words", count: 2, language: "Hebrew" });
    expect(changed.hiddenCount).toBe(0);
  });

  it("EN + HE: the same sentence as the Journal's words row, and it opens that row", () => {
    const row = buildTimeline({ langObs: WORDS.slice(0, 2) })[0];
    expect(line.kind === "words" && line.focusId).toBe(row.id);
    for (const lang of ["en", "he"] as const) {
      const now = strip(whatChangedLineText(line, tr(lang), lang, "Noa").title);
      expect(now).toBe(strip(signalTitle(row, tr(lang))));
      expect(loopFirewallHits(now)).toEqual([]);
    }
    expect(strip(whatChangedLineText(line, tr("en"), "en", "Noa").title)).toBe("2 new words in Hebrew");
    expect(strip(whatChangedLineText(line, tr("he"), "he", "Noa").title)).toBe("2 מילים חדשות בעברית");
  });

  it("r2 (critic P1): back after 3 days with two helped steps and one approved fact, Now's three lines still carry the words, and the rest is a counted door", () => {
    const prev = "2026-10-25T08:00:00.000Z";
    const step = (id: string, day: string) => ({ id, recommendation: `Step ${id}`, status: "completed" as const, acceptedAt: `${day}T08:00:00.000Z`, outcome: "helped" as const, outcomeAt: `${day}T20:00:00.000Z` });
    const now3 = composeWhatChanged({ ...base, previousVisitAt: prev, maxLines: 3, approvedFactsSince: 1,
      actionLoop: [step("s1", "2026-10-26"), step("s2", "2026-10-27")], langObs: WORDS });
    expect(now3.lines.map((l) => l.kind)).toEqual(["words", "step", "step"]);
    expect(now3.hiddenCount).toBe(1); // the approved fact, behind "+1 more"
    // the Now wiring: three lines and the composer's own hidden count (never 0 by hand)
    const src = readFileSync(path.join(here, "..", "companion", "NowTodayLines.tsx"), "utf8");
    expect(src).toContain("maxLines: 3,");
    expect(src).toContain("hiddenCount={changed.hiddenCount}");
    expect(src).not.toContain("hiddenCount={0}");
  });

  it("the line never carries the words themselves", () => {
    const json = JSON.stringify(changed);
    for (const w of WORDS) expect(json).not.toContain(w.phrase);
    for (const lang of ["en", "he"] as const) {
      const text = whatChangedLineText(line, tr(lang), lang, "Noa").title;
      for (const w of WORDS) expect(text).not.toContain(w.phrase);
    }
  });

  it("two languages are two lines, newest first; no langObs passed = no words line (Weekly unchanged)", () => {
    const two = composeWhatChanged({ ...base, langObs: [...WORDS, { id: "e1", timestamp: "2026-10-28T12:00:00.000Z", language: "English", phrase: "ball" }] });
    expect(two.lines.filter((l) => l.kind === "words").map((l) => l.kind === "words" && [l.language, l.count])).toEqual([["English", 1], ["Hebrew", 2]]);
    expect(composeWhatChanged(base).lines.some((l) => l.kind === "words")).toBe(false);
  });

  it("the approved weekly context carries wordsLoggedCount: 2 for this week's two words — a number, never the words", () => {
    const wc = computeWeeklyContext({ behaviorLogs: [], milestones: [], actionLoop: [], langObs: WORDS.slice(0, 2) }, NOW);
    expect(wc.wordsLoggedCount).toBe(2);
    for (const w of WORDS) expect(JSON.stringify(wc)).not.toContain(w.phrase);
  });

  it("Now's What changed reads the words ledger (NowTodayLines wiring)", () => {
    const src = readFileSync(path.join(here, "..", "companion", "NowTodayLines.tsx"), "utf8");
    expect(src).toContain('useChildCollection<LangObservation>(childProfile.id, "langObs")');
    expect(src).toContain("langObs: langObs.items,");
  });
});
