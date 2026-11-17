import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v), uiLang: state.lang }) };
});

import NoticeCard from "./NoticeCard";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { fmtDayV10 } from "../../lib/formatDate";

const m = ALL_MILESTONES.find((x) => x.id === "cdc-24m-1")!;
const STAMP = { "data-primary-move": "notice-milestone" };
const card = (props: Partial<React.ComponentProps<typeof NoticeCard>> = {}) =>
  renderToStaticMarkup(<NoticeCard milestone={m} shelf="words" childName="Noa" onAnswer={() => undefined} onWhen={() => undefined} onKeepQuote={() => undefined} answers="segmented" {...props} />);
const count = (html: string) => (html.match(/data-primary-move="notice-milestone"/g) ?? []).length;

describe("NoticeCard — the list's stamp follows the card the parent is working on", () => {
  it("held (an answer stored, receipt showing): the stamp is on the stored answer's Change, exactly once", () => {
    const html = card({ selected: "yes", answersAttrs: STAMP, heldAttrs: STAMP });
    expect(count(html)).toBe(1);
    expect(html).toMatch(/data-testid="notice-change" data-primary-move="notice-milestone"/);
  });
  it("held with kept words: the stamp moves to the Keep controls under the kept line, still exactly once", () => {
    const html = card({ selected: "yes", savedWords: "Big ball", savedAt: "2026-01-15T10:00:00.000Z", answersAttrs: STAMP, heldAttrs: STAMP });
    expect(count(html)).toBe(1);
    expect(html).toMatch(/data-testid="notice-keep" class="notice-object-keep" data-primary-move="notice-milestone"/);
    expect(html).not.toMatch(/data-testid="notice-change" data-primary-move/);
  });
  it("NEGATIVE CONTROL: asking (nothing stored), the stamp is on the answers, not on a Change", () => {
    const html = card({ answersAttrs: STAMP, heldAttrs: STAMP });
    expect(count(html)).toBe(1);
    expect(html).not.toContain('data-testid="notice-change"');
    expect(html).toMatch(/data-testid="segmented-answers"[^>]*data-primary-move="notice-milestone"|data-primary-move="notice-milestone"[^>]*data-testid="segmented-answers"/);
  });
  it("a card with no stamp carries none in either phase", () => {
    expect(count(card({ selected: "yes" }))).toBe(0);
    expect(count(card())).toBe(0);
  });
});

describe("NoticeCard — the keepsake receipt's day (V10: the year only outside this year)", () => {
  const thisYear = new Date().getFullYear();
  it.each(["en", "he"] as const)("this year's day reads without the year (%s)", (lang) => {
    state.lang = lang;
    const at = `${thisYear}-01-15T10:00:00.000Z`;
    const html = card({ selected: "yes", savedWords: "Big ball", savedAt: at });
    expect(html).toContain(fmtDayV10(at, lang));
    expect(html.replace(/[⁨⁩]/g, "")).not.toContain(String(thisYear));
  });
  it("NEGATIVE CONTROL: a day from another year keeps its year", () => {
    state.lang = "en";
    const at = `${thisYear - 1}-01-15T10:00:00.000Z`;
    expect(card({ selected: "yes", savedWords: "Big ball", savedAt: at }).replace(/[⁨⁩]/g, "")).toContain(String(thisYear - 1));
  });
});
