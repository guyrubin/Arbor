import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-10 — Tonight: three steps in order, each writes through its named
   seam (practice outcome → actionLoops; quote → keepsakes `quote`; notice →
   milestones), skipping writes nothing, EN + HE, "{n} of 3" is the only
   progress string, the story door is the last line; "Things {name} said"
   lists quotes and shares ONE quote as text. */

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

import TonightFlow, { type TonightStep } from "./TonightFlow";
import ThingsSaid from "./ThingsSaid";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { CHILD_SUBCOLLECTIONS } from "../../lib/childData";
import { keepsakeMapFromDocs } from "../../lib/firstsKeepsake";
import { toObservations } from "../../lib/observations";
import { loopFirewallHits } from "../../lib/loop/firewall";
import { quoteKeepsakeDoc, quoteShareText, quotesFromDocs, tonightDayQuestion, tonightOutcomeEntry } from "../../lib/loop/tonight";
import { practiceDoseEntry, type PracticePick } from "../../lib/practice/choosePractice";
import type { BehaviorLog } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date(2026, 9, 6, 21, 0);
const practice = PRACTICES.find((p) => p.shelf === "words")!;
const pick: PracticePick = { practice, milestone: ALL_MILESTONES.find((m) => m.id === practice.milestoneId)!, shelf: "words", via: "chooser" };
const noticeMs = ALL_MILESTONES.find((m) => m.id === "cdc-24m-9")!;
const calls: string[] = [];
const render = (step: TonightStep, lang: "en" | "he" = "en", over: Record<string, unknown> = {}) => {
  state.lang = lang;
  return renderToStaticMarkup(
    <TonightFlow
      childName="Noa"
      gender="girl"
      practice={pick}
      onPracticeAnswer={(a) => calls.push(`dose:${a}`)}
      onOutcome={(o) => calls.push(`outcome:${o}`)}
      onWhatHappened={(t) => calls.push(`moment:${t}`)}
      dayQuestion={{ key: "elev.loop.tonight.day.generic", vars: {} }}
      onQuote={(t) => calls.push(`quote:${t}`)}
      notice={{ milestone: noticeMs, shelf: "moving" }}
      onNotice={(s) => calls.push(`notice:${s}`)}
      onStory={() => calls.push("story")}
      initialStep={step}
      {...over}
    />,
  );
};
const text = (h: string) => h.replace(/[\u2068\u2069]/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("TonightFlow — three steps in order", () => {
  it("step 1 practice → step 2 her day → step 3 notice → done; '{n} of 3' is the only progress", () => {
    expect(render(1)).toContain('data-testid="tonight-step-1"');
    expect(render(2)).toContain('data-testid="tonight-step-2"');
    expect(render(3)).toContain('data-testid="tonight-step-3"');
    expect(render("done")).toContain('data-testid="tonight-done"');
    for (const [s, n] of [[1, 1], [2, 2], [3, 3]] as const) {
      const html = render(s);
      expect(text(html.match(/data-testid="tonight-progress"[^>]*>([^<]*)</)![1])).toBe(`${n} of 3`);
      expect(html).not.toMatch(/role="progressbar"|<progress|%/);
    }
    expect(text(render(1, "he").match(/data-testid="tonight-progress"[^>]*>([^<]*)</)![1])).toBe("1 מתוך 3");
  });

  it("without a practice the flow opens on step 2 (step 1 has nothing to ask)", () => {
    state.lang = "en";
    const html = renderToStaticMarkup(
      <TonightFlow childName="Noa" practice={null} onPracticeAnswer={() => undefined} onOutcome={() => undefined} onWhatHappened={() => undefined}
        dayQuestion={{ key: "elev.loop.tonight.day.generic", vars: {} }} onQuote={() => undefined} notice={null} onNotice={() => undefined} onStory={() => undefined} />,
    );
    expect(html).toContain('data-testid="tonight-step-2"');
  });

  it("step 1 shows the practice's say and two answers ≥ 44 px; every step can be skipped", () => {
    const html = render(1);
    expect(text(html)).toContain(practice.say.en);
    for (const b of html.match(/<button[^>]*data-answer="[a-z_]+"[^>]*>/g) ?? []) expect(b).toMatch(/min-h-12/);
    expect(html).toContain('data-testid="tonight-skip"');
    expect(render(2)).toContain('data-testid="tonight-skip"');
  });

  it("the story door is the LAST line, after the card", () => {
    for (const s of [1, 2, 3, "done"] as const) {
      const html = render(s);
      expect(html.indexOf('data-testid="tonight-story"')).toBeGreaterThan(html.indexOf('data-testid="tonight-progress"'));
      expect(html.trimEnd().endsWith("</button></section>")).toBe(true);
    }
  });

  it("EN + HE copy; Hebrew resolves the child's gender; no verdict, no streak, never what the child felt", () => {
    const he = text(render(2, "he"));
    expect(he).toContain("מה Noa אמרה היום");
    expect(he).not.toMatch(/[א-ת]\/[א-ת]/);
    for (const lang of ["en", "he"] as const) {
      for (const s of [1, 2, 3, "done"] as const) {
        const tx = text(render(s, lang));
        expect(loopFirewallHits(tx), `${lang} ${s}`).toEqual([]);
        expect(tx).not.toMatch(/\bfelt\b|\bfeeling\b|הרגיש/i);
      }
    }
  });
});

describe("each step writes through its named seam; skipping writes nothing", () => {
  it("practice outcome → the day's actionLoops dose row (the parent's choice)", () => {
    const dose = practiceDoseEntry(pick, "did", "kid-1", "x", NOW);
    const out = tonightOutcomeEntry(dose, "helped", NOW);
    expect(out).toMatchObject({ id: dose.id, source: "practice", status: "completed", outcome: "helped" });
    expect(CHILD_SUBCOLLECTIONS).toContain("actionLoops");
  });

  it("the quote → a keepsakes `quote` doc that no milestone reader picks up", () => {
    const doc = quoteKeepsakeDoc("  big   ball! ", NOW)!;
    expect(doc).toMatchObject({ kind: "quote", milestoneId: "", note: "big ball!", noticedOn: "2026-10-06" });
    expect(quoteKeepsakeDoc("   ", NOW)).toBeNull();
    expect(CHILD_SUBCOLLECTIONS).toContain("keepsakes");
    expect(keepsakeMapFromDocs([doc])).toEqual({});
    expect(toObservations({ keepsakes: [doc] }, { id: "k" })).toEqual([]);
    expect(quotesFromDocs([doc, { id: "cdc-24m-3", milestoneId: "cdc-24m-3", note: "first", noticedOn: "2026-10-01" }])).toEqual([{ id: doc.id, note: "big ball!", noticedOn: "2026-10-06" }]);
  });

  it("the container wires each callback to its seam (Today, B-LOOP-07) and the static flow fires nothing on render", () => {
    calls.length = 0;
    render(1); render(2); render(3);
    expect(calls).toEqual([]);
  });
});

describe("step 2's question comes from today's own moment (zero model calls)", () => {
  const log = (trigger: string, at: Date) => ({ id: "l", timestamp: at.toISOString(), behaviorType: "Moment", durationMinutes: 0, trigger }) as BehaviorLog;
  it("a moment logged today leads; otherwise the generic question", () => {
    expect(tonightDayQuestion([log("We went to the dentist", new Date(2026, 9, 6, 10))], NOW)).toEqual({ key: "elev.loop.tonight.day.fromMoment", vars: { moment: "We went to the dentist" } });
    expect(tonightDayQuestion([log("Yesterday's park", new Date(2026, 9, 5, 10))], NOW).key).toBe("elev.loop.tonight.day.generic");
  });
});

describe("Things {name} said (#/memory)", () => {
  const quotes = quotesFromDocs([quoteKeepsakeDoc("big ball", NOW)!, quoteKeepsakeDoc("moon is sleeping", new Date(2026, 8, 20, 20))!]);
  it("lists quotes by month, newest first; each has ONE share button (44 px)", () => {
    state.lang = "en";
    const html = renderToStaticMarkup(<ThingsSaid quotes={quotes} childName="Noa" gender="girl" />);
    expect(text(html)).toContain("Things Noa said");
    expect(html.indexOf("big ball")).toBeLessThan(html.indexOf("moon is sleeping"));
    const shares = html.match(/<button[^>]*data-testid="things-said-share"[^>]*>/g) ?? [];
    expect(shares).toHaveLength(2);
    for (const b of shares) expect(b).toMatch(/min-h-\[44px\]/);
    state.lang = "he";
    expect(text(renderToStaticMarkup(<ThingsSaid quotes={quotes} childName="Noa" gender="girl" />))).toContain("שNoa אמרה");
  });
  it("sharing sends ONE quote as text through shareWordsText (never a link, never the list)", () => {
    const shared = quoteShareText(quotes[0], "Noa", "6 Oct");
    expect(shared).toBe("“big ball”\nNoa, 6 Oct");
    expect(shared).not.toMatch(/https?:|moon/);
    const src = readFileSync(path.join(here, "ThingsSaid.tsx"), "utf8");
    expect(src).toContain("shareWordsText(quoteShareText(q, name, dayLabel(q.noticedOn, lang)))");
    expect(src).not.toMatch(/shareCard|buildShareUrl/);
  });
  it("#/memory mounts it inside the demoted disclosure from the keepsakes collection", () => {
    const mem = readFileSync(path.join(here, "..", "sections", "ChildMemory.tsx"), "utf8");
    expect(mem).toContain('<div data-module="memory-quotes" data-module-demoted');
    expect(mem).toContain("quotesFromDocs(quoteDocs.items)");
  });
});
