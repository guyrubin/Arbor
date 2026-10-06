import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-09 — the practice chooser and the dose log: thinnest shelf wins;
   same input same day → same practice; never two days running; a shelf
   answered "not sure" today is skipped; an AI pick outside the candidates is
   ignored; "Did it" / "Not today" write ONE actionLoops row (source
   "practice"), exported/erased with the child through the existing ledger;
   no streak string anywhere on the card. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../i18n")>("../i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import PracticeCard from "../../components/loop/PracticeCard";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES, bandForAgeMonths } from "../milestoneData";
import { CHILD_SUBCOLLECTIONS } from "../childData";
import { toObservations } from "../observations";
import { loopFirewallHits } from "../loop/firewall";
import { shelfCoverage } from "../milestones/selectByShelf";
import { choosePractice, practiceCandidates, todaysCandidates, practiceDoseEntry, practiceDoseId, recentPracticeIds, todayDose, type ChoosePracticeInput } from "./choosePractice";
import type { Milestone } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date(2026, 9, 6, 7, 30);
const catalogue = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m }));
const obs = (shelf: string, n: number) => Array.from({ length: n }, () => ({ at: new Date(NOW.getTime() - 86_400_000).toISOString(), shelf: shelf as never }));
const base = (over: Partial<ChoosePracticeInput> = {}): ChoosePracticeInput => ({
  childId: "kid-1",
  milestones: catalogue(),
  comparisonMonths: 26,
  practices: PRACTICES,
  coverage: shelfCoverage([...obs("words", 12), ...obs("food", 6), ...obs("feelings", 5), ...obs("moving", 4), ...obs("hands", 3), ...obs("school", 2)], NOW),
  today: NOW,
  ...over,
});

describe("choosePractice", () => {
  it("thinnest shelf with a practice ranks first (play: 0 entries, words: 12); the pick is that shelf unless it was yesterday's offer", () => {
    const cov = base().coverage;
    const candidates = practiceCandidates(base());
    expect(candidates.length).toBeGreaterThan(2);
    for (let i = 1; i < candidates.length; i++) expect(cov[candidates[i - 1].shelf] ?? 0).toBeLessThanOrEqual(cov[candidates[i].shelf] ?? 0);
    expect(candidates[candidates.length - 1].shelf === "words" || !candidates.slice(0, 2).some((c) => c.shelf === "words")).toBe(true);
    const pick = choosePractice(base())!;
    expect([candidates[0].practice.id, candidates[1].practice.id]).toContain(pick.practice.id);
    expect(bandForAgeMonths(pick.practice.ageMonths).months).toBeLessThanOrEqual(24);
    if (pick.milestone) expect(pick.practice.milestoneId).toBe(pick.milestone.id);
    else expect(pick.practice.milestoneId).toBeNull();
  });

  it("B-LOOP-08 follow-up: a shelf with no open milestone practice (Sleep) is served by a SHELF-LEVEL practice in the window", () => {
    const candidates = practiceCandidates(base());
    const sleep = candidates.find((c) => c.shelf === "sleep");
    expect(sleep, "sleep (0 entries) has a shelf-level candidate at 26 months").toBeTruthy();
    expect(sleep!.milestone).toBeNull();
    expect(sleep!.practice.milestoneId).toBeNull();
    expect(bandForAgeMonths(sleep!.practice.ageMonths).months).toBeLessThanOrEqual(24);
    expect(candidates[0].shelf).toBe("sleep");
    // and its dose row carries no milestone id
    const row = practiceDoseEntry(sleep!, "did", "kid-1", "x", NOW);
    expect("milestoneId" in row).toBe(false);
    expect(row.shelf).toBe("sleep");
  });

  it("same input, same day → the same practice (a reload shows the same card)", () => {
    expect(choosePractice(base())!.practice.id).toBe(choosePractice(base())!.practice.id);
    expect(choosePractice(base({ today: new Date(2026, 9, 6, 21, 0) }))!.practice.id).toBe(choosePractice(base())!.practice.id);
  });

  it("never the same practice two days running, answered or not", () => {
    let prev = "";
    for (let d = 0; d < 21; d++) {
      const day = new Date(2026, 9, 1 + d, 9, 0);
      const id = choosePractice(base({ today: day }))!.practice.id;
      expect(id, `day ${d}`).not.toBe(prev);
      prev = id;
    }
    // B-PROG-06 (gate): the day-15/16 pair (pr-sleep-17 twice when the sleep pool grew to 21) — pinned
    const d15 = choosePractice(base({ today: new Date(2026, 9, 16, 9, 0) }))!.practice.id;
    const d16 = choosePractice(base({ today: new Date(2026, 9, 17, 9, 0) }))!.practice.id;
    expect(d16).not.toBe(d15);
    // and a longer run over the sleep pool never repeats yesterday either
    let last = "";
    for (let d = 0; d < 60; d++) {
      const id = choosePractice(base({ today: new Date(2026, 9, 1 + d, 9, 0) }))!.practice.id;
      expect(id, `long run day ${d}`).not.toBe(last);
      last = id;
    }
    // and yesterday's ANSWERED practice is excluded too
    const answeredYesterday = choosePractice(base({ today: new Date(2026, 9, 5, 9, 0) }))!.practice.id;
    expect(choosePractice(base({ recentPracticeIds: [answeredYesterday] }))!.practice.id).not.toBe(answeredYesterday);
  });

  it('a shelf answered "not sure" today is skipped', () => {
    const first = practiceCandidates(base()).find((c) => c.milestone)!;
    const ms = catalogue().map((m) => (m.id === first.milestone!.id ? { ...m, observationStatus: "not_sure" as const, observationUpdatedAt: NOW.toISOString() } : m));
    expect(choosePractice(base({ milestones: ms }))!.shelf).not.toBe(first.shelf);
  });

  it("an AI practiceId inside the candidates wins; one outside is ignored", () => {
    const candidates = todaysCandidates(base());
    const second = candidates[1];
    expect(choosePractice(base({ aiPracticeId: second.practice.id }))).toMatchObject({ via: "ai", practice: { id: second.practice.id } });
    const outside = PRACTICES.find((p) => !candidates.some((c) => c.practice.id === p.id))!;
    expect(choosePractice(base({ aiPracticeId: outside.id }))!.via).toBe("chooser");
  });

  it("today's dose row keeps the card put all day; no age → no practice", () => {
    const other = practiceCandidates(base())[2];
    expect(choosePractice(base({ todayPracticeId: other.practice.id }))).toMatchObject({ via: "today", practice: { id: other.practice.id } });
    expect(choosePractice(base({ comparisonMonths: null }))).toBeNull();
  });

  it("P6 seam: a candidate filter narrows the set before ranking (no program rule built)", () => {
    const keep = new Set(practiceCandidates(base()).slice(1, 3).map((c) => c.practice.id));
    expect(keep.has(choosePractice(base({ candidateFilter: (p) => keep.has(p.id) }))!.practice.id)).toBe(true);
  });
});

