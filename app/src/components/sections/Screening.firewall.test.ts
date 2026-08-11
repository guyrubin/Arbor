/**
 * W0.3 clinical-firewall guard — Development Check result screen
 * (docs/ARBOR-UI-MASTERPLAN-2026-08-11.md; standing constraint from the IA
 * masterplan §2: NO verdict tags, no green-vs-amber grading on child-data
 * parent surfaces — counts and observational language only).
 *
 * History: UND-1 removed the verdict WORDS from this screen but the COLOR
 * mechanism survived — `result.elevated` kept flipping the headline wash
 * (yellow-soft vs green-soft), the IconBadge tone (yellow vs mint) and the
 * per-domain Chip pair. This is a tokens.test.ts-style SOURCE scan of
 * Screening.tsx: it fails the build if any screening-outcome boolean
 * (`elevated`, `status === "watch"`) is ever again wired to a tone/color
 * prop, or if the yellow-vs-mint conditional tone pair reappears in any form.
 *
 * Deliberately NOT banned: outcome-gated CTA PRESENCE (`result.elevated &&
 * <button…>` routing to Care) and the recheck-reminder due pill (keyed on
 * `isRecheckDue`, a date fact about a reminder — not a verdict on the child).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "Screening.tsx"), "utf8");

/* ── Banned patterns ─────────────────────────────────────────────────────────
   B1 — the yellow-vs-mint conditional tone pair, either order, anywhere
        (tone={cond ? "yellow" : "mint"} was the exact UND-1 survivor).
   B2 — any `…elevated ?` conditional whose nearby branches carry a graded
        tone string or a graded soft-wash CSS var (yellow/green/pink).
   B3 — same, keyed on the per-domain outcome `status === "watch"`.
   The 240-char window spans multi-line JSX ternaries (the old Chip pair
   spanned two lines) without reaching into unrelated code below. */
const B1_TONE_PAIR =
  /\?\s*["']yellow["']\s*:\s*["']mint["']|\?\s*["']mint["']\s*:\s*["']yellow["']/;
const GRADED_TOKEN = /["'](?:yellow|mint|pink)["']|--arbor-(?:yellow|green|pink)-soft/;
const B2_ELEVATED_COLOR = new RegExp(
  String.raw`\belevated\s*\?[\s\S]{0,240}?(?:${GRADED_TOKEN.source})`,
);
const B3_STATUS_COLOR = new RegExp(
  String.raw`status\s*===?\s*["']watch["'][\s\S]{0,240}?(?:${GRADED_TOKEN.source})`,
);

/* ── Negative controls: the regexes MUST catch the OLD mechanism ─────────────
   Verbatim fixtures of the pre-W0.3 Screening.tsx lines (~302/304/326/84).
   If a refactor ever weakens a regex past recognizing these, this half of the
   suite fails first — the guard can never rot into a vacuous pass. */
const OLD_HEADLINE_WASH =
  `<div className="rounded-[22px] p-6" style={{ background: result.elevated ? "var(--arbor-yellow-soft)" : "var(--arbor-green-soft)" }}>`;
const OLD_BADGE_FLIP = `<IconBadge tone={result.elevated ? "yellow" : "mint"}>`;
const OLD_CHIP_PAIR = `{d.status === "watch"
  ? <Chip tone="yellow" icon={<Icon name="warning" size={14} />}>{t("screen.chip.watch")}</Chip>
  : <Chip tone="mint" icon={<Icon name="check" size={14} />}>{t("screen.chip.calm")}</Chip>}`;
const OLD_MONITOR_TONE = `tone={monitoring.elevated ? "yellow" : "mint"}`;

describe("W0.3 firewall guard — regexes still recognize the OLD banned mechanism", () => {
  it("catches the elevated-flipped headline wash (yellow-soft vs green-soft)", () => {
    expect(B2_ELEVATED_COLOR.test(OLD_HEADLINE_WASH)).toBe(true);
  });
  it("catches the elevated-flipped IconBadge tone (yellow vs mint)", () => {
    expect(B1_TONE_PAIR.test(OLD_BADGE_FLIP)).toBe(true);
    expect(B2_ELEVATED_COLOR.test(OLD_BADGE_FLIP)).toBe(true);
  });
  it("catches the per-domain watch/calm Chip tone pair", () => {
    expect(B3_STATUS_COLOR.test(OLD_CHIP_PAIR)).toBe(true);
  });
  it("catches the monitoring card's elevated tone flip", () => {
    expect(B1_TONE_PAIR.test(OLD_MONITOR_TONE)).toBe(true);
    expect(B2_ELEVATED_COLOR.test(OLD_MONITOR_TONE)).toBe(true);
  });
});

describe("W0.3 firewall guard — Screening.tsx source is clean", () => {
  it("has no yellow-vs-mint conditional tone pair", () => {
    expect(src).not.toMatch(B1_TONE_PAIR);
  });
  it("has no `elevated ?` conditional driving a graded tone/color", () => {
    expect(src).not.toMatch(B2_ELEVATED_COLOR);
  });
  it("has no `status === \"watch\"` conditional driving a graded tone/color", () => {
    expect(src).not.toMatch(B3_STATUS_COLOR);
  });
  it("renders the calm-result reframe (count-based observational strings)", () => {
    // Positive control that the scan is reading the rewritten file: the
    // result screen resolves its copy from i18nElevation/screeningcalm.
    expect(src).toContain("elev.screencalm.");
    expect(src).toContain("i18nElevation/screeningcalm");
  });
});
