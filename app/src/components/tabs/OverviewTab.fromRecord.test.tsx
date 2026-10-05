/**
 * B-TODAY-28 — Today opens from the record, never with a generic prompt.
 * Renders the record card + the receipt (EN + HE, real dictionaries) and pins
 * the OverviewTab wiring: identity line instead of the greeting, the record
 * card first inside the primary move, and the generic capture prompt card
 * suppressed whenever the record speaks.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import type { FromRecordOpener } from "../../lib/today/fromRecord";

const harness = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang as UiLang, k, v) }),
}));
vi.mock("motion/react", () => ({ motion: { p: (p: Record<string, unknown>) => { const { initial: _i, animate: _a, transition: _t, ...rest } = p; return React.createElement("p", rest); } } }));

import FromRecordCard, { FromRecordReceipt } from "../overview/FromRecordCard";

const NOTE = "Calmed and put shoes on within 8 mins instead of usual 25.";
const planOpener: FromRecordOpener = { key: "plan:p1", kind: "plan", topic: "Morning Departure Support Plan", quote: NOTE, quoteSource: "parent", quoteAt: "2026-07-09T08:10:00.000Z" };
const factOpener: FromRecordOpener = { key: "fact:m1", kind: "fact", topic: null, quote: "דילן started a bilingual kindergarten.", quoteSource: "fact", quoteAt: "2026-08-24T10:00:00.000Z" };

const SRC = fs.readFileSync(path.resolve(__dirname, "OverviewTab.tsx"), "utf8");

beforeEach(() => { harness.lang = "en"; });

describe("B-TODAY-28 — the record card (rendered)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: quote verbatim in the editorial serif inside an inline-start rule, the date line, ONE question, three ≥44 px answers`, () => {
      harness.lang = lang;
      const html = renderToStaticMarkup(<FromRecordCard opener={planOpener} onAnswer={() => {}} />);
      expect(html).toContain(NOTE);
      expect(html).toMatch(/data-testid="today-record-quote"[^>]*class="[^"]*border-s-2 ps-3[^"]*text-\[17px\]/);
      expect(html).toContain("var(--font-editorial)");
      expect(html).toContain(translate(lang, "today.record.meta.note", { date: lang === "he" ? "9 ביולי" : "9 Jul" }).split("·")[0].trim());
      expect(html).toContain(translate(lang, "today.record.q.plan"));
      expect(html.match(/data-answer="/g)).toHaveLength(3);
      expect(html.match(/min-h-\[44px\]/g)).toHaveLength(3);
      for (const a of ["easier", "hard_again", "other"]) expect(html).toContain(translate(lang, `today.record.a.change.${a}`));
      // parent register: no illustration, no upper-case label, no gradient, nothing under 12 px
      expect(html).not.toMatch(/<img|HeroAvatar|uppercase|gradient|text-\[(1[01]|[0-9])(\.\d+)?px\]/);
      // a count / % / verdict word is never added by the card
      expect(html.replace(NOTE, "")).not.toMatch(/%|\bscore\b|\bon track\b/i);
    });
  }

  it("user text is bidi-isolated (a Hebrew name at the start never flips an English sentence)", () => {
    const html = renderToStaticMarkup(<FromRecordCard opener={factOpener} onAnswer={() => {}} />);
    expect(html).toMatch(/<blockquote dir="auto"[^>]*><bdi>דילן started/);
    expect(html).toContain(translate("en", "today.record.q.fact"));
    expect(html).toContain(translate("en", "today.record.a.fact.hard_again"));
  });

  it("an answer calls back with the enum (the context writes ONE row)", () => {
    const onAnswer = vi.fn();
    const el = FromRecordCard({ opener: planOpener, onAnswer }) as React.ReactElement<{ children: React.ReactNode }>;
    const walk = (n: React.ReactNode): React.ReactElement<Record<string, unknown>>[] =>
      React.isValidElement<Record<string, unknown>>(n) ? [n, ...React.Children.toArray(n.props.children as React.ReactNode).flatMap(walk)] : [];
    const buttons = walk(el).filter((e) => e.type === "button");
    (buttons[1].props.onClick as () => void)();
    expect(onAnswer).toHaveBeenCalledWith("hard_again");
  });

  it("the receipt is one quiet line — 'Noted · today', no celebration", () => {
    for (const lang of ["en", "he"] as const) {
      harness.lang = lang;
      const html = renderToStaticMarkup(<FromRecordReceipt />);
      expect(html).toContain(translate(lang, "today.record.receipt"));
      expect(html).toContain('role="status"');
      expect(html).not.toMatch(/celebrat|confetti|🎉|!/);
    }
  });
});

describe("B-TODAY-28 — OverviewTab wiring (source pin)", () => {
  it("the greeting to the parent is gone; the child's identity line leads", () => {
    expect(SRC).not.toContain("today.greeting.");
    expect(SRC).not.toContain('t("today.header.prompt")');
    expect(SRC).toContain('data-testid="today-identity"');
    expect(SRC).toMatch(/"today\.identity"/);
  });

  it("the record card is the FIRST thing inside the primary move", () => {
    const anchor = SRC.slice(SRC.indexOf('data-primary-move="do-today-action"'));
    expect(anchor.indexOf("<FromRecordCard")).toBeGreaterThan(-1);
    expect(anchor.indexOf("<FromRecordCard")).toBeLessThan(anchor.indexOf("<TodayContinuation"));
  });

  it("when the record speaks, the generic capture prompt card does not render", () => {
    expect(SRC).toMatch(/recordSpeaks \? null : \(\s*<PromptCaptureCard/);
    expect(SRC).toContain("const recordSpeaks = !!recordOpener || !!recordAnswered;");
  });

  it("the prompt card gets the child's gender (EN he/she)", () => {
    expect(SRC).toMatch(/<PromptCaptureCard\s+gender=\{childProfile\.gender\}/);
  });
});