describe("the dose log (actionLoops, source practice)", () => {
  const pick = practiceCandidates(base()).find((c) => c.milestone)!;
  it('"Did it" writes ONE completed row without an outcome (tonight sets it); "Not today" closes with not_today', () => {
    const did = practiceDoseEntry(pick, "did", "kid-1", "Say this", NOW);
    expect(did).toMatchObject({ id: practiceDoseId("kid-1", NOW), source: "practice", status: "completed", practiceId: pick.practice.id, milestoneId: pick.milestone!.id, shelf: pick.shelf, recommendation: "Say this" });
    expect("outcome" in did).toBe(false);
    const no = practiceDoseEntry(pick, "not_today", "kid-1", "Say this", NOW);
    expect(no.outcome).toBe("not_today");
    expect(no.id).toBe(did.id);
    expect(todayDose([did], "kid-1", NOW)).toEqual(did);
    const y = practiceDoseEntry(pick, "did", "kid-1", "x", new Date(2026, 9, 5, 9));
    expect(recentPracticeIds([y], "kid-1", NOW)).toEqual([pick.practice.id]);
  });

  it("the row rides the existing actionLoops collection (exported and erased with the child)", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("actionLoops");
  });

  it("a done practice lands on its shelf in the record; Not today never does", () => {
    const did = practiceDoseEntry(pick, "did", "kid-1", "x", NOW);
    const [o] = toObservations({ actionLoops: [did] }, { id: "kid-1" });
    expect(o).toMatchObject({ kind: "practice", shelf: pick.shelf, provenance: pick.practice.id });
    expect(toObservations({ actionLoops: [practiceDoseEntry(pick, "not_today", "kid-1", "x", NOW)] }, { id: "kid-1" })).toEqual([]);
  });
});

describe("PracticeCard", () => {
  const pick = choosePractice(base())!;
  const render = (lang: "en" | "he", answered: "did" | "not_today" | null = null) => {
    state.lang = lang;
    return renderToStaticMarkup(
      <PracticeCard practice={pick.practice} milestone={pick.milestone} shelf={pick.shelf} childName="Noa" gender="girl" answered={answered} onAnswer={() => undefined} onUndo={() => undefined} stampMove="do-practice" />,
    );
  };
  const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  it("the do (display), the say (editorial, start rule), two answers ≥ 44 px stamped as the move; EN + HE", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render(lang);
      expect(html).toContain('data-testid="practice-do"');
      expect(html).toMatch(/data-testid="practice-say" class="[^"]*border-s-2 ps-3/);
      expect(html).toContain('data-primary-move="do-practice"');
      const buttons = html.match(/<button[^>]*data-answer="[a-z_]+"[^>]*>/g) ?? [];
      expect(buttons).toHaveLength(2);
      for (const b of buttons) expect(b).toMatch(/min-h-12/);
      expect(text(html)).toContain(lang === "he" ? pick.practice.say.he.split(" ")[0] : pick.practice.say.en.split(" ")[0]);
      expect(text(html)).not.toMatch(/[א-ת]\/[א-ת]/);
    }
  });
  it("after an answer: one receipt line, no count, no streak (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      for (const a of ["did", "not_today"] as const) {
        const html = render(lang, a);
        expect(html).toContain('data-testid="practice-receipt"');
        expect(html).not.toContain('data-primary-move');
        expect(loopFirewallHits(text(html))).toEqual([]);
        expect(text(html)).not.toMatch(/ברצף|\bin a row\b|\bstreak\b|\d+\s*(?:days|ימים)/i);
      }
    }
    state.lang = "en";
    expect(text(render("en", "not_today"))).toContain("Tomorrow is fine.");
  });
  // P5 r1 pass A7 re-pin: exactly ONE gradient — the "Did it" pill's
  // var(--gradient-cta); no raw colour, no image, the band stays flat.
  it("tokens only, logical properties, one gradient (the Did it pill), no image", () => {
    const src = readFileSync(path.join(here, "..", "..", "components", "loop", "PracticeCard.tsx"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|linear-gradient|<img\b|text-white/);
    expect(src.match(/gradient/g)).toHaveLength(1);
    for (const lang of ["en", "he"] as const) expect(render(lang)).not.toMatch(/class="[^"]*\b(?:ml|mr|pl|pr|left|right)-[\w[]/);
  });
});
