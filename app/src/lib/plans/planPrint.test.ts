/**
 * B-BOOK-79 door (b) — "Print {name}'s plan" renders the parent-only copy on
 * the device from the stored row alone: the title and approval line, the
 * steps as the grown-ups do them, every page as the child hears it (with the
 * name in place), the red lines, the sources, the watermark, the data-consent
 * line; never a photo or an image; Hebrew is a right-to-left document; a
 * COUNT of nights, never a rate or a verdict; a row that no longer composes
 * prints nothing.
 */
import { describe, expect, it } from "vitest";
import { renderPlanPrintHtml } from "./planPrint";
import { recordNight } from "./planWeek";
import type { PlanBookDoc } from "../library/plans/planBookDoc";

const doc: PlanBookDoc = {
  id: "plan-poo-sit.c1", bookId: "plan-poo-sit.c1", kind: "plan", pattern: "plan-poo-sit", lang: "en",
  stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["song", "soap-bubbles"], durationDays: 14,
  approvedAt: "2026-10-20T18:00:00.000Z", approvedBy: "parent-1", createdAt: "2026-10-20T18:00:00.000Z", updatedAt: "2026-10-20T18:00:00.000Z", status: "active",
};
const NOW = new Date("2026-10-26T19:00:00.000Z");
const visible = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<script>[\s\S]*?<\/script>/, "").replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, " ");
const VERDICT = /\d+\s?%|\bstreak\b|\b(?:low|medium|high) (?:risk|level)\b|\bon track\b|\bbehind\b|\bscore\b/i;

describe("the parent-only printed plan", () => {
  const html = renderPlanPrintHtml({ doc: recordNight(recordNight(doc, new Date("2026-10-21T19:00:00Z")), new Date("2026-10-23T19:00:00Z")), child: { name: "Noa Levi", gender: "girl" }, lang: "en", now: NOW })!;
  const text = visible(html);

  it("is a left-to-right English document named for the child, marked a parent copy, with the approval line and the night COUNT", () => {
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(text).toContain("Noa");
    expect(text).not.toContain("Levi"); // first name only
    expect(text).toContain("Parent copy");
    expect(text).toMatch(/Approved by a parent on .+, for 14 days\./);
    expect(text).toContain("Nights confirmed by a parent so far: 2");
    expect(text).not.toMatch(VERDICT);
  });

  it("carries the three steps as the grown-ups do them, the box, every page as the child hears it, the red lines and the sources", () => {
    expect(text).toContain("The steps, as the grown-ups do them");
    expect(text).toContain("The box");
    expect(text).toContain("The book, page by page");
    expect((html.match(/<li dir="auto">/g) ?? []).length).toBeGreaterThanOrEqual(3 + 2 + 9 + 3 + 1); // steps + box + cover and 8 pages + red lines + a source
    expect(text).toContain("talk to your family's doctor");
    expect(text).toContain("Where the steps come from");
    expect(html).not.toContain("{name}"); // the child's name is in place on every page
  });

  it("never carries an image (no photo, no hero art) and prints the watermark, the data-consent line and the non-grading footer", () => {
    expect(html).not.toMatch(/<img|background-image|url\(/);
    expect(html).toContain('class="watermark"');
    expect(text).toContain("parent copy · made with Arbor");
    expect(text).toContain("Family data: this is Noa's plan");
    expect(text).toContain("never grades a child");
  });

  it("Hebrew: a right-to-left document in the child's grammatical gender", () => {
    const he = renderPlanPrintHtml({ doc, child: { name: "נועה", gender: "girl" }, lang: "he", now: NOW })!;
    expect(he).toContain('<html lang="he" dir="rtl">');
    const heText = visible(he);
    expect(heText).toContain("עותק להורים");
    expect(heText).toContain("התוכנית של");
    expect(heText).toContain("מידע משפחתי");
    expect(he).not.toMatch(/<img/);
  });

  it("a row that no longer composes prints nothing", () => {
    expect(renderPlanPrintHtml({ doc: { ...doc, stepMenuIds: ["nope", "the-box", "just-try"] }, child: { name: "Noa", gender: "girl" }, lang: "en", now: NOW })).toBeNull();
  });
});
