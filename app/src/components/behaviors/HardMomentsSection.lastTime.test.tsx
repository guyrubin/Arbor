/**
 * B-ASKJB-33 — "Last time, this helped with {name}": the hard-moment card
 * remembers the sentence that helped, and the outcome ask is two taps.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import { hardMomentCards } from "../../content/hardMomentCards";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { heldOutcome } from "../../actionLoop/model";
import { lastHeldFor, rowIsCard } from "./hardMomentLastTime";

const harness = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  gender: "boy" as string,
  recordTodayOutcome: vi.fn(),
  recordChildResponse: vi.fn(),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang as UiLang, k, v) }),
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Dylan", gender: harness.gender },
    recordTodayOutcome: harness.recordTodayOutcome,
    recordChildResponse: harness.recordChildResponse,
  }),
}));

import { LastTimeLead } from "./HardMomentWords";
import HeldPlanAsk, { heldStage } from "../overview/HeldPlanAsk";

const tantrum = hardMomentCards.find((c) => c.id === "tantrum")!;
const row = (over: Partial<ActionLoopEntry> = {}): ActionLoopEntry => ({
  id: "today.c1.2026-10-01",
  recommendation: tantrum.doNow.en,
  source: "hard-moment",
  capacity: "standard",
  status: "accepted",
  acceptedAt: "2026-10-01T17:00:00.000Z",
  ...over,
});

beforeEach(() => { harness.lang = "en"; harness.gender = "boy"; vi.clearAllMocks(); });

describe("B-ASKJB-33 — which answer feeds 'last time'", () => {
  it("a 'held the plan' row for this card (either locale's doNow) → its date", () => {
    const held = row({ status: "completed", outcome: "helped", held: "yes", outcomeAt: "2026-10-01T20:00:00.000Z" });
    expect(lastHeldFor(tantrum, [held])).toEqual({ at: "2026-10-01T20:00:00.000Z" });
    expect(lastHeldFor(tantrum, [{ ...held, recommendation: tantrum.doNow.he }])).not.toBeNull();
  });

  it("no held answer, 'not this time', another card or another source → nothing (the card renders as today)", () => {
    expect(lastHeldFor(tantrum, [])).toBeNull();
    expect(lastHeldFor(tantrum, [row({ status: "completed", outcome: "not_today", held: "no", outcomeAt: "2026-10-01T20:00:00.000Z" })])).toBeNull();
    // the old "Did it help?" outcome alone never claims the adult held the plan
    expect(lastHeldFor(tantrum, [row({ status: "completed", outcome: "helped", outcomeAt: "2026-10-01T20:00:00.000Z" })])).toBeNull();
    expect(rowIsCard(row({ source: "coach" }), tantrum)).toBe(false);
    expect(rowIsCard(row({ recommendation: "something else" }), tantrum)).toBe(false);
  });

  it("held → the ledger outcome every reader already knows", () => {
    expect(heldOutcome("yes")).toBe("helped");
    expect(heldOutcome("no")).toBe("not_today");
  });
});

describe("B-ASKJB-33 — the lead block (rendered, EN + HE)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: lead line, the Say-this sentence in the editorial serif ≥ 16 px, dated`, () => {
      harness.lang = lang;
      const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
      const html = renderToStaticMarkup(<LastTimeLead card={tantrum} childName="Dylan" at="2026-10-01T20:00:00.000Z" locale={lang} t={t} />);
      expect(html).toContain(translate(lang, "hm.lastTime.lead", { name: "Dylan" }));
      expect(html).toContain(tantrum.sayThis[lang].replace(/'/g, "&#x27;"));
      expect(html).toMatch(/data-testid="hm-last-time-words"[^>]*class="[^"]*text-\[20px\]/);
      expect(html).toContain("var(--font-editorial)");
      expect(html).toMatch(lang === "he" ? /1 באוק/ : /1 Oct/);
      expect(html).not.toMatch(/uppercase|gradient|%/);
    });
  }

  it("the lead block is the FIRST element of the selected card in the sheet; Send sits in the actions", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "HardMomentNowSheet.tsx"), "utf8");
    const branch = src.slice(src.indexOf(") : (\n          <>"));
    const lead = branch.indexOf("<LastTimeLead");
    expect(lead).toBeGreaterThan(-1);
    expect(lead).toBeLessThan(branch.indexOf("<button"));
    expect(lead).toBeLessThan(branch.indexOf("<HardMomentGuideContent"));
    expect(branch).toContain("<SendWordsButton");
    const words = fs.readFileSync(path.resolve(__dirname, "HardMomentWords.tsx"), "utf8");
    expect(words).toMatch(/data-testid="hm-send-words"[\s\S]{0,120}min-h-11/);
  });
});

describe("B-ASKJB-33 — the two-tap ask", () => {
  it("stage 1: 'Did you manage to hold the plan calmly? Yes · Not this time' (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      harness.lang = lang;
      const html = renderToStaticMarkup(<HeldPlanAsk row={row()} />);
      expect(html).toContain(translate(lang, "hm.held.ask"));
      expect(html).toContain(translate(lang, "hm.held.yes"));
      expect(html).toContain(translate(lang, "hm.held.no"));
      expect(html.match(/min-h-\[44px\]/g)).toHaveLength(2);
    }
  });

  it("stage 2: 'And {name}? Calmer · Same · Harder' — HE 'calmer' agrees with the child's gender", () => {
    const answered = row({ status: "completed", outcome: "helped", held: "yes", outcomeAt: "2026-10-01T20:00:00.000Z" });
    expect(heldStage(answered)).toBe("child");
    let html = renderToStaticMarkup(<HeldPlanAsk row={answered} />);
    expect(html).toContain("And Dylan?");
    for (const r of ["calmer", "same", "harder"]) expect(html).toContain(translate("en", `hm.child.${r}`));
    harness.lang = "he";
    html = renderToStaticMarkup(<HeldPlanAsk row={answered} />);
    expect(html).toContain("רגוע יותר");
    harness.gender = "girl";
    expect(renderToStaticMarkup(<HeldPlanAsk row={answered} />)).toContain("רגועה יותר");
    harness.gender = "unspecified";
    expect(renderToStaticMarkup(<HeldPlanAsk row={answered} />)).toContain("רגוע/ה יותר");
    expect(heldStage({ ...answered, childResponse: "same" })).toBe("done");
  });

  it("a tap writes through the existing seams (outcome + held; then the child's response)", () => {
    const el = HeldPlanAsk({ row: row() }) as React.ReactElement;
    const walk = (n: React.ReactNode): React.ReactElement<Record<string, unknown>>[] =>
      React.isValidElement<Record<string, unknown>>(n) ? [n, ...React.Children.toArray(n.props.children as React.ReactNode).flatMap(walk)] : [];
    const [yes, no] = walk(el).filter((e) => e.type === "button");
    (yes.props.onClick as () => void)();
    (no.props.onClick as () => void)();
    expect(harness.recordTodayOutcome).toHaveBeenNthCalledWith(1, "today.c1.2026-10-01", "helped", "card", "yes");
    expect(harness.recordTodayOutcome).toHaveBeenNthCalledWith(2, "today.c1.2026-10-01", "not_today", "card", "no");
  });

  it("Today's step card and the carry-over line use the two-tap ask for hard-moment steps (source pin)", () => {
    const loop = fs.readFileSync(path.resolve(__dirname, "../overview/TodayActionLoop.tsx"), "utf8");
    expect(loop).toMatch(/source === "hard-moment" && heldStage\(activeTodayAction\) !== "done" \?[\s\S]{0,200}<HeldPlanAsk/);
    const carry = fs.readFileSync(path.resolve(__dirname, "../overview/CarryOverActionAsk.tsx"), "utf8");
    expect(carry).toMatch(/entry\.source === "hard-moment" \? \([\s\S]{0,140}<HeldPlanAsk row=\{entry\} via="carry"/);
  });
});
